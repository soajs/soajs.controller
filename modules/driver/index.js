/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

'use strict';

let BL = {
	init: init
};

const localConfig = {
	400: "Business logic required data are missing",
	501: "Item not found!",
	505: "Unable to get latest version!",
	702: "Driver error: "
};

function init() {
	
	// Load all Kubernetes BL
	const driver = require("./kubernetes/model/index.js");
	let temp = require("./kubernetes/index.js");
	temp.localConfig = localConfig;
	temp.driver = driver;
	BL.kubernetes = temp;
	
	temp = require("./kubernetes/bl/get.js");
	temp.localConfig = localConfig;
	temp.driver = driver;
	temp.handleError = BL.kubernetes.handleError;
	temp.handleConnect = BL.kubernetes.handleConnect;
	temp.handleConfiguration = BL.kubernetes.handleConfiguration;
	BL.kubernetes.get = temp;
	
}

module.exports = BL;