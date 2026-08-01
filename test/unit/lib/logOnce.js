"use strict";

/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

const assert = require('assert');
const helper = require("../../helper.js");

let logOnceLib = helper.requireModule('./lib/logOnce.js');
const { logOnce, resetLogOnce } = logOnceLib;

describe("Unit test for: lib - logOnce", () => {

	let emitted = [];
	let log = {
		error: (input) => {
			emitted.push({ "level": "error", "input": input });
		},
		warn: (input) => {
			emitted.push({ "level": "warn", "input": input });
		}
	};

	beforeEach(() => {
		emitted = [];
		resetLogOnce();
	});

	it("emits the first time", (done) => {
		let did = logOnce(log, "error", "k1", "boom");
		assert.strictEqual(did, true);
		assert.strictEqual(emitted.length, 1);
		assert.strictEqual(emitted[0].level, "error");
		assert.strictEqual(emitted[0].input, "boom");
		done();
	});

	it("drops repeats of the same key", (done) => {
		for (let i = 0; i < 100; i++) {
			logOnce(log, "error", "k1", "boom");
		}
		assert.strictEqual(emitted.length, 1);
		done();
	});

	it("keeps distinct keys separate", (done) => {
		logOnce(log, "error", "k1", "one");
		logOnce(log, "error", "k2", "two");
		logOnce(log, "error", "k1", "one again");
		assert.strictEqual(emitted.length, 2);
		assert.strictEqual(emitted[0].input, "one");
		assert.strictEqual(emitted[1].input, "two");
		done();
	});

	it("honours the requested level", (done) => {
		logOnce(log, "warn", "k3", "careful");
		assert.strictEqual(emitted[0].level, "warn");
		done();
	});

	it("does not throw on a missing logger or unknown level", (done) => {
		assert.strictEqual(logOnce(null, "error", "k4", "x"), false);
		assert.strictEqual(logOnce(log, "nosuchlevel", "k5", "x"), false);
		assert.strictEqual(emitted.length, 0);
		done();
	});

	it("does not consume the key when it could not emit", (done) => {
		logOnce(null, "error", "k6", "x");
		let did = logOnce(log, "error", "k6", "now it works");
		assert.strictEqual(did, true);
		assert.strictEqual(emitted.length, 1);
		done();
	});
});
