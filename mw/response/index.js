'use strict';

const SoajsRes = require("./response.js");

/**
 *
 * @param configuration
 * @returns {Function}
 */
module.exports = (configuration) => {
    return (req, res, next) => {
        if (!req.soajs) {
            req.soajs = {};
        }
        req.soajs.buildResponse = function (error, data) {
            let response = null;
            if (error) {
                response = new SoajsRes(false);
                if (Array.isArray(error)) {
                    let len = error.length;
                    for (let i = 0; i < len; i++) {
                        response.addErrorCode(error[i].code, error[i].msg);
                    }
                }
                else {
                    response.addErrorCode(error.code, error.msg);
                }
            }
            else {
                response = new SoajsRes(true, data);
            }

            return response;
        };
        if (configuration && configuration.controllerResponse) {
            req.soajs.controllerResponse = function (jsonObj) {
                let jsonRes = jsonObj;
                if (req.soajs.buildResponse && jsonObj.code && jsonObj.msg)
                    jsonRes = req.soajs.buildResponse(jsonObj);


                let headObj = jsonObj.headObj || {};
                headObj['Content-Type'] = 'application/json';
                if (!res.headersSent) {
                    if (jsonObj.status)
                        res.writeHead(jsonObj.status, headObj);
                    else
                        res.writeHead(200, headObj);
                }
                res.end(JSON.stringify(jsonRes));
            };
        }
        return next();
    };
};

