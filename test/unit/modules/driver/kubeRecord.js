"use strict";

/**
 * Records the driver's outputs (test/data/kubernetes/driver-outputs.json). It was run once on
 * kubernetes-client 9.0.0, before the driver moved to @kubernetes/client-node; the unit test
 * compares the new driver with that recording.
 *
 *   node test/unit/modules/driver/kubeRecord.js
 */

const fs = require("fs");
const path = require("path");
require("./kubeScenarios.js").run((results) => {
	const file = path.join(__dirname, "../../../data/kubernetes/driver-outputs.json");
	fs.writeFileSync(file, JSON.stringify(results, null, "\t") + "\n");
	console.log("recorded " + Object.keys(results).length + " scenarios in " + file);
});
