"use strict";

const helper = require("../../helper.js");
const assert = require('assert');
const http = require('http');

const shutdown = helper.requireModule('./lib/shutdown.js');

describe("Testing lib shutdown, the graceful stop", () => {
	let exits;
	let saved = process.env.SOAJS_SERVER_SHUTDOWN_TIMEOUT;

	beforeEach(() => {
		exits = [];
		shutdown._reset((code) => exits.push(code));
	});

	after(() => {
		if (saved === undefined) {
			delete process.env.SOAJS_SERVER_SHUTDOWN_TIMEOUT;
		} else {
			process.env.SOAJS_SERVER_SHUTDOWN_TIMEOUT = saved;
		}
		shutdown._reset();
	});

	let fakeServer = (order, name, delay) => ({
		"close": (cb) => {
			order.push("close " + name);
			setTimeout(() => {
				order.push("closed " + name);
				cb();
			}, delay);
		},
		"closeIdleConnections": () => {}
	});

	it("stops the servers, then runs the tasks in order with the signal, then exits 0", (done) => {
		let order = [];
		shutdown.addServer(fakeServer(order, "gateway", 30));
		shutdown.addServer(fakeServer(order, "maintenance", 10));
		shutdown.register("first", (signal, next) => {
			order.push("first " + signal);
			setTimeout(next, 5);
		});
		shutdown.register("second", (signal, next) => {
			order.push("second " + signal);
			next();
		});
		shutdown.stop("SIGTERM", (code) => {
			assert.strictEqual(code, 0);
			assert.deepStrictEqual(order, ["close gateway", "close maintenance", "closed maintenance", "closed gateway", "first SIGTERM", "second SIGTERM"]);
			setImmediate(() => {
				assert.deepStrictEqual(exits, [0]);
				done();
			});
		});
	});

	it("a second signal does not start another stop", (done) => {
		let runs = 0;
		shutdown.register("once", (signal, next) => {
			runs++;
			setTimeout(next, 20);
		});
		let first = shutdown.stop("SIGTERM");
		let second = shutdown.stop("SIGINT");
		assert.strictEqual(first, second);
		first.then(() => {
			setImmediate(() => {
				assert.strictEqual(runs, 1);
				assert.deepStrictEqual(exits, [0]);
				done();
			});
		});
	});

	it("real signals: a second SIGTERM or a SIGINT while stopping is ignored, the listeners stay", (done) => {
		let runs = 0;
		shutdown.register("slow", (signal, next) => {
			runs++;
			setTimeout(next, 50);
		});
		shutdown.install();
		let terms = process.listenerCount('SIGTERM');
		let ints = process.listenerCount('SIGINT');
		process.emit('SIGTERM', 'SIGTERM');
		process.emit('SIGTERM', 'SIGTERM');
		process.emit('SIGINT', 'SIGINT');
		assert.strictEqual(process.listenerCount('SIGTERM'), terms);
		assert.strictEqual(process.listenerCount('SIGINT'), ints);
		setTimeout(() => {
			assert.strictEqual(runs, 1);
			assert.deepStrictEqual(exits, [0]);
			done();
		}, 150);
	});

	it("exits after the timeout when something hangs", function (done) {
		this.timeout(5000);
		process.env.SOAJS_SERVER_SHUTDOWN_TIMEOUT = "1";
		shutdown.register("hangs", () => {});
		let start = Date.now();
		shutdown.stop("SIGTERM", (code) => {
			let elapsed = Date.now() - start;
			assert.strictEqual(code, 0);
			assert.ok(elapsed >= 900 && elapsed < 2500, "after " + elapsed + "ms");
			done();
		});
	});

	it("a task that throws does not stop the others", (done) => {
		let ran = false;
		shutdown.register("throws", () => {
			throw new Error("boom");
		});
		shutdown.register("after", (signal, next) => {
			ran = true;
			next();
		});
		shutdown.stop("SIGINT", () => {
			assert.ok(ran);
			done();
		});
	});

	it("real servers: an idle keep-alive connection does not hold the stop; a removed server is not waited for", (done) => {
		let server = http.createServer((req, res) => res.end("ok"));
		let other = {"close": () => assert.fail("a removed server is closed")};
		shutdown.addServer(other);
		shutdown.removeServer(other);
		server.listen(0, "127.0.0.1", () => {
			let agent = new http.Agent({"keepAlive": true});
			http.get({"port": server.address().port, "host": "127.0.0.1", "agent": agent}, (res) => {
				res.resume();
				res.on('end', () => {
					shutdown.addServer(server);
					let start = Date.now();
					shutdown.stop("SIGTERM", (code) => {
						assert.strictEqual(code, 0);
						assert.ok(Date.now() - start < 1000);
						agent.destroy();
						done();
					});
				});
			});
		});
	});
});
