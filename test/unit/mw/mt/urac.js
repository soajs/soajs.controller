"use strict";

const helper = require("../../../helper.js");
const UracDriver = helper.requireModule('./mw/mt/urac');
const assert = require('assert');

const sinon = require('sinon');

describe("Unit test for: mw - mt URAC", () => {
	
	let soajs = {
		tenant: {
			application: {
				product: {}
			},
			key: {
				iKey: "1111"
			}
		}
	};
	let oauth = {
		type: 0,
		bearerToken: {
			user: "me@antoine.com"
		}
	};
	
	describe("Vanilla test for: mw - mt URAC", () => {
		let uracDriver = new UracDriver({"soajs": soajs, "oauth": oauth});
		
		it("test init", (done) => {
			uracDriver.init((error, uracProfile) => {
				assert.deepStrictEqual(
					uracProfile, {user: 'me@antoine.com'}
				);
				done();
			});
		});
		it("test getProfile", (done) => {
			let p = uracDriver.getProfile();
			assert.deepStrictEqual(p, {
				_id: 'me@antoine.com',
				username: 'me@antoine.com',
				tenant: {},
				profile: {user: 'me@antoine.com'}
			});
			done();
		});
		it("test getAcl", (done) => {
			let a = uracDriver.getAcl();
			assert.deepStrictEqual(a, null);
			done();
		});
		it("test getAclAllEnv", (done) => {
			let a = uracDriver.getAclAllEnv();
			assert.deepStrictEqual(a, null);
			done();
		});
		it("test getConfig", (done) => {
			let a = uracDriver.getConfig();
			assert.deepStrictEqual(a, null);
			done();
		});
		it("test getGroups", (done) => {
			let a = uracDriver.getGroups();
			assert.deepStrictEqual(a, null);
			done();
		});
		it("test getAllowedPackages", (done) => {
			let a = uracDriver.getAllowedPackages();
			assert.deepStrictEqual(a, null);
			done();
		});
	});
	
	describe("bearerToken test for: mw - mt URAC", () => {
		oauth.type = 2;
		oauth.bearerToken = require('../../../data/sample/bearerToken.json');
		soajs.tenant.application.product = "DSBRD";
		let uracDriver = new UracDriver({"soajs": soajs, "oauth": oauth});

		let provisionStub;

		before((done) => {
			const coreModules = require("soajs.core.modules");
			let provision = coreModules.provision;

			provisionStub = sinon.stub(provision, 'getPackagesData').callsFake((code, cb) => {
				return cb(null, []);
			});

			done();
		});
		after((done) => {
			if (provisionStub) {
				provisionStub.restore();
			}
			done();
		});
		it("test init - full user", (done) => {
			uracDriver.init((error, uracProfile) => {
				assert.deepStrictEqual(uracProfile.username, 'owner');
				done();
			});
		});
		it("test getProfile - full user", (done) => {
			let p = uracDriver.getProfile(true);
			assert.deepStrictEqual(p, {
				"_id": '5c8d0c505653de3985aa0ffd',
				"username": 'owner',
				"firstName": 'owner',
				"lastName": 'owner',
				"email": 'me@localhost.com',
				"groups": ['owner'],
				"groupsConfig": {
					"allowedPackages": {
						"DSBRD": [
							"DSBRD_OWNER"
						]
					}
				},
				"profile": {},
				"config": {
					"packages": {},
					"keys": {}
				},
				"tenant": {"id": '5c0e74ba9acc3c5a84a51259', "code": 'DBTN'}
			});
			done();
		});
		it("test getAcl", (done) => {
			let a = uracDriver.getAcl();
			assert.deepStrictEqual(a, null);
			done();
		});
		it("test getAclAllEnv", (done) => {
			let a = uracDriver.getAclAllEnv();
			assert.deepStrictEqual(a, null);
			done();
		});
		it("test getConfig", (done) => {
			let a = uracDriver.getConfig();
			assert.deepStrictEqual(a, null);
			done();
		});
		it("test getGroups", (done) => {
			let a = uracDriver.getGroups();
			assert.deepStrictEqual(a, ['owner']);
			done();
		});
		it("test getAllowedPackages", (done) => {
			let a = uracDriver.getAllowedPackages();
			assert.deepStrictEqual(a, ["DSBRD_OWNER"]);
			done();
		});
	});

	describe("Network Package Override test for: mw - mt URAC", () => {
		let networkSoajs = {
			tenant: {
				application: {
					product: "AVAPP"
				},
				key: {
					iKey: "1111"
				}
			},
			registry: {
				custom: {
					gateway: {
						value: {
							lastSeen: {
								network: "mw"
							}
						}
					}
				}
			},
			controller: {
				serviceParams: {
					keyObj: {
						config: {
							gateway: {
								networkPackages: {
									"mw": {
										"AVAPP": {
											"default": "AVAPP_DEFAU",
											"users": {
												"AVAPP_EXMPL": "AVAPP_ALTRN"
											}
										}
									}
								}
							}
						}
					}
				}
			},
			log: {
				debug: (msg) => {
					console.log(msg);
				}
			}
		};

		let networkOauth = {
			type: 2,
			bearerToken: {
				user: {
					"_id": "user123",
					"username": "testuser",
					"firstName": "Test",
					"lastName": "User",
					"email": "test@example.com",
					"groups": ["testgroup"],
					"config": {},
					"tenant": {"id": "tenant123", "code": "TEST"},
					"groupsConfig": {
						"allowedPackages": {
							"AVAPP": ["AVAPP_EXMPL"]
						}
					},
					"loginMode": "oauth",
					"id": "user123"
				}
			}
		};

		let provisionStub;
		let receivedPackages = null;

		before((done) => {
			const coreModules = require("soajs.core.modules");
			let provision = coreModules.provision;

			provisionStub = sinon.stub(provision, 'getPackagesData').callsFake((packages, cb) => {
				receivedPackages = packages;
				return cb(null, []);
			});

			done();
		});

		after((done) => {
			if (provisionStub) {
				provisionStub.restore();
			}
			done();
		});

		it("test resolveACL with user network package override - should replace package", (done) => {
			receivedPackages = null;
			let uracDriver = new UracDriver({"soajs": networkSoajs, "oauth": networkOauth});

			uracDriver.init((error, uracProfile) => {
				// Verify getPackagesData was called with the overridden package
				assert.ok(receivedPackages, "getPackagesData should have been called");
				assert.deepStrictEqual(receivedPackages, ["AVAPP_ALTRN"], "Package should be overridden from AVAPP_EXMPL to AVAPP_ALTRN");
				done();
			});
		});

		it("test resolveACL without network - should NOT replace package", (done) => {
			receivedPackages = null;
			let soajsNoNetwork = JSON.parse(JSON.stringify(networkSoajs));
			soajsNoNetwork.registry.custom = {};
			soajsNoNetwork.log = {debug: (msg) => console.log(msg)};

			let uracDriver = new UracDriver({"soajs": soajsNoNetwork, "oauth": networkOauth});

			uracDriver.init((error, uracProfile) => {
				// Verify getPackagesData was called with the original package
				assert.ok(receivedPackages, "getPackagesData should have been called");
				assert.deepStrictEqual(receivedPackages, ["AVAPP_EXMPL"], "Package should NOT be overridden");
				done();
			});
		});

		it("test resolveACL with different network - should NOT replace package", (done) => {
			receivedPackages = null;
			let soajsDiffNetwork = JSON.parse(JSON.stringify(networkSoajs));
			soajsDiffNetwork.registry.custom.gateway.value.lastSeen.network = "other";
			soajsDiffNetwork.log = {debug: (msg) => console.log(msg)};

			let uracDriver = new UracDriver({"soajs": soajsDiffNetwork, "oauth": networkOauth});

			uracDriver.init((error, uracProfile) => {
				// Verify getPackagesData was called with the original package (different network)
				assert.ok(receivedPackages, "getPackagesData should have been called");
				assert.deepStrictEqual(receivedPackages, ["AVAPP_EXMPL"], "Package should NOT be overridden for different network");
				done();
			});
		});

		it("test resolveACL with no user mapping for package - should NOT replace package", (done) => {
			receivedPackages = null;
			let oauthDiffPackage = JSON.parse(JSON.stringify(networkOauth));
			oauthDiffPackage.bearerToken.user.groupsConfig.allowedPackages.AVAPP = ["AVAPP_OTHER"];

			let uracDriver = new UracDriver({"soajs": networkSoajs, "oauth": oauthDiffPackage});

			uracDriver.init((error, uracProfile) => {
				// Verify getPackagesData was called with original package (no mapping exists)
				assert.ok(receivedPackages, "getPackagesData should have been called");
				assert.deepStrictEqual(receivedPackages, ["AVAPP_OTHER"], "Package should NOT be overridden when no mapping exists");
				done();
			});
		});
	});

	describe("Tenant access resolver test for: mw - mt URAC", () => {
		const tenantAccess = helper.requireModule('./mw/mt/tenantAccess');
		const uracDriverModule = require('soajs.urac.driver');

		let resolveStub = null;
		let getRecordStub = null;
		let provisionStub = null;
		let resolverAnswer = null;
		let receivedPackages = null;

		function buildSoajs(options) {
			options = options || {};
			let soajs = {
				tenant: {
					id: "dept_tenant_id",
					code: "DEPT",
					profile: {
						access: { resolver: "department", subject: "dept_1" }
					},
					application: { product: "PROD", package: "PROD_DEFAULT" },
					key: { iKey: "ikey_1", eKey: "ekey_1" }
				},
				registry: {
					serviceConfig: { oauth: { getUserFromToken: options.getUserFromToken !== false } },
					custom: {
						urac: {
							value: {
								tenantAccessResolvers: {
									department: { service: "departments", api: "/tenant/access" }
								}
							}
						}
					}
				},
				log: {
					error: () => {
					},
					debug: () => {
					}
				}
			};
			if (options.roaming) {
				soajs.tenant.roaming = { tId: "home_tenant_id" };
			}
			return soajs;
		}

		function buildOauth(options) {
			options = options || {};
			let user = {
				"_id": "user_1",
				"id": "user_1",
				"username": "ann",
				"email": "ann@example.com",
				"groups": ["owner"],
				"config": {},
				"tenant": { "id": options.homeTenantId || "home_tenant_id", "code": "HOME" },
				"groupsConfig": { "allowedPackages": { "PROD": ["PROD_OWNER"] } },
				"loginMode": "urac"
			};
			if (options.invited) {
				user.config.allowedTenants = [{ tenant: { id: "dept_tenant_id", code: "DEPT" }, groups: ["guest"] }];
			}
			return {
				type: 2,
				bearerToken: {
					clientId: options.clientId || "home_tenant_id",
					user: user
				}
			};
		}

		before(() => {
			const coreModules = require("soajs.core.modules");
			provisionStub = sinon.stub(coreModules.provision, 'getPackagesData').callsFake((packages, cb) => {
				receivedPackages = packages;
				return cb(null, []);
			});
			resolveStub = sinon.stub(tenantAccess, 'resolve').callsFake((soajs, user, resolver, cb) => {
				return cb(resolverAnswer);
			});
			getRecordStub = sinon.stub(uracDriverModule, 'getRecord').callsFake((soajs, input, cb) => {
				return cb(null, {
					"_id": "user_1",
					"username": "ann",
					"groups": ["guest"],
					"tenant": { "id": "dept_tenant_id", "code": "DEPT" },
					"groupsConfig": { "allowedPackages": { "PROD": ["PROD_GUEST"] } }
				});
			});
		});
		after(() => {
			provisionStub.restore();
			resolveStub.restore();
			getRecordStub.restore();
		});
		beforeEach(() => {
			resolveStub.resetHistory();
			getRecordStub.resetHistory();
			receivedPackages = null;
			resolverAnswer = null;
		});

		it("resolver grants access, the driver is not called", (done) => {
			resolverAnswer = { groups: ["member"], groupsConfig: { allowedPackages: { PROD: ["PROD_USER"] } } };
			let uracDriver = new UracDriver({ "soajs": buildSoajs(), "oauth": buildOauth() });
			uracDriver.init((error, record) => {
				try {
					assert.ifError(error);
					assert.strictEqual(resolveStub.callCount, 1);
					assert.strictEqual(resolveStub.firstCall.args[2].name, "department");
					assert.strictEqual(getRecordStub.callCount, 0);
					assert.deepStrictEqual(record.tenant, { id: "dept_tenant_id", code: "DEPT" });
					assert.deepStrictEqual(record.groups, ["member"]);
					assert.deepStrictEqual(uracDriver.getGroups(), ["member"]);
					assert.deepStrictEqual(receivedPackages, ["PROD_USER"]);
					assert.strictEqual(record.email, "ann@example.com");
					done();
				} catch (e) {
					done(e);
				}
			});
		});

		it("resolver grants access with getUserFromToken off", (done) => {
			resolverAnswer = { groups: ["member"], groupsConfig: { allowedPackages: { PROD: ["PROD_USER"] } } };
			let uracDriver = new UracDriver({ "soajs": buildSoajs({ getUserFromToken: false }), "oauth": buildOauth() });
			uracDriver.init((error, record) => {
				try {
					assert.strictEqual(resolveStub.callCount, 1);
					assert.strictEqual(getRecordStub.callCount, 0);
					assert.deepStrictEqual(record.groups, ["member"]);
					done();
				} catch (e) {
					done(e);
				}
			});
		});

		it("resolver says no, falls back to the driver", (done) => {
			resolverAnswer = null;
			let uracDriver = new UracDriver({ "soajs": buildSoajs(), "oauth": buildOauth() });
			uracDriver.init((error, record) => {
				try {
					assert.strictEqual(resolveStub.callCount, 1);
					assert.strictEqual(getRecordStub.callCount, 1);
					assert.deepStrictEqual(record.groups, ["guest"]);
					assert.deepStrictEqual(receivedPackages, ["PROD_GUEST"]);
					done();
				} catch (e) {
					done(e);
				}
			});
		});

		it("invited per the token, the resolver is not called", (done) => {
			let uracDriver = new UracDriver({ "soajs": buildSoajs(), "oauth": buildOauth({ invited: true }) });
			uracDriver.init((error, record) => {
				try {
					assert.strictEqual(resolveStub.callCount, 0);
					assert.strictEqual(getRecordStub.callCount, 1);
					assert.deepStrictEqual(record.groups, ["guest"]);
					done();
				} catch (e) {
					done(e);
				}
			});
		});

		it("home tenant, the resolver is not called", (done) => {
			let uracDriver = new UracDriver({
				"soajs": buildSoajs({ getUserFromToken: false }),
				"oauth": buildOauth({ homeTenantId: "dept_tenant_id", clientId: "dept_tenant_id" })
			});
			uracDriver.init(() => {
				try {
					assert.strictEqual(resolveStub.callCount, 0);
					assert.strictEqual(getRecordStub.callCount, 1);
					done();
				} catch (e) {
					done(e);
				}
			});
		});

		it("token issued for this tenant, the user comes from the token", (done) => {
			let uracDriver = new UracDriver({ "soajs": buildSoajs(), "oauth": buildOauth({ clientId: "dept_tenant_id" }) });
			uracDriver.init((error, record) => {
				try {
					assert.strictEqual(resolveStub.callCount, 0);
					assert.strictEqual(getRecordStub.callCount, 0);
					assert.deepStrictEqual(record.groups, ["owner"]);
					done();
				} catch (e) {
					done(e);
				}
			});
		});

		it("roaming, the resolver is not called", (done) => {
			let uracDriver = new UracDriver({ "soajs": buildSoajs({ roaming: true }), "oauth": buildOauth() });
			uracDriver.init(() => {
				try {
					assert.strictEqual(resolveStub.callCount, 0);
					assert.strictEqual(getRecordStub.callCount, 0);
					done();
				} catch (e) {
					done(e);
				}
			});
		});

		it("tenant without access in its profile, the resolver is not called", (done) => {
			let soajs = buildSoajs();
			delete soajs.tenant.profile;
			let uracDriver = new UracDriver({ "soajs": soajs, "oauth": buildOauth() });
			uracDriver.init(() => {
				try {
					assert.strictEqual(resolveStub.callCount, 0);
					assert.strictEqual(getRecordStub.callCount, 1);
					done();
				} catch (e) {
					done(e);
				}
			});
		});
	});
});
