'use strict';

/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

/**
 * Parse URL using WHATWG URL API and return object compatible with legacy url.parse()
 * @param {string} urlString - URL string to parse
 * @returns {Object} - Object with pathname, path, and query properties
 */
const parseURL = (urlString) => {
	const urlObj = new URL(urlString, 'http://localhost');
	const search = urlObj.search || '';
	return {
		pathname: urlObj.pathname,
		path: urlObj.pathname + search,
		query: Object.fromEntries(urlObj.searchParams)
	};
};


module.exports = (uri, parsedUrl) => {
	let serviceInfo = parsedUrl.pathname.split('/');
	let service_nv = serviceInfo[1];
	let service_n = service_nv;
	let service_v = null;

	//check if there is /v1 or v1.1 in the url
	let matches = uri.match(/\/v[0-9]+(.[0-9]+)?\//);
	if (matches && matches.length > 0) {
		let hit = matches[0].replace(/\//g, '');
		if (serviceInfo[2] === hit && serviceInfo.length > 3) {
			service_v = hit.replace("v", '');
			serviceInfo.splice(2, 1);
			uri = uri.replace(matches[0], "/");
			parsedUrl = parseURL(uri);
		}
	}
	
	//check if there is service:1 or :1.1 in the url
	if (!service_v) {
		let index = service_nv.indexOf(":");
		if (index !== -1) {
			matches = service_nv.match(/:[0-9]+(.[0-9]+)?/);
			if (matches && matches.length > 0) {
				service_v = service_nv.substr(index + 1);
			}
			service_n = service_nv.substr(0, index);
		}
	}
	let versionRequested = false;
	if (service_v !== null) {
		versionRequested = true;
	}
	return ({
		"url": uri,
		"parsedUrl": parsedUrl,
		"serviceInfo": serviceInfo,
		"service_n": service_n,
		"service_nv": service_nv,
		"service_v": service_v,
		"versionRequested": versionRequested,
		"name": service_n
	});
};
