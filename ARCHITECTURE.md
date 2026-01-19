# SOAJS Controller Gateway - System Architecture

## Overview

The SOAJS Controller is an API Gateway that serves as the central entry point for all microservices in the SOAJS ecosystem. It handles routing, service discovery, multi-tenant authentication, rate limiting, and request proxying.

```
                                    SOAJS Controller Gateway Architecture
                                    =====================================

    ┌─────────────────────────────────────────────────────────────────────────────────────────┐
    │                                      CLIENTS                                             │
    │                     (Web Apps, Mobile Apps, External Services)                           │
    └───────────────────────────────────────┬─────────────────────────────────────────────────┘
                                            │
                                            ▼
    ┌─────────────────────────────────────────────────────────────────────────────────────────┐
    │                              SOAJS CONTROLLER GATEWAY                                    │
    │                                    (Port 4000)                                           │
    │  ┌───────────────────────────────────────────────────────────────────────────────────┐  │
    │  │                           MIDDLEWARE PIPELINE                                      │  │
    │  │                                                                                    │  │
    │  │   ┌─────────┐  ┌──────┐  ┌──────────┐  ┌─────────┐  ┌───────────┐  ┌───────────┐ │  │
    │  │   │  SOAJS  │─▶│ CORS │─▶│ Favicon  │─▶│Response │─▶│ Enhancer  │─▶│  IP2Ban   │ │  │
    │  │   │  Init   │  │      │  │          │  │ Builder │  │           │  │           │ │  │
    │  │   └─────────┘  └──────┘  └──────────┘  └─────────┘  └───────────┘  └───────────┘ │  │
    │  │        │                                                                     │    │  │
    │  │        ▼                                                                     ▼    │  │
    │  │   ┌──────────────┐  ┌─────────┐  ┌───────────┐  ┌─────────┐  ┌───────────────┐   │  │
    │  │   │ Maintenance  │─▶│   URL   │─▶│ Awareness │─▶│   Key   │─▶│   Key ACL     │   │  │
    │  │   │    Mode      │  │ Parser  │  │           │  │ Loader  │  │  Extractor    │   │  │
    │  │   └──────────────┘  └─────────┘  └───────────┘  └─────────┘  └───────────────┘   │  │
    │  │                                                                     │            │  │
    │  │                                                                     ▼            │  │
    │  │   ┌──────────────┐  ┌─────────────┐  ┌─────────┐  ┌───────────────────────────┐  │  │
    │  │   │   Traffic    │◀─│    OAuth    │◀─│   MT    │◀─│      Goto Service         │  │  │
    │  │   │  (Throttle)  │  │   (Auth)    │  │(Tenant) │  │   (Route Selection)       │  │  │
    │  │   └──────────────┘  └─────────────┘  └─────────┘  └───────────────────────────┘  │  │
    │  │        │                                                                         │  │
    │  │        ▼                                                                         │  │
    │  │   ┌──────────────┐  ┌─────────────────────────────────────────────────────────┐  │  │
    │  │   │  Last Seen   │─▶│                    REQUEST HANDLER                      │  │  │
    │  │   │   Tracker    │  │            (Proxy to Target Service)                    │  │  │
    │  │   └──────────────┘  └─────────────────────────────────────────────────────────┘  │  │
    │  │                                                                                   │  │
    │  └───────────────────────────────────────────────────────────────────────────────────┘  │
    │                                                                                          │
    │  ┌───────────────────────────────────────────────────────────────────────────────────┐  │
    │  │                              CORE MODULES                                          │  │
    │  │                                                                                    │  │
    │  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐  ┌─────────────────┐  │  │
    │  │  │    Registry    │  │   Provision    │  │    Awareness   │  │     Driver      │  │  │
    │  │  │    Module      │  │    Module      │  │     Engine     │  │   (K8s/Swarm)   │  │  │
    │  │  └────────────────┘  └────────────────┘  └────────────────┘  └─────────────────┘  │  │
    │  │                                                                                    │  │
    │  └───────────────────────────────────────────────────────────────────────────────────┘  │
    │                                                                                          │
    │  ┌───────────────────────────────────────────────────────────────────────────────────┐  │
    │  │                          MAINTENANCE SERVER (Port 5000)                            │  │
    │  │         /heartbeat    /loadProvision    /reloadRegistry    /awarenessStat          │  │
    │  └───────────────────────────────────────────────────────────────────────────────────┘  │
    └─────────────────────────────────────────────────────────────────────────────────────────┘
                                            │
            ┌───────────────────────────────┼───────────────────────────────┐
            │                               │                               │
            ▼                               ▼                               ▼
    ┌───────────────────┐       ┌───────────────────┐           ┌───────────────────┐
    │   MICROSERVICES   │       │    DATA STORES    │           │ EXTERNAL SERVICES │
    │                   │       │                   │           │                   │
    │  ┌─────────────┐  │       │  ┌─────────────┐  │           │  ┌─────────────┐  │
    │  │  Service A  │  │       │  │   Core DB   │  │           │  │   OAuth     │  │
    │  │  (v1, v2)   │  │       │  │  (MongoDB)  │  │           │  │   Service   │  │
    │  └─────────────┘  │       │  └─────────────┘  │           │  └─────────────┘  │
    │  ┌─────────────┐  │       │  ┌─────────────┐  │           │  ┌─────────────┐  │
    │  │  Service B  │  │       │  │   Meta DB   │  │           │  │    URAC     │  │
    │  │  (v1)       │  │       │  │  (Tenant)   │  │           │  │   Service   │  │
    │  └─────────────┘  │       │  └─────────────┘  │           │  └─────────────┘  │
    │  ┌─────────────┐  │       │  ┌─────────────┐  │           │  ┌─────────────┐  │
    │  │  Service C  │  │       │  │ Throttle DB │  │           │  │ SOA Monitor │  │
    │  │  (v1, v2)   │  │       │  │ (Optional)  │  │           │  │   Service   │  │
    │  └─────────────┘  │       │  └─────────────┘  │           │  └─────────────┘  │
    │                   │       │                   │           │                   │
    └───────────────────┘       └───────────────────┘           └───────────────────┘
```

