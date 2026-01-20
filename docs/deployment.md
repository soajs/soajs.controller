# Deployment Architecture

High availability deployment patterns for the SOAJS Controller Gateway.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          DEPLOYMENT ARCHITECTURE                                │
└─────────────────────────────────────────────────────────────────────────────────┘

                        ┌─────────────────────────────┐
                        │       Load Balancer         │
                        │    (External/Cloud LB)      │
                        └─────────────┬───────────────┘
                                      │
              ┌───────────────────────┼───────────────────────┐
              │                       │                       │
              ▼                       ▼                       ▼
    ┌─────────────────────┐ ┌─────────────────────┐ ┌─────────────────────┐
    │  Controller Node 1  │ │  Controller Node 2  │ │  Controller Node N  │
    │  ┌───────────────┐  │ │  ┌───────────────┐  │ │  ┌───────────────┐  │
    │  │  Main: 4000   │  │ │  │  Main: 4000   │  │ │  │  Main: 4000   │  │
    │  │  Maint: 5000  │  │ │  │  Maint: 5000  │  │ │  │  Maint: 5000  │  │
    │  └───────────────┘  │ │  └───────────────┘  │ │  └───────────────┘  │
    └─────────┬───────────┘ └─────────┬───────────┘ └─────────┬───────────┘
              │                       │                       │
              └───────────────────────┼───────────────────────┘
                                      │
                                      ▼
    ┌─────────────────────────────────────────────────────────────────────────────┐
    │                         SHARED INFRASTRUCTURE                               │
    │                                                                             │
    │   ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐ │
    │   │  MongoDB Cluster│  │ Kubernetes/Swarm│  │     Microservices           │ │
    │   │  (Core DB)      │  │ (Service Mesh)  │  │     (Backend Services)      │ │
    │   └─────────────────┘  └─────────────────┘  └─────────────────────────────┘ │
    │                                                                             │
    └─────────────────────────────────────────────────────────────────────────────┘
```

## Deployment Modes

### Standalone Mode

Single instance deployment for development/testing.

```bash
# Environment variables
export SOAJS_ENV=dev
export SOAJS_PROFILE=/path/to/profile.js

# Start
node .
```

### Cluster Mode (Custom)

Multiple instances with external load balancer.

```bash
# Each node
export SOAJS_ENV=prod
export SOAJS_PROFILE=/path/to/profile.js

# Start multiple instances behind LB
node .
```

### Kubernetes Mode

Deploy as Kubernetes Deployment/Service.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: soajs-controller
  labels:
    soajs.service.name: controller
    soajs.service.version: "1"
spec:
  replicas: 3
  selector:
    matchLabels:
      soajs.service.name: controller
  template:
    metadata:
      labels:
        soajs.service.name: controller
        soajs.service.version: "1"
        soajs.env.code: prod
    spec:
      containers:
      - name: controller
        image: soajsorg/gateway:latest
        ports:
        - containerPort: 4000
          name: main
        - containerPort: 5000
          name: maintenance
        env:
        - name: SOAJS_ENV
          value: "prod"
        - name: SOAJS_DEPLOY_HA
          value: "kubernetes"
        - name: SOAJS_PROFILE
          value: "/opt/soajs/profiles/profile.js"
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
---
apiVersion: v1
kind: Service
metadata:
  name: soajs-controller
spec:
  selector:
    soajs.service.name: controller
  ports:
  - port: 4000
    targetPort: 4000
    name: main
  - port: 5000
    targetPort: 5000
    name: maintenance
```

### Docker Swarm Mode

Deploy as Docker Swarm service.

```bash
docker service create \
  --name soajs-controller \
  --replicas 3 \
  --publish 4000:4000 \
  --publish 5000:5000 \
  --env SOAJS_ENV=prod \
  --env SOAJS_DEPLOY_HA=swarm \
  --env SOAJS_PROFILE=/opt/soajs/profiles/profile.js \
  --mount type=bind,source=/opt/soajs/profiles,target=/opt/soajs/profiles \
  soajsorg/gateway:latest
```

## Port Configuration

| Port | Purpose | Protocol |
|------|---------|----------|
| 4000 | Main gateway | HTTP |
| 5000 | Maintenance | HTTP |

## Health Checks

### Liveness Check

```bash
curl http://localhost:5000/heartbeat
```

Returns `200 OK` if the gateway is running.

### Readiness Check

```bash
curl http://localhost:5000/awarenessStat
```

Returns service awareness state.

## Scaling Considerations

### Horizontal Scaling

- All instances are stateless
- Share MongoDB for state
- Load balance with sticky sessions not required

### Resource Recommendations

| Environment | CPU | Memory |
|-------------|-----|--------|
| Development | 0.5 | 512MB |
| Staging | 1 | 1GB |
| Production | 2+ | 2GB+ |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SOAJS_ENV` | Environment code | `"dev"` |
| `SOAJS_SOLO` | Solo mode (no DB) | - |
| `SOAJS_DEPLOY_HA` | HA mode | - |
| `SOAJS_PROFILE` | Profile path | `"./profiles/single.js"` |
| `SOAJS_MAX_BODY_SIZE` | Max body size | `"10mb"` |
| `SOAJS_SENSITIVE_ENVS` | Sensitive envs | `["dashboard"]` |
