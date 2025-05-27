'use strict';

/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */


const get = (p, o) => p.reduce((xs, x) => (xs && xs[x]) ? xs[x] : null, o);
const memory = require('./model/memory.js');
const mongo = require('./model/mongo.js');

let model = {
	memory, mongo
};
/**
 *
 * @param configuration
 * @returns {Function}
 */
module.exports = function (configuration) {

	// let registry.throttling = {
	//     'publicAPIStrategy' : 'default', // can be null means throttling is off
	//     'privateAPIStrategy': 'heavy', // can be null means throttling is off
	//     'default': {
	//         'status': 1, // 0=Off, 1=On
	//         'type': 1, // 0= tenant, 1= tenant -> ip
	//         'window': 60000,
	//         'limit': 50,
	//         'retries': 2,
	//         'delay': 1000
	//     },
	//     'off': {
	//         'status': 0, // 0=Off, 1=On
	//         'type': 1, // 0= tenant, 1= tenant -> ip
	//         'window': 60000,
	//         'limit': 5,
	//         'retries': 2,
	//         'delay': 1000
	//     },
	//     'heavy': {
	//         'status': 1, // 0=Off, 1=On
	//         'type': 1, // 0= tenant, 1= tenant -> ip
	//         'window': 60000,
	//         'limit': 500,
	//         'retries': 2,
	//         'delay': 1000
	//     }
	// };
	// let provision.gateway.throttling = {
	//     'publicAPIStrategy' : 'default', // can be null means throttling is off, if not set means inherit from registry
	//     'privateAPIStrategy': null, // can be null means throttling is off, if not set means inherit from registry
	//	   'oauth' : { 
	//	   		'publicAPIStrategy' : 'default'	
	//	   }
	// };
	// let customRegistry.gateway = {
	// 	"traffic": {
	// 		"ip2ban": [
	// 			"::1"
	// 		],
	// 		"model": "mongo",
	// 		"throttling": {
	// 			"oauth": {
	// 				"publicAPIStrategy": "test",
	// 				"apis": [
	// 					"/token"
	// 				]
	// 			}
	// 		}
	// 	},
	// };

	model.memory.initThrottling(configuration.log);
	model.mongo.initThrottling(configuration.log, configuration.gatewayDB);

	let checkThrottling = async (obj, cb) => {
		let trafficKey = obj.trafficKey;
		let throttling = obj.throttling;
		let strategy = obj.strategy;
		let modelType = obj.throttling.model || 'memory';

		let throttlingObj = await model[modelType].getThrottling(throttling, trafficKey);

		let remainingLifetime = throttling.window - Math.floor(Date.now() - throttlingObj.firstReqTime.getTime());

		if (remainingLifetime < 1) {
			throttlingObj = await model[modelType].resetThrottling(throttling, trafficKey);
		}
		let throttlingCount = throttlingObj.count;
		if (obj.retry === 0) {
			throttlingCount = throttlingObj.count + 1;
			await model[modelType].incrementThrottling(throttling, trafficKey);
		}

		if (throttlingCount > throttling.limit) {
			obj.retry++;
			if (obj.retry <= throttling.retries) {
				setTimeout(function () {
					checkThrottling({ trafficKey, throttling, 'retry': obj.retry, strategy }, cb);
				}, throttling.delay);
			} else {
				await model[modelType].logTooManyRequests(trafficKey, strategy);
				return cb({
					'result': false, 'headObj': {
						'Retry-After': remainingLifetime / 1000,
						'X-RateLimit-Limit': throttling.limit,
						'X-RateLimit-Remaining': throttling.limit - throttlingCount
					}
				});
			}
		} else {
			return cb({
				'result': true, 'headObj': {
					'Retry-After': remainingLifetime / 1000,
					'X-RateLimit-Limit': throttling.limit,
					'X-RateLimit-Remaining': throttling.limit - throttlingCount
				}
			});
		}
	};

	return (req, res, next) => {

		// NOTE: moved to ip2ban MW
		//
		// let ip2ban = get(["soajs", "registry", "custom", "gateway", "value", "traffic", "ip2ban"], req);
		// let clientIP = req.getClientIP();

		// if (ip2ban && Array.isArray(ip2ban) && ip2ban.includes(clientIP)) {
		// 	req.soajs.controllerResponse({
		// 		'status': 403,
		// 		'msg': 'banned'
		// 	});
		// 	return;
		// }
		let clientIP = req.getClientIP();
		
		if (req && req.soajs && req.soajs.registry && req.soajs.registry.serviceConfig && req.soajs.registry.serviceConfig.throttling && req.soajs.tenant && req.soajs.controller) {

			let serviceName = req.soajs.controller.serviceParams.name;
			let api = req.soajs.controller.serviceParams.path;
			let strategy = (req.soajs.controller.serviceParams.isAPIPublic ? 'publicAPIStrategy' : 'privateAPIStrategy');
			let throttlingStrategy = req.soajs.registry.serviceConfig.throttling[strategy];

			let throttlingConfiguration = get(["soajs", "servicesConfig", "gateway", "throttling"], req);
			if (!throttlingConfiguration) {
				throttlingConfiguration = get(["soajs", "registry", "custom", "gateway", "value", "traffic", "throttling"], req);
			}
			if (throttlingConfiguration) {
				if (throttlingConfiguration[serviceName]) {
					if (throttlingConfiguration[serviceName].hasOwnProperty(strategy)) {
						if (throttlingConfiguration[serviceName].apis && Array.isArray(throttlingConfiguration[serviceName].apis)) {
							if (throttlingConfiguration[serviceName].apis.includes(api)) {
								throttlingStrategy = throttlingConfiguration[serviceName][strategy];
							}
						} else {
							throttlingStrategy = throttlingConfiguration[serviceName][strategy];
						}
					}
				}
			}

			if (!throttlingStrategy) {
				return next();
			}
			let throttling = req.soajs.registry.serviceConfig.throttling[throttlingStrategy];

			if (throttling) {
				let trafficModel = get(["soajs", "registry", "custom", "gateway", "value", "traffic", "model"], req);
				if (trafficModel) {
					throttling.model = trafficModel;
					if (!model[throttling.model]) {
						req.soajs.log.warn('Throttling:', 'Unkown model [' + throttling.model + ']. It can only be [memory || mongo]');
						return next();
					}
				}
				let trafficKey = { 'l1': req.soajs.tenant.id, 'l2': clientIP };

				checkThrottling({ trafficKey, throttling, 'retry': 0, 'strategy': throttlingStrategy }, function (response) {
					if (response.result) {
						return next();
					} else {
						req.soajs.controllerResponse({
							'status': 429,
							'msg': 'too many requests',
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
