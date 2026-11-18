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
	
	// the OAuth contract: the answers recorded on oauth2-server 2.4.1 (test/contract), in a process
	// of its own, before the use cases start their gateways
	it("keeps the OAuth contract (authorise)", function (done) {
		this.timeout(120000);
		const child = require("child_process").spawn(process.execPath, [__dirname + "/../contract/record.js", "--check"], {"env": process.env});
		let out = "";
		child.stdout.on("data", (d) => out += d);
		child.stderr.on("data", () => {});
		child.on("exit", (code) => {
			const lines = out.split("\n").filter((l) => l.startsWith("CONTRACT"));
			console.log(lines.join("\n"));
			done(code === 0 ? undefined : new Error("the OAuth contract changed:\n" + lines.join("\n")));
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
		
		
		// to test the tenant access resolver
		require("./UC5-tenant-access/index.js");
		
		
		// to test idempotency with the mongo model
		require("./UC6-idempotency/index.js");
		
		
		// to test cache invalidation with the mongo model
		require("./UC7-cache-invalidate/index.js");
		
		
		// to test the MCP endpoint /soajs/mcp
		require("./UC8-mcp/index.js");
		
		
		// to test that services only receive the soajsinjectobj the gateway builds
		require("./UC9-inject-header/index.js");
		
		
		// to test the graceful stop of a gateway process (last: it starts its own gateway on the same ports)
		require("./UC10-shutdown/index.js");
		
		done();
	});
});