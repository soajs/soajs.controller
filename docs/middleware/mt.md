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
| 4 | `aclCheck` | Loads service-level ACL |
| 5 | `oauthCheck` | Validates OAuth token (if required) |
| 6 | `uracCheck` | Loads user profile from URAC |
| 7 | `aclUrackCheck` | Overrides ACL with user-specific ACL |
| 8 | `serviceCheck` | Validates service access |
| 9 | `apiCheck` | Validates API access |

---

## Waterfall Check Details

### 1. ipWhitelist

**Purpose:** Check if the client IP is in a trusted whitelist, optionally bypassing ACL and OAuth checks.

**Location:** `mw/mt/utils.js:166`

**Configuration:** `registry.custom.gateway.value.mt.whitelist`

```javascript
{
  "mt": {
    "whitelist": {
      "ips": ["10.0.0.0/8", "192.168.1.0/24", "127.0.0.1"],
      "acl": true,    // Skip ACL checks for whitelisted IPs
      "oauth": true   // Skip OAuth checks for whitelisted IPs
    }
  }
}
```

**Behavior:**
- Uses CIDR notation (Netmask) for IP range matching
- Sets `obj.skipACL = true` if `whitelist.acl` is enabled and IP matches
- Sets `obj.skipOAUTH = true` if `whitelist.oauth` is enabled and IP matches
- Netmask objects are cached for performance

**Use Cases:**
- Trusted internal services calling the gateway
- Development/testing environments
- Load balancer health checks

---

### 2. securityGeoCheck

**Purpose:** Validates the client IP against geographic allow/deny lists configured on the tenant key.

**Location:** `mw/mt/utils.js:309`

**Configuration:** `keyObj.geo`

```javascript
{
  "geo": {
    "allow": ["10.0.0.0/8", "192.168.0.0/16"],  // Only these IPs allowed
    "deny": ["10.0.1.0/24"]                      // Block these IPs
  }
}
```

**Behavior:**
- **Deny list checked first:** If client IP matches any deny entry → Error 155
- **Allow list checked second:** If allow list exists and IP doesn't match → Error 155
- Uses CIDR notation for IP range matching
- Skipped if `obj.skipACL = true` (from ipWhitelist)

**Error Codes:**
| Code | Description |
|------|-------------|
| 155 | Geographic access denied |

---

### 3. securityDeviceCheck

**Purpose:** Validates the client device/browser against allow/deny lists configured on the tenant key.

**Location:** `mw/mt/utils.js:355`

**Configuration:** `keyObj.device`

```javascript
{
  "device": {
    "allow": [
      { "family": "Chrome" },
      { "family": "Firefox", "major": { "min": "90" } },
      { "family": "Safari", "os": { "family": "Mac OS X" } }
    ],
    "deny": [
      { "family": "IE" },
      { "family": "Chrome", "major": { "max": "80" } }
    ]
  }
}
```

**Validation Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `family` | string | Browser family (Chrome, Firefox, Safari, IE, etc.) |
| `major` | string/object | Major version. Object: `{ "min": "90", "max": "100" }` |
| `minor` | string/object | Minor version |
| `patch` | string/object | Patch version |
| `os.family` | string | OS family (Windows, Mac OS X, Linux, etc.) |
| `os.major` | string/object | OS major version |

**Behavior:**
- Uses `useragent` library to parse User-Agent header
- **Deny list checked first:** If device matches any deny entry → Error 156
- **Allow list checked second:** If allow list exists and device doesn't match → Error 156
- Wildcard `"*"` matches any value
- Skipped if `obj.skipACL = true` (from ipWhitelist)

**Error Codes:**
| Code | Description |
|------|-------------|
| 156 | Device access denied |

---

### 4. aclCheck

**Purpose:** Loads the pre-computed ACL from `serviceParams.finalAcl` into the waterfall object.

**Location:** `mw/mt/utils.js:274`

**Behavior:**
- Simple passthrough that loads `obj.req.soajs.controller.serviceParams.finalAcl` into `obj.finalAcl`
- The ACL was computed earlier in the [keyACL middleware](./keyACL.md)
- This ACL will be used by subsequent checks (serviceCheck, apiCheck)

---

### 5. oauthCheck

**Purpose:** Validates OAuth access tokens for private APIs and handles PIN-locked sessions.

**Location:** `mw/mt/utils.js:463`

**Prerequisites:**
- `serviceParam.oauth = true` must be set on the service
- Skipped if `obj.skipOAUTH = true` (from ipWhitelist)

**Public vs Private API Detection:**
| Scenario | ACL Configuration | Result |
|----------|-------------------|--------|
| No access restriction | `access: false` or missing | Public |
| Service restricted, API public | `access: true`, `apis[path].access: false` | Public |
| Restricted permission, API public | `apisPermission: "restricted"`, `apis[path].access: false` | Public |
| Any access restriction | `access: true` or `apis[path].access: true` | Private |

**PIN Login Support:**

PIN login is a two-factor authentication mechanism where users must enter a PIN after OAuth login.

**Configuration:** `registry.custom.oauth.value`

```javascript
{
  "oauth": {
    "value": {
      "pinWrapper": {
        "servicename": "custom-service",
        "apiname": "/verify-pin"
      },
      "pinWhitelist": {
        "servicename": {
          "get": {
            "apis": ["/public-api"],
            "regex": ["/user/:id/profile"]
          }
        }
      }
    }
  }
}
```

**PIN Flow:**
1. User logs in with OAuth → receives token with `pinLocked: true`
2. Most APIs blocked (error 145) until PIN verified
3. PIN whitelist allows specific APIs before verification
4. After PIN verification, `pinLogin: true` set, full access granted

