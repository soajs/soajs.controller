"use strict";

const helper = require("../../helper.js");
const assert = require('assert');

describe("Testing lib haNamespace", () => {
	let haNamespace;

	before((done) => {
		haNamespace = helper.requireModule('./lib/haNamespace.js');
		done();
	});

	it("the current deployer: the namespace string", (done) => {
		let deployer = {"type": "container", "selected": "container.kubernetes", "container": {"kubernetes": {"id": "x", "namespace": "soajs"}}};
		assert.strictEqual(haNamespace(deployer, "-suffix"), ".soajs");
		done();
	});

	it("the older deployer: namespace.default, and the suffix with perService", (done) => {
		let deployer = {"selected": "container.kubernetes.remote", "container": {"kubernetes": {"remote": {"namespace": {"default": "soajs"}}}}};
		assert.strictEqual(haNamespace(deployer, "-suffix"), ".soajs");
		deployer.container.kubernetes.remote.namespace.perService = true;
		assert.strictEqual(haNamespace(deployer, "-suffix"), ".soajs-suffix");
		done();
	});

	it("no namespace", (done) => {
		assert.strictEqual(haNamespace(null, "-s"), "");
		assert.strictEqual(haNamespace({"selected": "container.kubernetes", "container": {"kubernetes": {}}}, "-s"), "");
		assert.strictEqual(haNamespace({"selected": "container.kubernetes", "container": {}}, "-s"), "");
		assert.strictEqual(haNamespace({"selected": "container.kubernetes.x", "container": {"kubernetes": {}}}, "-s"), "");
		assert.strictEqual(haNamespace({"selected": "manual", "container": {}}, "-s"), "");
		done();
	});
});
