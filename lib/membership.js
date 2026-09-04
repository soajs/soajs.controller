'use strict';

/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

/**
 * Resolve the membership the caller holds for the product this request is made under.
 *
 * A membership is held per main product on the user record, and only its name is
 * stored. What the name grants is resolved from the catalog, it is never copied
 * onto the user:
 *
 *   "memberships": [{ "product": "AVAPP", "membership": "whale" }]
 *
 * A request carries the product of the key it was made with. That product is either
 * the main product itself or one of its sub products, and both resolve to the main
 * product, so a call made under CLUBS reads the AVAPP membership.
 *
 * Configured at registry.custom.gateway.value.membership, keyed by main product:
 *
 *   {
 *     "active": true,
 *     "AVAPP": ["CLUBS", "CORPS", "SECRT", "GRPCH"]
 *   }
 *
 * NOTE: this fails closed. An absent or inactive block, an unconfigured product, or
 *       a user with no entry for the resolved main product all resolve to null, and
 *       nothing is injected, so no service sees a membership it should not.
 *
 * @param config the custom registry membership block
 * @param product the product the request is made under, ex: keyObj.application.product
 * @param memberships the memberships array off the user record
 * @returns {string|null} the membership name, or null when it does not resolve
 */
function resolveMembership(config, product, memberships) {
	if (!config || !config.active) {
		return null;
	}
	if (!product || !Array.isArray(memberships) || memberships.length === 0) {
		return null;
	}

	//NOTE: product codes are matched exactly, they are uppercase by convention and
	//      normalizing here would hide a miscased entry in the registry
	let mainProduct = null;
	let configuredProducts = Object.keys(config).filter((key) => {
		return key !== "active";
	});
	for (let i = 0; i < configuredProducts.length; i++) {
		let key = configuredProducts[i];
		if (key === product || (Array.isArray(config[key]) && config[key].includes(product))) {
			mainProduct = key;
			break;
		}
	}
	if (!mainProduct) {
		return null;
	}

	for (let i = 0; i < memberships.length; i++) {
		let entry = memberships[i];
		if (entry && entry.product === mainProduct && entry.membership) {
			return entry.membership;
		}
	}
	return null;
}

module.exports = { resolveMembership };
