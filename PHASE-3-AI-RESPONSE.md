# Phase 3: AI-Powered Email Response Generator

## 🎯 What is Phase 3?

Phase 3 adds **AI intelligence** to analyze emails and generate professional responses. After finding relevant emails (Phase 2), we now use AI to:
- **Understand** email context
- **Analyze** conversation history
- **Generate** professional replies
- **Provide** multiple response options

---

## 🧠 The Big Picture

```
User Query: "Reply to the meeting invitation from Sarah"
         ↓
[Phase 2: Semantic Search]
         ↓
Found: 3 emails from Sarah about meetings
         ↓
[Phase 3: AI Response Generator] ← WE ARE HERE
         ↓
AI analyzes emails + generates 3 response options:
1. Accept meeting (formal)
2. Accept meeting (casual)
3. Request reschedule
         ↓
User selects option 2 → Save to Gmail drafts
```

---

## 📊 Phase 3 Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      USER INPUT                              │
│  "Reply to Sarah's meeting invitation - I'm available"      │
└───────────────────┬─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────┐
│               STEP 1: Search Emails (Phase 2)                │
│  - Semantic search for "Sarah meeting invitation"            │
│  - Find 3 most relevant emails                               │
└───────────────────┬─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────┐
│            STEP 2: Build Context for AI                      │
│  Collect:                                                    │
│  - Email from: Sarah Johnson <sarah@company.com>             │
│  - Email subject: "Project Meeting Next Week"                │
│  - Email content: "Can you join us Tuesday 2pm?"             │
│  - User instruction: "I'm available"                         │
│  - Conversation thread (if exists)                           │
└───────────────────┬─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────┐
│              STEP 3: Send to OpenAI GPT-4                    │
│  Use specially crafted PROMPT (see below)                    │
└───────────────────┬─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────┐
│             STEP 4: AI Generates Responses                   │
│  Option 1: "Hi Sarah, Tuesday at 2pm works perfectly..."    │
│  Option 2: "Hey Sarah! Count me in for Tuesday..."          │
│  Option 3: "Hi Sarah, I can join but prefer 3pm..."         │
└───────────────────┬─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────┐
│             STEP 5: User Reviews & Selects                   │
│  User picks Option 2 (casual tone)                           │
└───────────────────┬─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────┐
│           STEP 6: Save to Gmail Drafts (Optional)            │
│  Create draft in Gmail ready to send                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 🤖 The Magic: AI Prompts

### Understanding Prompt Engineering

**What is a Prompt?**
A prompt is the instruction we give to AI (like ChatGPT) to tell it exactly what to do.

**Why is it Important?**
- ✅ Good prompt = Perfect response
- ❌ Bad prompt = Confusing response

---

## 📝 Main AI Prompt (How We Talk to GPT-4)

```
SYSTEM ROLE:
You are an intelligent email assistant. Your job is to analyze emails
and generate professional, contextually appropriate responses.

USER INSTRUCTION:
I received this email:

---
From: Sarah Johnson <sarah@company.com>
Subject: Project Meeting Next Week
Date: October 15, 2025

Hi [User Name],

I'm organizing a project sync meeting for next Tuesday at 2pm.
Can you join us? We'll discuss the Q4 roadmap.

Let me know!
Best,
Sarah
---

USER'S INTENT: "I'm available and want to join"

TASK:
Generate 3 different response options:
1. Formal tone - Professional business response
2. Casual tone - Friendly but professional
3. Alternative - Suggest a modification (time/format)

REQUIREMENTS:
- Keep responses under 100 words
- Match the original email's tone
- Include proper greeting and closing
- Be natural and human-like
- Use the user's intent

OUTPUT FORMAT (JSON):
{
  "responses": [
    {
      "tone": "formal",
      "subject": "Re: Project Meeting Next Week",
      "body": "Dear Sarah,\n\nThank you for the invitation..."
    },
    {
      "tone": "casual",
      "subject": "Re: Project Meeting Next Week",
      "body": "Hi Sarah!\n\nTuesday at 2pm works great..."
    },
    {
      "tone": "alternative",
      "subject": "Re: Project Meeting Next Week",
      "body": "Hi Sarah,\n\nI'd love to join..."
    }
  ],
  "analysis": {
    "emailType": "meeting invitation",
    "urgency": "medium",
    "sentiment": "friendly",
    "keyPoints": ["Tuesday 2pm", "Q4 roadmap", "project sync"]
  }
}
```

