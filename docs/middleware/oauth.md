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
  └────────┬────────────────┘
           │
           ▼
  ┌─────────────────────────┐
  │  deviceId check         │ token user.deviceId vs device-id header
  └────────┬────────────────┘
           │
           ├─── Mismatch ──▶ Error 156
           │
           ▼
  ┌─────────────────────────┐
  │  restrictedTo check     │ token user.restrictedTo vs the request
  └────────┬────────────────┘
           │
           ├─── Mismatch ──▶ Error 147
           │
           ▼
       next()
```

#### deviceId check

The access token record carries `user.deviceId`, set at login from the `device-id`
header and carried forward across refreshes. It is matched against the `device-id`
header on every private API call. The check runs on the record `authorise()` already
fetched, so it costs no extra database call.

The agent cannot be used for this, mobile sends the build number in the user-agent
(ie: `democav/142 CFNetwork/3826.400.120 Darwin/24.3.0`) which changes on every build.

Tokens with no `deviceId` are not checked. This covers tokens created before deviceId
was introduced and clients that do not send the header at all, both get checked once
the client logs in again with the header. A client that sends `device-id` on login but
omits it on API calls is denied, the header has to be sent consistently.

This check is only available for type 2, a type 0 JWT carries no stored token record.

##### Turning it off

The check is on by default. To turn it off for an environment, set `deviceIdCheck` to
`false` under the `gateway` custom registry entry:

```json
{
  "oauth": {
    "deviceIdCheck": false
  }
}
```

Read from `registry.custom.gateway.value.oauth.deviceIdCheck`. Only the boolean `false`
turns it off, any other value leaves it on, so a missing or malformed entry keeps the
check running.

#### restrictedTo check

A minted token can carry a `restrictedTo` object under `user`, scoping it to where it may be
used. It is checked on the record `authorise()` already fetched, so it costs no extra database
call.

```json
{
  "restrictedTo": {
    "tenant": "<tenant id>",
    "product": "PRODWEB"
  }
}
```

Only the keys present are checked. **A token with no `restrictedTo` is not checked at all**,
so every token issued before restricted tokens existed behaves exactly as before. Each key
takes a string or an array of strings.

There is no registry switch for this check, unlike `deviceIdCheck` above. Writing a
restriction onto a token is the opt in, and once it is there it is always enforced.

| key | compared against |
|-----|------------------|
| `tenant` | `req.soajs.tenant.id` |
| `product` | `req.soajs.tenant.application.product` |
| `package` | `req.soajs.tenant.application.package` |
| `key` | `req.soajs.tenant.key.eKey` |
| `env` | the gateway environment, matched case insensitively |
| `agent` | the `user-agent` request header |

The first five come from the ext key on the request, which `mw/mt` resolves before oauth runs.
So a token minted for one tenant and product is refused on any other key, which is the point.

`agent` is an exact match, and this is the only place agent is ever enforced. The login and
refresh flows do not check it, so setting it affects nothing but the token that carries it.
Use it only on short lived tokens, a user-agent string changes whenever the browser updates.

This check is only available for type 2, a type 0 JWT carries no stored token record.

##### Failing closed

A service with `extKeyRequired` off gives the request no key, so there is nothing to compare
against. A token carrying `restrictedTo` is **denied** in that case rather than allowed
through, otherwise a restricted token could escape its restriction by targeting a keyless
service.

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
| 147 | Token restriction mismatch, the token's restrictedTo does not allow this request |
| 156 | Device forbidden, the deviceId on the token does not match the device-id header |
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
