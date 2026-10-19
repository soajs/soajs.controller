'use strict';

let token = {
    _id: "5cdc190fd52c82e0ddb1dcd7",
    type: "accessToken",
    token: "d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d902",
    clientId: "5c0e74ba9acc3c5a84a51260",
    user: {
        _id: "5c8d0c505653de3985aa1002",
        locked: true,
        username: "dept_outsider",
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
            id: "5c0e74ba9acc3c5a84a51260",
            code: "HOME",
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
        id: "5c8d0c505653de3985aa1002"
    },
    env: "dev",
    expires: new Date((new Date().getFullYear()) + 2, 0, 1)
};
module.exports = token;