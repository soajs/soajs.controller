'use strict';

let service = {
    _id: "5da078c92357684b57effced",
    group: "SOAJS test",
    maintenance: {
	    "port": {
		    "type": "maintenance"
	    },
	    "readiness": "/heartbeat",
	    "commands": [
		    {
			    "label": "My Command",
			    "path": "/wrench",
			    "icon": "wrench"
		    }
	    ]
    },
    name: "httpmethods",
    port: 4010,
    requestTimeout: 30,
    requestTimeoutRenewal: 5,
    swagger: true,
    versions: {
        "1": {
            oauth: true,
            extKeyRequired: true,
            urac: false,
            urac_Profile: false,
            urac_ACL: false,
            provision_ACL: false,
            apis: [
                {
                    l: "Route to test get",
                    v: "/myroute",
                    m: "get",
                    group: "Integration test"
                },
	            {
		            l: "Route to test post",
		            v: "/myroute",
		            m: "post",
		            group: "Integration test"
	            },
	            {
		            l: "Route to test put",
		            v: "/myroute",
		            m: "put",
		            group: "Integration test"
	            },
	            {
		            l: "Route to test delete",
		            v: "/myroute",
		            m: "delete",
		            group: "Integration test"
	            },
	            {
		            l: "Route to test patch",
		            v: "/myroute",
		            m: "patch",
		            group: "Integration test"
	            },
	            {
		            l: "Route to test head",
		            v: "/myroute",
		            m: "head",
		            group: "Integration test"
	            },
	            {
		            l: "Route to test other",
		            v: "/myroute",
		            m: "options",
		            group: "Integration test"
	            }
            ]
        }
    }
};
module.exports = service;