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

	'set': async (key, response, ttl) => {
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
		let options = { 'upsert': true };
		let s = { '$set': doc };
		try {
			await model.mongo.updateOne(cache_store, condition, s, options);
		} catch (e) {
			model.log.error('Cache set:', e.message);
		}
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
