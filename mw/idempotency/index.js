'use strict';

/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

const get = (p, o) => p.reduce((xs, x) => (xs && xs[x]) ? xs[x] : null, o);
const memory = require('./model/memory.js');
const mongo = require('./model/mongo.js');

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

module.exports = function (configuration) {
	model.memory.init(configuration.log);
	model.mongo.init(configuration.log, configuration.gatewayDB);

	return (req, res, next) => {
		const idempotencyKey = req.headers['idempotency-key'];

		if (!idempotencyKey) {
			return next();
		}

		if (!isValidUUIDv4(idempotencyKey)) {
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
		const apiPath = req.soajs.controller.serviceParams.path;
		const method = req.method.toUpperCase();

		if (method === 'GET') {
			return next();
		}

		const idempotencyConfig = get(["soajs", "registry", "custom", "gateway", "value", "idempotency"], req);
		if (!idempotencyConfig) {
			return next();
		}

		const serviceConfig = idempotencyConfig[serviceName];
		if (!serviceConfig || !serviceConfig.enabled) {
			return next();
		}

		if (serviceConfig.apis && !matchesApi(method, apiPath, serviceConfig.apis)) {
			return next();
		}

		const modelType = idempotencyConfig.model || 'memory';
		if (!model[modelType]) {
			configuration.log.warn('Idempotency: Unknown model [' + modelType + ']. It can only be [memory || mongo]');
			return next();
		}

		const ttl = serviceConfig.ttl || 60000;
		const key = {
			'l1': req.soajs.tenant.id,
			'l2': idempotencyKey
		};

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

				const locked = await model[modelType].lock(key, ttl);
				if (!locked) {
					req.soajs.controllerResponse({
						'status': 409,
						'code': 181,
						'msg': 'Request with this Idempotency-Key is still being processed.'
					});
					return;
				}

				let responseData = {
					statusCode: 200,
					headers: {},
					body: ''
				};
				let bodyChunks = [];

				const originalWriteHead = res.writeHead.bind(res);
				const originalWrite = res.write.bind(res);
				const originalEnd = res.end.bind(res);

				res.writeHead = function (statusCode, headers) {
					responseData.statusCode = statusCode;
					if (headers) {
						responseData.headers = { ...headers };
					}
					return originalWriteHead(statusCode, headers);
				};

				res.write = function (chunk, encoding, callback) {
					if (chunk) {
						bodyChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
					}
					return originalWrite(chunk, encoding, callback);
				};

				res.end = function (chunk, encoding, callback) {
					if (chunk) {
						bodyChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
					}
					responseData.body = Buffer.concat(bodyChunks).toString('utf8');

					model[modelType].complete(key, responseData, ttl).catch((err) => {
						configuration.log.error('Idempotency complete error:', err);
					});

					return originalEnd(chunk, encoding, callback);
				};

				res.on('error', () => {
					model[modelType].unlock(key).catch((err) => {
						configuration.log.error('Idempotency unlock error:', err);
					});
				});

				next();
			} catch (err) {
				configuration.log.error('Idempotency error:', err);
				model[modelType].unlock(key).catch(() => {});
				next();
			}
		};

		processIdempotency();
	};
};
