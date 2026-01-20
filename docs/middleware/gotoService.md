# GotoService Middleware

**File:** `mw/gotoService/index.js`

**Order:** 13

The GotoService middleware determines the routing strategy and prepares service parameters for request forwarding.

## Purpose

- Extracts and validates service build parameters
- Handles special routes (`/soajs/acl`, `/soajs/proxy`, `/proxy/redirect`)
- Selects appropriate routing strategy
- Validates external key when required

## Flow

```
  Incoming Request
       │
       ▼
  ┌─────────────────┐
  │  Is /soajs/acl  │ Gateway ACL route?
  │  Route?         │
  └────────┬────────┘
           │
           ├─── Yes ──▶ soajs_keyACL handler
           │
           ▼
  ┌─────────────────┐
  │  Is Proxy       │ /soajs/proxy or /proxy/redirect?
  │  Route?         │
  └────────┬────────┘
           │
           ├─── Yes ──▶ Mark as proxy, continue
           │
           ▼
  ┌──────────────────────────┐
  │  Extract Build           │ extractBuildParameters()
  │  Parameters              │
  └────────┬─────────────────┘
           │
           ├─── Error ──▶ Error 130
           │
           ▼
  ┌──────────────────────────┐
  │  Validate External       │ If extKeyRequired
  │  Key (if required)       │
  └────────┬─────────────────┘
           │
           ├─── Invalid key ──▶ Error 132
           │
           ▼
  ┌──────────────────────────┐
  │  Select Routing          │ Based on request type
  │  Strategy                │
  └────────┬─────────────────┘
           │
           ▼
       next()
```

## Routing Strategies

The middleware sets `req.soajs.controller.gotoservice` to one of:

### 1. simpleRTS

**Trigger:** `/oauth/passport/login`

Lightweight OAuth flow for passport-based authentication.

### 2. roaming

**Trigger:** `soajsroaming` header present

Cross-environment request forwarding.

### 3. proxyRequest

**Trigger:** `/soajs/proxy` or `/proxy/redirect` (deprecated)

Service-to-service or external URL proxying.

### 4. redirectToService (Default)

**Trigger:** Standard service requests

Standard REST API proxy to target service.

```
                            ┌─────────────────────────┐
                            │    Incoming Request     │
                            └───────────┬─────────────┘
                                        │
                    ┌───────────────────┼───────────────────┐
                    │                   │                   │
                    ▼                   ▼                   ▼
        ┌───────────────────┐ ┌─────────────────┐ ┌─────────────────────┐
        │  Passport Login?  │ │  Roaming Header?│ │  Proxy Route?       │
        │  /oauth/passport  │ │  soajsroaming   │ │  /soajs/proxy       │
        │  /login           │ │                 │ │                     │
        └─────────┬─────────┘ └────────┬────────┘ └──────────┬──────────┘
                  │                    │                     │
        ┌─────────▼─────────┐ ┌────────▼────────┐ ┌──────────▼──────────┐
        │    simpleRTS      │ │    roaming      │ │    proxyRequest     │
        └───────────────────┘ └─────────────────┘ └─────────────────────┘
                                        │
                                        │ (Default)
                                        ▼
                            ┌─────────────────────────┐
                            │   redirectToService     │
                            └─────────────────────────┘
```

## Build Parameters Extracted

| Parameter | Description |
|-----------|-------------|
| `name` | Service name |
| `version` | Service version |
| `path` | API path |
| `registry` | Service registry entry |
| `extKeyRequired` | Whether external key is required |
| `url` | Target URL (for endpoint services) |

## Error Codes

| Code | Description |
|------|-------------|
| 130 | Service not found or missing port/hosts |
| 132 | Missing or invalid external key |

## Related Files

- `lib/extractBuildParameters.js` - Parameter extraction logic
- `simpleRTS.js` - Passport login handler
- `roaming.js` - Cross-environment handler
- `proxyRequest.js` - Proxy route handler
- `redirectToService.js` - Standard service proxy

## Usage Notes

- `/proxy/redirect` is deprecated, logs warning
- External key validation uses `core.key.getInfo()`
- Build parameters stored in `req.soajs.controller.serviceParams`
