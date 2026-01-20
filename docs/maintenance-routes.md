# Maintenance Routes

The SOAJS Controller provides maintenance endpoints on a separate port (default: 5000) for health checks, configuration management, and system administration.

## Server Overview

**File:** `server/maintenance.js`

**Default Port:** 5000

The maintenance server runs on a separate port from the main gateway to allow internal access for health checks and administration without exposing these endpoints publicly.

## Available Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/heartbeat` | GET | Basic health check |
| `/loadProvision` | GET | Reload provision/tenant data |
| `/reloadRegistry` | GET | Reload environment registry |
| `/awarenessStat` | GET | Get service awareness statistics |

---

## 1. Heartbeat (`/heartbeat`)

**Endpoint:** `GET /heartbeat`

**Purpose:** Basic health check to verify the gateway is running.

### Response

```javascript
{
  "result": true,
  "ts": 1699999999999,           // Timestamp
  "service": {
    "service": "controller",
    "type": "rest",
    "route": "/heartbeat"
  }
}
```

### Usage

```bash
curl http://localhost:5000/heartbeat
```

### Kubernetes/Docker Health Probes

```yaml
# Kubernetes
livenessProbe:
  httpGet:
    path: /heartbeat
    port: 5000
  initialDelaySeconds: 30
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /heartbeat
    port: 5000
  initialDelaySeconds: 5
  periodSeconds: 5
```

---

## 2. Load Provision (`/loadProvision`)

**Endpoint:** `GET /loadProvision`

**Purpose:** Reloads tenant, key, and package data from the Core DB.

### Response

```javascript
{
  "result": true,
  "ts": 1699999999999,
  "service": {
    "service": "controller",
    "type": "rest",
    "route": "/loadProvision"
  }
}
```

### Usage

```bash
curl http://localhost:5000/loadProvision
```

### When to Use

- After updating tenant configurations
- After modifying application keys
- After changing package ACLs
- To force refresh of cached provision data

---

## 3. Reload Registry (`/reloadRegistry`)

**Endpoint:** `GET /reloadRegistry`

**Purpose:** Reloads the environment registry from the Core DB.

### Response

```javascript
{
  "result": true,
  "ts": 1699999999999,
  "service": {
    "service": "controller",
    "type": "rest",
    "route": "/reloadRegistry"
  }
}
```

### Usage

```bash
curl http://localhost:5000/reloadRegistry
```

### What Gets Reloaded

- Service definitions and hosts
- Database configurations
- Service config (throttling, CORS, OAuth)
- Custom gateway settings
- All environment-specific settings

### When to Use

- After modifying environment configuration
- After adding new services
- After changing service hosts
- After modifying custom registry settings

---

## 4. Awareness Statistics (`/awarenessStat`)

**Endpoint:** `GET /awarenessStat`

**Purpose:** Returns the current state of service awareness/discovery.

### Response (Custom Mode)

```javascript
{
  "result": true,
  "ts": 1699999999999,
  "service": {
    "service": "controller",
    "type": "rest",
    "route": "/awarenessStat"
  },
  "data": {
    "services": {
      "oauth": {
        "1": {
          "hosts": ["host1.local:4002", "host2.local:4002"],
          "healthy": 2
        },
        "2": {
          "hosts": ["host3.local:4002"],
          "healthy": 1
        }
      },
      "urac": {
        "3": {
          "hosts": ["host1.local:4001"],
          "healthy": 1
        }
      }
    }
  }
}
```

### Response (HA Mode)

```javascript
{
  "result": true,
  "ts": 1699999999999,
  "service": {
    "service": "controller",
    "type": "rest",
    "route": "/awarenessStat"
  },
  "data": {
    "mode": "kubernetes",
    "services": {
      "oauth": {
        "1": {
          "pods": ["oauth-v1-abc123", "oauth-v1-def456"],
          "healthy": 2
        }
      }
    }
  }
}
```

### Usage

```bash
curl http://localhost:5000/awarenessStat
```

### When to Use

- To verify service discovery is working
- To check service health status
- To debug routing issues
- To monitor cluster state

---

## Security Considerations

### Network Access

The maintenance port should only be accessible from:
- Internal networks
- Kubernetes cluster (for probes)
- Monitoring systems

### Firewall Rules

```bash
# Example: Only allow internal access to maintenance port
iptables -A INPUT -p tcp --dport 5000 -s 10.0.0.0/8 -j ACCEPT
iptables -A INPUT -p tcp --dport 5000 -j DROP
```

### Kubernetes NetworkPolicy

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: controller-maintenance
spec:
  podSelector:
    matchLabels:
      soajs.service.name: controller
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: monitoring
    ports:
    - port: 5000
```

---

## Integration with Monitoring

### Prometheus Metrics

The heartbeat endpoint can be used with Prometheus blackbox exporter:

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'soajs-controller'
    metrics_path: /probe
    params:
      module: [http_2xx]
    static_configs:
      - targets:
        - http://controller:5000/heartbeat
    relabel_configs:
      - source_labels: [__address__]
        target_label: __param_target
      - source_labels: [__param_target]
        target_label: instance
      - target_label: __address__
        replacement: blackbox-exporter:9115
```

### Health Check Scripts

```bash
#!/bin/bash
# health-check.sh

RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/heartbeat)

if [ "$RESPONSE" == "200" ]; then
  echo "Gateway is healthy"
  exit 0
else
  echo "Gateway health check failed: HTTP $RESPONSE"
  exit 1
fi
```
