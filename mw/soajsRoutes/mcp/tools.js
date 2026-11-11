'use strict';

/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

/**
 * The tools of /soajs/mcp: the APIs the caller may use, described by each service on its
 * GET /mcp/tools, and the call of one tool as an API call through the gateway.
 *
 * A soajs service answers with its tools (built from its config.js schema); a service built with
 * one of the SDKs answers with its Swagger / OpenAPI document (an object, or YAML text), converted
 * here with soajs.core.libs mcp.fromSwagger. Both are cached per service and version.
 */

const http = require("http");
const crypto = require("crypto");
const yaml = require("js-yaml");
const coreLibs = require("soajs.core.libs");

const aclLib = require("../lib/acl.js");
const idempotency = require("../../idempotency/index.js");

const get = (p, o) => p.reduce((xs, x) => (xs && xs[x]) ? xs[x] : null, o);

const DEFAULTS = {
	"ttl": 300000, // service tools cache, ms
	"errorTtl": 30000, // a service that did not answer is asked again after, ms
	"timeout": 10000, // fetching tools and calling a tool, ms
	"maxTools": 300
};
const MAX_RESPONSE = 5 * 1024 * 1024;
const NAME_MAX = 64;

// service@version -> {expires, tools}
let cache = {};

//NOTE: no idempotency-key, a header on the mcp request is the same for every tool call of the
//		connection, the api would replay the first answer to every later call. A tool call carries
//		its own key, see IDEMPOTENCY_ARG.
const HEADERS_TO_FORWARD = ['key', 'authorization', 'access_token', 'device-id', 'user-agent', 'accept-language'];

// the argument a tool call gives its idempotency key in, on the tools whose api has idempotency on
const IDEMPOTENCY_ARG = "_idempotencyKey";

/**
 * The mcp configuration: registry.custom.gateway.value.mcp
 * {enabled, ttl, timeout, maxTools}
 */
function getConfig(req) {
	let config = get(["soajs", "registry", "custom", "gateway", "value", "mcp"], req);
	if (!config || config.enabled !== true) {
		return null;
	}
	let out = {"enabled": true};
	for (let k in DEFAULTS) {
		if (DEFAULTS.hasOwnProperty(k)) {
			out[k] = (typeof config[k] === "number" && config[k] > 0) ? config[k] : DEFAULTS[k];
		}
	}
	return out;
}

/**
 * GET or POST over http, resolving with {status, body}: unlike httpRequestLight, an error status
 * keeps its body, a tool call returns the api's error to the agent.
 */
function request({uri, method = "GET", headers = {}, body = null, timeout}) {
	return new Promise((resolve, reject) => {
		let url = new URL(uri);
		let payload = (body === null || body === undefined) ? null : JSON.stringify(body);
		let reqHeaders = Object.assign({"accept": "application/json"}, headers);
		if (payload !== null) {
			reqHeaders["content-type"] = "application/json";
			reqHeaders["content-length"] = Buffer.byteLength(payload);
		}
		let done = false;
		let finish = (err, value) => {
			if (done) {
				return;
			}
			done = true;
			if (err) {
				return reject(err);
			}
			return resolve(value);
		};
		let r = http.request({
			"hostname": url.hostname,
			"port": url.port,
			"path": url.pathname + url.search,
			"method": method,
			"headers": reqHeaders
		}, (res) => {
			let chunks = [];
			let size = 0;
			res.on("data", (chunk) => {
				size += chunk.length;
				if (size > MAX_RESPONSE) {
					res.destroy();
					return finish(new Error("Response larger than " + MAX_RESPONSE + " bytes"));
				}
				chunks.push(chunk);
			});
			res.on("end", () => {
				let text = Buffer.concat(chunks).toString("utf8");
				let json = null;
				try {
					json = text ? JSON.parse(text) : null;
				} catch (e) {
					json = null;
				}
				return finish(null, {"status": res.statusCode, "text": text, "json": json});
			});
			res.on("error", (err) => finish(err));
		});
		r.on("error", (err) => finish(err));
		r.setTimeout(timeout, () => {
			r.destroy();
			finish(new Error("Request timed out"));
		});
		if (payload !== null) {
			r.write(payload);
		}
		r.end();
	});
}

/**
 * The port a service answers its maintenance routes on, the way awareness checks its heartbeat.
 */
