# LastSeen Middleware

**File:** `mw/lastSeen/index.js`

**Order:** 17

The LastSeen middleware asynchronously notifies a service (typically URAC) of user activity for tracking purposes.

## Purpose

- Tracks user activity (last seen time)
- Asynchronous notification (non-blocking)
- Configurable service endpoint
- Only tracks authenticated users

## Flow

```
  Incoming Request (after OAuth/MT)
       │
       ▼
  ┌─────────────────┐
  │  Call next()    │ Continue immediately (non-blocking)
  └────────┬────────┘
           │
           ▼
  ┌─────────────────────────┐
  │  Have URAC Driver?      │ req.soajs.uracDriver exists?
  └────────┬────────────────┘
           │
           ├─── No ──▶ (done)
           │
           ▼
  ┌─────────────────────────┐
  │  LastSeen Active?       │ custom.gateway.value.lastSeen.active?
  └────────┬────────────────┘
           │
           ├─── No ──▶ (done)
           │
           ▼
  ┌─────────────────────────┐
  │  Get User ID            │ From URAC profile
  └────────┬────────────────┘
           │
           ├─── No user ID ──▶ (done, log debug)
           │
           ▼
  ┌─────────────────────────┐
  │  Resolve Service Host   │ awareness.getHost()
  └────────┬────────────────┘
           │
           ├─── No host ──▶ (done, log debug)
           │
           ▼
  ┌─────────────────────────┐
  │  POST to LastSeen       │ http://host:port/api
  │  API (async)            │ body: { network: ... }
  └─────────────────────────┘
```

## Configuration

Located in `registry.custom.gateway.value.lastSeen`:

```javascript
{
  "lastSeen": {
    "active": true,                      // Enable tracking
    "serviceName": "urac",               // Target service
    "serviceVersion": "3",               // Service version
    "api": "/user/last/seen",            // API endpoint
    "network": "internal"                // Optional network identifier
  }
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `active` | boolean | `false` | Enable/disable tracking |
| `serviceName` | string | `"urac"` | Service to notify |
| `serviceVersion` | string | `"3"` | Service version |
| `api` | string | `"/user/last/seen"` | API endpoint |
| `network` | string | - | Network identifier in request body |

## Request to URAC

**Method:** POST

**URL:** `http://{host}:{port}/user/last/seen`

**Headers:**
```
Content-Type: application/json
soajsinjectobj: <inject object from MT middleware>
```

**Body:**
```javascript
{
  "network": "internal"                  // If configured
}
```

## Usage Notes

- Non-blocking: calls `next()` immediately
- Only activates for authenticated users with URAC profile
- Errors are logged but don't affect the request
- Uses awareness for service host resolution
- Forwards `soajsinjectobj` header for authentication context
- Network identifier useful for tracking activity by location/network
