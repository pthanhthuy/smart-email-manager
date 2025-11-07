# Phase 1 Testing Guide

## Overview
This guide helps you test the Phase 1 backend changes that enable getting all emails instead of limiting to 10 results.

## Changes Made

1. **VectorStore.get_all_emails()** - New method to retrieve all emails from ChromaDB
2. **EmailSearchRequest model** - Updated to allow empty query and optional limit
3. **Search endpoint** - Updated to handle empty query (returns all emails)

## Testing the API

### Prerequisites
1. Make sure the Python server is running
2. Ensure you have synced some emails (run `/sync` endpoint first)

### Test 1: Get All Emails (Empty Query)

**Request:**
```bash
curl -X POST "http://localhost:3000/search" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "",
    "limit": null
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "query": "all",
  "count": <number_of_emails>,
  "results": [
    {
      "rank": 1,
      "id": "...",
      "subject": "...",
      "from": "...",
      "date": "...",
      "snippet": "...",
      "body": "...",
      "category": "...",
      "categoryConfidence": 0.8
    },
    ...
  ]
}
```

**What to verify:**
- ✅ Returns all emails (not just 10)
- ✅ Emails are sorted by date (most recent first)
- ✅ All email fields are present
- ✅ Query field shows "all" in response

### Test 2: Get All Emails with Limit

**Request:**
```bash
curl -X POST "http://localhost:3000/search" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "",
    "limit": 5
  }'
```

**Expected Response:**
- Should return only 5 emails
- Still sorted by date (most recent first)

### Test 3: Get All Emails with Category Filter

**Request:**
```bash
curl -X POST "http://localhost:3000/search?category=work" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "",
    "limit": null
  }'
```

**Expected Response:**
- Should return only emails with category "work"
- All emails, not limited to 10

### Test 4: Semantic Search Still Works (Backward Compatibility)

**Request:**
```bash
curl -X POST "http://localhost:3000/search" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "meeting",
    "limit": 10
  }'
```

**Expected Response:**
- Should perform semantic search
- Returns up to 10 results (or limit specified)
- Results sorted by similarity

### Test 5: Search with Custom Limit

**Request:**
```bash
curl -X POST "http://localhost:3000/search" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "meeting",
    "limit": 20
  }'
```

**Expected Response:**
- Should return up to 20 search results
- Semantic search still works

## Using Postman

1. **Create a new POST request**
   - URL: `http://localhost:3000/search`
   - Method: POST
   - Headers: `Content-Type: application/json`

2. **Body (raw JSON):**
   ```json
   {
     "query": "",
     "limit": null
   }
   ```

3. **Send request** and verify response

## Using Python

```python
import requests

# Test 1: Get all emails
response = requests.post(
    "http://localhost:3000/search",
    json={"query": "", "limit": None}
)
data = response.json()
print(f"Total emails: {data['count']}")
print(f"Query: {data['query']}")

# Test 2: Get all with limit
response = requests.post(
    "http://localhost:3000/search",
    json={"query": "", "limit": 5}
)
data = response.json()
print(f"Limited emails: {data['count']}")  # Should be 5

# Test 3: Category filter
response = requests.post(
    "http://localhost:3000/search?category=work",
    json={"query": "", "limit": None}
)
data = response.json()
print(f"Work emails: {data['count']}")

# Test 4: Semantic search (backward compatible)
response = requests.post(
    "http://localhost:3000/search",
    json={"query": "meeting", "limit": 10}
)
data = response.json()
print(f"Search results: {data['count']}")
```

## Verification Checklist

- [ ] Empty query returns all emails
- [ ] Limit parameter works correctly
- [ ] Category filter works with empty query
- [ ] Semantic search still works (backward compatible)
- [ ] Emails are sorted by date (most recent first)
- [ ] Response format is consistent
- [ ] No errors in server logs
- [ ] Performance is acceptable with many emails

## Troubleshooting

### Issue: Returns empty results
**Solution:** Make sure you've run `/sync` to index emails first

### Issue: Still returns only 10 emails
**Solution:** Check that you're sending `"limit": null` (not `"limit": 10`)

### Issue: Emails not sorted by date
**Solution:** Check server logs for date parsing issues. Dates should be in ISO format.

### Issue: Category filter not working
**Solution:** Verify emails have categories assigned (check with `/sync`)

## Next Steps

After Phase 1 is verified:
- Proceed to Phase 2: Frontend - Email List (Gmail-like UI)
- Update frontend to call API with empty query on page load
- Implement Gmail-like single row email display