function maintenancePort(registry, serviceName) {
	let service = registry.services[serviceName];
	let inc = get(["serviceConfig", "ports", "maintenanceInc"], registry) || 1000;
	let type = get(["maintenance", "port", "type"], service);
	if (type === "inherit") {
		return service.port;
	}
	if (type && type !== "maintenance") {
		let value = parseInt(get(["maintenance", "port", "value"], service));
		if (!isNaN(value)) {
			return value;
		}
	}
	return service.port + inc;
}

/**
 * The tools a service describes, from its answer to GET /mcp/tools.
 */
function toolsFromAnswer(answer) {
	let data = (answer && answer.result === true) ? answer.data : null;
	if (!data || typeof data !== "object") {
		return [];
	}
	if (Array.isArray(data.tools)) {
		return data.tools;
	}
	let doc = data.swagger;
	if (typeof doc === "string") {
		doc = yaml.load(doc);
	}
	if (doc && typeof doc === "object") {
		return coreLibs.mcp.fromSwagger(doc);
	}
	return [];
}

/**
 * The tools of one service at one version, cached.
 */
function serviceTools(req, serviceName, version, config) {
	let key = serviceName + "@" + version;
	let now = Date.now();
	if (cache[key] && cache[key].expires > now) {
		return Promise.resolve(cache[key].tools);
	}
	let registry = req.soajs.registry;
	let service = get(["services", serviceName], registry);
	if (!service || !service.port) {
		return Promise.resolve([]);
	}
	return new Promise((resolve) => {
		req.soajs.awareness.getHost(serviceName, version, (host) => {
			if (!host) {
				req.soajs.log.error("MCP: no host for [" + serviceName + "@" + version + "]");
				cache[key] = {"expires": now + config.errorTtl, "tools": []};
				return resolve([]);
			}
			request({
				"uri": "http://" + host + ":" + maintenancePort(registry, serviceName) + "/mcp/tools",
				"timeout": config.timeout
			}).then((response) => {
				let tools = [];
				try {
					tools = (response.status === 200) ? toolsFromAnswer(response.json) : [];
				} catch (e) {
					req.soajs.log.error("MCP: the tools of [" + serviceName + "@" + version + "] could not be read: " + e.message);
				}
				tools = tools.filter((tool) => tool && typeof tool.m === "string" && typeof tool.v === "string");
				cache[key] = {"expires": Date.now() + config.ttl, "tools": tools};
				return resolve(tools);
			}).catch((err) => {
				req.soajs.log.error("MCP: could not get the tools of [" + serviceName + "@" + version + "]: " + err.message);
				cache[key] = {"expires": Date.now() + config.errorTtl, "tools": []};
				return resolve([]);
			});
		});
	});
}

/**
 * A tool name agents and model APIs accept: [A-Za-z0-9_-], at most 64 characters, unique.
 */
