"use strict";

const helper = require("../../../helper.js");
const model = helper.requireModule('./mw/idempotency/model/mongo');
const assert = require('assert');

describe("Unit test for: mw - idempotency/model/mongo", () => {

	let calls = null;
	let originalMongo = null;

	before(() => {
		originalMongo = model.mongo;
		model.log = {
			debug: () => {},
			info: () => {},
			error: () => {}
		};
		model.mongo = {
			findOne: async (col, condition) => {
				calls.push({ "op": "findOne", "condition": condition });
				return null;
			},
			updateOne: async (col, condition, s, options) => {
				calls.push({ "op": "updateOne", "condition": condition, "s": s, "options": options });
			},
			deleteOne: async (col, condition) => {
				calls.push({ "op": "deleteOne", "condition": condition });
			}
		};
	});
	after(() => {
		model.mongo = originalMongo;
	});
	beforeEach(() => {
		calls = [];
	});

	it("lock stores the lockId", async () => {
		let locked = await model.lock({ l1: 'tenant1', l2: 'key1' }, 60000, 'lock-a');
		assert.strictEqual(locked, true);
		let update = calls.find((c) => c.op === "updateOne");
		assert.strictEqual(update.s.$set.status, 'in_flight');
		assert.strictEqual(update.s.$set.lockId, 'lock-a');
	});

	it("unlock removes only an own record in flight", async () => {
		await model.unlock({ l1: 'tenant1', l2: 'key1' }, 'lock-a');
		assert.deepStrictEqual(calls, [{
			"op": "deleteOne",
			"condition": { l1: 'tenant1', l2: 'key1', status: 'in_flight', lockId: 'lock-a' }
		}]);
	});

	it("unlock without a lockId still never removes a completed record", async () => {
		await model.unlock({ l1: 'tenant1', l2: 'key1' });
		assert.deepStrictEqual(calls, [{
			"op": "deleteOne",
			"condition": { l1: 'tenant1', l2: 'key1', status: 'in_flight' }
		}]);
	});
});
