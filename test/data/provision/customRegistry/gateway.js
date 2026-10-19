'use strict';
let doc = {
	"_id": "5d7f8e43edf21900fed08cf7",
	"name": "gateway",
	"locked": false,
	"plugged": true,
	"shared": false,
	"value": {
		"idempotency": {
			"model": "mongo",
			"services": {
				"idempotent": {
					"enabled": true,
					"ttl": 60000,
					"apis": ["POST /ok", "POST /fail", "POST /bad", "POST /slow", "POST /throttled"]
				}
			}
		},
		"traffic": {
			"throttling": {
				"idempotent": {
					"publicAPIStrategy": "idempotent_tight",
					"apis": ["/throttled"]
				}
			}
		}
	},
	"created": "DEV",
	"author": "owner"
};

module.exports = doc;
