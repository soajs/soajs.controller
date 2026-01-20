# Maintenance Mode Middleware

**File:** `mw/maintenanceMode/index.js`

**Order:** 7

The Maintenance Mode middleware returns a configurable response when the gateway is in maintenance mode.

## Purpose

- Blocks all requests when maintenance mode is enabled
- Returns configurable status code and message
- Supports `Retry-After` header for clients

## Flow

```
  Incoming Request
       │
       ▼
  ┌─────────────────────┐
  │  Get Maintenance    │ registry.custom.gateway.value.maintenanceMode
  │  Mode Config        │
  └────────┬────────────┘
           │
           ▼
  ┌─────────────────────┐
  │  Maintenance        │ maintenanceMode.on === true?
  │  Enabled?           │
  └────────┬────────────┘
           │
           ├─── Yes ──▶ Return configured status/message
           │            Set Retry-After header if configured
           ▼
       next()
```

## Configuration

Located in `registry.custom.gateway.value.maintenanceMode`:

```javascript
{
  "maintenanceMode": {
    "on": true,                              // Enable maintenance mode
    "status": 503,                           // HTTP status code
    "message": "System maintenance",         // Response message
    "retryAfter": 3600                       // Retry-After header (seconds)
  }
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `on` | boolean | `false` | Enable/disable maintenance mode |
| `status` | number | `503` | HTTP status code |
| `message` | string | `"Maintenance mode is on, come back soon"` | Response message |
| `retryAfter` | number | - | Seconds until retry |

## Response

When maintenance mode is enabled:
```
HTTP/1.1 503 Service Unavailable
Content-Type: application/json
Retry-After: 3600

{
  "result": false,
  "errors": {
    "codes": [xxx],
    "details": [{ "code": xxx, "message": "System maintenance" }]
  }
}
```

## Usage Notes

- All requests blocked when enabled (no exceptions)
- Configure via Core DB custom registry
- Use maintenance port (5000) for health checks during maintenance
