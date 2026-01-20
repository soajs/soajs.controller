# Enhancer Middleware

**File:** `mw/enhancer/index.js`

**Order:** 5

The Enhancer middleware adds utility methods to the request object for header handling and client IP detection.

## Purpose

- Adds `req.get()` for case-insensitive header retrieval
- Adds `req.getClientIP()` for client IP address extraction
- Handles proxy headers (X-Forwarded-For)

## Flow

```
  Incoming Request
       │
       ▼
  ┌─────────────────┐
  │  Attach get()   │ Case-insensitive header getter
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │  Attach         │ Client IP extraction
  │  getClientIP()  │
  └────────┬────────┘
           │
           ▼
       next()
```

## Methods Added

### `req.get(headerName)`

Retrieves a header value (case-insensitive).

**Parameters:**
- `headerName` - Name of the header to retrieve

**Returns:** Header value or `undefined`

**Example:**
```javascript
let key = req.get("key");           // Works
let key = req.get("Key");           // Also works
let key = req.get("KEY");           // Also works
```

### `req.getClientIP()`

Extracts the client's IP address, handling proxy scenarios.

**Logic:**
1. Check `X-Forwarded-For` header (first IP if comma-separated)
2. Fall back to `req.connection.remoteAddress`
3. Fall back to `req.socket.remoteAddress`
4. Fall back to `req.connection.socket.remoteAddress`

**Returns:** Client IP address string

**Example:**
```javascript
let clientIP = req.getClientIP();
// "192.168.1.100" or "::1" for localhost
```

## Usage Notes

- `get()` is used throughout the codebase for header access
- `getClientIP()` is used by IP whitelist/blacklist checks
- Proxy support requires `X-Forwarded-For` header from load balancer
