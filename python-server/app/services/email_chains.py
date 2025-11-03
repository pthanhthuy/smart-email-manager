"""
LangChain chains for advanced email processing workflows.

This module implements Phase 2 features:
- RAG (Retrieval Augmented Generation) chains for context-aware responses
- Sequential chains for email processing pipelines
- Enhanced response generation using email history as context
"""

from __future__ import annotations

import time
from typing import Any, Dict, List, Optional

from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate, HumanMessagePromptTemplate, SystemMessagePromptTemplate
from langchain_openai import ChatOpenAI

from app.core.config import Settings, get_settings
from app.core.logging import get_logger
from app.models import SmartReplySuggestion
from app.services.ai_responses import AIResponseService
from app.services.embeddings import EmbeddingService
from app.services.vector_store import VectorStore

logger = get_logger(__name__)


class EmailProcessingChains:
    """LangChain chains for email processing workflows."""

    def __init__(
        self,
        settings: Settings | None = None,
        ai_service: AIResponseService | None = None,
        embeddings: EmbeddingService | None = None,
        vector_store: VectorStore | None = None,
    ) -> None:
        self.settings = settings or get_settings()
        self.ai_service = ai_service
        self.embeddings = embeddings
        self.vector_store = vector_store
        
        # Initialize LLM for chains
        self.llm = ChatOpenAI(
            model=self.settings.openai_model,
            temperature=0.7,
            openai_api_key=self.settings.openai_api_key,
            base_url=self.settings.openai_base_url,
        )
        
        # Output parser
        self.output_parser = StrOutputParser()

    async def rag_response_chain(
        self,
        email_data: Dict[str, Any],
        user_instruction: str,
        options: Dict[str, Any],
        context_emails_limit: int = 3,
    ) -> Dict[str, Any]:
        """
        RAG Chain: Generate responses using similar emails as context.
        
        Flow:
        1. Search for similar emails in vector store
        2. Use similar emails as context
        3. Generate enhanced response with context
        
        Args:
            email_data: The email to respond to
            user_instruction: User's instruction for the response
            options: Generation options
            context_emails_limit: Number of similar emails to use as context
            
        Returns:
            Enhanced response with context from similar emails
        """
        logger.info("Running RAG chain for email %s", email_data.get("subject"))
        start_time = time.monotonic()
        
        # Step 1: Retrieve similar emails for context
        context_emails: List[Dict[str, Any]] = []
        if self.vector_store and self.embeddings:
            try:
                # Build query from email content + user instruction
                query_text = f"{email_data.get('subject', '')} {email_data.get('content', '')[:200]} {user_instruction}"
                query_embedding = await self.embeddings.generate_embedding(query_text)
                
                # Search for similar emails
                similar_results = self.vector_store.search(query_embedding, limit=context_emails_limit)
                context_emails = [
                    {
                        "subject": r.get("metadata", {}).get("subject", ""),
                        "from": r.get("metadata", {}).get("from", ""),
                        "content": r.get("document", "")[:500],  # Limit context length
                    }
                    for r in similar_results
                    if r.get("id") != email_data.get("id")  # Exclude the current email
                ]
                logger.info("Found %s similar emails for context", len(context_emails))
            except Exception as e:
                logger.warning("Failed to retrieve context emails: %s", e)
                context_emails = []
        
        # Step 2: Build context string
        context_str = ""
        if context_emails:
            context_str = "\n\nSimilar emails for context:\n"
            for idx, ctx_email in enumerate(context_emails, 1):
                context_str += f"\n{idx}. From: {ctx_email.get('from', 'Unknown')}\n"
                context_str += f"   Subject: {ctx_email.get('subject', 'No Subject')}\n"
                context_str += f"   Content: {ctx_email.get('content', '')[:300]}...\n"
        
        # Step 3: Create enhanced prompt with context
        tone = options.get("tone", "professional")
        tone_description = self._get_tone_description(tone)
        number_of_responses = options.get("numberOfResponses", 3)
        
        email_content = email_data.get('content') or email_data.get('body') or email_data.get('snippet') or ""
        max_email_length = 3000
        if len(email_content) > max_email_length:
            email_content = email_content[:max_email_length] + "..."
        
        system_template = """You are an intelligent email assistant that generates complete, professional email responses. 
Your task is to create full email replies that:
- Are complete, well-written email responses ready to send
- Follow the user's specific instructions and intent exactly
- Match the requested tone: {tone_description}
- Are contextual and relevant to the original email
- Use context from similar emails to create more informed responses
- Include appropriate greetings, body, and closings when natural
- Range from 2-5 sentences typically (but can be longer if needed for clarity)
- Sound natural, human-like, and professional
- Directly address what the user wants to communicate

Generate {number_of_responses} complete, ready-to-send email responses that:
1. Follow the user's instruction precisely ("{user_instruction}")
2. Are complete email responses (not just short phrases)
3. Match the {tone} tone throughout
4. Are contextual and directly respond to the original email
5. Use information from similar emails as context when relevant
6. Include appropriate greetings and closings when natural
7. Are specific to the email content and situation
8. Are well-written, natural, and professional

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
    "userIntent": "summary of what user wants to communicate",
    "contextUsed": true or false
  }}
}}"""

        human_template = """ORIGINAL EMAIL:
---
From: {email_from}
Subject: {email_subject}
Date: {email_date}

Content:
{email_content}
---
{context_emails}

USER'S INSTRUCTION: "{user_instruction}"
REQUESTED TONE: {tone}

Remember: Generate COMPLETE email responses that directly follow the user's instruction. Use context from similar emails to make responses more informed and relevant."""

        prompt = ChatPromptTemplate.from_messages([
            SystemMessagePromptTemplate.from_template(system_template),
            HumanMessagePromptTemplate.from_template(human_template),
        ])
        
        # Format prompt
        formatted_messages = prompt.format_messages(
            tone_description=tone_description,
            number_of_responses=number_of_responses,
            user_instruction=user_instruction,
            tone=tone,
            email_from=email_data.get('from', 'Unknown'),
            email_subject=email_data.get('subject', 'No Subject'),
            email_date=email_data.get('date', 'Unknown'),
            email_content=email_content,
            context_emails=context_str if context_str else "No similar emails found for context.",
        )
        
        # Execute with JSON mode
        try:
            llm_json = ChatOpenAI(
                model=self.settings.openai_model,
                temperature=0.7,
                openai_api_key=self.settings.openai_api_key,
                base_url=self.settings.openai_base_url,
                model_kwargs={"response_format": {"type": "json_object"}},
                max_tokens=1200,
            )
            response = await llm_json.ainvoke(formatted_messages)
            response_text = response.content if hasattr(response, 'content') else str(response)
            
            # Parse JSON response
            import json
            try:
                parsed = json.loads(response_text)
            except json.JSONDecodeError:
                # Fallback to regular AI service
                logger.warning("RAG chain JSON parsing failed, falling back to regular service")
                return await self.ai_service.generate_smart_replies(email_data, user_instruction, options)
        except Exception as e:
            logger.warning("RAG chain execution failed, falling back: %s", e)
            return await self.ai_service.generate_smart_replies(email_data, user_instruction, options)
        
        # Ensure all suggestions have required fields
        if "suggestions" in parsed:
            for suggestion in parsed["suggestions"]:
                if "type" not in suggestion:
                    suggestion["type"] = "response"
                if "emoji" not in suggestion:
                    suggestion["emoji"] = "📧"
                if "tone" not in suggestion:
                    suggestion["tone"] = tone
        
        suggestions = [SmartReplySuggestion(**s) for s in parsed.get("suggestions", [])]
        
        # Extract usage and metadata
        usage = None
        if hasattr(response, 'response_metadata') and response.response_metadata:
            usage_info = response.response_metadata.get('token_usage', {})
            if usage_info:
                from types import SimpleNamespace
                usage = SimpleNamespace(
                    prompt_tokens=usage_info.get('prompt_tokens', 0),
                    completion_tokens=usage_info.get('completion_tokens', 0),
                    total_tokens=usage_info.get('total_tokens', 0),
                )
        
        duration_ms = int((time.monotonic() - start_time) * 1000)
        
        # Add context info to analysis
        analysis = parsed.get("analysis", {})
        analysis["contextUsed"] = len(context_emails) > 0
        analysis["contextEmailsCount"] = len(context_emails)
        
        metadata = {
            "model": self.settings.openai_model,
            "tokensUsed": usage.total_tokens if usage else None,
            "cost": round((usage.total_tokens * 0.00015) if usage else 0, 4),
            "processingTimeMs": duration_ms,
            "chainType": "rag",
            "contextEmailsUsed": len(context_emails),
        }
        
        return {
            "success": True,
            "suggestions": [s.dict() for s in suggestions],
            "analysis": analysis,
            "metadata": metadata,
        }

    async def summary_to_tts_chain(
        self,
        email_data: Dict[str, Any],
        options: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Sequential Chain: Email → Summary → Ready for TTS.
        
        This chain:
        1. Generates email summary
        2. Formats it for TTS
        3. Returns summary ready for text-to-speech
        
        Args:
            email_data: Email to summarize
            options: Summary options
            
        Returns:
            Summary data ready for TTS processing
        """
        logger.info("Running summary-to-TTS chain for email %s", email_data.get("subject"))
        
        # Step 1: Generate summary using AI service
        if not self.ai_service:
            raise ValueError("AI service not initialized for summary chain")
        
        summary_result = await self.ai_service.generate_email_summary(email_data, options)
        summary_text = summary_result.get("summary", "")
        
        # Step 2: Format for TTS (already done by summary service, but we can enhance)
        # The summary is already formatted to be spoken naturally
        
        return {
            "success": True,
            "summary": summary_text,
            "summaryMetadata": summary_result.get("metadata", {}),
            "readyForTTS": True,
            "emailId": email_data.get("id"),
            "emailSubject": email_data.get("subject"),
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

