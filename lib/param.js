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
	//param.serviceIp = process.env.SOAJS_SRVIP || null;
	param.serviceHATask = null;
	
	//automatically add maintenance to service
	if (!config.maintenance) {
		config.maintenance = {};
	}
	config.maintenance.port = {"type": "maintenance"};
	config.maintenance.readiness = "/heartbeat";
	if (!config.maintenance.commands) {
		config.maintenance.commands = [];
	}
	config.maintenance.commands.push({"label": "Releoad Registry", "path": "/reloadRegistry", "icon": "registry"});
	config.maintenance.commands.push({"label": "Statistics Info", "path": "/awarenessStat", "icon": "awareness"});
	config.maintenance.commands.push({
		"label": "Releoad Provision Info",
		"path": "/loadProvision",
		"icon": "provision"
	});
	
	//return param
	return {"config": config, "init": param};
};