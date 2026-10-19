'use strict';

/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

const crypto = require('crypto');
const get = (p, o) => p.reduce((xs, x) => (xs && xs[x]) ? xs[x] : null, o);
const memory = require('./model/memory.js');
const mongo = require('./model/mongo.js');
const { logOnce } = require('../../lib/logOnce.js');

let model = { memory, mongo };

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUUIDv4(str) {
	return UUID_V4_REGEX.test(str);
}

function matchesApi(method, path, apis) {
	if (!apis || !Array.isArray(apis)) {
		return false;
	}
	const requestSignature = `${method} ${path}`;
	for (let api of apis) {
		if (api === requestSignature) {
			return true;
		}
		const [apiMethod, apiPath] = api.split(' ');
		if (apiMethod !== method) {
			continue;
		}
		const apiParts = apiPath.split('/');
		const pathParts = path.split('/');
		if (apiParts.length !== pathParts.length) {
			continue;
		}
		let matches = true;
		for (let i = 0; i < apiParts.length; i++) {
			if (apiParts[i].startsWith(':')) {
				continue;
			}
			if (apiParts[i] !== pathParts[i]) {
				matches = false;
				break;
			}
		}
		if (matches) {
			return true;
		}
	}
	return false;
}

/**
 * Release a key this request locked, only while it is still in flight and still ours
 * @param modelObj memory or mongo
 * @param key
 * @param lockId
 * @param log
 */
function unlock(modelObj, key, lockId, log) {
	Promise.resolve()
		.then(() => modelObj.unlock(key, lockId))
		.catch((err) => {
			log.error('Idempotency unlock:', err.message);
		});
}

module.exports = function (configuration) {
	model.memory.init(configuration.log);
	model.mongo.init(configuration.log, configuration.gatewayDB);

	return (req, res, next) => {
		const idempotencyKey = req.headers['idempotency-key'];

		// Validate format only when a key was actually provided. The decision on a
		// missing key is deferred until we know whether the target API enforces it.
		if (idempotencyKey && !isValidUUIDv4(idempotencyKey)) {
			req.soajs.controllerResponse({
				'status': 400,
				'code': 180,
				'msg': 'Invalid Idempotency-Key format. Expected UUID v4.'
			});
			return;
		}

		if (!req.soajs || !req.soajs.tenant || !req.soajs.controller || !req.soajs.controller.serviceParams) {
			return next();
		}

		const serviceName = req.soajs.controller.serviceParams.name;
		// Strip service prefix from pathname to get API path (e.g., /console/registry -> /registry)
		const serviceInfo = req.soajs.controller.serviceParams.serviceInfo;
		const apiPath = "/" + serviceInfo.slice(2).join("/");
		const method = req.method.toUpperCase();

		if (method === 'GET') {
			return next();
		}

		const idempotencyConfig = get(["soajs", "registry", "custom", "gateway", "value", "idempotency"], req);
		if (!idempotencyConfig) {
			return next();
		}

		const serviceConfig = idempotencyConfig.services && idempotencyConfig.services[serviceName];
		if (!serviceConfig || !serviceConfig.enabled) {
			return next();
		}

		if (serviceConfig.apis && !matchesApi(method, apiPath, serviceConfig.apis)) {
			return next();
		}

		// Request targets an idempotency-enabled and matched API. Resolve enforcement:
		// service-level 'enforce' overrides the global default.
		const enforce = (typeof serviceConfig.enforce === 'boolean') ? serviceConfig.enforce : (idempotencyConfig.enforce === true);

		if (!idempotencyKey) {
			if (enforce) {
				req.soajs.controllerResponse({
					'status': 428,
					'code': 182,
					'msg': 'Idempotency-Key header is required for this API.'
				});
				return;
			}
			return next();
		}

		const modelType = idempotencyConfig.model || 'memory';
		if (!model[modelType]) {
			logOnce(configuration.log, "error", "idempotency_model_" + modelType,
				'Idempotency: Unknown model [' + modelType + ']. It can only be [memory || mongo]. Idempotency is off.');
			return next();
		}

		const ttl = serviceConfig.ttl || 60000;
		const key = {
			'l1': req.soajs.tenant.id,
			'l2': idempotencyKey
		};

		let lockId = null;
		const processIdempotency = async () => {
			try {
				const existing = await model[modelType].get(key);

				if (existing) {
					if (existing.status === 'in_flight') {
						req.soajs.controllerResponse({
							'status': 409,
							'code': 181,
							'msg': 'Request with this Idempotency-Key is still being processed.'
						});
						return;
					}

					if (existing.status === 'completed' && existing.response) {
						res.writeHead(existing.response.statusCode, existing.response.headers);
						res.end(existing.response.body);
						return;
					}
				}

				lockId = crypto.randomUUID();
				const locked = await model[modelType].lock(key, ttl, lockId);
				if (!locked) {
					req.soajs.controllerResponse({
						'status': 409,
						'code': 181,
						'msg': 'Request with this Idempotency-Key is still being processed.'
					});
					return;
				}

				// Store idempotency context for gotoService to use
				const context = {
					key: key,
					ttl: ttl,
					lockId: lockId,
					modelType: modelType,
					model: model[modelType],
					log: configuration.log,
					proxied: false
				};
				req.soajs.idempotencyContext = context;

				//NOTE: a request answered before it reaches the service, throttled, refused or dropped by
				//		the client, must not keep the key in flight until the ttl, release it once the response
				//		is over. A proxied request is completed or released by gotoService, never here.
				let released = false;
				const release = () => {
					if (released || context.proxied) {
						return;
					}
					released = true;
					unlock(model[modelType], key, lockId, configuration.log);
				};
				res.on('finish', release);
				res.on('close', release);

				next();
			} catch (err) {
				configuration.log.error('Idempotency error:', err);
				if (lockId) {
					unlock(model[modelType], key, lockId, configuration.log);
				}
				next();
			}
		};

		processIdempotency();
	};
};

// Export model for external use
module.exports.model = model;
module.exports.unlock = unlock;
