'use strict';

/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

/**
 * POST /soajs/mcp: MCP over HTTP (JSON-RPC 2.0, one JSON answer per request, no session).
 * An agent lists the APIs its caller may use as tools and calls them; a tool call is processed
 * as the API call it stands for. On only when registry.custom.gateway.value.mcp.enabled is true.
 */

const aclLib = require("../lib/acl.js");
const tools = require("./tools.js");

const MAX_BODY = 1024 * 1024;
const PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];

const ERROR = {
	"parse": -32700,
	"invalidRequest": -32600,
	"methodNotFound": -32601,
	"invalidParams": -32602,
	"internal": -32603
};

let gatewayVersion = "0";
try {
	gatewayVersion = require("../../../package.json").version;
} catch (e) {
	gatewayVersion = "0";
}

function send(res, status, body, headers) {
	let text = (body === null || body === undefined) ? "" : JSON.stringify(body);
	let h = Object.assign({}, headers || {});
	if (text) {
		h["Content-Type"] = "application/json";
	}
	h["Content-Length"] = Buffer.byteLength(text);
	res.writeHead(status, h);
	res.end(text);
}

function rpcError(id, code, message) {
	return {"jsonrpc": "2.0", "id": (id === undefined ? null : id), "error": {"code": code, "message": message}};
}

function rpcResult(id, result) {
	return {"jsonrpc": "2.0", "id": id, "result": result};
}

function readBody(req) {
	return new Promise((resolve, reject) => {
		let chunks = [];
		let size = 0;
		let done = false;
		req.on("data", (chunk) => {
			if (done) {
				return;
			}
			size += chunk.length;
			if (size > MAX_BODY) {
				done = true;
				return reject(new Error("too large"));
			}
			chunks.push(chunk);
		});
		req.on("end", () => {
			if (!done) {
				done = true;
				resolve(Buffer.concat(chunks).toString("utf8"));
			}
		});
		req.on("error", (err) => {
			if (!done) {
				done = true;
				reject(err);
			}
		});
	});
}

module.exports = (configuration) => {
	let core = configuration.core;

	let handle = (req, res, config, message) => {
		let id = message.id;
		let params = (message.params && typeof message.params === "object") ? message.params : {};
		switch (message.method) {
			case "initialize": {
				let requested = params.protocolVersion;
				return Promise.resolve(rpcResult(id, {
					"protocolVersion": (PROTOCOL_VERSIONS.indexOf(requested) !== -1) ? requested : PROTOCOL_VERSIONS[0],
					"capabilities": {"tools": {"listChanged": false}},
					"serverInfo": {"name": "soajs-gateway", "version": gatewayVersion},
					"instructions": "The tools are the APIs this tenant's package and the signed-in user's ACL allow. A tool call is processed as the API call it stands for."
				}));
			}
			case "ping":
				return Promise.resolve(rpcResult(id, {}));
			case "tools/list":
				return tools.listTools(req, configuration, config).then((list) => rpcResult(id, {"tools": list.tools}));
			case "tools/call": {
				if (typeof params.name !== "string") {
					return Promise.resolve(rpcError(id, ERROR.invalidParams, "params.name is required"));
				}
				return tools.listTools(req, configuration, config).then((list) => {
					let entry = list.index[params.name];
					if (!entry) {
						return rpcError(id, ERROR.invalidParams, "Unknown tool: " + params.name);
					}
					return tools.callTool(req, configuration, config, entry, params.arguments)
						.then((result) => rpcResult(id, result));
				});
			}
			default:
				return Promise.resolve(rpcError(id, ERROR.methodNotFound, "Method not found: " + message.method));
		}
	};

	let return_SOAJS_mcp = (req, res) => {
		let config = tools.getConfig(req);
		if (!config) {
			return req.soajs.controllerResponse({
				"status": 404,
				"code": 190,
				"msg": "MCP is not enabled in this environment."
			});
		}
		if (req.method !== "POST") {
			return send(res, 405, rpcError(null, ERROR.invalidRequest, "Use POST"), {"Allow": "POST"});
		}
		readBody(req).then((text) => {
			let message;
			try {
				message = JSON.parse(text);
			} catch (e) {
				return send(res, 400, rpcError(null, ERROR.parse, "Parse error"));
			}
			if (Array.isArray(message)) {
				return send(res, 400, rpcError(null, ERROR.invalidRequest, "Batches are not supported"));
			}
			if (!message || typeof message !== "object" || message.jsonrpc !== "2.0" || typeof message.method !== "string") {
				return send(res, 400, rpcError(message && message.id, ERROR.invalidRequest, "Invalid request"));
			}
			// a notification, or a response from the client: nothing to answer
			if (!Object.hasOwnProperty.call(message, "id")) {
				return send(res, 202, null);
			}
			return handle(req, res, config, message)
				.then((answer) => send(res, 200, answer))
				.catch((err) => {
					req.soajs.log.error("MCP: " + message.method + " failed: " + err.message);
					return send(res, 200, rpcError(message.id, ERROR.internal, "Internal error"));
				});
		}).catch(() => {
			return send(res, 413, rpcError(null, ERROR.invalidRequest, "Request larger than " + MAX_BODY + " bytes"));
		});
	};

	return (req, res, next) => {
		//doesn't work without a key in the headers
		if (!req.headers || !req.headers.key) {
			return req.soajs.controllerResponse(core.error.getError(132));
		}

		//mimic an api of the gateway, so mt runs the key, oauth and urac checks
		aclLib.mimicGatewayApi(req, configuration, {
			"l": "MCP",
			"v": "/soajs/mcp",
			"m": "post"
		});

		req.soajs.controller.gotoservice = return_SOAJS_mcp;
		return next();
	};
};
