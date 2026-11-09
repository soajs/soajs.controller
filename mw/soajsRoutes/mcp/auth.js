'use strict';

/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

/**
 * The MCP authorization flow (OAuth 2.1, RFC 9728, RFC 8414) for /soajs/mcp, on only when
 * registry.custom.gateway.value.mcp.auth is set. The gateway is the protected resource: it answers a
 * call without a valid token with 401 and the address of its metadata, and serves the metadata. The
 * authorization server (consent page, codes, PKCE, tokens) is not the gateway, the metadata points
 * at the endpoints the configuration names.
 *
 * Which endpoints: by the product of the key on the request (auth.byProduct), else by the host the
 * request came in on (auth.byHost), else auth.default.
 *
 * An MCP client sends the token only, no key. A token restricted to one key (user.restrictedTo.key)
 * brings it: /soajs/mcp without a key uses it, and with a key of the same product the token's key
 * replaces it.
 */

const get = (p, o) => p.reduce((xs, x) => (xs && xs[x]) ? xs[x] : null, o);

const MCP_PATH = "/soajs/mcp";
const ISSUER_PATH = MCP_PATH + "/auth/";
const PRM_PATH = "/.well-known/oauth-protected-resource";
const AS_PATHS = ["/.well-known/oauth-authorization-server", "/.well-known/openid-configuration"];

/**
 * The auth configuration: registry.custom.gateway.value.mcp.auth, when mcp is enabled.
 */
function getAuthConfig(req) {
	let mcp = get(["soajs", "registry", "custom", "gateway", "value", "mcp"], req);
	if (!mcp || mcp.enabled !== true || !mcp.auth || typeof mcp.auth !== "object") {
		return null;
	}
	return mcp.auth;
}

/**
 * An entry is usable when it names the authorization and token endpoints.
 */
function usable(entry) {
	return !!entry && typeof entry === "object" &&
		typeof entry.authorization_endpoint === "string" && entry.authorization_endpoint !== "" &&
		typeof entry.token_endpoint === "string" && entry.token_endpoint !== "";
}

function firstValue(header) {
	return (typeof header === "string") ? header.split(",")[0].trim() : null;
}

/**
 * The host the request came in on, and the origin the client sees.
 */
function requestHost(req) {
	return (firstValue(req.headers["x-forwarded-host"]) || req.headers.host || "").toLowerCase();
}

function requestOrigin(req) {
	let proto = firstValue(req.headers["x-forwarded-proto"]);
	if (!proto) {
		proto = (req.socket && req.socket.encrypted) ? "https" : "http";
	}
	return proto + "://" + requestHost(req);
}

function ownEntry(map, name) {
	if (!map || typeof map !== "object" || !name || !Object.hasOwnProperty.call(map, name)) {
		return null;
	}
	return usable(map[name]) ? map[name] : null;
}

/**
 * The entry for a request: by the product of its key, by its host, the default.
 *
 * @param cb (match) match: {id, entry} or null
 */
function resolveEntry(req, provision, auth, key, cb) {
	let byHost = () => {
		let entry = ownEntry(auth.byHost, requestHost(req));
		if (entry) {
			return cb({"id": "host", "entry": entry});
		}
		if (usable(auth.default)) {
			return cb({"id": "default", "entry": auth.default});
		}
		return cb(null);
	};
	if (!key || !auth.byProduct) {
		return byHost();
	}
	provision.getExternalKeyData(key, get(["soajs", "registry", "serviceConfig", "key"], req), (err, keyObj) => {
		let product = get(["application", "product"], keyObj);
		let entry = ownEntry(auth.byProduct, product);
		if (entry) {
			return cb({"id": "product/" + product, "entry": entry});
		}
		return byHost();
	});
}

/**
 * The entry an issuer id names, as resolveEntry gave it.
 */
function entryById(req, auth, id) {
	if (id === "host") {
		return ownEntry(auth.byHost, requestHost(req));
	}
	if (id === "default") {
		return usable(auth.default) ? auth.default : null;
	}
	if (id.indexOf("product/") === 0) {
		return ownEntry(auth.byProduct, id.substring("product/".length));
	}
	return null;
}

function issuer(req, id) {
	return requestOrigin(req) + ISSUER_PATH + id;
}

function sendJSON(res, status, body, headers) {
	let text = JSON.stringify(body);
	res.writeHead(status, Object.assign({
		"Content-Type": "application/json",
		"Content-Length": Buffer.byteLength(text),
		"Cache-Control": "no-store"
	}, headers || {}));
	res.end(text);
}

/**
 * 401 with the address of the protected resource metadata. A key the client put in the url stays
 * in it, the metadata is then chosen by the same product.
 */
function challenge(req, res, queryKey, invalidToken) {
	let metadata = requestOrigin(req) + PRM_PATH + MCP_PATH + (queryKey ? "?key=" + encodeURIComponent(queryKey) : "");
	let value = 'Bearer resource_metadata="' + metadata + '"';
	if (invalidToken) {
		value += ', error="invalid_token"';
	}
	sendJSON(res, 401, {
		"error": invalidToken ? "invalid_token" : "unauthorized",
		"error_description": invalidToken ? "The access token is invalid or has expired." : "Authorization required."
	}, {
		"WWW-Authenticate": value,
		"Access-Control-Expose-Headers": "WWW-Authenticate"
	});
}

function queryOf(url) {
	try {
		return new URL(url, "http://localhost").searchParams;
	} catch (e) {
		return new URLSearchParams();
	}
}