---

## 🎯 Prompt Breakdown (What Each Part Does)

### 1. **SYSTEM ROLE**
```
"You are an intelligent email assistant..."
```
**Purpose:** Tells AI what its job is
**Why:** AI behaves differently based on role (teacher vs assistant vs expert)

---

### 2. **CONTEXT (Email Details)**
```
From: Sarah Johnson
Subject: Project Meeting
Content: [Full email]
```
**Purpose:** Give AI all information about the email
**Why:** AI needs context to generate relevant responses

---

### 3. **USER INTENT**
```
"I'm available and want to join"
```
**Purpose:** User's specific instruction or preference
**Why:** AI must know what user wants to communicate

---

### 4. **TASK (What to Do)**
```
Generate 3 different response options:
1. Formal tone
2. Casual tone  
3. Alternative
```
**Purpose:** Specific instructions on what to create
**Why:** Clear instructions = better results

---

### 5. **REQUIREMENTS (Rules)**
```
- Under 100 words
- Match tone
- Natural and human-like
```
**Purpose:** Quality control rules
**Why:** Prevents AI from being too long, weird, or robotic

---

### 6. **OUTPUT FORMAT (Structure)**
```json
{
  "responses": [...],
  "analysis": {...}
}
```
**Purpose:** Tell AI exactly how to format the response
**Why:** We need structured data (JSON) to parse in code

---

## 🔄 Different Scenarios & Prompts

### Scenario 1: Reply to Meeting Invitation

**User Query:** "Accept the meeting from John"

**AI Prompt Context:**
```
Email Type: Meeting invitation
User Intent: Accept
Tone Preference: Professional
```

**AI Generated Responses:**
```
1. FORMAL:
   "Dear John, I confirm my attendance at the meeting..."
   
2. CASUAL:
   "Hi John! Count me in for the meeting..."
   
3. WITH QUESTION:
   "Hi John, I can attend. Will there be an agenda?"
```

---

### Scenario 2: Follow-up on Pending Request

**User Query:** "Politely follow up on my job application"

**AI Prompt Context:**
```
Email Type: Follow-up
User Intent: Check status (polite)
Tone Preference: Professional, patient
```

**AI Generated Responses:**
```
1. FORMAL:
   "Dear Hiring Manager, I am writing to inquire about..."
   
2. BALANCED:
   "Hi [Name], I wanted to check in regarding..."
   
3. BRIEF:
   "Hi [Name], Just following up on my application..."
```

---

### Scenario 3: Decline an Offer

**User Query:** "Politely decline the speaking invitation"

**AI Prompt Context:**
```
Email Type: Invitation decline
User Intent: Say no (polite + reason)
Tone Preference: Apologetic but firm
```

**AI Generated Responses:**
```
1. WITH REASON:
   "Thank you for thinking of me. Unfortunately, my schedule..."
   
2. BRIEF:
   "I appreciate the invitation, but I must decline..."
   
3. OFFER ALTERNATIVE:
   "I can't make it, but I can recommend someone..."
```

---

## 🎨 Advanced Prompt Features

### Feature 1: Conversation Thread Analysis

**What it does:** Analyzes entire email chain, not just one email

**Example:**
```
Email 1: Sarah: "Can you join Tuesday?"
Email 2: You: "What time?"
Email 3: Sarah: "2pm works?"
```

**AI Prompt:**
```
CONVERSATION HISTORY:
[Email 1, 2, 3 in order]

CONTEXT: This is an ongoing conversation
TASK: Generate a reply that acknowledges the history
```

**Result:** "Tuesday at 2pm works! See you then." ✅ (Natural!)
**Without history:** "Yes" ❌ (Weird!)

---

### Feature 2: Tone Matching

**What it does:** AI matches the sender's tone

