# Idempotency Middleware

**File:** `mw/idempotency/index.js`

**Order:** 17 (after MT middleware)

The Idempotency middleware prevents duplicate write operations by tracking requests via `Idempotency-Key` headers.

## Purpose

- Prevents duplicate side effects from retried requests
- Stores and replays responses for completed requests
- Returns 409 Conflict for in-flight duplicate requests
- Supports memory and MongoDB storage backends

## Flow

```
  Incoming Request
       │
       ▼
  ┌─────────────────────────┐
  │  Check Idempotency-Key  │ Header present?
  └────────┬────────────────┘
           │
           ├─── Missing ──▶ next() (backwards compatible)
           │
           ▼
  ┌─────────────────────────┐
  │  Validate UUID v4       │ Format check
  └────────┬────────────────┘
           │
           ├─── Invalid ──▶ 400 Bad Request (code: 180)
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
  │  Lookup Existing Key    │ Check store
  └────────┬────────────────┘
           │
           ├─── Found (completed) ──▶ Return cached response
           │
           ├─── Found (in_flight) ──▶ 409 Conflict (code: 181)
           │
           └─── Not found ──▶ Lock key → Execute → Store response (status < 500)
                                                 or release the key
```

## Configuration

**Path:** `registry.custom.gateway.value.idempotency`

```javascript
{
  "idempotency": {
    "model": "memory",                    // Storage: "memory" or "mongo"
    "enforce": false,                     // Global default for enforcement (optional)
    "services": {                         // Service configurations
      "av": {                             // Service name
        "enabled": true,                  // Enable for this service
        "ttl": 60000,                     // Time-to-live in ms (default: 60s)
        "apis": [                         // APIs to protect
          "POST /calls",
          "PUT /call/p2p/ended",
          "PUT /call/p2p/rejected"
        ]
      },
      "payment": {
        "enabled": true,
        "enforce": true,                  // Require Idempotency-Key on matched APIs
        "ttl": 120000,
        "apis": [
          "POST /charge",
          "POST /refund"
        ]
      }
    }
  }
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `model` | string | `"memory"` | Storage backend: `"memory"` or `"mongo"` |
| `enforce` | boolean | `false` | Global default enforcement (overridden per service) |
| `services.[name].enabled` | boolean | `false` | Enable idempotency for this service |
| `services.[name].enforce` | boolean | *(global)* | Require `Idempotency-Key` on matched APIs; overrides the global `enforce`. If unset, falls back to the global default |
| `services.[name].ttl` | number | `60000` | Key expiration time in milliseconds |
| `services.[name].apis` | string[] | `[]` | API patterns to protect (e.g., `"POST /path"`) |

## Enforcement

By default, requests without an `Idempotency-Key` header pass through untouched (backwards compatible). When `enforce` is enabled, a matched, non-GET API **requires** the header — a missing key returns **428 Precondition Required** (code `182`).

Resolution order: `services.[name].enforce` takes precedence when set to a boolean; otherwise the top-level `enforce` applies. Enforcement never affects GET requests, unconfigured/disabled services, or APIs outside the configured `apis` list.

## API Pattern Matching

APIs are matched using `METHOD /path` format with support for path parameters:

```javascript
"apis": [
  "POST /av/calls",              // Exact match
  "PUT /av/call/:id/ended",      // :id matches any segment
  "DELETE /users/:userId/posts/:postId"  // Multiple params
]
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

## Client Usage

Clients must include the `Idempotency-Key` header with a UUID v4:

```http
POST /av/calls HTTP/1.1
Host: api.example.com
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
Content-Type: application/json

{"caller": "user1", "callee": "user2"}
```

## How a Locked Key Ends

The key is locked before the request goes on to throttling, caching and the proxy. How the
request ends decides what happens to it:

| The request ends with | The key | A retry with the same key |
|---|---|---|
| An answer of the service below 500 (2xx, 3xx, 4xx) | Completed, the answer is stored for the TTL | Gets the stored answer, the service is not called |
| An answer of the service of 500 or more | Released | Reaches the service again |
| A proxy error (service down, connection closed) | Released | Reaches the service again |
| An answer of the gateway before the service: throttling (429), an error, a refusal | Released | Runs again |
| The client disconnecting before the request reaches the service | Released | Runs again |
| The client disconnecting while the service is answering | Follows the service answer above | |

Only an answer the service actually produced is replayed. A 4xx is the service's answer to that
request and replaying it is correct. A 5xx, a throttling refusal or any other answer of the gateway
says nothing about the operation, so the key is released and the client's retry runs instead of
getting the same refusal for the whole TTL.

While the request is running, a duplicate with the same key gets 409, code 181.

A service that can fail with a 5xx after part of the work is done must protect that work itself,
the retry reaches it again.

The release only removes a key still in flight and locked by that request: never a completed
one, and never a lock taken by a retry after the TTL of the first ran out.

## Response Scenarios

### New Request (First Time)

```
Request processed normally, a service answer below 500 is stored
```

### Replay (Completed)

```
HTTP/1.1 200 OK
(Cached response body returned, no side effects)
```

### Replay (In-Flight)

```
HTTP/1.1 409 Conflict
Content-Type: application/json

{
  "result": false,
  "errors": {
    "codes": [181],
    "details": [{
      "code": 181,
      "message": "Request with this Idempotency-Key is still being processed."
    }]
  }
}
```

### Invalid Key Format

```
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "result": false,
  "errors": {
    "codes": [180],
    "details": [{
      "code": 180,
      "message": "Invalid Idempotency-Key format. Expected UUID v4."
    }]
  }
}
```

### Enforced (Missing Key)

Returned when the matched API has enforcement enabled and no `Idempotency-Key` header is provided.

```
HTTP/1.1 428 Precondition Required
Content-Type: application/json

{
  "result": false,
  "errors": {
    "codes": [182],
    "details": [{
      "code": 182,
      "message": "Idempotency-Key header is required for this API."
    }]
  }
}
```

## Key Structure

```javascript
{
  "l1": "tenant_id",           // Tenant isolation
  "l2": "idempotency_key"      // Client-provided UUID
}
```

Keys are isolated per tenant to prevent cross-tenant collisions.

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| 180 | 400 | Invalid Idempotency-Key format (not UUID v4) |
| 181 | 409 | Request with this key is still being processed |
| 182 | 428 | Idempotency-Key header required (enforcement enabled) |

## Usage Notes

- Only applies to non-GET requests (POST, PUT, DELETE, PATCH)
- GET requests always pass through (idempotent by nature)
- Keys expire after TTL (default 60 seconds)
- A key is never left in flight by a request that does not reach the service, see [How a Locked Key Ends](#how-a-locked-key-ends)
- Clients should generate a new UUID for each unique operation
- Same UUID = same operation (for retries)
- MongoDB backend required for horizontal scaling
