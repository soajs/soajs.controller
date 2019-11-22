"use strict";

const helper = require("../../../helper.js");
const mw = helper.requireModule('./mw/response/index');
const assert = require('assert');

describe("Unit test for: mw - response", function () {
    let req = {};
    let res = {
        "writeHead": () => {
        },
        "end": () => {
        }
    };

    it("Install & Use the MW", function (done) {
        let mw_use = mw({"controllerResponse": true});
        mw_use(req, res, () => {
            req.soajs.buildResponse([{"code": 200, "msg": "dummy200"}, {"code": 220, "msg": "dummy220"}]);
            req.soajs.buildResponse(null, "hello world");
            req.soajs.controllerResponse({"code": 200, "msg": "dummy200"});

            done();
        });
    });
});