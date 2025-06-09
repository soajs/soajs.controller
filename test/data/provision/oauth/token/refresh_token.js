'use strict';

let token = {
    _id: "5cf956a75e7924352af4dcf7",
    type: "refreshToken",
    token: "e1744ca81989274e052b9bb8f4f3b9f7a2400426",
    clientId: "5c0e74ba9acc3c5a84a51259",
    user: {
        _id: "5c8d0c505653de3985aa0ffd",
        locked: true,
        username: "owner",
        firstName: "owner3'sèį",
        lastName: "owner",
        email: "me@localhost.com",
        "ts": new Date().getTime(),
        status: "active",
        profile: {},
        groups: [
            "owner"
        ],
        config: {
            packages: {},
            keys: {},
            allowedTenants: [
                {
                    tenant: {
                        id: "THYME_tID",
                        code: "THYME_CODE",
                        pin: {
                            code: "5678",
                            allowed: true
                        }
                    },
                    groups: [
                        "waiter"
                    ]
                },
                {
                    tenant: {
                        id: "ELVIRA_tID",
                        code: "ELVIRA_CODE"
                    },
                    groups: [
                        "manager"
                    ]
                }
            ]
        },
        tenant: {
            id: "5c0e74ba9acc3c5a84a51259",
            code: "DBTN",
            pin: {
                code: "1235",
                allowed: true
            }
        },
        lastLogin: new Date().getTime(),
        groupsConfig: {
            allowedPackages: {
                DSBRD: [
                    "DSBRD_OWNER"
                ]
            },
            allowedEnvironments: {}
        },
        loginMode: "urac",
        id: "5c8d0c505653de3985aa0ffd"
    },
    env: "dev",
    expires: new Date((new Date().getFullYear()) + 3, 0, 1)
};
module.exports = token;
