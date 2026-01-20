# Services Config (Tenant Key Configuration)

Tenant key-specific configuration stored in `keyObj.config`. These settings are specific to each tenant's external key and override environment-level settings.

## Configuration Structure Overview

```
keyObj.config
├── gateway
│   ├── networkPackages             # Network-based package override
│   ├── validateTokenAccount        # Token account validation
│   └── throttling                  # Tenant-specific throttling
└── [serviceName]                   # Service URL override
    ├── url                         # Single URL for all versions
    └── urls                        # Version-specific URLs
```

---

## 1. Network Package Override

**Path:** `keyObj.config.gateway.networkPackages`

**Middlewares:**
- `mw/key/index.js` (default package)
- `mw/mt/urac.js` (user packages)

Allows different packages to be loaded based on the network identifier configured in the custom registry.

```javascript
{
  "gateway": {
    "networkPackages": {
      "mw": {                                // Network identifier (from lastSeen.network)
        "AVAPP": {                           // Product code (keyObj.application.product)
          "default": "AVAPP_DEFAU",          // Default package to use for this network
          "users": {                         // User-specific package mappings
            "AVAPP_EXMPL": "AVAPP_ALTRN"     // Map user's package to alternate
          }
        }
      }
    }
  }
}
```

### How it Works

The network package override operates at two levels:

**1. Key Middleware** (`mw/key/index.js`) - Applies `default` package override for all requests

```
  1. Get network from registry
     network = registry.custom.gateway.value.lastSeen.network    (e.g., "mw")

  2. Get product from keyObj
     product = keyObj.application.product                        (e.g., "AVAPP")

  3. Check for network package config
     config = keyObj.config.gateway.networkPackages[network][product]

  4. If config.default exists:
     ├── Original: keyObj.application.package = "AVAPP_EXMPL"
     ├── Override: keyObj.application.package = "AVAPP_DEFAU"
     └── Log: "Network package override: replaced package [AVAPP_EXMPL]
              with [AVAPP_DEFAU] for network [mw] and product [AVAPP]"

  5. Continue to load the (possibly overridden) package
```

**2. MT Middleware** (`mw/mt/urac.js`) - Applies `users` package override for authenticated user's allowed packages

```
  In resolveACL() before calling getPackagesData():

  1. Get network from registry
     network = registry.custom.gateway.value.lastSeen.network    (e.g., "mw")

  2. Get product from soajs.tenant.application.product           (e.g., "AVAPP")

  3. Get user's allowed packages
     allowedPackages = userRecord.groupsConfig.allowedPackages[product]
                                                                 (e.g., ["AVAPP_EXMPL"])

  4. Check for network package config
     config = keyObj.config.gateway.networkPackages[network][product]

  5. If config.users exists, for each package in allowedPackages:
     ├── Check: config.users["AVAPP_EXMPL"] = "AVAPP_ALTRN"
     ├── Replace: allowedPackages[i] = "AVAPP_ALTRN"
     └── Log: "User network package override: replaced package [AVAPP_EXMPL]
              with [AVAPP_ALTRN] for network [mw] and product [AVAPP]"

  6. Call getPackagesData() with the (possibly modified) allowedPackages
```

| Field | Type | Description |
|-------|------|-------------|
| `networkPackages` | object | Top-level container for network-based package configs |
| `networkPackages[network]` | object | Config for a specific network (e.g., "mw") |
| `networkPackages[network][product]` | object | Config for a specific product |
| `networkPackages[network][product].default` | string | Default package for key middleware (tenant-level) |
| `networkPackages[network][product].users` | object | User-specific package mappings for mt middleware |
| `networkPackages[network][product].users[packageCode]` | string | Replacement package for this user's package |

---

## 2. Validate Token Account

**Path:** `keyObj.config.gateway.validateTokenAccount`

**Middleware:** `mw/mt/utils.js` → `uracCheck()`

Forces users to re-login when their email or phone changes, providing additional security for sensitive account changes.

```javascript
{
  "gateway": {
    "validateTokenAccount": {
      "email": true,                         // Validate email hasn't changed
      "phone": true                          // Validate phone hasn't changed
    }
  }
}
```

### How it Works

