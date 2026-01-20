# IP2Ban Middleware

**File:** `mw/ip2ban/index.js`

**Order:** 6

The IP2Ban middleware blocks requests from blacklisted IP addresses.

## Purpose

- Enforces IP blacklist from custom registry
- Returns 403 Forbidden for banned IPs
- Early rejection before any service processing

## Flow

```
  Incoming Request
       │
       ▼
  ┌─────────────────┐
  │  Get ip2ban     │ registry.custom.gateway.value.traffic.ip2ban
  │  List           │
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │  Get Client IP  │ req.getClientIP()
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │  IP in          │ ip2ban.includes(clientIP)?
  │  Blacklist?     │
  └────────┬────────┘
           │
           ├─── Yes ──▶ 403 Forbidden { msg: "banned" }
           │
           ▼
       next()
```

## Configuration

Located in `registry.custom.gateway.value.traffic.ip2ban`:

```javascript
{
  "traffic": {
    "ip2ban": [
      "192.168.1.100",
      "10.0.0.50",
      "::1"
    ]
  }
}
```

## Response

Banned IPs receive:
- HTTP Status: `403`
- Body: `{ "msg": "banned" }`

## Usage Notes

- Runs early in the pipeline (order 6) for quick rejection
- Simple exact-match comparison (no CIDR support at this level)
- Use MT whitelist for CIDR range support
- IPv6 addresses supported (e.g., `::1` for localhost)
