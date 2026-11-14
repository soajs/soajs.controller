"use strict";

const assert = require('assert');
const express = require('express');
const request = require('request');
const helper = require("../../helper.js");
let Controller = helper.requireModule('./server/controller');
let localConfig = helper.requireModule('./config.js');

//NOTE: the gateway only forwards the soajsinjectobj it builds, a header with that name sent by the
//		caller never reaches the service
const sentHeader = JSON.stringify({
	"tenant": {"id": "000000000000000000000000", "code": "SENT"},
	"key": {"iKey": "sent", "eKey": "sent", "config": {}},
	"application": {"product": "SENT", "package": "SENT_PACK"}
});
const dbtnId = "5c0e74ba9acc3c5a84a51259";

function echoApp() {
	const app = express();
	app.get('/headers', (req, res) => {
		res.json({"result": true, "data": {"soajsinjectobj": req.headers.soajsinjectobj || null}});
	});
	app.get('/heartbeat', (req, res) => {
		res.json({"result": true, "ts": Date.now(), "service": {"service": "echo", "type": "rest", "route": "/heartbeat"}});
	});
	return app;
}

//NOTE: echo is called without a key, echokey with one, each on its port and its maintenance port
function startEcho(callback) {
	let servers = [];
	let ports = [4016, 5017, 4017, 5018];
	let next = (i) => {
		if (i === ports.length) {
			return callback(servers);
		}
		servers.push(echoApp().listen(ports[i], () => {
			next(i + 1);
		}));
	};
	next(0);
}

function call(path, headers, cb) {
	request.get({
		"uri": 'http://127.0.0.1:' + localConfig.servicePort + path,
		"json": true,
		"headers": Object.assign({"soajsinjectobj": sentHeader}, headers)
	}, (error, response, body) => {
		assert.ifError(error);
		return cb(response, body);
	});
}

describe("Integration for Usecase 9 - the soajsinjectobj header", function () {
	let extKey = "3d90163cf9d6b3076ad26aa5ed58556348069258e5c6c941ee0f18448b570ad1c5c790e2d2a1989680c55f4904e2005ff5f8e71606e4aa641e67882f4210ebbc5460ff305dcb36e6ec2a2299cf0448ef60b9e38f41950ec251c1cf41f05f3ce9";

	let c = new Controller({
		"serviceName": localConfig.serviceName,
		"serviceVersion": localConfig.serviceVersion,
		"serviceGroup": localConfig.serviceGroup,
		"servicePort": localConfig.servicePort,
		"maintenance": localConfig.maintenance
	});
	let registry = null;
	let log = null;
	let service = null;
	let server = null;
	let serverMaintenance = null;
	let echo = null;

	before((done) => {
		startEcho((servers) => {
			echo = servers;
			c.init((_registry, _log, _service, _server, _serverMaintenance) => {
				registry = _registry;
				log = _log;
				service = _service;
				server = _server;
				serverMaintenance = _serverMaintenance;
				c.start(registry, log, service, server, serverMaintenance, () => {
					setTimeout(function () {
						done();
					}, 5000);
				});
			});
		});
	});

	it("a service called without a key receives no soajsinjectobj", function (done) {
		//NOTE: a key is sent though echo does not require one, mt builds no soajsinjectobj for it
		call('/echo/v1/headers', {"key": extKey}, (response, body) => {
			assert.ok(body);
			assert.strictEqual(body.result, true, JSON.stringify(body.errors));
			assert.strictEqual(body.data.soajsinjectobj, null);
			done();
		});
	});

	it("a service called with a key receives the soajsinjectobj the gateway built", function (done) {
		call('/echokey/v1/headers', {"key": extKey}, (response, body) => {
			assert.ok(body);
			assert.strictEqual(body.result, true, JSON.stringify(body.errors));
			assert.notStrictEqual(body.data.soajsinjectobj, sentHeader);
			let injectObj = JSON.parse(body.data.soajsinjectobj);
			assert.strictEqual(injectObj.tenant.id, dbtnId);
			assert.strictEqual(injectObj.tenant.code, "DBTN");
			assert.strictEqual(injectObj.key.eKey, extKey);
			done();
		});
	});

	it("roaming with a key answers the soajsinjectobj the gateway built", function (done) {
		call('/echokey/v1/headers', {"key": extKey, "soajsroaming": "true"}, (response, body) => {
			assert.ok(body);
			assert.strictEqual(body.result, true, JSON.stringify(body.errors));
			assert.ok(response.headers.soajsinjectobj);
			assert.notStrictEqual(response.headers.soajsinjectobj, sentHeader);
			assert.strictEqual(JSON.parse(response.headers.soajsinjectobj).tenant.id, dbtnId);
			done();
		});
	});

	it("roaming without a key answers no soajsinjectobj", function (done) {
		call('/echo/v1/headers', {"key": extKey, "soajsroaming": "true"}, (response, body) => {
			assert.ok(body);
			assert.strictEqual(body.result, true, JSON.stringify(body.errors));
			assert.strictEqual(response.headers.soajsinjectobj, undefined);
			done();
		});
	});

	after((done) => {
		echo.forEach((s) => {
			s.close();
		});
		c.stop(registry, log, service, server, serverMaintenance, () => {
			done();
		});
	});
});
