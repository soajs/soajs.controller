"use strict";

const helper = require("../../../helper.js");
const tenantAccess = helper.requireModule('./mw/mt/tenantAccess');
const assert = require('assert');
const http = require('http');

describe("Unit test for: mw - mt tenant access resolver", () => {

	let errors = [];
	let log = {
		error: (msg) => {
			errors.push(msg);
		},
		debug: () => {
		}
	};

	function buildSoajs(port, resolver) {
		return {
			tenant: {
				id: "dept_tenant_id",
				code: "DEPT",
				name: "Department",
				locked: false,
				type: "client",
				main: { id: "main_tenant_id", code: "MAIN" },
				profile: {
					access: { resolver: "department", subject: "dept_1" }
				},
				key: { iKey: "ikey_1", eKey: "ekey_1" },
				application: { product: "PROD", package: "PROD_DEFAULT", appId: "app_1" }
			},
			servicesConfig: {
				commonFields: { a: 1 },
				departments: { b: 2 },
				other: { c: 3 }
			},
			registry: {
				services: {
					departments: { port: port }
				},
				custom: {
					urac: {
						value: {
							tenantAccessResolvers: {
								department: resolver || {
									service: "departments",
									version: "1",
									api: "/tenant/access",
									timeout: 500
								}
							}
						}
					}
				}
			},
			awareness: {
				getHost: (name, version, cb) => {
					return cb("127.0.0.1");
				}
			},
			log: log
		};
	}

	let user = {
		_id: "user_1",
		id: "user_1",
		username: "ann",
		tenant: { id: "home_tenant_id", code: "HOME" }
	};

	describe("getResolver", () => {
		beforeEach(() => {
			errors = [];
		});

		it("returns null when the tenant has no access in its profile", () => {
			let soajs = buildSoajs(1);
			delete soajs.tenant.profile.access;
			assert.strictEqual(tenantAccess.getResolver(soajs), null);
			assert.strictEqual(errors.length, 0);
		});

		it("returns null and logs when the resolver is not in the registry", () => {
			let soajs = buildSoajs(1);
			soajs.tenant.profile.access.resolver = "unknown";
			assert.strictEqual(tenantAccess.getResolver(soajs), null);
			assert.strictEqual(errors.length, 1);
		});

		it("returns the resolver with its defaults", () => {
			let soajs = buildSoajs(1, { service: "departments", api: "/tenant/access" });
			assert.deepStrictEqual(tenantAccess.getResolver(soajs), {
				name: "department",
				subject: "dept_1",
				service: "departments",
				version: null,
				method: "post",
				api: "/tenant/access",
				timeout: 2000
			});
		});
	});

	describe("resolve", () => {
		let server = null;
		let port = null;
		let reply = null;
		let received = null;

		before((done) => {
			server = http.createServer((req, res) => {
				let body = "";
				req.on("data", (chunk) => {
					body += chunk;
				});
				req.on("end", () => {
					received = {
						method: req.method,
						url: req.url,
						headers: req.headers,
						body: body ? JSON.parse(body) : null
					};
					reply(res);
				});
			});
			server.listen(0, "127.0.0.1", () => {
				port = server.address().port;
				done();
			});
		});
		after((done) => {
			server.close(done);
		});
		beforeEach(() => {
			errors = [];
			received = null;
		});

		function json(data, status) {
			return (res) => {
				res.writeHead(status || 200, { "Content-Type": "application/json" });
				res.end(JSON.stringify(data));
			};
		}

		it("grants access with the groups and groupsConfig of the response", (done) => {
			reply = json({
				result: true,
				data: {
					access: true,
					groups: ["member"],
					groupsConfig: { allowedPackages: { PROD: ["PROD_USER"] } }
				}
			});
			let soajs = buildSoajs(port);
			tenantAccess.resolve(soajs, user, tenantAccess.getResolver(soajs), (result) => {
				try {
					assert.deepStrictEqual(result, {
						groups: ["member"],
						groupsConfig: { allowedPackages: { PROD: ["PROD_USER"] } }
					});
					assert.strictEqual(received.method, "POST");
					assert.strictEqual(received.url, "/tenant/access");
					assert.deepStrictEqual(received.body, {
						user: { id: "user_1", username: "ann", tenant: { id: "home_tenant_id", code: "HOME" } },
						tenant: { id: "dept_tenant_id", code: "DEPT", main: { id: "main_tenant_id", code: "MAIN" } },
						subject: "dept_1"
					});
					let injectObj = JSON.parse(received.headers.soajsinjectobj);
					assert.deepStrictEqual(injectObj, {
						tenant: {
							id: "dept_tenant_id",
							name: "Department",
							code: "DEPT",
							locked: false,
							type: "client",
							main: { id: "main_tenant_id", code: "MAIN" }
						},
						key: {
							config: { commonFields: { a: 1 }, departments: { b: 2 } },
							iKey: "ikey_1",
							eKey: "ekey_1"
						},
						application: { product: "PROD", package: "PROD_DEFAULT", appId: "app_1" }
					});
					done();
				} catch (e) {
					done(e);
				}
			});
		});

		it("defaults groups to an empty array", (done) => {
			reply = json({
				result: true,
				data: { access: true, groupsConfig: { allowedPackages: { PROD: ["PROD_USER"] } } }
			});
			let soajs = buildSoajs(port);
			tenantAccess.resolve(soajs, user, tenantAccess.getResolver(soajs), (result) => {
				try {
					assert.deepStrictEqual(result.groups, []);
					done();
				} catch (e) {
					done(e);
				}
			});
		});

		it("no access when the resolver says no", (done) => {
			reply = json({ result: true, data: { access: false } });
			let soajs = buildSoajs(port);
			tenantAccess.resolve(soajs, user, tenantAccess.getResolver(soajs), (result) => {
				try {
					assert.strictEqual(result, null);
					assert.strictEqual(errors.length, 0);
					done();
				} catch (e) {
					done(e);
				}
			});
		});

		it("no access when access is granted without allowedPackages", (done) => {
			reply = json({ result: true, data: { access: true, groups: ["member"] } });
			let soajs = buildSoajs(port);
			tenantAccess.resolve(soajs, user, tenantAccess.getResolver(soajs), (result) => {
				try {
					assert.strictEqual(result, null);
					assert.strictEqual(errors.length, 1);
					done();
				} catch (e) {
					done(e);
				}
			});
		});

		it("no access when the service answers with an error", (done) => {
			reply = json({ result: false, errors: { codes: [400] } });
			let soajs = buildSoajs(port);
			tenantAccess.resolve(soajs, user, tenantAccess.getResolver(soajs), (result) => {
				try {
					assert.strictEqual(result, null);
					assert.strictEqual(errors.length, 1);
					done();
				} catch (e) {
					done(e);
				}
			});
		});

		it("no access on a non 2xx status", (done) => {
			reply = json({ result: true, data: { access: true } }, 500);
			let soajs = buildSoajs(port);
			tenantAccess.resolve(soajs, user, tenantAccess.getResolver(soajs), (result) => {
				try {
					assert.strictEqual(result, null);
					assert.strictEqual(errors.length, 1);
					done();
				} catch (e) {
					done(e);
				}
			});
		});

		it("no access on a response that is not JSON", (done) => {
			reply = (res) => {
				res.writeHead(200);
				res.end("not json");
			};
			let soajs = buildSoajs(port);
			tenantAccess.resolve(soajs, user, tenantAccess.getResolver(soajs), (result) => {
				try {
					assert.strictEqual(result, null);
					assert.strictEqual(errors.length, 1);
					done();
				} catch (e) {
					done(e);
				}
			});
		});

		it("no access when the resolver times out", (done) => {
			reply = () => {
				//never answers
			};
			let soajs = buildSoajs(port, {
				service: "departments",
				api: "/tenant/access",
				timeout: 100
			});
			tenantAccess.resolve(soajs, user, tenantAccess.getResolver(soajs), (result) => {
				try {
					assert.strictEqual(result, null);
					assert.strictEqual(errors.length, 1);
					done();
				} catch (e) {
					done(e);
				}
			});
		});

		it("no access when the service is not in the registry", (done) => {
			let soajs = buildSoajs(port);
			let resolver = tenantAccess.getResolver(soajs);
			delete soajs.registry.services.departments;
			tenantAccess.resolve(soajs, user, resolver, (result) => {
				try {
					assert.strictEqual(result, null);
					assert.strictEqual(received, null);
					assert.strictEqual(errors.length, 1);
					done();
				} catch (e) {
					done(e);
				}
			});
		});

		it("no access when there is no host", (done) => {
			let soajs = buildSoajs(port);
			soajs.awareness.getHost = (name, version, cb) => {
				return cb(null);
			};
			tenantAccess.resolve(soajs, user, tenantAccess.getResolver(soajs), (result) => {
				try {
					assert.strictEqual(result, null);
					assert.strictEqual(received, null);
					assert.strictEqual(errors.length, 1);
					done();
				} catch (e) {
					done(e);
				}
			});
		});
	});
});
