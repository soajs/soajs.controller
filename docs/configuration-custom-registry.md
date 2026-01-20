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

## 4. Multi-Tenant IP Whitelist

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

## 5. User Activity Tracking (Last Seen)

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

## 6. Request Monitoring

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

## 7. Request Timeout Renewal

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

## 8. OAuth Roaming (Cross-Environment)

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

## 9. PIN Login Wrapper

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

## 10. PIN Login API Whitelist

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
| 7 | traffic | `traffic.model`, `traffic.throttling` |
| 8 | lastSeen | `lastSeen` |
