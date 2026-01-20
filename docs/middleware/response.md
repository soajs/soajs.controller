# Response Middleware

**File:** `mw/response/index.js`

**Order:** 4

The Response middleware adds standardized response builder methods to the request object.

## Purpose

- Adds `req.soajs.buildResponse()` for creating SOAJS-formatted responses
- Adds `req.soajs.controllerResponse()` for sending gateway responses
- Provides consistent error/success response structure

## Flow

```
  Incoming Request
       │
       ▼
  ┌─────────────────────────┐
  │  Attach buildResponse() │ Creates SOAJS response objects
  └────────────┬────────────┘
               │
               ▼
  ┌─────────────────────────────┐
  │  Attach controllerResponse()│ Sends JSON responses
  └────────────┬────────────────┘
               │
               ▼
           next()
```

## Methods Added

### `req.soajs.buildResponse(error, data)`

Creates a SOAJS-formatted response object.

**Parameters:**
- `error` - Error object or array of errors (optional)
- `data` - Response data (optional)

**Returns:**
```javascript
// Success
{
  "result": true,
  "data": { ... }
}

// Error
{
  "result": false,
  "errors": {
    "codes": [100, 101],
    "details": [
      { "code": 100, "message": "Error message" },
      { "code": 101, "message": "Another error" }
    ]
  }
}
```

### `req.soajs.controllerResponse(jsonObj)`

Sends a JSON response and ends the request.

**Parameters:**
- `jsonObj` - Response object with optional `status`, `headObj`, `code`, `msg`

**Examples:**
```javascript
// Success response
req.soajs.controllerResponse({ data: { user: "john" } });

// Error response
req.soajs.controllerResponse({
  status: 403,
  code: 150,
  msg: "Access denied"
});

// With custom headers
req.soajs.controllerResponse({
  status: 429,
  msg: "Too many requests",
  headObj: {
    "Retry-After": 60,
    "X-RateLimit-Limit": 100
  }
});
```

## Response Format

All responses include:
- `Content-Type: application/json` header
- HTTP status code (default: 200)
- JSON body

## Usage Notes

- `controllerResponse()` only available when `controllerResponse: true` in config
- Prevents double-ending responses (tracks `ended` state)
- Automatically formats errors using `buildResponse()` when `code` and `msg` provided
