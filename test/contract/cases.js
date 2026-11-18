"use strict";

/**
 * The requests of the gateway's OAuth contract (authorise): every answer a client may get when
 * calling a service whose version has oauth, success and each error, with the token in the
 * Authorization header, the query or the body.
 */

// the integration data's key and tokens (test values)
const KEY = "3d90163cf9d6b3076ad26aa5ed58556348069258e5c6c941ee0f18448b570ad1c5c790e2d2a1989680c55f4904e2005ff5f8e71606e4aa641e67882f4210ebbc5460ff305dcb36e6ec2a2299cf0448ef60b9e38f41950ec251c1cf41f05f3ce9";
const VALID = "cfb209a91b23896820f510aadbf1f4284b512123";
const REFRESH = "e1744ca81989274e052b9bb8f4f3b9f7a2400426";
// access tokens inserted by record.js (test values)
const EXPIRED = "c0ffee00000000000000000000000000000000a1";
const NEVER_EXPIRES = "c0ffee00000000000000000000000000000000a2";
const STRING_EXPIRES = "c0ffee00000000000000000000000000000000a3";
const NO_EXPIRES = "c0ffee00000000000000000000000000000000a4";

const PATH = "/httpmethods/myroute";

const cases = [
	{"name": "no token", "method": "GET", "path": PATH, "headers": {"key": KEY}},
	{"name": "header bearer", "method": "GET", "path": PATH, "headers": {"key": KEY, "authorization": "Bearer " + VALID}},
	{"name": "header bearer lowercase", "method": "GET", "path": PATH, "headers": {"key": KEY, "authorization": "bearer " + VALID}},
	{"name": "header bearer inside", "method": "GET", "path": PATH, "headers": {"key": KEY, "authorization": "xBearer " + VALID}},
	{"name": "header bearer twice", "method": "GET", "path": PATH, "headers": {"key": KEY, "authorization": "Bearer " + VALID + " Bearer x"}},
	{"name": "header token scheme", "method": "GET", "path": PATH, "headers": {"key": KEY, "authorization": "Token abc"}},
	{"name": "header bearer empty", "method": "GET", "path": PATH, "headers": {"key": KEY, "authorization": "Bearer "}},
	{"name": "query", "method": "GET", "path": PATH + "?access_token=" + VALID, "headers": {"key": KEY}},
	{"name": "query empty", "method": "GET", "path": PATH + "?access_token=", "headers": {"key": KEY}},
	{"name": "header and query", "method": "GET", "path": PATH + "?access_token=" + VALID, "headers": {"key": KEY, "authorization": "Bearer " + VALID}},
	{"name": "body form post", "method": "POST", "path": PATH, "headers": {"key": KEY}, "form": {"access_token": VALID, "a": "1"}},
	{"name": "body json post", "method": "POST", "path": PATH, "headers": {"key": KEY}, "json": {"access_token": VALID}},
	{"name": "body form get", "method": "GET", "path": PATH, "headers": {"key": KEY}, "form": {"access_token": VALID}},
	{"name": "body and header", "method": "POST", "path": PATH, "headers": {"key": KEY, "authorization": "Bearer " + VALID}, "form": {"access_token": VALID}},
	{"name": "body and query", "method": "POST", "path": PATH + "?access_token=" + VALID, "headers": {"key": KEY}, "form": {"access_token": VALID}},
	{"name": "invalid token", "method": "GET", "path": PATH, "headers": {"key": KEY, "authorization": "Bearer 0000000000000000000000000000000000000000"}},
	{"name": "invalid token query", "method": "GET", "path": PATH + "?access_token=nope123", "headers": {"key": KEY}},
	{"name": "refresh token as access token", "method": "GET", "path": PATH, "headers": {"key": KEY, "authorization": "Bearer " + REFRESH}},
	{"name": "expired token", "before": EXPIRED, "method": "GET", "path": PATH, "headers": {"key": KEY, "authorization": "Bearer " + EXPIRED}},
	{"name": "token expires null", "method": "GET", "path": PATH, "headers": {"key": KEY, "authorization": "Bearer " + NEVER_EXPIRES}},
	{"name": "token expires string", "method": "GET", "path": PATH, "headers": {"key": KEY, "authorization": "Bearer " + STRING_EXPIRES}},
	{"name": "token without expires", "method": "GET", "path": PATH, "headers": {"key": KEY, "authorization": "Bearer " + NO_EXPIRES}},
	{"name": "put with header", "method": "PUT", "path": PATH, "headers": {"key": KEY, "authorization": "Bearer " + VALID}, "json": {"a": 1}},
	{"name": "delete with query", "method": "DELETE", "path": PATH + "?access_token=" + VALID, "headers": {"key": KEY}}
];

module.exports = {cases, VALID, EXPIRED, NEVER_EXPIRES, STRING_EXPIRES, NO_EXPIRES};
