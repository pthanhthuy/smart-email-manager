# Redis Caching and Dynamic Email Labeling Story

## 📋 Problem Statement

Currently, the Smart Email Manager has two key limitations:

1. **No Search Result Caching**: Every search query requires a full vector search operation, which can be slow and expensive, especially for repeated queries. Users often search for similar terms multiple times, and the system doesn't leverage previous search results.

2. **Static Email Labeling**: The system currently uses predefined categories (work, personal, promotion, etc.) and Gmail labels, but users cannot:
   - Create custom labels based on their own criteria
   - Dynamically label emails using natural language prompts
   - Automatically apply new labels to existing emails in ChromaDB when labels are created

This limits the system's flexibility and personalization capabilities.

## 🎯 Goal

Implement two complementary features:

### Feature 1: Redis Search Result Caching
1. Cache search results in Redis to improve performance for repeated queries
2. Update cached results when new searches are performed with similar queries
3. Implement intelligent cache invalidation strategies
4. Support cache warming for common queries

### Feature 2: Dynamic Email Labeling System
1. Allow users to define custom labels using natural language prompts
2. Automatically classify and label emails based on user-defined criteria
3. When a new label is created, automatically update all relevant emails in ChromaDB
4. Support label management (create, update, delete labels)
5. Enable label-based filtering and search

## 🏗️ Architecture Overview

```
┌─────────────────┐
│   User Search   │
│   /search       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────┐
│  Cache Check    │─────►│    Redis     │
│  (Redis)        │      │   Cache      │
└────────┬────────┘      └──────────────┘
         │
         │ Cache Miss
         ▼
┌─────────────────┐
│  Vector Search  │
│  (ChromaDB)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────┐
│  Cache Results  │─────►│    Redis     │
│  (Update)       │      │   Cache      │
└─────────────────┘      └──────────────┘

┌─────────────────┐
│  Create Label   │
│  /labels        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  AI Classification│
│  (Based on Prompt)│
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────┐
│  Update ChromaDB │─────►│   ChromaDB   │
│  (Bulk Update)   │      │  (Metadata)  │
└─────────────────┘      └──────────────┘
```

## 📊 Feature 1: Redis Search Result Caching

### Design Decisions

#### Cache Key Strategy
- **Format**: `search:cache:{query_hash}:{category}:{limit}`
- **Query Hash**: SHA256 hash of normalized query string (lowercase, trimmed)
- **Category**: Category filter value or "all" if no filter
- **Limit**: Result limit value
- **Example**: `search:cache:a1b2c3d4:work:10`

#### Cache Value Structure
```json
{
  "query": "original query text",
  "queryHash": "a1b2c3d4...",
  "category": "work",
  "limit": 10,
  "results": [...],
  "count": 5,
  "cachedAt": "2025-01-20T10:30:00Z",
  "expiresAt": "2025-01-20T11:30:00Z",
  "hitCount": 1
}
```

#### Cache Update Strategy
- **On Search**: Always update cache with latest results
- **On Cache Hit**: Increment hit count, update access time
- **TTL**: Default 1 hour, configurable
- **Cache Warming**: Pre-cache common queries on startup

#### Cache Invalidation
- **Time-based**: TTL expiration (default 1 hour)
- **Event-based**: 
  - When new emails are synced
  - When emails are deleted
  - When category classifications change
- **Manual**: Admin endpoint to clear cache

### Implementation Components

#### 1. Redis Service

**File**: `python-server/app/services/redis_cache.py`

**Purpose**: Redis connection and cache management

**Key Methods**:
- `get_cache(key: str) -> Optional[dict]`: Get cached search result
- `set_cache(key: str, value: dict, ttl: int) -> bool`: Cache search result
- `invalidate_cache(pattern: str) -> int`: Invalidate matching cache keys
- `clear_all_cache() -> bool`: Clear all search caches
- `get_cache_stats() -> dict`: Get cache statistics

