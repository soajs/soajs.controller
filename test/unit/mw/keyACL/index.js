"use strict";

const helper = require("../../../helper.js");
const mw = helper.requireModule('./mw/keyACL/index');
const assert = require('assert');

let req = {
    method: "get",
    soajs: {
        controller: {
            serviceParams: {
                service_v: 2,
                name: 'urac'
            }
        },
        log: {
            debug: (msg) => {
                console.log(msg);
            }
        }
    }
};
let res = {};

describe("Unit test for: mw - keyACL", function () {
    req.soajs.controller.serviceParams.keyObj = require('../../../data/sample/keyObj.json');
    req.soajs.controller.serviceParams.packObj = require('../../../data/sample/packObj.json');

    it("Install & Use the MW", function (done) {
        let mw_use = mw({});
        mw_use(req, res, () => {
            assert.ok(req.soajs.controller.serviceParams.finalAcl);
            done();
        });
    });
});