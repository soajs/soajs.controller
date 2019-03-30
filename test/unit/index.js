"use strict";

describe("Starting Gateway Unit test", () => {
    it("Init unit test", (done) => {
        done();
    });

    after((done) => {
        require("./lib/apiPathParam2apiRegExp.js");
        require("./lib/http.js");
        require("./lib/ip.js");
        require("./lib/param.js");
        require("./lib/parseURL.js");

        require("./mw/awarenessEnv/custom.js");
        require("./mw/awarenessEnv/ha.js");
        require("./mw/cors/index.js");
        require("./mw/enhancer/index.js");
        require("./mw/favicon/index.js");
        require("./mw/key/index.js");
        require("./mw/mt/index.js");
        require("./mw/oauth/index.js");
        require("./mw/response/index.js");
        require("./mw/soajs/index.js");
        require("./mw/traffic/index.js");

        require("./server/controller.js");
        require("./server/maintenance.js");

        require("./utilities/utils.js");
        done();
    });
});