**Implementation**:
```python
import hashlib
import json
from typing import Optional, Dict, Any
import redis
from datetime import datetime, timedelta
from app.core.config import Settings, get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)

class RedisCacheService:
    def __init__(self, settings: Settings | None = None):
        self.settings = settings or get_settings()
        self.redis_client = None
        self._connect()
    
    def _connect(self):
        """Connect to Redis server."""
        try:
            self.redis_client = redis.Redis(
                host=self.settings.redis_host,
                port=self.settings.redis_port,
                db=self.settings.redis_db,
                password=self.settings.redis_password,
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5
            )
            # Test connection
            self.redis_client.ping()
            logger.info("Connected to Redis cache")
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            self.redis_client = None
    
    def _generate_cache_key(self, query: str, category: Optional[str] = None, limit: Optional[int] = None) -> str:
        """Generate cache key for search query."""
        # Normalize query
        normalized_query = query.lower().strip()
        query_hash = hashlib.sha256(normalized_query.encode()).hexdigest()[:16]
        
        category_part = category or "all"
        limit_part = str(limit) if limit else "default"
        
        return f"search:cache:{query_hash}:{category_part}:{limit_part}"
    
    def get_cache(self, query: str, category: Optional[str] = None, limit: Optional[int] = None) -> Optional[Dict[str, Any]]:
        """Get cached search result."""
        if not self.redis_client:
            return None
        
        try:
            cache_key = self._generate_cache_key(query, category, limit)
            cached_data = self.redis_client.get(cache_key)
            
            if cached_data:
                result = json.loads(cached_data)
                # Update hit count and access time
                result["hitCount"] = result.get("hitCount", 0) + 1
                result["lastAccessed"] = datetime.utcnow().isoformat()
                # Save updated stats
                self.redis_client.setex(
                    cache_key,
                    self.settings.redis_cache_ttl,
                    json.dumps(result)
                )
                logger.debug(f"Cache hit for query: {query[:50]}")
                return result
        except Exception as e:
            logger.warning(f"Error getting cache: {e}")
        
        return None
    
    def set_cache(self, query: str, results: list, category: Optional[str] = None, limit: Optional[int] = None) -> bool:
        """Cache search results."""
        if not self.redis_client:
            return False
        
        try:
            cache_key = self._generate_cache_key(query, category, limit)
            normalized_query = query.lower().strip()
            query_hash = hashlib.sha256(normalized_query.encode()).hexdigest()[:16]
            
            cache_value = {
                "query": query,
                "queryHash": query_hash,
                "category": category or "all",
                "limit": limit,
                "results": results,
                "count": len(results),
                "cachedAt": datetime.utcnow().isoformat(),
                "expiresAt": (datetime.utcnow() + timedelta(seconds=self.settings.redis_cache_ttl)).isoformat(),
                "hitCount": 0
            }
            
            self.redis_client.setex(
                cache_key,
                self.settings.redis_cache_ttl,
                json.dumps(cache_value)
            )
            logger.debug(f"Cached search results for query: {query[:50]}")
            return True
        except Exception as e:
            logger.warning(f"Error setting cache: {e}")
            return False
    
    def invalidate_cache(self, pattern: str = "search:cache:*") -> int:
        """Invalidate cache keys matching pattern."""
        if not self.redis_client:
            return 0
        
        try:
            keys = self.redis_client.keys(pattern)
            if keys:
                deleted = self.redis_client.delete(*keys)
                logger.info(f"Invalidated {deleted} cache entries")
                return deleted
            return 0
        except Exception as e:
            logger.warning(f"Error invalidating cache: {e}")
            return 0
    
    def clear_all_cache(self) -> bool:
        """Clear all search caches."""
        return self.invalidate_cache("search:cache:*") >= 0
    
    def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        if not self.redis_client:
            return {"connected": False, "error": "Redis not connected"}
        
        try:
            keys = self.redis_client.keys("search:cache:*")
            total_keys = len(keys)
            
            # Calculate total hit count
            total_hits = 0
            for key in keys:
                try:
                    data = json.loads(self.redis_client.get(key))
                    total_hits += data.get("hitCount", 0)
                except:
                    pass
            
            return {
                "connected": True,
                "totalCachedQueries": total_keys,
                "totalCacheHits": total_hits,
                "redisInfo": self.redis_client.info()
            }
        except Exception as e:
            logger.warning(f"Error getting cache stats: {e}")
            return {"connected": True, "error": str(e)}
```

#### 2. Configuration Updates

**File**: `python-server/app/core/config.py`

