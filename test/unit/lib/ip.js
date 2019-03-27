"use strict";

const helper = require("../../helper.js");
const libIp = helper.requireModule('./lib/ip');
const assert = require('assert');

describe("Unit test for: lib - ip", function () {
    let what2expect = {ip: '127.0.0.1', HATask: null, fetched: null};
    it("Vanilla test - autoRegHost=false", function (done) {
        libIp(false, (service) => {
            assert.deepStrictEqual(service, what2expect, "lib.ip vanilla test failed what2expect");
            done();
        })
    });
    it("Vanilla test - autoRegHost=true", function (done) {
        libIp(true, (service) => {
            assert.ok(service.ip);
            done();
        })
    });
});