'use strict';

/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

let dataHolder = {};
let cleanupInterval = null;

let model = {
	'log': null,

	'init': (log) => {
		model.log = log;
		dataHolder = {};

		if (cleanupInterval) {
			clearInterval(cleanupInterval);
		}
		const CLEANUP_INTERVAL = process.env.SOAJS_IDEMPOTENCY_CLEANUP_INTERVAL || 60000;
		cleanupInterval = setInterval(() => {
			model.cleanupExpiredEntries();
		}, CLEANUP_INTERVAL);
	},

	'cleanupExpiredEntries': () => {
		const now = Date.now();
		let removedCount = 0;

		for (const l1Key in dataHolder) {
			if (dataHolder.hasOwnProperty(l1Key)) {
				const tenantData = dataHolder[l1Key];

				for (const l2Key in tenantData) {
					if (tenantData.hasOwnProperty(l2Key)) {
						const entry = tenantData[l2Key];
						if (entry.expiresAt && now > entry.expiresAt) {
							delete tenantData[l2Key];
							removedCount++;
						}
					}
				}

				if (Object.keys(tenantData).length === 0) {
					delete dataHolder[l1Key];
				}
			}
		}

		if (removedCount > 0 && model.log) {
			model.log.debug(`Idempotency cache cleanup: removed ${removedCount} expired entries`);
		}
	},

	'get': (key) => {
		if (!dataHolder[key.l1]) {
			return null;
		}
		const entry = dataHolder[key.l1][key.l2];
		if (!entry) {
			return null;
		}
		if (entry.expiresAt && Date.now() > entry.expiresAt) {
			delete dataHolder[key.l1][key.l2];
			return null;
		}
		return entry;
	},

	'lock': (key, ttl) => {
		if (!dataHolder[key.l1]) {
			dataHolder[key.l1] = {};
		}
		const existing = dataHolder[key.l1][key.l2];
		if (existing && existing.expiresAt && Date.now() <= existing.expiresAt) {
			return false;
		}
		dataHolder[key.l1][key.l2] = {
			'status': 'in_flight',
			'lockedAt': Date.now(),
			'expiresAt': Date.now() + ttl
		};
		return true;
	},

	'complete': (key, response, ttl) => {
		if (!dataHolder[key.l1]) {
			dataHolder[key.l1] = {};
		}
		dataHolder[key.l1][key.l2] = {
			'status': 'completed',
			'response': response,
			'completedAt': Date.now(),
			'expiresAt': Date.now() + ttl
		};
	},

	'unlock': (key) => {
		if (dataHolder[key.l1] && dataHolder[key.l1][key.l2]) {
			delete dataHolder[key.l1][key.l2];
		}
	},

	'shutdown': () => {
		if (cleanupInterval) {
			clearInterval(cleanupInterval);
			cleanupInterval = null;
		}
		dataHolder = {};
		if (model.log) {
			model.log.info('Idempotency memory model shutdown complete');
		}
	}
};

if (typeof process !== 'undefined') {
	const shutdownHandler = () => {
		model.shutdown();
	};
	process.once('SIGTERM', shutdownHandler);
	process.once('SIGINT', shutdownHandler);
}

module.exports = model;