**Add Redis settings**:
```python
# Redis Configuration
redis_host: str = Field(default="localhost", alias="REDIS_HOST")
redis_port: int = Field(default=6379, alias="REDIS_PORT")
redis_db: int = Field(default=0, alias="REDIS_DB")
redis_password: Optional[str] = Field(default=None, alias="REDIS_PASSWORD")
redis_cache_ttl: int = Field(default=3600, alias="REDIS_CACHE_TTL")  # 1 hour in seconds
redis_enabled: bool = Field(default=True, alias="REDIS_ENABLED")
```

#### 3. Search Route Updates

**File**: `python-server/app/api/routes/search.py`

**Update semantic_search endpoint**:
```python
from app.services.redis_cache import RedisCacheService

@router.post("/search")
async def semantic_search(
    payload: EmailSearchRequest,
    category: Optional[str] = Query(None, description="Filter by category"),
    embeddings: EmbeddingService = Depends(get_embedding_service),
    vector_store: VectorStore = Depends(get_vector_store),
    settings: Settings = Depends(get_settings_dep),
) -> dict:
    try:
        # Initialize Redis cache service
        cache_service = RedisCacheService(settings)
        
        # Check cache first (if Redis is enabled)
        if settings.redis_enabled:
            cached_result = cache_service.get_cache(
                query=payload.query,
                category=category,
                limit=payload.limit
            )
            if cached_result:
                logger.info(f"Cache hit for query: {payload.query[:50]}")
                return {
                    "success": True,
                    "query": cached_result["query"],
                    "count": cached_result["count"],
                    "results": cached_result["results"],
                    "cached": True,
                    "cacheHitCount": cached_result.get("hitCount", 0)
                }
        
        # Cache miss - perform actual search
        logger.info(f"Cache miss - performing search for: {payload.query[:50]}")
        
        # ... existing search logic ...
        
        # Format results
        formatted: List[EmailSearchResult] = []
        for index, result in enumerate(results):
            # ... existing formatting logic ...
            formatted.append(...)
        
        # Prepare response
        query_display = payload.query if payload.query.strip() else "all"
        response_data = {
            "success": True,
            "query": query_display,
            "count": len(formatted),
            "results": [item.dict(by_alias=True) for item in formatted],
            "cached": False
        }
        
        # Cache results (if Redis is enabled)
        if settings.redis_enabled:
            cache_service.set_cache(
                query=payload.query,
                results=response_data["results"],
                category=category,
                limit=payload.limit
            )
        
        logger.info("Returning %s results for query: %s", len(formatted), query_display)
        return response_data
        
    except Exception as exc:
        logger.error("Search error: %s", exc)
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(exc), "hint": "Make sure you have run /sync first to index emails"},
        )
```

**Add cache management endpoints**:
```python
@router.post("/cache/clear")
async def clear_cache(
    settings: Settings = Depends(get_settings_dep)
) -> dict:
    """Clear all search caches."""
    try:
        cache_service = RedisCacheService(settings)
        deleted = cache_service.clear_all_cache()
        return {
            "success": True,
            "message": f"Cleared {deleted} cache entries"
        }
    except Exception as exc:
        logger.error("Cache clear error: %s", exc)
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(exc)}
        )

@router.get("/cache/stats")
async def get_cache_stats(
    settings: Settings = Depends(get_settings_dep)
) -> dict:
    """Get cache statistics."""
    try:
        cache_service = RedisCacheService(settings)
        stats = cache_service.get_cache_stats()
        return {
            "success": True,
            "stats": stats
        }
    except Exception as exc:
        logger.error("Cache stats error: %s", exc)
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(exc)}
        )
```

## 📊 Feature 2: Dynamic Email Labeling System

### Design Decisions

#### Label Storage
- **ChromaDB Metadata**: Store labels in email metadata as comma-separated list
- **Label Definition Store**: Store label definitions in ChromaDB or separate JSON file
- **Label Metadata**: Each label has:
  - `id`: Unique identifier
  - `name`: Label name
  - `description`: User-provided description/prompt
  - `prompt`: AI prompt for classification
  - `createdAt`: Creation timestamp
  - `emailCount`: Number of emails with this label
  - `color`: Optional color for UI display

#### Label Definition Format
```json
{
  "id": "label_123",
  "name": "Urgent Client Requests",
  "description": "Emails from clients that require immediate attention",
  "prompt": "Emails from clients with urgent keywords like 'urgent', 'asap', 'deadline', or 'critical'",
  "createdAt": "2025-01-20T10:30:00Z",
  "emailCount": 15,
  "color": "#ef4444"
}
```

