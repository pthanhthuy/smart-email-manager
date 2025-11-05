# Email Classification Story

## 📋 Problem Statement

Currently, the Smart Email Manager lacks a comprehensive email classification system. Users cannot easily categorize or filter emails by type (promotion, marketing, work, personal, newsletters, etc.). This makes it difficult to:
- Quickly identify and filter important work emails
- Separate promotional emails from personal communications
- Organize emails by category for better inbox management
- Apply category-specific actions (e.g., auto-archive promotions)

The system currently only has:
- Basic "important" flag detection (urgent keywords)
- Gmail label support (but no automatic categorization)
- Email type analysis for AI responses (meeting_invitation, question, request, etc.) but not for broader categorization

## 🎯 Goal

Implement an intelligent email classification system that:
1. Automatically categorizes emails into predefined categories using AI
2. Stores category information in email metadata
3. Enables filtering and searching by category
4. Displays category badges/indicators in the UI
5. Integrates seamlessly with existing vector store and search functionality
6. Allows users to override classifications manually

## 📊 Email Categories

### Primary Categories

1. **Work** - Professional emails from colleagues, clients, work-related services
   - Indicators: Work email domains, business subjects, professional tone
   - Examples: Meeting invitations, project updates, client communications

2. **Personal** - Personal communications from friends, family, personal contacts
   - Indicators: Personal email addresses, casual tone, personal topics
   - Examples: Family updates, friend messages, personal invitations

3. **Promotion** - Marketing and promotional emails
   - Indicators: Sales language, discounts, special offers, unsubscribe links
   - Examples: Store sales, discount codes, limited-time offers

4. **Marketing** - Marketing newsletters and campaigns (non-promotional)
   - Indicators: Newsletter format, company updates, marketing content
   - Examples: Company newsletters, product updates, brand communications

5. **Newsletter** - Subscribed newsletters and updates
   - Indicators: Newsletter format, subscription confirmation, regular updates
   - Examples: Tech newsletters, news digests, subscription-based content

6. **Notification** - System notifications and alerts
   - Indicators: Automated messages, system alerts, account updates
   - Examples: Login alerts, password resets, order confirmations, shipping updates

7. **Social** - Social media notifications and updates
   - Indicators: Social platform domains, friend requests, activity notifications
   - Examples: LinkedIn updates, Facebook notifications, Twitter mentions

8. **Finance** - Financial and banking communications
   - Indicators: Bank domains, financial institutions, transaction alerts
   - Examples: Bank statements, payment confirmations, investment updates

9. **Spam** - Unsolicited or suspicious emails
   - Indicators: Suspicious patterns, unknown senders, spam indicators
   - Examples: Phishing attempts, unwanted solicitations
   - **Detailed Spam Detection Methodology** (see Spam Detection section below)

10. **Other** - Uncategorized emails that don't fit above categories

### Classification Confidence Levels

- **High** (0.8-1.0): Very confident classification
- **Medium** (0.5-0.79): Moderate confidence
- **Low** (<0.5): Low confidence, may need manual review

### 🚨 Spam Detection - Detailed Methodology

Spam detection is critical for user safety and security. The system uses a multi-layered approach to identify spam emails:

#### Rule-Based Spam Indicators (High Priority - Checked First)

1. **Gmail Labels** (Highest Confidence)
   - If email has `SPAM` label → **spam** (confidence: 0.95)
   - If email has `CATEGORY_SPAM` label → **spam** (confidence: 0.95)

2. **Suspicious Sender Patterns**
   - **Random character strings in sender**: `a1b2c3d4@example.com`, `user12345@domain.com`
   - **Suspicious domain patterns**: 
     - Free email providers with suspicious patterns
     - Domains with random characters
     - Domains that look like legitimate ones (typosquatting): `amaz0n.com`, `paypa1.com`
   - **Missing or invalid sender information**
   - **Sender doesn't match reply-to** (potential spoofing)

3. **Suspicious Subject Patterns**
   - **ALL CAPS subjects**: "URGENT ACTION REQUIRED!!!"
   - **Excessive punctuation**: "Click here now!!!", "Free money$$$"
   - **Suspicious keywords**: 
     - "You've won!", "Congratulations!", "Claim your prize"
     - "Verify your account now", "Your account will be closed"
     - "Click here immediately", "Urgent action required"
     - "Limited time offer", "Act now or lose"
   - **Phishing subject patterns**: "Your account has been suspended", "Verify your payment"

4. **Suspicious Content Patterns**
   - **Suspicious URLs**:
     - Shortened URLs (bit.ly, tinyurl.com, etc.) - potential phishing
     - URLs that don't match sender domain
     - URLs with IP addresses instead of domains
     - Suspicious link patterns: `example.com/verify-account-now`
   - **Phishing indicators**:
     - "Click here to verify your account"
     - "Your account will be suspended in 24 hours"
     - "Confirm your payment information"
     - Requests for passwords, SSN, credit card numbers
   - **Suspicious attachments**: 
     - Executable files (.exe, .bat, .scr)
     - Unusual file types from unknown senders
   - **Spam keywords** (multiple occurrences):
     - "Free", "Win", "Prize", "Congratulations", "Limited time"
     - "Act now", "Click here", "Buy now", "Discount"
     - "Make money", "Work from home", "Get rich quick"

5. **Email Header Anomalies**
   - **Missing or suspicious headers**: No Reply-To, suspicious Return-Path
   - **Header mismatches**: From address doesn't match sender
   - **Suspicious routing**: Multiple hops through unknown servers
   - **SPF/DKIM failures** (if available from Gmail API)

