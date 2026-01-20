# MT (Multi-Tenant) Middleware

**File:** `mw/mt/index.js`

**Order:** 14

The MT middleware handles multi-tenant security checks, URAC integration, and prepares the injection header for target services.

## Purpose

- Enforces multi-tenant security pipeline
- Loads tenant and application context
- Integrates with URAC for user profiles
- Prepares `soajsinjectobj` header for downstream services

## Flow

```
  Incoming Request
       │
       ▼
  ┌─────────────────────────┐
  │  Is Proxy Route?        │ Skip security for proxy
  └────────┬────────────────┘
           │
           ├─── Yes ──▶ Execute OAuth check → next()
           │
           ▼
  ┌─────────────────────────┐
  │  External Key           │ Based on service config
  │  Required?              │
  └────────┬────────────────┘
           │
           ├─── No ──▶ Mark as public API → OAuth check
           │
           ▼
  ┌─────────────────────────┐
  │  Load Tenant Context    │ From keyObj
  └────────┬────────────────┘
           │
           ▼
  ┌─────────────────────────┐
  │  Security Pipeline      │ Waterfall checks:
  │                         │ 1. IP Whitelist
  │                         │ 2. Geo Check
  │                         │ 3. Device Check
  │                         │ 4. ACL Check
  │                         │ 5. OAuth Check (if required)
  │                         │ 6. URAC Check
  │                         │ 7. URAC ACL Check
  │                         │ 8. Service Check
  │                         │ 9. API Check
  └────────┬────────────────┘
           │
           ├─── Any check fails ──▶ Error response
           │
           ▼
  ┌─────────────────────────┐
  │  Build Inject Object    │ Tenant, key, app, user info
  └────────┬────────────────┘
           │
           ▼
  ┌─────────────────────────┐
  │  Resolve InterConnect   │ Service-to-service awareness
  │  (if configured)        │
  └────────┬────────────────┘
           │
           ▼
  ┌─────────────────────────┐
  │  Set soajsinjectobj     │ req.headers.soajsinjectobj = JSON
  │  Header                 │
  └────────┬────────────────┘
           │
           ▼
       next()
```

## Security Pipeline (utils.js)

| Order | Check | Description |
|-------|-------|-------------|
| 1 | `ipWhitelist` | Validates IP against whitelist |
| 2 | `securityGeoCheck` | Validates geographic location |
| 3 | `securityDeviceCheck` | Validates device fingerprint |
| 4 | `aclCheck` | Validates service-level ACL |
| 5 | `oauthCheck` | Validates OAuth token (if required) |
| 6 | `uracCheck` | Loads user profile from URAC |
| 7 | `aclUrackCheck` | Validates user-specific ACL |
| 8 | `serviceCheck` | Validates service access |
| 9 | `apiCheck` | Validates API access |

## Injection Object Structure

The `soajsinjectobj` header contains:

```javascript
{
  "tenant": {
    "id": "tenant_id",
    "name": "Tenant Name",
    "code": "TCODE",
    "locked": false,
    "roaming": null,
    "type": "product",
    "main": { ... },           // If client tenant
    "profile": { ... }         // If tenant_Profile enabled
  },
  "key": {
    "config": { ... },
    "iKey": "internal_key",
    "eKey": "external_key"
  },
  "application": {
    "product": "PRODUCT",
    "package": "PACKAGE",
    "appId": "app_id",
    "acl": { ... },            // If provision_ACL enabled
    "acl_all_env": { ... }
  },
  "package": {
    "acl": { ... },            // If provision_ACL enabled
    "acl_all_env": { ... }
  },
  "device": { ... },
  "geo": { ... },
  "awareness": {
    "host": "controller_host",
    "port": 4000,
    "interConnect": [...]      // If configured
  },
  "urac": {                    // If authenticated
    "_id": "user_id",
    "username": "user",
    "firstName": "John",
    "lastName": "Doe",
    "email": "user@example.com",
    "groups": ["group1"],
    "tenant": { "id": "...", "code": "..." },
    "profile": { ... },        // If urac_Profile enabled
    "acl": { ... },            // If urac_ACL enabled
    "config": { ... },         // If urac_Config enabled
    "groupsConfig": { ... }    // If urac_GroupConfig enabled
  },
  "param": {
    "urac_Profile": true,
    "urac_ACL": true
  }
}
```

## Service Parameters

Service-level configuration that affects MT processing:

| Parameter | Description |
|-----------|-------------|
| `urac` | Include URAC user info |
| `urac_Profile` | Include user profile |
| `urac_ACL` | Include user ACL |
| `urac_Config` | Include user config |
| `urac_GroupConfig` | Include group config |
| `tenant_Profile` | Include tenant profile |
| `provision_ACL` | Include full ACL data |
| `extKeyRequired` | Require external key |
| `oauth` | Require OAuth token |
| `interConnect` | Service-to-service discovery |

## Error Codes

| Code | Description |
|------|-------------|
| 133 | Service version not found |
| 135 | Inject header too large |
| 152 | Package not loaded |
| 153 | Key not loaded |
| 158 | Login required for ACL route |

## Related Files

- `mw/mt/utils.js` - Security check implementations
- `mw/mt/urac.js` - URAC driver integration

## Usage Notes

- Proxy routes bypass all MT checks except OAuth
- Header size limited by `SOAJS_MAX_INJECT_HEADER_SIZE` (default: 64KB)
- InterConnect enables service-to-service awareness info
- URAC integration loads user profile asynchronously
