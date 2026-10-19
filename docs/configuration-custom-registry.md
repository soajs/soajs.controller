# Custom Registry Configuration

Environment-specific gateway settings stored in the Core DB custom registry.

## Configuration Structure Overview

These settings are accessed via `registry.custom.gateway.value.*`, `registry.custom.oauth.value.*` and `registry.custom.urac.value.*`.

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
│       │   └── services            # Per-service idempotency config
│       │       └── [service]       # Service-specific settings
│       ├── cache                   # GET response caching
│       │   ├── model               # Storage backend (memory/mongo)
│       │   ├── defaultTTL          # Default cache TTL
│       │   └── services            # Per-service cache config
│       │       └── [service]       # Service-specific settings
│       ├── maintenanceMode         # Gateway maintenance mode
│       ├── lastSeen                # User activity tracking
│       ├── membership              # Membership on the urac object, by product
│       │   ├── active              # Whether membership is resolved at all
│       │   └── [main product]      # Its sub products
│       ├── oauth
│       │   └── deviceIdCheck       # Turn the deviceId check off
│       └── gotoService
│           ├── monitor             # Request monitoring config
│           └── renewReqMonitorOff  # Disable timeout renewal
├── oauth
│   └── value
│       ├── roaming                 # Cross-environment access
│       ├── pinWrapper              # PIN-based login endpoint
│       └── pinWhitelist            # PIN login API whitelist
└── urac
    └── value
        └── tenantAccessResolvers   # APIs that grant access to a tenant
            └── [resolver]          # One API per resolver name
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
    "services": {                         // Per-service configuration
      "av": {                             // Service name
        "enabled": true,                  // Enable for this service
        "ttl": 60000,                     // Key expiration (ms)
        "apis": [                         // APIs to protect
          "POST /calls",
          "PUT /call/p2p/ended",
          "PUT /call/p2p/rejected"
        ]
      },
      "payment": {
        "enabled": true,
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
| `services.[name].enabled` | boolean | `false` | Enable idempotency for this service |
| `services.[name].ttl` | number | `60000` | Key expiration time in milliseconds |
| `services.[name].apis` | string[] | `[]` | API patterns to protect (e.g., `"POST /path"`) |

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
    "services": {                         // Per-service configuration
      "av": {                             // Service name
        "enabled": true,                  // Enable caching for this service
        "apis": {
          "GET /calls": {
            "enabled": true,
            "ttl": 30000                  // 30 seconds
          },
          "GET /call/:id": {
            "enabled": true,
            "ttl": 60000                  // 60 seconds
          }
        }
      },
      "catalog": {
        "enabled": true,
        "apis": {
          "GET /products": {
            "enabled": true,
            "ttl": 600000                 // 10 minutes
          }
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
| `services.[name].enabled` | boolean | `false` | Enable caching for this service |
| `services.[name].apis` | object | `{}` | API-specific cache configuration |
| `services.[name].apis[api].enabled` | boolean | `false` | Enable caching for this API |
| `services.[name].apis[api].ttl` | number | `defaultTTL` | Cache TTL for this specific API |

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
    "network": "internal",                   // Optional network identifier
    "include": {                             // Optional whitelist, omit for all requests
      "connectspaces": true
    },
    "targets": [                             // Optional extra APIs, same event
      {
        "serviceName": "authenticator",
        "serviceVersion": "1",
        "api": "/my/device/network",
        "method": "put"
      }
    ]
  }
}
```

See `docs/middleware/lastSeen.md` for the `include` matching rules and the target fields.

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

## 13. OAuth Device ID Check

**Path:** `registry.custom.gateway.value.oauth.deviceIdCheck`

**Middleware:** `mw/oauth/index.js`

Turns off the deviceId check done when authorising an access token. The check matches
`user.deviceId` on the access token record against the `device-id` header on every
private API call, and denies with error 156 on mismatch.

```javascript
{
  "oauth": {
    "deviceIdCheck": false                   // Turn off the deviceId check
  }
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `deviceIdCheck` | boolean | `true` | Set to `false` to turn the deviceId check off |

Only the boolean `false` turns the check off. Any other value, and a missing or
malformed entry, leaves it on.

Note this is a `gateway` entry, not an `oauth` one. The `registry.custom.oauth.value.*`
entries above are consumed by `mw/mt/utils.js` and `mw/gotoService/roaming.js`, this one
is read by the oauth middleware itself.

---

## 14. Membership

**Path:** `registry.custom.gateway.value.membership`

**Middleware:** `mw/mt/index.js`, resolved by `lib/membership.js`

Puts the caller's membership on the urac object of every call, so a service can read it
without a lookup.

A membership is held per main product on the user record in the urac `users` collection,
and only its name is stored. What the name grants is resolved from the catalog, it is
never copied onto the user:

```javascript
{
  "memberships": [
    { "product": "AVAPP", "membership": "whale" }
  ]
}
```

The gateway already resolves both halves of the match on every call. The access token
gives the user record, which carries `memberships`, and the API key gives the product the
call is made under. Resolution is the match between them: if the product of the request
is a configured main product or one of its sub products, and the user holds an entry for
that main product, the membership name is injected.

```javascript
{
  "membership": {
    "active": true,                          // Resolve membership at all
    "AVAPP": ["CLUBS", "CORPS", "SECRT", "GRPCH"]   // Main product and its sub products
  }
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `active` | boolean | `false` | Whether the gateway resolves membership at all |
| `[main product]` | string[] | - | A product a membership is held in, valued by the sub products that resolve to it |

Every key other than `active` is read as a main product, so more than one can be
configured and they stay independent. A main product always resolves to itself, listing
sub products is optional.

### What the service sees

```javascript
req.soajs.urac.membership     // "whale"
```

Only the resolved name travels. The raw `memberships` array is never injected, so a
service cannot read a membership held for a product the request was not made under.

### It fails closed

Nothing is injected, and no service sees a membership, when any of these hold:

| | |
|---|---|
| the block is absent, or `active` is not `true` | membership is off |
| no main product is configured | nothing is resolvable, equivalent to off |
| the request product is neither a main product nor a sub product | out of scope |
| the user holds no entry for the resolved main product | no membership |
| the service does not request urac (`urac: false`) | there is no urac object to put it on |

Product codes are matched exactly. They are uppercase by convention, and normalizing
here would hide a miscased entry in the registry rather than surface it.

### Freshness

The user record behind this comes from the access token when
`serviceConfig.oauth.getUserFromToken` is on, when the login mode is `oauth`, or when
roaming. In those cases `memberships` is a snapshot taken at login, and a membership
changed afterwards is not seen until a new token is issued. Refreshing does not help,
the refresh grant copies the stored user forward unchanged. Otherwise the record is
loaded from urac per request and the membership is current.

---

## 15. Tenant Access Resolver

**Path:** `registry.custom.urac.value.tenantAccessResolvers`

**Middleware:** `mw/mt/urac.js`, called by `mw/mt/tenantAccess.js`

Gives a group of users access to a tenant without inviting each of them, for example
every user of a department of an app. The tenant names a resolver, and the resolver is
an API of that app that answers, per user, whether they have access and with what
groups. Nothing is written on the users, `allowedTenants` stays untouched.

Users always log in at their home tenant and then switch, by calling the gateway with
their token and the key of the other tenant. The resolver is asked on those calls.

Setting it up takes three steps:

1. Build the API in a service of the app, see [The API to build](#the-api-to-build)
2. Add the resolver to the `urac` custom registry, see [The resolver](#the-resolver)
3. Name the resolver in the profile of each tenant, see [The tenant](#the-tenant)

### The API to build

Any route of a service in the registry. The gateway calls it directly, not through the
gateway, so it does not need to be granted in any package. Keep it out of every ACL,
its answer is trusted as is.

It receives:

```javascript
// Body
{
  "user": {
    "id": "5c8d0c505653de3985aa1001",
    "username": "ann",
    "tenant": { "id": "...", "code": "HOME" }   // Home tenant of the user
  },
  "tenant": {
    "id": "...",
    "code": "DEPT",
    "main": { "id": "...", "code": "MAIN" }     // Only for a sub tenant
  },
  "subject": "dept_1"                           // From the tenant profile
}
```

The `soajsinjectobj` header carries the tenant, the key with `commonFields` and the
config of the resolver service, and the application of the request, so a service with
`extKeyRequired` accepts the call. It carries no user and no ACL.

It answers with a standard SOAJS response:

```javascript
// Access
{
  "result": true,
  "data": {
    "access": true,
    "groups": ["member"],
    "groupsConfig": {
      "allowedPackages": { "PROD": ["PROD_USER"] }
    }
  }
}

// No access
{ "result": true, "data": { "access": false } }
```

| Field | Required | Description |
|-------|----------|-------------|
| `access` | yes | `true` to grant access |
| `groupsConfig.allowedPackages` | yes, with access | Packages per product, the shape urac builds from the user's groups |
| `groups` | no | Group codes services see on the urac object, `[]` when absent |

The answer is the ACL. Nothing caps it, a package the API returns is granted. Only the
entry of the product of the key is used.

It runs on every call under the tenant, keep it fast.

### The resolver

```javascript
{
  "name": "urac",
  "value": {
    "tenantAccessResolvers": {
      "department": {
        "service": "departments",
        "version": "1",
        "method": "post",
        "api": "/tenant/access",
        "timeout": 2000
      }
    }
  }
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `service` | string | - | Service that answers, must be in the registry |
| `version` | string | latest | Version of the service |
| `method` | string | `post` | HTTP method |
| `api` | string | - | Route on the service, without the service name |
| `timeout` | number | `2000` | Milliseconds before the call counts as no access |

The tenant names the resolver and the registry defines the call, so the API can move
without touching any tenant. A tenant naming a resolver that is not defined here is
logged as an error and treated as having none.

### The tenant

The tenant profile names the resolver and the subject the API should check, here the
department:

```javascript
{
  "profile": {
    "access": {
      "resolver": "department",   // A key of tenantAccessResolvers
      "subject": "dept_1"         // Passed to the API as is
    }
  }
}
```

The profile is loaded with the key, so a change applies once the key cache refreshes.
`PUT /tenant/profile` of multitenant replaces the whole profile, whatever edits it must
keep `access`.

### When it is asked

For every call made with a token under a tenant that is not the user's home tenant, in
this order:

| Order | Condition | Result |
|-------|-----------|--------|
| 1 | The token's `config.allowedTenants` lists the tenant | Invited, urac driver as before, the resolver is not asked |
| 2 | The tenant profile names a resolver | The resolver is asked |
| 3 | The resolver says no, fails or times out, or there is no resolver | urac driver as before |

It is never asked for the user's home tenant, for a token issued for this tenant, for
roaming, or for `loginMode: "oauth"` tokens.

On access the gateway takes the user from the token, sets its tenant to the tenant of
the key, its `groups` and `groupsConfig` to the answer, and builds the ACL as for any
user. The packages come from the provision cache, so urac is not read at all.

The fallback catches an invitation made after the token was issued, the token does not
show it yet. Everyone else gets what they got before, error 146.

### When access is refused

Anything but a well formed access answer is no access, and the urac driver decides:

| | |
|---|---|
| the service is not in the registry, or has no host | logged as an error |
| non 2xx status, `result: false`, or not JSON | logged as an error |
| no answer within `timeout` | logged as an error |
| `access: true` without `groupsConfig.allowedPackages` | logged as an error |
| `access` is not `true` | not logged, a normal answer |

### Behaviour

- **Cost.** One API call per call under the tenant, in place of the user and groups
  reads of urac. Invited users cost what they did before.
- **Freshness.** Nothing is cached, adding or removing a user in the app applies on
  their next call.
- **Outage.** While the service is down, users of the resolver get 146 under that
  tenant, each call after waiting up to `timeout`, keep it short. Their home tenant and
  invited users are not affected, except users invited after their token was issued,
  who also wait for the timeout before the fallback lets them in.
- **Invitations win.** A user both invited and covered by the resolver gets the groups
  of the invitation. If the invitation was made after the token was issued, they get
  the resolver's until their next login.

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
      "services": {
        "payment": {
          "enabled": true,
          "ttl": 120000,
          "apis": ["POST /charge", "POST /refund"]
        }
      }
    },
    "cache": {
      "model": "mongo",
      "defaultTTL": 300000,
      "services": {
        "catalog": {
          "enabled": true,
          "apis": {
            "GET /products": { "enabled": true, "ttl": 600000 },
            "GET /categories": { "enabled": true, "ttl": 3600000 }
          }
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
    "oauth": {
      "deviceIdCheck": false
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

// Separate URAC custom registry entry
{
  "_id": ObjectId("..."),
  "name": "urac",
  "value": {
    "tenantAccessResolvers": {
      "department": {
        "service": "departments",
        "version": "1",
        "api": "/tenant/access",
        "timeout": 2000
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
| 6a | oauth (called from mt) | `oauth.deviceIdCheck` |
| 6b | mt (uracCheck) | `urac.value.tenantAccessResolvers` |
| 6c | mt (inject object) | `membership` |
| 7 | idempotency | `idempotency.model`, `idempotency.services.[name]` |
| 8 | traffic | `traffic.model`, `traffic.throttling` |
| 9 | cache | `cache.model`, `cache.defaultTTL`, `cache.services.[name]` |
| 10 | lastSeen | `lastSeen` |