---

## Component Descriptions

### 1. Middleware Pipeline

The gateway processes requests through a sequential middleware pipeline:

| Order | Middleware | Responsibility |
|-------|------------|----------------|
| 1 | **soajs** | Initializes `req.soajs` context, attaches registry, sets up logging |
| 2 | **cors** | Handles CORS preflight (OPTIONS) and headers |
| 3 | **favicon** | Serves favicon requests |
| 4 | **response** | Adds `buildResponse()` and `controllerResponse()` helpers |
| 5 | **enhancer** | Adds `req.get()` method for case-insensitive header retrieval |
| 6 | **ip2ban** | Enforces IP blacklist from gateway configuration |
| 7 | **maintenanceMode** | Returns 503 if gateway is in maintenance mode |
| 8 | **url** | Parses URL into service name, version, and path components |
| 9 | **awareness** | Initializes service discovery (getHost, getLatestVersion) |
| 10 | **awarenessEnv** | Provides cross-environment awareness for roaming |
| 11 | **key** | Retrieves and validates external key from provision DB |
| 12 | **keyACL** | Extracts ACL from tenant application or package |
| 13 | **gotoService** | Determines routing strategy and validates service |
| 14 | **mt** | Multi-tenant processing: security checks, URAC integration |
| 15 | **oauth** | OAuth2 server authorization or JWT verification |
| 16 | **traffic** | Rate limiting with public/private strategies |
| 17 | **lastSeen** | Async notification to URAC for user activity tracking |

#### Key Middleware Details

**File:** `mw/key/index.js`

The Key middleware is responsible for loading and validating external tenant keys. It extracts the key from the request headers and retrieves the associated tenant, application, and package data from the provision database.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           KEY MIDDLEWARE FLOW                                    │
└─────────────────────────────────────────────────────────────────────────────────┘

  Incoming Request
       │
       ▼
  ┌─────────────────┐
  │  Extract Key    │ req.get("key") - from headers
  │  from Headers   │
  └────────┬────────┘
           │
           ├─── No key? ──▶ next() (continue without key data)
           │
           ▼
  ┌─────────────────┐
  │  Get External   │ provision.getExternalKeyData(key, serviceConfig.key)
  │  Key Data       │
  └────────┬────────┘
           │
           ├─── Error/Not found? ──▶ Error 148 (Invalid or disabled key)
           │
           ▼
  ┌─────────────────┐
  │  Store keyObj   │ req.soajs.controller.serviceParams.keyObj = keyObj
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │  Validate Key   │ Check if key.env matches current environment
  │  Environment    │
  └────────┬────────┘
           │
           ├─── Mismatch? ──▶ Error 144 (Key not valid for this environment)
           │
           ▼
  ┌─────────────────────┐
  │  Network Package    │ Check keyObj.config.gateway.networkPackages
  │  Override           │ for network-based package substitution
  └────────┬────────────┘
           │
           ├─── Override found? ──▶ Replace keyObj.application.package
           │                        Log debug message
           ▼
  ┌─────────────────┐
  │  Get Package    │ provision.getPackageData(keyObj.application.package)
  │  Data           │
  └────────┬────────┘
           │
           ├─── Not found? ──▶ Error 149 (Package not found)
           │
           ▼
  ┌─────────────────┐
  │  Store packObj  │ req.soajs.controller.serviceParams.packObj = packObj
  └────────┬────────┘
           │
           ▼
       next()
