'use strict';

/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

const coreModules = require("soajs.core.modules");
let core = coreModules.core;

//NOTE: credentials that must never reach the logs, they are masked in the query string
const SENSITIVE_QS = /([?&](?:access_token|refresh_token|key)=)[^&]*/gi;

/**
 * Mask credentials in a url query string
 *
 * @param url
 * @returns {string|null}
 */
function redactUrl(url) {
    return url ? url.replace(SENSITIVE_QS, '$1***') : null;
}

/**
 * Build a compact and redacted context for an error response.
 * NOTE: headers are never included, they carry access_token, key, authorization and soajsinjectobj.
 *
 * @param err
 * @param req
 * @returns {Object}
 */
function errorContext(err, req) {
    let soajs = req.soajs || {};
    let serviceParams = (soajs.controller && soajs.controller.serviceParams) || {};
    let tenant = soajs.tenant || {};

    let code = null;
    let msg = null;
    if (typeof err === "number") {
        code = err;
        msg = core.error.generate(err).message;
    } else if (err && typeof err === "object") {
        code = err.code || err.status || null;
        msg = err.msg || err.message || null;
    }

    let context = {
        "code": code,
        "msg": msg,
        "method": req.method,
        "service": serviceParams.name || serviceParams.service_n || null,
        "version": serviceParams.version || null,
        "api": (serviceParams.parsedUrl && serviceParams.parsedUrl.pathname) || null,
        "url": redactUrl(req.url),
        "ip": req.getClientIP ? req.getClientIP() : null,
        "ua": req.getClientUserAgent ? req.getClientUserAgent() : null
    };
    if (tenant.id) {
        context.tenant = { "id": tenant.id, "code": tenant.code };
    }
    //NOTE: iKey only, the eKey is the credential the client authenticates with
    if (tenant.key && tenant.key.iKey) {
        context.iKey = tenant.key.iKey;
    }
    if (tenant.application) {
        context.application = {
            "product": tenant.application.product,
            "package": tenant.application.package
        };
    }
    if (soajs.uracDriver && soajs.uracDriver.username) {
        context.username = soajs.uracDriver.username;
    }
    return context;
}

//-------------------------- ERROR Handling MW - service & controller
/**
 *
 * @param err
 * @param req
 * @param res
 * @param next
 */
function logErrors(err, req, res, next) {
    if (typeof err === "number") {
        req.soajs.log.error(core.error.generate(err).message);
        return next(err);
    }
    if (typeof err === "object") {
        if (err.code && err.message) {
            req.soajs.log.error(err.message);
            if (err.name === "OAuth2Error") {
                return next({ "code": err.code, "status": err.code, "msg": err.message });
            } else {
                return next({ "code": err.code, "msg": err.message });
            }
        } else if (err.code && err.msg) {
            err.message = err.msg;
            req.soajs.log.error(err.message);
            return next(err);
        } else {
            req.soajs.log.error(err.message || err);
            req.soajs.log.error(core.error.generate(164).message);
        }
    } else {
        req.soajs.log.error(err);
        req.soajs.log.error(core.error.generate(164).message);
    }

    return next(core.error.getError(164));
}

//-------------------------- ERROR Handling MW - controller

/**
 *
 * @param err
 * @param req
 * @param res
 * @param next
 */
function controllerClientErrorHandler(err, req, res, next) {
    if (req.xhr) {
        req.soajs.log.error(core.error.generate(150));
        let errObj = core.error.getError(150);
        errObj.status = 500;
        return next(errObj);
    } else {
        return next(err);
    }
}

/**
 *
 * @param err
 * @param req
 * @param res
 * @param next
 */
function controllerErrorHandler(err, req, res, next) {

    if (req.soajs.log.error()) {
        req.soajs.log.error(JSON.stringify(errorContext(err, req)));
    }
    //NOTE: the full header dump stays at warn, it is a debugging aid and it is not redacted
    if (req.soajs.log.warn()) {
        req.soajs.log.warn(JSON.stringify({ "url": req.url, "headers": req.headers }));
    }

    if (err.code && err.msg) {
        err.status = err.status || 500;
        req.soajs.controllerResponse(err, next);
    } else {
        let errObj = core.error.getError(err);
        errObj.status = errObj.status || 500;
        req.soajs.controllerResponse(errObj, next);
    }
}

module.exports = {
    logErrors, // common for service and controllers\
    controllerClientErrorHandler,
    controllerErrorHandler
};