"use strict";

const assert = require('assert');
const request = require('request');
const helper = require("../../helper.js");
let Controller = helper.requireModule('./server/controller');
let localConfig = helper.requireModule('./config.js');

let mock = require('../UC2-http-methods/service-mock/index.js');

//NOTE: the mock service answers GET /mcp/tools on its maintenance port with tools for /myroute;
//		the gateway custom registry has mcp.enabled
describe("Integration for Usecase 8 - MCP endpoint /soajs/mcp", function () {
	let extKey = "3d90163cf9d6b3076ad26aa5ed58556348069258e5c6c941ee0f18448b570ad1c5c790e2d2a1989680c55f4904e2005ff5f8e71606e4aa641e67882f4210ebbc5460ff305dcb36e6ec2a2299cf0448ef60b9e38f41950ec251c1cf41f05f3ce9";
	let ownerToken = "cfb209a91b23896820f510aadbf1f4284b512123";

	let c = new Controller({
		"serviceName": localConfig.serviceName,
		"serviceVersion": localConfig.serviceVersion,
		"serviceGroup": localConfig.serviceGroup,
		"servicePort": localConfig.servicePort,
		"maintenance": localConfig.maintenance
	});
	let registry = null;
	let log = null;
	let service = null;
	let server = null;
	let serverMaintenance = null;
	let httpmethods = null;

	function mcp(body, opts, cb) {
		opts = opts || {};
		let headers = {key: extKey};
		if (opts.token !== false) {
			headers.authorization = "Bearer " + (opts.token || ownerToken);
		}
		request({
			"method": opts.method || "POST",
			"uri": 'http://127.0.0.1:' + localConfig.servicePort + '/soajs/mcp',
			"headers": headers,
			"body": (typeof body === "string") ? body : JSON.stringify(body)
		}, (error, response, text) => {
			assert.ifError(error);
			let json = null;
			try {
				json = text ? JSON.parse(text) : null;
			} catch (e) {
				json = text;
			}
			return cb(response.statusCode, json);
		});
	}

	before((done) => {
		mock.startServer(null, function (servers) {
			httpmethods = servers;
		});
		c.init((_registry, _log, _service, _server, _serverMaintenance) => {
			registry = _registry;
			log = _log;
			service = _service;
			server = _server;
			serverMaintenance = _serverMaintenance;
			c.start(registry, log, service, server, serverMaintenance, () => {
				setTimeout(function () {
					done();
				}, 5000);
			});
		});
	});

	it("initialize", function (done) {
		mcp({jsonrpc: "2.0", id: 1, method: "initialize", params: {protocolVersion: "2025-06-18", capabilities: {}, clientInfo: {name: "test", version: "1"}}}, {}, (status, body) => {
			assert.strictEqual(status, 200);
			assert.strictEqual(body.id, 1);
			assert.strictEqual(body.result.protocolVersion, "2025-06-18");
			assert.deepStrictEqual(body.result.capabilities, {"tools": {"listChanged": false}});
			assert.strictEqual(body.result.serverInfo.name, "soajs-gateway");
			done();
		});
	});

	it("notifications/initialized is accepted", function (done) {
		mcp({jsonrpc: "2.0", method: "notifications/initialized"}, {}, (status, body) => {
			assert.strictEqual(status, 202);
			assert.strictEqual(body, null);
			done();
		});
	});

	it("tools/list has the tools of the services the caller may use", function (done) {
		mcp({jsonrpc: "2.0", id: 2, method: "tools/list"}, {}, (status, body) => {
			assert.strictEqual(status, 200);
			let names = body.result.tools.map((t) => t.name);
			assert.ok(names.indexOf("httpmethods_get_myroute") !== -1, JSON.stringify(names));
			assert.ok(names.indexOf("httpmethods_post_myroute") !== -1);
			assert.ok(names.indexOf("httpmethods_delete_myroute") !== -1);
			let get = body.result.tools.find((t) => t.name === "httpmethods_get_myroute");
			assert.deepStrictEqual(get.inputSchema, {"type": "object", "properties": {"name": {"type": "string"}}, "required": ["name"]});
			assert.strictEqual(get.annotations.readOnlyHint, true);
			done();
		});
	});

	it("tools/call runs the api through the gateway", function (done) {
		mcp({jsonrpc: "2.0", id: 3, method: "tools/call", params: {name: "httpmethods_get_myroute", arguments: {name: "ann"}}}, {}, (status, body) => {
			assert.strictEqual(status, 200);
			assert.strictEqual(body.result.isError, false, JSON.stringify(body));
			assert.strictEqual(body.result.structuredContent.method, "GET");
			assert.strictEqual(body.result.structuredContent.url, "/myroute?name=ann");
			assert.strictEqual(body.result.structuredContent.firstname, "antoine");
			mcp({jsonrpc: "2.0", id: 4, method: "tools/call", params: {name: "httpmethods_post_myroute", arguments: {title: "t"}}}, {}, (status, body) => {
				assert.strictEqual(body.result.isError, false, JSON.stringify(body));
				assert.strictEqual(body.result.structuredContent.method, "POST");
				done();
			});
		});
	});

	it("tools/call of an unknown tool", function (done) {
		mcp({jsonrpc: "2.0", id: 5, method: "tools/call", params: {name: "httpmethods_get_nope", arguments: {}}}, {}, (status, body) => {
			assert.deepStrictEqual(body.error, {"code": -32602, "message": "Unknown tool: httpmethods_get_nope"});
			done();
		});
	});

	it("no signed-in user is refused, like /soajs/acl", function (done) {
		mcp({jsonrpc: "2.0", id: 6, method: "tools/list"}, {token: false}, (status, body) => {
			assert.strictEqual(body.result, false);
			assert.ok(body.errors, JSON.stringify(body));
			done();
		});
	});

	it("GET is not allowed", function (done) {
		mcp("", {method: "GET"}, (status, body) => {
			assert.strictEqual(status, 405);
			assert.strictEqual(body.error.code, -32600);
			done();
		});
	});

	it("a body that is not JSON", function (done) {
		mcp("{nope", {}, (status, body) => {
			assert.strictEqual(status, 400);
			assert.strictEqual(body.error.code, -32700);
			done();
		});
	});

	after((done) => {
		mock.killServer(httpmethods);
		c.stop(registry, log, service, server, serverMaintenance, () => {
			done();
		});
	});
});
