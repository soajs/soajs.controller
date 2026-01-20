# Multi-Tenant Security Pipeline

The SOAJS Controller Gateway implements a comprehensive security pipeline for multi-tenant environments.

## Security Check Flow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         MULTI-TENANT SECURITY CHECKS                            │
└─────────────────────────────────────────────────────────────────────────────────┘

  Incoming Request with Key
          │
          ▼
  ┌───────────────────┐
  │ 1. IP Whitelist   │ Check application-level IP restrictions
  │    Validation     │ FAIL → 403 Forbidden
  └─────────┬─────────┘
            │ PASS
            ▼
  ┌───────────────────┐
  │ 2. Geo-Location   │ Validate request origin geography
  │    Check          │ FAIL → 403 Forbidden
  └─────────┬─────────┘
            │ PASS
            ▼
  ┌───────────────────┐
  │ 3. Device         │ Verify device fingerprint
  │    Fingerprint    │ FAIL → 403 Forbidden
  └─────────┬─────────┘
            │ PASS
            ▼
  ┌───────────────────┐
  │ 4. ACL Check      │ Validate service/API access permission
  │                   │ FAIL → 403 Forbidden
  └─────────┬─────────┘
            │ PASS
            ▼
  ┌───────────────────┐
  │ 5. OAuth Check    │ Validate token (OAuth2 or JWT)
  │                   │ FAIL → 401 Unauthorized
  └─────────┬─────────┘
            │ PASS
            ▼
  ┌───────────────────┐
  │ 6. URAC Profile   │ Load user profile and groups
  │    Resolution     │ Resolve user-specific ACL
  └─────────┬─────────┘
            │
            ▼
     Continue to Service
```

## Security Checks Detail

### 1. IP Whitelist Validation

**Middleware:** `mw/mt/utils.js`

Validates that the request IP is allowed to access the application.

- Configured per external key in the key's `geo` field
- Supports CIDR notation for IP ranges
- Also supports gateway-level whitelist via custom registry

### 2. Geo-Location Check

**Middleware:** `mw/mt/utils.js`

Validates request origin based on geographic location.

- Configured in external key's `geo` field
- Supports country-level restrictions

### 3. Device Fingerprint

**Middleware:** `mw/mt/utils.js`

Validates device fingerprint for mobile/app authentication.

- Configured in external key's `device` field
- Useful for mobile app authentication

### 4. ACL Check

**Middleware:** `mw/mt/utils.js`

Validates that the tenant has access to the requested service/API.

ACL Resolution Priority:
1. User-specific ACL (from URAC profile)
2. Application ACL (from tenant application)
3. Package ACL (from product package)

### 5. OAuth Check

**Middleware:** `mw/oauth/index.js`

Validates OAuth2 tokens or JWT.

- Supports OAuth2 password grant
- Supports JWT validation
- Configurable per service

### 6. URAC Profile Resolution

**Middleware:** `mw/mt/urac.js`

Loads user profile from URAC for authenticated requests.

- Resolves user groups
- Applies user-specific ACL overrides
- Handles network package override for user packages

## IP Whitelist Configuration

### Gateway-Level Whitelist

```javascript
// In custom registry: gateway.value.mt.whitelist
{
  "mt": {
    "whitelist": {
      "ips": ["10.0.0.0/8", "192.168.1.0/24"],
      "acl": true,     // Skip ACL checks for whitelisted IPs
      "oauth": true    // Skip OAuth checks for whitelisted IPs
    }
  }
}
```

### Key-Level Restrictions

```javascript
// In external key definition
{
  "extKey": "...",
  "env": "DEV",
  "geo": {
    "ips": ["192.168.1.0/24"],
    "countries": ["US", "CA"]
  },
  "device": {
    "allow": ["iOS", "Android"]
  }
}
```

## ACL Structure

```javascript
{
  "serviceName": {
    "version": {
      "access": true,                        // or false, or ["group1", "group2"]
      "apisPermission": "restricted",        // "restricted" = whitelist mode
      "get": {
        "apis": {
          "/api/path": {
            "access": ["owner", "admin"]     // Groups allowed
          }
        }
      },
      "post": { ... },
      "put": { ... },
      "delete": { ... }
    }
  }
}
```

## Error Codes

| Code | Description |
|------|-------------|
| 150 | ACL validation failed - no access to service |
| 151 | ACL validation failed - no access to API |
| 152 | ACL validation failed - version mismatch |
| 153 | Geo-location validation failed |
| 154 | Device validation failed |
| 155 | IP whitelist validation failed |
| 401 | OAuth token invalid or expired |
| 403 | Access forbidden |
