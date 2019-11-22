"use strict";

const helper = require("../../../helper.js");
const assert = require('assert');

describe("Testing awarenessEnv Custom", () => {

    let custom;

    before((done) => {
        custom = helper.requireModule('./mw/awarenessEnv/custom.js');
        done();
    });

    after((done) => {

        done();
    });

    it("test getControllerEnvHost 3 args", (done) => {
        custom.getControllerEnvHost(1, 'dashboard', (host) => {
            done();
        });
    });

    it("test getControllerEnvHost 4 args", (done) => {
        custom.getControllerEnvHost('controller', 1, 'dashboard', (host) => {
            // var coreModules = require ("soajs.core.modules");
            // var core = coreModules.core;
            // core.registry.reload();
            done();
        });
    });


});