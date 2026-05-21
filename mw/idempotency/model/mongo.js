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

const idempotency_store = 'idempotency_store';

let model = {
	'mongo': null,
	'log': null,

	'init': (log, dbConfiguration) => {
		model.log = log;
		if (!model.mongo) {
			model.mongo = new Mongo(dbConfiguration);
			model.mongo.createIndex(idempotency_store, { 'l1': 1, 'l2': 1 }, { unique: true }, (err, index) => {
				log.debug("Idempotency index: " + index + " created with error: " + err);
			});
			model.mongo.createIndex(idempotency_store, { 'expiresAt': 1 }, { expireAfterSeconds: 0 }, (err, index) => {
				log.debug("Idempotency TTL index: " + index + " created with error: " + err);
			});
		}
	},

	'get': async (key) => {
		let condition = {
			'l1': key.l1,
			'l2': key.l2
		};
		try {
			const entry = await model.mongo.findOne(idempotency_store, condition);
			if (!entry) {
				return null;
			}
			if (entry.expiresAt && Date.now() > entry.expiresAt.getTime()) {
				return null;
			}
			return entry;
		} catch (e) {
			model.log.error('Idempotency get:', e.message);
			return null;
		}
	},

	'lock': async (key, ttl) => {
		let condition = {
			'l1': key.l1,
			'l2': key.l2
		};
		try {
			const existing = await model.mongo.findOne(idempotency_store, condition);
			if (existing && existing.expiresAt && Date.now() <= existing.expiresAt.getTime()) {
				return false;
			}

			let doc = {
				'l1': key.l1,
				'l2': key.l2,
				'status': 'in_flight',
				'lockedAt': new Date(),
				'expiresAt': new Date(Date.now() + ttl)
			};
			let options = { 'upsert': true };
			let s = { '$set': doc };
			await model.mongo.updateOne(idempotency_store, condition, s, options);
			return true;
		} catch (e) {
			if (e.code === 11000) {
				return false;
			}
			model.log.error('Idempotency lock:', e.message);
			return false;
		}
	},

	'complete': async (key, response, ttl) => {
		let condition = {
			'l1': key.l1,
			'l2': key.l2
		};
		let doc = {
			'status': 'completed',
			'response': response,
			'completedAt': new Date(),
			'expiresAt': new Date(Date.now() + ttl)
		};
		let s = { '$set': doc };
		try {
			await model.mongo.updateOne(idempotency_store, condition, s, {});
		} catch (e) {
			model.log.error('Idempotency complete:', e.message);
		}
	},

	'unlock': async (key) => {
		let condition = {
			'l1': key.l1,
			'l2': key.l2
		};
		try {
			await model.mongo.deleteOne(idempotency_store, condition);
		} catch (e) {
			model.log.error('Idempotency unlock:', e.message);
		}
	}
};

module.exports = model;
