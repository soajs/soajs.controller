# Custom Registry Configuration

Environment-specific gateway settings stored in the Core DB custom registry.

## Configuration Structure Overview

These settings are accessed via `registry.custom.gateway.value.*` and `registry.custom.oauth.value.*`.

```
registry.custom
├── gateway
│   └── value
│       ├── mt
│       │   └── whitelist           # IP whitelist for bypassing security
│       ├── traffic
│       │   ├── model               # Throttling storage backend
│       │   ├── ip2ban              # Banned IP addresses
│       │   └── throttling          # Service-level rate limiting
│       ├── idempotency             # Idempotency key configuration
│       │   ├── model               # Storage backend (memory/mongo)
│       │   └── [service]           # Per-service idempotency config
│       ├── cache                   # GET response caching
│       │   ├── model               # Storage backend (memory/mongo)
│       │   ├── defaultTTL          # Default cache TTL
│       │   └── [service]           # Per-service cache config
│       ├── maintenanceMode         # Gateway maintenance mode
│       ├── lastSeen                # User activity tracking
│       └── gotoService
│           ├── monitor             # Request monitoring config
│           └── renewReqMonitorOff  # Disable timeout renewal
└── oauth
    └── value
        ├── roaming                 # Cross-environment access
        ├── pinWrapper              # PIN-based login endpoint
        └── pinWhitelist            # PIN login API whitelist
```

---

## 1. Maintenance Mode

**Path:** `registry.custom.gateway.value.maintenanceMode`

**Middleware:** `mw/maintenanceMode/index.js`

Enables gateway-wide maintenance mode, returning a configurable status to all requests.

```javascript
{
  "maintenanceMode": {
    "on": true,                              // Enable maintenance mode
    "status": 503,                           // HTTP status code (default: 503)
    "message": "Maintenance in progress",    // Custom message
    "retryAfter": 3600                       // Retry-After header in seconds
  }
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `on` | boolean | `false` | Enable/disable maintenance mode |
| `status` | number | `503` | HTTP status code to return |
| `message` | string | `"Maintenance mode is on, come back soon"` | Response message |
| `retryAfter` | number | - | Seconds until retry (sets `Retry-After` header) |

---

## 2. IP Blacklist (IP2Ban)

**Path:** `registry.custom.gateway.value.traffic.ip2ban`

**Middleware:** `mw/ip2ban/index.js`

Blocks specified IP addresses from accessing the gateway entirely.

```javascript
{
  "traffic": {
    "ip2ban": ["192.168.1.100", "10.0.0.50", "::1"]
  }
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `ip2ban` | string[] | `[]` | Array of IP addresses to block (returns 403) |

---

## 3. Rate Limiting (Throttling)

**Path:** `registry.custom.gateway.value.traffic`

**Middleware:** `mw/traffic/index.js`

Configures rate limiting strategies and storage backend.

```javascript
{
  "traffic": {
    "model": "mongo",                        // Storage: "memory" or "mongo"
    "throttling": {
      "oauth": {                             // Service-specific config
        "publicAPIStrategy": "default",      // Strategy for public APIs
        "privateAPIStrategy": "heavy",       // Strategy for authenticated APIs
        "apis": ["/token", "/authorization"] // Specific APIs to throttle
      },
      "payment": {
        "publicAPIStrategy": "strict",
        "apis": ["/charge", "/refund"]
      }
    }
  }
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `model` | string | `"memory"` | Storage backend: `"memory"` or `"mongo"` |
| `throttling` | object | `{}` | Service-level throttling overrides |
| `throttling[service].publicAPIStrategy` | string | - | Strategy name for unauthenticated requests |
| `throttling[service].privateAPIStrategy` | string | - | Strategy name for authenticated requests |
| `throttling[service].apis` | string[] | - | Specific API paths to apply throttling |

**Configuration Cascade (highest to lowest priority):**
1. Tenant service config: `keyObj.config.gateway.throttling`
2. Custom registry: `registry.custom.gateway.value.traffic.throttling`
3. Global default: `registry.serviceConfig.throttling`

---

## 4. Idempotency

**Path:** `registry.custom.gateway.value.idempotency`

**Middleware:** `mw/idempotency/index.js`

Prevents duplicate write operations by tracking requests via `Idempotency-Key` headers. When a client retries a request with the same key, the cached response is returned without re-executing the operation.

```javascript
{
  "idempotency": {
    "model": "memory",                    // Storage: "memory" or "mongo"
    "av": {                               // Service name
      "enabled": true,                    // Enable for this service
      "ttl": 60000,                       // Key expiration (ms)
      "apis": [                           // APIs to protect
        "POST /av/calls",
        "PUT /av/call/p2p/ended",
        "PUT /av/call/p2p/rejected"
      ]
    },
    "payment": {
      "enabled": true,
      "ttl": 120000,
      "apis": [
        "POST /payment/charge",
        "POST /payment/refund"
      ]
    }
  }
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `model` | string | `"memory"` | Storage backend: `"memory"` or `"mongo"` |
| `[service].enabled` | boolean | `false` | Enable idempotency for this service |
| `[service].ttl` | number | `60000` | Key expiration time in milliseconds |
| `[service].apis` | string[] | `[]` | API patterns to protect (e.g., `"POST /path"`) |

**Client Usage:**
```http
POST /av/calls HTTP/1.1
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
```

**Error Codes:**
- `180` (400): Invalid Idempotency-Key format (not UUID v4)
- `181` (409): Request with this key is still being processed

---

## 5. Response Caching

**Path:** `registry.custom.gateway.value.cache`

**Middleware:** `mw/cache/index.js`

Caches GET API responses with per-API TTL configuration. Returns `X-Cache: HIT` or `X-Cache: MISS` headers.

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
        }
      }
    },
    "catalog": {
      "enabled": true,
      "apis": {
        "GET /catalog/products": {
          "enabled": true,
          "ttl": 600000                   // 10 minutes
        }
      }
    }
  }
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `model` | string | `"memory"` | Storage backend: `"memory"` or `"mongo"` |
| `defaultTTL` | number | `300000` | Default cache TTL in milliseconds |
| `[service].enabled` | boolean | `false` | Enable caching for this service |
| `[service].apis` | object | `{}` | API-specific cache configuration |
| `[service].apis[api].enabled` | boolean | `false` | Enable caching for this API |
| `[service].apis[api].ttl` | number | `defaultTTL` | Cache TTL for this specific API |

