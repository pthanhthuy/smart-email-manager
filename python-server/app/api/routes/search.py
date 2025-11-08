"""Synchronization and semantic search routes."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse

from app.api.deps import (
    get_embedding_service,
    get_redis_cache_service,
    get_settings_dep,
    get_vector_store,
)
from app.core.config import Settings
from app.core.logging import get_logger
from app.models import EmailSearchRequest, EmailSearchResult
from app.services import emails as email_utils
from app.services.email_classification import EmailClassificationService
from app.services.embeddings import EmbeddingService
from app.services.gmail import get_gmail_service
from app.services.redis_cache import RedisCacheService
from app.services.vector_store import VectorStore

router = APIRouter(prefix="", tags=["search"])
logger = get_logger(__name__)


@router.post("/sync")
async def sync_emails(
    settings: Settings = Depends(get_settings_dep),
    embeddings: EmbeddingService = Depends(get_embedding_service),
    vector_store: VectorStore = Depends(get_vector_store),
) -> dict:
    try:
        gmail = get_gmail_service(settings)
        max_emails = settings.max_emails
        logger.info("Syncing up to %s emails from Gmail", max_emails)
        response = gmail.users().messages().list(
            userId="me",
            maxResults=max_emails,
            q="-category:promotions -category:social",
        ).execute()
        message_refs = response.get("messages", [])
        if not message_refs:
            return {"success": True, "indexed": 0, "message": "No emails to sync"}

        emails: List[Dict[str, Any]] = []
        for message_ref in message_refs:
            detail = gmail.users().messages().get(userId="me", id=message_ref["id"], format="full").execute()
            emails.append(email_utils.parse_email(detail))

        # Classify emails before storing
        classification_service = EmailClassificationService(settings)
        logger.info("Classifying %s emails...", len(emails))
        for email in emails:
            # Only classify if not already classified
            if not email.get("category"):
                try:
                    classification = await classification_service.classify_email(email)
                    email["category"] = classification["category"]
                    email["categoryConfidence"] = classification["confidence"]
                except Exception as e:
                    logger.warning("Failed to classify email %s: %s", email.get("id"), e)
                    # Default to "other" if classification fails
                    email["category"] = "other"
                    email["categoryConfidence"] = 0.0

        emails_with_embeddings = await embeddings.generate_email_embeddings(emails)
        indexed = vector_store.add_emails(emails_with_embeddings)

        # Invalidate cache when new emails are synced
        cache_service = RedisCacheService(settings)
        if settings.redis_enabled:
            invalidated = cache_service.clear_all_cache()
            logger.info("Invalidated %s cache entries after email sync", invalidated)

        return {
            "success": True,
            "indexed": indexed,
            "message": f"Successfully indexed {indexed} emails!",
        }
    except Exception as exc:  # pylint: disable=broad-except
        logger.error("Sync error: %s", exc)
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(exc), "hint": "Check server logs for details"},
        )


@router.post("/search")
async def semantic_search(
    payload: EmailSearchRequest,
    category: Optional[str] = Query(None, description="Filter by category"),
    use_cache_only: Optional[bool] = Query(False, description="Only use cache, don't search ChromaDB"),
    force_refresh: Optional[bool] = Query(False, description="Force fresh search, skip cache check"),
    embeddings: EmbeddingService = Depends(get_embedding_service),
    vector_store: VectorStore = Depends(get_vector_store),
    cache_service: RedisCacheService = Depends(get_redis_cache_service),
    settings: Settings = Depends(get_settings_dep),
) -> dict:
    try:
        # Normalize query for consistent cache key generation
        normalized_query = (payload.query or "").strip()
        
        # If use_cache_only is True, only check cache and return if found
        if use_cache_only and settings.redis_enabled:
            cached_result = cache_service.get_cache(
                query=normalized_query,
                category=category,
                limit=payload.limit,
            )
            if cached_result:
                logger.info(
                    "Cache-only request: Found cached result for query: '%s' (category=%s, limit=%s)",
                    normalized_query[:50] if normalized_query else "all",
                    category,
                    payload.limit,
                )
                cached_result["cached"] = True
                return cached_result
            else:
                # Cache-only mode but no cache found
                logger.warning(
                    "Cache-only request: No cache found for query: '%s' (category=%s, limit=%s)",
                    normalized_query[:50] if normalized_query else "all",
                    category,
                    payload.limit,
                )
                return JSONResponse(
                    status_code=404,
                    content={
                        "success": False,
                        "error": "No cached results found. Please perform a search first.",
                        "cached": False,
                    },
                )
        
        # Check Redis cache first (if enabled and not forcing refresh)
        if settings.redis_enabled and not force_refresh:
            cached_result = cache_service.get_cache(
                query=normalized_query,
                category=category,
                limit=payload.limit,
            )
            if cached_result:
                logger.info(
                    "Cache hit for query: '%s' (category=%s, limit=%s)",
                    normalized_query[:50] if normalized_query else "all",
                    category,
                    payload.limit,
                )
                # Return cached result but mark it as cached
                cached_result["cached"] = True
                return cached_result

        # Cache miss or force refresh - perform fresh search
        logger.info(
            "Performing fresh search for: '%s' (category=%s, limit=%s, force_refresh=%s)",
            normalized_query[:50] if normalized_query else "all",
            category,
            payload.limit,
            force_refresh,
        )

        # When filtering by category (empty query + category), try to use cached results
        # and filter them in-memory instead of querying ChromaDB
        if not normalized_query and category and settings.redis_enabled and not force_refresh:
            # First, check for cached "all emails" result (empty query, no category)
            cached_all_emails = cache_service.get_cache(
                query="",
                category=None,
                limit=payload.limit,
            )
            cache_to_filter = cached_all_emails
            
            # If no "all emails" cache, find the most recent cache entry to filter
            if not cache_to_filter:
                cache_to_filter = cache_service.find_cache_to_filter(category)
                if cache_to_filter:
                    logger.info(
                        "Found cached result from query '%s' to filter by category '%s'",
                        cache_to_filter.get("query", "unknown"),
                        category,
                    )
            
            if cache_to_filter:
                logger.info(
                    "Filtering cached result by category '%s' (in-memory filter)",
                    category,
                )
                # Filter cached results by category in-memory
                filtered_results = [
                    email for email in cache_to_filter.get("results", [])
                    if email.get("category") == category
                ]
                
                # Apply limit if specified
                if payload.limit and len(filtered_results) > payload.limit:
                    filtered_results = filtered_results[:payload.limit]
                
                response_data = {
                    "success": True,
                    "query": cache_to_filter.get("query", "all"),
                    "count": len(filtered_results),
                    "results": filtered_results,
                    "cached": True,
                }
                
                # Cache the filtered result for future use
                cache_service.set_cache(
                    query="",
                    results=filtered_results,
                    category=category,
                    limit=payload.limit,
                )
                logger.info(
                    "Returning %s filtered results from cache (category=%s)",
                    len(filtered_results),
                    category,
                )
                return response_data

        # Clear all cache when performing a new search with a query (not empty query)
        # This ensures that category filters after a search will use fresh data, not stale cache
        if normalized_query and settings.redis_enabled:
            deleted_count = cache_service.invalidate_cache("search:cache:*")
            logger.info(
                "Cleared all cache (%s entries) before performing new search: '%s'",
                deleted_count,
                normalized_query[:50],
            )

        # If no query provided, get all emails (sorted by date)
        if not normalized_query:
            logger.info(
                "Empty query provided, retrieving all emails (category=%s, limit=%s)", category, payload.limit
            )
            results = vector_store.get_all_emails(category=category, limit=payload.limit)
        else:
            # Generate embedding for semantic search
            logger.info(
                "Performing semantic search with query: '%s' (category=%s, limit=%s)",
                normalized_query,
                category,
                payload.limit,
            )
            embedding = await embeddings.generate_embedding(normalized_query)
            # Use default limit of 10 if not specified for search
            search_limit = payload.limit if payload.limit else 10
            results = vector_store.search(embedding, limit=search_limit, category=category)

        formatted: List[EmailSearchResult] = []
        for index, result in enumerate(results):
            metadata = result.get("metadata", {})
            # Get full email body from document field (contains full content)
            document = result.get("document")
            # Extract category and confidence from metadata
            email_category = metadata.get("category") or "other"
            category_confidence = metadata.get("categoryConfidence")
            # Convert confidence string back to float if present
            if category_confidence:
                if isinstance(category_confidence, str):
                    try:
                        category_confidence = float(category_confidence)
                    except (ValueError, TypeError):
                        category_confidence = 0.5
                else:
                    category_confidence = float(category_confidence)
            else:
                category_confidence = 0.5  # Default confidence if not set

            formatted.append(
                EmailSearchResult(
                    rank=index + 1,
                    id=result.get("id"),
                    subject=metadata.get("subject"),
                    from_=metadata.get("from"),
                    date=metadata.get("date"),
                    snippet=metadata.get("snippet"),
                    body=document,  # Full email content from ChromaDB document field
                    similarity=int(result.get("similarity", 0) * 100) if result.get("similarity") else None,
                    distance=result.get("distance"),
                    threadId=metadata.get("threadId"),
                    category=email_category,
                    categoryConfidence=category_confidence,
                    labels=metadata.get("labels"),  # Include labels from metadata
                )
            )

        # Prepare response
        query_display = normalized_query if normalized_query else "all"
        results_dict = [item.dict(by_alias=True) for item in formatted]
        
        response_data = {
            "success": True,
            "query": query_display,
            "count": len(formatted),
            "results": results_dict,
            "cached": False,
        }

        # Always update cache with fresh results (if Redis is enabled)
        # This ensures cache is updated every time a search is performed
        # Use normalized_query to ensure cache key matches what we checked
        if settings.redis_enabled:
            cache_updated = cache_service.set_cache(
                query=normalized_query,
                results=results_dict,
                category=category,
                limit=payload.limit,
            )
            if cache_updated:
                logger.info("Cache updated with %s results for query: '%s'", len(formatted), query_display)
            else:
                logger.warning("Failed to update cache for query: '%s'", query_display)

        logger.info("Returning %s results for query: %s", len(formatted), query_display)
        return response_data
    except Exception as exc:  # pylint: disable=broad-except
        logger.error("Search error: %s", exc)
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(exc), "hint": "Make sure you have run /sync first to index emails"},
        )


@router.post("/cache/clear")
async def clear_cache(
    settings: Settings = Depends(get_settings_dep),
    cache_service: RedisCacheService = Depends(get_redis_cache_service),
) -> dict:
    """Clear all search caches."""
    try:
        if not settings.redis_enabled:
            return {
                "success": False,
                "message": "Redis caching is disabled",
            }
        deleted = cache_service.clear_all_cache()
        return {
            "success": True,
            "message": f"Cleared cache (deleted entries: {deleted})",
            "deletedEntries": deleted,
        }
    except Exception as exc:
        logger.error("Cache clear error: %s", exc)
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(exc)},
        )


@router.get("/cache/stats")
async def get_cache_stats(
    settings: Settings = Depends(get_settings_dep),
    cache_service: RedisCacheService = Depends(get_redis_cache_service),
) -> dict:
    """Get cache statistics."""
    try:
        stats = cache_service.get_cache_stats()
        return {
            "success": True,
            "stats": stats,
        }
    except Exception as exc:
        logger.error("Cache stats error: %s", exc)
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(exc)},
        )
