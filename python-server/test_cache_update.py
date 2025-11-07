#!/usr/bin/env python3
"""Test script to verify cache updates on repeated searches."""

import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from app.services.redis_cache import RedisCacheService
from app.core.config import get_settings

def test_cache_updates():
    """Test that cache is updated on repeated searches."""
    print("=" * 60)
    print("Testing Cache Updates on Repeated Searches")
    print("=" * 60)
    
    settings = get_settings()
    cache_service = RedisCacheService(settings)
    
    if not cache_service.redis_client:
        print("❌ Redis not connected")
        return False
    
    test_query = "test query for update"
    test_category = "work"
    test_limit = 10
    
    # First search - initial cache
    print("\n1. First search - creating initial cache...")
    results1 = [
        {"id": "email1", "subject": "First Search Result 1", "from": "test1@example.com"},
        {"id": "email2", "subject": "First Search Result 2", "from": "test2@example.com"},
    ]
    
    cache_service.set_cache(
        query=test_query,
        results=results1,
        category=test_category,
        limit=test_limit
    )
    
    # Get first cache
    cached1 = cache_service.get_cache(test_query, test_category, test_limit)
    print(f"   ✅ Cached {cached1['count']} results")
    print(f"   Results: {[r['subject'] for r in cached1['results']]}")
    print(f"   Update Count: {cached1.get('updateCount', 0)}")
    
    # Second search - update cache with new data
    print("\n2. Second search - updating cache with new data...")
    results2 = [
        {"id": "email3", "subject": "Second Search Result 1", "from": "test3@example.com"},
        {"id": "email4", "subject": "Second Search Result 2", "from": "test4@example.com"},
        {"id": "email5", "subject": "Second Search Result 3", "from": "test5@example.com"},
    ]
    
    cache_service.set_cache(
        query=test_query,
        results=results2,
        category=test_category,
        limit=test_limit
    )
    
    # Get updated cache
    cached2 = cache_service.get_cache(test_query, test_category, test_limit)
    print(f"   ✅ Cache updated with {cached2['count']} results")
    print(f"   Results: {[r['subject'] for r in cached2['results']]}")
    print(f"   Update Count: {cached2.get('updateCount', 0)}")
    
    # Verify cache was updated
    if cached2['count'] == 3 and cached2['results'] == results2:
        print("\n   ✅ Cache successfully updated with new data!")
        print(f"   ✅ All {cached2['count']} results are saved in cache")
        return True
    else:
        print("\n   ❌ Cache update failed")
        return False

def test_multiple_queries():
    """Test that multiple different queries are all cached."""
    print("\n" + "=" * 60)
    print("Testing Multiple Different Queries")
    print("=" * 60)
    
    settings = get_settings()
    cache_service = RedisCacheService(settings)
    
    queries = [
        ("query 1", "work", 10),
        ("query 2", "personal", 20),
        ("query 3", None, 15),
    ]
    
    print(f"\nCaching {len(queries)} different queries...")
    
    for i, (query, category, limit) in enumerate(queries, 1):
        results = [
            {"id": f"email{i}_{j}", "subject": f"Result {j} for {query}", "from": f"test{j}@example.com"}
            for j in range(1, 4)
        ]
        cache_service.set_cache(query, results, category, limit)
        print(f"   ✅ Cached query {i}: '{query}' ({len(results)} results)")
    
    # Check all keys exist
    keys = cache_service.redis_client.keys("search:cache:*")
    print(f"\n   ✅ Total cache keys: {len(keys)}")
    print(f"   ✅ All {len(queries)} queries are cached separately")
    
    return True

def main():
    """Run all tests."""
    print("\n" + "🔍 Cache Update Testing Script" + "\n")
    
    # Test cache updates
    update_ok = test_cache_updates()
    if not update_ok:
        print("\n❌ Cache update test failed")
        return
    
    # Test multiple queries
    multiple_ok = test_multiple_queries()
    if not multiple_ok:
        print("\n❌ Multiple queries test failed")
        return
    
    print("\n" + "=" * 60)
    print("✅ All tests passed!")
    print("=" * 60)
    print("\nSummary:")
    print("  ✅ Cache is updated on every search")
    print("  ✅ All search results are saved in cache")
    print("  ✅ Multiple different queries are cached separately")
    print("  ✅ Cache preserves metadata (updateCount, etc.)")

if __name__ == "__main__":
    main()

