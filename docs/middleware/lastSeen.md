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
    "network": "internal",               // Optional network identifier
    "include": {                         // Optional whitelist, omit to trigger on everything
      "connectspaces": true
    },
    "targets": [                         // Optional extra APIs notified on the same event
      {
        "serviceName": "authenticator",
        "serviceVersion": "1",
        "api": "/my/device/network",
        "method": "put"
      }
    ]
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
| `include` | object | - | Whitelist of services and APIs, omit to trigger on every request |
| `targets` | array | - | Extra APIs notified on the same event |

### include

Decides whether a request counts as activity. Omitting it triggers on every request.

| Form | Meaning |
|------|---------|
| service missing from `include` | never triggers |
| `"service": true` | every API, every method |
| `"service": {"apis": {"/path": true}}` | that API, every method |
| `"service": {"apis": {"/path": ["get","put"]}}` | that API, listed methods only |
| `"apis": {"*": ...}` | any API, checked before the exact paths |

API keys accept the service relative path (`/active`) or the full path
(`/connectspaces/active`), and support path params (`/user/:id`).

### targets

Extra APIs notified whenever the main one is. They are not filtered on their own, the
`include` above has already decided that the request counts as activity, so a target is
notified on exactly the same set of requests.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `serviceName` | string | required | Service to notify, must be in the registry |
| `api` | string | required | API endpoint |
| `serviceVersion` | string | - | Service version, resolved by awareness when absent |
| `method` | string | `"post"` | HTTP method |

Each target receives the same body and the same `soajsinjectobj` header as the main
notification. A target that is down, unknown to the registry, or missing `serviceName`
or `api` is skipped without affecting the others.

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
