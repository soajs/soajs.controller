# Awareness Middleware

**File:** `mw/awareness/index.js`

**Order:** 9

The Awareness middleware provides service discovery functions for resolving service hosts.

## Purpose

- Attaches service discovery functions to `req.soajs.awareness`
- Supports both Custom mode (static registry) and HA mode (Kubernetes/Swarm)
- Provides host resolution and version lookup

## Flow

```
  Incoming Request
       │
       ▼
  ┌─────────────────────┐
  │  Determine Mode     │ process.env.SOAJS_DEPLOY_HA?
  │  Custom or HA       │
  └────────┬────────────┘
           │
           ├─── No HA ──▶ Use custom.js driver
           │
           ├─── HA ──▶ Use ha.js driver
           │
           ▼
  ┌─────────────────────┐
  │  Attach Awareness   │ req.soajs.awareness = { ... }
  │  Functions          │
  └────────┬────────────┘
           │
           ▼
       next()
```

## Drivers

### Custom Mode (Non-HA)

**File:** `mw/awareness/custom.js`

- Uses registry's static host lists
- In-memory health tracking
- Round-robin load balancing

### HA Mode (Kubernetes/Swarm)

**File:** `mw/awareness/ha.js`

- Uses infrastructure module for discovery
- Dynamic service resolution via cluster API
- Automatic health monitoring

## Methods Added

### `req.soajs.awareness.getHost(serviceName, [version], callback)`

Resolves a host for the given service.

**Parameters:**
- `serviceName` - Name of the service
- `version` - Service version (optional)
- `callback` - Function receiving `(host)` where host is `"hostname:port"` or `null`

**Example:**
```javascript
req.soajs.awareness.getHost("oauth", "1", (host) => {
  if (host) {
    // host = "oauth-service:4002"
  }
});
```

### `req.soajs.awareness.getLatestVersion(serviceName, callback)`

Gets the latest available version of a service.

**Parameters:**
- `serviceName` - Name of the service
- `callback` - Function receiving `(version)` as string or `null`

**Example:**
```javascript
req.soajs.awareness.getLatestVersion("oauth", (version) => {
  // version = "2"
});
```

### `req.soajs.awareness.getLatestVersionFromCluster(serviceName, callback)`

(HA mode only) Gets the latest version directly from the cluster.

**Example:**
```javascript
if (process.env.SOAJS_DEPLOY_HA) {
  req.soajs.awareness.getLatestVersionFromCluster("oauth", (version) => {
    // Fresh lookup from K8s/Swarm API
  });
}
```

## Configuration

```javascript
{
  "awareness": true,           // Enable awareness
  "doNotRebuildCache": false   // Skip initial cache build (HA mode)
}
```

## Usage Notes

- Custom mode caches hosts in memory, updated via heartbeat
- HA mode queries cluster API for each lookup (with caching)
- Version can be omitted to get any available host
- Returns `null` if service/version not found
