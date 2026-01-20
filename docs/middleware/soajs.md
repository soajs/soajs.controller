# SOAJS Middleware

**File:** `mw/soajs/index.js`

**Order:** 1

The SOAJS middleware is the first middleware in the pipeline. It initializes the `req.soajs` context object that all subsequent middleware depend on.

## Purpose

- Creates the `req.soajs` namespace
- Attaches the logger instance
- Attaches the current registry reference
- Attaches core utility modules (meta, validator)

## Flow

```
  Incoming Request
       │
       ▼
  ┌─────────────────┐
  │  Create         │ if (!req.soajs) req.soajs = {}
  │  req.soajs      │
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │  Attach Logger  │ req.soajs.log = log
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │  Attach         │ req.soajs.registry = registryModule.get()
  │  Registry       │
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │  Attach Core    │ req.soajs.meta = core.meta
  │  Modules        │ req.soajs.validator = core.validator
  └────────┬────────┘
           │
           ▼
       next()
```

## Configuration

```javascript
{
  "log": logger,        // Logger instance
  "core": coreModule    // soajs.core.libs module
}
```

## Properties Set

| Property | Type | Description |
|----------|------|-------------|
| `req.soajs.log` | object | Logger instance for request-scoped logging |
| `req.soajs.registry` | object | Current environment registry |
| `req.soajs.meta` | object | Metadata utilities from core |
| `req.soajs.validator` | object | JSON schema validator |

## Usage Notes

- This middleware MUST be first in the pipeline
- All other middleware assume `req.soajs` exists
- The registry is fetched fresh on each request (reference, not copy)
- Logger supports: `debug()`, `info()`, `warn()`, `error()`, `fatal()`
