"use strict";

const helper = require("../../../helper.js");
const model = helper.requireModule('./mw/cache/model/memory');
const assert = require('assert');

describe("Unit test for: mw - cache/model/memory", () => {

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
		model.invalidate({ l1: 'tenant1', l2: 'key1' });
		model.invalidate({ l1: 'tenant1', l2: 'key2' });
		model.invalidate({ l1: 'tenant2', l2: 'key1' });
		done();
	});

	describe("get", () => {
		it("should return null for non-existent key", (done) => {
			let result = model.get({ l1: 'tenant1', l2: 'nonexistent' });
			assert.strictEqual(result, null);
			done();
		});

		it("should return entry after set", (done) => {
			let key = { l1: 'tenant1', l2: 'key1' };
			let response = { statusCode: 200, body: 'test' };
			model.set(key, response, 60000);
			let result = model.get(key);
			assert.notStrictEqual(result, null);
			assert.deepStrictEqual(result.response, response);
			done();
		});

		it("should return null for expired entry", (done) => {
			let key = { l1: 'tenant1', l2: 'key1' };
			model.set(key, { statusCode: 200 }, 1); // 1ms TTL
			setTimeout(() => {
				let result = model.get(key);
				assert.strictEqual(result, null);
				done();
			}, 10);
		});
	});

	describe("set", () => {
		it("should store response with TTL", (done) => {
			let key = { l1: 'tenant1', l2: 'key1' };
			let response = {
				statusCode: 200,
				headers: { 'Content-Type': 'application/json' },
				body: '{"data": []}'
			};
			model.set(key, response, 60000);
			let result = model.get(key);
			assert.notStrictEqual(result, null);
			assert.deepStrictEqual(result.response, response);
			assert.ok(result.cachedAt);
			assert.ok(result.expiresAt);
			assert.ok(result.expiresAt > result.cachedAt);
			done();
		});

		it("should overwrite existing entry", (done) => {
			let key = { l1: 'tenant1', l2: 'key1' };
			model.set(key, { statusCode: 200, body: 'first' }, 60000);
			model.set(key, { statusCode: 200, body: 'second' }, 60000);
			let result = model.get(key);
			assert.strictEqual(result.response.body, 'second');
			done();
		});

		it("should isolate keys by tenant", (done) => {
			let key1 = { l1: 'tenant1', l2: 'key1' };
			let key2 = { l1: 'tenant2', l2: 'key1' };
			model.set(key1, { statusCode: 200, body: 'tenant1' }, 60000);
			model.set(key2, { statusCode: 200, body: 'tenant2' }, 60000);
			let result1 = model.get(key1);
			let result2 = model.get(key2);
			assert.strictEqual(result1.response.body, 'tenant1');
			assert.strictEqual(result2.response.body, 'tenant2');
			done();
		});
	});

	describe("invalidate", () => {
		it("should remove cached entry", (done) => {
			let key = { l1: 'tenant1', l2: 'key1' };
			model.set(key, { statusCode: 200 }, 60000);
			model.invalidate(key);
			let result = model.get(key);
			assert.strictEqual(result, null);
			done();
		});

		it("should handle invalidate of non-existent key", (done) => {
			let key = { l1: 'tenant1', l2: 'nonexistent' };
			// Should not throw
			model.invalidate(key);
			done();
		});
	});

	describe("invalidateTenant", () => {
		it("should remove all entries for tenant", (done) => {
			let key1 = { l1: 'tenant1', l2: 'key1' };
			let key2 = { l1: 'tenant1', l2: 'key2' };
			let key3 = { l1: 'tenant2', l2: 'key1' };
			model.set(key1, { statusCode: 200 }, 60000);
			model.set(key2, { statusCode: 200 }, 60000);
			model.set(key3, { statusCode: 200 }, 60000);
			model.invalidateTenant('tenant1');
			assert.strictEqual(model.get(key1), null);
			assert.strictEqual(model.get(key2), null);
			assert.notStrictEqual(model.get(key3), null);
			done();
		});
	});

	describe("cleanupExpiredEntries", () => {
		it("should remove expired entries", (done) => {
			let key1 = { l1: 'tenant1', l2: 'key1' };
			let key2 = { l1: 'tenant1', l2: 'key2' };
			model.set(key1, { statusCode: 200 }, 1); // expires immediately
			model.set(key2, { statusCode: 200 }, 60000); // long TTL
			setTimeout(() => {
				model.cleanupExpiredEntries();
				assert.strictEqual(model.get(key1), null);
				assert.notStrictEqual(model.get(key2), null);
				done();
			}, 10);
		});
	});

});
