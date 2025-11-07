#!/usr/bin/env python3
"""Test script to verify Redis caching functionality."""

import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from app.services.redis_cache import RedisCacheService
from app.core.config import get_settings

def test_redis_connection():
    """Test Redis connection."""
    print("=" * 60)
    print("Testing Redis Connection")
    print("=" * 60)
    
    settings = get_settings()
    print(f"Redis Host: {settings.redis_host}")
    print(f"Redis Port: {settings.redis_port}")
    print(f"Redis Enabled: {settings.redis_enabled}")
    print()
    
    cache_service = RedisCacheService(settings)
    
    if cache_service.redis_client:
        try:
            # Test ping
            result = cache_service.redis_client.ping()
            print(f"✅ Redis connection successful! Ping: {result}")
            return True
        except Exception as e:
            print(f"❌ Redis connection failed: {e}")
            return False
    else:
        print("❌ Redis client is None (not connected)")
        return False

def test_cache_operations():
    """Test cache set and get operations."""
    print("\n" + "=" * 60)
    print("Testing Cache Operations")
    print("=" * 60)
    
    settings = get_settings()
    cache_service = RedisCacheService(settings)
    
    if not cache_service.redis_client:
        print("❌ Cannot test - Redis not connected")
        return False
    
    # Test data
    test_query = "test query for caching"
    test_results = [
        {"id": "test1", "subject": "Test Email 1", "from": "test@example.com"},
        {"id": "test2", "subject": "Test Email 2", "from": "test2@example.com"},
    ]
    
    print(f"Test Query: '{test_query}'")
    print(f"Test Results Count: {len(test_results)}")
    print()
    
    # Test set cache
    print("1. Testing SET cache...")
    set_result = cache_service.set_cache(
        query=test_query,
        results=test_results,
        category="work",
        limit=10
    )
    if set_result:
        print("   ✅ Cache SET successful")
    else:
        print("   ❌ Cache SET failed")
        return False
    
    # Test get cache
    print("2. Testing GET cache...")
    cached_result = cache_service.get_cache(
        query=test_query,
        category="work",
        limit=10
    )
    
    if cached_result:
        print("   ✅ Cache GET successful")
        print(f"   Cached Query: {cached_result.get('query')}")
        print(f"   Cached Count: {cached_result.get('count')}")
        print(f"   Cache Hit Count: {cached_result.get('hitCount', 0)}")
        print(f"   Results Match: {cached_result.get('results') == test_results}")
        return True
    else:
        print("   ❌ Cache GET failed - no cached data found")
        return False

def test_cache_keys():
    """Test listing cache keys."""
    print("\n" + "=" * 60)
    print("Testing Cache Keys")
    print("=" * 60)
    
    settings = get_settings()
    cache_service = RedisCacheService(settings)
    
    if not cache_service.redis_client:
        print("❌ Cannot test - Redis not connected")
        return False
    
    try:
        keys = cache_service.redis_client.keys("search:cache:*")
        print(f"Found {len(keys)} cache keys:")
        for key in keys[:10]:  # Show first 10 keys
            print(f"  - {key}")
        if len(keys) > 10:
            print(f"  ... and {len(keys) - 10} more")
        return True
    except Exception as e:
        print(f"❌ Error listing keys: {e}")
        return False

def test_cache_stats():
    """Test cache statistics."""
    print("\n" + "=" * 60)
    print("Testing Cache Statistics")
    print("=" * 60)
    
    settings = get_settings()
    cache_service = RedisCacheService(settings)
    
    stats = cache_service.get_cache_stats()
    print(f"Connected: {stats.get('connected')}")
    print(f"Enabled: {stats.get('enabled')}")
    print(f"Total Cached Queries: {stats.get('totalCachedQueries', 0)}")
    print(f"Total Cache Hits: {stats.get('totalCacheHits', 0)}")
    
    if stats.get('redisInfo'):
        redis_info = stats['redisInfo']
        print(f"\nRedis Info:")
        print(f"  Memory Used: {redis_info.get('used_memory_human', 'N/A')}")
        print(f"  Connected Clients: {redis_info.get('connected_clients', 'N/A')}")
        print(f"  Keyspace Hits: {redis_info.get('keyspace_hits', 'N/A')}")
        print(f"  Keyspace Misses: {redis_info.get('keyspace_misses', 'N/A')}")

def main():
    """Run all tests."""
    print("\n" + "🔍 Redis Cache Testing Script" + "\n")
    
    # Test connection
    connection_ok = test_redis_connection()
    if not connection_ok:
        print("\n❌ Redis connection failed. Please check:")
        print("   1. Redis is running: docker-compose up -d")
        print("   2. Redis configuration in .env file")
        print("   3. REDIS_ENABLED=true in settings")
        return
    
    # Test cache operations
    cache_ok = test_cache_operations()
    if not cache_ok:
        print("\n❌ Cache operations failed")
        return
    
    # Test cache keys
    test_cache_keys()
    
    # Test cache stats
    test_cache_stats()
    
    print("\n" + "=" * 60)
    print("✅ All tests completed!")
    print("=" * 60)

if __name__ == "__main__":
    main()

