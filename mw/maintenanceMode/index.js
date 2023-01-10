'use strict';

/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

const get = (p, o) => p.reduce((xs, x) => (xs && xs[x]) ? xs[x] : null, o);

module.exports = () => {

	return (req, res, next) => {

		let maintenanceMode = get(["registry", "custom", "gateway", "value", "maintenanceMode"], req.soajs);
		if (maintenanceMode && maintenanceMode.on) {
			req.soajs.controllerResponse({
				'status': maintenanceMode.status || 503,
				'msg': maintenanceMode.message || "Maintenance mode is on, come back soon"
			});
		} else {
			return next();
		}
	};
};
