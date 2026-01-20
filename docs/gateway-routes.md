# Built-in Gateway Routes

The SOAJS Controller provides special built-in routes that are handled directly by the gateway rather than being proxied to backend services.

## Route Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          BUILT-IN GATEWAY ROUTES                                │
└─────────────────────────────────────────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────────────────────────────────────┐
    │                                                                             │
    │   /soajs/acl                                                                │
    │   ├── Method: GET                                                           │
    │   ├── Purpose: Retrieve ACL/permissions for authenticated user              │
    │   ├── Requires: External key (header), OAuth token (query)                  │
    │   └── Returns: ACL, packages, user info, tenant info                        │
    │                                                                             │
    │   /soajs/proxy                                                              │
    │   ├── Method: Any                                                           │
    │   ├── Purpose: Proxy requests to external URLs or cross-environment         │
    │   ├── Requires: proxyRoute query parameter                                  │
    │   └── Optional: __env, tCode, extKey parameters                             │
    │                                                                             │
    │   /proxy/redirect  (DEPRECATED → use /soajs/proxy)                          │
    │                                                                             │
    └─────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. ACL Route (`/soajs/acl`)

**Endpoint:** `GET /soajs/acl`

**Purpose:** Returns the Access Control List (ACL) and permissions for the currently authenticated user. This route is useful for frontend applications to determine what services and APIs the user has access to.

### Required Headers

| Header | Description |
|--------|-------------|
| `key` | External tenant key (required) |

### Query Parameters

| Parameter | Description |
|-----------|-------------|
| `access_token` | OAuth2 access token for user-specific ACL |

### Response Structure

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

### Example

```bash
# Get ACL for authenticated user
curl -X GET "http://api.example.com/soajs/acl?access_token=YOUR_TOKEN" \
  -H "key: YOUR_EXTERNAL_KEY"
```

### Error Codes

| Code | Description |
|------|-------------|
| 132 | Missing or invalid external key |
| 400 | OAuth token required but not provided |

---

## 2. Proxy Route (`/soajs/proxy`)

**Endpoint:** `ANY /soajs/proxy`

**Purpose:** Proxies requests to external URLs or to services in other SOAJS environments. Supports cross-environment communication with automatic key resolution.

### Required Headers

| Header | Description |
|--------|-------------|
| `key` | External tenant key |

### Query Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `proxyRoute` | Yes | URL-encoded target route (full URL or service path) |
| `__env` | No | Target environment code (e.g., "STG", "PROD") for cross-environment |
| `tCode` | No | Tenant code for automatic key lookup in target environment |
| `extKey` | No | Explicit external key to use for target environment |
| `access_token` | No | OAuth token to forward |

### Usage Modes

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           PROXY REQUEST MODES                                   │
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

### Examples

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

### Error Codes

| Code | Description |
|------|-------------|
| 135 | Invalid proxy URL or connection failed |
| 137 | No external key found for tenant in target environment |
| 139 | Missing proxyRoute parameter |
| 207 | Failed to load target environment registry |
| 208 | Target environment registry missing protocol/domain/port |

### Request Flow

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                           PROXY REQUEST FLOW                                     │
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

## 3. Deprecated: `/proxy/redirect`

**Status:** DEPRECATED

**Replacement:** Use `/soajs/proxy` instead

This route has identical functionality to `/soajs/proxy` but is deprecated. The gateway will log a warning when this route is used:

```
Route: [/proxy/redirect] is deprecated. You should use [/soajs/proxy].
```
