"""
Redis cache service for search result caching.

Provides caching functionality to improve search performance by storing
frequently accessed search results in Redis.
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timedelta
from typing import Any, Dict, Optional

import redis

from app.core.config import Settings, get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class RedisCacheService:
    """Service for managing Redis cache for search results."""

    def __init__(self, settings: Settings | None = None) -> None:
        """Initialize Redis cache service."""
        self.settings = settings or get_settings()
        self.redis_client = None
        self._connect()

    def _connect(self) -> None:
        """Connect to Redis server."""
        if not self.settings.redis_enabled:
            logger.info("Redis caching is disabled")
            return

        try:
            connection_params = {
                "host": self.settings.redis_host,
                "port": self.settings.redis_port,
                "db": self.settings.redis_db,
                "decode_responses": True,
                "socket_connect_timeout": 5,
                "socket_timeout": 5,
            }

            # Only add password if it's actually set (not None, not empty, and not a comment)
            password = self.settings.redis_password
            if password and password.strip() and not password.strip().startswith("#"):
                connection_params["password"] = password.strip()

            self.redis_client = redis.Redis(**connection_params)
            # Test connection
            self.redis_client.ping()
            logger.info(
                "Connected to Redis cache at %s:%s",
                self.settings.redis_host,
                self.settings.redis_port,
            )
        except Exception as e:
            logger.warning("Failed to connect to Redis: %s. Caching will be disabled.", e)
            self.redis_client = None

    def _generate_cache_key(
        self, query: str, category: Optional[str] = None, limit: Optional[int] = None
    ) -> str:
        """Generate cache key for search query."""
        # Normalize query
        normalized_query = query.lower().strip()
        query_hash = hashlib.sha256(normalized_query.encode()).hexdigest()[:16]

        category_part = category or "all"
        limit_part = str(limit) if limit else "default"

        return f"search:cache:{query_hash}:{category_part}:{limit_part}"

    def get_cache(
        self, query: str, category: Optional[str] = None, limit: Optional[int] = None
    ) -> Optional[Dict[str, Any]]:
        """Get cached search result."""
        if not self.redis_client or not self.settings.redis_enabled:
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
                    cache_key, self.settings.redis_cache_ttl, json.dumps(result)
                )
                logger.debug("Cache hit for query: %s", query[:50])
                return result
        except Exception as e:
            logger.warning("Error getting cache: %s", e)

        return None

    def set_cache(
        self,
        query: str,
        results: list,
        category: Optional[str] = None,
        limit: Optional[int] = None,
    ) -> bool:
        """Cache search results. Updates existing cache if present, preserving hitCount."""
        if not self.redis_client or not self.settings.redis_enabled:
            return False

        try:
            cache_key = self._generate_cache_key(query, category, limit)
            normalized_query = query.lower().strip()
            query_hash = hashlib.sha256(normalized_query.encode()).hexdigest()[:16]

            # Check if cache already exists to preserve hitCount
            existing_hit_count = 0
            existing_cached_at = None
            try:
                existing_data = self.redis_client.get(cache_key)
                if existing_data:
                    existing_cache = json.loads(existing_data)
                    existing_hit_count = existing_cache.get("hitCount", 0)
                    existing_cached_at = existing_cache.get("cachedAt")
            except Exception:
                pass  # If we can't read existing cache, start fresh

            cache_value = {
                "query": query,
                "queryHash": query_hash,
                "category": category or "all",
                "limit": limit,
                "results": results,  # All results are saved here
                "count": len(results),
                "cachedAt": existing_cached_at or datetime.utcnow().isoformat(),
                "updatedAt": datetime.utcnow().isoformat(),  # Track when cache was last updated
                "expiresAt": (datetime.utcnow() + timedelta(seconds=self.settings.redis_cache_ttl)).isoformat(),
                "hitCount": existing_hit_count,  # Preserve hit count
                "updateCount": existing_hit_count + 1,  # Track how many times this query was searched
            }

            self.redis_client.setex(
                cache_key, self.settings.redis_cache_ttl, json.dumps(cache_value)
            )
            logger.debug("Cache updated with %s results for query: %s", len(results), query[:50])
            return True
        except Exception as e:
            logger.warning("Error setting cache: %s", e)
            return False

    def invalidate_cache(self, pattern: str = "search:cache:*") -> int:
        """Invalidate cache keys matching pattern."""
        if not self.redis_client or not self.settings.redis_enabled:
            return 0

        try:
            keys = self.redis_client.keys(pattern)
            if keys:
                deleted = self.redis_client.delete(*keys)
                logger.info("Invalidated %s cache entries", deleted)
                return deleted
            return 0
        except Exception as e:
            logger.warning("Error invalidating cache: %s", e)
            return 0

    def clear_all_cache(self) -> bool:
        """Clear all search caches."""
        deleted = self.invalidate_cache("search:cache:*")
        return deleted >= 0

    def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        if not self.redis_client or not self.settings.redis_enabled:
            return {"connected": False, "enabled": False, "error": "Redis not enabled or connected"}

        try:
            keys = self.redis_client.keys("search:cache:*")
            total_keys = len(keys)

            # Calculate total hit count
            total_hits = 0
            for key in keys:
                try:
                    data = json.loads(self.redis_client.get(key))
                    total_hits += data.get("hitCount", 0)
                except Exception:
                    pass

            redis_info = self.redis_client.info()
            return {
                "connected": True,
                "enabled": True,
                "totalCachedQueries": total_keys,
                "totalCacheHits": total_hits,
                "redisInfo": {
                    "used_memory_human": redis_info.get("used_memory_human"),
                    "connected_clients": redis_info.get("connected_clients"),
                    "keyspace_hits": redis_info.get("keyspace_hits"),
                    "keyspace_misses": redis_info.get("keyspace_misses"),
                },
            }
        except Exception as e:
            logger.warning("Error getting cache stats: %s", e)
            return {"connected": True, "enabled": True, "error": str(e)}

