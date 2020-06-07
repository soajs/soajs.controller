'use strict';
let service = {
	_id: "5e1f35fdc5a59210a8152624",
	type: "service",
	name: "oauth",
	configuration: {
		subType: "soajs",
		port: 4002,
		group: "SOAJS Core Services",
		requestTimeout: 30,
		requestTimeoutRenewal: 5
	},
	description: "SOAJS authentication with oauth 0 and 2.0 support in addition to 3rd party aka Azure AD, Github, ...",
	metadata: {
		tags: [
			"authentication",
			"authorization"
		],
		program: [
			"soajs"
		]
	},
	settings: {
		acl: {},
		recipes: [],
		environments: {}
	},
	src: {
		provider: "github",
		owner: "soajs",
		repo: "soajs.oauth"
	},
	ui: {
		main: "Gateway",
		sub: ""
	},
	versions: [
		{
			version: "1",
			maintenance: {
				port: {
					type: "maintenance"
				},
				readiness: "/heartbeat",
				commands: [
					{
						label: "Releoad Provision",
						path: "/loadProvision",
						icon: "provision"
					},
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
			extKeyRequired: true,
			oauth: true,
			provision_ACL: false,
			tenant_Profile: false,
			urac: false,
			urac_ACL: false,
			urac_Config: false,
			urac_GroupConfig: false,
			urac_Profile: false,
			apis: [
				{
					l: "Get the authorization token",
					v: "/authorization",
					m: "get",
					group: "Guest"
				},
				{
					l: "Login Through Passport",
					v: "/passport/login/:strategy",
					m: "get",
					group: "Guest Login(s)"
				},
				{
					l: "Login Through Passport Callback",
					v: "/passport/validate/:strategy",
					m: "get",
					group: "Guest Login(s)"
				},
				{
					l: "OpenAM Login",
					v: "/openam/login",
					m: "post",
					group: "Guest Login(s)"
				},
				{
					l: "Ldap Login",
					v: "/ldap/login",
					m: "post",
					group: "Guest Login(s)"
				},
				{
					l: "Create an access token",
					v: "/token",
					m: "post",
					group: "Guest"
				},
				{
					l: "Create an access token with pin",
					v: "/pin",
					m: "post",
					group: "Tokenization"
				},
				{
					l: "Delete access token",
					v: "/accessToken/:token",
					m: "delete",
					group: "Tokenization"
				},
				{
					l: "Delete refresh token",
					v: "/refreshToken/:token",
					m: "delete",
					group: "Tokenization"
				},
				{
					l: "Delete all tokens for a given user",
					v: "/tokens/user/:userId",
					m: "delete",
					group: "User Tokenization"
				},
				{
					l: "Delete all tokens for this client (tenant)",
					v: "/tokens/tenant/:clientId",
					m: "delete",
					group: "Cient Tokenization"
				}
			],
			documentation: {}
		}
	]
};
module.exports = service;