6. **Content Analysis**
   - **HTML-only emails** with no plain text version (common spam technique)
   - **Excessive use of images** with little text (image spam)
   - **Unusual character encoding** or encoding issues
   - **Links that don't match displayed text** (common phishing technique)

#### AI-Based Spam Detection (When Rule-Based is Uncertain)

When rule-based checks don't clearly identify spam, AI analysis is used:

1. **Content Analysis**
   - Detects phishing attempts and scam language
   - Identifies suspicious requests (asking for sensitive information)
   - Recognizes common spam patterns and tactics

2. **Sender Reputation Analysis**
   - Analyzes sender email/domain patterns
   - Checks if sender is known or unknown
   - Evaluates sender credibility based on content

3. **Language and Tone Analysis**
   - Detects overly promotional or suspicious language
   - Identifies urgency scams ("act now or lose")
   - Recognizes phishing language patterns

#### Spam Confidence Scoring

- **High Confidence Spam (0.8-1.0)**: 
  - Gmail SPAM label present
  - Multiple strong spam indicators
  - Clear phishing attempts
  - **Action**: Flag as spam, separate from other emails, show warning

- **Medium Confidence Spam (0.5-0.79)**:
  - Some spam indicators present
  - Suspicious patterns but not definitive
  - **Action**: Flag as potentially spam, show warning, allow user review

- **Low Confidence (<0.5)**:
  - Few or weak spam indicators
  - May be legitimate but unusual
  - **Action**: Classify as "other" or original category, no special handling

#### Spam Handling Strategy

**Safety First Approach:**
1. **Never auto-delete spam** - Always allow user review
2. **Visual warnings** - Clearly mark spam emails with warning indicators
3. **Separate display** - Option to show spam in separate section
4. **User control** - Allow users to mark as "not spam" to improve detection
5. **Report functionality** - Easy way to report false positives/negatives

**UI Indicators:**
- 🚫 Red warning badge for high-confidence spam
- ⚠️ Yellow warning badge for medium-confidence spam
- Separate "Spam" filter option
- Warning message when opening spam emails
- Option to "Report as spam" or "Not spam"

#### Phishing Detection (Special Case)

Phishing emails are a subset of spam but require special attention:

**Phishing Indicators:**
- Requests for sensitive information (passwords, SSN, credit cards)
- Impersonation of legitimate companies
- Urgency tactics ("Your account will be closed")
- Suspicious links that don't match displayed URLs
- Suspicious sender domains (typosquatting)
- Missing or mismatched email headers

**Phishing Handling:**
- **Highest priority flagging** - Mark as phishing immediately
- **Extra warnings** - Show prominent security warnings
- **Link checking** - Warn before clicking any links
- **Block auto-loading** - Don't auto-load images/remote content in spam/phishing emails

#### Implementation Example

```python
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
    if re.search(r'[a-z0-9]{8,}@', from_field):  # Random character strings
        spam_score += 0.3
        spam_indicators.append("suspicious_sender_pattern")
    
    # Check for typosquatting (simple pattern matching)
    suspicious_domains = ["amaz0n", "paypa1", "micr0soft", "app1e"]
    if any(domain in from_field for domain in suspicious_domains):
        spam_score += 0.4
        spam_indicators.append("typosquatting_domain")
    
    # 2. Check subject patterns
    if subject.isupper() and len(subject) > 10:  # ALL CAPS
        spam_score += 0.2
        spam_indicators.append("all_caps_subject")
    
    if subject.count('!') > 2 or subject.count('$') > 1:  # Excessive punctuation
        spam_score += 0.15
        spam_indicators.append("excessive_punctuation")
    
    spam_keywords_subject = ["you've won", "congratulations", "claim prize", 
                           "verify account", "account suspended", "urgent action"]
    if any(kw in subject for kw in spam_keywords_subject):
        spam_score += 0.3
        spam_indicators.append("spam_keywords_in_subject")
    
    # 3. Check content patterns
    phishing_patterns = ["click here to verify", "account will be suspended",
                       "confirm payment", "verify your password"]
    if any(pattern in body for pattern in phishing_patterns):
        spam_score += 0.5
        spam_indicators.append("phishing_indicators")
    
    # Check for suspicious URLs
    url_pattern = r'https?://(?:bit\.ly|tinyurl\.com|t\.co|goo\.gl|short\.link)'
    if re.search(url_pattern, body):
        spam_score += 0.2
        spam_indicators.append("suspicious_shortened_urls")
    
    # Check for multiple spam keywords in content
    spam_keywords_content = ["free", "win", "prize", "congratulations", 
                           "act now", "click here", "limited time"]
    keyword_count = sum(1 for kw in spam_keywords_content if kw in body)
    if keyword_count >= 3:
        spam_score += 0.3
        spam_indicators.append("multiple_spam_keywords")
    
    # 4. Check for unsubscribe links (legitimate marketing, not spam)
    # But if no unsubscribe and has spam indicators, more likely spam
    if "unsubscribe" not in body and spam_score > 0.3:
        spam_score += 0.1
    
    # Determine if spam based on score
    if spam_score >= 0.7:
        return {
            "category": "spam",
            "confidence": min(spam_score, 0.95),
            "reasoning": f"Multiple spam indicators detected: {', '.join(spam_indicators)}"
        }
    elif spam_score >= 0.5:
        return {
            "category": "spam",
            "confidence": spam_score,
            "reasoning": f"Some spam indicators detected: {', '.join(spam_indicators)}"
        }
    
    return None  # Not clearly spam, continue with other classification
```

## 🔍 Current Implementation Analysis

### Existing Features

1. **Email Parsing** (`python-server/app/services/emails.py`)
   - ✅ Parses email headers, body, labels
   - ✅ Has `is_important()` function for urgent detection
   - ✅ Extracts email metadata

