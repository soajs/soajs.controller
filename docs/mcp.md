# MCP Endpoint (`/soajs/mcp`)

AI agents connect to the gateway with the Model Context Protocol (MCP) and see the APIs their
caller may use as tools. A tool call is processed as the API call it stands for, so it gets every
check an API call gets.

## How It Works

```
Agent (MCP client)
   │  POST /soajs/mcp   key + token
   ▼
Gateway
   ├─ key, OAuth and user checks (as for /soajs/acl)
   ├─ tools/list  → the caller's ACL (/soajs/acl logic)
   │                + GET /mcp/tools of each allowed service, cached per service and version
   └─ tools/call  → the API call, sent to the gateway's own port with the caller's credentials:
                    key, OAuth, tenant access resolver, ACL, throttling, idempotency, cache, service
```

### Where the tools come from

Every service answers `GET /mcp/tools` on its maintenance port (the port awareness checks the
heartbeat on: `maintenance`, `inherit` or a custom port):

| Service | Answer |
|---------|--------|
| Built on `soajs` (4.1.24+) | `data.tools`: built from its `config.js` schema |
| Built with an SDK (`soajs.nodejs` 2.0.4+, `soajs.python` 1.0.1+, `soajs.golang` v1.0.5+) | `data.swagger`: its Swagger 2.0 / OpenAPI 3 document, an object or YAML text, converted with `soajs.core.libs` `mcp.fromSwagger` |
| Older, or no answer | no tools |

Tools are cached per service and version for `ttl`; a service that did not answer is asked again
after 30 seconds.

### Which tools a caller sees

The ACL the gateway computes for `/soajs/acl`: the user's ACL and packages, else the tenant
application's, else the package's. For each service, the latest allowed version; a restricted
service shows only the APIs its ACL lists, per method. To give agents a different list from your
apps, give the agent its own application, key and package in the tenant.

A tool call is checked again by the gateway like any API call, so a tool shown by mistake is still
refused.

## Configuration

Off unless enabled, in the `gateway` custom registry (`registry.custom.gateway.value.mcp`):

```json
{
  "mcp": {
    "enabled": true,
    "ttl": 300000,
    "timeout": 10000,
    "maxTools": 300
  }
}
```

| Field | Default | Description |
|-------|---------|-------------|
| `enabled` | — | `true` turns the endpoint on; anything else answers 404/190 |
| `ttl` | `300000` | How long the tools of a service are cached, ms |
| `timeout` | `10000` | Fetching tools and calling a tool, ms |
| `maxTools` | `300` | At most this many tools in a list |

## Protocol

MCP over HTTP: JSON-RPC 2.0, `POST /soajs/mcp`, one JSON answer per request, no session and no
streaming. `GET` answers 405.

| Method | Answer |
|--------|--------|
| `initialize` | `protocolVersion` (the client's when supported: `2025-06-18`, `2025-03-26`, `2024-11-05`, else `2025-06-18`), `capabilities.tools`, `serverInfo` |
| `notifications/*` (no `id`) | HTTP 202, no body |
| `ping` | `{}` |
| `tools/list` | `{tools}` |
| `tools/call` | `{content, structuredContent, isError}` |

### Tools

| Field | Value |
|-------|-------|
| `name` | `<service>_<operationId>`, or `<service>_<method>_<path>`; `[A-Za-z0-9_-]`, 64 characters at most, unique |
| `title` | The API label |
| `description` | The label and `[service: METHOD /path]` |
| `inputSchema` | JSON Schema of the inputs: path, query and body fields in one object |
| `annotations` | `readOnlyHint` for GET, `destructiveHint` for DELETE |

### Tool calls

The arguments are split back into the path, the query string and the body, and the call goes to
`http://127.0.0.1:<gateway port>/<service>/v<version><path>` with the caller's `key`,
`authorization` / `access_token`, `device-id`, `user-agent`, `accept-language` and
`idempotency-key` headers and `x-forwarded-for`.

- **Success:** `content` has the response `data` as JSON text, `structuredContent` the same when it
  is an object.
- **Error** (HTTP 4xx/5xx or `result: false`): `isError: true`, `content` has the `errors`.

### Errors

| Case | Answer |
|------|--------|
| MCP not enabled | HTTP 404, SOAJS error 190 |
| No `key` header | SOAJS error 132 |
| No signed-in user | as `/soajs/acl` |
| Not POST | HTTP 405, JSON-RPC -32600 |
| Body not JSON | HTTP 400, JSON-RPC -32700 |
| Batch, invalid request | HTTP 400, JSON-RPC -32600 |
| Body over 1 MB | HTTP 413 |
| Unknown method | JSON-RPC -32601 |
| Unknown tool, no tool name | JSON-RPC -32602 |

## Client Setup

```json
{
  "mcpServers": {
    "soajs": {
      "url": "https://api.example.com/soajs/mcp",
      "headers": {
        "key": "<tenant external key>",
        "Authorization": "Bearer <access token>"
      }
    }
  }
}
```

The key can also be sent in the query string (`/soajs/mcp?key=...`) for clients that only take a
URL.

## Files

| File | Role |
|------|------|
| `mw/soajsRoutes/mcp/index.js` | The route: JSON-RPC handling |
| `mw/soajsRoutes/mcp/tools.js` | Tools: fetch, cache, ACL filter, naming, the call |
| `mw/soajsRoutes/lib/acl.js` | The ACL computation shared with `/soajs/acl` |
