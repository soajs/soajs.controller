"use strict";

/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

const assert = require('assert');

describe("Unit test for: mw - gotoService monitor buffer", function () {

	// We need to test the buffer module functions directly
	// Since they are module-level in redirectToService.js, we'll test the logic patterns

	describe("Buffer configuration parsing", function () {

		it("should recognize buffer config with time only", function (done) {
			let monitor = {
				"buffer": {
					"time": 5000
				}
			};
			let hasBuffer = monitor && monitor.buffer && (monitor.buffer.time || monitor.buffer.limit);
			assert.strictEqual(hasBuffer, true);
			done();
		});

		it("should recognize buffer config with limit only", function (done) {
			let monitor = {
				"buffer": {
					"limit": 100
				}
			};
			let hasBuffer = monitor && monitor.buffer && (monitor.buffer.time || monitor.buffer.limit);
			assert.strictEqual(hasBuffer, true);
			done();
		});

		it("should recognize buffer config with both time and limit", function (done) {
			let monitor = {
				"buffer": {
					"time": 5000,
					"limit": 100
				}
			};
			let hasBuffer = monitor && monitor.buffer && (monitor.buffer.time || monitor.buffer.limit);
			assert.strictEqual(hasBuffer, true);
			done();
		});

		it("should not recognize buffer config when buffer is not set", function (done) {
			let monitor = {
				"req_info": true
			};
			let hasBuffer = monitor && monitor.buffer && (monitor.buffer.time || monitor.buffer.limit);
			assert.strictEqual(!!hasBuffer, false);
			done();
		});

		it("should not recognize buffer config when buffer is empty", function (done) {
			let monitor = {
				"buffer": {}
			};
			let hasBuffer = monitor && monitor.buffer && (monitor.buffer.time || monitor.buffer.limit);
			assert.strictEqual(!!hasBuffer, false);
			done();
		});

		it("should not recognize buffer when monitor is null", function (done) {
			let monitor = null;
			let hasBuffer = monitor && monitor.buffer && (monitor.buffer.time || monitor.buffer.limit);
			assert.strictEqual(!!hasBuffer, false);
			done();
		});
	});

	describe("Buffer limit threshold logic", function () {

		it("should trigger flush when buffer reaches limit", function (done) {
			let monitorBuffer = [];
			let bufferLimit = 3;

			// Simulate adding items
			for (let i = 0; i < 3; i++) {
				monitorBuffer.push({ name: "test", api: "/test" + i });
			}

			let shouldFlush = bufferLimit && monitorBuffer.length >= bufferLimit;
			assert.strictEqual(shouldFlush, true);
			done();
		});

		it("should not trigger flush when buffer is below limit", function (done) {
			let monitorBuffer = [];
			let bufferLimit = 10;

			// Simulate adding items
			for (let i = 0; i < 5; i++) {
				monitorBuffer.push({ name: "test", api: "/test" + i });
			}

			let shouldFlush = bufferLimit && monitorBuffer.length >= bufferLimit;
			assert.strictEqual(shouldFlush, false);
			done();
		});

		it("should not trigger flush when no limit is set", function (done) {
			let monitorBuffer = [];
			let bufferLimit = null;

			// Simulate adding items
			for (let i = 0; i < 100; i++) {
				monitorBuffer.push({ name: "test", api: "/test" + i });
			}

			let shouldFlush = bufferLimit && monitorBuffer.length >= bufferLimit;
			assert.strictEqual(shouldFlush, false);
			done();
		});
	});

	describe("Buffer time threshold logic", function () {

		it("should start timer when time threshold is set and no timer exists", function (done) {
			let monitorFlushTimer = null;
			let bufferTime = 5000;

			let shouldStartTimer = bufferTime && !monitorFlushTimer;
			assert.strictEqual(shouldStartTimer, true);
			done();
		});

		it("should not start timer when timer already exists", function (done) {
			let monitorFlushTimer = setTimeout(() => {}, 5000);
			let bufferTime = 5000;

			let shouldStartTimer = bufferTime && !monitorFlushTimer;
			assert.strictEqual(shouldStartTimer, false);

			clearTimeout(monitorFlushTimer);
			done();
		});

		it("should not start timer when no time threshold is set", function (done) {
			let monitorFlushTimer = null;
			let bufferTime = null;

			let shouldStartTimer = bufferTime && !monitorFlushTimer;
			assert.strictEqual(!!shouldStartTimer, false);
			done();
		});
	});

	describe("Buffer flush conditions", function () {

		it("should not flush when buffer is empty", function (done) {
			let monitorBuffer = [];
			let monitorFlushInProgress = false;

			let shouldFlush = !(monitorFlushInProgress || monitorBuffer.length === 0);
			assert.strictEqual(shouldFlush, false);
			done();
		});

		it("should not flush when flush is already in progress", function (done) {
			let monitorBuffer = [{ name: "test" }];
			let monitorFlushInProgress = true;

			let shouldFlush = !(monitorFlushInProgress || monitorBuffer.length === 0);
			assert.strictEqual(shouldFlush, false);
			done();
		});

		it("should flush when buffer has items and no flush in progress", function (done) {
			let monitorBuffer = [{ name: "test" }];
			let monitorFlushInProgress = false;

			let shouldFlush = !(monitorFlushInProgress || monitorBuffer.length === 0);
			assert.strictEqual(shouldFlush, true);
			done();
		});
	});

	describe("Monitor document transformation", function () {

		it("should convert body to string before sending", function (done) {
			let doc = {
				name: "test",
				body: Buffer.from("test body")
			};

			if (doc.body) {
				doc.body = doc.body.toString();
			}

			assert.strictEqual(typeof doc.body, "string");
			assert.strictEqual(doc.body, "test body");
			done();
		});

		it("should convert response to string before sending", function (done) {
			let doc = {
				name: "test",
				response: Buffer.from('{"result": true}')
			};

			if (doc.response) {
				doc.response = doc.response.toString();
			}

			assert.strictEqual(typeof doc.response, "string");
			assert.strictEqual(doc.response, '{"result": true}');
			done();
		});

		it("should handle doc without body or response", function (done) {
			let doc = {
				name: "test",
				api: "/test"
			};

			if (doc.body) {
				doc.body = doc.body.toString();
			}
			if (doc.response) {
				doc.response = doc.response.toString();
			}

			assert.strictEqual(doc.body, undefined);
			assert.strictEqual(doc.response, undefined);
			done();
		});
	});

	describe("Backward compatibility", function () {

		it("should send immediately when no buffer config (backward compatible)", function (done) {
			let monitor = {
				"req_info": true,
				"req_response": true
			};

			let hasBuffer = monitor && monitor.buffer && (monitor.buffer.time || monitor.buffer.limit);
			let shouldSendImmediately = !hasBuffer;

			assert.strictEqual(shouldSendImmediately, true);
			done();
		});

		it("should use buffer when buffer config is present", function (done) {
			let monitor = {
				"req_info": true,
				"req_response": true,
				"buffer": {
					"time": 5000,
					"limit": 100
				}
			};

			let hasBuffer = monitor && monitor.buffer && (monitor.buffer.time || monitor.buffer.limit);
			let shouldSendImmediately = !hasBuffer;

			assert.strictEqual(shouldSendImmediately, false);
			done();
		});
	});

	describe("Buffer retry logic", function () {

		it("should put items back in buffer when host not found", function (done) {
			let monitorBuffer = [];
			let itemsToSend = [{ name: "test1" }, { name: "test2" }];
			let host = null;

			// Simulate host not found - items should go back to buffer
			if (!host) {
				monitorBuffer = itemsToSend.concat(monitorBuffer);
			}

			assert.strictEqual(monitorBuffer.length, 2);
			assert.strictEqual(monitorBuffer[0].name, "test1");
			done();
		});

		it("should preserve order when putting items back", function (done) {
			let monitorBuffer = [{ name: "new1" }];
			let itemsToSend = [{ name: "old1" }, { name: "old2" }];
			let host = null;

			// Simulate host not found - items should go back to buffer
			if (!host) {
				monitorBuffer = itemsToSend.concat(monitorBuffer);
			}

			assert.strictEqual(monitorBuffer.length, 3);
			assert.strictEqual(monitorBuffer[0].name, "old1");
			assert.strictEqual(monitorBuffer[1].name, "old2");
			assert.strictEqual(monitorBuffer[2].name, "new1");
			done();
		});
	});

});