2. **AI Services** (`python-server/app/services/ai_responses.py`)
   - ✅ Uses OpenAI/LangChain for email analysis
   - ✅ Already classifies emails for response generation (emailType: meeting_invitation, question, request, etc.)
   - ✅ Has structured output parsing

3. **Vector Store** (`python-server/app/services/vector_store.py`)
   - ✅ Stores email embeddings with metadata
   - ✅ Metadata includes: subject, from, to, date, labels, important flag
   - ❌ Does not include category information

4. **Gmail API** (`python-server/app/api/routes/gmail.py`)
   - ✅ Fetches emails with Gmail labels
   - ✅ Gmail API has category filtering (`-category:promotions -category:social`)

### Missing Components

1. ❌ No email classification service
2. ❌ No category field in email models
3. ❌ No category filtering in search
4. ❌ No category display in UI
5. ❌ No classification endpoint

## 🛠️ Solution Design

### Architecture Overview

```
┌─────────────────┐
│  Email Sync     │
│  /sync          │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Email Parser   │
│  parse_email()  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────────┐
│  Classification  │◄─────│  AI Service      │
│  Service         │      │  (OpenAI/LangChain)│
│  classify_email()│      └──────────────────┘
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Vector Store    │
│  (with category) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Search/Filter   │
│  by category     │
└─────────────────┘
```

### Implementation Components

#### 1. Classification Service

**File**: `python-server/app/services/email_classification.py`

**Purpose**: Core service for classifying emails using AI

**Key Methods**:
- `classify_email(email_data: Dict) -> Dict`: Classify single email
- `classify_emails_batch(emails: List[Dict]) -> List[Dict]`: Batch classification
- `get_category_from_gmail_labels(labels: List[str]) -> Optional[str]`: Use Gmail categories if available

**Classification Strategy**:
1. **Rule-based checks first** (fast, no API cost):
   - Check Gmail labels/categories
   - Check sender domain patterns
   - Check subject keywords
   - Check unsubscribe links

2. **AI-based classification** (for unclear cases):
   - Use OpenAI to analyze email content
   - Structured output with category and confidence
   - Fallback to "Other" if confidence too low

#### 2. Data Models

**File**: `python-server/app/models/emails.py`

**Add to EmailData**:
```python
category: Optional[str] = None  # work, personal, promotion, etc.
categoryConfidence: Optional[float] = None  # 0.0-1.0
```

**New Model**:
```python
class EmailClassificationRequest(BaseModel):
    emailId: Optional[str] = None
    emailData: Optional[Dict[str, Any]] = None

class EmailClassificationResponse(BaseModel):
    category: str
    confidence: float
    reasoning: Optional[str] = None
```

#### 3. API Endpoints

**File**: `python-server/app/api/routes/classification.py`

**Endpoints**:
- `POST /classify-email` - Classify single email
- `POST /classify-emails` - Batch classify multiple emails
- `GET /categories` - List available categories
- `POST /search?category=work` - Search emails filtered by category

#### 4. Vector Store Integration

**File**: `python-server/app/services/vector_store.py`

**Update**:
- Add `category` to metadata when storing emails
- Add `categoryConfidence` to metadata
- Enable filtering by category in search

#### 5. Email Sync Integration

**File**: `python-server/app/api/routes/search.py`

**Update sync_emails**:
- Automatically classify emails during sync
- Store category in vector store metadata
- Option to skip classification for faster sync

#### 6. Frontend Updates

**Files**: `web-app/app.js`, `web-app/index.html`, `web-app/style.css`

**Features**:
- Display category badges on email items
- Category filter dropdown in search
- Category statistics in stats panel
- Visual indicators (icons, colors) for each category

## 📝 Implementation Steps

### Step 1: Create Classification Service

**File**: `python-server/app/services/email_classification.py`

**Implementation**:
```python
from typing import Dict, List, Optional, Any
from app.core.config import Settings, get_settings
from app.core.logging import get_logger
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
import json
import re

logger = get_logger(__name__)

CATEGORIES = [
    "work", "personal", "promotion", "marketing", 
    "newsletter", "notification", "social", "finance", 
    "spam", "other"
]

class EmailClassificationService:
    def __init__(self, settings: Settings | None = None):
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
        if re.search(r'[a-z0-9]{8,}@', from_field):  # Random character strings
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
        
        if subject.count('!') > 2 or subject.count('$') > 1:  # Excessive punctuation
            spam_score += 0.15
            spam_indicators.append("excessive_punctuation")
        
        spam_keywords_subject = ["you've won", "congratulations", "claim prize", 
                               "verify account", "account suspended", "urgent action",
                               "click here immediately", "limited time offer"]
        if any(kw in subject for kw in spam_keywords_subject):
            spam_score += 0.3
            spam_indicators.append("spam_keywords_in_subject")
        
        # 3. Check content patterns for phishing
        phishing_patterns = ["click here to verify", "account will be suspended",
                           "confirm payment", "verify your password", "enter your ssn",
                           "credit card information", "social security number"]
        if any(pattern in body for pattern in phishing_patterns):
            spam_score += 0.5
            spam_indicators.append("phishing_indicators")
        
        # Check for suspicious URLs
        url_pattern = r'https?://(?:bit\.ly|tinyurl\.com|t\.co|goo\.gl|short\.link|tiny\.cc)'
        if re.search(url_pattern, body):
            spam_score += 0.2
            spam_indicators.append("suspicious_shortened_urls")
        
        # Check for multiple spam keywords in content
        spam_keywords_content = ["free", "win", "prize", "congratulations", 
                               "act now", "click here", "limited time", "make money",
                               "work from home", "get rich quick"]
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
                "reasoning": f"Multiple spam indicators: {', '.join(spam_indicators)}"
            }
        elif spam_score >= 0.5:
            return {
                "category": "spam",
                "confidence": spam_score,
                "reasoning": f"Some spam indicators: {', '.join(spam_indicators)}"
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
        if "CATEGORY_PROMOTIONS" in labels:
            return {"category": "promotion", "confidence": 0.9}
        if "CATEGORY_SOCIAL" in labels:
            return {"category": "social", "confidence": 0.9}
        if "CATEGORY_UPDATES" in labels:
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
            return rule_result
        
        # Use AI for classification
        prompt = ChatPromptTemplate.from_messages([
            ("system", """You are an email classification expert. Analyze the email and classify it into one of these categories:
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

Return JSON with category, confidence (0.0-1.0), and brief reasoning."""),
            ("human", """Classify this email:

From: {from_field}
Subject: {subject}
Body: {body}

Return JSON: {{"category": "category_name", "confidence": 0.0-1.0, "reasoning": "brief explanation"}}""")
        ])
        
        from_field = email_data.get("from", "Unknown")
        subject = email_data.get("subject", "No subject")
        body = (email_data.get("body") or email_data.get("snippet") or "")[:1000]  # Limit length
        
        chain = prompt | self.llm
        response = await chain.ainvoke({
            "from_field": from_field,
            "subject": subject,
            "body": body
        })
        
        # Parse response
        try:
            response_text = response.content if hasattr(response, 'content') else str(response)
            # Extract JSON from response
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if json_match:
                result = json.loads(json_match.group(0))
                category = result.get("category", "other")
                confidence = float(result.get("confidence", 0.5))
                return {
                    "category": category if category in CATEGORIES else "other",
                    "confidence": confidence,
                    "reasoning": result.get("reasoning")
                }
        except Exception as e:
            logger.warning(f"Failed to parse classification response: {e}")
        
        # Fallback
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
```

