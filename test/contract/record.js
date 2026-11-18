"use strict";

/**
 * Records the gateway's OAuth contract (test/contract/authorise-contract.json) from the running
 * code: this gateway and the httpmethods mock service, on the integration data in the local
 * MongoDB (127.0.0.1:27017, dropped and imported). It was run on oauth2-server 2.4.1 before the
 * gateway moved to soajs.oauth2; the contract test compares with it.
 *
 *   node test/contract/record.js           records
 *   node test/contract/record.js --check   compares with the recording (exit 1 on a difference)
 */

// as the Gruntfile's integration run (env:mochaTest)
Object.assign(process.env, {
	"SOAJS_IMPORTER_DROPDB": "true", "SOAJS_ENV": "dev", "SOAJS_TEST": "true",
	"SOAJS_PROFILE": require("path").join(__dirname, "../../profiles/single.js"),
	"APP_DIR_FOR_CODE_COVERAGE": process.env.APP_DIR_FOR_CODE_COVERAGE || "../"
});
const fs = require("fs");
const path = require("path");
const imported = require("../data/import.js");
const contract = require("./cases.js");
const runner = require("./runner.js");
const tokens = require("./tokens.js");

const root = path.join(__dirname, "../..");

function start(cb) {
	const Controller = require(root + "/server/controller");
	const localConfig = require(root + "/config.js");
	const c = new Controller({
		"serviceName": localConfig.serviceName,
		"serviceVersion": localConfig.serviceVersion,
		"serviceGroup": localConfig.serviceGroup,
		"servicePort": localConfig.servicePort,
		"maintenance": localConfig.maintenance
	});
	c.init((registry, log, service, server, serverMaintenance) => {
		c.start(registry, log, service, server, serverMaintenance, () => {
			require(root + "/test/integration/UC2-http-methods/service-mock/index.js").startServer(null, () => {});
			setTimeout(cb, 5000);
		});
	});
}

imported.runPath(root + "/test/data/soajs_profile.js", root + "/test/data/provision/", true, null, (err) => {
	if (err) {
		console.log(err);
	}
	tokens.insert((error) => {
		if (error) {
			throw error;
		}
		start(() => {
			runner.run(contract.cases, (error, results) => {
				if (error) {
					throw error;
				}
				const file = path.join(__dirname, "authorise-contract.json");
				if (process.argv.includes("--check")) {
					// compare with the recording: status, headers and body, byte for byte
					const recorded = JSON.parse(fs.readFileSync(file).toString());
					let diffs = 0;
					for (const name of Object.keys(recorded)) {
						if (JSON.stringify(recorded[name]) !== JSON.stringify(results[name])) {
							diffs++;
							console.log("CONTRACT DIFF " + name + "\n  recorded " + JSON.stringify(recorded[name]) + "\n  now      " + JSON.stringify(results[name]));
						}
					}
					console.log("CONTRACT " + Object.keys(recorded).length + " answers, " + diffs + " different");
					process.exit(diffs ? 1 : 0);
				}
				fs.writeFileSync(file, JSON.stringify(results, null, "\t") + "\n");
				console.log("recorded " + Object.keys(results).length + " answers in " + file);
				process.exit(0);
			});
		});
	});
});
