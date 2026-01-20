# Traffic Middleware

**File:** `mw/traffic/index.js`

**Order:** 16

The Traffic middleware implements rate limiting (throttling) with configurable strategies and storage backends.

## Purpose

- Enforces rate limiting per tenant/IP
- Supports configurable throttling strategies
- Provides memory and MongoDB storage backends
- Returns rate limit headers in responses

## Flow

```
  Incoming Request
       │
       ▼
  ┌─────────────────────────┐
  │  Check Prerequisites    │ registry, tenant, controller exist?
  └────────┬────────────────┘
           │
           ├─── Missing ──▶ next()
           │
           ▼
  ┌─────────────────────────┐
  │  Determine Strategy     │ publicAPIStrategy or privateAPIStrategy
  └────────┬────────────────┘
           │
           ├─── No strategy ──▶ next()
           │
           ▼
  ┌─────────────────────────┐
  │  Get Throttling Config  │ Priority:
  │                         │ 1. servicesConfig.gateway.throttling
  │                         │ 2. custom.gateway.value.traffic.throttling
  │                         │ 3. serviceConfig.throttling
  └────────┬────────────────┘
           │
           ▼
  ┌─────────────────────────┐
  │  Check Throttling       │ Get/increment counter
  │  Counter                │ Compare to limit
  └────────┬────────────────┘
           │
           ├─── Under limit ──▶ next()
           │
           ├─── Over limit, retries left ──▶ Delay and retry
           │
           └─── Over limit, no retries ──▶ 429 Too Many Requests
```

## Configuration

### Strategy Definition

Located in `registry.serviceConfig.throttling`:

```javascript
{
  "throttling": {
    "publicAPIStrategy": "default",      // For unauthenticated requests
    "privateAPIStrategy": "heavy",       // For authenticated requests
    "default": {
      "status": 1,                       // 0=Off, 1=On
      "type": 1,                         // 0=tenant, 1=tenant+IP
      "window": 60000,                   // Time window in ms
      "limit": 50,                       // Max requests per window
      "retries": 2,                      // Retries when over limit
      "delay": 1000                      // Delay between retries (ms)
    },
    "heavy": {
      "status": 1,
      "type": 1,
      "window": 60000,
      "limit": 500,
      "retries": 2,
      "delay": 1000
    },
    "strict": {
      "status": 1,
      "type": 1,
      "window": 60000,
      "limit": 10,
      "retries": 0,
      "delay": 0
    }
  }
}
```

### Service-Specific Override

Via custom registry or tenant config:

```javascript
{
  "throttling": {
    "oauth": {
      "publicAPIStrategy": "strict",
      "apis": ["/token"]                 // Only these APIs
    },
    "payment": {
      "publicAPIStrategy": "strict",
      "privateAPIStrategy": "heavy",
      "apis": ["/charge", "/refund"]
    }
  }
}
```

## Strategy Selection

| Request Type | Strategy Used |
|--------------|---------------|
| Public API (no auth) | `publicAPIStrategy` |
| Private API (authenticated) | `privateAPIStrategy` |

Determined by: `req.soajs.controller.serviceParams.isAPIPublic`

## Storage Backends

### Memory (Default)

- Fast, in-process storage
- Lost on restart
- Good for single-instance deployments

### MongoDB

- Persistent storage
- Shared across instances
- Required for multi-instance deployments

Configure via `registry.custom.gateway.value.traffic.model`:

```javascript
{
  "traffic": {
    "model": "mongo"                     // or "memory"
  }
}
```

## Rate Limit Response

When rate limit exceeded:

```
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
Retry-After: 45
X-RateLimit-Limit: 50
X-RateLimit-Remaining: 0

{
  "result": false,
  "errors": { ... }
}
```

## Response Headers

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Maximum requests allowed |
| `X-RateLimit-Remaining` | Requests remaining in window |
| `Retry-After` | Seconds until window resets |

## Throttle Key Structure

```javascript
{
  "l1": "tenant_id",
  "l2": "client_ip"
}
```

Creates unique tracking per tenant per IP.

## Usage Notes

- Throttling disabled if no strategy configured
- Service-specific config overrides global config
- APIs array allows targeting specific endpoints
- Retries add delay before rejection
- MongoDB model required for horizontal scaling
