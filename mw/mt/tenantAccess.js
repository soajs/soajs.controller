"use strict";

/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

const { httpRequestLight } = require("../../lib/request.js");

const get = (p, o) => p.reduce((xs, x) => (xs && xs[x]) ? xs[x] : null, o);

const DEFAULT_TIMEOUT = 2000;

/**
 * Find the resolver that decides who can access the tenant of this request.
 *
 * NOTE: the tenant profile names the resolver, the urac custom registry defines what to call,
 *       so the call can move without touching every tenant
 *
 * @param soajs
 * @returns {null|{name, subject, service, version, method, api, timeout}}
 */
function getResolver(soajs) {
	let access = get(["tenant", "profile", "access"], soajs);
	if (!access || !access.resolver) {
		return null;
	}
	let resolver = get(["registry", "custom", "urac", "value", "tenantAccessResolvers", access.resolver], soajs);
	if (!resolver || !resolver.service || !resolver.api) {
		if (soajs.log && soajs.log.error) {
			soajs.log.error("Tenant access resolver [" + access.resolver + "] of tenant [" + soajs.tenant.code + "] is not defined in the urac custom registry");
		}
		return null;
	}
	return {
		"name": access.resolver,
		"subject": access.subject || null,
		"service": resolver.service,
		"version": resolver.version || null,
		"method": resolver.method || "post",
		"api": resolver.api,
		"timeout": resolver.timeout || DEFAULT_TIMEOUT
	};
}

/**
 * The service behind the resolver has not been through the gateway, give it the tenant and key
 * of this request the same way the gateway does, without any ACL or user
 *
 * @param soajs
 * @param serviceName
 * @returns {string}
 */
function buildInjectObj(soajs, serviceName) {
	let tenant = soajs.tenant;
	let injectObj = {
		"tenant": {
			"id": tenant.id,
			"name": tenant.name,
			"code": tenant.code,
			"locked": tenant.locked,
			"type": tenant.type
		},
		"key": {
			"config": {},
			"iKey": tenant.key.iKey,
			"eKey": tenant.key.eKey
		},
		"application": {
			"product": tenant.application.product,
			"package": tenant.application.package,
			"appId": tenant.application.appId
		}
	};
	if (tenant.main) {
		injectObj.tenant.main = tenant.main;
	}
	if (soajs.servicesConfig) {
		if (soajs.servicesConfig.commonFields) {
			injectObj.key.config.commonFields = soajs.servicesConfig.commonFields;
		}
		if (soajs.servicesConfig[serviceName]) {
			injectObj.key.config[serviceName] = soajs.servicesConfig[serviceName];
		}
	}
	return JSON.stringify(injectObj);
}

/**
 * Ask the resolver if the user has access to the tenant of this request and with what groups.
 *
 * NOTE: anything but a well formed yes is no access, the caller falls back to the urac driver
 *       so an invitation made after the token was issued still works
 *
 * @param soajs
 * @param user the user from the token
 * @param resolver from getResolver
 * @param cb (result) result is {groups, groupsConfig} or null
 */
function resolve(soajs, user, resolver, cb) {
	let done = (result) => {
		//NOTE: out of the promise, an error thrown further down must not come back here as a rejection
		process.nextTick(() => {
			return cb(result);
		});
	};
	let label = "Tenant access resolver [" + resolver.name + "] for user [" + user.username + "] and tenant [" + soajs.tenant.code + "]";

	if (!soajs.registry || !soajs.registry.services ||
		!soajs.registry.services[resolver.service] || !soajs.registry.services[resolver.service].port) {
		soajs.log.error(label + " failed, service [" + resolver.service + "] is not in the registry");
		return done(null);
	}
	soajs.awareness.getHost(resolver.service, resolver.version, (host) => {
		if (!host) {
			soajs.log.error(label + " failed, no host for [" + resolver.service + "@" + resolver.version + "]");
			return done(null);
		}
		let data = {
			"user": {
				"id": user.id || (user._id ? user._id.toString() : null),
				"username": user.username,
				"tenant": {
					"id": user.tenant.id,
					"code": user.tenant.code
				}
			},
			"tenant": {
				"id": soajs.tenant.id,
				"code": soajs.tenant.code
			},
			"subject": resolver.subject
		};
		if (soajs.tenant.main) {
			data.tenant.main = soajs.tenant.main;
		}
		httpRequestLight({
			"uri": "http://" + host + ":" + soajs.registry.services[resolver.service].port + resolver.api,
			"method": resolver.method,
			"data": data,
			"headers": { "soajsinjectobj": buildInjectObj(soajs, resolver.service) },
			"timeout": resolver.timeout
		}).then((response) => {
			let answer = (response && response.result === true) ? response.data : null;
			if (!answer || typeof answer !== "object") {
				soajs.log.error(label + " returned an invalid response");
				return done(null);
			}
			if (answer.access !== true) {
				return done(null);
			}
			if (!answer.groupsConfig || !answer.groupsConfig.allowedPackages || typeof answer.groupsConfig.allowedPackages !== "object") {
				soajs.log.error(label + " granted access without groupsConfig.allowedPackages");
				return done(null);
			}
			return done({
				"groups": Array.isArray(answer.groups) ? answer.groups : [],
				"groupsConfig": answer.groupsConfig
			});
		}).catch((error) => {
			soajs.log.error(label + " failed: " + error.message);
			return done(null);
		});
	});
}

module.exports = {
	"getResolver": getResolver,
	"resolve": resolve
};
