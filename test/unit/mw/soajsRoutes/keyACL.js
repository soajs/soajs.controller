"use strict";

const helper = require("../../../helper.js");
const mw = helper.requireModule('./mw/soajsRoutes/keyACL/index');
const assert = require('assert');

let configuration = {
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

let getACL = (acl, cb) => {
	let req = {
		headers: {key: "extKey"},
		soajs: {
			registry: {services: {controller: {}}},
			controller: {
				serviceParams: {
					keyObj: {
						tenant: {id: "t1", name: "Tenant", code: "TNT", type: "product"},
						application: {package: "PROD_PCK", acl: acl}
					},
					packObj: {}
				}
			},
			log: {
				debug: () => {
				}
			},
			controllerResponse: (response) => {
				return cb(response);
			}
		}
	};
	mw(configuration)(req, {}, () => {
		req.soajs.controller.gotoservice(req);
	});
};

describe("Unit test for: mw - soajsRoutes keyACL", () => {

	it("Fail - no key", (done) => {
		let req = {
			headers: {},
			soajs: {
				controllerResponse: (response) => {
					assert.deepStrictEqual(response, {code: 132});
					done();
				}
			}
		};
		mw(configuration)(req, {}, () => {
		});
	});

	it("Success - picks the latest version whatever the order of the versions", (done) => {
		// integer keys are always walked in ascending order, decimal keys in insertion order
		getACL({
			"urac": {
				"2.1": {"access": true},
				"1.5": {"access": true},
				"3.5": {"access": true}
			}
		}, (response) => {
			assert.deepStrictEqual(response.finalACL, {"urac": {"version": "3.5"}});
			assert.deepStrictEqual(response.packages, ["PROD_PCK"]);
			assert.deepStrictEqual(response.tenant, {id: "t1", name: "Tenant", code: "TNT", type: "product"});
			done();
		});
	});

	it("Success - restricted lists the apis of the latest version per method", (done) => {
		getACL({
			"urac": {
				"2": {
					"access": true,
					"apisPermission": "restricted",
					"get": {"apis": {"/user": {}, "/users": {}}},
					"post": {"apis": {"/user": {}}}
				},
				"1": {
					"access": true,
					"apisPermission": "restricted",
					"delete": {"apis": {"/user": {}}}
				}
			}
		}, (response) => {
			assert.deepStrictEqual(response.finalACL, {
				"urac": {
					"version": "2",
					"get": ["/user", "/users"],
					"post": ["/user"]
				}
			});
			done();
		});
	});
});
