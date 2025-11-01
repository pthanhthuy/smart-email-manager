"""
AI response generation and summarisation services.
"""

from __future__ import annotations

import json
import re
import time
from typing import Any, Dict, List, Optional

from openai import OpenAI

from app.core.config import Settings, get_settings
from app.core.logging import get_logger
from app.models import SmartReplySuggestion

from .history import ResponseHistoryService

logger = get_logger(__name__)


class AIResponseService:
    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()
        if not self.settings.openai_api_key:
            raise ValueError("OPENAI_API_KEY is not configured.")
        self.client = OpenAI(
            api_key=self.settings.openai_api_key,
            base_url=self.settings.openai_base_url,
        )
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

    def _chat_completion(self, messages: List[Dict[str, str]], max_tokens: Optional[int] = None) -> Dict[str, Any]:
        response = self.client.chat.completions.create(
            model=self.settings.openai_model,
            messages=messages,
            temperature=0.7,
            max_tokens=max_tokens or self.settings.max_response_tokens,
        )
        return {
            "text": response.choices[0].message.content,
            "usage": response.usage,
        }

    async def generate_smart_replies(self, email_data: Dict[str, Any], user_instruction: str, options: Dict[str, Any]) -> Dict[str, Any]:
        logger.info("Generating smart replies for email %s with instruction: %s", email_data.get("subject"), user_instruction)
        prompt = self._build_smart_reply_prompt(email_data, user_instruction, options)
        
        # Get tone from options, default to professional
        tone = options.get("tone", "professional")
        tone_description = self._get_tone_description(tone)
        
        system_message = f"""You are an intelligent email assistant that generates complete, professional email responses. 
Your task is to create full email replies (not just short snippets) that:
- Are complete, well-written email responses ready to send
- Follow the user's specific instructions and intent exactly
- Match the requested tone: {tone_description}
- Are contextual and relevant to the original email
- Include appropriate greetings, body, and closings when natural
- Range from 2-5 sentences typically (but can be longer if needed for clarity)
- Sound natural, human-like, and professional
- Directly address what the user wants to communicate"""

        messages = [
            {"role": "system", "content": system_message},
            {"role": "user", "content": prompt},
        ]
        start = time.monotonic()
        # Increase max_tokens significantly for full email responses (500-800 words typically need 600-1000 tokens)
        result = self._chat_completion(messages, max_tokens=1200)
        duration_ms = int((time.monotonic() - start) * 1000)
        parsed = self._parse_ai_response(result["text"])
        suggestions = [SmartReplySuggestion(**suggestion) for suggestion in parsed.get("suggestions", [])]

        metadata = {
            "model": self.settings.openai_model,
            "tokensUsed": result["usage"].total_tokens if result["usage"] else None,
            "cost": round((result["usage"].total_tokens * 0.00015) if result["usage"] else 0, 4),  # approximate
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

    def _build_smart_reply_prompt(self, email_data: Dict[str, Any], user_instruction: str, options: Dict[str, Any]) -> str:
        """Build a prompt for generating flexible email responses based on user instruction."""
        tone = options.get("tone", "professional")
        email_content = email_data.get('content') or email_data.get('body') or email_data.get('snippet') or ""
        
        # Limit email content to avoid token limits, but keep it substantial
        max_email_length = 3000
        if len(email_content) > max_email_length:
            email_content = email_content[:max_email_length] + "..."
        
        number_of_responses = options.get("numberOfResponses", 3)
        
        return f"""Generate {number_of_responses} complete email response options based on the user's instruction.

ORIGINAL EMAIL:
---
From: {email_data.get('from', 'Unknown')}
Subject: {email_data.get('subject', 'No Subject')}
Date: {email_data.get('date', 'Unknown')}

Content:
{email_content}
---

USER'S INSTRUCTION: "{user_instruction}"
REQUESTED TONE: {tone}

TASK:
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
    {{
      "type": "response",
      "text": "Another complete email response option...",
      "emoji": "📧",
      "tone": "{tone}"
    }},
    {{
      "type": "response",
      "text": "Third complete email response option...",
      "emoji": "📧",
      "tone": "{tone}"
    }}
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

    async def generate_email_summary(self, email_data: Dict[str, Any], options: Dict[str, Any]) -> Dict[str, Any]:
        prompt = self._build_summary_prompt(email_data, options)
        messages = [
            {
                "role": "system",
                "content": "You are an expert email summarizer. Create clear, conversational summaries that are easy to understand and speak naturally. Focus on the main content and key information. Write in a way that flows well when read aloud, using simple language and natural sentence structure.",
            },
            {"role": "user", "content": prompt},
        ]
        result = self._chat_completion(messages, max_tokens=250)
        summary = result["text"].strip()
        metadata = {
            "model": self.settings.openai_model,
            "tokensUsed": result["usage"].total_tokens if result["usage"] else None,
            "cost": round((result["usage"].total_tokens * 0.00015) if result["usage"] else 0, 4),
        }
        return {
            "success": True,
            "summary": summary,
            "metadata": metadata,
            "emailId": email_data.get("id"),
            "emailSubject": email_data.get("subject"),
        }

    def _build_summary_prompt(self, email_data: Dict[str, Any], options: Dict[str, Any]) -> str:
        content = email_data.get("content") or email_data.get("body") or email_data.get("snippet") or ""
        max_length = options.get("maxLength", 2000)
        if len(content) > max_length:
            content = content[:max_length] + "..."
        return f"""
Please provide a clear, concise summary of this email that focuses on the main content and is easy to understand:

**Email Details:**
- From: {email_data.get('from') or 'Unknown'}
- Subject: {email_data.get('subject') or 'No Subject'}
- Date: {email_data.get('date') or 'Unknown'}

**Email Content:**
{content}

**Summary Format:**
Create a simple, conversational summary that includes:

1. **Main Message**: What is the primary purpose or main point of this email?
2. **Key Information**: What are the most important details the recipient needs to know?
3. **Action Required**: Is there anything the recipient needs to do or respond to?
4. **Important Details**: Any dates, times, locations, or specific information mentioned?

Write the summary in a natural, easy-to-understand way that flows well when spoken aloud. Keep it concise but comprehensive. Use simple language and clear structure.
""".strip()

    async def test_with_sample_email(self) -> Dict[str, Any]:
        sample_email = {
            "from": "Sarah Johnson <sarah@company.com>",
            "subject": "Project Meeting Next Week",
            "content": "Hi! I'm organizing a project sync meeting for next Tuesday at 2pm. Can you join us? We'll discuss the Q4 roadmap. Let me know!",
            "date": "2025-01-20",
        }
        user_instruction = "I'm available and want to join"
        return await self.generate_smart_replies(sample_email, user_instruction, {})