```

**Key Object Structure (keyObj):**

Source: `soajs.core.modules/soajs.core/provision/mongo.js` → `getKeyFromDb()`

```javascript
{
  "key": "internal_key_value",               // Internal key identifier
  "tenant": {
    "id": "tenant_id",                       // Tenant MongoDB _id as string
    "code": "TCODE",                         // Tenant code (uppercase)
    "name": "Tenant Name",                   // Tenant display name
    "locked": false,                         // Whether tenant is locked
    "type": "product",                       // "product" or "client"
    "profile": {},                           // Tenant profile metadata
    "main": {                                // Only for type="client" tenants
      "id": "main_tenant_id",                // Parent tenant ID
      "code": "MAIN_TCODE"                   // Parent tenant code
    }
  },
  "application": {
    "product": "PRODUCT_CODE",               // Product code
    "package": "PRODUCT_PACK",               // Package code for ACL lookup
    "appId": "application_id",               // Application MongoDB _id as string
    "acl": { ... },                          // Environment-specific ACL (resolved)
    "acl_all_env": { ... }                   // Full ACL object for all environments
  },
  "extKeys": [                               // Array of external keys for this key
    {
      "extKey": "encrypted_external_key",    // The external key value
      "env": "DEV",                          // Environment this extKey is valid for
      "device": { ... },                     // Optional: Device restrictions
      "geo": { ... },                        // Optional: Geo restrictions
      "dashboardAccess": false,              // Whether key has dashboard access
      "expDate": null                        // Expiration date (null = no expiry)
    }
  ],
  "config": {                                // Environment-specific key configuration
    "gateway": {                             // Gateway-specific configuration
      "networkPackages": { ... },            // Network-based package override (see below)
      "validateTokenAccount": { ... },       // Token account validation (see below)
      "throttling": { ... }                  // Tenant-specific throttling (see below)
    },
    "serviceName": {                         // Service-specific URL override
      "url": "https://custom.api.com",       // Custom URL for this service
      "urls": [                              // Versioned URLs
        { "version": "1", "url": "https://v1.api.com" },
        { "version": "2", "url": "https://v2.api.com" }
      ]
    }
  },
  "_TTL": 86400000,                          // Cache TTL in milliseconds
  "_TIME": 1699999999999                     // Timestamp when loaded
}
```

**Package Object Structure (packObj):**

Source: `soajs.core.modules/soajs.core/provision/mongo.js` → `getPackagesFromDb()`

```javascript
{
  "acl": { ... },                            // Environment-specific ACL (resolved)
  "acl_all_env": { ... },                    // Full ACL object for all environments
  "_TTL": 86400000,                          // Cache TTL in milliseconds
  "_TIME": 1699999999999                     // Timestamp when loaded
}
```

**ACL Structure (within keyObj or packObj):**

```javascript
{
  "serviceName": {
    "version": {
      "access": true,                        // or false, or ["group1", "group2"]
      "apisPermission": "restricted",        // "restricted" means whitelist mode
      "get": {
        "apis": {
          "/api/path": {
            "access": ["owner", "admin"]     // Groups allowed for this API
          }
        }
      },
      "post": { ... },
      "put": { ... },
      "delete": { ... }
    }
  }
}
```

**Network Package Override:**

The key middleware supports network-based package substitution, allowing different packages to be loaded based on the network identifier configured in the custom registry.

Configuration in `keyObj.config.gateway.networkPackages`:

```javascript
{
  "gateway": {
    "networkPackages": {
      "mw": {                                // Network identifier (from lastSeen.network)
        "AVAPP": {                           // Product code (keyObj.application.product)
          "default": "AVAPP_DEFAU",          // Default package to use for this network
          "users": {                         // User-specific package mappings (for mt middleware)
            "AVAPP_EXMPL": "AVAPP_ALTRN"
          }
        }
      }
    }
  }
}
```

**How it works:**

The network package override operates at two levels:

1. **Key Middleware** (`mw/key/index.js`) - Applies `default` package override for all requests
2. **MT Middleware** (`mw/mt/urac.js`) - Applies `users` package override for authenticated user's allowed packages

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                 NETWORK PACKAGE OVERRIDE FLOW (Key Middleware)                   │
└─────────────────────────────────────────────────────────────────────────────────┘

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

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│            NETWORK PACKAGE OVERRIDE FLOW (MT Middleware - User ACL)              │
└─────────────────────────────────────────────────────────────────────────────────┘

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

**Validate Token Account:**

The `validateTokenAccount` configuration forces users to re-login when their email or phone changes, providing additional security for sensitive account changes.

**Middleware:** `mw/mt/utils.js` → `uracCheck()`

Configuration in `keyObj.config.gateway.validateTokenAccount`:

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

**How it works:**

- When a user's OAuth token is validated, the middleware compares the current user profile with the token's stored user data
- If `email: true` and the user's email has changed since token creation → Error 146 (invalid token)
- If `phone: true` and the user's phone has changed since token creation → Error 146 (invalid token)
- This forces users to re-authenticate after changing sensitive account information

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `validateTokenAccount.email` | boolean | `false` | Invalidate token if email changed |
| `validateTokenAccount.phone` | boolean | `false` | Invalidate token if phone changed |

---

**Tenant-Specific Throttling:**

Allows overriding the global throttling configuration at the tenant level.

**Middleware:** `mw/traffic/index.js`

Configuration in `keyObj.config.gateway.throttling`:

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

**Configuration Cascade (highest to lowest priority):**

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

**Service URL Override:**

Allows tenants to override the URL for specific services, useful for pointing to custom endpoints or different service versions.

**Middleware:** `mw/gotoService/lib/preRedirect.js`

Configuration in `keyObj.config[serviceName]`:

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

**How it works:**

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

**Error Codes:**

| Code | Description |
|------|-------------|
| 144 | External key is not valid for this environment |
| 148 | External key is invalid or has been disabled |
| 149 | Product package not found |

**Usage Notes:**

- The key is extracted from the `key` header (case-insensitive)
- If no key is provided, the middleware continues without setting key data
- Key environment validation ensures keys are only used in their designated environment
- Network package override allows different packages per network (requires `lastSeen.network` in custom registry)
- The keyObj and packObj are stored in `req.soajs.controller.serviceParams` for downstream middleware
- Subsequent middleware (keyACL, mt, oauth) depends on this data for ACL and authentication

### 2. Core Modules

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                               CORE MODULES                                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌──────────────────────┐      ┌──────────────────────┐                         │
│  │   REGISTRY MODULE    │      │   PROVISION MODULE   │                         │
│  ├──────────────────────┤      ├──────────────────────┤                         │
│  │ • Service definitions│      │ • Tenant management  │                         │
│  │ • Host mappings      │      │ • Application data   │                         │
│  │ • Version configs    │      │ • Key validation     │                         │
│  │ • Database configs   │      │ • Package ACLs       │                         │
│  │ • Service configs    │      │ • OAuth models       │                         │
│  │ • Custom gateway     │      │                      │                         │
│  │   settings           │      │                      │                         │
│  └──────────────────────┘      └──────────────────────┘                         │
│                                                                                  │
│  ┌──────────────────────┐      ┌──────────────────────┐                         │
│  │   AWARENESS ENGINE   │      │   DRIVER MODULE      │                         │
│  ├──────────────────────┤      ├──────────────────────┤                         │
│  │ • Service discovery  │      │ • Kubernetes client  │                         │
│  │ • Health tracking    │      │ • Docker Swarm       │                         │
│  │ • Load balancing     │      │ • Service lookups    │                         │
│  │ • Host resolution    │      │ • Node management    │                         │
│  │ • Version resolution │      │ • Health monitoring  │                         │
│  └──────────────────────┘      └──────────────────────┘                         │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 3. Routing Strategies

The `gotoService` middleware selects one of four routing strategies:

```
                            ┌─────────────────────────┐
                            │    Incoming Request     │
                            └───────────┬─────────────┘
                                        │
                                        ▼
                            ┌─────────────────────────┐
                            │   Extract Build Params  │
                            │   (service, version)    │
                            └───────────┬─────────────┘
                                        │
                    ┌───────────────────┼───────────────────┐
                    │                   │                   │
                    ▼                   ▼                   ▼
        ┌───────────────────┐ ┌─────────────────┐ ┌─────────────────────┐
        │  Is Passport      │ │  Is Roaming     │ │  Is Proxy Request   │
        │  Login Request?   │ │  Request?       │ │  (/soajs/proxy)?    │
        └─────────┬─────────┘ └────────┬────────┘ └──────────┬──────────┘
                  │                    │                     │
        ┌─────────▼─────────┐ ┌────────▼────────┐ ┌──────────▼──────────┐
        │    simpleRTS      │ │    roaming      │ │    proxyRequest     │
        │  (Lightweight     │ │  (Cross-env     │ │  (Service-to-       │
        │   OAuth flow)     │ │   forwarding)   │ │   service proxy)    │
        └───────────────────┘ └─────────────────┘ └─────────────────────┘
                                        │
                                        │ (Default)
                                        ▼
                            ┌─────────────────────────┐
                            │   redirectToService     │
                            │   (Standard REST proxy) │
                            └─────────────────────────┘