**Error Codes:**
| Code | Description |
|------|-------------|
| 145 | PIN verification required |

---

### 6. uracCheck

**Purpose:** Initializes the URAC driver to load user profile, groups, ACL, and configuration.

**Location:** `mw/mt/utils.js:624`

**Behavior:**
- Skipped if `obj.skipOAUTH = true` or no bearer token present
- Creates `req.soajs.uracDriver` instance
- Handles **roaming** across environments (e.g., dashboard token used in dev environment)

**Roaming Support:**

Roaming allows users authenticated in a "sensitive" environment (default: `dashboard`) to access other environments.

**Configuration:** Environment variable `SOAJS_SENSITIVE_ENVS`
```bash
SOAJS_SENSITIVE_ENVS='["dashboard", "production"]'
```

**Roaming Flow:**
1. Check if token's environment is in sensitive list AND differs from current
2. Load tenant data for the token's client ID
3. Load registry for the token's environment
4. Set `req.soajs.tenant.roaming` with cross-environment context

**Token Account Validation:**

Validates that user account hasn't changed since token was issued.

**Configuration:** `keyObj.config.gateway.validateTokenAccount`

```javascript
{
  "gateway": {
    "validateTokenAccount": {
      "email": true,   // Invalidate if email changed
      "phone": true    // Invalidate if phone changed
    }
  }
}
```

**Error Codes:**
| Code | Description |
|------|-------------|
| 146 | User profile not found or account changed |
| 170 | Roaming context failed to load |

---

### 7. aclUrackCheck

**Purpose:** Overrides the tenant/package ACL with user-specific ACL from URAC profile.

**Location:** `mw/mt/utils.js:217`

**Behavior:**
- Skipped if `obj.skipOAUTH = true` or no URAC driver
- Retrieves user's personal ACL via `uracDriver.getAcl()`
- If user ACL exists, it **replaces** the tenant/package ACL
- Handles version resolution when no version requested
- Processes method-specific ACL (GET, POST, etc.)

**ACL Structure:**
```javascript
// User ACL from URAC
{
  "servicename": {
    "1": {                              // Version
      "access": true,
      "get": {
        "apis": { "/endpoint": { "access": true } },
        "apisRegExp": [...],
        "apisPermission": "restricted"
      },
      "post": { ... }
    }
  }
}
```

**Version Resolution:**
- If request doesn't specify version, finds latest version in user's ACL
- Uses `coreLibs.version.getLatest()` for semantic version comparison

---

### 8. serviceCheck

**Purpose:** Validates that the tenant/user has access to the requested service.

**Location:** `mw/mt/utils.js:289`

**Behavior:**
- Skipped if `obj.skipACL = true` (from ipWhitelist)
- Checks if `obj.finalAcl` exists for the service
- If no ACL found → Error 154 (service not accessible)

**Error Codes:**
| Code | Description |
|------|-------------|
| 154 | Service not accessible |

---

### 9. apiCheck

**Purpose:** Validates access to the specific API endpoint based on ACL configuration.

**Location:** `mw/mt/utils.js:748`

**Behavior:**
- Skipped if `obj.skipACL = true` (from ipWhitelist)
- Matches API path against `apis` (exact match) or `apisRegExp` (pattern match)
- Sets `isAPIPublic = true` for traffic middleware throttling strategy

**API Matching Order:**
1. Exact match in `system.apis[path]`
2. RegExp match in `system.apisRegExp[]`

**Access Control Logic:**

| ACL Configuration | User State | Result |
|-------------------|------------|--------|
| `access: false` | Any | Public API, allowed |
| `access: true`, no user | - | Error 158 |
| `access: true`, user logged in | - | Check group permissions |
| `access: ["group1", "group2"]` | User in group | Allowed |
| `access: ["group1"]` | User not in group | Error 157/160 |
| `apisPermission: "restricted"` | API not in list | Error 159 |

**Error Codes:**
| Code | Description |
|------|-------------|
| 157 | User not in required access group |
| 158 | Login required |
| 159 | API not found (restricted mode) |
| 160 | User lacks required group membership |
| 161 | API requires login but user not authenticated |

---

## Waterfall Execution Flow

```
┌─────────────────┐
│  ipWhitelist    │──▶ Sets skipACL, skipOAUTH flags
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ securityGeoCheck│──▶ Error 155 if geo-blocked
└────────┬────────┘    (skipped if skipACL)
         │
         ▼
┌─────────────────┐
│securityDeviceChk│──▶ Error 156 if device blocked
└────────┬────────┘    (skipped if skipACL)
         │
         ▼
┌─────────────────┐
│   aclCheck      │──▶ Loads finalAcl from keyACL middleware
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  oauthCheck     │──▶ Error 145 if PIN required
└────────┬────────┘    (skipped if skipOAUTH or public API)
         │
         ▼
┌─────────────────┐
│   uracCheck     │──▶ Error 146/170 if user load fails
└────────┬────────┘    (skipped if skipOAUTH)
         │
         ▼
┌─────────────────┐
│ aclUrackCheck   │──▶ Overrides ACL with user ACL
└────────┬────────┘    (skipped if skipOAUTH)
         │
         ▼
┌─────────────────┐
│  serviceCheck   │──▶ Error 154 if no service ACL
└────────┬────────┘    (skipped if skipACL)
         │
         ▼
┌─────────────────┐
│   apiCheck      │──▶ Error 157-161 if access denied
└────────┬────────┘    (skipped if skipACL)
         │
         ▼
     Success
```

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
