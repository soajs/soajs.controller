'use strict';

/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

const async = require("async");
const soajsCoreLibs = require("soajs.core.libs");

let bl = {
	"localConfig": null,
	"handleError": null,
	"handleConnect": null,
	"handleConfiguration": null,
	"driver": null,
	
	"all": (soajs, inputmaskData, options, cb) => {
		if (!inputmaskData) {
			return cb(bl.handleError(soajs, 400, null));
		}
		bl.handleConnect(soajs, inputmaskData.configuration, (error, client, config) => {
			if (error) {
				return cb(bl.handleError(soajs, 702, error));
			}
			if (!inputmaskData.filter) {
				inputmaskData.filter = {};
			}
			inputmaskData.filter.labelSelector = "soajs.content=true";
			
			
			bl.driver.get.all.service(client, {
				"namespace": config.namespace,
				"filter": inputmaskData.filter
			}, (error, response) => {
				if (error) {
					return cb(bl.handleError(soajs, 702, error));
				}
				if (response && response.items && Array.isArray(response.items) && response.items.length > 0) {
					return cb(null, response.items);
				} else {
					return cb(bl.handleError(soajs, 501, null));
				}
			});
		});
	},
	
	"item_latestVersion": (soajs, inputmaskData, options, cb) => {
		if (!inputmaskData) {
			return cb(bl.handleError(soajs, 400, null));
		}
		bl.handleConnect(soajs, inputmaskData.configuration, (error, client, config) => {
			if (error) {
				return cb(bl.handleError(soajs, 702, error));
			}
			
			let filter = {"labelSelector": 'soajs.service.name=' + inputmaskData.itemName};
			bl.driver.get.all.service(client, {
				"namespace": config.namespace,
				"filter": filter
			}, (error, result) => {
				if (error) {
					return cb(bl.handleError(soajs, 702, error));
				} else {
					let items = result.items;
					let latestVersion = null;
					
					if (items && Array.isArray(items) && items.length > 0) {
						
						let checkVersion = (item, callback) => {
							if (item.metadata && item.metadata.labels && item.metadata.labels['soajs.service.version']) {
								let itemVersion = soajsCoreLibs.version.unsanitize(item.metadata.labels['soajs.service.version']);
								latestVersion = soajsCoreLibs.version.getLatest(itemVersion, latestVersion);
							}
							callback(null);
						};
						//async
						async.eachSeries(items, checkVersion, function (error) {
							if (error) {
								return cb(bl.handleError(soajs, 702, error));
							}
							if (latestVersion !== null) {
								return cb(null, latestVersion);
							} else {
								return cb(bl.handleError(soajs, 505, null));
							}
						});
					} else {
						return cb(bl.handleError(soajs, 501, null));
					}
				}
			});
		});
	},
	"host": (soajs, inputmaskData, options, cb) => {
		if (!inputmaskData || !inputmaskData.item || !inputmaskData.item.name || !inputmaskData.item.version || !inputmaskData.item.env) {
			return cb(bl.handleError(soajs, 400, null));
		}
		bl.handleConnect(soajs, inputmaskData.configuration, (error, client, config) => {
			if (error) {
				return cb(bl.handleError(soajs, 702, error));
			}
			let sanytized_version = soajsCoreLibs.version.sanitize(inputmaskData.item.version);
			let label_sanytized = inputmaskData.item.env + "-" + inputmaskData.item.name + "-v" + sanytized_version;
			let name = label_sanytized + "-service";
			bl.driver.get.serviceIps(client, {
				"namespace": config.namespace,
				"name": name
			}, (error, response) => {
				if (error) {
					return cb(bl.handleError(soajs, 702, error));
				}
				return cb(null, response.ip);
			});
		});
	}
};
module.exports = bl;