```

---

## Request Flow

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                              REQUEST LIFECYCLE                                    │
└──────────────────────────────────────────────────────────────────────────────────┘

  HTTP Request                                                      HTTP Response
       │                                                                  ▲
       ▼                                                                  │
┌──────────────┐                                                   ┌──────────────┐
│ 1. SOAJS MW  │ Initialize req.soajs context                      │ Error Handler│
│              │ Attach registry reference                         │              │
└──────┬───────┘                                                   └──────▲───────┘
       │                                                                  │
       ▼                                                                  │
┌──────────────┐                                                          │
│ 2. Security  │ CORS, IP Ban, Maintenance Mode                           │
│    Checks    │                                                          │
└──────┬───────┘                                                          │
       │                                                                  │
       ▼                                                                  │
┌──────────────┐                                                          │
│ 3. URL Parse │ Extract: serviceName, version, path                      │
│              │ Extract: key/token from header/query                     │
└──────┬───────┘                                                          │
       │                                                                  │
       ▼                                                                  │
┌──────────────┐                                                          │
│ 4. Service   │ Resolve service host via awareness                       │
│   Discovery  │ Support HA (K8s/Swarm) or custom                         │
└──────┬───────┘                                                          │
       │                                                                  │
       ▼                                                                  │
┌──────────────┐                                                          │
│ 5. Tenant    │ Load key data, validate tenant                           │
│   Resolution │ Extract ACL from package                                 │
└──────┬───────┘                                                          │
       │                                                                  │
       ▼                                                                  │
┌──────────────┐                                                          │
│ 6. Security  │ IP Whitelist → Geo Check → Device Check                  │
│   Pipeline   │ → ACL Check → OAuth Check                                │
└──────┬───────┘                                                          │
       │                                                                  │
       ▼                                                                  │
┌──────────────┐                                                          │
│ 7. Traffic   │ Rate limiting with configurable                          │
│   Control    │ strategies and storage backends                          │
└──────┬───────┘                                                          │
       │                                                                  │
       ▼                                                                  │
┌──────────────────────────────────────────────────────────────────┬──────┘
│ 8. PROXY TO SERVICE                                              │
│                                                                  │
│  ┌─────────────────┐    ┌─────────────────┐    ┌──────────────┐ │
│  │  Resolve Host   │───▶│  Build Request  │───▶│  HTTP Proxy  │ │
│  │  (awareness)    │    │  (headers/body) │    │  (forward)   │ │
│  └─────────────────┘    └─────────────────┘    └──────────────┘ │
│                                                       │         │
│                                                       ▼         │
│                                            ┌──────────────────┐ │
│                                            │  Target Service  │ │
│                                            │  (Microservice)  │ │
│                                            └──────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Multi-Tenant Security Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         MULTI-TENANT SECURITY CHECKS                             │
└─────────────────────────────────────────────────────────────────────────────────┘

  Incoming Request with Key
          │
          ▼
  ┌───────────────────┐
  │ 1. IP Whitelist   │ Check application-level IP restrictions
  │    Validation     │ FAIL → 403 Forbidden
  └─────────┬─────────┘
            │ PASS
            ▼
  ┌───────────────────┐
  │ 2. Geo-Location   │ Validate request origin geography
  │    Check          │ FAIL → 403 Forbidden
  └─────────┬─────────┘
            │ PASS
            ▼
  ┌───────────────────┐
  │ 3. Device         │ Verify device fingerprint
  │    Fingerprint    │ FAIL → 403 Forbidden
  └─────────┬─────────┘
            │ PASS
            ▼
  ┌───────────────────┐
  │ 4. ACL Check      │ Validate service/API access permission
  │                   │ FAIL → 403 Forbidden
  └─────────┬─────────┘
            │ PASS
            ▼
  ┌───────────────────┐
  │ 5. OAuth Check    │ Validate token (OAuth2 or JWT)
  │                   │ FAIL → 401 Unauthorized
  └─────────┬─────────┘
            │ PASS
            ▼
  ┌───────────────────┐
  │ 6. URAC Profile   │ Load user profile and groups
  │    Resolution     │ Resolve user-specific ACL
  └─────────┬─────────┘
            │
            ▼
     Continue to Service
```

