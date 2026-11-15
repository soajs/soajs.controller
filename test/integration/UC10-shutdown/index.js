"use strict";

/**
 * The graceful stop of a gateway running as its own process (lib/shutdown.js): on SIGTERM it
 * stops accepting connections, lets the request in flight finish, runs its cleanup and exits 0.
 */

const assert = require('assert');
const http = require('http');
const path = require('path');
const childProcess = require('child_process');

const ROOT = path.join(__dirname, "..", "..", "..");
const EXT_KEY = "3d90163cf9d6b3076ad26aa5ed58556348069258e5c6c941ee0f18448b570ad1c5c790e2d2a1989680c55f4904e2005ff5f8e71606e4aa641e67882f4210ebbc5460ff305dcb36e6ec2a2299cf0448ef60b9e38f41950ec251c1cf41f05f3ce9";
const TOKEN = "cfb209a91b23896820f510aadbf1f4284b512123";
const TIMEOUT_S = 5;

// every gateway the tests start, killed in the end if a test left one running
let children = [];

function startGateway() {
	let child = childProcess.spawn(process.execPath, [path.join(ROOT, "index.js")], {
		"cwd": ROOT,
		"env": Object.assign({}, process.env, {"SOAJS_SERVER_SHUTDOWN_TIMEOUT": String(TIMEOUT_S), "SOAJS_SRVIP": "127.0.0.1"}),
		"stdio": ["ignore", "ignore", "ignore"]
	});
	children.push(child);
	child.exited = new Promise((resolve) => child.on('exit', (code, signal) => resolve({"code": code, "signal": signal, "at": Date.now()})));
	return child;
}

function get(url, headers) {
	return new Promise((resolve, reject) => {
		let req = http.get(url, {"headers": headers || {}}, (res) => {
			let body = "";
			res.on('data', (c) => {
				body += c;
			});
			res.on('end', () => resolve({"status": res.statusCode, "body": body}));
		});
		req.on('error', reject);
	});
}

// the gateway port answers (it listens once the graceful stop is installed); the maintenance port
// is not used, another program may hold it on a developer machine
function ready(deadline) {
	return get("http://127.0.0.1:4000/").then(() => true).catch(() => {
		if (Date.now() > deadline) {
			throw new Error("the gateway did not start");
		}
		return new Promise((r) => setTimeout(r, 200)).then(() => ready(deadline));
	});
}

describe("Integration for Usecase 10: the graceful stop", function () {
	this.timeout(60000);

	after(() => {
		children.forEach((child) => {
			if (child.exitCode === null && child.signalCode === null) {
				child.kill('SIGKILL');
			}
		});
	});

	it("an idle gateway exits 0 on SIGTERM, within the timeout", () => {
		let child = startGateway();
		return ready(Date.now() + 30000).then(() => {
			let sent = Date.now();
			child.kill('SIGTERM');
			return child.exited.then((exit) => {
				assert.strictEqual(exit.code, 0, JSON.stringify(exit));
				assert.ok(exit.at - sent < TIMEOUT_S * 1000, "exited after " + (exit.at - sent) + "ms");
			});
		});
	});

	it("a request in flight is answered before the gateway exits 0", () => {
		let received = null;
		let gotRequest = new Promise((r) => {
			received = r;
		});
		// a service that answers 1.5s after it got the request
		let slow = http.createServer((req, res) => {
			received();
			setTimeout(() => {
				res.writeHead(200, {"Content-Type": "application/json"});
				res.end(JSON.stringify({"result": true, "data": {"slow": true}}));
			}, 1500);
		});
		let child = null;
		return new Promise((r) => slow.listen(0, "127.0.0.1", r)).then(() => {
			child = startGateway();
			return ready(Date.now() + 30000);
		}).then(() => {
			let route = encodeURIComponent("http://127.0.0.1:" + slow.address().port + "/slow");
			let answer = get("http://127.0.0.1:4000/soajs/proxy?proxyRoute=" + route + "&access_token=" + TOKEN, {"key": EXT_KEY});
			// a call that fails before reaching the service ends the test instead of waiting
			return Promise.race([gotRequest, answer.then((res) => {
				throw new Error("answered before reaching the service: " + res.status + " " + res.body);
			})]).then(() => {
				let sent = Date.now();
				child.kill('SIGTERM');
				return Promise.all([answer, child.exited]).then((results) => {
					let res = results[0];
					let exit = results[1];
					assert.strictEqual(res.status, 200, res.body);
					assert.deepStrictEqual(JSON.parse(res.body).data, {"slow": true});
					assert.strictEqual(exit.code, 0, JSON.stringify(exit));
					assert.ok(exit.at - sent < TIMEOUT_S * 1000, "exited after " + (exit.at - sent) + "ms");
				});
			});
		}).finally(() => {
			slow.close();
			if (child && child.exitCode === null) {
				child.kill('SIGKILL');
			}
		});
	});
});
