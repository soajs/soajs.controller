"use strict";
const assert = require('assert');
const shell = require('shelljs');
let sampleData = require("../data/index");

describe("starting integration tests", () => {

    it("do import", (done) => {
        shell.pushd(sampleData.dir);
        shell.exec("chmod +x " + sampleData.shell, (code) => {
            assert.equal(code, 0);
            shell.exec(sampleData.shell, (code) => {
                assert.equal(code, 0);
                shell.popd();
                done();
            });
        });
    });

    it("loading tests", (done) => {

        // to cover specific routes key/permission/get & proxy/redirect
        require("./usecase1/index.js");



        done();
    });
});