---

## Service Discovery Modes

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           SERVICE DISCOVERY MODES                                │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────┐    ┌─────────────────────────────────────────┐
│        CUSTOM MODE              │    │            HA MODE                       │
│      (Non-Kubernetes)           │    │     (Kubernetes / Docker Swarm)          │
├─────────────────────────────────┤    ├─────────────────────────────────────────┤
│                                 │    │                                          │
│  ┌─────────────────────────┐    │    │  ┌──────────────────────────────────┐   │
│  │      Registry DB        │    │    │  │        Cluster API               │   │
│  │   (MongoDB/Local)       │    │    │  │    (K8s API / Docker API)        │   │
│  └───────────┬─────────────┘    │    │  └────────────────┬─────────────────┘   │
│              │                  │    │                   │                      │
│              ▼                  │    │                   ▼                      │
│  ┌─────────────────────────┐    │    │  ┌──────────────────────────────────┐   │
│  │   Static Host List      │    │    │  │    Dynamic Service Discovery     │   │
│  │   per Service/Version   │    │    │  │    via Labels/Selectors          │   │
│  └───────────┬─────────────┘    │    │  └────────────────┬─────────────────┘   │
│              │                  │    │                   │                      │
│              ▼                  │    │                   ▼                      │
│  ┌─────────────────────────┐    │    │  ┌──────────────────────────────────┐   │
│  │   In-Memory Health      │    │    │  │   Automatic Health Monitoring    │   │
│  │   State Tracking        │    │    │  │   via Pod/Container Status       │   │
│  └───────────┬─────────────┘    │    │  └────────────────┬─────────────────┘   │
│              │                  │    │                   │                      │
│              ▼                  │    │                   ▼                      │
│  ┌─────────────────────────┐    │    │  ┌──────────────────────────────────┐   │
│  │   Round-Robin           │    │    │  │   Cluster Load Balancing         │   │
│  │   Selection             │    │    │  │   (via Service/Ingress)          │   │
│  └─────────────────────────┘    │    │  └──────────────────────────────────┘   │
│                                 │    │                                          │
└─────────────────────────────────┘    └─────────────────────────────────────────┘
```

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                 DATA FLOW                                        │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                              MONGODB DATABASES                                   │
│                                                                                  │
│   ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────────────┐ │
│   │    Core DB      │    │    Meta DB      │    │    Throttle DB (Optional)   │ │
│   ├─────────────────┤    ├─────────────────┤    ├─────────────────────────────┤ │
│   │ • Environment   │    │ • Tenant-       │    │ • Rate limit counters       │ │
│   │ • Tenants       │    │   specific      │    │ • Request windows           │ │
│   │ • Applications  │    │   databases     │    │ • IP-based tracking         │ │
│   │ • Keys          │    │ • Custom data   │    │                             │ │
│   │ • Packages      │    │                 │    │                             │ │
│   │ • Services      │    │                 │    │                             │ │
│   │ • OAuth tokens  │    │                 │    │                             │ │
│   └────────┬────────┘    └────────┬────────┘    └──────────────┬──────────────┘ │
│            │                      │                            │                 │
└────────────┼──────────────────────┼────────────────────────────┼─────────────────┘
             │                      │                            │
             ▼                      ▼                            ▼
    ┌─────────────────────────────────────────────────────────────────────────────┐
    │                         SOAJS CONTROLLER                                     │
    │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐ │
    │  │   Registry   │  │   Provision  │  │    URAC      │  │     Traffic      │ │
    │  │    Module    │  │    Module    │  │   Driver     │  │     Module       │ │
    │  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────────┘ │
    └─────────────────────────────────────────────────────────────────────────────┘
```

---

## Configuration Model

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           CONFIGURATION HIERARCHY                                │
└─────────────────────────────────────────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────────────────────────────────┐
    │                    ENVIRONMENT VARIABLES (Highest Priority)              │
    ├─────────────────────────────────────────────────────────────────────────┤
    │  SOAJS_ENV              │  Environment code (default: "dev")            │
    │  SOAJS_SOLO             │  Solo mode flag (local registry)              │
    │  SOAJS_DEPLOY_HA        │  HA mode: "kubernetes" | "swarm"              │
    │  SOAJS_MAX_BODY_SIZE    │  Max request body (default: 10MB)             │
    │  SOAJS_SENSITIVE_ENVS   │  Sensitive env codes (default: ["dashboard"]) │
    └─────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
    ┌─────────────────────────────────────────────────────────────────────────┐
    │                         SERVICE CONFIGURATION                            │
    ├─────────────────────────────────────────────────────────────────────────┤
    │  config.js              │  Service metadata (name, version, port)       │
    │  profiles/single.js     │  MongoDB connection profile                   │
    │  profiles/solo.js       │  Local file-based profile                     │
    └─────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
    ┌─────────────────────────────────────────────────────────────────────────┐
    │                       REGISTRY (from Core DB)                            │
    ├─────────────────────────────────────────────────────────────────────────┤
    │  services               │  Service definitions (ports, hosts, versions) │
    │  serviceConfig          │  Global configs (throttling, CORS, OAuth)     │
    │  custom.gateway         │  Gateway-specific settings                    │
    │  dbs                    │  Database connection configs                  │
    └─────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
    ┌─────────────────────────────────────────────────────────────────────────┐
    │                      TENANT/APPLICATION (Lowest Priority)                │
    ├─────────────────────────────────────────────────────────────────────────┤
    │  Tenant.application     │  App-specific OAuth, ACL overrides            │
    │  Package.acl            │  Package-level access control                 │
    └─────────────────────────────────────────────────────────────────────────┘
