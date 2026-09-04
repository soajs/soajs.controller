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

const { resolveMembership } = helper.requireModule('./lib/membership.js');

describe("Unit test for: lib - membership", () => {

	const CONFIG = {
		"active": true,
		"AVAPP": ["CLUBS", "CORPS", "SECRT", "GRPCH"]
	};
	const MEMBERSHIPS = [{ "product": "AVAPP", "membership": "whale" }];

	describe("resolving", () => {

		it("resolves when the request is made under the main product", (done) => {
			assert.strictEqual(resolveMembership(CONFIG, "AVAPP", MEMBERSHIPS), "whale");
			done();
		});

		it("resolves when the request is made under a sub product", (done) => {
			["CLUBS", "CORPS", "SECRT", "GRPCH"].forEach((sub) => {
				assert.strictEqual(resolveMembership(CONFIG, sub, MEMBERSHIPS), "whale", "failed for " + sub);
			});
			done();
		});

		it("resolves the main product itself when it has no sub products", (done) => {
			assert.strictEqual(resolveMembership({ "active": true, "AVAPP": [] }, "AVAPP", MEMBERSHIPS), "whale");
			done();
		});

		it("picks the entry for the resolved main product, not the first one", (done) => {
			let memberships = [
				{ "product": "OTHER", "membership": "minnow" },
				{ "product": "AVAPP", "membership": "whale" }
			];
			assert.strictEqual(resolveMembership(CONFIG, "CLUBS", memberships), "whale");
			done();
		});

		it("keeps several main products independent", (done) => {
			let config = {
				"active": true,
				"AVAPP": ["CLUBS"],
				"BVAPP": ["BOATS"]
			};
			let memberships = [
				{ "product": "AVAPP", "membership": "whale" },
				{ "product": "BVAPP", "membership": "dolphin" }
			];
			assert.strictEqual(resolveMembership(config, "CLUBS", memberships), "whale");
			assert.strictEqual(resolveMembership(config, "BOATS", memberships), "dolphin");
			done();
		});
	});

	describe("failing closed", () => {

		it("resolves nothing when the block is absent", (done) => {
			assert.strictEqual(resolveMembership(null, "AVAPP", MEMBERSHIPS), null);
			assert.strictEqual(resolveMembership(undefined, "AVAPP", MEMBERSHIPS), null);
			done();
		});

		it("resolves nothing when active is not set", (done) => {
			assert.strictEqual(resolveMembership({ "AVAPP": ["CLUBS"] }, "AVAPP", MEMBERSHIPS), null);
			done();
		});

		it("resolves nothing when active is false", (done) => {
			assert.strictEqual(resolveMembership({ "active": false, "AVAPP": ["CLUBS"] }, "CLUBS", MEMBERSHIPS), null);
			done();
		});

		it("resolves nothing when no product is configured", (done) => {
			assert.strictEqual(resolveMembership({ "active": true }, "AVAPP", MEMBERSHIPS), null);
			done();
		});

		it("resolves nothing for a product that is neither main nor sub", (done) => {
			assert.strictEqual(resolveMembership(CONFIG, "UNRELATED", MEMBERSHIPS), null);
			done();
		});

		it("resolves nothing when the user holds no entry for the main product", (done) => {
			let memberships = [{ "product": "OTHER", "membership": "minnow" }];
			assert.strictEqual(resolveMembership(CONFIG, "CLUBS", memberships), null);
			done();
		});

		it("resolves nothing when the user has no memberships", (done) => {
			assert.strictEqual(resolveMembership(CONFIG, "AVAPP", null), null);
			assert.strictEqual(resolveMembership(CONFIG, "AVAPP", []), null);
			assert.strictEqual(resolveMembership(CONFIG, "AVAPP", undefined), null);
			done();
		});

		it("resolves nothing when the request carries no product", (done) => {
			assert.strictEqual(resolveMembership(CONFIG, null, MEMBERSHIPS), null);
			done();
		});

		it("matches product codes exactly, a miscased code does not resolve", (done) => {
			assert.strictEqual(resolveMembership(CONFIG, "clubs", MEMBERSHIPS), null);
			assert.strictEqual(resolveMembership(CONFIG, "AVAPP", [{ "product": "avapp", "membership": "whale" }]), null);
			done();
		});
	});

	describe("malformed input", () => {

		it("survives a memberships array holding junk", (done) => {
			let memberships = [null, "whale", { "product": "AVAPP" }, { "membership": "whale" }];
			assert.strictEqual(resolveMembership(CONFIG, "AVAPP", memberships), null);
			done();
		});

		it("skips an entry with no membership name and keeps looking", (done) => {
			let memberships = [{ "product": "AVAPP" }, { "product": "AVAPP", "membership": "whale" }];
			assert.strictEqual(resolveMembership(CONFIG, "AVAPP", memberships), "whale");
			done();
		});

		it("survives a sub product list that is not an array", (done) => {
			assert.strictEqual(resolveMembership({ "active": true, "AVAPP": "CLUBS" }, "CLUBS", MEMBERSHIPS), null);
			assert.strictEqual(resolveMembership({ "active": true, "AVAPP": "CLUBS" }, "AVAPP", MEMBERSHIPS), "whale");
			done();
		});

		it("does not treat active as a product", (done) => {
			assert.strictEqual(resolveMembership({ "active": true }, "active", [{ "product": "active", "membership": "x" }]), null);
			done();
		});
	});
});
