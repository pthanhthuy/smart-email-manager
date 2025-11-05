# Draft Email Alignment Story

## 📋 Problem Statement

When saving AI-generated responses as Gmail drafts, the draft email is created with incorrect metadata:
- **To field**: Currently hardcoded as `"recipient@example.com"` instead of using the original email's sender
- **Subject field**: Currently hardcoded as `"Re: Your Email"` instead of using the original email's subject with proper "Re:" prefix
- **Form population**: When clicking on a draft email (if viewing functionality exists), the email form fields (title/subject, to email, etc.) are not being populated correctly with the draft data

This causes user confusion and requires manual correction of recipient and subject fields before sending emails.

## 🎯 Goal

Fix the draft email creation process to:
1. Automatically extract the correct recipient from the original email (the "from" field becomes "to" in the reply)
2. Automatically generate the correct subject line (prepend "Re: " to the original subject if not already present)
3. Ensure all draft metadata is correctly stored and retrievable
4. If draft viewing/editing is implemented, ensure form fields populate correctly when clicking on a draft

## 🔍 Current Implementation Analysis

### Backend Issue (`python-server/app/api/routes/gmail.py`)

**Current Code (Line 70-99):**
```python
@router.post("/save-draft")
async def save_draft(payload: SaveDraftRequest, settings: Settings = Depends(get_settings_dep)) -> dict:
    email_id = payload.emailId
    response_text = payload.responseText
    tone = payload.tone or "professional"
    if not email_id or not response_text:
        return JSONResponse(status_code=400, content={"success": False, "error": "emailId and responseText are required"})

    try:
        # Placeholder recipient/subject; in future fetch original email metadata
        draft_result = create_gmail_draft("recipient@example.com", "Re: Your Email", response_text, settings=settings)
        # ... rest of code
```

**Problems Identified:**
1. ❌ Hardcoded recipient: `"recipient@example.com"`
2. ❌ Hardcoded subject: `"Re: Your Email"`
3. ❌ Comment indicates this was meant to be temporary: `"Placeholder recipient/subject; in future fetch original email metadata"`
4. ❌ Original email is not fetched to extract correct metadata

### Frontend Issue (`web-app/app.js`)

**Current Code (Line 554-589):**
```javascript
async saveDraft() {
    if (!this.selectedResponse || !this.selectedEmail) {
        this.showMessage('Please select a response first', 'error');
        return;
    }

    this.showLoading(true, 'Saving draft to Gmail...');

    try {
        const response = await fetch(`${this.apiBaseUrl}/save-draft`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                emailId: this.selectedEmail.id,
                responseText: this.selectedResponse.text,
                tone: this.currentTone
            })
        });
        // ... rest of code
```

**Analysis:**
- ✅ Frontend correctly sends `emailId` from `this.selectedEmail.id`
- ✅ Frontend correctly sends `responseText` from selected response
- ✅ Frontend correctly sends `tone`
- ❌ However, the backend doesn't use the email data to fetch original email metadata
- ❌ No draft viewing/editing functionality currently exists (if needed for future)

## 🛠️ Solution Design

### Backend Changes

#### 1. Fetch Original Email Metadata
- Use the provided `emailId` to fetch the full email from Gmail API
- Extract the "from" field (this becomes the "to" recipient in the reply)
- Extract the "subject" field (this becomes "Re: {subject}" in the reply)
- Extract the "threadId" to maintain email threading

#### 2. Update `save-draft` Endpoint
- Fetch original email using Gmail API service
- Parse email headers to extract `from` and `subject`
- Generate proper reply subject (add "Re: " prefix if not present)
- Pass correct metadata to `create_gmail_draft()`

#### 3. Update Response Metadata
- Return actual recipient and subject in the response
- Include threadId for email threading support

### Frontend Changes (Future Enhancement - if draft viewing is needed)

If draft viewing/editing functionality is to be implemented:
- Add endpoint to fetch draft details
- Create UI to display/load drafts
- Populate form fields when clicking on a draft:
  - Subject field → draft subject
  - To field → draft recipient
  - Body field → draft content

## 📝 Implementation Steps

### Step 1: Update Backend to Fetch Original Email

**File**: `python-server/app/api/routes/gmail.py`

**Changes Required:**
1. Import `parse_email` from `app.services.emails` (already available)
2. Use `get_gmail_service()` to fetch the original email by ID
3. Extract `from` and `subject` from parsed email
4. Generate proper reply subject
5. Pass correct values to `create_gmail_draft()`

**Implementation:**
```python
@router.post("/save-draft")
async def save_draft(payload: SaveDraftRequest, settings: Settings = Depends(get_settings_dep)) -> dict:
    email_id = payload.emailId
    response_text = payload.responseText
    tone = payload.tone or "professional"
    if not email_id or not response_text:
        return JSONResponse(status_code=400, content={"success": False, "error": "emailId and responseText are required"})

    try:
        # Fetch original email to get metadata
        gmail = get_gmail_service(settings)
        original_message = gmail.users().messages().get(userId="me", id=email_id, format="full").execute()
        parsed_email = email_utils.parse_email(original_message)
        
        # Extract recipient (from original email's "from" field)
        from_header = parsed_email.get("from", "")
        # Extract email address from "Name <email@example.com>" format
        recipient = extract_email_address(from_header)
        if not recipient:
            recipient = from_header  # Fallback to full string if parsing fails
        
        # Extract and format subject
        original_subject = parsed_email.get("subject", "No Subject")
        # Add "Re: " prefix if not already present
        reply_subject = f"Re: {original_subject}" if not original_subject.startswith("Re: ") else original_subject
        
        # Get threadId for email threading
        thread_id = parsed_email.get("threadId")
        
        # Create draft with correct metadata
        draft_result = create_gmail_draft(
            to=recipient,
            subject=reply_subject,
            body=response_text,
            thread_id=thread_id,
            settings=settings
        )
        
        return {
            "success": True,
            "message": "Draft saved to Gmail successfully!",
            "draft": {
                "id": draft_result.get("draftId"),
                "snippet": (response_text or "")[:100] + "...",
            },
            "metadata": {
                "recipient": recipient,
                "subject": reply_subject,
                "tone": tone,
                "threadId": thread_id,
            },
        }
    except Exception as exc:
        logger.error("Draft saving error: %s", exc)
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(exc), "hint": "Ensure Gmail credentials have compose permissions."},
        )
```

