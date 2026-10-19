'use strict';

/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

const get = (p, o) => p.reduce((xs, x) => (xs && xs[x]) ? xs[x] : null, o);
const mongo = require('./model/mongo.js');

const API_REGEX = /^GET \/\S*$/;

function isNonEmptyString(value) {
	return typeof value === 'string' && value.length > 0;
}

/**
 * Remove cached GET responses a service knows are out of date, called on the maintenance port.
 *
 * NOTE: only the mongo model is supported, it is the one shared by every gateway, the memory model
 *       is per gateway and meant for testing
 *
 * @param registry the gateway registry
 * @param input {tenant, service, api, user} tenant and service are required
 * @returns {Promise<{status: number, removed: number}|{status: number, error: string}>}
 */
async function invalidate(registry, input) {
	if (!input || typeof input !== 'object') {
		return { 'status': 400, 'error': 'A JSON body with tenant and service is required.' };
	}
	if (!isNonEmptyString(input.tenant) || !isNonEmptyString(input.service)) {
		return { 'status': 400, 'error': 'tenant and service are required.' };
	}
	if (input.api !== undefined && (!isNonEmptyString(input.api) || !API_REGEX.test(input.api))) {
		return { 'status': 400, 'error': 'api must be written as in the cache configuration, for example "GET /spaces".' };
	}
	if (input.user !== undefined && !isNonEmptyString(input.user)) {
		return { 'status': 400, 'error': 'user must be a user id.' };
	}

	const cacheConfig = get(["custom", "gateway", "value", "cache"], registry);
	if (!cacheConfig) {
		return { 'status': 400, 'error': 'Caching is not configured.' };
	}
	if (cacheConfig.model !== 'mongo') {
		return { 'status': 400, 'error': 'Cache invalidation needs the mongo model, the cache model is [' + (cacheConfig.model || 'memory') + '].' };
	}
	if (!mongo.mongo) {
		return { 'status': 500, 'error': 'The cache store is not ready.' };
	}

	try {
		const removed = await mongo.invalidateMatching({
			'tenant': input.tenant,
			'service': input.service,
			'api': input.api,
			'user': input.user
		});
		return { 'status': 200, 'removed': removed };
	} catch (e) {
		if (mongo.log) {
			mongo.log.error('Cache invalidate:', e.message);
		}
		return { 'status': 500, 'error': 'Cache invalidation failed.' };
	}
}

module.exports = invalidate;
