"""
Tone adjustment and analysis using OpenAI.
"""

from __future__ import annotations

from typing import Any, Dict, List

from openai import OpenAI

from app.core.config import Settings, get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)


TONE_DESCRIPTIONS: Dict[str, str] = {
    "very formal": "very formal and professional, using formal language and structure",
    "formal": "formal and professional, maintaining business etiquette",
    "professional": "professional but approachable, business-appropriate",
    "casual": "casual and friendly, conversational but still professional",
    "very casual": "very casual and relaxed, like talking to a friend",
    "friendly": "warm and friendly, approachable and personable",
    "apologetic": "apologetic and understanding, showing empathy",
    "urgent": "urgent and direct, conveying importance",
    "diplomatic": "diplomatic and tactful, carefully worded",
    "enthusiastic": "enthusiastic and positive, showing excitement",
}


class ToneAdjustmentService:
    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()
        if not self.settings.openai_api_key:
            raise ValueError("OPENAI_API_KEY is not configured.")
        self.client = OpenAI(
            api_key=self.settings.openai_api_key,
            base_url=self.settings.openai_base_url,
        )

    def _chat(self, messages: List[Dict[str, str]], max_tokens: int = 200, temperature: float = 0.7):
        response = self.client.chat.completions.create(
            model=self.settings.openai_model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        return {
            "text": response.choices[0].message.content.strip(),
            "usage": response.usage,
        }

    async def adjust_tone(self, original_response: str, target_tone: str, options: Dict[str, Any]) -> Dict[str, Any]:
        description = TONE_DESCRIPTIONS.get(target_tone.lower(), target_tone)
        prompt = f"""Rewrite this email response to be {description}.

ORIGINAL RESPONSE:
"{original_response}"

REQUIREMENTS:
- Keep the same meaning and intent
- Maintain the same length (approximately)
- Use the target tone: {target_tone}
- Make it sound natural and human-like
- Preserve any important details or questions

OUTPUT FORMAT:
Just provide the rewritten response, nothing else.

REWRITTEN RESPONSE:"""

        messages = [
            {
                "role": "system",
                "content": "You are an expert at adjusting email tone. Rewrite responses to match the desired tone while keeping the same meaning and intent.",
            },
            {"role": "user", "content": prompt},
        ]
        result = self._chat(messages)
        adjusted = result["text"]
        usage = result["usage"]
        metadata = {
            "model": self.settings.openai_model,
            "tokensUsed": usage.total_tokens if usage else None,
            "cost": round((usage.total_tokens * 0.00015) if usage else 0, 4),
        }
        return {
            "success": True,
            "originalResponse": original_response,
            "adjustedResponse": adjusted,
            "targetTone": target_tone,
            "metadata": metadata,
        }

    async def analyze_tone(self, response: str) -> Dict[str, Any]:
        prompt = f"""Analyze the tone of this email response and provide a detailed analysis.

RESPONSE:
"{response}"

Please analyze and provide:
1. Primary tone (formal, casual, professional, etc.)
2. Confidence level (0-100)
3. Key characteristics
4. Suggested improvements

OUTPUT FORMAT (JSON):
{{
  "primaryTone": "professional",
  "confidence": 85,
  "characteristics": ["polite", "direct", "business-appropriate"],
  "suggestions": ["Could be more casual", "Consider adding enthusiasm"]
}}"""

        messages = [
            {
                "role": "system",
                "content": "You are an expert at analyzing email tone. Provide accurate tone analysis in JSON format.",
            },
            {"role": "user", "content": prompt},
        ]
        result = self._chat(messages, max_tokens=300, temperature=0.3)
        content = result["text"]
        import json

        try:
            json_str = content[content.index("{") : content.rindex("}") + 1]
            analysis = json.loads(json_str)
        except (ValueError, json.JSONDecodeError):
            logger.warning("Failed to parse tone analysis JSON, returning fallback structure.")
            analysis = {
                "primaryTone": "unknown",
                "confidence": 0,
                "characteristics": [],
                "suggestions": [],
            }
        usage = result["usage"]
        metadata = {
            "tokensUsed": usage.total_tokens if usage else None,
            "cost": round((usage.total_tokens * 0.00015) if usage else 0, 4),
        }
        return {
            "success": True,
            "analysis": analysis,
            "metadata": metadata,
        }

    async def batch_adjust_tone(self, responses: List[Dict[str, str]], target_tone: str) -> Dict[str, Any]:
        adjusted_responses: List[Dict[str, str]] = []
        for response in responses:
            text = response.get("text") or ""
            adjusted = await self.adjust_tone(text, target_tone, {})
            adjusted_responses.append(
                {
                    **response,
                    "text": adjusted["adjustedResponse"],
                    "originalText": text,
                    "toneAdjusted": True,
                    "targetTone": target_tone,
                }
            )
        return {
            "success": True,
            "adjustedResponses": adjusted_responses,
            "targetTone": target_tone,
            "count": len(adjusted_responses),
        }

    def get_available_tones(self) -> List[Dict[str, str]]:
        return [
            {
                "value": key,
                "label": key.title(),
                "description": description,
                "example": "",  # examples can be populated as needed
            }
            for key, description in TONE_DESCRIPTIONS.items()
        ]

    async def test_with_sample_data(self) -> Dict[str, Any]:
        sample_response = "Hi Sarah, Tuesday at 2pm works great for me!"
        target_tone = "very casual"
        result = await self.adjust_tone(sample_response, target_tone, {})
        return {
            "success": True,
            "message": "Tone adjustment service test completed",
            "originalResponse": sample_response,
            "adjustedResponse": result["adjustedResponse"],
            "targetTone": target_tone,
            "metadata": result["metadata"],
        }