```

---

## Rate Limiting Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           RATE LIMITING (THROTTLING)                             │
└─────────────────────────────────────────────────────────────────────────────────┘

    ┌───────────────────────────────────────────────────────────────────────────┐
    │                         STRATEGY SELECTION                                 │
    │                                                                            │
    │   ┌─────────────────────────┐        ┌─────────────────────────┐          │
    │   │   publicAPIStrategy     │        │   privateAPIStrategy    │          │
    │   │   (Unauthenticated)     │        │   (Authenticated)       │          │
    │   └───────────┬─────────────┘        └───────────┬─────────────┘          │
    │               │                                  │                         │
    │               └──────────────┬───────────────────┘                         │
    │                              ▼                                              │
    └──────────────────────────────┬──────────────────────────────────────────────┘
                                   │
                                   ▼
    ┌───────────────────────────────────────────────────────────────────────────┐
    │                         CONFIGURATION CASCADE                              │
    │                                                                            │
    │   1. Service-specific: gateway.throttling                                  │
    │   2. Custom registry: gateway.value.traffic.throttling                     │
    │   3. Global default: serviceConfig.throttling                              │
    └──────────────────────────────┬──────────────────────────────────────────────┘
                                   │
                                   ▼
    ┌───────────────────────────────────────────────────────────────────────────┐
    │                         STORAGE BACKENDS                                   │
    │                                                                            │
    │   ┌─────────────────────────┐        ┌─────────────────────────┐          │
    │   │       Memory            │        │       MongoDB           │          │
    │   │   (Fast, volatile)      │        │   (Persistent, shared)  │          │
    │   └─────────────────────────┘        └─────────────────────────┘          │
    └──────────────────────────────┬──────────────────────────────────────────────┘
                                   │
                                   ▼
    ┌───────────────────────────────────────────────────────────────────────────┐
    │                         RESPONSE HEADERS                                   │
    │                                                                            │
    │   X-RateLimit-Limit      │  Maximum requests allowed                      │
    │   X-RateLimit-Remaining  │  Requests remaining in window                  │
    │   Retry-After            │  Seconds until window resets                   │
    └───────────────────────────────────────────────────────────────────────────┘
```

---

## External Integrations

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          EXTERNAL INTEGRATIONS                                   │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                  │
│  ┌──────────────────────┐    ┌──────────────────────┐    ┌────────────────────┐ │
│  │    OAuth Service     │    │    URAC Service      │    │   SOA Monitor      │ │
│  ├──────────────────────┤    ├──────────────────────┤    ├────────────────────┤ │
│  │                      │    │                      │    │                    │ │
│  │  Endpoints:          │    │  Endpoints:          │    │  Endpoints:        │ │
│  │  • /token            │    │  • /user/getprofile  │    │  • /monitor/item   │ │
│  │  • /authorization    │    │  • /user/last/seen   │    │                    │ │
│  │                      │    │                      │    │                    │ │
│  │  Functions:          │    │  Functions:          │    │  Functions:        │ │
│  │  • Token validation  │    │  • User profiles     │    │  • Request metrics │ │
│  │  • Token refresh     │    │  • Group resolution  │    │  • Response times  │ │
│  │  • Authorization     │    │  • Activity tracking │    │  • Error tracking  │ │
│  │                      │    │  • ACL by user       │    │                    │ │
│  └──────────────────────┘    └──────────────────────┘    └────────────────────┘ │
│                                                                                  │
│  ┌──────────────────────┐    ┌──────────────────────┐                           │
│  │   Kubernetes API     │    │   Docker Swarm API   │                           │
│  ├──────────────────────┤    ├──────────────────────┤                           │
│  │                      │    │                      │                           │
│  │  Functions:          │    │  Functions:          │                           │
│  │  • Service discovery │    │  • Service discovery │                           │
│  │  • Pod listing       │    │  • Task listing      │                           │
│  │  • Health checks     │    │  • Health checks     │                           │
│  │  • Label selectors   │    │  • Label selectors   │                           │
│  │                      │    │                      │                           │
│  └──────────────────────┘    └──────────────────────┘                           │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          DEPLOYMENT ARCHITECTURE                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

                        ┌─────────────────────────────┐
                        │       Load Balancer         │
                        │    (External/Cloud LB)      │
                        └─────────────┬───────────────┘
                                      │
              ┌───────────────────────┼───────────────────────┐
              │                       │                       │
              ▼                       ▼                       ▼
    ┌─────────────────────┐ ┌─────────────────────┐ ┌─────────────────────┐
    │  Controller Node 1  │ │  Controller Node 2  │ │  Controller Node N  │
    │  ┌───────────────┐  │ │  ┌───────────────┐  │ │  ┌───────────────┐  │
    │  │  Main: 4000   │  │ │  │  Main: 4000   │  │ │  │  Main: 4000   │  │
    │  │  Maint: 5000  │  │ │  │  Maint: 5000  │  │ │  │  Maint: 5000  │  │
    │  └───────────────┘  │ │  └───────────────┘  │ │  └───────────────┘  │
    └─────────┬───────────┘ └─────────┬───────────┘ └─────────┬───────────┘
              │                       │                       │
              └───────────────────────┼───────────────────────┘
                                      │
                                      ▼
    ┌─────────────────────────────────────────────────────────────────────────────┐
    │                         SHARED INFRASTRUCTURE                                │
    │                                                                              │
    │   ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐ │
    │   │  MongoDB Cluster│  │ Kubernetes/Swarm│  │     Microservices           │ │
    │   │  (Core DB)      │  │ (Service Mesh)  │  │     (Backend Services)      │ │
    │   └─────────────────┘  └─────────────────┘  └─────────────────────────────┘ │
    │                                                                              │
    └─────────────────────────────────────────────────────────────────────────────┘
