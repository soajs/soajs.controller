# Data Flow

Database interactions and data flow in the SOAJS Controller Gateway.

## Database Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                 DATA FLOW                                       │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                              MONGODB DATABASES                                  │
│                                                                                 │
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
│            │                      │                            │                │
└────────────┼──────────────────────┼────────────────────────────┼────────────────┘
             │                      │                            │
             ▼                      ▼                            ▼
    ┌─────────────────────────────────────────────────────────────────────────────┐
    │                         SOAJS CONTROLLER                                    │
    │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐ │
    │  │   Registry   │  │   Provision  │  │    URAC      │  │     Traffic      │ │
    │  │    Module    │  │    Module    │  │   Driver     │  │     Module       │ │
    │  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────────┘ │
    └─────────────────────────────────────────────────────────────────────────────┘
```

## Core Database Collections

The Core DB contains the central configuration for the SOAJS platform.

### Environment Registry

**Collection:** `environment`

Stores environment-specific configuration including services, hosts, and settings.

### Tenants

**Collection:** `tenants`

Stores tenant information, applications, and keys.

### Products & Packages

**Collection:** `products`

Stores product definitions and package ACLs.

### OAuth Tokens

**Collection:** `oauth_tokens`

Stores OAuth2 access and refresh tokens.

## Module Interactions

### Registry Module

**Source:** `soajs.core.modules/soajs.core/registry`

- Loads environment configuration from Core DB
- Caches registry data in memory
- Provides service definitions and hosts
- Manages custom gateway settings

### Provision Module

**Source:** `soajs.core.modules/soajs.core/provision`

- Loads tenant/key data
- Validates external keys
- Retrieves package ACLs
- Caches provision data with TTL

### URAC Driver

**Source:** `soajs.urac.driver`

- Loads user profiles
- Resolves user groups
- Manages user-specific ACLs

### Traffic Module

**File:** `mw/traffic/index.js`

- Tracks request counts
- Enforces rate limits
- Supports memory or MongoDB storage

## Data Caching

The gateway implements multi-level caching:

### Registry Cache

- Cached in memory
- Refreshed via maintenance endpoint
- TTL-based expiration

### Provision Cache

- Per-key caching with TTL
- Configurable via `_TTL` field
- Refreshed on cache miss

### Token Cache

- OAuth tokens validated against DB
- Short-lived cache for performance

## Throttle Database

When using MongoDB for rate limiting (`traffic.model: "mongo"`):

**Collection:** `throttle`

```javascript
{
  "_id": ObjectId("..."),
  "key": "192.168.1.1:oauth:/token",  // IP:service:api
  "count": 15,                         // Request count
  "timestamp": ISODate("..."),         // Window start
  "window": 60000                      // Window size (ms)
}
```