function toolName(serviceName, tool, taken) {
	let base = serviceName + "_" + (tool.operationId || (tool.m + tool.v));
	base = base.replace(/[^A-Za-z0-9_-]+/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
	base = base.substring(0, NAME_MAX);
	let name = base;
	let n = 2;
	while (taken[name]) {
		let suffix = "_" + n;
		name = base.substring(0, NAME_MAX - suffix.length) + suffix;
		n++;
	}
	taken[name] = true;
	return name;
}

/**
 * Whether the caller's ACL allows the api: a restricted service allows only the apis it lists per
 * method, none when it lists none.
 */
function allowed(serviceACL, tool, restricted) {
	if (!restricted) {
		return true;
	}
	let list = serviceACL[tool.m] || (tool.m === "delete" ? serviceACL.del : null);
	return Array.isArray(list) && list.indexOf(tool.v) !== -1;
}

/**
 * Whether the gateway applies idempotency to the api of a tool, as mw/idempotency decides it for
 * the api call: registry.custom.gateway.value.idempotency, by service and api. A get never.
 */
function idempotent(req, serviceName, tool) {
	if (tool.m === "get") {
		return false;
	}
	let services = get(["soajs", "registry", "custom", "gateway", "value", "idempotency", "services"], req);
	let serviceConfig = services ? services[serviceName] : null;
	if (!serviceConfig || !serviceConfig.enabled) {
		return false;
	}
	if (serviceConfig.apis && !idempotency.matchesApi(tool.m.toUpperCase(), tool.v, serviceConfig.apis)) {
		return false;
	}
	return true;
}

/**
 * Whether a tool call can carry its idempotency key in IDEMPOTENCY_ARG: not a get, and not an
 * api with a field of that name.
 */
function takesIdempotencyArg(tool) {
	return tool.m !== "get" && !Object.hasOwnProperty.call(tool.fields || {}, IDEMPOTENCY_ARG);
}

/**
 * The tools the caller may use.
 *
 * @returns Promise<{tools: Array, index: object}> tools in the MCP format, index by name of
 *          {service, version, tool} to make the call
 */
function listTools(req, configuration, config) {
	let computed = aclLib.computeACL(req);
	let finalACL = computed.finalACL || {};
	let services = Object.keys(finalACL).filter((s) => s !== configuration.serviceName).sort();
	return Promise.all(services.map((s) => serviceTools(req, s, finalACL[s].version, config)))
		.then((lists) => {
			let tools = [];
			let index = {};
			let taken = {};
			services.forEach((serviceName, i) => {
				lists[i].forEach((tool) => {
					if (tools.length >= config.maxTools || !allowed(finalACL[serviceName], tool, computed.restricted[serviceName])) {
						return;
					}
					let name = toolName(serviceName, tool, taken);
					let description = tool.l || (tool.m.toUpperCase() + " " + tool.v);
					let inputSchema = (tool.inputSchema && tool.inputSchema.type === "object") ? tool.inputSchema : {"type": "object", "properties": {}};
					if (takesIdempotencyArg(tool) && idempotent(req, serviceName, tool)) {
						//NOTE: copies, the tool is shared through the cache
						let properties = Object.assign({}, inputSchema.properties || {});
						properties[IDEMPOTENCY_ARG] = {
							"type": "string",
							"format": "uuid",
							"description": "Optional UUID v4. Send the same value when retrying this exact call, so it runs once."
						};
						inputSchema = Object.assign({}, inputSchema, {"properties": properties});
					}
					tools.push({
						"name": name,
						"title": description,
						"description": description + " [" + serviceName + ": " + tool.m.toUpperCase() + " " + tool.v + "]",
						"inputSchema": inputSchema,
						"annotations": {
							"readOnlyHint": tool.m === "get",
							"destructiveHint": tool.m === "delete",
							"openWorldHint": false
						}
					});
					index[name] = {"service": serviceName, "version": finalACL[serviceName].version, "tool": tool};
				});
			});
			return {"tools": tools, "index": index};
		});
}

let setPath = (obj, path, value) => {
	let node = obj;
	for (let i = 0; i < path.length - 1; i++) {
		if (!node[path[i]] || typeof node[path[i]] !== "object") {
			node[path[i]] = {};
		}
		node = node[path[i]];
	}
	node[path[path.length - 1]] = value;
};

/**
 * The api call a tool call stands for: path with its params, query string and body.
 *
 * @returns {{path: string, query: string, body: *}|{error: string}}
 */
function buildCall(tool, args) {
	args = (args && typeof args === "object" && !Array.isArray(args)) ? args : {};
	let fields = tool.fields || {};
	let params = {};
	let query = new URLSearchParams();
	let body;
	Object.keys(fields).forEach((name) => {
		if (!Object.hasOwnProperty.call(args, name) || args[name] === undefined) {
			return;
		}
		let where = fields[name] || {};
		let path = Array.isArray(where.path) ? where.path : [name];
		let value = args[name];
		if (where.in === "params") {
			params[path[0] || name] = value;
		} else if (where.in === "query") {
			let key = path.join(".") || name;
			if (Array.isArray(value)) {
				value.forEach((v) => query.append(key, (typeof v === "object") ? JSON.stringify(v) : String(v)));
			} else {
				query.append(key, (typeof value === "object" && value !== null) ? JSON.stringify(value) : String(value));
			}
		} else if (where.in === "body") {
			if (path.length === 0) {
				body = value;
			} else {
				if (!body || typeof body !== "object" || Array.isArray(body)) {
					body = {};
				}
				setPath(body, path, value);
			}
		}
	});
	let missing = null;
	let fill = (segment) => segment.replace(/[:*]([A-Za-z0-9_]+)/g, (all, name) => {
		if (!Object.hasOwnProperty.call(params, name) || params[name] === null) {
			missing = missing || name;
			return all;
		}
		return encodeURIComponent(String(params[name]));
	});
	// optional segments: "/file{/:name}" is kept only when its params are given
	let path = tool.v.replace(/\{([^}]*)\}/g, (all, inner) => {
		let names = (inner.match(/[:*]([A-Za-z0-9_]+)/g) || []).map((n) => n.substring(1));
		if (names.every((n) => Object.hasOwnProperty.call(params, n) && params[n] !== null)) {
			return fill(inner);
		}
		return "";
	});
	path = fill(path);
	if (missing) {
		return {"error": "Missing path parameter: " + missing};
	}
	let qs = query.toString();
	return {"path": path, "query": qs ? "?" + qs : "", "body": body};
}

