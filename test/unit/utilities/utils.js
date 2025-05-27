"use strict"
const helper = require("../../helper.js");

let utils = helper.requireModule('./utilities/utils.js');

describe("Testing utilities", () => {

	let res = {
		status: () => {
			return {
				send: (input2) => {
					return input2;
				}
			};
		},
		jsonp: () => {
			return 2;
		}
	};

	let req = {
		soajs: {
			log: {
				error: (input) => {
					// console.error(input);
				},
				warn: (input) => {
					// console.error(input);
				}
			},
			buildResponse: (input) => {
				return input;
			},
			controllerResponse: (input) => {
				return input;
			}
		}
	};

	it("logErrors - number error", (done) => {
		utils.logErrors(123, req, res, (error) => {
			done();
		});
	});

	it("logErrors - object, no code no message", (done) => {
		utils.logErrors({}, req, res, (error) => {
			done();
		});
	});

	it("logErrors - string error", (done) => {
		utils.logErrors("error", req, res, (error) => {
			done();
		});
	});

	it("controllerClientErrorHandler - request without xhr", (done) => {
		utils.controllerClientErrorHandler(null, req, res, () => {
			done();
		});
	});
	it("controllerClientErrorHandler - request xhr", (done) => {
		req.xhr = {};
		utils.controllerClientErrorHandler(null, req, res, () => {
			done();
		});
	});

	it("controllerErrorHandler - number error", (done) => {
		req.xhr = {};
		utils.controllerErrorHandler(150, req, res, null);
		done();
	});
	it("controllerErrorHandler - with error", (done) => {
		utils.controllerErrorHandler({ "code": 200, "msg": "dummy200" }, req, res, null);
		done();
	});
});