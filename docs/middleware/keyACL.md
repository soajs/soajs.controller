# Key ACL Middleware

**File:** `mw/keyACL/index.js`

**Order:** 12

The Key ACL middleware extracts and processes the Access Control List (ACL) from the tenant's key or package.

## Purpose

- Extracts ACL for the requested service
- Resolves ACL from application or package level
- Handles both old and new ACL schema formats
- Supports version-specific and method-specific ACL

## Flow

```
  Incoming Request (after key middleware)
       │
       ▼
  ┌─────────────────┐
  │  Have keyObj    │ keyObj && packObj exist?
  │  and packObj?   │
  └────────┬────────┘
           │
           ├─── No ──▶ next()
           │
           ▼
  ┌─────────────────────────┐
  │  Extract ACL            │ Priority:
  │  for Service            │ 1. keyObj.application.acl
  └────────┬────────────────┘ 2. packObj.acl
           │
           ▼
  ┌─────────────────────────┐
  │  Detect Schema Type     │ Old: apis/apisRegExp at root
  │                         │ New: versioned with methods
  └────────┬────────────────┘
           │
           ▼
  ┌─────────────────────────┐
  │  Resolve Version        │ Match requested version
  │  (if versioned)         │ or get latest from ACL
  └────────┬────────────────┘
           │
           ▼
  ┌─────────────────────────┐
  │  Extract Method-        │ get, post, put, delete
  │  Specific ACL           │
  └────────┬────────────────┘
           │
           ▼
  ┌─────────────────────────┐
  │  Store finalAcl         │ req.soajs.controller.serviceParams.finalAcl
  └────────┬────────────────┘
           │
           ▼
       next()
```

## ACL Resolution Priority

1. **Application ACL** - `keyObj.application.acl[serviceName]`
2. **Package ACL** - `packObj.acl[serviceName]`

## ACL Schema Formats

### Old Schema (Deprecated)

```javascript
{
  "serviceName": {
    "access": true,
    "apis": {
      "/api/path": { "access": ["group1"] }
    },
    "apisRegExp": [
      { "regExp": /^\/api\/.*/, "access": ["group2"] }
    ]
  }
}
```

### New Schema (Versioned)

```javascript
{
  "serviceName": {
    "1": {                              // Version
      "access": true,
      "apisPermission": "restricted",
      "get": {
        "apis": { "/user": {} }
      },
      "post": {
        "apis": { "/user": { "access": ["admin"] } }
      }
    }
  }
}
```

### New Schema (Method-Based, Non-Versioned)

```javascript
{
  "serviceName": {
    "access": true,
    "apisPermission": "restricted",
    "get": {
      "apis": { "/user": {} }
    },
    "post": {
      "apis": { "/user": { "access": ["admin"] } }
    }
  }
}
```

## Properties Set

| Property | Description |
|----------|-------------|
| `req.soajs.controller.serviceParams.finalAcl` | Processed ACL for the service |

## Error Codes

| Code | Description |
|------|-------------|
| 154 | Requested version not found in ACL |

## Usage Notes

- Runs after key middleware loads keyObj and packObj
- Application-level ACL overrides package ACL
- If no version specified, uses latest version from ACL
- Converts regex patterns for API matching
- Method-specific ACL inherits service-level `access` and `apisPermission`
