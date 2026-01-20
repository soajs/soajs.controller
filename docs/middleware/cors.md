# CORS Middleware

**File:** `mw/cors/index.js`

**Order:** 2

The CORS middleware handles Cross-Origin Resource Sharing headers and preflight (OPTIONS) requests.

## Purpose

- Handles OPTIONS preflight requests
- Sets appropriate CORS headers on all responses
- Configurable via registry `serviceConfig.cors`

## Flow

```
  Incoming Request
       │
       ▼
  ┌─────────────────┐
  │  Check CORS     │ registry.serviceConfig.cors.enabled?
  │  Enabled?       │
  └────────┬────────┘
           │
           ├─── No ──▶ next()
           │
           ▼
  ┌─────────────────┐
  │  Is OPTIONS     │ req.method === 'OPTIONS'?
  │  Request?       │
  └────────┬────────┘
           │
           ├─── Yes ──▶ Set headers, return 204 No Content
           │
           ▼
  ┌─────────────────┐
  │  Set CORS       │ Access-Control-Allow-Origin
  │  Headers        │ Access-Control-Allow-Credentials
  └────────┬────────┘ Access-Control-Expose-Headers
           │
           ▼
       next()
```

## Configuration

Located in `registry.serviceConfig.cors`:

```javascript
{
  "cors": {
    "enabled": true,
    "origin": "*",                    // Default: "*"
    "credentials": "true",            // Default: "true"
    "methods": "GET,HEAD,PUT,PATCH,POST,DELETE",
    "headers": "__env,key,soajsauth,Keep-Alive,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type",
    "maxage": 1728000                 // Default: 1728000 (20 days)
  }
}
```

## Response Headers

### Preflight (OPTIONS) Response

| Header | Value |
|--------|-------|
| `Access-Control-Allow-Origin` | Configured origin or `*` |
| `Access-Control-Allow-Credentials` | `true` |
| `Access-Control-Allow-Methods` | Configured methods |
| `Access-Control-Allow-Headers` | Configured headers |
| `Access-Control-Max-Age` | Configured max age |
| `Access-Control-Expose-Headers` | Configured headers |

### Regular Response

| Header | Value |
|--------|-------|
| `Access-Control-Allow-Origin` | Configured origin or `*` |
| `Access-Control-Allow-Credentials` | `true` |
| `Access-Control-Expose-Headers` | Configured headers |

## Usage Notes

- If CORS is not enabled in config, middleware passes through without action
- OPTIONS requests return immediately with 204 status (no body)
- Default headers include SOAJS-specific headers (`__env`, `key`, `soajsauth`)
