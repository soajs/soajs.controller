'use strict';

/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

const get = (p, o) => p.reduce((xs, x) => (xs && xs[x]) ? xs[x] : null, o);

// const request = require('request');
const { httpRequestLight, proxyRequestMonitor } = require("../../lib/request.js");
// const http = require('http');
// const querystring = require('querystring');

module.exports = (configuration) => {

	let core = configuration.core;
	let isRequestAuthorized = require("./lib/isRequestAuthorized.js");
	let preRedirect = require("./lib/preRedirect.js");

	/**
	 *
	 * @param req
	 * @param res
	 * @returns {*}
	 */
	return (req, res) => {
		preRedirect(req, res, core, function (obj) {
			let log_monitor_triggered = false;
			let log_monitor = (doc) => {
				if (log_monitor_triggered) {
					return;
				}
				log_monitor_triggered = true;
				let soamonitor = "soamonitor";
				let soamonitorVersion = "1";
				let port = get(["registry", "services", "soamonitor", "port"], req.soajs);
				if (!port) {
					port = "4050";
				}
				let api = "/monitor/item";

				req.soajs.awareness.getHost(soamonitor, soamonitorVersion, function (host) {
					if (!host) {
						req.soajs.log.debug('Unable to find any healthy host for service ' + soamonitor);
					} else {
						if (doc && doc.body) {
							doc.body = doc.body.toString();
						}
						if (doc && doc.response) {
							doc.response = doc.response.toString();
						}
						let uri = "http://" + host + ":" + port + api;
						let options = {
							"method": "POST",
							"uri": uri,
							"data": doc,
							"json": true
						};
						if (req.headers && req.headers.soajsinjectobj) {
							options.headers = { "soajsinjectobj": req.headers.soajsinjectobj };
						}
						httpRequestLight(options)
							.then((body) => {
								if (body && !body.result) {
									req.soajs.log.debug(body);
								}
							})
							.catch((error) => {
								req.soajs.log.debug('Unable register monitor: ' + error.message);
							});
					}
				});
			};

			let monitor = get(["registry", "custom", "gateway", "value", "gotoService", "monitor"], req.soajs);
			let monitoObj = {
				"time": {}
			};
			let monitor_service_blacklist = false;
			if (monitor && monitor.blacklist) {
				if (Array.isArray(monitor.blacklist) && monitor.blacklist.length > 0) {
					if (monitor.blacklist.includes(req.soajs.controller.serviceParams.name)) {
						monitor_service_blacklist = true;
					}
				}
			}
			if (monitor && monitor.whitelist) {
				if (Array.isArray(monitor.whitelist) && monitor.whitelist.length > 0) {
					monitor_service_blacklist = true;
					if (monitor.whitelist.includes(req.soajs.controller.serviceParams.name)) {
						monitor_service_blacklist = false;
					}
				}
			}
			if (monitor && !monitor_service_blacklist) {
				monitoObj.name = req.soajs.controller.serviceParams.name;
				monitoObj.version = req.soajs.controller.serviceParams.version;
				monitoObj.api = req.soajs.controller.serviceParams.parsedUrl.pathname;
				monitoObj.method = req.method;
				monitoObj.time.req_start = new Date().getTime();
			}
			if (monitor && !monitor_service_blacklist && monitor.req_info) {
				monitoObj.port = req.soajs.controller.serviceParams.registry.port;
				monitoObj.url = req.soajs.controller.serviceParams.url;
				monitoObj.host = req.host;
			}
			if (monitor && !monitor_service_blacklist && monitor.req_header) {
				monitoObj.headers = req.headers;
			}
			if (monitor && !monitor_service_blacklist && monitor.req_query) {
				monitoObj.query = req.query;
			}

			if (monitor && !monitor_service_blacklist && monitor.req_body &&
				(req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH' || req.method === 'DELETE')) {
				let allowedContentType = false;
				let isStream = false;
				req.on("data", (chunk) => {
					let resContentType = req.headers['content-type'];
					if (resContentType) {
						if (!allowedContentType) {
							allowedContentType = resContentType.match(/application\/json|text\/plain/i);
						}
						if (!isStream) {
							isStream = resContentType.match(/stream/i);
						}
					}
					if (!isStream && allowedContentType) {
						if (!monitoObj.body) {
							monitoObj.time.req_body_start = new Date().getTime();
							monitoObj.body = chunk;
						} else {
							monitoObj.body += chunk;
						}
					} else {
						monitoObj.body = "{\"contentType\": \"is stream or not allowed\", \"value': \"" + resContentType + "\"}";
					}
				});
				req.on("end", () => {
					let resContentType = req.headers['content-length'];
					if (resContentType) {
						if (!allowedContentType) {
							allowedContentType = resContentType.match(/application\/json|text\/plain/i);
						}
						if (!isStream) {
							isStream = resContentType.match(/stream/i);
						}
					}
					if (!isStream && allowedContentType) {
						monitoObj.time.req_body_end = new Date().getTime();
					}
				});
			}

			let restServiceParams = req.soajs.controller.serviceParams;
			let requestOptions = {};
			try {
				const urlObj = new URL(obj.uri);
				requestOptions = {
					"hostname": urlObj.hostname,
					"port": urlObj.port,
					"path": urlObj.pathname + urlObj.search,
					"method": req.method.toUpperCase(),
					'headers': req.headers
				};
				if (obj.config.authorization) {
					isRequestAuthorized(req, core, requestOptions);
				}
			} catch (e) {
				req.soajs.log.error(e.message + ' @catch with [' + restServiceParams.name + (restServiceParams.version ? ('@' + restServiceParams.version) : '') + ']');
				if (!req.soajs.controller.monitorEndingReq) {
					return req.soajs.controllerResponse(core.error.getError(135));
				}
			}

			let allowedContentType = false;
			let isStream = false;
			let resContentType = "";
			const extraOptions = {};

			if (monitor && !monitor_service_blacklist && monitor.req_response) {
				extraOptions.events = {
					"response": (_resContentType) => {
						resContentType = _resContentType;
						if (resContentType) {
							if (!allowedContentType) {
								allowedContentType = resContentType.match(/application\/json|text\/plain/i);
							}
							if (!isStream) {
								isStream = resContentType.match(/stream/i);
							}
						}
						monitoObj.time.res_start = new Date().getTime();
					},
					"data": (chunk) => {
						if (!isStream && allowedContentType) {
							if (!monitoObj.response) {
								monitoObj.response = chunk;
							} else {
								monitoObj.response += chunk;
							}
						} else {
							monitoObj.response = "{\"contentType\": \"is stream or not allowed\", \"value': \"" + resContentType + "\"}";
						}
					},
					"fetchProxReq": (proxyReq) => {
						req.soajs.controller.redirectedRequest = proxyReq;
					}
				};
			}

			proxyRequestMonitor(req, res, requestOptions, extraOptions)
				.then(() => {
					if (monitor && !monitor_service_blacklist && monitor.req_response) {
						monitoObj.time.res_end = new Date().getTime();
						log_monitor(monitoObj);
					}
				})
				.catch((err) => {
					req.soajs.log.error(err.message + ' with [' + restServiceParams.name + (restServiceParams.version ? ('@' + restServiceParams.version) : '') + ']');
					// if (req.soajs.controller.redirectedRequest) {
					// 	req.soajs.controller.redirectedRequest.destroy();
					// 	req.soajs.controller.redirectedRequest = null;
					// }
					if (!req.soajs.controller.monitorEndingReq) {
						req.soajs.controllerResponse(core.error.getError(135));
					}
					if (monitor && !monitor_service_blacklist && monitor.req_response) {
						monitoObj.time.res_end = new Date().getTime();
						log_monitor(monitoObj);
					}
				});
		});
	};
};