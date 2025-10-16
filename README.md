# soajs.controller
The Controller is the main gateway to all of SOAJS services.

##Installation

```sh
$ npm install soajs.controller
$ node.
```

---

###Self Awareness:
The controller's main functionality is to perform heartbeat checks on the remaining services.<br>
This approach allows the self awareness feature that SOAJS offers.

If a service is down or does not exist, the controller will return a message back to the sender without crashing.<br>
When a new service is created or added to the cloud, the controller will detect its presence.<br>
All requests to this new service will then be forwarded.

###Security:
When a request is made to a SOAJS service, the controller checks if this service is running, and accessible.<br>
Before forwarding the request or checking if the service is up and running, the controller makes performs some clearance checks:

1. Checks if the service needs a key and that the key is provided in the request and allows access to this service.
2. Retrieves the ACL of the tenant of this key and checks if the tenant has permission to use the requested service.
3. Performs a heartbeat check to make sure the service is alive.
4. Checks the Authorization of the header if the service requires authorization to be accessed like oAuth.
5. Forwards the request if all is ok.

###Cors:
SOAJS controller also provides support for CORS (Cross Origin Resource Sharing).

Enabling CORS allows different domains to communicate with SOAJS via its gateway to post and pull resources without having to deal with "cross-domain" issues and by simply using the standard protocols: GET - POST - DELETE - PUT.

---

## Environment Variables

The SOAJS Controller can be configured using the following environment variables:

### Core Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `SOAJS_ENV` | string | `"dev"` | Environment code (e.g., dev, staging, production) |
| `SOAJS_PROFILE` | string | `./profiles/single.js` (mongo mode)<br>`./profiles/solo.js` (solo mode) | Path to the SOAJS profile configuration file |
| `SOAJS_SOLO` | boolean | `false` | Enable solo mode (uses local registry instead of MongoDB) |
| `SOAJS_SRVIP` | string | auto-detected | Service IP address for registration |
| `SOAJS_SRV_AUTOREGISTERHOST` | boolean | `true` | Automatically register host with the service |

### Deployment & High Availability

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `SOAJS_DEPLOY_HA` | string | - | High availability deployment type (`kubernetes`, `swarm`, or empty for non-HA) |
| `SOAJS_DEPLOY_MANUAL` | number | - | Manual deployment mode flag (1 = enabled) |
| `SOAJS_MANUAL` | boolean | - | Skip automatic deployment operations |
| `SOAJS_SWARM_UNIX_PORT` | string | `/var/run/docker.sock` | Docker Swarm Unix socket path |

### Security & Tenant Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `SOAJS_SENSITIVE_ENVS` | JSON array | `["dashboard"]` | List of sensitive environment codes requiring additional security checks |

### Performance & Resource Management

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `SOAJS_MAX_BODY_SIZE` | number | `10485760` (10MB) | Maximum request body size in bytes for monitoring. Prevents memory exhaustion from large request bodies |
| `SOAJS_THROTTLE_CLEANUP_INTERVAL` | number | `60000` (1 min) | Interval in milliseconds for cleaning up expired throttling cache entries |

### Database & Connection

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `SOAJS_MONGO_CON_KEEPALIVE` | boolean | `false` | Enable MongoDB connection keepalive |

### Testing & Development

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `SOAJS_TEST` | boolean | - | Enable test mode (affects registry loading and service queries) |
| `SOAJS_IMPORTER_DROPDB` | boolean | `false` | Drop database before importing (test data only) |
| `NODE_ENV` | string | - | Node.js environment mode (development, production) |
| `APP_DIR_FOR_CODE_COVERAGE` | string | `../` | Directory path for code coverage testing |
| `SHOW_LOGS` | boolean | - | Enable/disable log output for testing |

### Example Configurations

#### Production Kubernetes Deployment
```bash
export SOAJS_ENV=production
export SOAJS_DEPLOY_HA=kubernetes
export SOAJS_SRVIP=10.0.1.50
export SOAJS_PROFILE=/etc/soajs/profile.js
export SOAJS_SENSITIVE_ENVS='["dashboard","production"]'
export SOAJS_MAX_BODY_SIZE=20971520  # 20MB
export SOAJS_THROTTLE_CLEANUP_INTERVAL=120000  # 2 minutes
export SOAJS_MONGO_CON_KEEPALIVE=true
export NODE_ENV=production
```

#### Solo Development Mode
```bash
export SOAJS_ENV=dev
export SOAJS_SOLO=true
export SOAJS_SRVIP=127.0.0.1
export SOAJS_PROFILE=/opt/soajs/profiles/dev.js
```

#### Docker Swarm Deployment
```bash
export SOAJS_ENV=staging
export SOAJS_DEPLOY_HA=swarm
export SOAJS_SWARM_UNIX_PORT=/var/run/docker.sock
export SOAJS_PROFILE=/config/soajs_profile.js
```

---

More information on the Controller is available on the website section [Controller](https://soajsorg.atlassian.net/wiki/x/loAwb)



### License
*Copyright SOAJS All Rights Reserved.*

Use of this source code is governed by an Apache license that can be found in the LICENSE file at the root of this repository.