#### Label Application Strategy
1. **On Label Creation**: 
   - Use AI to classify all existing emails in ChromaDB
   - Update metadata for matching emails
   - Batch update for performance

2. **On Email Sync**: 
   - Check all active labels against new emails
   - Apply matching labels automatically

3. **Manual Application**: 
   - Allow users to manually add/remove labels from emails

### Implementation Components

#### 1. Label Service

**File**: `python-server/app/services/label_service.py`

**Purpose**: Manage labels and apply them to emails

**Key Methods**:
- `create_label(name: str, description: str, prompt: str) -> dict`: Create new label
- `get_all_labels() -> List[dict]`: Get all labels
- `get_label(label_id: str) -> Optional[dict]`: Get specific label
- `update_label(label_id: str, updates: dict) -> dict`: Update label
- `delete_label(label_id: str) -> bool`: Delete label
- `apply_label_to_emails(label_id: str, email_ids: List[str]) -> int`: Manually apply label
- `remove_label_from_emails(label_id: str, email_ids: List[str]) -> int`: Remove label
- `auto_apply_label(label_id: str) -> int`: Auto-apply label to all matching emails

**Implementation**:
```python
import json
import uuid
from typing import List, Dict, Any, Optional
from datetime import datetime
from pathlib import Path
from app.core.config import Settings, get_settings
from app.core.logging import get_logger
from app.services.email_classification import EmailClassificationService
from app.services.vector_store import VectorStore
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI

logger = get_logger(__name__)

class LabelService:
    def __init__(self, settings: Settings | None = None):
        self.settings = settings or get_settings()
        self.labels_file = Path(self.settings.labels_storage_path)
        self.labels_file.parent.mkdir(parents=True, exist_ok=True)
        self.classification_service = EmailClassificationService(settings)
        self.llm = ChatOpenAI(
            model=self.settings.openai_model,
            temperature=0.3,
            openai_api_key=self.settings.openai_api_key,
            base_url=self.settings.openai_base_url,
        )
        self._load_labels()
    
    def _load_labels(self):
        """Load labels from storage."""
        if self.labels_file.exists():
            try:
                with open(self.labels_file, 'r') as f:
                    self.labels = json.load(f)
            except Exception as e:
                logger.error(f"Error loading labels: {e}")
                self.labels = {}
        else:
            self.labels = {}
    
    def _save_labels(self):
        """Save labels to storage."""
        try:
            with open(self.labels_file, 'w') as f:
                json.dump(self.labels, f, indent=2)
        except Exception as e:
            logger.error(f"Error saving labels: {e}")
    
    async def create_label(self, name: str, description: str, prompt: str, color: Optional[str] = None) -> Dict[str, Any]:
        """Create a new label definition."""
        label_id = f"label_{uuid.uuid4().hex[:12]}"
        
        label = {
            "id": label_id,
            "name": name,
            "description": description,
            "prompt": prompt,
            "createdAt": datetime.utcnow().isoformat(),
            "emailCount": 0,
            "color": color or "#6b7280"
        }
        
        self.labels[label_id] = label
        self._save_labels()
        
        # Auto-apply label to existing emails
        logger.info(f"Auto-applying new label '{name}' to existing emails...")
        email_count = await self.auto_apply_label(label_id)
        label["emailCount"] = email_count
        
        logger.info(f"Created label '{name}' and applied to {email_count} emails")
        return label
    
    def get_all_labels(self) -> List[Dict[str, Any]]:
        """Get all labels."""
        return list(self.labels.values())
    
    def get_label(self, label_id: str) -> Optional[Dict[str, Any]]:
        """Get specific label."""
        return self.labels.get(label_id)
    
    def update_label(self, label_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        """Update label definition."""
        if label_id not in self.labels:
            raise ValueError(f"Label {label_id} not found")
        
        # Update allowed fields
        allowed_fields = ["name", "description", "prompt", "color"]
        for field in allowed_fields:
            if field in updates:
                self.labels[label_id][field] = updates[field]
        
        self.labels[label_id]["updatedAt"] = datetime.utcnow().isoformat()
        self._save_labels()
        
        # Re-apply label if prompt changed
        if "prompt" in updates:
            logger.info(f"Re-applying label '{label_id}' due to prompt change...")
            # This would trigger auto-apply in background
        
        return self.labels[label_id]
    
    def delete_label(self, label_id: str) -> bool:
        """Delete label and remove from all emails."""
        if label_id not in self.labels:
            return False
        
        # Remove label from all emails in ChromaDB
        # This would require updating vector_store to support label removal
        # For now, we'll just delete the label definition
        
        del self.labels[label_id]
        self._save_labels()
        logger.info(f"Deleted label {label_id}")
        return True
    
    async def _email_matches_label(self, email: Dict[str, Any], label: Dict[str, Any]) -> bool:
        """Check if email matches label criteria using AI."""
        prompt_template = ChatPromptTemplate.from_messages([
            ("system", """You are an email classification assistant. Determine if an email matches the given label criteria.

Label Description: {label_description}
Label Criteria: {label_prompt}

Return only "YES" if the email matches the criteria, or "NO" if it doesn't."""),
            ("human", """Email:
From: {from_field}
Subject: {subject}
Body: {body}

Does this email match the label criteria? Answer YES or NO only.""")
        ])
        
        from_field = email.get("from", "Unknown")
        subject = email.get("subject", "No subject")
        body = (email.get("body") or email.get("snippet") or "")[:1000]
        
        try:
            chain = prompt_template | self.llm
            response = await chain.ainvoke({
                "label_description": label["description"],
                "label_prompt": label["prompt"],
                "from_field": from_field,
                "subject": subject,
                "body": body
            })
            
            response_text = response.content if hasattr(response, "content") else str(response)
            return response_text.strip().upper() == "YES"
        except Exception as e:
            logger.warning(f"Error checking label match: {e}")
            return False
    
    async def auto_apply_label(self, label_id: str, vector_store: Optional[VectorStore] = None) -> int:
        """Automatically apply label to all matching emails in ChromaDB."""
        if label_id not in self.labels:
            raise ValueError(f"Label {label_id} not found")
        
        label = self.labels[label_id]
        
        if not vector_store:
            from app.api.deps import get_vector_store
            vector_store = get_vector_store()
        
        # Get all emails from ChromaDB
        all_emails = vector_store.get_all_emails(limit=None)
        logger.info(f"Checking {len(all_emails)} emails against label '{label['name']}'...")
        
        matching_emails = []
        for email_data in all_emails:
            email_id = email_data.get("id")
            metadata = email_data.get("metadata", {})
            
            # Check if email already has this label
            existing_labels = metadata.get("labels", "").split(",")
            if label_id in existing_labels:
                continue
            
            # Check if email matches label criteria
            email_dict = {
                "id": email_id,
                "from": metadata.get("from"),
                "subject": metadata.get("subject"),
                "body": email_data.get("document"),
                "snippet": metadata.get("snippet")
            }
            
            if await self._email_matches_label(email_dict, label):
                matching_emails.append(email_id)
        
        # Update emails in ChromaDB with new label
        if matching_emails:
            updated_count = await self._update_emails_with_label(vector_store, matching_emails, label_id)
            label["emailCount"] = updated_count
            self._save_labels()
            logger.info(f"Applied label '{label['name']}' to {updated_count} emails")
            return updated_count
        
        return 0
    
    async def _update_emails_with_label(self, vector_store: VectorStore, email_ids: List[str], label_id: str) -> int:
        """Update emails in ChromaDB with new label."""
        collection = vector_store.get_collection()
        updated_count = 0
        
        for email_id in email_ids:
            try:
                # Get current email data
                result = collection.get(ids=[email_id], include=["metadatas"])
                if not result.get("ids"):
                    continue
                
                metadata = result["metadatas"][0]
                existing_labels = metadata.get("labels", "").split(",")
                existing_labels = [l.strip() for l in existing_labels if l.strip()]
                
                # Add new label if not already present
                if label_id not in existing_labels:
                    existing_labels.append(label_id)
                    metadata["labels"] = ",".join(existing_labels)
                    
                    # Update in ChromaDB
                    collection.update(
                        ids=[email_id],
                        metadatas=[metadata]
                    )
                    updated_count += 1
            except Exception as e:
                logger.warning(f"Error updating email {email_id} with label: {e}")
        
        return updated_count
    
    def apply_label_to_emails(self, label_id: str, email_ids: List[str], vector_store: VectorStore) -> int:
        """Manually apply label to specific emails."""
        if label_id not in self.labels:
            raise ValueError(f"Label {label_id} not found")
        
        # Update emails in ChromaDB
        updated_count = self._update_emails_with_label(vector_store, email_ids, label_id)
        
        # Update label count
        self.labels[label_id]["emailCount"] = updated_count
        self._save_labels()
        
        return updated_count
    
    def remove_label_from_emails(self, label_id: str, email_ids: List[str], vector_store: VectorStore) -> int:
        """Remove label from specific emails."""
        collection = vector_store.get_collection()
        removed_count = 0
        
        for email_id in email_ids:
            try:
                result = collection.get(ids=[email_id], include=["metadatas"])
                if not result.get("ids"):
                    continue
                
                metadata = result["metadatas"][0]
                existing_labels = metadata.get("labels", "").split(",")
                existing_labels = [l.strip() for l in existing_labels if l.strip()]
                
                # Remove label
                if label_id in existing_labels:
                    existing_labels.remove(label_id)
                    metadata["labels"] = ",".join(existing_labels)
                    
                    # Update in ChromaDB
                    collection.update(
                        ids=[email_id],
                        metadatas=[metadata]
                    )
                    removed_count += 1
            except Exception as e:
                logger.warning(f"Error removing label from email {email_id}: {e}")
        
        # Update label count
        if label_id in self.labels:
            self.labels[label_id]["emailCount"] = max(0, self.labels[label_id]["emailCount"] - removed_count)
            self._save_labels()
        
        return removed_count
```