**Example:**
```
Sender's tone: Very casual ("Hey! What's up? 😊")
AI response: "Hey! I'm good, thanks for asking!"

Sender's tone: Formal ("Dear Sir/Madam...")
AI response: "Dear [Name], Thank you for your inquiry..."
```

**How we do it:**
```
PROMPT:
Analyze the sender's tone (formal/casual/friendly).
Match that tone in your response.
```

---

### Feature 3: Multi-language Support (Future)

**What it does:** Generate responses in same language as original

**Example:**
```
Email in Spanish: "Hola, ¿cómo estás?"
AI Response: "¡Hola! Estoy bien, gracias..."
```

**How we do it:**
```
PROMPT:
Detect the email's language.
Generate responses in the same language.
```

---

## 🔧 Why We Use GPT-4 (vs GPT-3.5)

| Feature | GPT-3.5-Turbo | GPT-4 |
|---------|--------------|-------|
| **Quality** | Good | Excellent ✅ |
| **Context Understanding** | Basic | Advanced ✅ |
| **Natural Language** | Decent | Very Natural ✅ |
| **Following Instructions** | Sometimes | Always ✅ |
| **Cost** | $0.002/1K tokens | $0.03/1K tokens |
| **Best For** | Simple tasks | Complex email analysis ✅ |

**For this project:** Use **GPT-4** for best results (or GPT-3.5-turbo for learning/cost savings)

---

## 📊 Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    INPUT DATA                                │
├─────────────────────────────────────────────────────────────┤
│ 1. Email from Phase 2 search:                               │
│    {                                                         │
│      from: "Sarah <sarah@company.com>",                      │
│      subject: "Meeting",                                     │
│      content: "Can you join Tuesday 2pm?",                   │
│      date: "2025-10-15"                                      │
│    }                                                         │
│                                                              │
│ 2. User instruction:                                         │
│    "I'm available"                                           │
│                                                              │
│ 3. User preferences:                                         │
│    - Response length: medium                                 │
│    - Tone: professional                                      │
│    - Number of options: 3                                    │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│                 BUILD AI PROMPT                              │
│  Combine all data into a structured prompt                   │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│              SEND TO OPENAI API                              │
│  POST https://api.openai.com/v1/chat/completions            │
│  {                                                           │
│    model: "gpt-4",                                           │
│    messages: [{ role: "system", content: prompt }],          │
│    temperature: 0.7                                          │
│  }                                                           │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│                 AI RESPONSE                                  │
│  {                                                           │
│    responses: [                                              │
│      { tone: "formal", body: "Dear Sarah..." },              │
│      { tone: "casual", body: "Hi Sarah!" },                  │
│      { tone: "alternative", body: "Hi Sarah, I can..." }     │
│    ],                                                        │
│    analysis: {                                               │
│      type: "meeting invitation",                             │
│      sentiment: "friendly"                                   │
│    }                                                         │
│  }                                                           │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│               DISPLAY TO USER                                │
│  Show 3 response options with preview                        │
│  User selects one → Copy or save to Gmail                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 API Endpoint Design

### Endpoint: `POST /generate-response`

**What it does:** Takes email + instruction → Returns AI-generated responses

**Input (Request Body):**
```json
{
  "email": {
    "id": "email_abc123",
    "from": "Sarah Johnson <sarah@company.com>",
    "subject": "Project Meeting Next Week",
    "content": "Can you join us Tuesday at 2pm?",
    "date": "2025-10-15",
    "threadId": "thread_xyz" // optional
  },
  "userInstruction": "I'm available and want to join",
  "options": {
    "numberOfResponses": 3,
    "tonePreference": "professional", // or "casual" or "mixed"
    "maxLength": 100, // words
    "includeAnalysis": true
  }
}
```

