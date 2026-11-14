'use strict';

/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

/**
 * The namespace part of a gateway host name in HA mode, from a registry's deployer:
 * - selected "container.kubernetes", container.kubernetes.namespace a string: "." + namespace;
 * - selected "container.kubernetes.<name>", container.kubernetes.<name>.namespace {default, perService}:
 *   "." + default, followed by perServiceSuffix when perService is set.
 * Anything else gives "".
 *
 * @param deployer registry.deployer
 * @param perServiceSuffix appended for a namespace with perService
 * @returns {string}
 */
module.exports = (deployer, perServiceSuffix) => {
	if (!deployer || typeof deployer.selected !== "string" || !deployer.container) {
		return "";
	}
	let info = deployer.selected.split(".");
	let platform = deployer.container[info[1]];
	if (!platform || typeof platform !== "object") {
		return "";
	}
	if (info.length === 2) {
		return (typeof platform.namespace === "string" && platform.namespace !== "") ? "." + platform.namespace : "";
	}
	let config = platform[info[2]];
	if (config && config.namespace && config.namespace.default) {
		let namespace = "." + config.namespace.default;
		if (config.namespace.perService) {
			namespace += perServiceSuffix;
		}
		return namespace;
	}
	return "";
};