#### 2. Label Models

**File**: `python-server/app/models/emails.py`

**Add label models**:
```python
class LabelCreateRequest(BaseModel):
    name: str = Field(..., description="Label name")
    description: str = Field(..., description="Label description")
    prompt: str = Field(..., description="Natural language prompt describing which emails should have this label")
    color: Optional[str] = Field(None, description="Optional color for UI display (hex code)")

class LabelUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    prompt: Optional[str] = None
    color: Optional[str] = None

class LabelResponse(BaseModel):
    id: str
    name: str
    description: str
    prompt: str
    createdAt: str
    emailCount: int
    color: Optional[str] = None

class ApplyLabelRequest(BaseModel):
    labelId: str
    emailIds: List[str]

class RemoveLabelRequest(BaseModel):
    labelId: str
    emailIds: List[str]
```

#### 3. Label API Routes

**File**: `python-server/app/api/routes/labels.py`

**Implementation**:
```python
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from app.api.deps import get_settings_dep, get_vector_store
from app.core.config import Settings
from app.core.logging import get_logger
from app.models import (
    LabelCreateRequest,
    LabelUpdateRequest,
    LabelResponse,
    ApplyLabelRequest,
    RemoveLabelRequest
)
from app.services.label_service import LabelService
from app.services.vector_store import VectorStore

router = APIRouter(prefix="", tags=["labels"])
logger = get_logger(__name__)

@router.post("/labels", response_model=LabelResponse)
async def create_label(
    payload: LabelCreateRequest,
    settings: Settings = Depends(get_settings_dep),
    vector_store: VectorStore = Depends(get_vector_store),
) -> dict:
    """Create a new label and auto-apply to matching emails."""
    try:
        label_service = LabelService(settings)
        label = await label_service.create_label(
            name=payload.name,
            description=payload.description,
            prompt=payload.prompt,
            color=payload.color
        )
        return {
            "success": True,
            "label": label
        }
    except Exception as exc:
        logger.error("Label creation error: %s", exc)
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(exc)}
        )

@router.get("/labels")
async def get_all_labels(
    settings: Settings = Depends(get_settings_dep)
) -> dict:
    """Get all labels."""
    try:
        label_service = LabelService(settings)
        labels = label_service.get_all_labels()
        return {
            "success": True,
            "count": len(labels),
            "labels": labels
        }
    except Exception as exc:
        logger.error("Get labels error: %s", exc)
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(exc)}
        )

@router.get("/labels/{label_id}")
async def get_label(
    label_id: str,
    settings: Settings = Depends(get_settings_dep)
) -> dict:
    """Get specific label."""
    try:
        label_service = LabelService(settings)
        label = label_service.get_label(label_id)
        if not label:
            raise HTTPException(status_code=404, detail="Label not found")
        return {
            "success": True,
            "label": label
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Get label error: %s", exc)
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(exc)}
        )

@router.put("/labels/{label_id}")
async def update_label(
    label_id: str,
    payload: LabelUpdateRequest,
    settings: Settings = Depends(get_settings_dep)
) -> dict:
    """Update label definition."""
    try:
        label_service = LabelService(settings)
        updates = payload.dict(exclude_unset=True)
        label = label_service.update_label(label_id, updates)
        return {
            "success": True,
            "label": label
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as exc:
        logger.error("Update label error: %s", exc)
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(exc)}
        )

@router.delete("/labels/{label_id}")
async def delete_label(
    label_id: str,
    settings: Settings = Depends(get_settings_dep)
) -> dict:
    """Delete label."""
    try:
        label_service = LabelService(settings)
        success = label_service.delete_label(label_id)
        if not success:
            raise HTTPException(status_code=404, detail="Label not found")
        return {
            "success": True,
            "message": "Label deleted"
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Delete label error: %s", exc)
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(exc)}
        )

@router.post("/labels/{label_id}/apply")
async def auto_apply_label(
    label_id: str,
    settings: Settings = Depends(get_settings_dep),
    vector_store: VectorStore = Depends(get_vector_store),
) -> dict:
    """Manually trigger auto-apply of label to all matching emails."""
    try:
        label_service = LabelService(settings)
        count = await label_service.auto_apply_label(label_id, vector_store)
        return {
            "success": True,
            "message": f"Label applied to {count} emails",
            "emailCount": count
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as exc:
        logger.error("Auto-apply label error: %s", exc)
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(exc)}
        )

@router.post("/labels/apply")
async def apply_label_to_emails(
    payload: ApplyLabelRequest,
    settings: Settings = Depends(get_settings_dep),
    vector_store: VectorStore = Depends(get_vector_store),
) -> dict:
    """Manually apply label to specific emails."""
    try:
        label_service = LabelService(settings)
        count = label_service.apply_label_to_emails(
            payload.labelId,
            payload.emailIds,
            vector_store
        )
        return {
            "success": True,
            "message": f"Label applied to {count} emails",
            "emailCount": count
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as exc:
        logger.error("Apply label error: %s", exc)
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(exc)}
        )

@router.post("/labels/remove")
async def remove_label_from_emails(
    payload: RemoveLabelRequest,
    settings: Settings = Depends(get_settings_dep),
    vector_store: VectorStore = Depends(get_vector_store),
) -> dict:
    """Remove label from specific emails."""
    try:
        label_service = LabelService(settings)
        count = label_service.remove_label_from_emails(
            payload.labelId,
            payload.emailIds,
            vector_store
        )
        return {
            "success": True,
            "message": f"Label removed from {count} emails",
            "emailCount": count
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as exc:
        logger.error("Remove label error: %s", exc)
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(exc)}
        )
```

