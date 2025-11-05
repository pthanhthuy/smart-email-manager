"""
Email classification service for categorizing emails into predefined categories.
Uses rule-based classification first, then AI-based classification for ambiguous cases.
"""

from __future__ import annotations

import json
import re
from typing import Any, Dict, List, Optional

from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI

from app.core.config import Settings, get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)

CATEGORIES = [
    "work",
    "personal",
    "promotion",
    "marketing",
    "newsletter",
    "notification",
    "social",
    "finance",
    "spam",
    "other",
]


class EmailClassificationService:
    """Service for classifying emails into predefined categories."""

    def __init__(self, settings: Settings | None = None) -> None:
        """Initialize the classification service."""
        self.settings = settings or get_settings()
        self.llm = ChatOpenAI(
            model=self.settings.openai_model,
            temperature=0.3,  # Lower temperature for consistent classification
            openai_api_key=self.settings.openai_api_key,
            base_url=self.settings.openai_base_url,
        )

    def _detect_spam(self, email: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Comprehensive spam detection using multiple indicators."""
        from_field = email.get("from", "").lower()
        subject = (email.get("subject") or "").lower()
        body = (email.get("body") or email.get("snippet") or "").lower()
        labels = [l.lower() for l in (email.get("labels") or [])]

        spam_score = 0.0
        spam_indicators = []

        # Check Gmail SPAM label (highest confidence)
        if "spam" in labels or "category_spam" in labels:
            return {"category": "spam", "confidence": 0.95, "reasoning": "Gmail marked as spam"}

        # 1. Check sender patterns
        if re.search(r"[a-z0-9]{8,}@", from_field):  # Random character strings
            spam_score += 0.3
            spam_indicators.append("suspicious_sender_pattern")

        # Check for typosquatting (simple pattern matching)
        suspicious_domains = ["amaz0n", "paypa1", "micr0soft", "app1e", "g00gle", "faceb00k"]
        if any(domain in from_field for domain in suspicious_domains):
            spam_score += 0.4
            spam_indicators.append("typosquatting_domain")

        # 2. Check subject patterns
        if subject.isupper() and len(subject) > 10:  # ALL CAPS
            spam_score += 0.2
            spam_indicators.append("all_caps_subject")

        if subject.count("!") > 2 or subject.count("$") > 1:  # Excessive punctuation
            spam_score += 0.15
            spam_indicators.append("excessive_punctuation")

        spam_keywords_subject = [
            "you've won",
            "congratulations",
            "claim prize",
            "verify account",
            "account suspended",
            "urgent action",
            "click here immediately",
            "limited time offer",
        ]
        if any(kw in subject for kw in spam_keywords_subject):
            spam_score += 0.3
            spam_indicators.append("spam_keywords_in_subject")

        # 3. Check content patterns for phishing
        phishing_patterns = [
            "click here to verify",
            "account will be suspended",
            "confirm payment",
            "verify your password",
            "enter your ssn",
            "credit card information",
            "social security number",
        ]
        if any(pattern in body for pattern in phishing_patterns):
            spam_score += 0.5
            spam_indicators.append("phishing_indicators")

        # Check for suspicious URLs
        url_pattern = r"https?://(?:bit\.ly|tinyurl\.com|t\.co|goo\.gl|short\.link|tiny\.cc)"
        if re.search(url_pattern, body):
            spam_score += 0.2
            spam_indicators.append("suspicious_shortened_urls")

        # Check for multiple spam keywords in content
        spam_keywords_content = [
            "free",
            "win",
            "prize",
            "congratulations",
            "act now",
            "click here",
            "limited time",
            "make money",
            "work from home",
            "get rich quick",
        ]
        keyword_count = sum(1 for kw in spam_keywords_content if kw in body)
        if keyword_count >= 3:
            spam_score += 0.3
            spam_indicators.append("multiple_spam_keywords")

        # 4. Check for unsubscribe links (legitimate marketing usually has this)
        # But if no unsubscribe and has spam indicators, more likely spam
        if "unsubscribe" not in body and spam_score > 0.3:
            spam_score += 0.1
            spam_indicators.append("no_unsubscribe_link")

        # Determine if spam based on score
        if spam_score >= 0.7:
            return {
                "category": "spam",
                "confidence": min(spam_score, 0.95),
                "reasoning": f"Multiple spam indicators: {', '.join(spam_indicators)}",
            }
        elif spam_score >= 0.5:
            return {
                "category": "spam",
                "confidence": spam_score,
                "reasoning": f"Some spam indicators: {', '.join(spam_indicators)}",
            }

        return None  # Not clearly spam, continue with other classification

    def _rule_based_classification(self, email: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Fast rule-based classification before using AI."""
        # Check spam FIRST (safety priority)
        spam_result = self._detect_spam(email)
        if spam_result:
            return spam_result

        from_field = email.get("from", "").lower()
        subject = (email.get("subject") or "").lower()
        body = (email.get("body") or email.get("snippet") or "").lower()
        labels = [l.lower() for l in (email.get("labels") or [])]

        # Check Gmail categories
        if "category_promotions" in labels:
            return {"category": "promotion", "confidence": 0.9}
        if "category_social" in labels:
            return {"category": "social", "confidence": 0.9}
        if "category_updates" in labels:
            return {"category": "notification", "confidence": 0.85}

        # Check for unsubscribe links (promotion/marketing)
        if "unsubscribe" in body or "unsubscribe" in subject:
            return {"category": "promotion", "confidence": 0.8}

        # Check sender domain patterns
        work_domains = ["@company.com", "@corp.", "@work.", "@business"]
        if any(domain in from_field for domain in work_domains):
            return {"category": "work", "confidence": 0.85}

        # Check for financial institutions
        financial_keywords = ["bank", "payment", "transaction", "invoice", "receipt"]
        if any(kw in subject or kw in body for kw in financial_keywords):
            return {"category": "finance", "confidence": 0.75}

        # Check for notification patterns
        notification_keywords = ["notification", "alert", "reminder", "confirmation"]
        if any(kw in subject for kw in notification_keywords):
            return {"category": "notification", "confidence": 0.7}

        return None  # No rule-based match, use AI

    async def classify_email(self, email_data: Dict[str, Any]) -> Dict[str, Any]:
        """Classify a single email."""
        # Try rule-based first
        rule_result = self._rule_based_classification(email_data)
        if rule_result:
            logger.debug(
                f"Rule-based classification: {rule_result['category']} "
                f"(confidence: {rule_result['confidence']})"
            )
            return rule_result

        # Use AI for classification
        prompt = ChatPromptTemplate.from_messages(
            [
                (
                    "system",
                    """You are an email classification expert. Analyze the email and classify it into one of these categories:
- work: Professional/work-related emails
- personal: Personal communications from friends/family
- promotion: Marketing emails with sales/discounts
- marketing: Marketing newsletters and campaigns
- newsletter: Subscribed newsletters and updates
- notification: System notifications and alerts
- social: Social media notifications
- finance: Financial and banking communications
- spam: Unsolicited or suspicious emails
- other: Uncategorized emails

Return JSON with category, confidence (0.0-1.0), and brief reasoning.""",
                ),
                (
                    "human",
                    """Classify this email:

From: {from_field}
Subject: {subject}
Body: {body}

Return JSON: {{"category": "category_name", "confidence": 0.0-1.0, "reasoning": "brief explanation"}}""",
                ),
            ]
        )

        from_field = email_data.get("from", "Unknown")
        subject = email_data.get("subject", "No subject")
        body = (email_data.get("body") or email_data.get("snippet") or "")[:1000]  # Limit length

        try:
            chain = prompt | self.llm
            response = await chain.ainvoke(
                {
                    "from_field": from_field,
                    "subject": subject,
                    "body": body,
                }
            )

            # Parse response
            response_text = response.content if hasattr(response, "content") else str(response)
            # Extract JSON from response
            json_match = re.search(r"\{.*\}", response_text, re.DOTALL)
            if json_match:
                result = json.loads(json_match.group(0))
                category = result.get("category", "other")
                confidence = float(result.get("confidence", 0.5))
                classification = {
                    "category": category if category in CATEGORIES else "other",
                    "confidence": confidence,
                    "reasoning": result.get("reasoning"),
                }
                logger.debug(
                    f"AI classification: {classification['category']} "
                    f"(confidence: {classification['confidence']})"
                )
                return classification
        except Exception as e:
            logger.warning(f"Failed to parse classification response: {e}")

        # Fallback
        logger.warning("Classification failed, using fallback")
        return {"category": "other", "confidence": 0.3, "reasoning": "Classification failed"}

    async def classify_emails_batch(self, emails: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Classify multiple emails efficiently."""
        results = []
        for email in emails:
            classification = await self.classify_email(email)
            email["category"] = classification["category"]
            email["categoryConfidence"] = classification["confidence"]
            results.append(email)
        return results

