"use strict";
const imported = require("../data/import.js");

describe("starting integration tests", () => {
	
	it("do import", (done) => {
		let rootPath = process.cwd();
		imported.runPath(rootPath + "/test/data/soajs_profile.js", rootPath + "/test/data/provision/", true, null, (err, msg) => {
		//  imported(rootPath + "/test/data/soajs_profile.js", rootPath + "/test/data/provision/", (err, msg) => {
			if (err)
				console.log(err);
			if (msg)
				console.log(msg);
			
			done();
		});
	});
	
	it("loading tests", (done) => {
		
		require("./server/controller.js");
		require("./server/maintenance.js");
		
		done();
	});
	it("loading use cases", (done) => {
		
		// to cover specific routes key/permission/get & proxy/redirect
		require("./UC1-gateway-routes/index.js");
		
		
		// to test all http methods
		require("./UC2-http-methods/index.js");
		
		
		// to test roaming
		require("./UC3-roaming/index.js");
		
		done();
	});
});