### Step 2: Update Email Models

**File**: `python-server/app/models/emails.py`

**Add to EmailData**:
```python
category: Optional[str] = Field(None, description="Email category: work, personal, promotion, etc.")
categoryConfidence: Optional[float] = Field(None, description="Classification confidence 0.0-1.0")
```

**Add new models**:
```python
class EmailClassificationRequest(BaseModel):
    emailId: Optional[str] = None
    emailData: Optional[Dict[str, Any]] = None

class EmailClassificationResponse(BaseModel):
    category: str
    confidence: float
    reasoning: Optional[str] = None
    emailId: Optional[str] = None
```

### Step 3: Create Classification API Routes

**File**: `python-server/app/api/routes/classification.py`

**Implementation**:
```python
from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from app.api.deps import get_settings_dep
from app.core.config import Settings
from app.core.logging import get_logger
from app.models import EmailClassificationRequest, EmailClassificationResponse
from app.services.email_classification import EmailClassificationService
from app.services.gmail import get_gmail_service
from app.services import emails as email_utils

router = APIRouter(prefix="", tags=["classification"])
logger = get_logger(__name__)

CATEGORIES = [
    "work", "personal", "promotion", "marketing", 
    "newsletter", "notification", "social", "finance", 
    "spam", "other"
]

@router.get("/categories")
async def get_categories() -> dict:
    """Get list of available email categories."""
    return {
        "success": True,
        "categories": CATEGORIES,
        "descriptions": {
            "work": "Professional/work-related emails",
            "personal": "Personal communications",
            "promotion": "Marketing emails with sales/discounts",
            "marketing": "Marketing newsletters and campaigns",
            "newsletter": "Subscribed newsletters",
            "notification": "System notifications and alerts",
            "social": "Social media notifications",
            "finance": "Financial and banking communications",
            "spam": "Unsolicited or suspicious emails",
            "other": "Uncategorized emails"
        }
    }

@router.post("/classify-email")
async def classify_email(
    payload: EmailClassificationRequest,
    settings: Settings = Depends(get_settings_dep)
) -> dict:
    """Classify a single email."""
    classification_service = EmailClassificationService(settings)
    
    try:
        email_data = payload.emailData
        if not email_data and payload.emailId:
            # Fetch email from Gmail
            gmail = get_gmail_service(settings)
            message = gmail.users().messages().get(
                userId="me", 
                id=payload.emailId, 
                format="full"
            ).execute()
            email_data = email_utils.parse_email(message)
        
        if not email_data:
            return JSONResponse(
                status_code=400,
                content={"success": False, "error": "emailId or emailData required"}
            )
        
        classification = await classification_service.classify_email(email_data)
        
        return {
            "success": True,
            "classification": {
                "category": classification["category"],
                "confidence": classification["confidence"],
                "reasoning": classification.get("reasoning"),
                "emailId": email_data.get("id")
            }
        }
    except Exception as exc:
        logger.error("Classification error: %s", exc)
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(exc)}
        )

@router.post("/classify-emails")
async def classify_emails_batch(
    emails: List[dict],
    settings: Settings = Depends(get_settings_dep)
) -> dict:
    """Classify multiple emails."""
    classification_service = EmailClassificationService(settings)
    
    try:
        classified = await classification_service.classify_emails_batch(emails)
        return {
            "success": True,
            "count": len(classified),
            "emails": classified
        }
    except Exception as exc:
        logger.error("Batch classification error: %s", exc)
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(exc)}
        )
```

### Step 4: Update Vector Store

**File**: `python-server/app/services/vector_store.py`

