'use strict';

/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

let dataHolder = {};

let model = {
    'log': null,
    'initThrottling': (log) => {
        model.log = log;
        dataHolder = {};
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
    }
};


module.exports = model;