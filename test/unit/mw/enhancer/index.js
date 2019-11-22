"use strict";

const helper = require("../../../helper.js");
const mw = helper.requireModule('./mw/enhancer/index');
const assert = require('assert');

describe("Unit test for: mw - enhancer", function () {
    let req = {
        headers: {
            referer: 'valueSetInReferer'
        }
    };
    let res = {};

    it("Install & Use the MW", function (done) {
        let mw_use = mw({});
        mw_use(req, res, () => {
            assert.ok(true);
            done();
        });
    });

    it("req.get with no param", function (done) {
        try {
            req.get();
        } catch (error) {
            assert.deepStrictEqual(error.toString(), 'TypeError: name argument is required to req.get');
            done();
        }
    });

    it("req.get with empty obect param", function (done) {
        try {
            req.get({});
        } catch (error) {
            assert.deepStrictEqual(error.toString(), 'TypeError: name must be a string to req.get');
            done();
        }
    });

    it("req.get with a valid param: referer", function (done) {
        let get = req.get("referer");
        assert.deepStrictEqual(get,'valueSetInReferer');
        done();
    });

});