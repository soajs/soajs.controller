'use strict';

let prod = {
    "_id" : "5512867be603d7e01ab1688d",
    "locked" : true,
    "code" : "DSBRD",
    "name" : "Console UI Product",
    "description" : "This is the main Console UI Product.",
    "scope": {
        "acl": {
            "dev": {
                "urac": {
                    "2": {
                        "access": true,
                        "apisPermission": "restricted",
                        "get": [{
                            "group": "Guest",
                            "apis": {
                                "/user": {
                                    "access": false
                                },
                                "/luser": {
                                    "access": false
                                }
                            }
                        }, {
                            "group": "Login",
                            "apis": {
                                "/passport/login": {
                                    "access": true
                                }
                            }
                        }, {
                            "group": "Member",
                            "apis": {
                                "/muser/:id": {
                                    "access": true
                                }
                            }
                        }],
                    }
                },
                "dashboard": {
                    "1": {
                        "access": true,
                        "post": [
                            {
                                "group": "Continuous Delivery Deployment",
                                "apis": {
                                    "/cd/deploy": {
                                        "access": false
                                    }
                                }
                            }
                        ]
                    }
                },
                "oauth": {
                    "1": {
                        "access": false,
                        "delete": [
                            {
                                "group": "Tokenization",
                                "apis": {
                                    "/accessToken/:token": {
                                        "access": true
                                    }
                                }
                            },
                            {
                                "group": "Tokenization",
                                "apis": {
                                    "/refreshToken/:token": {
                                        "access": true
                                    }
                                }
                            }
                        ]
                    }
                }
            }
        }
    },
    "packages" : [
        {
            "code": "DSBRD_GUEST",
            "name": "Guest",
            "locked": true,
            "description": "This package is used to provide anyone access to login and forgot password. Once logged in the package linked to the user tenant will take over thus providing the right access to the logged in user.",
            "acl": {
                "dev": {
                    "urac": [
                        {
                            "version": "2",
                            "get": [
                                "Guest"
                            ]
                        }
                    ]
                }
            },
            "_TTL": 604800000
        },
        {
            "code": "DSBRD_OWNER",
            "name": "Owner",
            "description": "This package is used to provide owner level access. This means the user who has this package will have access to everything.",
            "locked": true,
            "acl": {
                "dev": {
                    "oauth": [
                        {
                            "version": "1",
                            "get": [
                                "Guest"
                            ],
                            "post": [
                                "Guest",

                            ],
                            "delete": [
                                "Tokenization"
                            ]
                        }
                    ],
                    "urac": [
                        {
                            "version": "2",
                            "get": [
                                "Guest",
                                "Login",
                                "Member"
                            ]
                        }
                    ],
                    "dashboard": [
                        {
                            "version": "1",
                            "post": [
                                "Private Tenant ACL"
                            ]
                        }
                    ]
                }
            },
            "_TTL": 604800000
        },
        {
            "code" : "DSBRD_DEVOP",
            "name" : "DevOps",
            "locked" : true,
            "description" : "This package has the right privileges a DevOps user will need to be able to configure, control, and monitor what is happening across the board.",
            "acl": {
                "dev": {
                    "oauth": [
                        {
                            "version": "1",
                            "delete": [
                                "Tokenization",
                                "User Tokenization",
                                "Cient Tokenization"
                            ],
                            "get": [
                                "Guest"
                            ],
                            "post": [
                                "Guest"
                            ]
                        }
                    ],
                    "urac": [
                        {
                            "version": "2",
                            "get": [
                                "Guest Email Account Settings",
                                "Tenant",
                                "My Account"
                            ],
                            "post": [
                                "My Account"
                            ]
                        }
                    ],
                    "dashboard": [
                        {
                            "version": "1",
                            "get": [
                                "Continuous Delivery",
                                "Environment",
                                "Templates",
                                "Environment Databases",
                                "Resources",
                                "Custom Registry",
                                "Environment Platforms",
                                "Tenant Settings",
                                "Services",
                                "Daemons",
                                "Hosts",
                                "HA Cloud",
                                "Catalog",
                                "Git Accounts",
                                "API Builder",
                                "Secrets",
                                "Dashboard Tenants",
                                "Product",
                                "Tenant",
                                "Tenant oAuth",
                                "Tenant Application"
                            ],
                            "post": [
                                "Continuous Delivery",
                                "Environment",
                                "Environment Databases",
                                "Resources",
                                "Custom Registry",
                                "Environment Platforms",
                                "Tenant Settings",
                                "Services",
                                "Daemons",
                                "Hosts",
                                "HA Cloud",
                                "Catalog",
                                "Git Accounts",
                                "API Builder",
                                "Secrets",
                                "swagger",
                                "Simulate",
                                "Continuous Delivery Deployment",
                                "Private Tenant ACL",
                                "Product",
                                "Tenant",
                                "Tenant oAuth",
                                "Tenant Application"
                            ],
                            "put": [
                                "Continuous Delivery",
                                "Environment",
                                "Environment Databases",
                                "Resources",
                                "Custom Registry",
                                "Environment Platforms",
                                "Tenant Settings",
                                "Services",
                                "HA Cloud",
                                "Catalog",
                                "Git Accounts",
                                "API Builder",
                                "Product",
                                "Tenant",
                                "Tenant oAuth",
                                "Tenant Application"
                            ],
                            "delete": [
                                "Environment",
                                "Environment Databases",
                                "Resources",
                                "Custom Registry",
                                "Environment Platforms",
                                "Tenant Settings",
                                "Daemons",
                                "HA Cloud",
                                "Catalog",
                                "Git Accounts",
                                "API Builder",
                                "Product",
                                "Tenant",
                                "Tenant oAuth",
                                "Tenant Application"
                            ]
                        }
                    ]
                }
            },
            "_TTL" : 604800000
        },
        {
            "code" : "DSBRD_DEVEL",
            "name" : "Developer",
            "locked" : true,
            "description" : "This package is ideal for a developer. You are not giving much access but yet it is enough to sail and fast.",
            "acl": {
                "dev": {
                    "oauth": [
                        {
                            "version": "1",
                            "delete": [
                                "Tokenization",
                                "User Tokenization",
                                "Cient Tokenization"
                            ],
                            "get": [
                                "Guest"
                            ],
                            "post": [
                                "Guest"
                            ]
                        }
                    ],
                    "urac": [
                        {
                            "version": "2",
                            "get": [
                                "My Account",
                                "Tenant",
                                "Guest Email Account Settings"
                            ],
                            "post": [
                                "My Account"
                            ]
                        }
                    ],
                    "dashboard": [
                        {
                            "version": "1",
                            "get": [
                                "Continuous Delivery",
                                "Environment",
                                "Templates",
                                "Environment Databases",
                                "Resources",
                                "Custom Registry",
                                "Environment Platforms",
                                "Services",
                                "Daemons",
                                "Hosts",
                                "HA Cloud",
                                "Catalog",
                                "Continuous Integration",
                                "Git Accounts",
                                "API Builder",
                                "Secrets"
                            ],
                            "post": [
                                "Continuous Delivery",
                                "Environment",
                                "Templates",
                                "Environment Databases",
                                "Resources",
                                "Custom Registry",
                                "Environment Platforms",
                                "Services",
                                "Daemons",
                                "Hosts",
                                "HA Cloud",
                                "Continuous Integration",
                                "Git Accounts",
                                "API Builder",
                                "Secrets",
                                "Private Tenant ACL",
                                "Continuous Delivery Deployment",
                                "Simulate",
                                "swagger"
                            ],
                            "put": [
                                "Continuous Delivery",
                                "Environment",
                                "Environment Databases",
                                "Resources",
                                "Custom Registry",
                                "Environment Platforms",
                                "Services",
                                "Daemons",
                                "HA Cloud",
                                "Continuous Integration",
                                "Git Accounts",
                                "API Builder"
                            ],
                            "delete": [
                                "Environment",
                                "Templates",
                                "Environment Databases",
                                "Resources",
                                "Custom Registry",
                                "Environment Platforms",
                                "Daemons",
                                "HA Cloud",
                                "Continuous Integration",
                                "Git Accounts",
                                "API Builder",
                                "Secrets"
                            ]
                        }
                    ]
                }
            },
            "_TTL" : 21600000
        }
    ]
};

module.exports = prod;