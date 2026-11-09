"use strict";

const helper = require("../../../helper.js");
const auth = helper.requireModule('./mw/soajsRoutes/mcp/auth');
const assert = require('assert');

const KEYS = {
	"agentsKey": {application: {product: "AGENTS", package: "AGENTS_ROLE"}},
	"agentKey": {application: {product: "AGENTS", package: "AGENTS_ROLE"}},
	"appKey": {application: {product: "AVAPP", package: "AVAPP_DEFAULT"}}
};

const TOKENS = {
	"agentToken": {user: {restrictedTo: {tenant: "t1", key: "agentKey"}}, expires: new Date(Date.now() + 60000)},
	"listToken": {user: {restrictedTo: {tenant: "t1", key: ["agentKey"]}}, expires: new Date(Date.now() + 60000)},
	"userToken": {user: {}, expires: new Date(Date.now() + 60000)},
	"oldToken": {user: {restrictedTo: {key: "agentKey"}}, expires: new Date(Date.now() - 1000)}
};

const provision = {
	getExternalKeyData: (key, keyConfig, cb) => {
		return KEYS[key] ? cb(null, KEYS[key]) : cb(new Error("no key"), null);
	},
	oauthModel: {
		getAccessToken: (token, cb) => {
			if (token === "broken") {
				return cb(new Error("db down"));
			}
			return cb(null, TOKENS[token] || null);
		}
	}
};

const ENTRY = (name) => {
	return {
		"authorization_endpoint": "https://portal." + name + "/agents/authorize",
		"token_endpoint": "https://api." + name + "/agents/oauth/token?key=agentsKey",
		"registration_endpoint": "https://api." + name + "/agents/oauth/register?key=agentsKey"
	};
};

const AUTH = {
	"byProduct": {"AGENTS": ENTRY("agents")},
	"byHost": {"api.client.example": ENTRY("client")},
	"default": ENTRY("default")
};

let makeReq = (opts) => {
	opts = opts || {};
	let mcp = (opts.mcp === undefined) ? {enabled: true, auth: AUTH} : opts.mcp;
	let req = {
		method: opts.method || "POST",
		url: opts.url || "/soajs/mcp",
		headers: Object.assign({host: "api.connect.example", "x-forwarded-proto": "https"}, opts.headers || {}),
		query: opts.query || {},
		soajs: {
			log: {error: () => {
			}},
			registry: {
				serviceConfig: {key: {}},
				custom: {gateway: {value: {mcp: mcp}}}
			},
			controller: {
				serviceParams: {serviceInfo: opts.serviceInfo || ["", "soajs", "mcp"]}
			}
		}
	};
	return req;
};

/**
 * Runs a mw: cb(null) when it calls next, cb(answer) when it answers {status, headers, body}.
 */
let run = (mw, req, cb) => {
	let res = {
		writeHead: (status, headers) => {
			res.status = status;
			res.headers = headers;
		},
		end: (text) => {
			cb({status: res.status, headers: res.headers, body: JSON.parse(text)});
		}
	};
	mw(req, res, () => cb(null));
};

