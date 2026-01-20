# Favicon Middleware

**File:** `mw/favicon/index.js`

**Order:** 3

The Favicon middleware serves favicon requests to prevent them from being routed as service requests.

## Purpose

- Intercepts `/favicon.ico` requests
- Returns an empty response immediately
- Prevents favicon requests from reaching service routing

## Flow

```
  Incoming Request
       │
       ▼
  ┌─────────────────┐
  │  Is Favicon     │ req.url === '/favicon.ico'?
  │  Request?       │
  └────────┬────────┘
           │
           ├─── Yes ──▶ res.writeHead(200), res.end()
           │
           ▼
       next()
```

## Usage Notes

- Simple passthrough middleware for non-favicon requests
- Returns 200 OK with empty body for favicon requests
- Prevents unnecessary service resolution for browser favicon requests
