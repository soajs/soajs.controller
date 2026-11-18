"use strict";

/**
 * The calls the gateway makes through the Kubernetes driver, run against the fake API server.
 * Each scenario gives what the business logic gets back (error or result) and the requests the
 * cluster received, so the recording of the driver on kubernetes-client 9.0.0 can be compared
 * with the driver on @kubernetes/client-node.
 */

const fake = require("./kubeFake.js");
const helper = require("../../../helper.js");
const BL = helper.requireModule("./modules/driver/index.js");

const soajs = {"log": {"error": () => {}, "debug": () => {}}};

// the token over HTTP without verification; the ca block (as soajs.infra writes it) over HTTPS,
// verified with the cluster's CA
function configurations(server) {
	return {
		"token": {"namespace": "soajs", "token": "test-token-1", "url": server.url},
		"ca": {
			"namespace": "soajs", "token": "test-token-2", "url": "http://unused.invalid",
			"ca": {"requestOptions": {"baseUrl": server.secureUrl, "ca": server.ca}, "authProvider": {"type": null}}
		},
		"ca-own-auth": {
			"namespace": "soajs", "token": "test-token-3", "url": server.url,
			"ca": {"requestOptions": {"baseUrl": server.secureUrl, "ca": server.ca, "auth": {"bearer": "own-bearer"}}, "authProvider": {"type": null}}
		}
	};
}

// plain JSON, as the business logic would pass it on
function plain(err, result) {
	const out = {};
	if (err) {
		out.error = err instanceof Error ? {"message": err.message} : JSON.parse(JSON.stringify(err));
	}
	if (result !== undefined && result !== null) {
		out.result = JSON.parse(JSON.stringify(result));
	}
	return out;
}

function run(cb) {
	BL.init();
	const k8s = BL.kubernetes;
	fake.start((server) => {
		const results = {};
		const steps = [];
		const add = (name, mode, fn) => steps.push({name, mode, fn});
		for (const [cname, configuration] of Object.entries(configurations(server))) {
			add(cname + " all", "ok", (done) => k8s.get.all(soajs, {configuration}, null, done));
			add(cname + " all with filter", "ok", (done) => k8s.get.all(soajs, {configuration, "filter": {"limit": 50}}, null, done));
			add(cname + " latest version", "ok", (done) => k8s.get.item_latestVersion(soajs, {configuration, "itemName": "urac"}, null, done));
			add(cname + " latest version unknown", "ok", (done) => k8s.get.item_latestVersion(soajs, {configuration, "itemName": "nope"}, null, done));
			add(cname + " host", "ok", (done) => k8s.get.host(soajs, {configuration, "item": {"name": "urac", "version": "3", "env": "dev"}}, null, done));
			add(cname + " host not found", "ok", (done) => k8s.get.host(soajs, {configuration, "item": {"name": "ghost", "version": "1", "env": "dev"}}, null, done));
			add(cname + " nodes", "ok", (done) => k8s.get.nodes(soajs, {configuration}, null, done));
			add(cname + " all forbidden", "forbidden", (done) => k8s.get.all(soajs, {configuration}, null, done));
			add(cname + " all empty", "empty", (done) => k8s.get.all(soajs, {configuration}, null, done));
		}
		const token = configurations(server).token;
		// the driver itself, as the business logic calls it
		add("driver services", "ok", (done) => k8s.driver.connect(token, (e, client) => e ? done(e) : k8s.driver.get.all.service(client, {"namespace": "soajs", "filter": {"labelSelector": "soajs.service.name=urac"}}, done)));
		add("driver one service", "ok", (done) => k8s.driver.connect(token, (e, client) => e ? done(e) : k8s.driver.get.one.service(client, {"namespace": "soajs", "name": "dev-oauth-v1-service"}, done)));
		add("driver service ips load balancer", "ok", (done) => k8s.driver.connect(token, (e, client) => e ? done(e) : k8s.driver.get.serviceIps(client, {"namespace": "soajs", "name": "dev-oauth-v1-service"}, done)));
		add("driver nodes", "ok", (done) => k8s.driver.connect(token, (e, client) => e ? done(e) : k8s.driver.get.nodes(client, {"filter": {"labelSelector": "kubernetes.io/hostname=node-a"}}, done)));
		add("driver no token", "ok", (done) => k8s.driver.connect({"url": server.url}, done));
		add("driver no url", "ok", (done) => k8s.driver.connect({"token": "t"}, done));
		add("configuration missing", "ok", (done) => k8s.get.all(soajs, {"configuration": {"namespace": "soajs"}}, null, done));

		let i = 0;
		const next = () => {
			if (i >= steps.length) {
				return server.close(() => cb(results));
			}
			const step = steps[i++];
			server.setMode(step.mode);
			server.seen.length = 0;
			step.fn((err, result) => {
				const out = plain(err, result);
				out.requests = server.seen.slice();
				results[step.name] = out;
				setImmediate(next);
			});
		};
		next();
	});
}

module.exports = {run};
