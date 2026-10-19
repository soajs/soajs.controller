'use strict';

let token = {
    _id: "5cdc190fd52c82e0ddb1dcd8",
    type: "accessToken",
    token: "c4c4e5e5f6f6a7a7b8b8c9c9d0d0e1e1f2f2a301",
    clientId: "5c0e74ba9acc3c5a84a51259",
    user: {
        _id: "5c8d0c505653de3985aa2001",
        locked: true,
        username: "second_owner",
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
        id: "5c8d0c505653de3985aa2001"
    },
    env: "dev",
    expires: new Date((new Date().getFullYear()) + 2, 0, 1)
};
module.exports = token;