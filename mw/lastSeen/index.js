'use strict';

/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

const { httpRequest } = require("../../lib/request.js");
const { pathToRegexp } = require("path-to-regexp");
const get = (p, o) => p.reduce((xs, x) => (xs && xs[x]) ? xs[x] : null, o);

// Cache compiled RegExp objects for route pattern matching
const regexpCache = new Map();
const MAX_REGEXP_CACHE_SIZE = 100;

/**
 * Check if a route pattern contains path parameters
 * @param {string} route - The route pattern
 * @returns {boolean}
 */
function hasPathParams(route) {
    return route.includes("/:");
}

/**
 * Get or create a cached RegExp for a route pattern
 * @param {string} route - The route pattern
 * @returns {RegExp}
 */
function getRouteRegExp(route) {
    if (regexpCache.has(route)) {
        return regexpCache.get(route);
    }

    let out = pathToRegexp(route, { sensitive: true });
    let regexp = out.regexp || out;

    // Simple LRU: clear oldest entries when cache is full
    if (regexpCache.size >= MAX_REGEXP_CACHE_SIZE) {
        const keysToDelete = Array.from(regexpCache.keys()).slice(0, Math.floor(MAX_REGEXP_CACHE_SIZE * 0.25));
        keysToDelete.forEach(key => regexpCache.delete(key));
    }

    regexpCache.set(route, regexp);
    return regexp;
}

/**
 * Check if the current request should trigger lastSeen
 * @param {Object} include - The include whitelist configuration
 * @param {string} serviceName - The current service name
 * @param {string} apiPath - The current API path
 * @param {string} method - The HTTP method (GET, POST, etc.)
 * @returns {boolean} - true if lastSeen should be triggered
 */
function shouldTriggerLastSeen(include, serviceName, apiPath, method) {
    // No include filter = trigger for all (backward compatible)
    if (!include) {
        return true;
    }

    // Service not in whitelist
    if (!include[serviceName]) {
        return false;
    }

    const serviceConfig = include[serviceName];

    // Service-level match (all APIs, all methods)
    if (serviceConfig === true) {
        return true;
    }

    // API-level match
    if (typeof serviceConfig === 'object' && serviceConfig.apis) {
        return isApiMethodMatch(serviceConfig.apis, apiPath, method);
    }

    return false;
}

/**
 * Check if API path and method match the apis configuration
 * @param {Object} apis - The apis configuration object
 * @param {string} apiPath - The current API path
 * @param {string} method - The HTTP method
 * @returns {boolean}
 */
function isApiMethodMatch(apis, apiPath, method) {
    // Check for wildcard first
    if (apis["*"]) {
        return isMethodMatch(apis["*"], method);
    }

    // Check exact match first
    if (apis[apiPath]) {
        return isMethodMatch(apis[apiPath], method);
    }

    // Check pattern matching for routes with path params
    for (const routePattern of Object.keys(apis)) {
        if (hasPathParams(routePattern)) {
            const regexp = getRouteRegExp(routePattern);
            if (regexp.test(apiPath)) {
                return isMethodMatch(apis[routePattern], method);
            }
        }
    }

    return false;
}

/**
 * Check if method matches the method configuration
 * @param {boolean|Array} methodConfig - true for all methods, or array of methods
 * @param {string} method - The HTTP method
 * @returns {boolean}
 */
function isMethodMatch(methodConfig, method) {
    // true = all methods
    if (methodConfig === true) {
        return true;
    }

    // Array of methods (case-insensitive)
    if (Array.isArray(methodConfig)) {
        const lowerMethod = method.toLowerCase();
        return methodConfig.some(m => m.toLowerCase() === lowerMethod);
    }

    return false;
}

/**
 *
 * @param configuration
 * @returns {Function}
 */
module.exports = () => {

    return (req, res, next) => {
        next();

        if (req.soajs.uracDriver) {
            let lastSeen = get(["soajs", "registry", "custom", "gateway", "value", "lastSeen"], req);
            if (lastSeen && lastSeen.active) {

                // Check include filter
                let currentService = get(["soajs", "controller", "serviceParams", "name"], req);
                let currentApi = get(["soajs", "controller", "serviceParams", "parsedUrl", "pathname"], req);
                let currentMethod = req.method;

                if (!shouldTriggerLastSeen(lastSeen.include, currentService, currentApi, currentMethod)) {
                    req.soajs.log.debug("lastSeen skipped for [" + currentService + " " + currentMethod + " " + currentApi + "]");
                    return;
                }

                const item = {
                    "name": lastSeen.serviceName || "urac",
                    "version": lastSeen.serviceVersion || "3",
                    "api": lastSeen.api || "/user/last/seen"
                };

                let userId = null;
                let uracObj = req.soajs.uracDriver.getProfile();
                if (uracObj) {
                    userId = uracObj._id;
                }
                if (userId) {
                    req.soajs.awareness.getHost(item.name, item.version, (host) => {
                        if (host) {
                            item.host = host;
                            item.port = req.soajs.registry.services[item.name].port;

                            let options = {
                                "uri": "http://" + item.host + ":" + item.port + item.api,
                                "json": true,
                                "method": "POST"
                            };
                            if (lastSeen.network) {
                                options.body = { "network": lastSeen.network };
                            }
                            if (req.headers && req.headers.soajsinjectobj) {
                                options.headers = { "soajsinjectobj": req.headers.soajsinjectobj };
                            }
                            httpRequest(options)
                                .then(() => { })
                                .catch(({ error, body }) => {
                                    if (error) {
                                        req.soajs.log.debug("lastSeen failed for [" + item.name + "@" + item.version + " " + item.api + "]");
                                        req.soajs.log.debug("lastSeen " + error.message);
                                    } else {
                                        req.soajs.log.debug("lastSeen ", body);
                                    }
                                });
                        } else {
                            req.soajs.log.debug("lastSeen failed with no host for [" + item.name + "@" + item.version + " " + item.api + "]");
                        }
                    });
                } else {
                    req.soajs.log.debug("lastSeen failed with no userId for [" + item.name + "@" + item.version + " " + item.api + "]");
                }
            }
        }
    };
};