#### 4. Configuration Updates

**File**: `python-server/app/core/config.py`

**Add label storage path**:
```python
labels_storage_path: Path = Field(
    default_factory=lambda: PYTHON_SERVER_DIR / "server" / "labels.json",
    alias="LABELS_STORAGE_PATH",
)
```

#### 5. Update Dependencies

**File**: `python-server/requirements.txt`

**Add Redis dependency**:
```
redis>=5.0.0
```

#### 6. Update Main App

**File**: `python-server/app/main.py`

**Register label routes**:
```python
from app.api.routes import labels

app.include_router(labels.router)
```

## 📝 Implementation Steps

### Phase 1: Redis Caching (Feature 1)

1. **Install Redis and Python Client**
   - Install Redis server (local or cloud)
   - Add `redis` to requirements.txt
   - Update configuration with Redis settings

2. **Create Redis Cache Service**
   - Implement `RedisCacheService` class
   - Add cache key generation logic
   - Implement get/set/invalidate methods

3. **Update Search Route**
   - Integrate cache check before search
   - Cache results after search
   - Add cache statistics endpoint

4. **Add Cache Management**
   - Implement cache invalidation on email sync
   - Add manual cache clear endpoint
   - Add cache statistics endpoint

5. **Testing**
   - Test cache hit/miss scenarios
   - Test cache expiration
   - Test cache invalidation

