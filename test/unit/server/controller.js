"use strict";

const helper = require("../../helper.js");
const assert = require('assert');

describe("Testing the gateway's controllers document", () => {
	let Controller;
	let reg = {
		"services": {
			"controller": {"name": "controller", "awarenessStats": {"10.0.0.5": {"healthy": true, "lastCheck": 1}, "10.0.0.6": {"healthy": true, "lastCheck": 1}}},
			"urac": {"name": "urac"}
		},
		"daemons": {"d": {}}
	};

	before((done) => {
		Controller = helper.requireModule('./server/controller.js');
		done();
	});

	it("is kept under the gateway's IP, with the services and daemons", (done) => {
		let doc = Controller.controllersDoc(reg, "controller", "10.0.0.5", false);
		assert.strictEqual(doc.ip, "10.0.0.5");
		assert.ok(doc.ts);
		assert.ok(doc.data.services.urac);
		assert.ok(doc.data.daemons.d);
		done();
	});

	it("when the gateway stops, marks only its own host unhealthy", (done) => {
		let doc = Controller.controllersDoc(reg, "controller", "10.0.0.5", true);
		let stats = doc.data.services.controller.awarenessStats;
		assert.strictEqual(stats["10.0.0.5"].healthy, false);
		assert.strictEqual(stats["10.0.0.6"].healthy, true);
		assert.strictEqual(doc.data.services.urac, undefined);
		assert.strictEqual(doc.data.daemons, undefined);
		// the registry itself is not changed
		assert.strictEqual(reg.services.controller.awarenessStats["10.0.0.5"].healthy, true);
		done();
	});

	it("no services or daemons: no document", (done) => {
		assert.strictEqual(Controller.controllersDoc({}, "controller", "10.0.0.5", false), null);
		assert.strictEqual(Controller.controllersDoc(null, "controller", "10.0.0.5", false), null);
		done();
	});
});
