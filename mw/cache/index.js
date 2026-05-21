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

let model = { memory, mongo };

function hashQuery(query) {
	if (!query || Object.keys(query).length === 0) {
		return '';
	}
	const sortedQuery = Object.keys(query).sort().reduce((obj, key) => {
		obj[key] = query[key];
		return obj;
	}, {});
	return crypto.createHash('md5').update(JSON.stringify(sortedQuery)).digest('hex');
}

function matchesApi(method, path, apis) {
	if (!apis || typeof apis !== 'object') {
		return null;
	}
	const requestSignature = `${method} ${path}`;

	if (apis[requestSignature]) {
		return apis[requestSignature];
	}

	for (const api in apis) {
		if (apis.hasOwnProperty(api)) {
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
				return apis[api];
			}
		}
	}
	return null;
}

module.exports = function (configuration) {
	model.memory.init(configuration.log);
	model.mongo.init(configuration.log, configuration.gatewayDB);

	return (req, res, next) => {
		if (req.method.toUpperCase() !== 'GET') {
			return next();
		}

		if (!req.soajs || !req.soajs.tenant || !req.soajs.controller || !req.soajs.controller.serviceParams) {
			return next();
		}

		const serviceName = req.soajs.controller.serviceParams.name;
		const apiPath = req.soajs.controller.serviceParams.path;
		const method = req.method.toUpperCase();

		const cacheConfig = get(["soajs", "registry", "custom", "gateway", "value", "cache"], req);
		if (!cacheConfig) {
			return next();
		}

		const serviceConfig = cacheConfig[serviceName];
		if (!serviceConfig || !serviceConfig.enabled) {
			return next();
		}

		const apiConfig = matchesApi(method, apiPath, serviceConfig.apis);
		if (!apiConfig || !apiConfig.enabled) {
			return next();
		}

		const modelType = cacheConfig.model || 'memory';
		if (!model[modelType]) {
			configuration.log.warn('Cache: Unknown model [' + modelType + ']. It can only be [memory || mongo]');
			return next();
		}

		const ttl = apiConfig.ttl || cacheConfig.defaultTTL || 300000;
		const queryHash = hashQuery(req.query);
		const key = {
			'l1': req.soajs.tenant.id,
			'l2': `${serviceName}:GET:${apiPath}:${queryHash}`
		};

		const processCache = async () => {
			try {
				const cached = await model[modelType].get(key);

				if (cached && cached.response) {
					res.setHeader('X-Cache', 'HIT');
					res.setHeader('X-Cache-Age', Math.floor((Date.now() - cached.cachedAt) / 1000));
					res.writeHead(cached.response.statusCode, cached.response.headers);
					res.end(cached.response.body);
					return;
				}

				res.setHeader('X-Cache', 'MISS');

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
						const filteredHeaders = { ...headers };
						delete filteredHeaders['X-Cache'];
						delete filteredHeaders['X-Cache-Age'];
						responseData.headers = filteredHeaders;
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

					if (responseData.statusCode >= 200 && responseData.statusCode < 300) {
						model[modelType].set(key, responseData, ttl).catch((err) => {
							configuration.log.error('Cache set error:', err);
						});
					}

					return originalEnd(chunk, encoding, callback);
				};

				next();
			} catch (err) {
				configuration.log.error('Cache error:', err);
				next();
			}
		};

		processCache();
	};
};
