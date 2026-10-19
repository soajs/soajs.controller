"use strict";

const helper = require("../../../helper.js");
const model = helper.requireModule('./mw/cache/model/mongo');
const assert = require('assert');

describe("Unit test for: mw - cache/model/mongo invalidation", () => {

	let calls = null;
	let invalidation = null;
	let deleted = 0;
	let originalMongo = null;
	let originalLog = null;

	before(() => {
		originalMongo = model.mongo;
		originalLog = model.log;
		model.log = {
			debug: () => {},
			info: () => {},
			error: () => {}
		};
		model.mongo = {
			findOne: async (col, condition) => {
				calls.push({ "op": "findOne", col, condition });
				return invalidation;
			},
			updateOne: async (col, condition, s, options) => {
				calls.push({ "op": "updateOne", col, condition, s, options });
			},
			deleteMany: async (col, condition) => {
				calls.push({ "op": "deleteMany", col, condition });
				return { deletedCount: deleted };
			}
		};
	});
	after(() => {
		model.mongo = originalMongo;
		model.log = originalLog;
	});
	beforeEach(() => {
		calls = [];
		invalidation = null;
		deleted = 0;
	});

	let key = { l1: 'tenant1', l2: 'spaces:GET:/spaces::u:user-1' };
	let response = { statusCode: 200, headers: {}, body: '[]' };

	it("set stores the fields an invalidation matches on", async () => {
		let stored = await model.set(key, response, 60000, { service: 'spaces', api: 'GET /spaces', user: 'user-1', startedAt: Date.now() });
		assert.strictEqual(stored, true);
		let update = calls.find((c) => c.op === "updateOne");
		assert.strictEqual(update.col, 'cache_store');
		assert.strictEqual(update.s.$set.service, 'spaces');
		assert.strictEqual(update.s.$set.api, 'GET /spaces');
		assert.strictEqual(update.s.$set.user, 'user-1');
	});

	it("set looks for an invalidation after the request started, for that api or all, that user or all", async () => {
		let startedAt = Date.now();
		await model.set(key, response, 60000, { service: 'spaces', api: 'GET /spaces', user: 'user-1', startedAt: startedAt });
		let lookup = calls.find((c) => c.op === "findOne");
		assert.strictEqual(lookup.col, 'cache_invalidation');
		assert.deepStrictEqual(lookup.condition, {
			l1: 'tenant1',
			service: 'spaces',
			api: { $in: ['GET /spaces', null] },
			user: { $in: ['user-1', null] },
			clearedAt: { $gt: new Date(startedAt) }
		});
	});

	it("set does not store a response read before an invalidation", async () => {
		invalidation = { clearedAt: new Date() };
		let stored = await model.set(key, response, 60000, { service: 'spaces', api: 'GET /spaces', user: 'user-1', startedAt: Date.now() - 1000 });
		assert.strictEqual(stored, false);
		assert.strictEqual(calls.filter((c) => c.op === "updateOne").length, 0);
	});

	it("set without meta stores as before", async () => {
		let stored = await model.set(key, response, 60000);
		assert.strictEqual(stored, true);
		assert.strictEqual(calls.filter((c) => c.op === "findOne").length, 0);
	});

	it("invalidateMatching records the invalidation before removing", async () => {
		deleted = 3;
		let removed = await model.invalidateMatching({ tenant: 'tenant1', service: 'spaces', api: 'GET /spaces', user: 'user-1' });
		assert.strictEqual(removed, 3);
		assert.deepStrictEqual(calls.map((c) => c.op), ['updateOne', 'deleteMany']);
		assert.strictEqual(calls[0].col, 'cache_invalidation');
		assert.deepStrictEqual(calls[0].condition, { l1: 'tenant1', service: 'spaces', api: 'GET /spaces', user: 'user-1' });
		assert.ok(calls[0].s.$set.clearedAt instanceof Date);
		assert.ok(calls[0].s.$set.expiresAt > calls[0].s.$set.clearedAt);
		assert.deepStrictEqual(calls[1].condition, { l1: 'tenant1', service: 'spaces', api: 'GET /spaces', user: 'user-1' });
	});

	it("invalidateMatching without api and user covers the whole service", async () => {
		await model.invalidateMatching({ tenant: 'tenant1', service: 'spaces' });
		assert.deepStrictEqual(calls[0].condition, { l1: 'tenant1', service: 'spaces', api: null, user: null });
		assert.deepStrictEqual(calls[1].condition, { l1: 'tenant1', service: 'spaces' });
	});
});
