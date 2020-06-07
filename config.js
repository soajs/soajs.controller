"use strict";

/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

let config = {
	"type": 'service',
	"prerequisites": {
		"cpu": '',
		"memory": ''
	},
	"serviceVersion": "1",
	"serviceName": "controller",
	"serviceGroup": "Gateway",
	"servicePort": 4000,
	"maintenance": {
		"readiness": "/heartbeat",
		"port": {"type": "maintenance"},
		"commands": [
			{"label": "Reload Provision", "path": "/loadProvision", "icon": "fas fa-download"},
			{"label": "Reload Registry", "path": "/reloadRegistry", "icon": "fas fa-undo"},
			{"label": "Reload Awareness", "path": "/awarenessStat", "icon": "fas fa-wifi"}
		]
	}
};

module.exports = config;