### Phase 2: Dynamic Labeling (Feature 2)

1. **Create Label Service**
   - Implement label storage (JSON file)
   - Add label CRUD operations
   - Implement AI-based label matching

2. **Create Label API Routes**
   - Implement label creation endpoint
   - Add label management endpoints
   - Add label application endpoints

3. **Update Vector Store**
   - Ensure label support in metadata
   - Add methods for bulk label updates

4. **Integrate with Email Sync**
   - Auto-apply labels to new emails during sync
   - Update label counts

5. **Frontend Integration** (Future)
   - Add label creation UI
   - Display labels on emails
   - Add label filtering

## ✅ Acceptance Criteria

### Feature 1: Redis Caching

- [ ] Redis connection works correctly
- [ ] Search results are cached with appropriate keys
- [ ] Cache hits return results faster than direct search
- [ ] Cache is updated on new searches
- [ ] Cache statistics endpoint works
- [ ] Cache can be manually cleared
- [ ] Cache invalidates on email sync
- [ ] Cache TTL works correctly
- [ ] System gracefully handles Redis unavailability

### Feature 2: Dynamic Labeling

- [ ] Users can create labels with name, description, and prompt
- [ ] Labels are stored persistently
- [ ] New labels are automatically applied to matching emails
- [ ] Label matching uses AI to evaluate emails
- [ ] ChromaDB metadata is updated with labels
- [ ] Users can manually apply/remove labels
- [ ] Label counts are accurate
- [ ] Labels can be updated and deleted
- [ ] Label updates trigger re-application if prompt changes
- [ ] System handles large numbers of emails efficiently

