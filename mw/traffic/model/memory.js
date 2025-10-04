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
    'initThrottling': (log) => {
        model.log = log;
        dataHolder = {};

        // Performance: Implement periodic cleanup of expired throttling entries
        if (cleanupInterval) {
            clearInterval(cleanupInterval);
        }
        const CLEANUP_INTERVAL = process.env.SOAJS_THROTTLE_CLEANUP_INTERVAL || 60000; // 1 minute default
        cleanupInterval = setInterval(() => {
            model.cleanupExpiredEntries();
        }, CLEANUP_INTERVAL);
    },

    'cleanupExpiredEntries': () => {
        const now = Date.now();
        const MAX_AGE = 3600000; // 1 hour - entries older than this are removed
        let removedCount = 0;

        for (const l1Key in dataHolder) {
            if (dataHolder.hasOwnProperty(l1Key)) {
                const entry = dataHolder[l1Key];

                // Check if l1 level entry is expired
                if (entry.firstReqTime && (now - entry.firstReqTime.getTime()) > MAX_AGE) {
                    delete dataHolder[l1Key];
                    removedCount++;
                    continue;
                }

                // Check l2 level entries (if any)
                for (const l2Key in entry) {
                    if (entry.hasOwnProperty(l2Key) && l2Key !== 'firstReqTime' && l2Key !== 'count') {
                        const l2Entry = entry[l2Key];
                        if (l2Entry.firstReqTime && (now - l2Entry.firstReqTime.getTime()) > MAX_AGE) {
                            delete entry[l2Key];
                            removedCount++;
                        }
                    }
                }
            }
        }

        if (removedCount > 0 && model.log) {
            model.log.debug(`Throttling cache cleanup: removed ${removedCount} expired entries`);
        }
    },

    'getThrottling': (throttling, trafficKey) => {

        let throttlingObj = {};
        if (!dataHolder[trafficKey.l1]) {
            dataHolder[trafficKey.l1] = {
                'firstReqTime': new Date(Date.now()),
                'count': 0
            };
        }
        if (throttling.type === 1) {
            if (!dataHolder[trafficKey.l1][trafficKey.l2]) {
                dataHolder[trafficKey.l1][trafficKey.l2] = {
                    'firstReqTime': new Date(Date.now()),
                    'count': 0
                };
            }
            throttlingObj = dataHolder[trafficKey.l1][trafficKey.l2];
        } else {
            throttlingObj = dataHolder[trafficKey.l1];
        }
        return throttlingObj;
    },

    'resetThrottling': (throttling, trafficKey) => {
        if (throttling.type === 1) {
            dataHolder[trafficKey.l1][trafficKey.l2] = {
                'firstReqTime': new Date(Date.now()),
                'count': 0
            };
            return (dataHolder[trafficKey.l1][trafficKey.l2]);
        } else {
            dataHolder[trafficKey.l1] = {
                'firstReqTime': new Date(Date.now()),
                'count': 0
            };
            return (dataHolder[trafficKey.l1]);
        }
    },

    'incrementThrottling': (throttling, trafficKey) => {
        if (throttling.type === 1) {
            dataHolder[trafficKey.l1][trafficKey.l2].count++;
        } else {
            dataHolder[trafficKey.l1].count++;
        }
    },

    'logTooManyRequests': (trafficKey, throttlingStrategy) => {
        model.log.error('Throttling [' + throttlingStrategy + ']rejected:', 'using tenant id [' + trafficKey.l1 + '] from ip [' + trafficKey.l2 + ']');
    },

    'shutdown': () => {
        // Performance: Clean up interval on shutdown to prevent memory leaks
        if (cleanupInterval) {
            clearInterval(cleanupInterval);
            cleanupInterval = null;
        }
        dataHolder = {};
        if (model.log) {
            model.log.info('Traffic throttling model shutdown complete');
        }
    }
};

// Performance: Register shutdown handlers
if (typeof process !== 'undefined') {
    const shutdownHandler = () => {
        model.shutdown();
    };
    process.once('SIGTERM', shutdownHandler);
    process.once('SIGINT', shutdownHandler);
}

module.exports = model;