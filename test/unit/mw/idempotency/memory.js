"use strict";

const helper = require("../../../helper.js");
const model = helper.requireModule('./mw/idempotency/model/memory');
const assert = require('assert');

describe("Unit test for: mw - idempotency/model/memory", () => {

	before((done) => {
		model.init({
			debug: () => {},
			info: () => {},
			error: () => {}
		});
		done();
	});

	afterEach((done) => {
		// Clean up between tests
		model.unlock({ l1: 'tenant1', l2: 'key1' });
		model.unlock({ l1: 'tenant1', l2: 'key2' });
		model.unlock({ l1: 'tenant2', l2: 'key1' });
		done();
	});

	describe("get", () => {
		it("should return null for non-existent key", (done) => {
			let result = model.get({ l1: 'tenant1', l2: 'nonexistent' });
			assert.strictEqual(result, null);
			done();
		});

		it("should return entry after lock", (done) => {
			let key = { l1: 'tenant1', l2: 'key1' };
			model.lock(key, 60000);
			let result = model.get(key);
			assert.notStrictEqual(result, null);
			assert.strictEqual(result.status, 'in_flight');
			done();
		});

		it("should return null for expired entry", (done) => {
			let key = { l1: 'tenant1', l2: 'key1' };
			model.lock(key, 1); // 1ms TTL
			setTimeout(() => {
				let result = model.get(key);
				assert.strictEqual(result, null);
				done();
			}, 10);
		});
	});

	describe("lock", () => {
		it("should successfully lock a new key", (done) => {
			let key = { l1: 'tenant1', l2: 'key1' };
			let result = model.lock(key, 60000);
			assert.strictEqual(result, true);
			done();
		});

		it("should fail to lock an already locked key", (done) => {
			let key = { l1: 'tenant1', l2: 'key1' };
			model.lock(key, 60000);
			let result = model.lock(key, 60000);
			assert.strictEqual(result, false);
			done();
		});

		it("should allow locking after key expires", (done) => {
			let key = { l1: 'tenant1', l2: 'key1' };
			model.lock(key, 1); // 1ms TTL
			setTimeout(() => {
				let result = model.lock(key, 60000);
				assert.strictEqual(result, true);
				done();
			}, 10);
		});

		it("should isolate keys by tenant", (done) => {
			let key1 = { l1: 'tenant1', l2: 'key1' };
			let key2 = { l1: 'tenant2', l2: 'key1' };
			let result1 = model.lock(key1, 60000);
			let result2 = model.lock(key2, 60000);
			assert.strictEqual(result1, true);
			assert.strictEqual(result2, true);
			done();
		});
	});

	describe("complete", () => {
		it("should store response data", (done) => {
			let key = { l1: 'tenant1', l2: 'key1' };
			let response = {
				statusCode: 200,
				headers: { 'Content-Type': 'application/json' },
				body: '{"result": true}'
			};
			model.lock(key, 60000);
			model.complete(key, response, 60000);
			let result = model.get(key);
			assert.notStrictEqual(result, null);
			assert.strictEqual(result.status, 'completed');
			assert.deepStrictEqual(result.response, response);
			done();
		});

		it("should update expiresAt on complete", (done) => {
			let key = { l1: 'tenant1', l2: 'key1' };
			model.lock(key, 100);
			let afterLock = model.get(key);
			model.complete(key, { statusCode: 200 }, 60000);
			let afterComplete = model.get(key);
			assert.ok(afterComplete.expiresAt > afterLock.expiresAt);
			done();
		});
	});

	describe("unlock", () => {
		it("should remove locked key", (done) => {
			let key = { l1: 'tenant1', l2: 'key1' };
			model.lock(key, 60000);
			model.unlock(key);
			let result = model.get(key);
			assert.strictEqual(result, null);
			done();
		});

		it("should handle unlock of non-existent key", (done) => {
			let key = { l1: 'tenant1', l2: 'nonexistent' };
			// Should not throw
			model.unlock(key);
			done();
		});
	});

	describe("cleanupExpiredEntries", () => {
		it("should remove expired entries", (done) => {
			let key1 = { l1: 'tenant1', l2: 'key1' };
			let key2 = { l1: 'tenant1', l2: 'key2' };
			model.lock(key1, 1); // expires immediately
			model.lock(key2, 60000); // long TTL
			setTimeout(() => {
				model.cleanupExpiredEntries();
				assert.strictEqual(model.get(key1), null);
				assert.notStrictEqual(model.get(key2), null);
				done();
			}, 10);
		});
	});

});
