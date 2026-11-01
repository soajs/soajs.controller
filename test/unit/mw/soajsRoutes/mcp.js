"use strict";

const helper = require("../../../helper.js");
const tools = helper.requireModule('./mw/soajsRoutes/mcp/tools');
const mcp = helper.requireModule('./mw/soajsRoutes/mcp/index');
const aclLib = helper.requireModule('./mw/soajsRoutes/lib/acl');
const assert = require('assert');
const http = require('http');
const {Readable} = require('stream');

const config = {"enabled": true, "ttl": 300000, "errorTtl": 30000, "timeout": 2000, "maxTools": 300};
const configuration = {
	core: {
		error: {
			getError: (code) => {
				return {code: code};
			}
		}
	},
	serviceName: "controller",
	serviceVersion: "1"
};

let log = {
	"errors": [],
	debug: () => {
	},
	error: (msg) => {
		log.errors.push(msg);
	}
};

/**
 * A request as the gateway sees it after mt: a key, a user ACL, the registry.
 */
let makeReq = (opts) => {
	opts = opts || {};
	let req = new Readable({
		read() {
		}
	});
	if (opts.body !== undefined) {
		req.push(opts.body);
	}
	req.push(null);
	req.method = opts.method || "POST";
	req.headers = Object.assign({key: "extKey"}, opts.headers || {});
	req.query = opts.query || {};
	req.getClientIP = () => "10.0.0.5";
	req.soajs = {
		log: log,
		registry: {
			serviceConfig: {ports: {maintenanceInc: 1000}},
			services: Object.assign({controller: {port: opts.gatewayPort || 4000}}, opts.services || {}),
			custom: {gateway: {value: {mcp: (opts.mcp === undefined) ? {enabled: true, timeout: 2000} : opts.mcp}}}
		},
		awareness: {
			getHost: function () {
				let cb = arguments[arguments.length - 1];
				return cb(opts.host === undefined ? "127.0.0.1" : opts.host);
			}
		},
		controller: {
			serviceParams: {
				keyObj: {application: {package: "PCK"}},
				packObj: {}
			}
		},
		controllerResponse: (response) => {
			req.controllerResponse = response;
			if (opts.onControllerResponse) {
				opts.onControllerResponse(response);
			}
		}
	};
	if (opts.acl) {
		req.soajs.uracDriver = {
			getAcl: () => opts.acl,
			getAllowedPackages: () => ["PCK"]
		};
	}
	return req;
};

let makeRes = (cb) => {
	let res = {
		writeHead: (status, headers) => {
			res.status = status;
			res.headers = headers;
		},
		end: (text) => {
			cb(res.status, res.headers, text ? JSON.parse(text) : null);
		}
	};
	return res;
};

/**
 * A local server: handler(req, body, res).
 */
let serve = (handler, cb) => {
	let server = http.createServer((req, res) => {
		let chunks = [];
		req.on("data", (c) => chunks.push(c));
		req.on("end", () => handler(req, Buffer.concat(chunks).toString(), res));
	});
	server.listen(0, "127.0.0.1", () => cb(server, server.address().port));
};

let json = (res, status, body) => {
	res.writeHead(status, {"Content-Type": "application/json"});
	res.end(JSON.stringify(body));
};

const coreTools = [
	{
		"m": "get", "v": "/users", "l": "List users", "group": "Admin",
		"inputSchema": {"type": "object", "properties": {"limit": {"type": "integer"}}},
		"fields": {"limit": {"in": "query", "path": ["limit"]}}
	},
	{
		"m": "post", "v": "/user/:id", "l": "Update user",
		"inputSchema": {"type": "object", "properties": {"id": {"type": "string"}, "name": {"type": "string"}}, "required": ["id"]},
		"fields": {"id": {"in": "params", "path": ["id"]}, "name": {"in": "body", "path": ["profile", "name"]}}
	},
	{
		"m": "delete", "v": "/user/:id", "l": "Delete user",
		"inputSchema": {"type": "object", "properties": {"id": {"type": "string"}}, "required": ["id"]},
		"fields": {"id": {"in": "params", "path": ["id"]}}
	}
];