describe("Unit test for: mw - soajsRoutes mcp auth", () => {

	describe("well-known metadata", () => {
		let mw = auth.wellKnown({provision: provision});

		it("not a well-known path, mcp off or no auth: next", (done) => {
			run(mw, makeReq({method: "GET", url: "/urac/user"}), (answer) => {
				assert.strictEqual(answer, null);
				run(mw, makeReq({method: "GET", url: "/.well-known/oauth-protected-resource", mcp: {enabled: true}}), (answer) => {
					assert.strictEqual(answer, null);
					run(mw, makeReq({method: "GET", url: "/.well-known/oauth-protected-resource", mcp: {enabled: false, auth: AUTH}}), (answer) => {
						assert.strictEqual(answer, null);
						done();
					});
				});
			});
		});

		it("protected resource: by the product of the key in the url", (done) => {
			run(mw, makeReq({method: "GET", url: "/.well-known/oauth-protected-resource/soajs/mcp?key=agentsKey"}), (answer) => {
				assert.strictEqual(answer.status, 200);
				assert.deepStrictEqual(answer.body, {
					"resource": "https://api.connect.example/soajs/mcp?key=agentsKey",
					"authorization_servers": ["https://api.connect.example/soajs/mcp/auth/product/AGENTS"],
					"bearer_methods_supported": ["header"]
				});
				done();
			});
		});

		it("protected resource: by host, then the default, a product with no entry falls back", (done) => {
			run(mw, makeReq({method: "GET", url: "/.well-known/oauth-protected-resource", headers: {"x-forwarded-host": "api.client.example, proxy"}}), (answer) => {
				assert.deepStrictEqual(answer.body.authorization_servers, ["https://api.client.example/soajs/mcp/auth/host"]);
				assert.strictEqual(answer.body.resource, "https://api.client.example/soajs/mcp");
				run(mw, makeReq({method: "GET", url: "/.well-known/oauth-protected-resource/soajs/mcp?key=appKey"}), (answer) => {
					assert.deepStrictEqual(answer.body.authorization_servers, ["https://api.connect.example/soajs/mcp/auth/default"]);
					done();
				});
			});
		});

		it("protected resource: nothing configured for the request: next", (done) => {
			run(mw, makeReq({method: "GET", url: "/.well-known/oauth-protected-resource", mcp: {enabled: true, auth: {byHost: {"other": ENTRY("x")}}}}), (answer) => {
				assert.strictEqual(answer, null);
				done();
			});
		});

		it("authorization server: the entry the issuer names, in both well-known forms", (done) => {
			run(mw, makeReq({method: "GET", url: "/.well-known/oauth-authorization-server/soajs/mcp/auth/product/AGENTS"}), (answer) => {
				assert.strictEqual(answer.status, 200);
				assert.deepStrictEqual(answer.body, {
					"issuer": "https://api.connect.example/soajs/mcp/auth/product/AGENTS",
					"authorization_endpoint": "https://portal.agents/agents/authorize",
					"token_endpoint": "https://api.agents/agents/oauth/token?key=agentsKey",
					"response_types_supported": ["code"],
					"grant_types_supported": ["authorization_code"],
					"code_challenge_methods_supported": ["S256"],
					"token_endpoint_auth_methods_supported": ["none"],
					"registration_endpoint": "https://api.agents/agents/oauth/register?key=agentsKey"
				});
				run(mw, makeReq({method: "GET", url: "/.well-known/openid-configuration/soajs/mcp/auth/default"}), (answer) => {
					assert.strictEqual(answer.body.authorization_endpoint, "https://portal.default/agents/authorize");
					done();
				});
			});
		});

		it("authorization server: an unknown issuer, an inherited name or a post: next", (done) => {
			run(mw, makeReq({method: "GET", url: "/.well-known/oauth-authorization-server/soajs/mcp/auth/product/OTHER"}), (answer) => {
				assert.strictEqual(answer, null);
				run(mw, makeReq({method: "GET", url: "/.well-known/oauth-authorization-server/soajs/mcp/auth/product/constructor"}), (answer) => {
					assert.strictEqual(answer, null);
					run(mw, makeReq({method: "POST", url: "/.well-known/oauth-authorization-server/soajs/mcp/auth/default"}), (answer) => {
						assert.strictEqual(answer, null);
						done();
					});
				});
			});
		});

		it("an entry without the token endpoint is not used", (done) => {
			let mcp = {enabled: true, auth: {default: {authorization_endpoint: "https://p/a"}}};
			run(mw, makeReq({method: "GET", url: "/.well-known/oauth-protected-resource", mcp: mcp}), (answer) => {
				assert.strictEqual(answer, null);
				done();
			});
		});
	});

	describe("authorize", () => {
		let mw = auth.authorize({provision: provision});

		it("another route, or mcp off: next, untouched", (done) => {
			let req = makeReq({serviceInfo: ["", "urac", "user"]});
			run(mw, req, (answer) => {
				assert.strictEqual(answer, null);
				run(mw, makeReq({mcp: {enabled: false, auth: AUTH}}), (answer) => {
					assert.strictEqual(answer, null);
					done();
				});
			});
		});

		it("no token and no auth configured: next, as before", (done) => {
			run(mw, makeReq({mcp: {enabled: true}}), (answer) => {
				assert.strictEqual(answer, null);
				done();
			});
		});

		it("no token: 401 with the metadata address, the url key kept", (done) => {
			run(mw, makeReq({headers: {key: "agentsKey"}, query: {key: "agentsKey"}}), (answer) => {
				assert.strictEqual(answer.status, 401);
				assert.strictEqual(answer.headers["WWW-Authenticate"],
					'Bearer resource_metadata="https://api.connect.example/.well-known/oauth-protected-resource/soajs/mcp?key=agentsKey"');
				assert.strictEqual(answer.body.error, "unauthorized");
				run(mw, makeReq(), (answer) => {
					assert.strictEqual(answer.headers["WWW-Authenticate"],
						'Bearer resource_metadata="https://api.connect.example/.well-known/oauth-protected-resource/soajs/mcp"');
					done();
				});
			});
		});

		it("an unknown or expired token: 401 invalid_token", (done) => {
			run(mw, makeReq({headers: {authorization: "Bearer nope"}}), (answer) => {
				assert.strictEqual(answer.status, 401);
				assert.ok(answer.headers["WWW-Authenticate"].indexOf('error="invalid_token"') !== -1);
				run(mw, makeReq({headers: {access_token: "oldToken"}}), (answer) => {
					assert.strictEqual(answer.body.error, "invalid_token");
					done();
				});
			});
		});

		it("the token store fails: next, the oauth mw decides", (done) => {
			run(mw, makeReq({query: {access_token: "broken"}}), (answer) => {
				assert.strictEqual(answer, null);
				done();
			});
		});

		it("no key: the key the token is restricted to, a one-key list too", (done) => {
			let req = makeReq({headers: {authorization: "Bearer agentToken"}});
			run(mw, req, (answer) => {
				assert.strictEqual(answer, null);
				assert.strictEqual(req.headers.key, "agentKey");
				let req2 = makeReq({headers: {authorization: "Bearer listToken"}});
				run(mw, req2, () => {
					assert.strictEqual(req2.headers.key, "agentKey");
					done();
				});
			});
		});

		it("a key of the same product is replaced, of another product kept", (done) => {
			let req = makeReq({headers: {authorization: "Bearer agentToken", key: "agentsKey"}});
			run(mw, req, (answer) => {
				assert.strictEqual(answer, null);
				assert.strictEqual(req.headers.key, "agentKey");
				let req2 = makeReq({headers: {authorization: "Bearer agentToken", key: "appKey"}});
				run(mw, req2, () => {
					assert.strictEqual(req2.headers.key, "appKey");
					done();
				});
			});
		});

		it("a token with no restricted key leaves the request as it is", (done) => {
			let req = makeReq({headers: {authorization: "Bearer userToken"}});
			run(mw, req, (answer) => {
				assert.strictEqual(answer, null);
				assert.ok(!req.headers.key);
				done();
			});
		});
	});

	describe("helpers", () => {
		it("tokenKey: one key only", () => {
			assert.strictEqual(auth.tokenKey({user: {restrictedTo: {key: "a"}}}), "a");
			assert.strictEqual(auth.tokenKey({user: {restrictedTo: {key: ["a"]}}}), "a");
			assert.strictEqual(auth.tokenKey({user: {restrictedTo: {key: ["a", "b"]}}}), null);
			assert.strictEqual(auth.tokenKey({user: {}}), null);
			assert.strictEqual(auth.tokenKey(null), null);
		});
		it("requestOrigin: forwarded proto and host, else the connection", () => {
			let req = makeReq({headers: {"x-forwarded-proto": undefined}});
			req.socket = {encrypted: false};
			assert.strictEqual(auth.requestOrigin(req), "http://api.connect.example");
		});
	});
});
