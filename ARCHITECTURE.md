# SOAJS Controller Gateway - System Architecture

## Overview

The SOAJS Controller is an API Gateway that serves as the central entry point for all microservices in the SOAJS ecosystem. It handles routing, service discovery, multi-tenant authentication, rate limiting, and request proxying.

```
                                    SOAJS Controller Gateway Architecture
                                    =====================================

    ┌─────────────────────────────────────────────────────────────────────────────────────────┐
    │                                      CLIENTS                                            │
    │                     (Web Apps, Mobile Apps, External Services)                          │
    └───────────────────────────────────────┬─────────────────────────────────────────────────┘
                                            │
                                            ▼
    ┌─────────────────────────────────────────────────────────────────────────────────────────┐
    │                              SOAJS CONTROLLER GATEWAY                                   │
    │                                    (Port 4000)                                          │
    │  ┌───────────────────────────────────────────────────────────────────────────────────┐  │
    │  │                           MIDDLEWARE PIPELINE                                     │  │
    │  │                                                                                   │  │
    │  │   ┌─────────┐  ┌──────┐  ┌──────────┐  ┌─────────┐  ┌───────────┐  ┌───────────┐  │  │
    │  │   │  SOAJS  │─▶│ CORS │─▶│ Favicon  │─▶│Response │─▶│ Enhancer  │─▶│  IP2Ban   │  │  │
    │  │   │  Init   │  │      │  │          │  │ Builder │  │           │  │           │  │  │
    │  │   └─────────┘  └──────┘  └──────────┘  └─────────┘  └───────────┘  └───────────┘  │  │
    │  │        │                                                                     │    │  │
    │  │        ▼                                                                     ▼    │  │
    │  │   ┌──────────────┐  ┌─────────┐  ┌───────────┐  ┌─────────┐  ┌───────────────┐    │  │
    │  │   │ Maintenance  │─▶│   URL   │─▶│ Awareness │─▶│   Key   │─▶│   Key ACL     │    │  │
    │  │   │    Mode      │  │ Parser  │  │           │  │ Loader  │  │  Extractor    │    │  │
    │  │   └──────────────┘  └─────────┘  └───────────┘  └─────────┘  └───────────────┘    │  │
    │  │                                                                     │             │  │
    │  │                                                                     ▼             │  │
    │  │   ┌──────────────┐  ┌─────────────┐  ┌─────────┐  ┌───────────────────────────┐   │  │
    │  │   │   Traffic    │◀─│    OAuth    │◀─│   MT    │◀─│      Goto Service         │   │  │
    │  │   │  (Throttle)  │  │   (Auth)    │  │(Tenant) │  │   (Route Selection)       │   │  │
    │  │   └──────────────┘  └─────────────┘  └─────────┘  └───────────────────────────┘   │  │
    │  │        │                                                                          │  │
    │  │        ▼                                                                          │  │
    │  │   ┌──────────────┐  ┌─────────────────────────────────────────────────────────┐   │  │
    │  │   │  Last Seen   │─▶│                    REQUEST HANDLER                      │   │  │
    │  │   │   Tracker    │  │            (Proxy to Target Service)                    │   │  │
    │  │   └──────────────┘  └─────────────────────────────────────────────────────────┘   │  │
    │  │                                                                                   │  │
    │  └───────────────────────────────────────────────────────────────────────────────────┘  │
    │                                                                                         │
    │  ┌───────────────────────────────────────────────────────────────────────────────────┐  │
    │  │                              CORE MODULES                                         │  │
    │  │                                                                                   │  │
    │  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐  ┌─────────────────┐  │  │
    │  │  │    Registry    │  │   Provision    │  │    Awareness   │  │     Driver      │  │  │
    │  │  │    Module      │  │    Module      │  │     Engine     │  │   (K8s/Swarm)   │  │  │
    │  │  └────────────────┘  └────────────────┘  └────────────────┘  └─────────────────┘  │  │
    │  │                                                                                   │  │
    │  └───────────────────────────────────────────────────────────────────────────────────┘  │
    │                                                                                         │
    │  ┌───────────────────────────────────────────────────────────────────────────────────┐  │
    │  │                          MAINTENANCE SERVER (Port 5000)                           │  │
    │  │         /heartbeat    /loadProvision    /reloadRegistry    /awarenessStat         │  │
    │  └───────────────────────────────────────────────────────────────────────────────────┘  │
    └─────────────────────────────────────────────────────────────────────────────────────────┘
                                            │
            ┌───────────────────────────────┼───────────────────────────────┐
            │                               │                               │
            ▼                               ▼                               ▼
    ┌───────────────────┐       ┌───────────────────┐           ┌───────────────────┐
    │   MICROSERVICES   │       │    DATA STORES    │           │ EXTERNAL SERVICES │
    │                   │       │                   │           │                   │
    │  ┌─────────────┐  │       │  ┌─────────────┐  │           │  ┌─────────────┐  │
    │  │  Service A  │  │       │  │   Core DB   │  │           │  │   OAuth     │  │
    │  │  (v1, v2)   │  │       │  │  (MongoDB)  │  │           │  │   Service   │  │
    │  └─────────────┘  │       │  └─────────────┘  │           │  └─────────────┘  │
    │  ┌─────────────┐  │       │  ┌─────────────┐  │           │  ┌─────────────┐  │
    │  │  Service B  │  │       │  │   Meta DB   │  │           │  │    URAC     │  │
    │  │  (v1)       │  │       │  │  (Tenant)   │  │           │  │   Service   │  │
    │  └─────────────┘  │       │  └─────────────┘  │           │  └─────────────┘  │
    │  ┌─────────────┐  │       │  ┌─────────────┐  │           │  ┌─────────────┐  │
    │  │  Service C  │  │       │  │ Throttle DB │  │           │  │ SOA Monitor │  │
    │  │  (v1, v2)   │  │       │  │ (Optional)  │  │           │  │   Service   │  │
    │  └─────────────┘  │       │  └─────────────┘  │           │  └─────────────┘  │
    │                   │       │                   │           │                   │
    └───────────────────┘       └───────────────────┘           └───────────────────┘
```