describe("Unit test for: mw - soajsRoutes mcp", () => {

	beforeEach(() => {
		tools.clearCache();
		log.errors = [];
	});

	describe("getConfig", () => {
		it("off unless enabled is true", () => {
			assert.strictEqual(tools.getConfig(makeReq({mcp: null})), null);
			assert.strictEqual(tools.getConfig(makeReq({mcp: {enabled: "true"}})), null);
		});
		it("defaults and overrides", () => {
			assert.deepStrictEqual(tools.getConfig(makeReq({mcp: {enabled: true}})), {
				"enabled": true, "ttl": 300000, "errorTtl": 30000, "timeout": 10000, "maxTools": 300
			});
			let c = tools.getConfig(makeReq({mcp: {enabled: true, ttl: 1000, timeout: -1, maxTools: "5"}}));
			assert.strictEqual(c.ttl, 1000);
			assert.strictEqual(c.timeout, 10000);
			assert.strictEqual(c.maxTools, 300);
		});
	});

	describe("maintenancePort", () => {
		let registry = {
			serviceConfig: {ports: {maintenanceInc: 1000}},
			services: {
				core: {port: 4001},
				inherit: {port: 4002, maintenance: {port: {type: "inherit"}}},
				maint: {port: 4003, maintenance: {port: {type: "maintenance"}}},
				custom: {port: 4004, maintenance: {port: {type: "custom", value: "6000"}}},
				bad: {port: 4005, maintenance: {port: {type: "custom", value: "x"}}}
			}
		};
		it("the way awareness finds the heartbeat", () => {
			assert.strictEqual(tools.maintenancePort(registry, "core"), 5001);
			assert.strictEqual(tools.maintenancePort(registry, "inherit"), 4002);
			assert.strictEqual(tools.maintenancePort(registry, "maint"), 5003);
			assert.strictEqual(tools.maintenancePort(registry, "custom"), 6000);
			assert.strictEqual(tools.maintenancePort(registry, "bad"), 5005);
		});
	});

	describe("toolsFromAnswer", () => {
		let swagger = {
			"openapi": "3.0.0",
			"paths": {"/hello": {"get": {"summary": "Hello", "parameters": [{"name": "who", "in": "query", "schema": {"type": "string"}}]}}}
		};
		it("tools of a soajs service", () => {
			assert.deepStrictEqual(tools.toolsFromAnswer({result: true, data: {tools: coreTools}}), coreTools);
		});
		it("a swagger object or YAML text of an SDK service", () => {
			let fromObject = tools.toolsFromAnswer({result: true, data: {swagger: swagger}});
			assert.strictEqual(fromObject.length, 1);
			assert.strictEqual(fromObject[0].v, "/hello");
			assert.deepStrictEqual(fromObject[0].fields, {"who": {"in": "query", "path": ["who"]}});
			let yamlText = "swagger: '2.0'\npaths:\n  /hi/{name}:\n    get:\n      summary: Hi\n";
			let fromYaml = tools.toolsFromAnswer({result: true, data: {swagger: yamlText}});
			assert.strictEqual(fromYaml[0].v, "/hi/:name");
		});
		it("nothing usable", () => {
			assert.deepStrictEqual(tools.toolsFromAnswer(null), []);
			assert.deepStrictEqual(tools.toolsFromAnswer({result: false}), []);
			assert.deepStrictEqual(tools.toolsFromAnswer({result: true}), []);
			assert.deepStrictEqual(tools.toolsFromAnswer({result: true, data: {tools: []}}), []);
			assert.deepStrictEqual(tools.toolsFromAnswer({result: true, data: {}}), []);
		});
	});

	describe("toolName", () => {
		it("allowed characters, operationId, unique, 64 characters", () => {
			let taken = {};
			assert.strictEqual(tools.toolName("urac", {m: "get", v: "/admin/users"}, taken), "urac_get_admin_users");
			assert.strictEqual(tools.toolName("urac", {m: "get", v: "/admin/users"}, taken), "urac_get_admin_users_2");
			assert.strictEqual(tools.toolName("urac", {m: "post", v: "/user/:id/{x}"}, taken), "urac_post_user_id_x");
			assert.strictEqual(tools.toolName("pets", {m: "get", v: "/pets", operationId: "listPets"}, taken), "pets_listPets");
			let long = tools.toolName("s", {m: "get", v: "/" + "a".repeat(100)}, taken);
			assert.strictEqual(long.length, 64);
			let long2 = tools.toolName("s", {m: "get", v: "/" + "a".repeat(100)}, taken);
			assert.strictEqual(long2.length, 64);
			assert.ok(long2.endsWith("_2"));
		});
	});

	describe("allowed", () => {
		it("a service that is not restricted allows all its apis", () => {
			assert.ok(tools.allowed({version: "1"}, {m: "delete", v: "/x"}));
		});
		it("a restricted service allows the apis it lists", () => {
			let acl = {version: "1", get: ["/users"], del: ["/user/:id"]};
			assert.ok(tools.allowed(acl, {m: "get", v: "/users"}));
			assert.ok(!tools.allowed(acl, {m: "get", v: "/user/:id"}));
			assert.ok(tools.allowed(acl, {m: "delete", v: "/user/:id"}));
			assert.ok(!tools.allowed(acl, {m: "post", v: "/users"}));
		});
	});

	describe("buildCall", () => {
		it("path params, query and nested body", () => {
			let call = tools.buildCall(coreTools[1], {id: "a b/c", name: "Ann", other: 1});
			assert.deepStrictEqual(call, {"path": "/user/a%20b%2Fc", "query": "", "body": {"profile": {"name": "Ann"}}});
			call = tools.buildCall(coreTools[0], {limit: 5});
			assert.deepStrictEqual(call, {"path": "/users", "query": "?limit=5", "body": undefined});
		});
		it("arrays and objects in the query, whole body", () => {
			let tool = {
				m: "post", v: "/x",
				fields: {tags: {in: "query", path: ["tags"]}, filter: {in: "query", path: ["filter"]}, items: {in: "body", path: []}}
			};
			let call = tools.buildCall(tool, {tags: ["a", "b"], filter: {a: 1}, items: [1, 2]});
			assert.strictEqual(call.query, "?tags=a&tags=b&filter=%7B%22a%22%3A1%7D");
			assert.deepStrictEqual(call.body, [1, 2]);
		});
		it("optional segments and a missing path param", () => {
			let tool = {m: "get", v: "/file/:folder{/:name}", fields: {folder: {in: "params", path: ["folder"]}, name: {in: "params", path: ["name"]}}};
			assert.strictEqual(tools.buildCall(tool, {folder: "f"}).path, "/file/f");
			assert.strictEqual(tools.buildCall(tool, {folder: "f", name: "n"}).path, "/file/f/n");
			assert.deepStrictEqual(tools.buildCall(tool, {name: "n"}), {"error": "Missing path parameter: folder"});
			assert.deepStrictEqual(tools.buildCall(coreTools[2], "not an object"), {"error": "Missing path parameter: id"});
		});
	});

	describe("serviceTools, listTools and callTool against local servers", () => {
		let service = null;
		let servicePort = null;
		let asked = 0;
		let answer = {result: true, data: {tools: coreTools}};

		before((done) => {
			serve((req, body, res) => {
				asked++;
				if (req.url === "/mcp/tools") {
					return json(res, 200, answer);
				}
				return json(res, 404, {});
			}, (server, port) => {
				service = server;
				servicePort = port;
				done();
			});
		});
		after((done) => {
			service.close(done);
		});

		let services = () => {
			return {
				urac: {port: servicePort, maintenance: {port: {type: "inherit"}}},
				down: {port: 1, maintenance: {port: {type: "inherit"}}}
			};
		};

		it("asks the service once, then from the cache", (done) => {
			asked = 0;
			let req = makeReq({services: services()});
			tools.serviceTools(req, "urac", "1", config).then((list) => {
				assert.deepStrictEqual(list, coreTools);
				return tools.serviceTools(req, "urac", "1", config);
			}).then((list) => {
				assert.deepStrictEqual(list, coreTools);
				assert.strictEqual(asked, 1);
				done();
			}).catch(done);
		});

		it("a service that does not answer, is not in the registry or has no host has no tools", (done) => {
			let req = makeReq({services: services()});
			tools.serviceTools(req, "down", "1", config).then((list) => {
				assert.deepStrictEqual(list, []);
				assert.ok(log.errors[0].indexOf("could not get the tools of [down@1]") !== -1);
				return tools.serviceTools(req, "missing", "1", config);
			}).then((list) => {
				assert.deepStrictEqual(list, []);
				return tools.serviceTools(makeReq({services: services(), host: null}), "urac", "1", config);
			}).then((list) => {
				assert.deepStrictEqual(list, []);
				done();
			}).catch(done);
		});

		it("listTools: the tools the ACL allows, named, annotated, the gateway left out", (done) => {
			let acl = {
				urac: {"1": {access: true, apisPermission: "restricted", get: [{group: "g", apis: {"/users": {}}}], post: {apis: {"/user/:id": {}}}}},
				controller: {"1": {access: true}}
			};
			let req = makeReq({services: services(), acl: acl});
			tools.listTools(req, configuration, config).then((list) => {
				assert.deepStrictEqual(list.tools.map((t) => t.name), ["urac_get_users", "urac_post_user_id"]);
				assert.deepStrictEqual(list.tools[0], {
					"name": "urac_get_users",
					"title": "List users",
					"description": "List users [urac: GET /users]",
					"inputSchema": coreTools[0].inputSchema,
					"annotations": {"readOnlyHint": true, "destructiveHint": false, "openWorldHint": false}
				});
				assert.deepStrictEqual(list.index.urac_post_user_id, {"service": "urac", "version": "1", "tool": coreTools[1]});
				done();
			}).catch(done);
		});

		it("listTools: maxTools caps the list, no ACL gives no tools", (done) => {
			let acl = {urac: {"1": {access: true}}};
			tools.listTools(makeReq({services: services(), acl: acl}), configuration, Object.assign({}, config, {maxTools: 2})).then((list) => {
				assert.strictEqual(list.tools.length, 2);
				assert.strictEqual(list.tools[1].annotations.readOnlyHint, false);
				return tools.listTools(makeReq({services: services()}), configuration, config);
			}).then((list) => {
				assert.deepStrictEqual(list.tools, []);
				done();
			}).catch(done);
		});

		describe("callTool", () => {
			let gateway = null;
			let gatewayPort = null;
			let received = null;
			let reply = null;

			before((done) => {
				serve((req, body, res) => {
					received = {method: req.method, url: req.url, headers: req.headers, body: body};
					return json(res, reply.status, reply.body);
				}, (server, port) => {
					gateway = server;
					gatewayPort = port;
					done();
				});
			});
			after((done) => {
				gateway.close(done);
			});

			let entry = {service: "urac", version: "2", tool: coreTools[1]};

			it("the api call goes through the gateway port with the caller's credentials", (done) => {
				reply = {status: 200, body: {result: true, data: {updated: true}}};
				let req = makeReq({
					gatewayPort: gatewayPort,
					headers: {"authorization": "Bearer abc", "device-id": "d1", "idempotency-key": "k1", "cookie": "no"},
					query: {access_token: "tok"}
				});
				tools.callTool(req, configuration, config, entry, {id: "u1", name: "Ann"}).then((result) => {
					assert.strictEqual(received.method, "POST");
					assert.strictEqual(received.url, "/urac/v2/user/u1");
					assert.deepStrictEqual(JSON.parse(received.body), {profile: {name: "Ann"}});
					assert.strictEqual(received.headers.key, "extKey");
					assert.strictEqual(received.headers.authorization, "Bearer abc");
					assert.strictEqual(received.headers.access_token, "tok");
					assert.strictEqual(received.headers["device-id"], "d1");
					assert.strictEqual(received.headers["idempotency-key"], "k1");
					assert.strictEqual(received.headers["x-forwarded-for"], "10.0.0.5");
					assert.ok(!received.headers.cookie);
					assert.deepStrictEqual(result, {
						"content": [{"type": "text", "text": "{\"updated\":true}"}],
						"isError": false,
						"structuredContent": {"updated": true}
					});
					done();
				}).catch(done);
			});

			it("a get has no body, an array answer has no structuredContent", (done) => {
				reply = {status: 200, body: {result: true, data: [1, 2]}};
				let req = makeReq({gatewayPort: gatewayPort});
				tools.callTool(req, configuration, config, {service: "urac", version: "1", tool: coreTools[0]}, {limit: 3}).then((result) => {
					assert.strictEqual(received.method, "GET");
					assert.strictEqual(received.url, "/urac/v1/users?limit=3");
					assert.strictEqual(received.body, "");
					assert.deepStrictEqual(result, {"content": [{"type": "text", "text": "[1,2]"}], "isError": false});
					done();
				}).catch(done);
			});

			it("an api error is a tool error", (done) => {
				reply = {status: 403, body: {result: false, errors: {codes: [154], details: [{code: 154, message: "denied"}]}}};
				tools.callTool(makeReq({gatewayPort: gatewayPort}), configuration, config, entry, {id: "u1"}).then((result) => {
					assert.strictEqual(result.isError, true);
					assert.ok(result.content[0].text.indexOf("denied") !== -1);
					assert.ok(!result.structuredContent);
					reply = {status: 200, body: {result: false, errors: {codes: [400]}}};
					return tools.callTool(makeReq({gatewayPort: gatewayPort}), configuration, config, entry, {id: "u1"});
				}).then((result) => {
					assert.strictEqual(result.isError, true);
					done();
				}).catch(done);
			});

			it("a missing path param and a gateway that does not answer", (done) => {
				tools.callTool(makeReq({gatewayPort: gatewayPort}), configuration, config, entry, {}).then((result) => {
					assert.deepStrictEqual(result, {"content": [{"type": "text", "text": "Missing path parameter: id"}], "isError": true});
					return tools.callTool(makeReq({gatewayPort: 1}), configuration, config, entry, {id: "u1"});
				}).then((result) => {
					assert.strictEqual(result.isError, true);
					assert.ok(result.content[0].text.indexOf("The call failed") === 0);
					done();
				}).catch(done);
			});
		});

		describe("the /soajs/mcp route", () => {
			let route = mcp(configuration);

			let rpc = (opts, cb) => {
				let req = makeReq(Object.assign({services: services(), acl: {urac: {"1": {access: true}}}}, opts, {
					onControllerResponse: (response) => cb(null, null, response)
				}));
				route(req, {}, () => {
					req.soajs.controller.gotoservice(req, makeRes(cb));
				});
				return req;
			};
			let message = (body) => {
				return JSON.stringify(Object.assign({jsonrpc: "2.0", id: 1}, body));
			};

			it("needs a key, mimics a gateway api without changing the registry", (done) => {
				let req = makeReq({headers: {key: ""}, onControllerResponse: (response) => {
					assert.deepStrictEqual(response, {code: 132});
				}});
				route(req, {}, () => {
					done(new Error("should not continue"));
				});
				let ok = makeReq({});
				let shared = ok.soajs.registry.services.controller;
				route(ok, {}, () => {
					assert.strictEqual(ok.soajs.controller.serviceParams.path, "/soajs/mcp");
					assert.deepStrictEqual(ok.soajs.controller.serviceParams.registry.versions["1"].apis, [{"l": "MCP", "v": "/soajs/mcp", "m": "post"}]);
					assert.ok(!shared.versions);
					done();
				});
			});

			it("off: 190", (done) => {
				rpc({mcp: null, body: message({method: "ping"})}, (status, headers, body) => {
					assert.deepStrictEqual(body, {"status": 404, "code": 190, "msg": "MCP is not enabled in this environment."});
					done();
				});
			});

			it("POST only", (done) => {
				rpc({method: "GET"}, (status, headers, body) => {
					assert.strictEqual(status, 405);
					assert.strictEqual(headers.Allow, "POST");
					assert.strictEqual(body.error.code, -32600);
					done();
				});
			});

			it("parse error, batch, invalid request", (done) => {
				rpc({body: "{nope"}, (status, headers, body) => {
					assert.strictEqual(status, 400);
					assert.strictEqual(body.error.code, -32700);
					rpc({body: "[]"}, (status, headers, body) => {
						assert.strictEqual(body.error.code, -32600);
						rpc({body: JSON.stringify({jsonrpc: "1.0", id: 7, method: "ping"})}, (status, headers, body) => {
							assert.strictEqual(status, 400);
							assert.deepStrictEqual(body, {"jsonrpc": "2.0", "id": 7, "error": {"code": -32600, "message": "Invalid request"}});
							done();
						});
					});
				});
			});

			it("a notification is accepted with no answer", (done) => {
				rpc({body: JSON.stringify({jsonrpc: "2.0", method: "notifications/initialized"})}, (status, headers, body) => {
					assert.strictEqual(status, 202);
					assert.strictEqual(body, null);
					done();
				});
			});

			it("too large", (done) => {
				rpc({body: "x".repeat(1024 * 1024 + 1)}, (status) => {
					assert.strictEqual(status, 413);
					done();
				});
			});

			it("initialize: the client's protocol version when supported, else the latest", (done) => {
				rpc({body: message({method: "initialize", params: {protocolVersion: "2025-03-26"}})}, (status, headers, body) => {
					assert.strictEqual(status, 200);
					assert.strictEqual(headers["Content-Type"], "application/json");
					assert.strictEqual(body.result.protocolVersion, "2025-03-26");
					assert.deepStrictEqual(body.result.capabilities, {"tools": {"listChanged": false}});
					assert.strictEqual(body.result.serverInfo.name, "soajs-gateway");
					rpc({body: message({method: "initialize", params: {protocolVersion: "1999-01-01"}})}, (status, headers, body) => {
						assert.strictEqual(body.result.protocolVersion, "2025-06-18");
						done();
					});
				});
			});

			it("ping and an unknown method", (done) => {
				rpc({body: message({method: "ping"})}, (status, headers, body) => {
					assert.deepStrictEqual(body, {"jsonrpc": "2.0", "id": 1, "result": {}});
					rpc({body: message({method: "resources/list"})}, (status, headers, body) => {
						assert.strictEqual(body.error.code, -32601);
						done();
					});
				});
			});

			it("tools/list", (done) => {
				rpc({body: message({method: "tools/list"})}, (status, headers, body) => {
					assert.deepStrictEqual(body.result.tools.map((t) => t.name), ["urac_get_users", "urac_post_user_id", "urac_delete_user_id"]);
					done();
				});
			});

			it("tools/call: no name, an unknown tool, a call", (done) => {
				rpc({body: message({method: "tools/call", params: {}})}, (status, headers, body) => {
					assert.strictEqual(body.error.code, -32602);
					rpc({body: message({method: "tools/call", params: {name: "urac_nope"}})}, (status, headers, body) => {
						assert.deepStrictEqual(body.error, {"code": -32602, "message": "Unknown tool: urac_nope"});
						rpc({gatewayPort: 1, body: message({method: "tools/call", params: {name: "urac_get_users", arguments: {}}})}, (status, headers, body) => {
							assert.strictEqual(body.result.isError, true);
							done();
						});
					});
				});
			});
		});
	});

	describe("acl lib", () => {
		it("grouped and plain restricted ACLs list their apis", () => {
			let req = makeReq({
				acl: {
					urac: {
						"1": {access: true, apisPermission: "restricted", get: [{group: "a", apis: {"/x": {}}}, {group: "b", apis: {"/y": {}, "/x": {}}}]},
						"2": {access: true, apisPermission: "restricted", post: {apis: {"/z": {}}}}
					}
				}
			});
			assert.deepStrictEqual(aclLib.computeACL(req).finalACL, {"urac": {"version": "2", "post": ["/z"]}});
			req = makeReq({acl: {urac: {"1": {access: true, apisPermission: "restricted", get: [{group: "a", apis: {"/x": {}}}, {group: "b", apis: {"/y": {}, "/x": {}}}]}}}});
			assert.deepStrictEqual(aclLib.computeACL(req).finalACL, {"urac": {"version": "1", "get": ["/x", "/y"]}});
		});
	});
});
