# Service Discovery Modes

The SOAJS Controller Gateway supports two service discovery modes: Custom (non-Kubernetes) and HA (Kubernetes/Docker Swarm).

## Discovery Modes Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           SERVICE DISCOVERY MODES                               │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────┐    ┌──────────────────────────────────────────┐
│        CUSTOM MODE              │    │            HA MODE                       │
│      (Non-Kubernetes)           │    │     (Kubernetes / Docker Swarm)          │
├─────────────────────────────────┤    ├──────────────────────────────────────────┤
│                                 │    │                                          │
│  ┌─────────────────────────┐    │    │  ┌──────────────────────────────────┐    │
│  │      Registry DB        │    │    │  │        Cluster API               │    │
│  │   (MongoDB/Local)       │    │    │  │    (K8s API / Docker API)        │    │
│  └───────────┬─────────────┘    │    │  └────────────────┬─────────────────┘    │
│              │                  │    │                   │                      │
│              ▼                  │    │                   ▼                      │
│  ┌─────────────────────────┐    │    │  ┌──────────────────────────────────┐    │
│  │   Static Host List      │    │    │  │    Dynamic Service Discovery     │    │
│  │   per Service/Version   │    │    │  │    via Labels/Selectors          │    │
│  └───────────┬─────────────┘    │    │  └────────────────┬─────────────────┘    │
│              │                  │    │                   │                      │
│              ▼                  │    │                   ▼                      │
│  ┌─────────────────────────┐    │    │  ┌──────────────────────────────────┐    │
│  │   In-Memory Health      │    │    │  │   Automatic Health Monitoring    │    │
│  │   State Tracking        │    │    │  │   via Pod/Container Status       │    │
│  └───────────┬─────────────┘    │    │  └────────────────┬─────────────────┘    │
│              │                  │    │                   │                      │
│              ▼                  │    │                   ▼                      │
│  ┌─────────────────────────┐    │    │  ┌──────────────────────────────────┐    │
│  │   Round-Robin           │    │    │  │   Cluster Load Balancing         │    │
│  │   Selection             │    │    │  │   (via Service/Ingress)          │    │
│  └─────────────────────────┘    │    │  └──────────────────────────────────┘    │
│                                 │    │                                          │
└─────────────────────────────────┘    └──────────────────────────────────────────┘
```

## Custom Mode

Used when running outside of container orchestration platforms.

### Configuration

Set via environment variable:
```bash
# Do not set SOAJS_DEPLOY_HA, or set it to empty
unset SOAJS_DEPLOY_HA
```

### How it Works

1. **Registry Loading**: Service hosts are loaded from MongoDB registry
2. **Host List**: Static list of hosts per service/version
3. **Health Tracking**: In-memory state tracking with heartbeat
4. **Load Balancing**: Round-robin selection among healthy hosts

### Registry Structure

```javascript
// In environment registry
{
  "services": {
    "oauth": {
      "port": 4002,
      "hosts": {
        "1": ["host1.local", "host2.local"],
        "2": ["host3.local"]
      }
    }
  }
}
```

## HA Mode (Kubernetes)

Used when running in Kubernetes.

### Configuration

```bash
export SOAJS_DEPLOY_HA=kubernetes
```

### How it Works

1. **API Discovery**: Uses Kubernetes API to discover services
2. **Label Selectors**: Finds pods via SOAJS labels
3. **Health Monitoring**: Leverages pod readiness/liveness probes
4. **Load Balancing**: Can use Kubernetes Service or direct pod access

### Kubernetes Labels

SOAJS uses these labels to discover services:

```yaml
metadata:
  labels:
    soajs.env.code: dev
    soajs.service.name: oauth
    soajs.service.version: "1"
```

## HA Mode (Docker Swarm)

Used when running in Docker Swarm.

### Configuration

```bash
export SOAJS_DEPLOY_HA=swarm
```

### How it Works

1. **API Discovery**: Uses Docker Swarm API to discover services
2. **Label Selectors**: Finds tasks via SOAJS labels
3. **Health Monitoring**: Leverages task health checks
4. **Load Balancing**: Can use Swarm service mesh or direct task access

## Awareness Middleware

**File:** `mw/awareness/index.js`

The awareness middleware attaches helper functions to the request:

```javascript
req.soajs.awareness = {
  getHost: function(serviceName, version, callback) {
    // Returns host:port for the service
  },
  getLatestVersion: function(serviceName, callback) {
    // Returns latest available version
  }
};
```

## Cross-Environment Awareness

**File:** `mw/awarenessEnv/index.js`

For roaming requests that need to access services in other environments:

```javascript
req.soajs.awarenessEnv = {
  getHost: function(envCode, serviceName, version, callback) {
    // Returns host:port for service in specified environment
  }
};
```

## Driver Module

**File:** `modules/driver/index.js`

The driver module abstracts infrastructure-specific operations:

| Method | Description |
|--------|-------------|
| `getServiceHosts()` | Get all hosts for a service |
| `getServiceHost()` | Get a single host (load balanced) |
| `getLatestVersion()` | Get latest version number |
| `getInfo()` | Get node/container info |