**Update add_emails method**:
```python
metadatas = [
    {
        "subject": email.get("subject") or "No subject",
        "from": email.get("from") or "Unknown",
        "to": email.get("to") or "",
        "date": email.get("date") or "",
        "threadId": email.get("threadId") or "",
        "snippet": email.get("snippet") or "",
        "labels": ",".join(email.get("labels") or []),
        "important": "true" if email.get("important") else "false",
        "category": email.get("category") or "other",  # NEW
        "categoryConfidence": str(email.get("categoryConfidence") or 0.0),  # NEW
    }
    for email in emails
]
```

**Update search to support category filtering**:
```python
def search(
    self, 
    query_embedding: List[float], 
    limit: int = 10,
    category: Optional[str] = None  # NEW
) -> List[dict]:
    collection = self.get_collection()
    
    where_clause = {}
    if category:
        where_clause["category"] = category
    
    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=limit,
        where=where_clause if where_clause else None  # NEW
    )
    # ... rest of method
```

### Step 5: Update Email Sync

**File**: `python-server/app/api/routes/search.py`

**Update sync_emails endpoint**:
```python
# Add classification step
from app.services.email_classification import EmailClassificationService

classification_service = EmailClassificationService(settings)

# After parsing emails, classify them
for email in emails:
    if not email.get("category"):  # Only classify if not already classified
        classification = await classification_service.classify_email(email)
        email["category"] = classification["category"]
        email["categoryConfidence"] = classification["confidence"]
```

### Step 6: Update Search Endpoint

**File**: `python-server/app/api/routes/search.py`

**Add category filter to semantic_search**:
```python
@router.post("/search")
async def semantic_search(
    payload: EmailSearchRequest,
    category: Optional[str] = Query(None, description="Filter by category"),
    embeddings: EmbeddingService = Depends(get_embedding_service),
    vector_store: VectorStore = Depends(get_vector_store),
) -> dict:
    # ... existing code ...
    
    results = vector_store.search(
        query_embedding=query_embedding,
        limit=payload.limit,
        category=category  # NEW
    )
    # ... rest of method
```

### Step 7: Frontend Updates - Comprehensive UI Implementation

This step implements the complete UI for email classification, including category badges, filtering, statistics, and spam warnings.

#### 7.1: Update HTML Structure

**File**: `web-app/index.html`

**Add category filter dropdown to search section**:
```html
<div class="search-section">
    <h3>🔍 Semantic Search</h3>
    <div class="search-controls">
        <div class="search-box">
            <input type="text" id="searchInput" class="search-input" placeholder="Search emails by meaning... (e.g., 'budget meetings', 'urgent requests')">
            <button id="searchBtn" class="search-btn">🔎</button>
        </div>
        <div class="category-filter-container">
            <label for="categoryFilter" class="filter-label">📂 Filter by Category:</label>
            <select id="categoryFilter" class="category-filter">
                <option value="">All Categories</option>
                <option value="work">💼 Work</option>
                <option value="personal">👤 Personal</option>
                <option value="promotion">🛍️ Promotion</option>
                <option value="marketing">📢 Marketing</option>
                <option value="newsletter">📰 Newsletter</option>
                <option value="notification">🔔 Notification</option>
                <option value="social">👥 Social</option>
                <option value="finance">💰 Finance</option>
                <option value="spam">🚫 Spam</option>
                <option value="other">📧 Other</option>
            </select>
        </div>
    </div>
</div>
```

**Add category statistics panel** (in stats section):
```html
<div class="stats-panel">
    <h4 style="margin-bottom: 15px; color: #1e293b;">📊 Your Stats</h4>
    <!-- Existing stats -->
    
    <!-- NEW: Category Statistics -->
    <div class="category-stats-section" id="categoryStatsSection" style="display: none;">
        <h5 style="margin-top: 20px; margin-bottom: 10px; color: #1e293b; font-size: 0.95rem;">📊 Email Categories</h5>
        <div id="categoryStats" class="category-stats-grid">
            <!-- Category stats will be populated dynamically -->
        </div>
    </div>
</div>
```

#### 7.2: Update JavaScript - Category Display

**File**: `web-app/app.js`