**Output (Response):**
```json
{
  "success": true,
  "responses": [
    {
      "id": "resp_1",
      "tone": "formal",
      "subject": "Re: Project Meeting Next Week",
      "body": "Dear Sarah,\n\nThank you for the invitation. I would be happy to join the project sync meeting on Tuesday at 2pm. I look forward to discussing the Q4 roadmap.\n\nBest regards",
      "wordCount": 35,
      "estimatedReading": "10 seconds"
    },
    {
      "id": "resp_2",
      "tone": "casual",
      "subject": "Re: Project Meeting Next Week",
      "body": "Hi Sarah!\n\nTuesday at 2pm works great for me! Looking forward to the Q4 roadmap discussion.\n\nSee you then!",
      "wordCount": 22,
      "estimatedReading": "7 seconds"
    },
    {
      "id": "resp_3",
      "tone": "alternative",
      "subject": "Re: Project Meeting Next Week",
      "body": "Hi Sarah,\n\nI can join the meeting! Quick question - will you be sharing an agenda beforehand? It would help me prepare.\n\nThanks!",
      "wordCount": 27,
      "estimatedReading": "8 seconds"
    }
  ],
  "analysis": {
    "emailType": "meeting_invitation",
    "urgency": "medium",
    "sentiment": "friendly_professional",
    "keyTopics": ["meeting", "Tuesday", "Q4 roadmap", "project sync"],
    "recommendedTone": "professional_casual",
    "detectedIntent": "schedule_request"
  },
  "metadata": {
    "processingTime": "2.3s",
    "model": "gpt-4",
    "tokensUsed": 450,
    "cost": "$0.0135"
  }
}
```

---

## 💡 Why This Approach is Smart

### 1. **Multiple Options** (Not Just One)
**Problem:** One AI response might not match your style
**Solution:** Give 3 options (formal, casual, alternative)
**Result:** User picks what feels right ✅

---

### 2. **Context-Aware** (Not Generic)
**Bad AI:** "Thank you for your email." (Generic 😐)
**Good AI:** "Tuesday at 2pm works perfectly! Looking forward to discussing the Q4 roadmap." (Specific 🎯)

**How:** We include full email content + conversation history in prompt

---

### 3. **Learns from Email Thread** (Not Just Last Message)
**Example:**
```
Email 1: "Can you join Tuesday?"
Email 2: "What time?"
Email 3: "2pm?"
```

**Bad AI:** "Yes" (Ignores context ❌)
**Good AI:** "Tuesday at 2pm works perfectly!" (Understands full conversation ✅)

---

### 4. **Analysis Included** (Not Just Response)
AI also tells us:
- What type of email (invitation, follow-up, complaint, etc.)
- Urgency level (low, medium, high)
- Sentiment (friendly, formal, urgent)
- Key topics

**Why useful:** Helps user understand what to expect

---

## 🔥 Advanced Features

### Feature 1: Smart Reply Suggestions

**What it does:** Automatically suggests quick responses

**Example:**
```
Email: "Can you join the call at 3pm?"

Quick Suggestions:
- ✅ "Yes, I'll join"
- ❓ "Can we do 4pm instead?"
- ❌ "Sorry, I'm not available"
```

**How it works:**
```
PROMPT TO AI:
Analyze this email and suggest 3 quick reply options
(accept, decline, request modification).
Keep each under 10 words.
```

---

### Feature 2: Auto-Draft Saving

**What it does:** Automatically saves selected response to Gmail drafts

**Flow:**
```
User selects response → Click "Save to Drafts"
                              ↓
                    Use Gmail API to create draft
                              ↓
                    User opens Gmail → Draft is ready!
```

---

### Feature 3: Response History

**What it does:** Remember previously generated responses

**Why useful:**
- User can go back and pick different option
- Learn which responses user prefers
- Improve future suggestions

---

### Feature 4: Tone Adjustment Slider

**What it does:** User can adjust tone after generation

**UI Mockup:**
```
Response Preview:
"Hi Sarah, Tuesday works great!"

Tone Slider:
[Formal] ←———●———→ [Casual]

Adjusted:
"Hey Sarah! Tuesday's perfect!"
```

**How it works:**
```
PROMPT TO AI:
Rewrite this response with [more formal/more casual] tone:
Original: "Hi Sarah, Tuesday works great!"
Target tone: Very casual
```

---

## 🎓 Learning Concepts

### 1. **What is Temperature in AI?**

**Temperature** = How creative AI should be

