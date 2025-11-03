"""
AI response generation and summarisation services using LangChain.
"""

from __future__ import annotations

import json
import re
import time
from typing import Any, Dict, List, Optional

from langchain_core.output_parsers import PydanticOutputParser
from langchain_core.output_parsers.json import SimpleJsonOutputParser
from langchain_core.prompts import ChatPromptTemplate, SystemMessagePromptTemplate, HumanMessagePromptTemplate
from langchain_openai import ChatOpenAI

from app.core.config import Settings, get_settings
from app.core.logging import get_logger
from app.models import SmartReplySuggestion, SmartReplyOutput, EmailAnalysis

from .history import ResponseHistoryService

logger = get_logger(__name__)


class AIResponseService:
    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()
        if not self.settings.openai_api_key:
            raise ValueError("OPENAI_API_KEY is not configured.")
        
        # Initialize LangChain ChatOpenAI
        self.llm = ChatOpenAI(
            model=self.settings.openai_model,
            temperature=0.7,
            openai_api_key=self.settings.openai_api_key,
            base_url=self.settings.openai_base_url,
            max_tokens=self.settings.max_response_tokens,
        )
        
        # Initialize output parser for structured responses
        self.output_parser = PydanticOutputParser(pydantic_object=SmartReplyOutput)
        self.json_parser = SimpleJsonOutputParser()
        
        self.history_service = ResponseHistoryService(self.settings)

    def _parse_ai_response(self, response_text: str) -> Dict[str, Any]:
        """Parse AI response, handling both JSON and fallback formats."""
        try:
            # Try to extract JSON from response
            start = response_text.index("{")
            end = response_text.rindex("}") + 1
            json_str = response_text[start:end]
            parsed = json.loads(json_str)
            
            # Ensure all suggestions have required fields
            if "suggestions" in parsed:
                for suggestion in parsed["suggestions"]:
                    if "type" not in suggestion:
                        suggestion["type"] = "response"
                    if "emoji" not in suggestion:
                        suggestion["emoji"] = "📧"
                    if "tone" not in suggestion:
                        suggestion["tone"] = suggestion.get("tone", "professional")
            
            return parsed
        except (ValueError, json.JSONDecodeError) as e:
            logger.warning("Failed to parse AI response as JSON (%s). Falling back to heuristic parsing.", e)
            # Fallback: try to extract response text from markdown code blocks or plain text
            suggestions: List[Dict[str, Any]] = []
            
            # Look for text between markdown code blocks
            code_blocks = re.findall(r'```(?:\w+)?\n(.*?)\n```', response_text, re.DOTALL)
            if code_blocks:
                for block in code_blocks:
                    try:
                        parsed_block = json.loads(block)
                        if "suggestions" in parsed_block:
                            suggestions.extend(parsed_block["suggestions"])
                    except json.JSONDecodeError:
                        pass
            
            # If no code blocks, try to find numbered list items or paragraphs
            if not suggestions:
                lines = response_text.split("\n")
                current_text = ""
                for line in lines:
                    line = line.strip()
                    # Skip empty lines and JSON structure lines
                    if not line or line.startswith("{") or line.startswith("}") or '"' in line[:5]:
                        if current_text and len(current_text) > 10:
                            suggestions.append({
                                "type": "response",
                                "text": current_text.strip(),
                                "emoji": "📧",
                            })
                            current_text = ""
                        continue
                    current_text += line + " "
                
                # Add last suggestion if exists
                if current_text and len(current_text) > 10:
                    suggestions.append({
                        "type": "response",
                        "text": current_text.strip(),
                        "emoji": "📧",
                    })
            
            # If still no suggestions, create a single one from the full response
            if not suggestions:
                clean_text = response_text.strip()
                # Remove markdown formatting
                clean_text = re.sub(r'```[a-z]*\n', '', clean_text)
                clean_text = re.sub(r'```', '', clean_text)
                clean_text = clean_text.strip()
                if len(clean_text) > 10:
                    suggestions.append({
                        "type": "response",
                        "text": clean_text,
                        "emoji": "📧",
                    })
            
            return {
                "suggestions": suggestions[:3] if suggestions else [
                    {"type": "response", "text": "Thank you for your email. I'll get back to you soon.", "emoji": "📧"},
                    {"type": "response", "text": "I appreciate you reaching out. Let me review this and respond accordingly.", "emoji": "📧"},
                    {"type": "response", "text": "Thanks for the information. I'll follow up as soon as possible.", "emoji": "📧"},
                ],
                "analysis": {
                    "emailType": "general",
                    "urgency": "medium",
                    "tone": "professional",
                    "keyPoints": [],
                    "userIntent": "General response requested",
                },
            }

    async def _chat_completion(self, messages: List, max_tokens: Optional[int] = None) -> Dict[str, Any]:
        """Execute chat completion using LangChain with usage tracking.
        
        Args:
            messages: List of formatted messages (from prompt.format_messages())
            max_tokens: Optional maximum tokens for the response
        """
        # Create a temporary LLM with max_tokens if specified
        llm = self.llm
        if max_tokens:
            llm = ChatOpenAI(
                model=self.settings.openai_model,
                temperature=0.7,
                openai_api_key=self.settings.openai_api_key,
                base_url=self.settings.openai_base_url,
                max_tokens=max_tokens,
            )
        
        response = await llm.ainvoke(messages)
        
        # Extract usage from response metadata if available
        usage = None
        if hasattr(response, 'response_metadata') and response.response_metadata:
            usage_info = response.response_metadata.get('token_usage', {})
            if usage_info:
                from types import SimpleNamespace
                usage = SimpleNamespace(
                    prompt_tokens=usage_info.get('prompt_tokens', 0),
                    completion_tokens=usage_info.get('completion_tokens', 0),
                    total_tokens=usage_info.get('total_tokens', 0)
                )
        
        return {
            "text": response.content if hasattr(response, 'content') else str(response),
            "usage": usage,
        }

    async def generate_smart_replies(self, email_data: Dict[str, Any], user_instruction: str, options: Dict[str, Any]) -> Dict[str, Any]:
        logger.info("Generating smart replies for email %s with instruction: %s", email_data.get("subject"), user_instruction)
        
        # Get tone from options, default to professional
        tone = options.get("tone", "professional")
        tone_description = self._get_tone_description(tone)
        
        # Build email content string
        email_content_str = self._build_email_content_string(email_data, options)
        number_of_responses = options.get("numberOfResponses", 3)
        
        # Create LangChain prompt template
        system_template = """You are an intelligent email assistant that generates complete, professional email responses. 
Your task is to create full email replies (not just short snippets) that:
- Are complete, well-written email responses ready to send
- Follow the user's specific instructions and intent exactly
- Match the requested tone: {tone_description}
- Are contextual and relevant to the original email
- Include appropriate greetings, body, and closings when natural
- Range from 2-5 sentences typically (but can be longer if needed for clarity)
- Sound natural, human-like, and professional
- Directly address what the user wants to communicate

Generate {number_of_responses} complete, ready-to-send email responses that:
1. Follow the user's instruction precisely ("{user_instruction}")
2. Are complete email responses (not just short phrases)
3. Match the {tone} tone throughout
4. Are contextual and directly respond to the original email
5. Include appropriate greetings and closings when natural
6. Are specific to the email content and situation
7. Are well-written, natural, and professional

IMPORTANT:
- These should be FULL email responses ready to send, typically 2-5 sentences or more if needed
- Do NOT limit to 10 words - generate complete, thoughtful responses
- Base responses DIRECTLY on what the user wants to communicate
- Make each response distinct and offer different approaches/angles
- If the user instruction is specific (e.g., "I can attend"), generate variations that express this in different ways
- If the user instruction is general (e.g., "Generate a helpful response"), create varied appropriate responses

OUTPUT FORMAT (JSON):
{{
  "suggestions": [
    {{
      "type": "response",
      "text": "Complete email response text here...",
      "emoji": "📧",
      "tone": "{tone}"
    }},
    ...
  ],
  "analysis": {{
    "emailType": "meeting_invitation|question|request|announcement|general",
    "urgency": "low|medium|high",
    "originalTone": "detected tone from original email",
    "keyPoints": ["key point 1", "key point 2"],
    "userIntent": "summary of what user wants to communicate"
  }}
}}

Remember: Generate COMPLETE email responses that directly follow the user's instruction. Each response should be a full, ready-to-send email."""

        human_template = """ORIGINAL EMAIL:
---
From: {email_from}
Subject: {email_subject}
Date: {email_date}

Content:
{email_content}
---

USER'S INSTRUCTION: "{user_instruction}"
REQUESTED TONE: {tone}"""

        prompt = ChatPromptTemplate.from_messages([
            SystemMessagePromptTemplate.from_template(system_template),
            HumanMessagePromptTemplate.from_template(human_template),
        ])
        
        # Format prompt with variables
        formatted_prompt = prompt.format_messages(
            tone_description=tone_description,
            number_of_responses=number_of_responses,
            user_instruction=user_instruction,
            tone=tone,
            email_from=email_data.get('from', 'Unknown'),
            email_subject=email_data.get('subject', 'No Subject'),
            email_date=email_data.get('date', 'Unknown'),
            email_content=email_content_str,
        )
        
        start = time.monotonic()
        
        # Use LangChain with JSON mode for structured output
        try:
            # Try with structured output first
            llm_json = ChatOpenAI(
                model=self.settings.openai_model,
                temperature=0.7,
                openai_api_key=self.settings.openai_api_key,
                base_url=self.settings.openai_base_url,
                model_kwargs={"response_format": {"type": "json_object"}},
                max_tokens=1200,
            )
            response = await llm_json.ainvoke(formatted_prompt)
            response_text = response.content if hasattr(response, 'content') else str(response)
            
            # Parse JSON response
            try:
                parsed = json.loads(response_text)
            except json.JSONDecodeError:
                parsed = self._parse_ai_response(response_text)
        except Exception as e:
            logger.warning("Structured output failed, using fallback: %s", e)
            # Fallback: use regular LLM call with formatted messages
            result = await self._chat_completion(formatted_prompt, max_tokens=1200)
            parsed = self._parse_ai_response(result["text"])
            # Create a dummy response object for usage extraction
            response = type('obj', (object,), {
                'response_metadata': {'token_usage': {
                    'prompt_tokens': result["usage"].prompt_tokens if result["usage"] else 0,
                    'completion_tokens': result["usage"].completion_tokens if result["usage"] else 0,
                    'total_tokens': result["usage"].total_tokens if result["usage"] else 0,
                }} if result["usage"] else {}
            })()
        
        duration_ms = int((time.monotonic() - start) * 1000)
        
        # Ensure all suggestions have required fields
        if "suggestions" in parsed:
            for suggestion in parsed["suggestions"]:
                if "type" not in suggestion:
                    suggestion["type"] = "response"
                if "emoji" not in suggestion:
                    suggestion["emoji"] = "📧"
                if "tone" not in suggestion:
                    suggestion["tone"] = suggestion.get("tone", "professional")
        
        suggestions = [SmartReplySuggestion(**suggestion) for suggestion in parsed.get("suggestions", [])]

        # Try to get usage from response metadata
        usage = None
        if hasattr(response, 'response_metadata') and response.response_metadata:
            usage_info = response.response_metadata.get('token_usage', {})
            if usage_info:
                from types import SimpleNamespace
                usage = SimpleNamespace(
                    prompt_tokens=usage_info.get('prompt_tokens', 0),
                    completion_tokens=usage_info.get('completion_tokens', 0),
                    total_tokens=usage_info.get('total_tokens', 0)
                )

        metadata = {
            "model": self.settings.openai_model,
            "tokensUsed": usage.total_tokens if usage else None,
            "cost": round((usage.total_tokens * 0.00015) if usage else 0, 4),  # approximate
            "processingTimeMs": duration_ms,
        }

        try:
            history_entry = await self.history_service.add_history_entry(email_data, user_instruction, suggestions, parsed.get("analysis", {}), metadata)
            metadata["historyId"] = history_entry["id"]
        except Exception as exc:  # pylint: disable=broad-except
            logger.warning("Failed to save response history: %s", exc)

        return {
            "success": True,
            "suggestions": [suggestion.dict() for suggestion in suggestions],
            "analysis": parsed.get("analysis", {}),
            "metadata": metadata,
        }
    
    def _build_email_content_string(self, email_data: Dict[str, Any], options: Dict[str, Any]) -> str:
        """Extract and format email content for prompt."""
        email_content = email_data.get('content') or email_data.get('body') or email_data.get('snippet') or ""
        
        # Limit email content to avoid token limits, but keep it substantial
        max_email_length = 3000
        if len(email_content) > max_email_length:
            email_content = email_content[:max_email_length] + "..."
        
        return email_content

    def _get_tone_description(self, tone: str) -> str:
        """Get a description of the tone for use in prompts."""
        tone_descriptions = {
            "professional": "professional but approachable, business-appropriate",
            "casual": "casual and friendly, conversational but still professional",
            "brief": "concise and to the point, brief but complete",
            "friendly": "warm and friendly, approachable and personable",
            "formal": "formal and professional, maintaining business etiquette",
            "very formal": "very formal and professional, using formal language and structure",
            "very casual": "very casual and relaxed, like talking to a friend",
            "apologetic": "apologetic and understanding, showing empathy",
            "urgent": "urgent and direct, conveying importance",
            "diplomatic": "diplomatic and tactful, carefully worded",
            "enthusiastic": "enthusiastic and positive, showing excitement",
        }
        return tone_descriptions.get(tone.lower(), "professional but approachable")


    async def generate_email_summary(self, email_data: Dict[str, Any], options: Dict[str, Any]) -> Dict[str, Any]:
        """Generate email summary using LangChain."""
        # Build email content
        content = email_data.get("content") or email_data.get("body") or email_data.get("snippet") or ""
        max_length = options.get("maxLength", 2000)
        if len(content) > max_length:
            content = content[:max_length] + "..."
        
        # Create LangChain prompt template
        system_template = """You are an expert email summarizer. Create clear, conversational summaries that are easy to understand and speak naturally. Focus on the main content and key information. Write in a way that flows well when read aloud, using simple language and natural sentence structure."""
        
        human_template = """Please provide a clear, concise summary of this email that focuses on the main content and is easy to understand:

**Email Details:**
- From: {email_from}
- Subject: {email_subject}
- Date: {email_date}

**Email Content:**
{email_content}

**Summary Format:**
Create a simple, conversational summary that includes:

1. **Main Message**: What is the primary purpose or main point of this email?
2. **Key Information**: What are the most important details the recipient needs to know?
3. **Action Required**: Is there anything the recipient needs to do or respond to?
4. **Important Details**: Any dates, times, locations, or specific information mentioned?

Write the summary in a natural, easy-to-understand way that flows well when spoken aloud. Keep it concise but comprehensive. Use simple language and clear structure."""

        prompt = ChatPromptTemplate.from_messages([
            SystemMessagePromptTemplate.from_template(system_template),
            HumanMessagePromptTemplate.from_template(human_template),
        ])
        
        # Format prompt
        formatted_prompt = prompt.format_messages(
            email_from=email_data.get('from') or 'Unknown',
            email_subject=email_data.get('subject') or 'No Subject',
            email_date=email_data.get('date') or 'Unknown',
            email_content=content,
        )
        
        # Execute with LangChain
        response = await self.llm.ainvoke(formatted_prompt)
        summary = response.content.strip() if hasattr(response, 'content') else str(response).strip()
        
        # Extract usage if available
        usage = None
        if hasattr(response, 'response_metadata') and response.response_metadata:
            usage_info = response.response_metadata.get('token_usage', {})
            if usage_info:
                from types import SimpleNamespace
                usage = SimpleNamespace(
                    prompt_tokens=usage_info.get('prompt_tokens', 0),
                    completion_tokens=usage_info.get('completion_tokens', 0),
                    total_tokens=usage_info.get('total_tokens', 0)
                )
        
        metadata = {
            "model": self.settings.openai_model,
            "tokensUsed": usage.total_tokens if usage else None,
            "cost": round((usage.total_tokens * 0.00015) if usage else 0, 4),
        }
        return {
            "success": True,
            "summary": summary,
            "metadata": metadata,
            "emailId": email_data.get("id"),
            "emailSubject": email_data.get("subject"),
        }


    async def test_with_sample_email(self) -> Dict[str, Any]:
        sample_email = {
            "from": "Sarah Johnson <sarah@company.com>",
            "subject": "Project Meeting Next Week",
            "content": "Hi! I'm organizing a project sync meeting for next Tuesday at 2pm. Can you join us? We'll discuss the Q4 roadmap. Let me know!",
            "date": "2025-01-20",
        }
        user_instruction = "I'm available and want to join"
        return await self.generate_smart_replies(sample_email, user_instruction, {})

