'use strict';

/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

/*
 * return a param Object of config and init param
 */

module.exports = (config) => {
	//Assure config
	config = config || {};
	
	//Build init param
	let param = {};
	param.awareness = true;
	param.serviceName = config.serviceName;
	param.serviceVersion = config.serviceVersion;
	param.serviceGroup = config.serviceGroup;
	param.serviceHATask = null;
	param.maintenance = config.maintenance;
	
	return {"init": param};
};