- When a user's OAuth token is validated, the middleware compares the current user profile with the token's stored user data
- If `email: true` and the user's email has changed since token creation → Error 146 (invalid token)
- If `phone: true` and the user's phone has changed since token creation → Error 146 (invalid token)
- This forces users to re-authenticate after changing sensitive account information

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `validateTokenAccount.email` | boolean | `false` | Invalidate token if email changed |
| `validateTokenAccount.phone` | boolean | `false` | Invalidate token if phone changed |

---

## 3. Tenant-Specific Throttling

**Path:** `keyObj.config.gateway.throttling`

**Middleware:** `mw/traffic/index.js`

Allows overriding the global throttling configuration at the tenant level.

```javascript
{
  "gateway": {
    "throttling": {
      "serviceName": {                       // Service to apply throttling to
        "publicAPIStrategy": "default",      // Strategy for unauthenticated requests
        "privateAPIStrategy": "heavy",       // Strategy for authenticated requests
        "apis": ["/api1", "/api2"]           // Optional: specific APIs (if omitted, applies to all)
      }
    }
  }
}
```

### Configuration Cascade

Throttling configuration is resolved in this order (highest to lowest priority):

1. `keyObj.config.gateway.throttling` (tenant service config)
2. `registry.custom.gateway.value.traffic.throttling` (custom registry)
3. `registry.serviceConfig.throttling` (global default)

| Field | Type | Description |
|-------|------|-------------|
| `throttling[service]` | object | Throttling config for a specific service |
| `throttling[service].publicAPIStrategy` | string | Strategy name for unauthenticated requests |
| `throttling[service].privateAPIStrategy` | string | Strategy name for authenticated requests |
| `throttling[service].apis` | string[] | Optional: specific APIs to throttle (all if omitted) |

---

## 4. Service URL Override

**Path:** `keyObj.config[serviceName]`

**Middleware:** `mw/gotoService/lib/preRedirect.js`

Allows tenants to override the URL for specific services, useful for pointing to custom endpoints or different service versions.

```javascript
{
  "urac": {                                  // Service name
    "url": "https://custom-urac.example.com" // Custom URL (overrides registry)
  },
  "oauth": {                                 // Another service
    "urls": [                                // Versioned URLs
      { "version": "1", "url": "https://oauth-v1.example.com" },
      { "version": "2", "url": "https://oauth-v2.example.com" }
    ]
  }
}
```

### How it Works

- For endpoint-type services, the gateway checks `keyObj.config[serviceName]`
- If `url` exists, it overrides the registry URL
- If `urls` array exists and matches the requested version, that versioned URL is used
- This allows per-tenant service routing without modifying the global registry

| Field | Type | Description |
|-------|------|-------------|
| `config[service].url` | string | Custom URL for all versions of this service |
| `config[service].urls` | array | Array of version-specific URLs |
| `config[service].urls[].version` | string | Service version |
| `config[service].urls[].url` | string | URL for this specific version |

---

## Complete Configuration Example

```javascript
// In tenant key configuration (keyObj.config)
{
  "gateway": {
    "networkPackages": {
      "mw": {
        "AVAPP": {
          "default": "AVAPP_DEFAU",
          "users": {
            "AVAPP_EXMPL": "AVAPP_ALTRN",
            "AVAPP_BASIC": "AVAPP_BASIC_MW"
          }
        }
      },
      "partner": {
        "AVAPP": {
          "default": "AVAPP_PARTNER",
          "users": {}
        }
      }
    },
    "validateTokenAccount": {
      "email": true,
      "phone": false
    },
    "throttling": {
      "payment": {
        "publicAPIStrategy": "strict",
        "privateAPIStrategy": "premium",
        "apis": ["/charge", "/refund"]
      }
    }
  },
  "urac": {
    "url": "https://custom-urac.tenant.com"
  },
  "oauth": {
    "urls": [
      { "version": "1", "url": "https://oauth-v1.tenant.com" },
      { "version": "2", "url": "https://oauth-v2.tenant.com" }
    ]
  }
}
```

---

## Error Codes

| Code | Description |
|------|-------------|
| 144 | External key is not valid for this environment |
| 146 | Invalid token (account validation failed - email/phone changed) |
| 148 | External key is invalid or has been disabled |
| 149 | Product package not found |
