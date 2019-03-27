"use strict";

const helper = require("../../../helper.js");
const mw = helper.requireModule('./mw/favicon/index');
const assert = require('assert');

describe("Unit test for: mw - favicon", function () {
    let req = {};
    let res = {
        "writeHead": (status, data) => {
            res.header[status] = data;
        },
        "header": {}
    };

    it("Install & Use the MW", function (done) {
        let mw_use = mw({});
        mw_use(req, res, () => {
            done();
        });
    });
    it("Run MW with favicon url", function (done) {
        let mw_use = mw({});
        req.url = "/favicon.ico";
        res.end = () => {
            done();
        };
        mw_use(req, res, () => {
        });
    });
});