**Helper Function Needed:**
```python
def extract_email_address(email_string: str) -> str:
    """Extract email address from formats like 'Name <email@example.com>' or 'email@example.com'"""
    import re
    # Try to extract email from "Name <email@example.com>" format
    match = re.search(r'[\w\.-]+@[\w\.-]+\.\w+', email_string)
    if match:
        return match.group(0)
    return email_string
```

### Step 2: Add Email Address Extraction Utility

**File**: `python-server/app/services/emails.py`

**Add helper function:**
```python
def extract_email_address(email_string: str) -> str:
    """Extract email address from formats like 'Name <email@example.com>' or 'email@example.com'"""
    import re
    if not email_string:
        return ""
    # Try to extract email from "Name <email@example.com>" format
    match = re.search(r'[\w\.-]+@[\w\.-]+\.\w+', email_string)
    if match:
        return match.group(0)
    return email_string.strip()
```

### Step 3: Update Imports

**File**: `python-server/app/api/routes/gmail.py`

**Ensure imports include:**
```python
from app.services import emails as email_utils
```

### Step 4: Testing

**Test Cases:**

1. **Test 1: Basic Draft Creation**
   - Generate AI response for an email
   - Save to draft
   - Verify draft in Gmail has correct recipient (original email's sender)
   - Verify draft has correct subject (Re: {original subject})

2. **Test 2: Subject Already Has "Re:" Prefix**
   - Test with email that already has "Re: " in subject
   - Verify no duplicate "Re: Re: " prefix

3. **Test 3: Missing Email Fields**
   - Test with email missing "from" field
   - Test with email missing "subject" field
   - Verify graceful fallback handling

4. **Test 4: Email Address Extraction**
   - Test with format: "Name <email@example.com>"
   - Test with format: "email@example.com"
   - Test with format: "Name email@example.com"
   - Verify correct email extraction

5. **Test 5: Thread ID Preservation**
   - Verify threadId is passed to draft creation
   - Verify draft appears in correct email thread in Gmail

## ✅ Acceptance Criteria

- [ ] Draft emails are created with correct recipient (original email's sender)
- [ ] Draft emails have correct subject line (Re: {original subject})
- [ ] Subject line doesn't duplicate "Re:" prefix if already present
- [ ] Email address is correctly extracted from various formats ("Name <email>", "email", etc.)
- [ ] Thread ID is preserved for email threading
- [ ] Response metadata includes correct recipient and subject
- [ ] Error handling for missing email fields
- [ ] Error handling for Gmail API failures
- [ ] All existing tests pass
- [ ] New unit tests for email address extraction
- [ ] Manual testing in Gmail confirms drafts are correct

## 🚀 Future Enhancements (Optional)

### Draft Viewing/Editing Feature

If users need to view and edit drafts from the application:

1. **Add Draft List Endpoint**
   - `GET /drafts` - List all drafts
   - `GET /drafts/{draftId}` - Get specific draft details

2. **Add Draft Editing UI**
   - Display list of drafts
   - Click on draft to populate form:
     - Subject field → draft subject
     - To field → draft recipient
     - Body field → draft content
   - Allow editing and re-saving

3. **Update Frontend**
   - Add draft viewing panel
   - Add click handler to populate form fields
   - Add draft editing functionality

## 📊 Success Metrics

- **Accuracy**: 100% of drafts have correct recipient and subject
- **User Experience**: No manual correction needed before sending
- **Error Rate**: < 1% failures due to email parsing issues
- **Performance**: Draft creation time remains < 2 seconds

## 🔗 Related Files

- `python-server/app/api/routes/gmail.py` - Main endpoint to fix
- `python-server/app/services/gmail.py` - Draft creation function (no changes needed)
- `python-server/app/services/emails.py` - Email parsing utilities (add helper function)
- `python-server/app/models/emails.py` - Request models (no changes needed)
- `web-app/app.js` - Frontend draft saving (no changes needed, but may need updates for draft viewing)

## 📅 Estimated Effort

- **Backend Changes**: 2-3 hours
  - Email fetching logic: 30 minutes
  - Email address extraction: 30 minutes
  - Subject formatting: 30 minutes
  - Testing and debugging: 1-2 hours

- **Testing**: 1-2 hours
  - Unit tests: 30 minutes
  - Integration tests: 30 minutes
  - Manual testing: 30-60 minutes

**Total**: 3-5 hours

## 🎯 Priority

**High Priority** - This is a core functionality issue that affects user experience and workflow. Users should not need to manually correct recipient and subject fields for every draft.

---

## 📝 Notes

- This story addresses the comment in the code: `"Placeholder recipient/subject; in future fetch original email metadata"`
- The solution maintains backward compatibility with existing API contracts
- No breaking changes to frontend required for basic functionality
- Future draft viewing feature can be implemented as a separate story