---

## Component Descriptions

### 1. Middleware Pipeline

The gateway processes requests through a sequential middleware pipeline:

| Order | Middleware | Responsibility | Documentation |
|-------|------------|----------------|---------------|
| 1 | **soajs** | Initializes `req.soajs` context, attaches registry, sets up logging | [soajs.md](docs/middleware/soajs.md) |
| 2 | **cors** | Handles CORS preflight (OPTIONS) and headers | [cors.md](docs/middleware/cors.md) |
| 3 | **favicon** | Serves favicon requests | [favicon.md](docs/middleware/favicon.md) |
| 4 | **response** | Adds `buildResponse()` and `controllerResponse()` helpers | [response.md](docs/middleware/response.md) |
| 5 | **enhancer** | Adds `req.get()` method for case-insensitive header retrieval | [enhancer.md](docs/middleware/enhancer.md) |
| 6 | **ip2ban** | Enforces IP blacklist from gateway configuration | [ip2ban.md](docs/middleware/ip2ban.md) |
| 7 | **maintenanceMode** | Returns 503 if gateway is in maintenance mode | [maintenanceMode.md](docs/middleware/maintenanceMode.md) |
| 8 | **url** | Parses URL into service name, version, and path components | [url.md](docs/middleware/url.md) |
| 9 | **awareness** | Initializes service discovery (getHost, getLatestVersion) | [awareness.md](docs/middleware/awareness.md) |
| 10 | **awarenessEnv** | Provides cross-environment awareness for roaming | - |
| 11 | **key** | Retrieves and validates external key from provision DB | [key.md](docs/middleware/key.md) |
| 12 | **keyACL** | Extracts ACL from tenant application or package | [keyACL.md](docs/middleware/keyACL.md) |
| 13 | **gotoService** | Determines routing strategy and validates service | [gotoService.md](docs/middleware/gotoService.md) |
| 14 | **mt** | Multi-tenant processing: security checks, URAC integration | [mt.md](docs/middleware/mt.md) |
| 15 | **oauth** | OAuth2 server authorization or JWT verification | [oauth.md](docs/middleware/oauth.md) |
| 16 | **traffic** | Rate limiting with public/private strategies | [traffic.md](docs/middleware/traffic.md) |
| 17 | **lastSeen** | Async notification to URAC for user activity tracking | [lastSeen.md](docs/middleware/lastSeen.md) |

