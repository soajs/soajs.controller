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
		"cache": {
			"model": "mongo",
			"defaultTTL": 60000,
			"services": {
				"spaces": {
					"enabled": true,
					"apis": {
						"GET /spaces": { "enabled": true, "scope": "tenant_user" },
						"GET /space/:id": { "enabled": true, "scope": "tenant_user" },
						"GET /slow": { "enabled": true, "scope": "tenant_user" },
						"GET /catalog": { "enabled": true, "scope": "tenant" }
					}
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
