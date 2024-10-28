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

const throttling_monitor = 'throttling_monitor';
const throttling_error = 'throttling_error';

let model = {
    'mongo': null,
    'log': null,

    'initThrottling': (log, dbConfiguration) => {
        model.log = log;
        if (!model.mongo) {
            model.mongo = new Mongo(dbConfiguration);
            model.mongo.createIndex(throttling_monitor, { 'l1': 1, 'l2': 1 }, {}, (err, index) => {
                log.debug("Index: " + index + " created with error: " + err);
            });
        }
    },

    'getThrottling': async (throttling, trafficKey) => {

        let condition = {
            'l1': trafficKey.l1
        };
        if (throttling.type === 1) {
            condition.l2 = trafficKey.l2;
        } else {
            condition.l2 = '_ALL_';
        }
        let throttlingObj = null;
        try {
            throttlingObj = await model.mongo.findOne(throttling_monitor, condition);
            if (!throttlingObj) {
                throttlingObj = await model.resetThrottling(throttling, trafficKey);
            }
        } catch (e) {
            model.log.error('Throttling:', e.message);
            throttlingObj = {
                'firstReqTime': new Date(Date.now()),
                'count': 0
            };
        }
        return throttlingObj;
    },

    'resetThrottling': async (throttling, trafficKey) => {
        let options = {
            'upsert': true
        };
        let condition = {
            'l1': trafficKey.l1
        };
        if (throttling.type === 1) {
            condition.l2 = trafficKey.l2;
        } else {
            condition.l2 = '_ALL_';
        }
        let throttlingObj = {
            'firstReqTime': new Date(Date.now()),
            'count': 0
        };
        let s = {
            '$set': throttlingObj
        };
        try {
            await model.mongo.updateOne(throttling_monitor, condition, s, options);
        } catch (e) {
            model.log.error('Throttling:', e.message);
        }
        return throttlingObj;
    },

    'incrementThrottling': async (throttling, trafficKey) => {
        let options = {
        };
        let condition = {
            'l1': trafficKey.l1
        };
        if (throttling.type === 1) {
            condition.l2 = trafficKey.l2;
        } else {
            condition.l2 = '_ALL_';
        }
        let s = {
            '$inc': { 'count': 1 }
        };
        try {
            await model.mongo.updateOne(throttling_monitor, condition, s, options);
        } catch (e) {
            model.log.error('Throttling:', e.message);
        }
    },

    'logTooManyRequests': (trafficKey, strategy) => {
        let s = {
            "staregy": strategy,
            "l1": trafficKey.l1,
            "l2": trafficKey.l2,
            "ts": new Date(Date.now())
        };
        model.mongo.insertOne(throttling_error, s, {}, () => {
        });
    }
};


module.exports = model;