### 2. Core Modules

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                               CORE MODULES                                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌──────────────────────┐      ┌──────────────────────┐                         │
│  │   REGISTRY MODULE    │      │   PROVISION MODULE   │                         │
│  ├──────────────────────┤      ├──────────────────────┤                         │
│  │ • Service definitions│      │ • Tenant management  │                         │
│  │ • Host mappings      │      │ • Application data   │                         │
│  │ • Version configs    │      │ • Key validation     │                         │
│  │ • Database configs   │      │ • Package ACLs       │                         │
│  │ • Service configs    │      │ • OAuth models       │                         │
│  │ • Custom gateway     │      │                      │                         │
│  │   settings           │      │                      │                         │
│  └──────────────────────┘      └──────────────────────┘                         │
│                                                                                 │
│  ┌──────────────────────┐      ┌──────────────────────┐                         │
│  │   AWARENESS ENGINE   │      │   DRIVER MODULE      │                         │
│  ├──────────────────────┤      ├──────────────────────┤                         │
│  │ • Service discovery  │      │ • Kubernetes client  │                         │
│  │ • Health tracking    │      │ • Docker Swarm       │                         │
│  │ • Load balancing     │      │ • Service lookups    │                         │
│  │ • Host resolution    │      │ • Node management    │                         │
│  │ • Version resolution │      │ • Health monitoring  │                         │
│  └──────────────────────┘      └──────────────────────┘                         │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Additional Documentation

| Document | Description |
|----------|-------------|
| [Request Flow](docs/request-flow.md) | Complete request lifecycle through the gateway |
| [Multi-Tenant Security](docs/multi-tenant-security.md) | Security pipeline and validation checks |
| [Service Discovery](docs/service-discovery.md) | Custom and HA service discovery modes |
| [Data Flow](docs/data-flow.md) | Database interactions and data flow |
| [External Integrations](docs/external-integrations.md) | OAuth, URAC, and infrastructure integrations |
| [Deployment Architecture](docs/deployment.md) | High availability deployment patterns |
| [Custom Registry Configuration](docs/configuration-custom-registry.md) | Environment-specific gateway settings |
| [Services Config](docs/configuration-services-config.md) | Tenant key-specific configuration |
| [Gateway Routes](docs/gateway-routes.md) | Built-in gateway routes (/soajs/acl, /soajs/proxy) |
| [Maintenance Routes](docs/maintenance-routes.md) | Health check and admin endpoints |

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `server/controller.js` | Main gateway orchestration |
| `server/maintenance.js` | Health check and admin server |
| `modules/registry/index.js` | Configuration loading and management |
| `modules/driver/index.js` | Infrastructure abstraction layer |
| `mw/key/index.js` | External key loading and validation |
| `mw/keyACL/index.js` | ACL extraction from key/package |
| `mw/gotoService/index.js` | Route selection and service discovery |
| `mw/mt/index.js` | Multi-tenant processing |
| `mw/traffic/index.js` | Rate limiting implementation |
| `lib/request.js` | HTTP proxy and request utilities |
| `utilities/utils.js` | Error handlers and utilities |

---

## Summary

The SOAJS Controller Gateway is a comprehensive API Gateway solution that provides:

- **Multi-tenant Architecture**: Full isolation between tenants with configurable ACLs
- **Service Discovery**: Support for both static registry and dynamic HA modes (K8s/Swarm)
- **Security**: OAuth2/JWT authentication, IP whitelisting, geo-blocking, device fingerprinting
- **Traffic Management**: Configurable rate limiting with multiple storage backends
- **Request Proxying**: HTTP proxy with monitoring, timeout management, and heartbeat renewal
- **Observability**: Integration with monitoring services and comprehensive logging
- **High Availability**: Horizontal scaling with shared state in MongoDB
