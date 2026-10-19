'use strict';
let doc = {
	"_id": "5d7f8e43edf21900fed08cf6",
	"name": "urac",
	"locked": false,
	"plugged": true,
	"shared": false,
	"value": {
		"tenantAccessResolvers": {
			"department": {
				"service": "departments",
				"version": "1",
				"api": "/tenant/access",
				"timeout": 1000
			}
		}
	},
	"created": "DEV",
	"author": "owner"
};

module.exports = doc;
