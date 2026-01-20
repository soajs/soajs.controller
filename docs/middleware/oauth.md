# OAuth Middleware

**File:** `mw/oauth/index.js`

**Order:** 15

The OAuth middleware handles authentication by validating OAuth2 tokens or JWT tokens.

## Purpose

- Validates OAuth2 access tokens via oauth2-server
- Validates JWT tokens via jsonwebtoken
- Supports tenant-specific OAuth configuration
- Sets `req.oauth` with token information

## Flow

```
  Incoming Request
       │
       ▼
  ┌─────────────────────────┐
  │  Determine OAuth Type   │ tenantOauth.type or
  │                         │ registry.serviceConfig.oauth.type
  └────────┬────────────────┘
           │
           ├─── Type 0 (JWT) ──▶ JWT Validation
           │
           ├─── Type 2 (OAuth2) ──▶ OAuth2 Server Validation
           │
           ▼
  ┌─────────────────────────┐
  │  Set req.oauth          │ { bearerToken, type }
  └────────┬────────────────┘
           │
           ▼
       next() or Error
```

## OAuth Types

### Type 2: OAuth2 (Default)

Uses oauth2-server library for token validation.

```
  Request with access_token
       │
       ▼
  ┌─────────────────────────┐
  │  oauth2-server          │ Validates token against DB
  │  authorise()            │
  └────────┬────────────────┘
           │
           ├─── Invalid ──▶ OAuth2Error
           │
           ▼
  ┌─────────────────────────┐
  │  req.oauth = {          │
  │    bearerToken: user,   │
  │    type: 2              │
  │  }                      │
  └─────────────────────────┘
```

### Type 0: JWT

Uses jsonwebtoken library for JWT validation.

```
  Request with Authorization: Bearer <jwt>
       │
       ▼
  ┌─────────────────────────┐
  │  Extract Bearer Token   │ from Authorization header
  └────────┬────────────────┘
           │
           ├─── No match ──▶ Error 143
           │
           ▼
  ┌─────────────────────────┐
  │  jwt.verify()           │ Using secret and algorithms
  └────────┬────────────────┘
           │
           ├─── Invalid ──▶ Error 143
           │
           ▼
  ┌─────────────────────────┐
  │  req.oauth = {          │
  │    bearerToken: decoded,│
  │    type: 0              │
  │  }                      │
  └─────────────────────────┘
```

## Configuration

### OAuth2 Configuration

Located in `registry.serviceConfig.oauth`:

```javascript
{
  "oauth": {
    "type": 2,
    "grants": ["password", "refresh_token"],
    "debug": false,
    "accessTokenLifetime": 7200,
    "refreshTokenLifetime": 1209600
  }
}
```

### JWT Configuration

```javascript
{
  "oauth": {
    "type": 0,
    "secret": "jwt_secret_key",
    "algorithms": ["HS256"],
    "audience": "my-app"
  }
}
```

### Tenant-Specific OAuth

Tenants can override OAuth settings via `tenantOauth`:

```javascript
{
  "type": 0,                    // Override to JWT
  "secret": "tenant_jwt_secret"
}
```

## OAuth Service Integration

Default OAuth service configuration:

```javascript
{
  "oauthService": {
    "name": "oauth",
    "tokenApi": "/token",
    "authorizationApi": "/authorization",
    "pinApi": "/pin"
  }
}
```

## Error Codes

| Code | Description |
|------|-------------|
| 143 | Invalid or missing JWT token |
| OAuth2Error | Various OAuth2 errors (invalid_token, expired, etc.) |

## Properties Set

| Property | Type | Description |
|----------|------|-------------|
| `req.oauth.bearerToken` | object | Decoded token or user object |
| `req.oauth.type` | number | OAuth type (0=JWT, 2=OAuth2) |

## Usage Notes

- OAuth type can be set globally or per-tenant
- JWT requires `Authorization: Bearer <token>` header
- OAuth2 uses `access_token` query parameter or header
- Tenant OAuth settings override global settings
- OAuth model is provided by configuration (provision module)
