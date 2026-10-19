"use strict";

const helper = require("../../../helper.js");
const invalidate = helper.requireModule('./mw/cache/invalidate');
const model = helper.requireModule('./mw/cache/model/mongo');
const assert = require('assert');

describe("Unit test for: mw - cache invalidate", () => {

	let received = null;
	let failure = null;
	let originalInvalidateMatching = null;
	let originalMongo = null;

	function registry(model) {
		return { custom: { gateway: { value: { cache: { model: model, services: {} } } } } };
	}

	before(() => {
		originalInvalidateMatching = model.invalidateMatching;
		originalMongo = model.mongo;
		model.mongo = {};
		model.invalidateMatching = async (criteria) => {
			received = criteria;
			if (failure) {
				throw failure;
			}
			return 2;
		};
	});
	after(() => {
		model.invalidateMatching = originalInvalidateMatching;
		model.mongo = originalMongo;
	});
	beforeEach(() => {
		received = null;
		failure = null;
	});

	it("removes the matching entries", async () => {
		let outcome = await invalidate(registry('mongo'), { tenant: 't1', service: 'spaces', api: 'GET /spaces', user: 'u1' });
		assert.deepStrictEqual(outcome, { status: 200, removed: 2 });
		assert.deepStrictEqual(received, { tenant: 't1', service: 'spaces', api: 'GET /spaces', user: 'u1' });
	});

	it("api and user are optional", async () => {
		let outcome = await invalidate(registry('mongo'), { tenant: 't1', service: 'spaces' });
		assert.strictEqual(outcome.status, 200);
		assert.deepStrictEqual(received, { tenant: 't1', service: 'spaces', api: undefined, user: undefined });
	});

	it("refuses the memory model", async () => {
		let outcome = await invalidate(registry('memory'), { tenant: 't1', service: 'spaces' });
		assert.strictEqual(outcome.status, 400);
		assert.ok(outcome.error.indexOf('mongo') !== -1);
		assert.strictEqual(received, null);
	});

	it("refuses when no model is set, memory is the default", async () => {
		let outcome = await invalidate(registry(undefined), { tenant: 't1', service: 'spaces' });
		assert.strictEqual(outcome.status, 400);
		assert.strictEqual(received, null);
	});

	it("refuses when caching is not configured", async () => {
		let outcome = await invalidate({ custom: {} }, { tenant: 't1', service: 'spaces' });
		assert.strictEqual(outcome.status, 400);
	});

	it("requires tenant and service", async () => {
		assert.strictEqual((await invalidate(registry('mongo'), null)).status, 400);
		assert.strictEqual((await invalidate(registry('mongo'), { service: 'spaces' })).status, 400);
		assert.strictEqual((await invalidate(registry('mongo'), { tenant: 't1' })).status, 400);
		assert.strictEqual(received, null);
	});

	it("requires the api as written in the configuration", async () => {
		assert.strictEqual((await invalidate(registry('mongo'), { tenant: 't1', service: 'spaces', api: '/spaces' })).status, 400);
		assert.strictEqual((await invalidate(registry('mongo'), { tenant: 't1', service: 'spaces', api: 'POST /spaces' })).status, 400);
		assert.strictEqual((await invalidate(registry('mongo'), { tenant: 't1', service: 'spaces', user: 42 })).status, 400);
		assert.strictEqual(received, null);
	});

	it("answers 500 when the store fails", async () => {
		failure = new Error("down");
		let outcome = await invalidate(registry('mongo'), { tenant: 't1', service: 'spaces' });
		assert.strictEqual(outcome.status, 500);
	});

	it("answers 500 when the store is not ready", async () => {
		model.mongo = null;
		try {
			let outcome = await invalidate(registry('mongo'), { tenant: 't1', service: 'spaces' });
			assert.strictEqual(outcome.status, 500);
		} finally {
			model.mongo = {};
		}
	});
});
