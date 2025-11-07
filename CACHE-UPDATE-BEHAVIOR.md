# Cache Update Behavior

## ✅ Updated Behavior

The Redis cache now works as follows:

### 1. **Always Update on Search**
- Every search performs a **fresh search** (no stale cached data)
- Cache is **automatically updated** with the latest search results
- All search results are saved to Redis

### 2. **All Records Saved**
- **All results** from each search are saved in the cache
- Results are stored as a JSON array in the `results` field
- Each cached entry contains the complete search result set

### 3. **Multiple Queries Supported**
- Each unique query+category+limit combination gets its own cache entry
- Different searches are cached separately
- Example cache keys:
  - `search:cache:abc123:work:10` - for "test query" with category=work, limit=10
  - `search:cache:def456:personal:20` - for "another query" with category=personal, limit=20

### 4. **Cache Updates on Refresh**
- When you search the same query again, it:
  1. Performs a fresh search
  2. Updates the cache with new results
  3. Preserves metadata (updateCount, cachedAt, etc.)

## Example Flow

```
Search 1: "test query"
  → Performs search
  → Finds 5 results
  → Saves all 5 results to cache
  → Returns 5 results

Search 2: "test query" (same query)
  → Performs fresh search (may find different/new results)
  → Finds 7 results (maybe new emails arrived)
  → Updates cache with 7 new results
  → Returns 7 results

Page Refresh + Search 3: "test query"
  → Performs fresh search
  → Finds 8 results
  → Updates cache with 8 results
  → Returns 8 results
```

## Cache Data Structure

Each cached entry contains:

```json
{
  "query": "test query",
  "queryHash": "abc123...",
  "category": "work",
  "limit": 10,
  "results": [
    {
      "id": "email1",
      "subject": "Email 1",
      "from": "sender@example.com",
      "body": "...",
      ...
    },
    {
      "id": "email2",
      "subject": "Email 2",
      ...
    }
    // ... ALL results are here
  ],
  "count": 10,  // Total number of results
  "cachedAt": "2025-11-07T15:00:00Z",
  "updatedAt": "2025-11-07T15:05:00Z",  // Last update time
  "updateCount": 3,  // How many times this query was searched
  "expiresAt": "2025-11-07T16:00:00Z"
}
```

## Benefits

1. **Always Fresh Data**: Every search gets the latest results
2. **Complete History**: All search results are saved in cache
3. **Fast Retrieval**: Can quickly see what was searched before
4. **Analytics**: Track how many times queries are searched
5. **No Stale Data**: Cache is updated on every search

## Testing

You can test the cache behavior:

```bash
# Search 1
curl -X POST http://localhost:3000/search \
  -H "Content-Type: application/json" \
  -d '{"query": "test", "limit": 10}'

# Search 2 (same query - will update cache)
curl -X POST http://localhost:3000/search \
  -H "Content-Type: application/json" \
  -d '{"query": "test", "limit": 10}'

# Check cache stats
curl http://localhost:3000/cache/stats

# View all cached queries
docker exec smart-email-manager-redis redis-cli KEYS "search:cache:*"
```

## Summary

✅ **All search results are saved** - Every result from every search is cached
✅ **Cache updates on every search** - Fresh data, no stale results
✅ **Multiple queries supported** - Each query gets its own cache entry
✅ **Page refresh works** - New searches update the cache with latest data