```

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `server/controller.js` | Main gateway orchestration (464 lines) |
| `server/maintenance.js` | Health check and admin server |
| `modules/registry/index.js` | Configuration loading and management |
| `modules/driver/index.js` | Infrastructure abstraction layer |
| `mw/key/index.js` | External key loading and validation |
| `mw/keyACL/index.js` | ACL extraction from key/package |
| `mw/gotoService/index.js` | Route selection and service discovery |
| `mw/mt/index.js` | Multi-tenant processing |
| `mw/traffic/index.js` | Rate limiting implementation |
| `lib/request.js` | HTTP proxy and request utilities |
| `utilities/utils.js` | Error handlers and utilities |

---

## Custom Registry Gateway Configuration

The gateway behavior can be customized at runtime through the custom registry configuration stored in the Core DB. These settings are accessed via `registry.custom.gateway.value.*` and `registry.custom.oauth.value.*`.

### Configuration Structure Overview

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

### 1. Maintenance Mode

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

### 2. IP Blacklist (IP2Ban)

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

### 3. Rate Limiting (Throttling)

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
1. Tenant service config: `servicesConfig.gateway.throttling`
2. Custom registry: `registry.custom.gateway.value.traffic.throttling`
3. Global default: `registry.serviceConfig.throttling`

---

### 4. Multi-Tenant IP Whitelist

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

### 5. User Activity Tracking (Last Seen)

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

### 6. Request Monitoring

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

### 7. Request Timeout Renewal

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

### 8. OAuth Roaming (Cross-Environment)

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

### 9. PIN Login Wrapper

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

### 10. PIN Login API Whitelist

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

### Complete Configuration Example

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

### Middleware Processing Order

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

---

## Built-in Gateway Routes

The SOAJS Controller provides special built-in routes that are handled directly by the gateway rather than being proxied to backend services.

### Route Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          BUILT-IN GATEWAY ROUTES                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────────────────────────────────────┐
    │                                                                              │
    │   /soajs/acl                                                                │
    │   ├── Method: GET                                                           │
    │   ├── Purpose: Retrieve ACL/permissions for authenticated user              │
    │   ├── Requires: External key (header), OAuth token (query)                  │
    │   └── Returns: ACL, packages, user info, tenant info                        │
    │                                                                              │
    │   /soajs/proxy                                                              │
    │   ├── Method: Any                                                           │
    │   ├── Purpose: Proxy requests to external URLs or cross-environment         │
    │   ├── Requires: proxyRoute query parameter                                  │
    │   └── Optional: __env, tCode, extKey parameters                             │
    │                                                                              │
    │   /proxy/redirect  (DEPRECATED → use /soajs/proxy)                          │
    │                                                                              │
    └─────────────────────────────────────────────────────────────────────────────┘
```

---

### 1. ACL Route (`/soajs/acl`)

**Endpoint:** `GET /soajs/acl`

**Purpose:** Returns the Access Control List (ACL) and permissions for the currently authenticated user. This route is useful for frontend applications to determine what services and APIs the user has access to.

**Required Headers:**

| Header | Description |
|--------|-------------|
| `key` | External tenant key (required) |

**Query Parameters:**

| Parameter | Description |
|-----------|-------------|
| `access_token` | OAuth2 access token for user-specific ACL |

**Response Structure:**

```javascript
{
  "acl": {                          // Raw ACL from tenant application or package
    "serviceName": {
      "version": {
        "access": true,
        "apisPermission": "restricted",
        "get": { "apis": { "/api/path": {} } }
      }
    }
  },
  "finalACL": {                     // Computed ACL with latest versions
    "serviceName": {
      "version": "1",
      "get": ["/api/path"]          // Allowed APIs per method (if restricted)
    }
  },
  "packages": ["PACKAGE_CODE"],     // Allowed product packages
  "urac": {                         // User info (if authenticated)
    "_id": "user_id"
  },
  "tenant": {                       // Tenant info
    "id": "tenant_id",
    "name": "Tenant Name",
    "code": "TCODE",
    "type": "product"
  }
}
```

**Example:**

```bash
# Get ACL for authenticated user
curl -X GET "http://api.example.com/soajs/acl?access_token=YOUR_TOKEN" \
  -H "key: YOUR_EXTERNAL_KEY"
```

**Error Codes:**

| Code | Description |
|------|-------------|
| 132 | Missing or invalid external key |
| 400 | OAuth token required but not provided |

---

### 2. Proxy Route (`/soajs/proxy`)

