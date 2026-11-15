'use strict';

/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

/**
 * Call events: with the custom registry gateway.events {enabled, sink, mongo {db, collection},
 * queueSize, services}, one event per request from the key step on, written off the request path.
 * The event carries identity and routing, its status and SOAJS code, how long it took; never
 * bodies, query values, headers, tokens or keys. A field the call does not have is left out.
 * Off, nothing changes. The document is the one the Go gateway writes (call_events).
 */

const crypto = require('crypto');
const emitter = require('./emitter.js');

const get = (p, o) => p.reduce((xs, x) => (xs && xs[x]) ? xs[x] : null, o);

/**
 * With services, only the services enabled emit; without it, every service does.
 */
function serviceOn(config, service) {
	if (!config.services || typeof config.services !== "object" || Array.isArray(config.services)) {
		return true;
	}
	let entry = config.services[service];
	return !!entry && entry.enabled === true;
}

/**
 * The route of an ACL that matches a path: the exact route, else the last route with a path
 * parameter whose expression matches.
 */
function routeOf(acl, path) {
	if (!acl || typeof path !== "string") {
		return null;
	}
	if (acl.apis && Object.hasOwnProperty.call(acl.apis, path)) {
		return path;
	}
	let route = null;
	if (Array.isArray(acl.apisRegExp)) {
		for (let i = 0; i < acl.apisRegExp.length; i++) {
			let api = acl.apisRegExp[i];
			if (api && api.regExp && api.route && path.match(api.regExp)) {
				route = api.route;
			}
		}
	}
	return route;
}

function str(value) {
	return (typeof value === "string" && value !== "") ? value : null;
}

/**
 * The signed-in user: from the user record when it was read, else from the token.
 */
function userOf(req) {
	let tokenUser = get(["oauth", "bearerToken", "user"], req);
	let user = {};
	let driver = req.soajs.uracDriver;
	if (driver) {
		if (str(driver.id)) {
			user.id = driver.id;
		}
		if (driver.bearerTokenUser) {
			tokenUser = driver.bearerTokenUser;
		}
		let profile = driver.getProfile();
		if (profile && str(profile.username)) {
			user.username = profile.username;
		}
	}
	if (tokenUser && typeof tokenUser === "object") {
		if (!user.id && str(tokenUser.id)) {
			user.id = tokenUser.id;
		}
		if (!user.username && str(tokenUser.username)) {
			user.username = tokenUser.username;
		}
		let restrictedTo = tokenUser.restrictedTo;
		if (restrictedTo && typeof restrictedTo === "object" && !Array.isArray(restrictedTo) && Object.keys(restrictedTo).length > 0) {
			user.agent = true;
		}
	}
	if (!user.id && !user.username && !user.agent) {
		return null;
	}
	return user;
}

module.exports = (configuration) => {
	let regEnvironment = (configuration.regEnvironment || process.env.SOAJS_ENV || "dev").toLowerCase();
	emitter.init(configuration.log, configuration.registry);

	/**
	 * The call event of a request that was answered.
	 */
	let eventOf = (req, res, marks, start, requestId) => {
		let sp = (req.soajs.controller && req.soajs.controller.serviceParams) || {};
		let event = {
			"ts": new Date(start),
			"durationMs": Math.max(0, Date.now() - start),
			"requestId": requestId,
			"env": regEnvironment
		};
		let tenant = req.soajs.tenant || get(["keyObj", "tenant"], sp);
		if (tenant && str(tenant.id)) {
			event.tenant = {"id": tenant.id, "code": tenant.code};
			if (tenant.main && str(tenant.main.id)) {
				event.tenant.main = {"id": tenant.main.id, "code": tenant.main.code};
			}
		}
		let application = get(["keyObj", "application"], sp);
		if (application) {
			["product", "package", "appId"].forEach((field) => {
				if (str(application[field])) {
					event[field] = application[field];
				}
			});
		}
		let user = userOf(req);
		if (user) {
			event.user = user;
		}
		let service = sp.name || sp.service_n;
		let version = sp.version || sp.service_v;
		let api = null;
		if (sp.gatewayApi) {
			api = sp.path;
		} else if (sp.proxy) {
			service = configuration.serviceName;
			version = configuration.serviceVersion;
			api = "/soajs/proxy";
		} else {
			// the ACL in effect: the user's when it applied, else the package's
			api = routeOf(sp.uracAclApplied ? sp.uracFinalAcl : sp.finalAcl, sp.path);
		}
		if (str(service)) {
			event.service = service;
		}
		if (version !== null && version !== undefined && version !== "") {
			event.version = String(version);
		}
		event.method = req.method;
		if (str(api)) {
			event.api = api;
		}
		if (str(marks.mcpTool)) {
			event.mcpTool = marks.mcpTool;
		}
		event.status = res.statusCode || 200;
		if (typeof marks.code === "number" && marks.code > 0) {
			event.code = marks.code;
		}
		if (marks.idempotency) {
			event.idempotency = marks.idempotency;
		}
		if (marks.cache) {
			event.cache = marks.cache;
		}
		let ip = req.getClientIP ? req.getClientIP() : null;
		if (str(ip)) {
			event.ip = ip;
		}
		return event;
	};

	return (req, res, next) => {
		let config = emitter.configOf(req.soajs.registry);
		if (!config) {
			return next();
		}
		let start = Date.now();
		let requestId = crypto.randomUUID();
		let marks = {};
		req.soajs.callEvent = marks;

		//NOTE: the SOAJS code of an answer the gateway gives, refusals and errors alike
		let respond = req.soajs.controllerResponse;
		req.soajs.controllerResponse = function (jsonObj) {
			if (jsonObj && typeof jsonObj.code === "number" && !marks.code) {
				marks.code = jsonObj.code;
			}
			return respond.apply(this, arguments);
		};

		let done = false;
		let finish = () => {
			if (done) {
				return;
			}
			done = true;
			let event = eventOf(req, res, marks, start, requestId);
			if (serviceOn(config, event.service)) {
				emitter.emit(event, config);
			}
		};
		res.once('finish', finish);
		res.once('close', finish);
		return next();
	};
};

module.exports.emitter = emitter;
module.exports.routeOf = routeOf;
module.exports.serviceOn = serviceOn;
