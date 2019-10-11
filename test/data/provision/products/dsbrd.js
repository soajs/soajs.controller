'use strict';

let prod = {
	"_id": "5512867be603d7e01ab1688d",
	"locked": true,
	"code": "DSBRD",
	"name": "Console UI Product",
	"description": "This is the main Console UI Product.",
	"scope": {
		"acl": {
			"dev": {
				"httpmethods": {
					"1": {
						"access": true
					}
				},
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
	"packages": [
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
					"httpmethods": [
						{
							"version": "1"
						}
					],
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
		}
	]
};

module.exports = prod;