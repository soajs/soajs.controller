# External Integrations

The SOAJS Controller Gateway integrates with external services and infrastructure platforms.

## Integration Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          EXTERNAL INTEGRATIONS                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                 │
│  ┌──────────────────────┐    ┌──────────────────────┐    ┌────────────────────┐ │
│  │    OAuth Service     │    │    URAC Service      │    │   SOA Monitor      │ │
│  ├──────────────────────┤    ├──────────────────────┤    ├────────────────────┤ │
│  │                      │    │                      │    │                    │ │
│  │  Endpoints:          │    │  Endpoints:          │    │  Endpoints:        │ │
│  │  • /token            │    │  • /user/getprofile  │    │  • /monitor/item   │ │
│  │  • /authorization    │    │  • /user/last/seen   │    │                    │ │
│  │                      │    │                      │    │                    │ │
│  │  Functions:          │    │  Functions:          │    │  Functions:        │ │
│  │  • Token validation  │    │  • User profiles     │    │  • Request metrics │ │
│  │  • Token refresh     │    │  • Group resolution  │    │  • Response times  │ │
│  │  • Authorization     │    │  • Activity tracking │    │  • Error tracking  │ │
│  │                      │    │  • ACL by user       │    │                    │ │
│  └──────────────────────┘    └──────────────────────┘    └────────────────────┘ │
│                                                                                 │
│  ┌──────────────────────┐    ┌──────────────────────┐                           │
│  │   Kubernetes API     │    │   Docker Swarm API   │                           │
│  ├──────────────────────┤    ├──────────────────────┤                           │
│  │                      │    │                      │                           │
│  │  Functions:          │    │  Functions:          │                           │
│  │  • Service discovery │    │  • Service discovery │                           │
│  │  • Pod listing       │    │  • Task listing      │                           │
│  │  • Health checks     │    │  • Health checks     │                           │
│  │  • Label selectors   │    │  • Label selectors   │                           │
│  │                      │    │                      │                           │
│  └──────────────────────┘    └──────────────────────┘                           │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## OAuth Service Integration

The gateway integrates with the SOAJS OAuth service for authentication.

### Token Validation

**Middleware:** `mw/oauth/index.js`

- Validates access tokens against OAuth service
- Supports both OAuth2 password grant and JWT
- Handles token refresh

### Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/token` | POST | Exchange credentials for tokens |
| `/authorization` | GET | Validate token |

### Configuration

OAuth is configured via the registry:

```javascript
{
  "serviceConfig": {
    "oauth": {
      "grants": ["password", "refresh_token"],
      "tokenLife": 7200,
      "refreshTokenLife": 1209600
    }
  }
}
```

## URAC Service Integration

The gateway integrates with URAC (User Registration and Access Control) for user management.

### User Profile Loading

**Middleware:** `mw/mt/urac.js`

- Loads user profiles for authenticated requests
- Resolves user groups and permissions
- Applies user-specific ACL overrides

### Activity Tracking (Last Seen)

**Middleware:** `mw/lastSeen/index.js`

- Notifies URAC of user activity
- Configurable via custom registry

### Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/user/getprofile` | GET | Get user profile |
| `/user/last/seen` | POST | Update last seen timestamp |

## SOA Monitor Integration

Optional integration for request monitoring and metrics.

### Request Monitoring

**Middleware:** `mw/gotoService/redirectToService.js`

- Sends request metrics to SOA Monitor
- Configurable via custom registry blacklist/whitelist

### Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/monitor/item` | POST | Submit request metrics |

## Kubernetes API Integration

**Module:** `modules/driver/kubernetes.js`

Used when `SOAJS_DEPLOY_HA=kubernetes`.

### Operations

| Operation | API Endpoint | Purpose |
|-----------|--------------|---------|
| List Pods | `/api/v1/namespaces/{ns}/pods` | Service discovery |
| Get Pod | `/api/v1/namespaces/{ns}/pods/{name}` | Health check |
| List Services | `/api/v1/namespaces/{ns}/services` | Service info |

### Authentication

- Uses in-cluster service account token
- Token path: `/var/run/secrets/kubernetes.io/serviceaccount/token`
- CA path: `/var/run/secrets/kubernetes.io/serviceaccount/ca.crt`

## Docker Swarm API Integration

**Module:** `modules/driver/swarm.js`

Used when `SOAJS_DEPLOY_HA=swarm`.

### Operations

| Operation | API Endpoint | Purpose |
|-----------|--------------|---------|
| List Tasks | `/tasks` | Service discovery |
| List Services | `/services` | Service info |
| Inspect Node | `/nodes/{id}` | Node info |

### Authentication

- Connects to Docker socket
- Default: `/var/run/docker.sock`