```
Temperature 0.0 → Very predictable
"Thank you for your email. I confirm attendance."

Temperature 0.7 → Balanced (GOOD for emails)
"Thanks! Tuesday at 2pm works perfectly."

Temperature 1.5 → Very creative (TOO random for emails)
"Yo! Tuesday's gonna be lit! 🔥"
```

**For this project:** Use `temperature: 0.7`

---

### 2. **What are Tokens?**

**Token** ≈ 4 characters or ¾ of a word

**Example:**
```
"Hello, how are you?" = ~6 tokens
"Can you join Tuesday?" = ~5 tokens
```

**Why it matters:**
- OpenAI charges per token
- GPT-4 has 8,192 token limit per request
- We need to stay within limits

**Our strategy:**
- Include only last 10 emails in thread (not entire history)
- Summarize long emails (>500 words)
- Keep prompts efficient

---

### 3. **Prompt Engineering Best Practices**

✅ **DO:**
- Be specific: "Generate 3 responses" not "Generate some responses"
- Give examples: Show what good output looks like
- Set constraints: "Under 100 words"
- Use JSON format: Structured data is easier to parse

❌ **DON'T:**
- Be vague: "Write something nice"
- Give conflicting instructions: "Be brief but detailed"
- Assume AI knows context: Always provide full information
- Use ambiguous language: "Make it better"

---

## 📈 Performance Considerations

### How Long Does It Take?

```
Step 1: Fetch email from Phase 2      ~0.1s
Step 2: Build AI prompt                ~0.05s
Step 3: Send to OpenAI                 ~2-4s ⏳ (slowest)
Step 4: Parse response                 ~0.1s
Step 5: Display to user                ~0.05s
────────────────────────────────────────
TOTAL:                                 ~2.5-4.5s
```

**Optimization strategies:**
1. **Cache similar prompts** - If user generates response twice for same email
2. **Streaming responses** - Show AI typing in real-time
3. **Parallel processing** - Generate all 3 options simultaneously
4. **Use GPT-3.5-turbo** - Faster (1-2s) but lower quality

---

## 💰 Cost Estimation

**GPT-4 Pricing:**
- Input: $0.03 per 1K tokens
- Output: $0.06 per 1K tokens

**Average email response generation:**
```
Input tokens (prompt + email): ~500 tokens = $0.015
Output tokens (3 responses):   ~300 tokens = $0.018
─────────────────────────────────────────────────
TOTAL PER GENERATION:                   ~$0.033
```

**Monthly cost (100 emails):**
- 100 generations × $0.033 = **$3.30/month**

**Budget-friendly:** Use GPT-3.5-turbo = **$0.30/month** 💰

---

## 🔒 Privacy & Security

### What Data We Send to OpenAI:
- ✅ Email content (necessary for AI to work)
- ✅ Sender name/email (for context)
- ✅ Subject line (for context)

### What We DON'T Send:
- ❌ User's full email account
- ❌ Passwords or auth tokens
- ❌ Unrelated emails
- ❌ Personal information (unless in email body)

### Security Best Practices:
1. **Option to exclude sensitive emails** - User can mark emails as "private"
2. **Local filtering** - Remove sensitive patterns before sending to AI
3. **User consent** - Always ask permission before sending to AI
4. **OpenAI privacy:** OpenAI doesn't use API data to train models

---

## 🎨 User Experience Flow

### Option A: Direct Response Generation

```
User clicks "Reply to this email"
         ↓
Loading... (2-3 seconds)
         ↓
3 response options appear
         ↓
User selects one
         ↓
Copy to clipboard OR Save to Gmail drafts
```

**Pros:** Simple, fast
**Cons:** No customization

---

### Option B: Guided Response (RECOMMENDED)

```
User clicks "Reply to this email"
         ↓
Dialog appears:
┌─────────────────────────────────────┐
│ What do you want to say?            │
│ [I'm available]                     │
│                                     │
│ Tone: [ ] Formal [●] Professional  │
│       [ ] Casual                    │
│                                     │
│ [Generate Response]                 │
└─────────────────────────────────────┘
         ↓
AI generates 3 options
         ↓
User reviews and selects
```

**Pros:** Customizable, better results
**Cons:** Extra step

---

## 🚀 Phase 3 Implementation Steps

