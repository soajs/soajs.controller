'use strict';

/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

/**
 *
 * @param configuration
 * @returns {Function}
 */
module.exports = function () {
	
	// var registryThrottling = {
	//     "publicAPIStrategy" : "default", // can be null means throttling is off
	//     "privateAPIStrategy": "heavy", // can be null means throttling is off
	//     "default": {
	//         'status': 1, // 0=Off, 1=On
	//         'type': 1, // 0= tenant, 1= tenant -> ip
	//         'window': 60000,
	//         'limit': 50,
	//         'retries': 2,
	//         'delay': 1000
	//     },
	//     "off": {
	//         'status': 0, // 0=Off, 1=On
	//         'type': 1, // 0= tenant, 1= tenant -> ip
	//         'window': 60000,
	//         'limit': 5,
	//         'retries': 2,
	//         'delay': 1000
	//     },
	//     "heavy": {
	//         'status': 1, // 0=Off, 1=On
	//         'type': 1, // 0= tenant, 1= tenant -> ip
	//         'window': 60000,
	//         'limit': 500,
	//         'retries': 2,
	//         'delay': 1000
	//     }
	// };
	// var provisionThrottling = {
	//     "publicAPIStrategy" : "default", // can be null means throttling is off, if not set means inherit from registry
	//     "privateAPIStrategy": null, // can be null means throttling is off, if not set means inherit from registry
	// };
	
	let dataHolder = {};
	let checkThrottling = (obj, cb) => {
		let trafficKey = obj.trafficKey;
		let throttling = obj.throttling;
		
		let throttlingObj = {};
		
		if (!dataHolder[trafficKey.l1]) {
			dataHolder[trafficKey.l1] = {};
			if (throttling.type === 0) {
				dataHolder[trafficKey.l1] = {
					'firstReqTime': new Date(Date.now()),
					'count': 0
				};
			}
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
		
		let remainingLifetime = throttling.window - Math.floor(Date.now() - throttlingObj.firstReqTime.getTime());
		
		if (remainingLifetime < 1) {
			throttlingObj.firstReqTime = new Date(Date.now());
			throttlingObj.count = 0;
		}
		
		if (obj.retry === 0) {
			throttlingObj.count++;
			throttlingObj.lastReqTime = new Date(Date.now());
		}
		
		if (throttlingObj.count > throttling.limit) {
			obj.retry++;
			if (obj.retry <= throttling.retries) {
				setTimeout(function () {
					checkThrottling({'trafficKey': trafficKey, 'throttling': throttling, 'retry': obj.retry}, cb);
				}, throttling.delay);
			} else {
				return cb({
					'result': false, 'headObj': {
						'Retry-After': remainingLifetime / 1000,
						'X-RateLimit-Limit': throttling.limit,
						'X-RateLimit-Remaining': throttling.limit - throttlingObj.count
					}
				});
			}
		} else {
			return cb({
				'result': true, 'headObj': {
					'Retry-After': remainingLifetime / 1000,
					'X-RateLimit-Limit': throttling.limit,
					'X-RateLimit-Remaining': throttling.limit - throttlingObj.count
				}
			});
		}
	};
	
	return (req, res, next) => {
		if (req && req.soajs && req.soajs.registry && req.soajs.registry.serviceConfig && req.soajs.registry.serviceConfig.throttling && req.soajs.tenant && req.soajs.controller) {
			let serviceName = req.soajs.controller.serviceParams.name;
			let strategy = (req.soajs.controller.serviceParams.isAPIPublic ? "publicAPIStrategy" : "privateAPIStrategy");
			let throttlingStrategy = req.soajs.registry.serviceConfig.throttling[strategy];
			
			if (req.soajs.servicesConfig && req.soajs.servicesConfig.gateway && req.soajs.servicesConfig.gateway.throttling) {
				if (req.soajs.servicesConfig.gateway.throttling.hasOwnProperty(strategy)) {
					throttlingStrategy = req.soajs.servicesConfig.gateway.throttling[strategy];
				}
				if (req.soajs.servicesConfig.gateway.throttling[serviceName]) {
					if (req.soajs.servicesConfig.gateway.throttling[serviceName].hasOwnProperty(strategy)) {
						throttlingStrategy = req.soajs.servicesConfig.gateway.throttling[strategy];
					}
				}
			}
			if (!throttlingStrategy) {
				return next();
			}
			let throttling = req.soajs.registry.serviceConfig.throttling[throttlingStrategy];
			
			if (throttling) {
				let trafficKey = {"l1": req.soajs.tenant.id, "l2": req.getClientIP()};
				
				checkThrottling({'trafficKey': trafficKey, 'throttling': throttling, 'retry': 0}, function (response) {
					if (response.result) {
						return next();
					} else {
						req.soajs.controllerResponse({
							'status': 429,
							'msg': "too many requests",
							'headObj': response.headObj
						});
					}
				});
			} else {
				return next();
			}
		} else {
			return next();
		}
	};
};
