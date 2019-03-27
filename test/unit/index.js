"use strict";

describe("Starting Gateway Unit test", function () {
    it("Init unit test", function (done) {
        done();
    });

    after(function (done) {
        require("./lib/param.js");
        require("./lib/ip.js");
        require("./lib/http.js");
        require("./lib/apiPathParam2apiRegExp.js");

        require("./mw/cors/index.js");
        require("./mw/enhancer/index.js");
        require("./mw/favicon/index.js");
        require("./mw/response/index.js");
        require("./mw/soajs/index.js");

        require("./server/controller.js");
        require("./server/maintenance.js");
        done();
    });
});