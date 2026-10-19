'use strict';

/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

const core = require('soajs.core.modules');
const Mongo = core.mongo;

const cache_store = 'cache_store';
const cache_invalidation = 'cache_invalidation';

//NOTE: an invalidation is remembered long enough to outlive any request that started before it,
//		so that request cannot store what it read before the change
const INVALIDATION_RETENTION = 15 * 60 * 1000;

let model = {
	'mongo': null,
	'log': null,

	'init': (log, dbConfiguration) => {
		model.log = log;
		if (!model.mongo) {
			model.mongo = new Mongo(dbConfiguration);
			model.mongo.createIndex(cache_store, { 'l1': 1, 'l2': 1 }, { unique: true }, (err, index) => {
				if (err) {
					log.error("Cache index creation failed: " + err.message);
				} else {
					log.debug("Cache index created: " + index);
				}
			});
			model.mongo.createIndex(cache_store, { 'expiresAt': 1 }, { expireAfterSeconds: 0 }, (err, index) => {
				if (err) {
					log.error("Cache TTL index creation failed: " + err.message);
				} else {
					log.debug("Cache TTL index created: " + index);
				}
			});
			model.mongo.createIndex(cache_store, { 'l1': 1, 'service': 1, 'api': 1, 'user': 1 }, {}, (err, index) => {
				if (err) {
					log.error("Cache invalidation lookup index creation failed: " + err.message);
				} else {
					log.debug("Cache invalidation lookup index created: " + index);
				}
			});
			model.mongo.createIndex(cache_invalidation, { 'l1': 1, 'service': 1, 'api': 1, 'user': 1 }, { unique: true }, (err, index) => {
				if (err) {
					log.error("Cache invalidation index creation failed: " + err.message);
				} else {
					log.debug("Cache invalidation index created: " + index);
				}
			});
			model.mongo.createIndex(cache_invalidation, { 'expiresAt': 1 }, { expireAfterSeconds: 0 }, (err, index) => {
				if (err) {
					log.error("Cache invalidation TTL index creation failed: " + err.message);
				} else {
					log.debug("Cache invalidation TTL index created: " + index);
				}
			});
		}
	},

	'get': async (key) => {
		let condition = {
			'l1': key.l1,
			'l2': key.l2
		};
		try {
			const entry = await model.mongo.findOne(cache_store, condition);
			if (!entry) {
				return null;
			}
			if (entry.expiresAt && Date.now() > entry.expiresAt.getTime()) {
				return null;
			}
			return entry;
		} catch (e) {
			model.log.error('Cache get:', e.message);
			return null;
		}
	},

	/**
	 * @param key {l1, l2}
	 * @param response {statusCode, headers, body}
	 * @param ttl
	 * @param meta {service, api, user, startedAt} what an invalidation matches on, user is null for a
	 *        tenant scoped entry
	 * @returns {Promise<boolean>} false when not stored
	 */
	'set': async (key, response, ttl, meta) => {
		let condition = {
			'l1': key.l1,
			'l2': key.l2
		};
		let doc = {
			'l1': key.l1,
			'l2': key.l2,
			'response': response,
			'cachedAt': new Date(),
			'expiresAt': new Date(Date.now() + ttl)
		};
		if (meta) {
			doc.service = meta.service;
			doc.api = meta.api;
			doc.user = meta.user || null;
		}
		let options = { 'upsert': true };
		let s = { '$set': doc };
		try {
			//NOTE: a request that started before an invalidation covering it may have read the data
			//		before the change, its response is passed on but not stored
			if (meta && meta.startedAt) {
				let invalidated = await model.mongo.findOne(cache_invalidation, {
					'l1': key.l1,
					'service': meta.service,
					'api': { '$in': [meta.api, null] },
					'user': { '$in': [doc.user, null] },
					'clearedAt': { '$gt': new Date(meta.startedAt) }
				});
				if (invalidated) {
					return false;
				}
			}
			await model.mongo.updateOne(cache_store, condition, s, options);
			return true;
		} catch (e) {
			model.log.error('Cache set:', e.message);
			return false;
		}
	},

	/**
	 * Remove every cached variant of the matching entries, all query strings and path params.
	 *
	 * NOTE: the invalidation is recorded before the entries are removed, a request that read before the
	 *       change and stores after the removal is caught by set
	 *
	 * @param criteria {tenant, service, api, user} api and user are optional, without them every api of
	 *        the service, for every user and the tenant scoped entries
	 * @returns {Promise<number>} the number of entries removed
	 */
	'invalidateMatching': async (criteria) => {
		let marker = {
			'l1': criteria.tenant,
			'service': criteria.service,
			'api': criteria.api || null,
			'user': criteria.user || null
		};
		let now = new Date();
		await model.mongo.updateOne(cache_invalidation, marker, {
			'$set': Object.assign({}, marker, {
				'clearedAt': now,
				'expiresAt': new Date(now.getTime() + INVALIDATION_RETENTION)
			})
		}, { 'upsert': true });

		let condition = {
			'l1': criteria.tenant,
			'service': criteria.service
		};
		if (criteria.api) {
			condition.api = criteria.api;
		}
		if (criteria.user) {
			condition.user = criteria.user;
		}
		let response = await model.mongo.deleteMany(cache_store, condition);
		return (response && response.deletedCount) || 0;
	},

	'invalidate': async (key) => {
		let condition = {
			'l1': key.l1,
			'l2': key.l2
		};
		try {
			await model.mongo.deleteOne(cache_store, condition);
		} catch (e) {
			model.log.error('Cache invalidate:', e.message);
		}
	},

	'invalidateTenant': async (tenantId) => {
		let condition = {
			'l1': tenantId
		};
		try {
			await model.mongo.deleteMany(cache_store, condition);
		} catch (e) {
			model.log.error('Cache invalidateTenant:', e.message);
		}
	}
};

module.exports = model;
