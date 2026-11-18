"use strict";

const assert = require("assert");
const helper = require("../../../helper.js");
const scenarios = require("./kubeScenarios.js");
const fake = require("./kubeFake.js");
const recorded = require("../../../data/kubernetes/driver-outputs.json");

describe("Testing the Kubernetes driver", () => {

	const driver = helper.requireModule("./modules/driver/kubernetes/model/index.js");
	const supported = driver.supported(process.versions.node);

	it("needs Node.js 22.19 or later, and says so", (done) => {
		assert.strictEqual(driver.supported("22.18.0"), false);
		assert.strictEqual(driver.supported("22.19.0"), true);
		assert.strictEqual(driver.supported("23.0.0"), true);
		assert.strictEqual(driver.supported("20.19.0"), false);
		if (supported) {
			return done();
		}
		driver.connect({"namespace": "soajs", "token": "t", "url": "http://127.0.0.1:9"}, (error, client) => {
			assert.strictEqual(error && error.message, "Kubernetes driver needs Node.js 22.19 or later");
			assert.ok(!client);
			done();
		});
	});

	// The recording was made with the driver on kubernetes-client 9.0.0 (kubeRecord.js): the
	// driver on @kubernetes/client-node gives the business logic the same results and errors, and
	// sends the cluster the same requests (path, query, Authorization).
	it("gives what kubernetes-client 9.0.0 gave, for every call", function (done) {
		if (!supported) {
			return this.skip();
		}
		scenarios.run((results) => {
			const got = JSON.parse(JSON.stringify(results));
			assert.deepStrictEqual(Object.keys(got).sort(), Object.keys(recorded).sort());
			for (const name of Object.keys(recorded)) {
				assert.deepStrictEqual(got[name], recorded[name], name);
			}
			done();
		});
	});

	it("refuses a cluster whose certificate the ca block does not trust", function (done) {
		if (!supported) {
			return this.skip();
		}
		fake.start((server) => {
			// another self-signed certificate for 127.0.0.1, not the one the server presents
			const other = require("fs").readFileSync(require("path").join(__dirname, "../../../data/kubernetes/test-other.crt")).toString();
			driver.connect({"namespace": "soajs", "token": "t", "url": "x", "ca": {"requestOptions": {"baseUrl": server.secureUrl, "ca": other}, "authProvider": {"type": null}}}, (error, client) => {
				const finish = (err) => server.close(() => done(err));
				if (error) {
					return finish();
				}
				driver.get.all.service(client, {"namespace": "soajs"}, (err, result) => {
					try {
						assert.ok(err, "an error, not " + JSON.stringify(result));
						assert.strictEqual(server.seen.length, 0, "no request reaches the cluster");
						finish();
					} catch (e) {
						finish(e);
					}
				});
			});
		});
	});

	it("says why it cannot reach the cluster", function (done) {
		if (!supported) {
			return this.skip();
		}
		// a port nothing listens on
		const probe = require("net").createServer().listen(0, "127.0.0.1", () => {
			const port = probe.address().port;
			probe.close(() => {
				driver.connect({"namespace": "soajs", "token": "t", "url": "http://127.0.0.1:" + port}, (error, client) => {
					assert.ifError(error);
					driver.get.nodes(client, {}, (err) => {
						try {
							assert.ok(err && /ECONNREFUSED/.test(err.message), err && err.message);
							done();
						} catch (e) {
							done(e);
						}
					});
				});
			});
		});
	});

	// the client is imported by connect, never during another module's evaluation: once the
	// gateway's modules are all loaded, a new connection still works
	it("connects once the gateway's modules are loaded", function (done) {
		if (!supported) {
			return this.skip();
		}
		helper.requireModule("./server/controller.js");
		helper.requireModule("./mw/awareness/index.js");
		const again = helper.requireModule("./modules/driver/index.js");
		again.init();
		fake.start((server) => {
			again.kubernetes.get.nodes({"log": {"error": () => {}}}, {"configuration": {"namespace": "soajs", "token": "t", "url": server.url}}, null, (error, nodes) => {
				server.close(() => {
					try {
						assert.ifError(error);
						assert.deepStrictEqual(JSON.parse(JSON.stringify(nodes)), recorded["token nodes"].result);
						done();
					} catch (e) {
						done(e);
					}
				});
			});
		});
	});
});
