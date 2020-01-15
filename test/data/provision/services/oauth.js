'use strict';
let service = {
    _id: "5e1f35fdc5a59210a8152624",
    name: "oauth",
    group: "SOAJS Core Services",
    maintenance: {
        port: {
            type: "maintenance"
        },
        readiness: "/heartbeat",
        commands: [
            {
                label: "Releoad Registry",
                path: "/reloadRegistry",
                icon: "registry"
            },
            {
                label: "Resource Info",
                path: "/resourceInfo",
                icon: "info"
            }
        ]
    },
    port: 4004,
    requestTimeout: 30,
    requestTimeoutRenewal: 5,
    swagger: false,
    versions: {
        "1": {
            apis: [
	            {
		            l: "Get token",
		            v: "/token",
		            m: "get",
		            group: "Guest"
	            },
                {
                    l: "Login Through Passport",
                    v: "/passport/login/:strategy",
                    m: "get",
                    group: "Guest"
                },
                {
                    l: "Login Through Passport Validate",
                    v: "/passport/validate/:strategy",
                    m: "get",
                    group: "Guest"
                }
            ],
            extKeyRequired: true,
            oauth: true,
            provision_ACL: false,
            urac: false,
            urac_ACL: false,
            urac_Profile: false
        }
    }
};
module.exports = service;