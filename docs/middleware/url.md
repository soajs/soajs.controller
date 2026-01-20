# URL Middleware

**File:** `mw/url/index.js`

**Order:** 8

The URL middleware parses the request URL and extracts service routing information.

## Purpose

- Parses URL into components (service name, version, path)
- Validates service exists in registry
- Normalizes header and query parameters (key, access_token)
- Creates `req.soajs.controller.serviceParams` structure

## Flow

```
  Incoming Request
       │
       ▼
  ┌─────────────────┐
  │  Ensure         │ if (!req.soajs.controller)
  │  Controller     │    req.soajs.controller = {}
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │  Parse URL      │ url.parse(req.url, true)
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │  Extract        │ service_n, service_v, service_nv
  │  Service Info   │ serviceInfo, path
  └────────┬────────┘
           │
           ├─── No service name? ──▶ Error 136
           │
           ├─── Service not in registry? ──▶ Error 130
           │
           ▼
  ┌─────────────────┐
  │  Normalize      │ key, access_token from headers/query
  │  Auth Params    │
  └────────┬────────┘
           │
           ▼
       next()
```

## URL Parsing

**URL Format:** `/{service}/{version}/{path}`

| Component | Example | Description |
|-----------|---------|-------------|
| `service_n` | `oauth` | Service name |
| `service_v` | `1` | Service version (optional) |
| `service_nv` | `oauth/1` | Service with version |
| `path` | `/token` | API path |

**Examples:**
```
/oauth/token         → service: oauth, version: null, path: /token
/oauth/1/token       → service: oauth, version: 1, path: /token
/urac/3/user/login   → service: urac, version: 3, path: /user/login
```

## Properties Set

| Property | Description |
|----------|-------------|
| `req.soajs.controller.serviceParams.service_n` | Service name |
| `req.soajs.controller.serviceParams.service_v` | Service version |
| `req.soajs.controller.serviceParams.service_nv` | Service with version |
| `req.soajs.controller.serviceParams.serviceInfo` | URL path segments array |
| `req.soajs.controller.serviceParams.parsedUrl` | Full parsed URL object |
| `req.query` | Query parameters |

## Auth Parameter Normalization

The middleware normalizes authentication parameters:

1. **Key:** `req.headers.key` ← `req.headers.key || req.query.key`
2. **Access Token:** `req.query.access_token` ←
   - `req.query.access_token`
   - `req.headers.access_token`
   - Bearer token from `Authorization` header

## Error Codes

| Code | Description |
|------|-------------|
| 130 | Service not found in registry |
| 136 | Empty or missing service name |

## Usage Notes

- Throws TypeError if SOAJS middleware hasn't run first
- Special handling for `soajs` service name (gateway routes)
- Authorization header is deleted after extracting Bearer token
