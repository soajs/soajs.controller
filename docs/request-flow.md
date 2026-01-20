# Request Flow

The complete request lifecycle through the SOAJS Controller Gateway.

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                              REQUEST LIFECYCLE                                   │
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
│  ┌─────────────────┐    ┌─────────────────┐    ┌──────────────┐  │
│  │  Resolve Host   │───▶│  Build Request  │───▶│  HTTP Proxy  │  │
│  │  (awareness)    │    │  (headers/body) │    │  (forward)   │  │
│  └─────────────────┘    └─────────────────┘    └──────────────┘  │
│                                                       │          │
│                                                       ▼          │
│                                            ┌──────────────────┐  │
│                                            │  Target Service  │  │
│                                            │  (Microservice)  │  │
│                                            └──────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

## Stage Details

### 1. SOAJS Initialization

**Middleware:** `mw/soajs/index.js`

- Creates `req.soajs` object
- Attaches registry reference
- Sets up logging context
- Initializes controller params

### 2. Security Checks

**Middlewares:** `mw/cors`, `mw/ip2ban`, `mw/maintenanceMode`

- CORS preflight handling
- IP blacklist enforcement
- Maintenance mode check

### 3. URL Parsing

**Middleware:** `mw/url/index.js`

- Extracts service name from URL path
- Parses version number (if provided)
- Extracts API path

### 4. Service Discovery

**Middleware:** `mw/awareness/index.js`

- Attaches `getHost()` and `getLatestVersion()` functions
- Supports both custom and HA modes

### 5. Tenant Resolution

**Middlewares:** `mw/key`, `mw/keyACL`

- Loads external key data
- Validates key for environment
- Extracts ACL from package or application

### 6. Security Pipeline

**Middleware:** `mw/mt/index.js`

- IP whitelist validation
- Geo-location checks
- Device fingerprint verification
- ACL enforcement
- OAuth token validation

### 7. Traffic Control

**Middleware:** `mw/traffic/index.js`

- Rate limiting per strategy
- Response headers (X-RateLimit-*)

### 8. Proxy to Service

**Middleware:** `mw/gotoService/*`

- Resolves target host
- Builds proxy request
- Forwards to microservice
- Returns response to client

## Configuration Model

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           CONFIGURATION HIERARCHY                               │
└─────────────────────────────────────────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────────────────────────────────┐
    │                    ENVIRONMENT VARIABLES (Highest Priority)             │
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
    │                         SERVICE CONFIGURATION                           │
    ├─────────────────────────────────────────────────────────────────────────┤
    │  config.js              │  Service metadata (name, version, port)       │
    │  profiles/single.js     │  MongoDB connection profile                   │
    │  profiles/solo.js       │  Local file-based profile                     │
    └─────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
    ┌─────────────────────────────────────────────────────────────────────────┐
    │                       REGISTRY (from Core DB)                           │
    ├─────────────────────────────────────────────────────────────────────────┤
    │  services               │  Service definitions (ports, hosts, versions) │
    │  serviceConfig          │  Global configs (throttling, CORS, OAuth)     │
    │  custom.gateway         │  Gateway-specific settings                    │
    │  dbs                    │  Database connection configs                  │
    └─────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
    ┌─────────────────────────────────────────────────────────────────────────┐
    │                      TENANT/APPLICATION (Lowest Priority)               │
    ├─────────────────────────────────────────────────────────────────────────┤
    │  Tenant.application     │  App-specific OAuth, ACL overrides            │
    │  Package.acl            │  Package-level access control                 │
    └─────────────────────────────────────────────────────────────────────────┘
```

## Rate Limiting Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           RATE LIMITING (THROTTLING)                            │
└─────────────────────────────────────────────────────────────────────────────────┘

    ┌────────────────────────────────────────────────────────────────────────────┐
    │                         STRATEGY SELECTION                                 │
    │                                                                            │
    │   ┌─────────────────────────┐        ┌─────────────────────────┐           │
    │   │   publicAPIStrategy     │        │   privateAPIStrategy    │           │
    │   │   (Unauthenticated)     │        │   (Authenticated)       │           │
    │   └───────────┬─────────────┘        └───────────┬─────────────┘           │
    │               │                                  │                         │
    │               └──────────────┬───────────────────┘                         │
    │                              ▼                                             │
    └──────────────────────────────┬─────────────────────────────────────────────┘
                                   │
                                   ▼
    ┌────────────────────────────────────────────────────────────────────────────┐
    │                         CONFIGURATION CASCADE                              │
    │                                                                            │
    │   1. Service-specific: gateway.throttling                                  │
    │   2. Custom registry: gateway.value.traffic.throttling                     │
    │   3. Global default: serviceConfig.throttling                              │
    └──────────────────────────────┬─────────────────────────────────────────────┘
                                   │
                                   ▼
    ┌────────────────────────────────────────────────────────────────────────────┐
    │                         STORAGE BACKENDS                                   │
    │                                                                            │
    │   ┌─────────────────────────┐        ┌─────────────────────────┐           │
    │   │       Memory            │        │       MongoDB           │           │
    │   │   (Fast, volatile)      │        │   (Persistent, shared)  │           │
    │   └─────────────────────────┘        └─────────────────────────┘           │
    └──────────────────────────────┬─────────────────────────────────────────────┘
                                   │
                                   ▼
    ┌────────────────────────────────────────────────────────────────────────────┐
    │                         RESPONSE HEADERS                                   │
    │                                                                            │
    │   X-RateLimit-Limit      │  Maximum requests allowed                       │
    │   X-RateLimit-Remaining  │  Requests remaining in window                   │
    │   Retry-After            │  Seconds until window resets                    │
    └────────────────────────────────────────────────────────────────────────────┘
```
