# Cache Middleware

**File:** `mw/cache/index.js`

**Order:** 19 (after Traffic middleware)

The Cache middleware provides response caching for GET APIs with per-API TTL configuration.

## Purpose

- Caches GET API responses to reduce backend load
- Supports per-API TTL configuration
- Provides cache hit/miss headers for debugging
- Supports memory and MongoDB storage backends

## Flow

```
  Incoming Request
       │
       ▼
  ┌─────────────────────────┐
  │  Check Method           │ GET request?
  └────────┬────────────────┘
           │
           ├─── Not GET ──▶ next()
           │
           ▼
  ┌─────────────────────────┐
  │  Check Configuration    │ Service enabled? API matches?
  └────────┬────────────────┘
           │
           ├─── Not configured ──▶ next()
           │
           ▼
  ┌─────────────────────────┐
  │  Generate Cache Key     │ tenant:service:path:queryHash
  └────────┬────────────────┘
           │
           ▼
  ┌─────────────────────────┐
  │  Lookup Cache           │
  └────────┬────────────────┘
           │
           ├─── HIT ──▶ Return cached response (X-Cache: HIT)
           │
           └─── MISS ──▶ Execute → Cache response → Return (X-Cache: MISS)
```

## Configuration

**Path:** `registry.custom.gateway.value.cache`

```javascript
{
  "cache": {
    "model": "memory",                    // Storage: "memory" or "mongo"
    "defaultTTL": 300000,                 // Default TTL: 5 minutes
    "av": {                               // Service name
      "enabled": true,                    // Enable caching for this service
      "apis": {
        "GET /av/calls": {
          "enabled": true,
          "ttl": 30000                    // 30 seconds
        },
        "GET /av/call/:id": {
          "enabled": true,
          "ttl": 60000                    // 60 seconds
        },
        "GET /av/users": {
          "enabled": true
          // Uses defaultTTL (300000ms)
        }
      }
    },
    "catalog": {
      "enabled": true,
      "apis": {
        "GET /catalog/products": {
          "enabled": true,
          "ttl": 600000                   // 10 minutes
        },
        "GET /catalog/categories": {
          "enabled": true,
          "ttl": 3600000                  // 1 hour
        }
      }
    }
  }
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `model` | string | `"memory"` | Storage backend: `"memory"` or `"mongo"` |
| `defaultTTL` | number | `300000` | Default cache TTL in milliseconds (5 min) |
| `[service].enabled` | boolean | `false` | Enable caching for this service |
| `[service].apis` | object | `{}` | API-specific cache configuration |
| `[service].apis[api].enabled` | boolean | `false` | Enable caching for this API |
| `[service].apis[api].ttl` | number | `defaultTTL` | Cache TTL for this API |

## API Pattern Matching

APIs are matched using `GET /path` format with support for path parameters:

```javascript
"apis": {
  "GET /users": { ... },                  // Exact match
  "GET /users/:id": { ... },              // :id matches any segment
  "GET /users/:userId/posts/:postId": { ... }  // Multiple params
}
```

## Cache Key Structure

```javascript
{
  "l1": "tenant_id",
  "l2": "serviceName:GET:/path:queryHash"
}
```

- **tenant_id**: Isolates cache per tenant
- **serviceName**: The target service name
- **path**: The API path
- **queryHash**: MD5 hash of sorted query parameters

### Query Parameter Handling

Query parameters are included in the cache key via MD5 hash:

```
GET /users?page=1&limit=10  → key includes hash of {"limit":"10","page":"1"}
GET /users?limit=10&page=1  → same hash (sorted)
GET /users                  → different key (no query hash)
```

## Storage Backends

### Memory (Default)

- Fast, in-process storage
- Lost on restart
- Good for single-instance deployments
- Automatic cleanup of expired entries

### MongoDB

- Persistent storage
- Shared across instances
- Required for multi-instance deployments
- Uses TTL index for automatic expiration

## Response Headers

| Header | Description |
|--------|-------------|
| `X-Cache` | `HIT` or `MISS` indicating cache status |
| `X-Cache-Age` | Seconds since response was cached (on HIT) |

### Cache HIT

```http
HTTP/1.1 200 OK
X-Cache: HIT
X-Cache-Age: 15
Content-Type: application/json

{"data": [...]}
```

### Cache MISS

```http
HTTP/1.1 200 OK
X-Cache: MISS
Content-Type: application/json

{"data": [...]}
```

## Caching Behavior

### What Gets Cached

- Only successful responses (HTTP 2xx)
- Response status code
- Response headers
- Response body

### What Doesn't Get Cached

- Non-GET requests
- Error responses (4xx, 5xx)
- APIs not configured for caching

## Usage Notes

- Only GET requests are cached
- Cache is tenant-isolated
- Query parameters affect cache key
- Only 2xx responses are cached
- Headers like `X-Cache` are not stored in cache
- MongoDB backend required for horizontal scaling
- Consider TTL based on data freshness requirements

## Example Scenarios

### Static Data (Long TTL)

```javascript
"GET /catalog/categories": {
  "enabled": true,
  "ttl": 3600000  // 1 hour - categories rarely change
}
```

### Dynamic Data (Short TTL)

```javascript
"GET /av/calls": {
  "enabled": true,
  "ttl": 5000     // 5 seconds - frequently updated
}
```

### User-Specific Data

```javascript
// Cache key includes tenant ID, so each tenant has separate cache
"GET /users/profile": {
  "enabled": true,
  "ttl": 60000    // 1 minute
}
```
