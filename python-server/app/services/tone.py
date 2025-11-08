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
    "brief": "concise and to the point, brief but complete",
}


def get_tone_guidelines(tone: str) -> str:
    """Get tone-specific guidelines for use in prompts."""
    tone_guidelines = {
        "very formal": """- Use formal titles (Mr., Ms., Dr., etc.) when appropriate
- Avoid contractions (use "cannot" instead of "can't", "I will" instead of "I'll")
- Use formal salutations: "Dear [Title] [Last Name]," or "Dear Sir/Madam,"
- Use formal closings: "Respectfully yours," "Sincerely," "Yours faithfully,"
- Structure sentences formally with complete thoughts
- Avoid casual expressions or colloquialisms
- Use passive voice when appropriate for formality
- Maintain respectful distance and professional boundaries""",
        "formal": """- Use appropriate titles and formal greetings
- Prefer "cannot" over "can't" but contractions are acceptable in moderation
- Use standard business closings: "Best regards," "Sincerely," "Regards,"
- Maintain professional structure and formatting
- Use clear, direct language
- Avoid overly casual expressions
- Keep a respectful, professional tone""",
        "professional": """- Use standard business greetings: "Hi [Name]," or "Hello [Name],"
- Contractions are acceptable and natural
- Use professional but friendly closings: "Best regards," "Best," "Thanks,"
- Balance professionalism with approachability
- Use clear, direct communication
- Can be slightly more conversational than formal
- Maintain business-appropriate language""",
        "casual": """- Use friendly greetings: "Hi [Name]," "Hey [Name]," or just "[Name],"
- Contractions are natural and expected
- Use casual closings: "Thanks," "Best," "Talk soon," "Cheers,"
- Can use more conversational language
- Structure can be more relaxed
- Still maintain professionalism and respect
- Can include friendly expressions""",
        "very casual": """- Use very relaxed greetings: "Hey," "Hi there," or just start with the message
- Contractions are natural and frequent
- Use very casual closings: "Thanks!", "See you!", "Talk later," or no closing
- Very conversational, like talking to a friend
- Can use casual expressions and idioms
- Relaxed sentence structure
- Warm and friendly throughout""",
        "friendly": """- Use warm greetings: "Hi [Name]!," "Hello [Name]!," with enthusiasm
- Show personality and warmth
- Use friendly closings: "Best wishes," "Take care," "Looking forward to it!"
- Include positive language and expressions
- Show genuine interest and engagement
- Use exclamation points appropriately for enthusiasm
- Make the recipient feel valued""",
        "apologetic": """- Start with acknowledgment: "I apologize," "I'm sorry," "I understand your concern"
- Take full responsibility without excuses
- Show genuine understanding and empathy
- Use phrases like: "I understand how this must have," "I take full responsibility"
- Focus on solutions and next steps
- Maintain professionalism while showing remorse
- Avoid defensive language""",
        "urgent": """- Get to the point quickly in the opening
- Use direct language: "I need," "Please," "As soon as possible"
- Clearly state deadlines or timeframes
- Emphasize importance without panic
- Use action-oriented language
- Make action items very clear
- Can use phrases like: "Time-sensitive," "Urgent," "Immediate attention needed" """,
        "diplomatic": """- Use careful, measured language
- Avoid direct accusations or confrontations
- Use phrases like: "I understand your perspective," "I see where you're coming from"
- Present multiple viewpoints when appropriate
- Use softening language: "Perhaps," "It might be worth considering," "I wonder if"
- Maintain respect for all parties
- Focus on finding common ground""",
        "enthusiastic": """- Use positive, energetic language throughout
- Include exclamation points appropriately
- Use phrases like: "I'm excited to," "This is great," "I'm thrilled"
- Show genuine excitement and positivity
- Use celebratory language when appropriate
- Make the recipient feel the enthusiasm
- Keep energy high but professional""",
        "brief": """- Get straight to the point in the first sentence
- Eliminate unnecessary words and phrases
- Use short, direct sentences
- Skip lengthy greetings if not necessary
- Focus only on essential information
- Use concise closings: "Thanks," "Best," or minimal closing
- Maximum efficiency in communication""",
    }
    return tone_guidelines.get(tone.lower(), """- Use standard business greetings
- Maintain professional but approachable tone
- Use clear, direct communication
- Balance professionalism with friendliness""")


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
        tone_guidelines = get_tone_guidelines(target_tone)
        prompt = f"""Rewrite this email response to be {description}.

ORIGINAL RESPONSE:
"{original_response}"

TARGET TONE: {target_tone}
TONE CHARACTERISTICS:
{description}

REQUIREMENTS:
- Keep the same meaning and intent completely intact
- Maintain the same length (approximately)
- Use the target tone: {target_tone} consistently throughout
- Make it sound natural and human-like
- Preserve any important details, questions, or action items
- Maintain the same level of formality/informality as the target tone requires
- Ensure the tone change feels natural and appropriate

TONE-SPECIFIC GUIDELINES:
{tone_guidelines}

OUTPUT FORMAT:
Just provide the rewritten response, nothing else. Do not include explanations or metadata.

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