**Response Headers:**
- `X-Cache: HIT` - Response served from cache
- `X-Cache: MISS` - Response fetched from backend
- `X-Cache-Age: <seconds>` - Time since cached (on HIT)

**Notes:**
- Only GET requests are cached
- Only 2xx responses are cached
- Cache key includes tenant ID, service name, path, and query hash

---

## 6. Multi-Tenant IP Whitelist

**Path:** `registry.custom.gateway.value.mt.whitelist`

**Middleware:** `mw/mt/utils.js`

Allows specific IP ranges to bypass ACL and/or OAuth checks.

```javascript
{
  "mt": {
    "whitelist": {
      "ips": ["10.0.0.0/8", "192.168.1.0/24", "172.16.0.0/12"],
      "acl": true,                           // Skip ACL checks for whitelisted IPs
      "oauth": true                          // Skip OAuth checks for whitelisted IPs
    }
  }
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `ips` | string[] | `[]` | IP addresses/CIDR ranges to whitelist |
| `acl` | boolean | `false` | Skip ACL validation for whitelisted IPs |
| `oauth` | boolean | `false` | Skip OAuth validation for whitelisted IPs |

---

## 7. User Activity Tracking (Last Seen)

**Path:** `registry.custom.gateway.value.lastSeen`

**Middleware:** `mw/lastSeen/index.js`

Tracks user activity by notifying a service (typically URAC) of user access.

```javascript
{
  "lastSeen": {
    "active": true,                          // Enable tracking
    "serviceName": "urac",                   // Service to notify
    "serviceVersion": "3",                   // Service version
    "api": "/user/last/seen",                // API endpoint
    "network": "internal"                    // Optional network identifier
  }
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `active` | boolean | `false` | Enable/disable activity tracking |
| `serviceName` | string | `"urac"` | Service to receive notifications |
| `serviceVersion` | string | `"3"` | Version of the service |
| `api` | string | `"/user/last/seen"` | API endpoint to call |
| `network` | string | - | Optional network info sent in request body |

---

## 8. Request Monitoring

**Path:** `registry.custom.gateway.value.gotoService.monitor`

**Middleware:** `mw/gotoService/redirectToService.js`

Controls which services are monitored for metrics collection.

```javascript
{
  "gotoService": {
    "monitor": {
      "blacklist": ["oauth", "urac", "soamonitor"],  // Services to NOT monitor
      "whitelist": ["payment", "orders", "users"]    // Services to monitor (exclusive)
    }
  }
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `blacklist` | string[] | `[]` | Services to exclude from monitoring |
| `whitelist` | string[] | `[]` | If set, ONLY these services are monitored |

**Note:** If `whitelist` is defined, only services in the whitelist are monitored. Otherwise, all services except those in the blacklist are monitored.

---

## 9. Request Timeout Renewal

**Path:** `registry.custom.gateway.value.gotoService.renewReqMonitorOff`

**Middleware:** `mw/gotoService/lib/preRedirect.js`

Disables the heartbeat renewal mechanism for long-running requests.

```javascript
{
  "gotoService": {
    "renewReqMonitorOff": true               // Disable timeout renewal
  }
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `renewReqMonitorOff` | boolean | `false` | Disable request timeout renewal mechanism |

---

## 10. OAuth Roaming (Cross-Environment)

**Path:** `registry.custom.oauth.value.roaming`

**Middleware:** `mw/gotoService/roaming.js`

Enables cross-environment access for specific services with IP-based whitelisting.

```javascript
{
  "roaming": {
    "services": {
      "oauth": {
        "whitelistips": ["192.144.3.1", "10.0.0.1"]
      },
      "payment": {
        "whitelistips": ["127.0.0.1", "192.168.1.0/24"]
      }
    }
  }
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `services` | object | `{}` | Service-specific roaming configuration |
| `services[name].whitelistips` | string[] | `[]` | IPs allowed to roam to this service |

---

## 11. PIN Login Wrapper

**Path:** `registry.custom.oauth.value.pinWrapper`

**Middleware:** `mw/mt/utils.js`

Defines a custom PIN-based login endpoint that bypasses standard OAuth flow.

```javascript
{
  "pinWrapper": {
    "servicename": "auth-service",           // Service providing PIN login
    "apiname": "/pin/login"                  // API endpoint for PIN login
  }
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `servicename` | string | - | Service name providing PIN authentication |
| `apiname` | string | - | API endpoint path for PIN login |

---

## 12. PIN Login API Whitelist

**Path:** `registry.custom.oauth.value.pinWhitelist`

**Middleware:** `mw/mt/utils.js`

Whitelists specific APIs that can be accessed when a user is PIN-locked (during PIN login flow).

```javascript
{
  "pinWhitelist": {
    "auth-service": {
      "get": {
        "apis": ["/pin/verify", "/pin/status"],
        "regex": ["/api/v[0-9]+/pin/.*"]
      },
      "post": {
        "apis": ["/pin/login", "/pin/reset"],
        "regex": []
      }
    },
    "user-service": {
      "get": {
        "apis": ["/user/minimal"],
        "regex": []
      }
    }
  }
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `[service]` | object | - | Service-specific PIN whitelist |
| `[service].[method].apis` | string[] | `[]` | Exact API paths to whitelist |
| `[service].[method].regex` | string[] | `[]` | Regex patterns for matching APIs |

---

## Complete Configuration Example

```javascript
// Core DB: custom_registry collection
{
  "_id": ObjectId("..."),
  "name": "gateway",
  "value": {
    "maintenanceMode": {
      "on": false,
      "status": 503,
      "message": "System maintenance in progress",
      "retryAfter": 1800
    },
    "mt": {
      "whitelist": {
        "ips": ["10.0.0.0/8"],
        "acl": true,
        "oauth": false
      }
    },
    "traffic": {
      "model": "mongo",
      "ip2ban": ["192.168.1.100"],
      "throttling": {
        "oauth": {
          "publicAPIStrategy": "default",
          "apis": ["/token"]
        },
        "payment": {
          "publicAPIStrategy": "strict",
          "privateAPIStrategy": "heavy",
          "apis": ["/charge", "/refund", "/subscribe"]
        }
      }
    },
    "idempotency": {
      "model": "mongo",
      "payment": {
        "enabled": true,
        "ttl": 120000,
        "apis": ["POST /payment/charge", "POST /payment/refund"]
      }
    },
    "cache": {
      "model": "mongo",
      "defaultTTL": 300000,
      "catalog": {
        "enabled": true,
        "apis": {
          "GET /catalog/products": { "enabled": true, "ttl": 600000 },
          "GET /catalog/categories": { "enabled": true, "ttl": 3600000 }
        }
      }
    },
    "lastSeen": {
      "active": true,
      "serviceName": "urac",
      "serviceVersion": "3",
      "api": "/user/last/seen",
      "network": "production"
    },
    "gotoService": {
      "monitor": {
        "blacklist": ["soamonitor", "urac"]
      },
      "renewReqMonitorOff": false
    }
  }
}

// Separate OAuth custom registry entry
{
  "_id": ObjectId("..."),
  "name": "oauth",
  "value": {
    "roaming": {
      "services": {
        "oauth": {
          "whitelistips": ["192.144.3.1"]
        }
      }
    },
    "pinWrapper": {
      "servicename": "auth",
      "apiname": "/pin/login"
    },
    "pinWhitelist": {
      "auth": {
        "post": {
          "apis": ["/pin/login", "/pin/verify"],
          "regex": []
        }
      }
    }
  }
}
```

---

## Middleware Processing Order

Custom registry configurations are processed in this order:

| Order | Middleware | Configuration Used |
|-------|------------|-------------------|
| 1 | ip2ban | `traffic.ip2ban` |
| 2 | maintenanceMode | `maintenanceMode` |
| 3 | gotoService/roaming | `oauth.value.roaming` |
| 4 | gotoService/preRedirect | `gotoService.renewReqMonitorOff` |
| 5 | gotoService/redirectToService | `gotoService.monitor` |
| 6 | mt (security checks) | `mt.whitelist`, `oauth.value.pinWrapper`, `oauth.value.pinWhitelist` |
| 7 | idempotency | `idempotency.model`, `idempotency.[service]` |
| 8 | traffic | `traffic.model`, `traffic.throttling` |
| 9 | cache | `cache.model`, `cache.defaultTTL`, `cache.[service]` |
| 10 | lastSeen | `lastSeen` |