## 🚀 Future Enhancements

1. **Label Suggestions**: AI suggests labels based on email patterns
2. **Label Templates**: Pre-defined label templates for common use cases
3. **Label Analytics**: Show label distribution and trends
4. **Label Rules**: Rule-based label matching for simple cases (before AI)
5. **Label Groups**: Organize labels into groups/categories
6. **Label Sharing**: Share label definitions between users
7. **Cache Analytics**: Detailed cache performance metrics
8. **Cache Warming**: Pre-cache common queries
9. **Distributed Caching**: Support Redis cluster for scalability

## 📊 Success Metrics

### Feature 1: Redis Caching
- **Performance**: 80%+ cache hit rate for repeated queries
- **Speed**: Cache hits return results in <50ms
- **Efficiency**: Reduce vector search operations by 60%+

### Feature 2: Dynamic Labeling
- **Accuracy**: 85%+ correct label application
- **Performance**: Label application completes in <5 minutes for 1000 emails
- **Usability**: Users can create and manage labels easily

## 🔗 Related Files

- `python-server/app/services/redis_cache.py` - NEW: Redis cache service
- `python-server/app/services/label_service.py` - NEW: Label management service
- `python-server/app/api/routes/labels.py` - NEW: Label API routes
- `python-server/app/models/emails.py` - Update: Add label models
- `python-server/app/api/routes/search.py` - Update: Add caching
- `python-server/app/core/config.py` - Update: Add Redis and label settings
- `python-server/app/services/vector_store.py` - Update: Ensure label support
- `python-server/requirements.txt` - Update: Add redis dependency

## 📅 Estimated Effort

### Feature 1: Redis Caching
- **Redis Service**: 3-4 hours
  - Service implementation: 2 hours
  - Testing: 1-2 hours
- **Search Integration**: 2-3 hours
  - Cache integration: 1-2 hours
  - Testing: 1 hour
- **Cache Management**: 1-2 hours
  - Endpoints: 1 hour
  - Testing: 1 hour

**Total Feature 1**: 6-9 hours

### Feature 2: Dynamic Labeling
- **Label Service**: 6-8 hours
  - Core service: 3-4 hours
  - AI integration: 2-3 hours
  - Testing: 1 hour
- **API Routes**: 3-4 hours
  - Endpoint implementation: 2-3 hours
  - Testing: 1 hour
- **Vector Store Integration**: 2-3 hours
  - Metadata updates: 1-2 hours
  - Testing: 1 hour
- **Email Sync Integration**: 1-2 hours

**Total Feature 2**: 12-17 hours

**Combined Total**: 18-26 hours

## 🎯 Priority

**High Priority** - Both features significantly improve system performance and user experience:
- Caching reduces server load and improves response times
- Dynamic labeling provides powerful personalization capabilities

---

## 📝 Notes

- Redis can be run locally or use a cloud service (Redis Cloud, AWS ElastiCache)
- Label storage uses JSON file for simplicity; can be migrated to database later
- Label application can be slow for large email sets; consider background jobs
- Cache invalidation strategy should balance freshness with performance
- Consider rate limiting for label creation to prevent abuse

