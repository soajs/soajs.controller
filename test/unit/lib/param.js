"use strict";

const helper = require("../../helper.js");
const libParam = helper.requireModule('./lib/param');
const assert = require('assert');
let localConfig = helper.requireModule('./config.js');

describe("Unit test for: lib - param", function () {
	let what2expect = {
		"config": {
			"serviceName": localConfig.serviceName,
			"serviceVersion": localConfig.serviceVersion,
			"serviceGroup": localConfig.serviceGroup,
			"maintenance": {
				"port": {"type": "maintenance"},
				"readiness": "/heartbeat",
				"commands": [{
					"label": "Releoad Registry",
					"path": "/reloadRegistry",
					"icon": "registry"
				}, {
					"label": "Statistics Info",
					"path": "/awarenessStat",
					"icon": "awareness"
				}, {"label": "Releoad Provision Info", "path": "/loadProvision", "icon": "provision"}]
			}
		},
		"init": {
			"awareness": true,
			"serviceName": localConfig.serviceName,
			"serviceVersion": localConfig.serviceVersion,
			"serviceGroup": localConfig.serviceGroup,
			"serviceHATask": null
		}
	};
	it("Vanilla test", function (done) {
		let response = libParam({
			"serviceName": localConfig.serviceName,
			"serviceVersion": localConfig.serviceVersion,
			"serviceGroup": localConfig.serviceGroup
		});
		assert.deepStrictEqual(response, what2expect, "lib.param vanilla test failed what2expect");
		done();
	});
});