### Step 1: Create AI Response Service
**File:** `server/aiResponseService.js`

**What it does:**
- Takes email + instruction
- Builds AI prompt
- Calls OpenAI API
- Parses and returns responses

---

### Step 2: Add API Endpoint
**File:** `server/index.js`

**New endpoint:** `POST /generate-response`

**What it does:**
- Receives email data + user instruction
- Calls AI service
- Returns generated responses

---

### Step 3: Update Frontend (Future - Phase 4)
**File:** `public/index.html`

**What it does:**
- Add "Generate Response" button
- Show loading state
- Display 3 response options
- Allow user to select/copy/save

---

## 📋 Phase 3 Checklist

```
Phase 3: AI Response Generator
├── ✅ Understand AI prompts
├── ✅ Learn about GPT-4 vs GPT-3.5
├── ✅ Understand token limits
├── ⏳ Create aiResponseService.js
├── ⏳ Add /generate-response endpoint
├── ⏳ Test with sample emails
├── ⏳ Verify response quality
└── ⏳ Add error handling
```

---

## 🎯 Success Criteria

Phase 3 is complete when:

✅ **Functional:**
- API can generate 3 response options
- Responses are contextually relevant
- Processing time < 5 seconds

✅ **Quality:**
- Responses sound natural (not robotic)
- Tone matches user preference
- Includes proper email etiquette (greeting, closing)

✅ **Reliable:**
- Handles errors gracefully
- Works with different email types
- Respects token limits

---

## 🔄 What Happens Next?

**After Phase 3 (Server-side AI):**
→ **Phase 4:** Build Web UI
→ **Phase 5:** Deploy to Render.com
→ **Phase 6:** Test on mobile

---

## 📚 Quick Reference

### Key Files in Phase 3:
```
server/
├── aiResponseService.js    ← AI logic (NEW)
├── index.js               ← Add /generate-response endpoint
├── embeddingService.js    ← Already exists (Phase 2)
└── gmailAuth.js          ← Already exists (Phase 1)
```

### Key Concepts:
- **Prompt Engineering** - How we talk to AI
- **Temperature** - AI creativity level
- **Tokens** - AI's "words"
- **Context Window** - How much AI can remember

### API Keys Needed:
- ✅ `OPENAI_API_KEY` (already have from Phase 2)
- ✅ Gmail credentials (already have from Phase 1)

---

## 💡 Summary

**What is Phase 3?**
Adding AI-powered response generation to our email manager.

**How does it work?**
1. Get email from Phase 2 search
2. Build AI prompt with context
3. Send to GPT-4
4. Get 3 response options
5. User selects and uses

**Why is it powerful?**
- Saves time writing emails
- Professional responses
- Multiple tone options
- Context-aware (understands conversation)

**What's the cost?**
- ~$0.03 per email with GPT-4
- ~$0.002 per email with GPT-3.5-turbo

**How long does it take?**
- 2-4 seconds per generation

---

## 🎓 What You've Learned

After reading this document, you understand:

✅ How AI response generation works
✅ What prompt engineering is
✅ How to structure AI prompts
✅ Why we use GPT-4
✅ How tokens and temperature work
✅ The full data flow (search → AI → response)
✅ Privacy and cost considerations
✅ What Phase 3 will implement

---

## 🚀 Ready to Build?

**Next step:** Say **"Start coding Phase 3!"**

I'll create:
1. `aiResponseService.js` - AI logic
2. Update `server/index.js` - Add endpoint
3. Test with sample emails
4. Verify everything works

**Estimated time:** 15-20 minutes to implement

**You'll be able to:** Generate AI responses for your emails! 🎉

---

## ❓ Questions to Think About

Before we code, consider:

1. **Which model?** GPT-4 (best) or GPT-3.5-turbo (cheaper)?
2. **How many options?** 3 responses (good) or 5 (more choice)?
3. **Response length?** Short (50 words) or Medium (100 words)?
4. **Auto-save drafts?** Yes (convenient) or No (manual control)?

**Your preferences will shape Phase 3!** 🎯

---

*Ready to continue? Just say "Start Phase 3 coding!" 🚀*