**Endpoint:** `ANY /soajs/proxy`

**Purpose:** Proxies requests to external URLs or to services in other SOAJS environments. Supports cross-environment communication with automatic key resolution.

**Required Headers:**

| Header | Description |
|--------|-------------|
| `key` | External tenant key |

**Query Parameters:**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `proxyRoute` | Yes | URL-encoded target route (full URL or service path) |
| `__env` | No | Target environment code (e.g., "STG", "PROD") for cross-environment |
| `tCode` | No | Tenant code for automatic key lookup in target environment |
| `extKey` | No | Explicit external key to use for target environment |
| `access_token` | No | OAuth token to forward |

**Usage Modes:**

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           PROXY REQUEST MODES                                    │
└─────────────────────────────────────────────────────────────────────────────────┘

  Mode 1: Direct URL Proxy
  ─────────────────────────
    proxyRoute=http://service:port/path

    Request flows directly to the specified URL.
    No environment lookup required.

  Mode 2: Cross-Environment Proxy
  ────────────────────────────────
    proxyRoute=/service/api&__env=PROD&tCode=TENANT

    1. Loads target environment registry
    2. Looks up tenant's external key for that environment
    3. Constructs URL from registry (protocol://domain:port)
    4. Forwards request with remote ext key

  Mode 3: Cross-Environment with Explicit Key
  ───────────────────────────────────────────
    proxyRoute=/service/api&__env=PROD&extKey=xxx

    Uses the provided extKey instead of looking up tenant key.

└─────────────────────────────────────────────────────────────────────────────────┘
```

**Examples:**

```bash
# Direct URL proxy
curl -X GET "http://api.example.com/soajs/proxy?proxyRoute=http%3A%2F%2F127.0.0.1%3A4002%2FCheckPhoneNumber&access_token=TOKEN" \
  -H "key: YOUR_EXTERNAL_KEY"

# Cross-environment proxy with automatic key resolution
curl -X GET "http://api.example.com/soajs/proxy?proxyRoute=%2Furac%2FgetUser&__env=STG&access_token=TOKEN" \
  -H "key: YOUR_EXTERNAL_KEY"

# Cross-environment proxy with explicit key
curl -X POST "http://api.example.com/soajs/proxy?proxyRoute=%2Fservice%2Fapi&__env=PROD&extKey=REMOTE_KEY" \
  -H "key: YOUR_EXTERNAL_KEY" \
  -H "Content-Type: application/json" \
  -d '{"data": "value"}'
```

**Error Codes:**

| Code | Description |
|------|-------------|
| 135 | Invalid proxy URL or connection failed |
| 137 | No external key found for tenant in target environment |
| 139 | Missing proxyRoute parameter |
| 207 | Failed to load target environment registry |
| 208 | Target environment registry missing protocol/domain/port |

**Request Flow:**

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                           PROXY REQUEST FLOW                                      │
└──────────────────────────────────────────────────────────────────────────────────┘

  Client Request
       │
       ▼
  ┌─────────────────┐
  │  Parse Query    │
  │  Parameters     │
  └────────┬────────┘
           │
           ├─── proxyRoute (required)
           ├─── __env (optional)
           ├─── tCode (optional)
           └─── extKey (optional)
           │
           ▼
  ┌─────────────────┐    ┌─────────────────┐
  │  __env          │ NO │  Direct Proxy   │
  │  provided?      │───▶│  to proxyRoute  │
  └────────┬────────┘    └─────────────────┘
           │ YES
           ▼
  ┌─────────────────┐
  │  Load Remote    │
  │  Environment    │
  │  Registry       │
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐    ┌─────────────────┐
  │  extKey         │YES │  Use Provided   │
  │  provided?      │───▶│  extKey         │
  └────────┬────────┘    └────────┬────────┘
           │ NO                   │
           ▼                      │
  ┌─────────────────┐             │
  │  Lookup Tenant  │             │
  │  Key for Env    │             │
  └────────┬────────┘             │
           │                      │
           └──────────┬───────────┘
                      │
                      ▼
  ┌─────────────────────────────────────────┐
  │  Construct Full URL                     │
  │  protocol://domain:port/proxyRoute      │
  └────────────────────┬────────────────────┘
                       │
                       ▼
  ┌─────────────────────────────────────────┐
  │  Forward Request with Headers           │
  │  • soajs_roaming: source environment    │
  │  • key: remote ext key (if applicable)  │
  │  • Original headers (except host)       │
  └────────────────────┬────────────────────┘
                       │
                       ▼
                 Target Service
```

---

### 3. Deprecated: `/proxy/redirect`

**Status:** DEPRECATED

**Replacement:** Use `/soajs/proxy` instead

This route has identical functionality to `/soajs/proxy` but is deprecated. The gateway will log a warning when this route is used:

```
Route: [/proxy/redirect] is deprecated. You should use [/soajs/proxy].
```

---

## Summary

The SOAJS Controller Gateway is a comprehensive API Gateway solution that provides:

- **Multi-tenant Architecture**: Full isolation between tenants with configurable ACLs
- **Service Discovery**: Support for both static registry and dynamic HA modes (K8s/Swarm)
- **Security**: OAuth2/JWT authentication, IP whitelisting, geo-blocking, device fingerprinting
- **Traffic Management**: Configurable rate limiting with multiple storage backends
- **Request Proxying**: HTTP proxy with monitoring, timeout management, and heartbeat renewal
- **Observability**: Integration with monitoring services and comprehensive logging
- **High Availability**: Horizontal scaling with shared state in MongoDB
