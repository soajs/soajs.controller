'use strict';

/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

const get = (p, o) => p.reduce((xs, x) => (xs && xs[x]) ? xs[x] : null, o);

const request = require('request');

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
			let requestOptions = {
				'method': req.method,
				'uri': obj.uri,
				//'timeout': obj.requestTO * 1000,
				'headers': req.headers,
				'jar': false
			};
			if (obj.config.authorization) {
				isRequestAuthorized(req, core, requestOptions);
			}

			let restServiceParams = req.soajs.controller.serviceParams;
			try {
				let log_monitor = (doc) => {
					let soamonitor = "soamonitor";
					let soamonitorVersion = "1";
					let port = get(["registry", "services", "soamonitor", "port"], req.soajs);
					if (!port) {
						port = "4050";
					}
					let api = "/monitor/item";

					req.soajs.awareness.getHost(soamonitor, soamonitorVersion, function (host) {
						if (!host) {
							req.soajs.log.error('Unable to find any healthy host for service ' + soamonitor);
						} else {
							if (doc && doc.body) {
								doc.body = doc.body.toString();
							}
							if (doc && doc.response) {
								doc.response = doc.response.toString();
							}
							let uri = 'http://' + host + ':' + port + api;
							let requestOptions = {
								'uri': uri,
								"body": doc,
								"json": true
							};
							if (req.headers && req.headers.soajsinjectobj) {
								requestOptions.headers = { "soajsinjectobj": req.headers.soajsinjectobj };
							}
							request.post(requestOptions, (error, response, body) => {
								if (error) {
									req.soajs.log.error('Unable register monitor: ' + error.message);
								}
								if (body && !body.result) {
									req.soajs.log.error(body);
								}
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

				// Trigger request
				req.soajs.controller.redirectedRequest = request(requestOptions);

				// Handle error event for both with monitor and without monitor
				req.soajs.controller.redirectedRequest.on('error', (err) => {
					req.soajs.log.error(err.message + ' with [' + restServiceParams.name + (restServiceParams.version ? ('@' + restServiceParams.version) : '') + ']');
					if (req.soajs.controller.redirectedRequest) {
						req.soajs.controller.redirectedRequest.destroy();
						req.soajs.controller.redirectedRequest = null;
					}
					if (!req.soajs.controller.monitorEndingReq) {
						req.soajs.controllerResponse(core.error.getError(135));
					}
					if (monitor && !monitor_service_blacklist && monitor.req_response) {
						monitoObj.time.res_end = new Date().getTime();
						log_monitor(monitoObj);
					}
				});
				//Handle body
				if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH' || req.method === 'DELETE') {
					if (monitor && !monitor_service_blacklist && monitor.req_body) {
						let allowedContentType = false;
						let isStream = false;
						req.on("data", (chunk) => {
							req.soajs.controller.redirectedRequest.write(chunk);
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
							if (!isStream) {
								if (req.soajs.controller.redirectedRequest) {
									req.soajs.controller.redirectedRequest.end();
								}
							}
							if (!isStream && allowedContentType) {
								monitoObj.time.req_body_end = new Date().getTime();
							}
						});
					} else {
						req.pipe(req.soajs.controller.redirectedRequest);
					}
				}
				// Handle response
				if (monitor && !monitor_service_blacklist && monitor.req_response) {
					let allowedContentType = false;
					let isStream = false;
					req.soajs.controller.redirectedRequest.on("response", (response) => {
						if (!res.headersSent) {
							res.writeHeader(response.statusCode, response.headers);
						}
						monitoObj.time.res_start = new Date().getTime();
					});
					req.soajs.controller.redirectedRequest.on("data", (chunk) => {
						res.write(chunk);
						let resContentType = res.getHeader('content-type');
						if (resContentType) {
							if (!allowedContentType) {
								allowedContentType = resContentType.match(/application\/json|text\/plain/i);
							}
							if (!isStream) {
								isStream = resContentType.match(/stream/i);
							}
						}
						if (!isStream && allowedContentType) {
							if (!monitoObj.response) {
								monitoObj.response = chunk;
							} else {
								monitoObj.response += chunk;
							}
						} else {
							monitoObj.response = "{\"contentType\": \"is stream or not allowed\", \"value': \"" + resContentType + "\"}";
						}
					});
					req.soajs.controller.redirectedRequest.on("end", () => {
						let resContentType = res.getHeader('content-type');
						if (resContentType) {
							if (!isStream) {
								isStream = resContentType.match(/stream/i);
							}
						}
						if (!isStream) {
							res.end();
						}
						monitoObj.time.res_end = new Date().getTime();
						log_monitor(monitoObj);
					});
					req.soajs.controller.redirectedRequest.on("abort", () => {
						if (!req.soajs.controller.monitorEndingReq) {
							req.soajs.controllerResponse(core.error.getError(135));
						}
						monitoObj.time.res_end = new Date().getTime();
						log_monitor(monitoObj);
					});
				} else {
					req.soajs.controller.redirectedRequest.pipe(res);
				}

			} catch (e) {
				req.soajs.log.error(e.message + ' @catch with [' + restServiceParams.name + (restServiceParams.version ? ('@' + restServiceParams.version) : '') + ']');
				if (req.soajs.controller.redirectedRequest) {
					req.soajs.controller.redirectedRequest.destroy();
					req.soajs.controller.redirectedRequest = null;
				}
				if (!req.soajs.controller.monitorEndingReq) {
					return req.soajs.controllerResponse(core.error.getError(135));
				}
			}
		});
	};
};