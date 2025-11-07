# Redis Setup Guide

This guide explains how to set up Redis for the Smart Email Manager's search result caching feature.

## Quick Start with Docker

The easiest way to run Redis is using Docker Compose:

```bash
# Start Redis
docker-compose up -d

# Check Redis is running
docker-compose ps

# View Redis logs
docker-compose logs -f redis

# Stop Redis
docker-compose down

# Stop Redis and remove data
docker-compose down -v
```

## Manual Docker Setup

If you prefer to run Redis manually with Docker:

```bash
# Run Redis container
docker run -d \
  --name smart-email-manager-redis \
  -p 6379:6379 \
  -v redis-data:/data \
  redis:7-alpine \
  redis-server --appendonly yes

# Check if Redis is running
docker ps | grep redis

# Test Redis connection
docker exec -it smart-email-manager-redis redis-cli ping
# Should return: PONG
```

## Configuration

Redis configuration is managed through environment variables. Create or update your `.env` file:

```env
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
REDIS_PASSWORD=          # Optional, leave empty for local development
REDIS_CACHE_TTL=3600     # Cache TTL in seconds (default: 1 hour)
REDIS_ENABLED=true        # Set to false to disable caching
```

### Default Settings

- **Host**: `localhost`
- **Port**: `6379`
- **Database**: `0`
- **Password**: None (for local development)
- **Cache TTL**: `3600` seconds (1 hour)
- **Enabled**: `true`

## Testing Redis Connection

### Using Python

```python
import redis

r = redis.Redis(host='localhost', port=6379, db=0)
print(r.ping())  # Should print: True
```

### Using Redis CLI

```bash
# If using Docker
docker exec -it smart-email-manager-redis redis-cli

# Or if Redis is installed locally
redis-cli

# Then in Redis CLI:
PING
# Should return: PONG

# Check keys
KEYS search:cache:*

# Get cache stats
INFO stats
```

## Cache Management

### Clear Cache via API

```bash
# Clear all search caches
curl -X POST http://localhost:3000/cache/clear

# Get cache statistics
curl http://localhost:3000/cache/stats
```

### Clear Cache via Redis CLI

```bash
# Connect to Redis
docker exec -it smart-email-manager-redis redis-cli

# Clear all search caches
KEYS search:cache:*
# Then delete each key or use:
FLUSHDB  # WARNING: This clears ALL data in the current database
```

## Cache Behavior

### Cache Key Format

Cache keys follow this pattern:
```
search:cache:{query_hash}:{category}:{limit}
```

Example:
```
search:cache:a1b2c3d4:work:10
```

### Cache Invalidation

The cache is automatically invalidated when:
- New emails are synced (`/sync` endpoint)
- Cache TTL expires (default: 1 hour)
- Manual cache clear (`/cache/clear` endpoint)

### Cache Statistics

The cache tracks:
- Total cached queries
- Total cache hits
- Hit count per cached query
- Last access time

## Troubleshooting

### Redis Connection Failed

1. **Check if Redis is running:**
   ```bash
   docker ps | grep redis
   ```

2. **Check Redis logs:**
   ```bash
   docker-compose logs redis
   ```

3. **Verify connection settings:**
   - Ensure `REDIS_HOST` matches your Redis host
   - Ensure `REDIS_PORT` matches your Redis port
   - Check firewall settings if using remote Redis

### Cache Not Working

1. **Check if Redis is enabled:**
   ```bash
   # In your .env file
   REDIS_ENABLED=true
   ```

2. **Check server logs:**
   - Look for "Connected to Redis cache" message
   - Look for "Failed to connect to Redis" warnings

3. **Test Redis connection:**
   ```bash
   docker exec -it smart-email-manager-redis redis-cli ping
   ```

### Performance Issues

1. **Monitor Redis memory usage:**
   ```bash
   docker exec -it smart-email-manager-redis redis-cli INFO memory
   ```

2. **Check cache hit rate:**
   ```bash
   curl http://localhost:3000/cache/stats
   ```

3. **Adjust cache TTL:**
   - Lower TTL for more frequent updates
   - Higher TTL for better performance

## Production Considerations

### Security

1. **Set a password:**
   ```env
   REDIS_PASSWORD=your-secure-password
   ```

2. **Use Redis AUTH:**
   - Update docker-compose.yml to include password
   - Or use Redis ACLs for fine-grained access control

3. **Network isolation:**
   - Don't expose Redis port publicly
   - Use Docker networks for internal communication

### Persistence

The Docker Compose setup includes:
- **AOF (Append Only File)**: Enabled for data persistence
- **Volume**: `redis-data` volume for data storage

### High Availability

For production, consider:
- Redis Sentinel for high availability
- Redis Cluster for horizontal scaling
- Redis Cloud or AWS ElastiCache for managed Redis

## Disabling Redis

If you want to disable Redis caching:

```env
REDIS_ENABLED=false
```

The application will continue to work normally, but search results won't be cached.

## Additional Resources

- [Redis Documentation](https://redis.io/docs/)
- [Redis Docker Hub](https://hub.docker.com/_/redis)
- [Redis Commands](https://redis.io/commands/)

