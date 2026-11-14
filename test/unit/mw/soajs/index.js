"use strict";

const helper = require("../../../helper.js");
const mw = helper.requireModule('./mw/soajs/index');
const assert = require('assert');

describe("Unit test for: mw - soajs", function () {
    let req = {};
    let res = {};
    let core = {
        "registry": {
            "get": () => {
            }
        },
        "meta": "",
        "validator": ""
    };
    let log = {};

    it("Install & Use the MW", function (done) {
        let mw_use = mw({"log": log, "core": core});
        mw_use(req, res, () => {
            done();
        });
    });

    it("Removes a soajsinjectobj that comes with the request", function (done) {
        let mw_use = mw({"log": log, "core": core});
        let request = {"headers": {"soajsinjectobj": "{\"tenant\":{}}", "key": "k"}};
        mw_use(request, res, () => {
            assert.strictEqual(request.headers.soajsinjectobj, undefined);
            assert.strictEqual(request.headers.key, "k");
            done();
        });
    });
});