function pathOf(url) {
	let i = url.indexOf("?");
	return (i === -1) ? url : url.substring(0, i);
}

/**
 * The token of a request: the access_token header or query, or Authorization: Bearer.
 */
function tokenOf(req) {
	if (req.query && req.query.access_token) {
		return req.query.access_token;
	}
	if (req.headers.access_token) {
		return req.headers.access_token;
	}
	let matches = (req.headers.authorization || "").match(/^Bearer\s+(\S+)/i);
	return matches ? matches[1] : null;
}

/**
 * The key a token is restricted to, when it is exactly one.
 */
function tokenKey(record) {
	let key = get(["user", "restrictedTo", "key"], record);
	if (typeof key === "string" && key !== "") {
		return key;
	}
	if (Array.isArray(key) && key.length === 1 && typeof key[0] === "string" && key[0] !== "") {
		return key[0];
	}
	return null;
}

/**
 * GET /.well-known/oauth-protected-resource[/soajs/mcp] and
 * GET /.well-known/{oauth-authorization-server|openid-configuration}/soajs/mcp/auth/<id>,
 * before the url mw, which knows no service named .well-known.
 */
function wellKnown(configuration) {
	let provision = configuration.provision;

	return (req, res, next) => {
		let path = pathOf(req.url || "");
		if (path.indexOf("/.well-known/") !== 0) {
			return next();
		}
		let auth = getAuthConfig(req);
		if (!auth || (req.method !== "GET" && req.method !== "HEAD")) {
			return next();
		}
		if (path === PRM_PATH || path === PRM_PATH + MCP_PATH) {
			let queryKey = queryOf(req.url).get("key");
			return resolveEntry(req, provision, auth, queryKey, (match) => {
				if (!match) {
					return next();
				}
				return sendJSON(res, 200, {
					"resource": requestOrigin(req) + MCP_PATH + (queryKey ? "?key=" + encodeURIComponent(queryKey) : ""),
					"authorization_servers": [issuer(req, match.id)],
					"bearer_methods_supported": ["header"]
				});
			});
		}
		for (let i = 0; i < AS_PATHS.length; i++) {
			let prefix = AS_PATHS[i] + ISSUER_PATH;
			if (path.indexOf(prefix) === 0) {
				let id = decodeURIComponent(path.substring(prefix.length));
				let entry = entryById(req, auth, id);
				if (!entry) {
					return next();
				}
				let metadata = {
					"issuer": issuer(req, id),
					"authorization_endpoint": entry.authorization_endpoint,
					"token_endpoint": entry.token_endpoint,
					"response_types_supported": ["code"],
					"grant_types_supported": ["authorization_code"],
					"code_challenge_methods_supported": ["S256"],
					"token_endpoint_auth_methods_supported": ["none"]
				};
				if (typeof entry.registration_endpoint === "string" && entry.registration_endpoint !== "") {
					metadata.registration_endpoint = entry.registration_endpoint;
				}
				return sendJSON(res, 200, metadata);
			}
		}
		return next();
	};
}

/**
 * /soajs/mcp, after the url mw and before the key mw: the 401 when the caller must authorize, and
 * the key from a token restricted to one key.
 */
function authorize(configuration) {
	let provision = configuration.provision;

	return (req, res, next) => {
		let info = get(["soajs", "controller", "serviceParams", "serviceInfo"], req);
		if (!info || info[1] !== "soajs" || info[2] !== "mcp") {
			return next();
		}
		let auth = getAuthConfig(req);
		let mcp = get(["soajs", "registry", "custom", "gateway", "value", "mcp"], req);
		if (!mcp || mcp.enabled !== true) {
			return next();
		}
		let queryKey = (req.query && req.query.key) || null;
		let askToAuthorize = (invalidToken) => {
			if (!auth) {
				return next();
			}
			resolveEntry(req, provision, auth, req.headers.key, (match) => {
				if (!match) {
					return next();
				}
				return challenge(req, res, queryKey, invalidToken);
			});
		};

		let token = tokenOf(req);
		if (!token) {
			return askToAuthorize(false);
		}
		provision.oauthModel.getAccessToken(token, (err, record) => {
			if (err) {
				req.soajs.log.error("MCP: unable to read the access token: " + err.message);
				return next();
			}
			if (!record || (record.expires && new Date(record.expires).getTime() < Date.now())) {
				return askToAuthorize(true);
			}
			let restrictedKey = tokenKey(record);
			if (!restrictedKey || req.headers.key === restrictedKey) {
				return next();
			}
			if (!req.headers.key) {
				req.headers.key = restrictedKey;
				return next();
			}
			//NOTE: the url names a product, the token a key of it: the token's key. A key of another
			//		product is left as is, the oauth mw refuses the token on it (147).
			let keyConfig = get(["soajs", "registry", "serviceConfig", "key"], req);
			provision.getExternalKeyData(req.headers.key, keyConfig, (err, given) => {
				provision.getExternalKeyData(restrictedKey, keyConfig, (err, own) => {
					let givenProduct = get(["application", "product"], given);
					let ownProduct = get(["application", "product"], own);
					if (givenProduct && givenProduct === ownProduct) {
						req.headers.key = restrictedKey;
					}
					return next();
				});
			});
		});
	};
}

module.exports = {
	getAuthConfig,
	resolveEntry,
	entryById,
	requestOrigin,
	tokenOf,
	tokenKey,
	wellKnown,
	authorize
};
