'use strict';
const url = require('url');
let libParseURL = require('../../lib/parseURL');

/**
 * Assure req param (soajs & soajs.controller)
 * Parse url and fetch service info (soajs.controller.serviceParams)
 * Assure key as header param
 *
 * @param configuration
 * @returns {Function}
 */
module.exports = (configuration) => {
    return (req, res, next) => {
        if (!req.soajs) {
            throw new TypeError('soajs mw is not started');
        }

        if (!req.soajs.controller) {
            req.soajs.controller = {};
        }

        let parsedUrl = url.parse(req.url, true);
        if (!req.query && parsedUrl.query) {
            req.query = parsedUrl.query;
        }

        if (!req.query) {
            req.query = {};
        }
        req.soajs.controller.serviceParams = libParseURL (req.url, parsedUrl);
        /*
        let serviceInfo = parsedUrl.pathname.split('/');
        let service_nv = serviceInfo[1];
        let service_n = service_nv;
        let service_v = null;

        //check if there is /v1 or v1.1 in the url
        let matches = req.url.match(/\/v[0-9]+(.[0-9]+)?\//);
        if (matches && matches.length > 0) {
            let hit = matches[0].replace(/\//g, '');
            if (serviceInfo[2] === hit && serviceInfo.length > 3) {
                service_v = hit.replace("v", '');
                serviceInfo.splice(2, 1);
                req.url = req.url.replace(matches[0], "/");
                parsedUrl = url.parse(req.url, true);
            }
        }

        //check if there is service:1 or :1.1 in the url
        if (!service_v) {
            let index = service_nv.indexOf(":");
            if (index !== -1) {
                matches = service_nv.match(/:[0-9]+(.[0-9]+)?/);
                if (matches && matches.length > 0) {
                    service_v = service_nv.substr(index + 1);
                }
                service_n = service_nv.substr(0, index);
            }
        }
        req.soajs.controller.serviceParams = {
            "parsedUrl": parsedUrl,
            "serviceInfo": serviceInfo,
            "service_n": service_n,
            "service_nv": service_nv,
            "service_v": service_v,
            "name": service_n
        };
        */
        let key = req.headers.key || parsedUrl.query.key;
        if (!req.headers.key) {
            req.headers.key = key;
        }
        return next();
    };
};