/**
 * Calls the api of a tool through the gateway's own port, so the call goes through every check an
 * api call goes through (key, oauth, ACL, throttling, idempotency, cache), with the caller's
 * credentials.
 *
 * @returns Promise<object> the MCP tool result
 */
function callTool(req, configuration, config, entry, args) {
	let call = buildCall(entry.tool, args);
	if (call.error) {
		return Promise.resolve({
			"content": [{"type": "text", "text": call.error}],
			"isError": true
		});
	}
	let port = get(["soajs", "registry", "services", configuration.serviceName, "port"], req);
	let headers = {};
	HEADERS_TO_FORWARD.forEach((h) => {
		if (req.headers[h]) {
			headers[h] = req.headers[h];
		}
	});
	if (takesIdempotencyArg(entry.tool)) {
		//NOTE: a write without a key gets a new one: an api that requires a key works, and two
		//		calls are never taken for one. Only a key the agent sends again makes a retry run once.
		let given = (args && typeof args === "object" && !Array.isArray(args)) ? args[IDEMPOTENCY_ARG] : undefined;
		if (given !== undefined && given !== null && given !== "") {
			if (typeof given !== "string" || !idempotency.isValidUUIDv4(given)) {
				return Promise.resolve({
					"content": [{"type": "text", "text": IDEMPOTENCY_ARG + " must be a UUID v4."}],
					"isError": true
				});
			}
			headers["idempotency-key"] = given;
		} else {
			headers["idempotency-key"] = crypto.randomUUID();
		}
	}
	if (!headers.access_token && req.query && req.query.access_token) {
		headers.access_token = req.query.access_token;
	}
	//NOTE: the token goes as access_token, never as Authorization: a service that falls back to the
	//		gateway for an interConnect peer passes access_token on, not a lowercase authorization
	//		header, and oauth refuses a call that carries both
	if (!headers.access_token && headers.authorization) {
		let matches = headers.authorization.match(/^Bearer\s+(\S+)/i);
		if (matches) {
			headers.access_token = matches[1];
		}
	}
	if (headers.access_token) {
		delete headers.authorization;
	}
	let clientIP = req.getClientIP ? req.getClientIP() : null;
	let forwarded = req.headers["x-forwarded-for"];
	if (clientIP) {
		headers["x-forwarded-for"] = forwarded ? forwarded : clientIP;
	}
	let uri = "http://127.0.0.1:" + port + "/" + entry.service + "/v" + entry.version + call.path + call.query;
	return request({
		"uri": uri,
		"method": entry.tool.m.toUpperCase(),
		"headers": headers,
		"body": (entry.tool.m === "get") ? null : (call.body === undefined ? null : call.body),
		"timeout": config.timeout
	}).then((response) => {
		let json = response.json;
		let isError = response.status >= 400 || (json && json.result === false);
		let payload = json;
		if (json && !isError && Object.hasOwnProperty.call(json, "data")) {
			payload = json.data;
		} else if (json && isError && json.errors) {
			payload = json.errors;
		}
		let result = {
			"content": [{
				"type": "text",
				"text": (payload === null || payload === undefined) ? response.text : JSON.stringify(payload)
			}],
			"isError": !!isError
		};
		if (!isError && payload && typeof payload === "object" && !Array.isArray(payload)) {
			result.structuredContent = payload;
		}
		return result;
	}).catch((err) => {
		req.soajs.log.error("MCP: call of [" + entry.service + "@" + entry.version + " " + entry.tool.m + " " + entry.tool.v + "] failed: " + err.message);
		return {
			"content": [{"type": "text", "text": "The call failed: " + err.message}],
			"isError": true
		};
	});
}

function clearCache() {
	cache = {};
}

module.exports = {
	getConfig,
	request,
	maintenancePort,
	toolsFromAnswer,
	serviceTools,
	toolName,
	allowed,
	idempotent,
	takesIdempotencyArg,
	listTools,
	buildCall,
	callTool,
	clearCache
};
