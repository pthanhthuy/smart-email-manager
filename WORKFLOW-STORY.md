# Smart Email Manager: Complete Workflow Story

**A Comprehensive Guide to Service Calls, Dependencies, and Request/Response Flows**

---

## 📋 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Dependency Injection System](#dependency-injection-system)
3. [Email Sync Workflow](#email-sync-workflow)
4. [Semantic Search Workflow](#semantic-search-workflow)
5. [Response Generation Workflows](#response-generation-workflows)
6. [Email Classification Workflow](#email-classification-workflow)
7. [Dynamic Labeling Workflow](#dynamic-labeling-workflow)
8. [TTS Summary Workflow](#tts-summary-workflow)
9. [Save Draft Workflow](#save-draft-workflow)
10. [Service Dependencies Map](#service-dependencies-map)

---

## 🏗️ Architecture Overview

### Service Layer Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      FastAPI Application                      │
│                      (app/main.py)                           │
└─────────────────────────────────────────────────────────────┘
                            │
                            ├─→ API Routes (app/api/routes/)
                            │   ├─ search.py
                            │   ├─ ai.py
                            │   ├─ chains.py
                            │   ├─ classification.py
                            │   ├─ labels.py
                            │   ├─ summary_tts.py
                            │   └─ gmail.py
                            │
                            ├─→ Dependency Injection (app/api/deps.py)
                            │   └─ Provides singleton services
                            │
                            └─→ Services (app/services/)
                                ├─ embeddings.py
                                ├─ vector_store.py
                                ├─ ai_responses.py
                                ├─ email_chains.py
                                ├─ email_classification.py
                                ├─ label_service.py
                                ├─ redis_cache.py
                                ├─ gmail.py
                                └─ summary_tts.py
```

---

## 🔌 Dependency Injection System

### Location: `app/api/deps.py`

**Purpose**: Provides singleton instances of all services using FastAPI's dependency injection.

### Service Factories

```python
# All services are cached singletons using @lru_cache

get_settings_dep() → Settings
get_embedding_service() → EmbeddingService
get_vector_store() → VectorStore
get_ai_service() → AIResponseService
get_tone_service() → ToneAdjustmentService
get_history_service() → ResponseHistoryService
get_classification_service() → EmailClassificationService
get_redis_cache_service() → RedisCacheService
```

### How It Works

1. **First Call**: Service is instantiated and cached
2. **Subsequent Calls**: Returns cached instance
3. **Dependency Injection**: FastAPI automatically injects services into route handlers

**Example**:
```python
@router.post("/search")
async def semantic_search(
    embeddings: EmbeddingService = Depends(get_embedding_service),
    vector_store: VectorStore = Depends(get_vector_store),
):
    # FastAPI automatically provides the service instances
```

---

## 📧 Email Sync Workflow

### Endpoint: `POST /sync`

### Complete Call Flow

```
┌─────────────────────────────────────────────────────────────┐
│                   1. API Request                            │
│                   POST /sync                                │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   2. Route Handler                          │
│                   app/api/routes/search.py                  │
│                   sync_emails()                             │
└─────────────────────────────────────────────────────────────┘
                            │
                            ├─→ Depends: get_settings_dep()
                            ├─→ Depends: get_embedding_service()
                            └─→ Depends: get_vector_store()
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   3. Gmail Service                          │
│                   app/services/gmail.py                     │
│                   get_gmail_service()                        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ├─→ Loads OAuth token
                            ├─→ Refreshes if expired
                            └─→ Returns Gmail API client
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   4. Fetch Emails                           │
│                   Gmail API                                 │
│                   gmail.users().messages().list()           │
└─────────────────────────────────────────────────────────────┘
                            │
                            ├─→ Filters: -category:promotions -category:social
                            └─→ Returns: List of message references
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   5. Parse Each Email                        │
│                   app/services/emails.py                    │
│                   parse_email()                              │
└─────────────────────────────────────────────────────────────┘
                            │
                            ├─→ Extracts: subject, from, body, date, labels
                            └─→ Returns: Parsed email dict
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   6. Classify Emails                        │
│                   app/services/email_classification.py      │
│                   EmailClassificationService.classify_email()│
└─────────────────────────────────────────────────────────────┘
                            │
                            ├─→ Rule-based classification first
                            │   ├─ Check spam patterns
                            │   ├─ Check Gmail categories
                            │   └─ Check domain patterns
                            │
                            └─→ AI classification if needed
                                ├─ LangChain ChatOpenAI
                                └─ Returns: category + confidence
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   7. Generate Embeddings                    │
│                   app/services/embeddings.py                │
│                   EmbeddingService.generate_email_embeddings()│
└─────────────────────────────────────────────────────────────┘
                            │
                            ├─→ Prepare email text for embedding
                            ├─→ Call: embeddings.aembed_documents()
                            │   └─ LangChain OpenAIEmbeddings
                            └─→ Returns: Emails with embedding vectors
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   8. Store in Vector DB                     │
│                   app/services/vector_store.py              │
│                   VectorStore.add_emails()                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ├─→ ChromaDB collection.upsert()
                            ├─→ Stores: id, embedding, metadata, document
                            └─→ Returns: Count of indexed emails
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   9. Invalidate Cache                       │
│                   app/services/redis_cache.py                │
│                   RedisCacheService.clear_all_cache()       │
└─────────────────────────────────────────────────────────────┘
                            │
                            └─→ Deletes all search cache entries
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   10. Response                              │
│                   Returns: {success, indexed, message}      │
└─────────────────────────────────────────────────────────────┘
```

### Service Call Sequence

```
sync_emails()
  ├─→ get_gmail_service(settings)
  │     └─→ get_gmail_service() [gmail.py]
  │           ├─→ _load_token()
  │           ├─→ token.refresh() [if expired]
  │           └─→ build("gmail", "v1", credentials=creds)
  │
  ├─→ gmail.users().messages().list() [Gmail API]
  │
  ├─→ email_utils.parse_email() [for each email]
  │
  ├─→ EmailClassificationService.classify_email() [for each email]
  │     ├─→ _rule_based_classification()
  │     │     ├─→ _detect_spam()
  │     │     └─→ Check patterns
  │     └─→ [If needed] LangChain ChatOpenAI.classify()
  │
  ├─→ EmbeddingService.generate_email_embeddings()
  │     ├─→ email_utils.prepare_email_for_embedding()
  │     └─→ embeddings.aembed_documents() [LangChain]
  │
  ├─→ VectorStore.add_emails()
  │     └─→ collection.upsert() [ChromaDB]
  │
  └─→ RedisCacheService.clear_all_cache()
        └─→ redis_client.delete() [Redis]
```

---

## 🔍 Semantic Search Workflow

### Endpoint: `POST /search`

### Complete Call Flow

```
┌─────────────────────────────────────────────────────────────┐
│                   1. API Request                            │
│                   POST /search                              │
│                   Body: {query, limit, category?}           │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   2. Route Handler                          │
│                   app/api/routes/search.py                  │
│                   semantic_search()                         │
└─────────────────────────────────────────────────────────────┘
                            │
                            ├─→ Depends: get_embedding_service()
                            ├─→ Depends: get_vector_store()
                            ├─→ Depends: get_redis_cache_service()
                            └─→ Depends: get_settings_dep()
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   3. Check Cache                            │
│                   RedisCacheService.get_cache()             │
└─────────────────────────────────────────────────────────────┘
                            │
                            ├─→ [Cache Hit] → Return cached results
                            └─→ [Cache Miss] → Continue to search
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   4. Generate Query Embedding               │
│                   EmbeddingService.generate_embedding()     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ├─→ embeddings.aembed_query(query)
                            │   └─ LangChain OpenAIEmbeddings
                            └─→ Returns: Vector embedding [1536 dims]
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   5. Vector Search                          │
│                   VectorStore.search()                      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ├─→ collection.query() [ChromaDB]
                            │   ├─ query_embeddings=[query_embedding]
                            │   ├─ n_results=limit
                            │   └─ where={category: category} [if filter]
                            └─→ Returns: Similar emails with scores
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   6. Format Results                         │
│                   EmailSearchResult models                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ├─→ Extract metadata
                            ├─→ Calculate similarity scores
                            └─→ Format as EmailSearchResult
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   7. Update Cache                           │
│                   RedisCacheService.set_cache()             │
└─────────────────────────────────────────────────────────────┘
                            │
                            └─→ Store results in Redis with TTL
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   8. Response                               │
│                   Returns: {success, query, count, results}  │
└─────────────────────────────────────────────────────────────┘
```

### Service Call Sequence

```
semantic_search()
  ├─→ RedisCacheService.get_cache()
  │     └─→ redis_client.get(cache_key) [Redis]
  │
  ├─→ [If cache miss or force_refresh]
  │     ├─→ EmbeddingService.generate_embedding(query)
  │     │     └─→ embeddings.aembed_query(query) [LangChain]
  │     │
  │     ├─→ VectorStore.search(embedding, limit, category)
  │     │     └─→ collection.query() [ChromaDB]
  │     │
  │     └─→ Format results as EmailSearchResult
  │
  └─→ RedisCacheService.set_cache()
        └─→ redis_client.setex(cache_key, ttl, results) [Redis]
```

### Special Case: Empty Query (Get All Emails)

```
semantic_search(query="")
  └─→ VectorStore.get_all_emails(category, limit)
        └─→ collection.get(where={category}, limit=limit) [ChromaDB]
              └─→ Returns: All emails sorted by date
```

---

## ✍️ Response Generation Workflows

### Workflow 1: Regular AI Response

### Endpoint: `POST /generate-response`

### Complete Call Flow

```
┌─────────────────────────────────────────────────────────────┐
│                   1. API Request                            │
│                   POST /generate-response                   │
│                   Body: {emailData, userInstruction, options}│
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   2. Route Handler                          │
│                   app/api/routes/ai.py                      │
│                   generate_response()                       │
└─────────────────────────────────────────────────────────────┘
                            │
                            └─→ Depends: get_ai_service()
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   3. AI Response Service                    │
│                   app/services/ai_responses.py              │
│                   AIResponseService.generate_smart_replies()│
└─────────────────────────────────────────────────────────────┘
                            │
                            ├─→ Build email content string
                            ├─→ Get tone description
                            └─→ Create LangChain prompt
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   4. LangChain Prompt                      │
│                   ChatPromptTemplate                        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ├─→ SystemMessagePromptTemplate
                            └─→ HumanMessagePromptTemplate
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   5. LLM Generation                        │
│                   ChatOpenAI.ainvoke()                      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ├─→ model_kwargs={"response_format": {"type": "json_object"}}
                            ├─→ Calls OpenAI GPT-4o-mini
                            └─→ Returns: JSON response
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   6. Parse Response                        │
│                   json.loads() or _parse_ai_response()      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ├─→ Extract suggestions
                            ├─→ Extract analysis
                            └─→ Validate structure
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   7. Save History                           │
│                   ResponseHistoryService.add_history_entry()│
└─────────────────────────────────────────────────────────────┘
                            │
                            └─→ Saves to response-history.json
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   8. Response                              │
│                   Returns: {success, suggestions, analysis, metadata}│
└─────────────────────────────────────────────────────────────┘
```

### Service Call Sequence

```
generate_response()
  └─→ AIResponseService.generate_smart_replies()
        ├─→ _build_email_content_string()
        ├─→ _get_tone_description()
        ├─→ ChatPromptTemplate.from_messages()
        │     ├─→ SystemMessagePromptTemplate
        │     └─→ HumanMessagePromptTemplate
        │
        ├─→ ChatOpenAI.ainvoke(formatted_prompt)
        │     └─→ OpenAI API (GPT-4o-mini)
        │
        ├─→ json.loads(response_text)
        │
        └─→ ResponseHistoryService.add_history_entry()
              └─→ Saves to JSON file
```

---

### Workflow 2: RAG-Enhanced Response

### Endpoint: `POST /chains/rag-response`

### Complete Call Flow

```
┌─────────────────────────────────────────────────────────────┐
│                   1. API Request                            │
│                   POST /chains/rag-response                  │
│                   Body: {emailData, userInstruction, options}│
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   2. Route Handler                          │
│                   app/api/routes/chains.py                 │
│                   rag_response()                             │
└─────────────────────────────────────────────────────────────┘
                            │
                            └─→ Depends: get_email_chains_service()
                            │     ├─→ get_ai_service()
                            │     ├─→ get_embedding_service()
                            │     └─→ get_vector_store()
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   3. Email Processing Chains                │
│                   app/services/email_chains.py             │
│                   EmailProcessingChains.rag_response_chain()│
└─────────────────────────────────────────────────────────────┘
                            │
                            ├─→ Step 1: Build query from email + instruction
                            ├─→ Step 2: Generate query embedding
                            └─→ Step 3: Search for similar emails
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   4. Retrieve Context Emails                │
│                   EmbeddingService + VectorStore            │
└─────────────────────────────────────────────────────────────┘
                            │
                            ├─→ EmbeddingService.generate_embedding(query_text)
                            │     └─→ embeddings.aembed_query() [LangChain]
                            │
                            └─→ VectorStore.search(query_embedding, limit=3)
                                  └─→ collection.query() [ChromaDB]
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   5. Build Context String                   │
│                   Format similar emails                     │
└─────────────────────────────────────────────────────────────┘
                            │
                            └─→ Creates context from similar emails
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   6. Enhanced Prompt                         │
│                   ChatPromptTemplate with context           │
└─────────────────────────────────────────────────────────────┘
                            │
                            ├─→ SystemMessage: Instructions + context info
                            └─→ HumanMessage: Original email + context emails
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   7. LLM Generation                         │
│                   ChatOpenAI.ainvoke()                      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ├─→ JSON mode enabled
                            ├─→ Calls OpenAI GPT-4o-mini
                            └─→ Returns: Context-aware response
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   8. Parse & Enhance Response              │
│                   json.loads() + metadata                    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ├─→ Parse JSON response
                            ├─→ Add context metadata
                            │   ├─ contextUsed: true/false
                            │   └─ contextEmailsCount: N
                            └─→ Add chain metadata
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   9. Response                              │
│                   Returns: {success, suggestions, analysis, metadata}│
│                   metadata.chainType = "rag"                │
└─────────────────────────────────────────────────────────────┘
```

### Service Call Sequence

```
rag_response()
  └─→ EmailProcessingChains.rag_response_chain()
        ├─→ Build query: email + user_instruction
        │
        ├─→ EmbeddingService.generate_embedding(query_text)
        │     └─→ embeddings.aembed_query() [LangChain]
        │
        ├─→ VectorStore.search(query_embedding, limit=3)
        │     └─→ collection.query() [ChromaDB]
        │
        ├─→ Format context from similar emails
        │
        ├─→ ChatPromptTemplate.from_messages()
        │     ├─→ SystemMessage (with context instructions)
        │     └─→ HumanMessage (original + context)
        │
        ├─→ ChatOpenAI.ainvoke(formatted_messages)
        │     └─→ OpenAI API (GPT-4o-mini)
        │
        └─→ Parse JSON + add metadata
```

---

## 🏷️ Email Classification Workflow

### Endpoint: `POST /classify-email`

### Complete Call Flow

```
┌─────────────────────────────────────────────────────────────┐
│                   1. API Request                            │
│                   POST /classify-email                      │
│                   Body: {emailId?, emailData?, manualOverride?}│
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   2. Route Handler                          │
│                   app/api/routes/classification.py          │
│                   classify_email()                           │
└─────────────────────────────────────────────────────────────┘
                            │
                            ├─→ Depends: get_classification_service()
                            └─→ Depends: get_settings_dep()
                            │
                            ├─→ [If manualOverride] → Return manual category
                            └─→ [Else] → Continue classification
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   3. Fetch Email (if needed)                │
│                   Gmail API                                 │
└─────────────────────────────────────────────────────────────┘
                            │
                            ├─→ [If only emailId provided]
                            │     ├─→ get_gmail_service()
                            │     └─→ gmail.users().messages().get()
                            │
                            └─→ [If emailData provided] → Use directly
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   4. Classification Service                │
│                   app/services/email_classification.py      │
│                   EmailClassificationService.classify_email()│
└─────────────────────────────────────────────────────────────┘
                            │
                            ├─→ Step 1: Rule-based classification
                            │     ├─→ _rule_based_classification()
                            │     │     ├─→ _detect_spam()
                            │     │     │     ├─→ Check spam patterns
                            │     │     │     ├─→ Check phishing indicators
                            │     │     │     └─→ Calculate spam score
                            │     │     │
                            │     │     ├─→ Check Gmail categories
                            │     │     ├─→ Check unsubscribe links
                            │     │     ├─→ Check domain patterns
                            │     │     └─→ Check keyword patterns
                            │     │
                            │     └─→ [If match found] → Return category
                            │
                            └─→ Step 2: AI classification (if no rule match)
                                  ├─→ ChatPromptTemplate
                                  ├─→ ChatOpenAI.ainvoke()
                                  └─→ Parse JSON response
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   5. Response                               │
│                   Returns: {success, classification: {category, confidence, reasoning}}│
└─────────────────────────────────────────────────────────────┘
```

### Service Call Sequence

```
classify_email()
  ├─→ [If manualOverride] → Return manual category
  │
  ├─→ [If only emailId]
  │     ├─→ get_gmail_service()
  │     └─→ gmail.users().messages().get()
  │
  └─→ EmailClassificationService.classify_email()
        ├─→ _rule_based_classification()
        │     ├─→ _detect_spam()
        │     │     ├─→ Check sender patterns
        │     │     ├─→ Check subject patterns
        │     │     ├─→ Check content patterns
        │     │     └─→ Calculate spam score
        │     │
        │     ├─→ Check Gmail labels
        │     ├─→ Check unsubscribe links
        │     ├─→ Check domain patterns
        │     └─→ Check keywords
        │
        └─→ [If no rule match]
              ├─→ ChatPromptTemplate.from_messages()
              ├─→ ChatOpenAI.ainvoke()
              │     └─→ OpenAI API (GPT-4o-mini)
              └─→ Parse JSON response
```

---

## 🏷️ Dynamic Labeling Workflow

### Endpoint: `POST /labels` (Create) + `POST /labels/{id}/apply` (Auto-apply)

### Complete Call Flow: Create Label

```
┌─────────────────────────────────────────────────────────────┐
│                   1. API Request                            │
│                   POST /labels                             │
│                   Body: {name, description, prompt, color?} │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   2. Route Handler                          │
│                   app/api/routes/labels.py                  │
│                   create_label()                             │
└─────────────────────────────────────────────────────────────┘
                            │
                            └─→ Depends: get_settings_dep()
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   3. Label Service                          │
│                   app/services/label_service.py             │
│                   LabelService.create_label()               │
└─────────────────────────────────────────────────────────────┘
                            │
                            ├─→ Generate label ID
                            ├─→ Create label object
                            └─→ Save to labels.json
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   4. Response                               │
│                   Returns: {success, label}                  │
└─────────────────────────────────────────────────────────────┘
```

### Complete Call Flow: Auto-Apply Label

```
┌─────────────────────────────────────────────────────────────┐
│                   1. API Request                            │
│                   POST /labels/{label_id}/apply             │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   2. Route Handler                          │
│                   app/api/routes/labels.py                  │
│                   auto_apply_label()                         │
└─────────────────────────────────────────────────────────────┘
                            │
                            ├─→ Depends: get_settings_dep()
                            └─→ Depends: get_vector_store()
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   3. Label Service                          │
│                   app/services/label_service.py             │
│                   LabelService.auto_apply_label()            │
└─────────────────────────────────────────────────────────────┘
                            │
                            ├─→ Load label definition
                            └─→ Get all emails from ChromaDB
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   4. Get All Emails                         │
│                   VectorStore.get_all_emails()              │
└─────────────────────────────────────────────────────────────┘
                            │
                            └─→ collection.get() [ChromaDB]
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   5. Check Each Email                       │
│                   LabelService._email_matches_label()        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ├─→ For each email:
                            │     ├─→ Skip if already labeled
                            │     └─→ Check if matches label criteria
                            │
                            └─→ Uses LangChain to check match
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   6. AI Matching Check                       │
│                   LangChain ChatOpenAI                       │
└─────────────────────────────────────────────────────────────┘
                            │
                            ├─→ ChatPromptTemplate
                            │     ├─→ System: Label criteria
                            │     └─→ Human: Email content
                            │
                            └─→ ChatOpenAI.ainvoke()
                                  └─→ Returns: "YES" or "NO"
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   7. Update Matching Emails                │
│                   LabelService._update_emails_with_label()  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ├─→ For each matching email:
                            │     ├─→ Get current metadata
                            │     ├─→ Update metadata with label
                            │     │     ├─→ labels: label_id
                            │     │     └─→ category: label_name
                            │     └─→ collection.update() [ChromaDB]
                            │
                            └─→ Update label email count
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   8. Response                               │
│                   Returns: {success, message, emailCount}    │
└─────────────────────────────────────────────────────────────┘
```

### Service Call Sequence

```
create_label()
  └─→ LabelService.create_label()
        ├─→ Generate UUID label ID
        ├─→ Create label object
        └─→ _save_labels() → labels.json

auto_apply_label()
  └─→ LabelService.auto_apply_label()
        ├─→ VectorStore.get_all_emails()
        │     └─→ collection.get() [ChromaDB]
        │
        ├─→ For each email:
        │     ├─→ Check if already labeled
        │     └─→ _email_matches_label()
        │           ├─→ ChatPromptTemplate.from_messages()
        │           ├─→ ChatOpenAI.ainvoke()
        │           │     └─→ OpenAI API (GPT-4o-mini)
        │           └─→ Returns: YES/NO
        │
        └─→ _update_emails_with_label()
              └─→ collection.update() [ChromaDB] (for each match)
```

---

## 🎙️ TTS Summary Workflow

### Endpoint: `POST /summary-tts/generate/{email_id}`

### Complete Call Flow

```
┌─────────────────────────────────────────────────────────────┐
│                   1. API Request                            │
│                   POST /summary-tts/generate/{email_id}      │
│                   Query: language?                          │
│                   Body: {summary_text?, email_data?}        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   2. Route Handler                          │
│                   app/api/routes/summary_tts.py             │
│                   generate_summary_speech()                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ├─→ Depends: get_ai_service()
                            └─→ Depends: get_settings_dep()
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   3. Get Summary Text                        │
│                   Multiple paths                            │
└─────────────────────────────────────────────────────────────┘
                            │
                            ├─→ [If summary_text provided] → Use directly
                            │
                            ├─→ [If email_data provided]
                            │     └─→ AIResponseService.generate_email_summary()
                            │
                            └─→ [Else] → Fetch from Gmail
                                  ├─→ get_gmail_service()
                                  ├─→ gmail.users().messages().get()
                                  └─→ AIResponseService.generate_email_summary()
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   4. Generate Summary (if needed)            │
│                   app/services/ai_responses.py              │
│                   AIResponseService.generate_email_summary()│
└─────────────────────────────────────────────────────────────┘
                            │
                            ├─→ ChatPromptTemplate
                            ├─→ ChatOpenAI.ainvoke()
                            └─→ Returns: Summary text
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   5. TTS Service                              │
│                   app/services/summary_tts.py                │
│                   EmailSummaryTTSService.generate_summary_speech()│
└─────────────────────────────────────────────────────────────┘
                            │
                            ├─→ Check cache for existing audio
                            ├─→ [If cached] → Return cached audio
                            └─→ [Else] → Generate new audio
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   6. Generate Audio                         │
│                   Hugging Face TTS                           │
└─────────────────────────────────────────────────────────────┘
                            │
                            ├─→ Initialize TTS model (if needed)
                            ├─→ Process text
                            ├─→ Generate audio with transformers
                            └─→ Save to cache
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   7. Stream Response                       │
│                   StreamingResponse                         │
└─────────────────────────────────────────────────────────────┘
                            │
                            └─→ Returns: audio/wav stream
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   8. Response                               │
│                   Audio stream with headers                 │
│                   Headers: X-Duration, X-Email-ID, etc.     │
└─────────────────────────────────────────────────────────────┘
```

### Service Call Sequence

```
generate_summary_speech()
  ├─→ [Get summary text]
  │     ├─→ [If summary_text provided] → Use directly
  │     │
  │     ├─→ [If email_data provided]
  │     │     └─→ AIResponseService.generate_email_summary()
  │     │           ├─→ ChatPromptTemplate
  │     │           ├─→ ChatOpenAI.ainvoke()
  │     │           │     └─→ OpenAI API (GPT-4o-mini)
  │     │           └─→ Returns: summary text
  │     │
  │     └─→ [Else]
  │           ├─→ get_gmail_service()
  │           ├─→ gmail.users().messages().get()
  │           └─→ AIResponseService.generate_email_summary()
  │
  └─→ EmailSummaryTTSService.generate_summary_speech()
        ├─→ Check cache
        ├─→ [If not cached]
        │     ├─→ Initialize TTS model (Hugging Face)
        │     ├─→ Generate audio
        │     └─→ Save to cache
        │
        └─→ Return audio bytes
```

---

## 💾 Save Draft Workflow

### Endpoint: `POST /save-draft`

### Complete Call Flow

```
┌─────────────────────────────────────────────────────────────┐
│                   1. API Request                            │
│                   POST /save-draft                          │
│                   Body: {emailId, responseText, tone?}      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   2. Route Handler                          │
│                   app/api/routes/gmail.py                   │
│                   save_draft()                               │
└─────────────────────────────────────────────────────────────┘
                            │
                            └─→ Depends: get_settings_dep()
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   3. Fetch Original Email                   │
│                   Gmail API                                 │
└─────────────────────────────────────────────────────────────┘
                            │
                            ├─→ get_gmail_service()
                            └─→ gmail.users().messages().get()
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   4. Parse Email                            │
│                   app/services/emails.py                    │
│                   parse_email()                             │
└─────────────────────────────────────────────────────────────┘
                            │
                            ├─→ Extract: from, subject, threadId
                            └─→ Extract email address from "from" field
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   5. Prepare Draft                          │
│                   Format reply                               │
└─────────────────────────────────────────────────────────────┘
                            │
                            ├─→ To: original_email.from
                            ├─→ Subject: "Re: " + original_subject
                            └─→ ThreadId: original_email.threadId
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   6. Create Draft                           │
│                   app/services/gmail.py                     │
│                   create_gmail_draft()                       │
└─────────────────────────────────────────────────────────────┘
                            │
                            ├─→ Format email message
                            ├─→ Base64 encode
                            └─→ gmail.users().drafts().create()
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   7. Response                               │
│                   Returns: {success, draft, metadata}        │
└─────────────────────────────────────────────────────────────┘
```

### Service Call Sequence

```
save_draft()
  ├─→ get_gmail_service()
  │
  ├─→ gmail.users().messages().get(email_id)
  │
  ├─→ email_utils.parse_email(message)
  │
  ├─→ email_utils.extract_email_address(from_header)
  │
  └─→ create_gmail_draft()
        ├─→ Format message
        ├─→ Base64 encode
        └─→ gmail.users().drafts().create()
              └─→ Gmail API
```

---

## 🔗 Service Dependencies Map

### Complete Dependency Graph

```
┌─────────────────────────────────────────────────────────────┐
│                    FastAPI App (main.py)                     │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ API Routes   │    │   Deps       │    │   Services   │
└──────────────┘    └──────────────┘    └──────────────┘
        │                   │                   │
        │                   │                   │
        ├─→ search.py       ├─→ get_embedding   ├─→ EmbeddingService
        │                     service()          │   └─→ LangChain OpenAIEmbeddings
        │                                         │
        ├─→ ai.py            ├─→ get_ai_service()├─→ AIResponseService
        │                     │                 │   └─→ LangChain ChatOpenAI
        │                     │                 │
        ├─→ chains.py        ├─→ get_vector    ├─→ VectorStore
        │                     │   store()        │   └─→ ChromaDB
        │                     │                 │
        ├─→ classification.py├─→ get_class  ├─→ EmailClassificationService
        │                     │   service()     │   └─→ LangChain ChatOpenAI
        │                     │                 │
        ├─→ labels.py         ├─→ get_redis    ├─→ RedisCacheService
        │                     │   cache()       │   └─→ Redis
        │                     │                 │
        ├─→ summary_tts.py    └─→ get_settings ├─→ EmailSummaryTTSService
        │                     │   dep()         │   └─→ Hugging Face TTS
        │                     │                 │
        └─→ gmail.py          └─→ get_gmail    ├─→ GmailService
                              service()        │   └─→ Gmail API
                                               │
                                               └─→ LabelService
                                                     └─→ LangChain ChatOpenAI
```

### Service Initialization Order

1. **Settings** (`get_settings_dep()`)
   - Loads configuration from environment
   - No dependencies

2. **EmbeddingService** (`get_embedding_service()`)
   - Depends on: Settings
   - Initializes: LangChain OpenAIEmbeddings

3. **VectorStore** (`get_vector_store()`)
   - Depends on: Settings
   - Initializes: ChromaDB client

4. **AIResponseService** (`get_ai_service()`)
   - Depends on: Settings
   - Initializes: LangChain ChatOpenAI
   - Initializes: ResponseHistoryService

5. **EmailClassificationService** (`get_classification_service()`)
   - Depends on: Settings
   - Initializes: LangChain ChatOpenAI

6. **RedisCacheService** (`get_redis_cache_service()`)
   - Depends on: Settings
   - Initializes: Redis client

7. **EmailProcessingChains** (created on-demand)
   - Depends on: AIResponseService, EmbeddingService, VectorStore
   - Initializes: LangChain ChatOpenAI

8. **LabelService** (created on-demand)
   - Depends on: Settings
   - Initializes: LangChain ChatOpenAI

9. **EmailSummaryTTSService** (singleton in route)
   - Depends on: Settings
   - Initializes: Hugging Face TTS model

10. **GmailService** (created on-demand)
    - Depends on: Settings
    - Initializes: Gmail API client

---

## 📊 Request/Response Patterns

### Standard Response Format

```json
{
  "success": true|false,
  "data": {...},
  "error": "error message" (if success=false),
  "metadata": {
    "model": "gpt-4o-mini",
    "tokensUsed": 1234,
    "cost": 0.001,
    "processingTimeMs": 500
  }
}
```

### Error Response Format

```json
{
  "success": false,
  "error": "Error message",
  "hint": "Helpful hint for debugging"
}
```

---

## 🔄 Async/Await Patterns

All service methods use async/await for I/O operations:

- **Database operations**: ChromaDB queries
- **API calls**: OpenAI API, Gmail API
- **Cache operations**: Redis get/set
- **File operations**: Reading/writing JSON files

### Example Pattern

```python
async def some_service_method():
    # Async I/O operation
    result = await external_api.call()
    
    # Process result
    processed = process(result)
    
    # Another async operation
    await cache.set(key, processed)
    
    return processed
```

---

## 🎯 Key Takeaways

### Service Call Patterns

1. **Dependency Injection**: All services injected via FastAPI Depends()
2. **Singleton Services**: Services cached using @lru_cache
3. **Async Operations**: All I/O operations are async
4. **Error Handling**: Try/except with JSON error responses
5. **Logging**: Comprehensive logging at each step

### Common Flows

1. **Request → Route → Service → External API → Response**
2. **Cache Check → Process → Cache Update → Response**
3. **Validation → Processing → Storage → Response**

### Service Communication

- **Direct Calls**: Services call each other directly
- **No Message Queue**: Synchronous request/response
- **Shared State**: ChromaDB and Redis as shared state
- **Stateless Services**: Services are stateless (except caching)

---

**Last Updated: January 2025**

*This document provides a complete reference for understanding the workflow and service interactions in the Smart Email Manager application.*

