# Key Middleware

**File:** `mw/key/index.js`

The Key middleware is responsible for loading and validating external tenant keys. It extracts the key from the request headers and retrieves the associated tenant, application, and package data from the provision database.

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           KEY MIDDLEWARE FLOW                                   │
└─────────────────────────────────────────────────────────────────────────────────┘

  Incoming Request
       │
       ▼
  ┌─────────────────┐
  │  Extract Key    │ req.get("key") - from headers
  │  from Headers   │
  └────────┬────────┘
           │
           ├─── No key? ──▶ next() (continue without key data)
           │
           ▼
  ┌─────────────────┐
  │  Get External   │ provision.getExternalKeyData(key, serviceConfig.key)
  │  Key Data       │
  └────────┬────────┘
           │
           ├─── Error/Not found? ──▶ Error 148 (Invalid or disabled key)
           │
           ▼
  ┌─────────────────┐
  │  Store keyObj   │ req.soajs.controller.serviceParams.keyObj = keyObj
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │  Validate Key   │ Check if key.env matches current environment
  │  Environment    │
  └────────┬────────┘
           │
           ├─── Mismatch? ──▶ Error 144 (Key not valid for this environment)
           │
           ▼
  ┌─────────────────────┐
  │  Network Package    │ Check keyObj.config.gateway.networkPackages
  │  Override           │ for network-based package substitution
  └────────┬────────────┘
           │
           ├─── Override found? ──▶ Replace keyObj.application.package
           │                        Log debug message
           ▼
  ┌─────────────────┐
  │  Get Package    │ provision.getPackageData(keyObj.application.package)
  │  Data           │
  └────────┬────────┘
           │
           ├─── Not found? ──▶ Error 149 (Package not found)
           │
           ▼
  ┌─────────────────┐
  │  Store packObj  │ req.soajs.controller.serviceParams.packObj = packObj
  └────────┬────────┘
           │
           ▼
       next()
```

## Key Object Structure (keyObj)

Source: `soajs.core.modules/soajs.core/provision/mongo.js` → `getKeyFromDb()`

```javascript
{
  "key": "internal_key_value",               // Internal key identifier
  "tenant": {
    "id": "tenant_id",                       // Tenant MongoDB _id as string
    "code": "TCODE",                         // Tenant code (uppercase)
    "name": "Tenant Name",                   // Tenant display name
    "locked": false,                         // Whether tenant is locked
    "type": "product",                       // "product" or "client"
    "profile": {},                           // Tenant profile metadata
    "main": {                                // Only for type="client" tenants
      "id": "main_tenant_id",                // Parent tenant ID
      "code": "MAIN_TCODE"                   // Parent tenant code
    }
  },
  "application": {
    "product": "PRODUCT_CODE",               // Product code
    "package": "PRODUCT_PACK",               // Package code for ACL lookup
    "appId": "application_id",               // Application MongoDB _id as string
    "acl": { ... },                          // Environment-specific ACL (resolved)
    "acl_all_env": { ... }                   // Full ACL object for all environments
  },
  "extKeys": [                               // Array of external keys for this key
    {
      "extKey": "encrypted_external_key",    // The external key value
      "env": "DEV",                          // Environment this extKey is valid for
      "device": { ... },                     // Optional: Device restrictions
      "geo": { ... },                        // Optional: Geo restrictions
      "dashboardAccess": false,              // Whether key has dashboard access
      "expDate": null                        // Expiration date (null = no expiry)
    }
  ],
  "config": {                                // Environment-specific key configuration
    // See configuration-services-config.md for details
  },
  "_TTL": 86400000,                          // Cache TTL in milliseconds
  "_TIME": 1699999999999                     // Timestamp when loaded
}
```

## Package Object Structure (packObj)

Source: `soajs.core.modules/soajs.core/provision/mongo.js` → `getPackagesFromDb()`

```javascript
{
  "acl": { ... },                            // Environment-specific ACL (resolved)
  "acl_all_env": { ... },                    // Full ACL object for all environments
  "_TTL": 86400000,                          // Cache TTL in milliseconds
  "_TIME": 1699999999999                     // Timestamp when loaded
}
```

## ACL Structure

ACL can be defined in either `keyObj.application.acl` or `packObj.acl`:

```javascript
{
  "serviceName": {
    "version": {
      "access": true,                        // or false, or ["group1", "group2"]
      "apisPermission": "restricted",        // "restricted" means whitelist mode
      "get": {
        "apis": {
          "/api/path": {
            "access": ["owner", "admin"]     // Groups allowed for this API
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

## Network Package Override

The key middleware supports network-based package substitution, allowing different packages to be loaded based on the network identifier configured in the custom registry.

See [Services Config](../configuration-services-config.md) for the full configuration structure.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                 NETWORK PACKAGE OVERRIDE FLOW (Key Middleware)                  │
└─────────────────────────────────────────────────────────────────────────────────┘

  1. Get network from registry
     network = registry.custom.gateway.value.lastSeen.network    (e.g., "mw")

  2. Get product from keyObj
     product = keyObj.application.product                        (e.g., "AVAPP")

  3. Check for network package config
     config = keyObj.config.gateway.networkPackages[network][product]

  4. If config.default exists:
     ├── Original: keyObj.application.package = "AVAPP_EXMPL"
     ├── Override: keyObj.application.package = "AVAPP_DEFAU"
     └── Log: "Network package override: replaced package [AVAPP_EXMPL]
              with [AVAPP_DEFAU] for network [mw] and product [AVAPP]"

  5. Continue to load the (possibly overridden) package
```

## Error Codes

| Code | Description |
|------|-------------|
| 144 | External key is not valid for this environment |
| 148 | External key is invalid or has been disabled |
| 149 | Product package not found |

## Usage Notes

- The key is extracted from the `key` header (case-insensitive)
- If no key is provided, the middleware continues without setting key data
- Key environment validation ensures keys are only used in their designated environment
- Network package override allows different packages per network (requires `lastSeen.network` in custom registry)
- The keyObj and packObj are stored in `req.soajs.controller.serviceParams` for downstream middleware
- Subsequent middleware (keyACL, mt, oauth) depends on this data for ACL and authentication
