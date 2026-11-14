"use strict";

const helper = require("../../../helper.js");
const assert = require('assert');

describe("Testing awareness custom round-robin", () => {
	let custom;

	before((done) => {
		custom = helper.requireModule('./mw/awareness/custom.js');
		done();
	});

	it("takes the healthy hosts in turn", (done) => {
		let hosts = ["h1", "h2", "h3"];
		let healthy = ["h1", "h3"];
		let first = custom.nextHealthyHost(hosts, healthy, 0);
		assert.deepStrictEqual(first, {"host": "h1", "index": 1});
		let second = custom.nextHealthyHost(hosts, healthy, first.index);
		assert.deepStrictEqual(second, {"host": "h3", "index": 0});
		let third = custom.nextHealthyHost(hosts, healthy, second.index);
		assert.strictEqual(third.host, "h1");
		done();
	});

	it("an index past the hosts starts over", (done) => {
		assert.strictEqual(custom.nextHealthyHost(["h1", "h2"], ["h2"], 7).host, "h2");
		done();
	});

	it("makes one pass, then no host, when no listed host is healthy", (done) => {
		// healthy holds a host the registry no longer lists
		let picked = custom.nextHealthyHost(["h1", "h2"], ["gone"], 1);
		assert.strictEqual(picked.host, null);
		assert.strictEqual(custom.nextHealthyHost([], ["h1"], 0).host, null);
		assert.strictEqual(custom.nextHealthyHost(["h1"], undefined, 0).host, null);
		done();
	});

	it("keeps only the healthy hosts the registry still lists", (done) => {
		let healthy = {"1": ["h1", "gone"], "2": ["h2"]};
		custom.pruneHealthy(healthy, {"latest": "1", "1": ["h1", "h4"]});
		assert.deepStrictEqual(healthy, {"1": ["h1"], "2": []});
		custom.pruneHealthy(null, {});
		let all = {"1": ["h1"]};
		custom.pruneHealthy(all, null);
		assert.deepStrictEqual(all, {"1": []});
		done();
	});
});