**Update `createEmailItem` method** to include category badges with confidence indicators and spam warnings:
```javascript
createEmailItem(email) {
    try {
        const date = new Date(email.date).toLocaleDateString();
        const preview = (email.snippet || email.content || '').substring(0, 150) + ((email.snippet || email.content || '').length > 150 ? '...' : '');
        
        // Category classification
    const category = email.category || 'other';
        const confidence = email.categoryConfidence || 0.5;
    const categoryEmoji = {
        'work': '💼',
        'personal': '👤',
        'promotion': '🛍️',
        'marketing': '📢',
        'newsletter': '📰',
        'notification': '🔔',
        'social': '👥',
        'finance': '💰',
        'spam': '🚫',
        'other': '📧'
    };
        
        // Confidence indicator
        let confidenceBadge = '';
        if (confidence < 0.5) {
            confidenceBadge = '<span class="confidence-low" title="Low confidence classification">⚠️</span>';
        } else if (confidence < 0.8) {
            confidenceBadge = '<span class="confidence-medium" title="Medium confidence classification">ℹ️</span>';
        }
        
        // Spam warning for spam emails
        const spamWarning = category === 'spam' && confidence >= 0.7 
            ? '<div class="spam-warning-banner">⚠️ This email has been flagged as spam</div>' 
            : '';
        
        // Category badge with hover tooltip
        const categoryDisplay = `
            <span class="category-badge category-${category}" 
                  title="Category: ${category} (Confidence: ${(confidence * 100).toFixed(0)}%)">
                ${categoryEmoji[category]} ${category.charAt(0).toUpperCase() + category.slice(1)}
                ${confidenceBadge}
            </span>
        `;
    
    return `
            <div class="email-item ${category === 'spam' ? 'email-spam' : ''}" data-email-id="${email.id}" data-category="${category}">
                ${spamWarning}
            <div class="email-header">
                <div class="email-from">${email.from || 'Unknown'}</div>
                    <div class="email-header-right">
                        ${categoryDisplay}
                <div class="email-date">${date}</div>
            </div>
                </div>
                <div class="email-subject">${email.subject || 'No Subject'}</div>
                <div class="email-preview">${preview}</div>
                <div class="email-actions">
                    <button class="action-btn btn-primary generate-response-btn" data-email-id="${email.id}">
                        🤖 Generate Response
                    </button>
                    <button class="action-btn btn-info summarize-btn" data-email-id="${email.id}">
                        📝 Summarize
                    </button>
                    <button class="action-btn btn-secondary" onclick="viewFullEmail('${email.id}')">
                        📖 View Full
                    </button>
                    ${category === 'spam' ? '' : `
                        <button class="action-btn btn-secondary change-category-btn" data-email-id="${email.id}" title="Change category">
                            🏷️ Change Category
                        </button>
                    `}
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error creating email item:', error);
        return `
            <div class="email-item">
                <div class="email-header">
                    <div class="email-from">Error displaying email</div>
                    <div class="email-date">Error</div>
                </div>
                <div class="email-subject">Error: ${error.message}</div>
                <div class="email-preview">Failed to display email content</div>
        </div>
    `;
    }
}
```

**Update `performSearch` method** to include category filtering:
```javascript
async performSearch() {
    const query = document.getElementById('searchInput').value.trim();
    const categoryFilter = document.getElementById('categoryFilter').value;
    
    if (!query && !categoryFilter) {
        this.showMessage('Please enter a search term or select a category filter', 'error');
        return;
    }

    this.showLoading(true, categoryFilter ? `Searching ${categoryFilter} emails...` : 'Searching emails...');
    this.hideEmptyState();
    this.hideAIResponsePanel();

    try {
        // Build query parameters
        const params = new URLSearchParams();
        if (query) {
            params.append('query', query);
        }
        if (categoryFilter) {
            params.append('category', categoryFilter);
        }
        
        const response = await fetch(`${this.apiBaseUrl}/search?${params.toString()}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query: query || undefined })
        });

        if (!response.ok) {
            throw new Error(`Search failed: ${response.statusText}`);
        }

        const data = await response.json();
        this.displaySearchResults(data.results || []);
        
        // Update category statistics
        this.updateCategoryStatistics(data.results || []);
        
    } catch (error) {
        console.error('Search error:', error);
        let errorMessage = 'Search failed: ';
        if (error.message.includes('Failed to fetch')) {
            errorMessage += 'Cannot connect to server. Please make sure the server is running on port 3000.';
        } else {
            errorMessage += error.message;
        }
        this.showMessage(errorMessage, 'error');
        this.showEmptyState();
    } finally {
        this.showLoading(false);
    }
}
```

**Add new methods for category management**:
```javascript
// Update category statistics display
updateCategoryStatistics(emails) {
    if (!emails || emails.length === 0) {
        document.getElementById('categoryStatsSection').style.display = 'none';
        return;
    }
    
    // Count emails by category
    const categoryCounts = {};
    emails.forEach(email => {
        const category = email.category || 'other';
        categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    });
    
    // Display statistics
    const statsContainer = document.getElementById('categoryStats');
    const statsHTML = Object.entries(categoryCounts)
        .sort((a, b) => b[1] - a[1]) // Sort by count
        .map(([category, count]) => {
            const percentage = ((count / emails.length) * 100).toFixed(1);
            const categoryEmoji = {
                'work': '💼', 'personal': '👤', 'promotion': '🛍️',
                'marketing': '📢', 'newsletter': '📰', 'notification': '🔔',
                'social': '👥', 'finance': '💰', 'spam': '🚫', 'other': '📧'
            };
            return `
                <div class="category-stat-item" data-category="${category}">
                    <span class="category-stat-emoji">${categoryEmoji[category] || '📧'}</span>
                    <span class="category-stat-label">${category}</span>
                    <span class="category-stat-count">${count}</span>
                    <span class="category-stat-percentage">${percentage}%</span>
                </div>
            `;
        }).join('');
    
    statsContainer.innerHTML = statsHTML;
    document.getElementById('categoryStatsSection').style.display = 'block';
    
    // Add click handlers to filter by category
    document.querySelectorAll('.category-stat-item').forEach(item => {
        item.addEventListener('click', () => {
            const category = item.dataset.category;
            document.getElementById('categoryFilter').value = category;
            this.performSearch();
        });
    });
}

// Handle category change (future enhancement - manual override)
async changeEmailCategory(emailId, newCategory) {
    try {
        const response = await fetch(`${this.apiBaseUrl}/classify-email`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                emailId: emailId,
                category: newCategory,
                manualOverride: true
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to update category');
        }
        
        this.showMessage('Category updated successfully!', 'success');
        // Refresh search results
        this.performSearch();
    } catch (error) {
        console.error('Category change error:', error);
        this.showMessage(`Failed to change category: ${error.message}`, 'error');
    }
}
```

**Update `setupEventListeners`** to add category filter change handler:
```javascript
setupEventListeners() {
    // ... existing event listeners ...
    
    // Category filter change handler
    const categoryFilter = document.getElementById('categoryFilter');
    if (categoryFilter) {
        categoryFilter.addEventListener('change', () => {
            // Auto-search when category filter changes (if search input has value)
            const searchInput = document.getElementById('searchInput').value.trim();
            if (searchInput || categoryFilter.value) {
                this.performSearch();
            }
        });
    }
    
    // Category change button handlers
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('change-category-btn')) {
            const emailId = e.target.dataset.emailId;
            this.showCategoryChangeDialog(emailId);
        }
    });
}

// Show category change dialog
showCategoryChangeDialog(emailId) {
    const categories = ['work', 'personal', 'promotion', 'marketing', 'newsletter', 
                       'notification', 'social', 'finance', 'other'];
    const categoryOptions = categories.map(cat => 
        `<option value="${cat}">${cat.charAt(0).toUpperCase() + cat.slice(1)}</option>`
    ).join('');
    
    const newCategory = prompt(
        `Change email category:\n\nSelect new category:`,
        ''
    );
    
    // Simple dialog - in production, use a proper modal
    const categorySelect = document.createElement('select');
    categorySelect.innerHTML = `<option value="">Select category...</option>${categoryOptions}`;
    
    // For now, use a simple prompt-based approach
    const categoryNames = categories.map(c => c.charAt(0).toUpperCase() + c.slice(1));
    const selectedIndex = prompt(
        `Select new category:\n${categories.map((c, i) => `${i + 1}. ${c}`).join('\n')}\n\nEnter number (1-${categories.length}):`
    );
    
    if (selectedIndex && parseInt(selectedIndex) >= 1 && parseInt(selectedIndex) <= categories.length) {
        const newCategory = categories[parseInt(selectedIndex) - 1];
        this.changeEmailCategory(emailId, newCategory);
    }
}
```

#### 7.3: Update CSS Styles

**File**: `web-app/style.css`

**Add comprehensive category styling**:
```css
/* Category Filter Styles */
.search-controls {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.category-filter-container {
    display: flex;
    align-items: center;
    gap: 10px;
}

.filter-label {
    font-size: 0.9rem;
    font-weight: 600;
    color: #475569;
    white-space: nowrap;
}

.category-filter {
    flex: 1;
    padding: 10px 16px;
    border: 2px solid #e2e8f0;
    border-radius: 12px;
    font-size: 0.95rem;
    background: white;
    color: #1e293b;
    cursor: pointer;
    transition: all 0.3s ease;
}

.category-filter:focus {
    outline: none;
    border-color: #4f46e5;
    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
}

.category-filter:hover {
    border-color: #cbd5e1;
}

/* Category Badge Styles */
.category-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: capitalize;
    transition: all 0.2s ease;
    cursor: help;
    white-space: nowrap;
}

.category-badge:hover {
    transform: scale(1.05);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

/* Category Colors */
.category-work { 
    background: linear-gradient(135deg, #3b82f6, #2563eb); 
    color: white; 
}

.category-personal { 
    background: linear-gradient(135deg, #10b981, #059669); 
    color: white; 
}

.category-promotion { 
    background: linear-gradient(135deg, #f59e0b, #d97706); 
    color: white; 
}

.category-marketing { 
    background: linear-gradient(135deg, #8b5cf6, #7c3aed); 
    color: white; 
}

.category-newsletter { 
    background: linear-gradient(135deg, #06b6d4, #0891b2); 
    color: white; 
}

.category-notification { 
    background: linear-gradient(135deg, #ef4444, #dc2626); 
    color: white; 
}

.category-social { 
    background: linear-gradient(135deg, #ec4899, #db2777); 
    color: white; 
}

.category-finance { 
    background: linear-gradient(135deg, #14b8a6, #0d9488); 
    color: white; 
}

.category-spam { 
    background: linear-gradient(135deg, #6b7280, #4b5563); 
    color: white; 
    border: 2px solid #dc2626;
    animation: spam-pulse 2s ease-in-out infinite;
}

.category-other { 
    background: linear-gradient(135deg, #9ca3af, #6b7280); 
    color: white; 
}

@keyframes spam-pulse {
    0%, 100% { border-color: #dc2626; }
    50% { border-color: #fca5a5; }
}

/* Confidence Indicators */
.confidence-low {
    font-size: 0.7rem;
    opacity: 0.8;
    margin-left: 2px;
}

.confidence-medium {
    font-size: 0.7rem;
    opacity: 0.8;
    margin-left: 2px;
}

/* Spam Warning Banner */
.spam-warning-banner {
    background: linear-gradient(135deg, #fee2e2, #fecaca);
    border: 2px solid #dc2626;
    border-radius: 8px;
    padding: 10px 15px;
    margin-bottom: 12px;
    color: #991b1b;
    font-weight: 600;
    font-size: 0.9rem;
    display: flex;
    align-items: center;
    gap: 8px;
    animation: warning-shake 0.5s ease-in-out;
}

@keyframes warning-shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-5px); }
    75% { transform: translateX(5px); }
}

/* Email Item Spam Styling */
.email-item.email-spam {
    border-left: 4px solid #dc2626;
    background: #fef2f2;
}

.email-item.email-spam:hover {
    border-color: #dc2626;
    box-shadow: 0 4px 12px rgba(220, 38, 38, 0.2);
}

.email-header-right {
    display: flex;
    align-items: center;
    gap: 10px;
}

/* Category Statistics */
.category-stats-section {
    margin-top: 20px;
    padding-top: 20px;
    border-top: 1px solid #e2e8f0;
}

.category-stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 10px;
    margin-top: 10px;
}

.category-stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 12px;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
}

.category-stat-item:hover {
    border-color: #4f46e5;
    background: #f8fafc;
    transform: translateY(-2px);
    box-shadow: 0 2px 8px rgba(79, 70, 229, 0.1);
}

.category-stat-emoji {
    font-size: 1.5rem;
    margin-bottom: 4px;
}

.category-stat-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: #475569;
    text-transform: capitalize;
    margin-bottom: 4px;
}

.category-stat-count {
    font-size: 1.2rem;
    font-weight: 700;
    color: #4f46e5;
}

.category-stat-percentage {
    font-size: 0.7rem;
    color: #64748b;
    margin-top: 2px;
}

/* Change Category Button */
.change-category-btn {
    font-size: 0.85rem;
    padding: 6px 12px;
}

/* Responsive Category Filter */
@media (max-width: 768px) {
    .category-filter-container {
        flex-direction: column;
        align-items: flex-start;
    }
    
    .category-filter {
        width: 100%;
    }
    
    .category-stats-grid {
        grid-template-columns: repeat(2, 1fr);
    }
    
    .email-header-right {
        flex-direction: column;
        align-items: flex-end;
        gap: 6px;
    }
    
    .category-badge {
        font-size: 0.7rem;
        padding: 3px 8px;
    }
}
```

#### 7.4: Load Categories on Page Load

**Add to `initializeApp` method**:
```javascript
async initializeApp() {
    this.setupEventListeners();
    this.testServerConnection();
    this.loadUserStats();
    this.loadAvailableCategories(); // NEW
    this.showWelcomeMessage();
}

// Load available categories from API
async loadAvailableCategories() {
    try {
        const response = await fetch(`${this.apiBaseUrl}/categories`);
        if (response.ok) {
            const data = await response.json();
            // Categories are already in HTML, but we could update them dynamically
            console.log('Available categories:', data.categories);
        }
    } catch (error) {
        console.log('Could not load categories:', error.message);
    }
}
```

## ✅ Acceptance Criteria

- [ ] Classification service correctly identifies email categories
- [ ] Rule-based classification works for common cases (Gmail categories, unsubscribe links)
- [ ] AI-based classification handles ambiguous cases
- [ ] Categories are stored in email metadata and vector store
- [ ] Search/filter by category works correctly
- [ ] Frontend displays category badges on email items with confidence indicators
- [ ] Category filter dropdown in search UI with auto-search on change
- [ ] Category statistics dashboard displays and updates dynamically
- [ ] Spam emails show warning banners and visual indicators
- [ ] Category badges have hover tooltips showing confidence scores
- [ ] Manual category change button works (preparation for future enhancement)
- [ ] Classification happens automatically during email sync (optional)
- [ ] UI is responsive and works on mobile devices
- [ ] API endpoints return correct classification data
- [ ] Performance: Classification adds < 2 seconds per email for AI classification
- [ ] Batch classification works efficiently
- [ ] Confidence scores are accurate and useful
- [ ] Manual override capability (future enhancement)

## 🚀 Future Enhancements

### Phase 2 Features

1. **User Custom Categories**
   - Allow users to define custom categories
   - Learn from user corrections

2. **Auto-Actions Based on Category**
   - Auto-archive promotions
   - Auto-mark work emails as important
   - Category-specific notification settings

3. **Category Statistics Dashboard**
   - Show distribution of email categories
   - Category trends over time
   - Most active categories

4. **Smart Folders**
   - Auto-organize emails into category-based folders
   - Integration with Gmail labels

5. **Learning from User Behavior**
   - Improve classification based on user corrections
   - Personalize category detection

6. **Category-Based AI Responses**
   - Different response templates per category
   - Category-specific tone suggestions

## 📊 Success Metrics

- **Accuracy**: >85% correct classifications
- **Performance**: <2 seconds per email for AI classification
- **Coverage**: 100% of emails classified (even if "other")
- **User Satisfaction**: Users can effectively filter emails by category
- **Cost Efficiency**: Rule-based classification handles 60%+ of emails without AI calls

## 🔗 Related Files

- `python-server/app/services/email_classification.py` - NEW: Classification service
- `python-server/app/api/routes/classification.py` - NEW: Classification API routes
- `python-server/app/models/emails.py` - Update: Add category fields
- `python-server/app/services/vector_store.py` - Update: Add category to metadata
- `python-server/app/api/routes/search.py` - Update: Add category filtering
- `python-server/app/services/emails.py` - Update: Include category in parsing
- `web-app/app.js` - Update: Display categories, add filter
- `web-app/index.html` - Update: Add category filter UI
- `web-app/style.css` - Update: Category badge styles

## 📅 Estimated Effort

- **Classification Service**: 4-6 hours
  - Core service implementation: 2-3 hours
  - Rule-based classification: 1 hour
  - AI classification: 1-2 hours
  - Testing: 1 hour

- **API Endpoints**: 2-3 hours
  - Endpoint implementation: 1-2 hours
  - Integration testing: 1 hour

- **Vector Store Updates**: 1-2 hours
  - Metadata updates: 30 minutes
  - Search filtering: 30 minutes
  - Testing: 30 minutes

- **Frontend Updates**: 5-7 hours
  - HTML structure updates: 30 minutes
  - Category badge display in email items: 1-1.5 hours
  - Category filter dropdown and search integration: 1-1.5 hours
  - Category statistics dashboard: 1 hour
  - Spam warning indicators and styling: 1 hour
  - Manual category override UI (preparation): 30 minutes
  - Comprehensive CSS styling and animations: 1-1.5 hours
  - Testing and responsive design: 1 hour

- **Integration & Testing**: 2-3 hours
  - End-to-end testing: 1-2 hours
  - Performance optimization: 1 hour

**Total**: 14-20 hours

## 🎯 Priority

**Medium-High Priority** - This feature significantly improves email organization and user experience. It enables better inbox management and filtering capabilities that users expect from modern email tools.

---

## 📝 Notes

- Classification should be fast and efficient. Rule-based checks should handle most common cases.
- AI classification should only be used when rule-based fails or confidence is low.
- Consider caching classification results to avoid re-classifying emails.
- Allow users to manually override classifications for learning purposes.
- Integration with Gmail's built-in categories can improve accuracy for promotions and social emails.

