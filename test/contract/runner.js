"use strict";

/**
 * Sends the contract's cases to the running gateway, and gives each answer as
 * {status, headers, body}. Token values (40 hex characters) in the body are replaced by
 * "<access_token>" / "<refresh_token>", and the headers that change on every answer (date,
 * connection, keep-alive, etag of a body with tokens) are left out or masked.
 */

const http = require("http");
const querystring = require("querystring");

const VOLATILE = ["date", "connection", "keep-alive", "transfer-encoding"];

function mask(body) {
	return body.replace(/"(access_token|refresh_token)":"[0-9a-f]{40}"/g, '"$1":"<$1>"');
}

function send(c, state, cb) {
	const headers = Object.assign({}, c.headers);
	let payload = null;
	if (c.form) {
		payload = querystring.stringify(typeof c.form === "function" ? c.form(state) : c.form);
		headers["content-type"] = "application/x-www-form-urlencoded";
	} else if (c.json) {
		payload = JSON.stringify(typeof c.json === "function" ? c.json(state) : c.json);
		headers["content-type"] = "application/json";
	}
	if (payload !== null) {
		headers["content-length"] = Buffer.byteLength(payload);
	}
	const req = http.request({"host": "127.0.0.1", "port": module.exports.port, "method": c.method || "POST", "path": c.path, "headers": headers}, (res) => {
		const chunks = [];
		res.on("data", (d) => chunks.push(d));
		res.on("end", () => {
			const raw = Buffer.concat(chunks).toString();
			const body = mask(raw);
			const out = {"status": res.statusCode, "headers": {}, "body": body};
			for (const name of Object.keys(res.headers).sort()) {
				if (VOLATILE.includes(name)) {
					continue;
				}
				out.headers[name] = (name === "etag" && body !== raw) ? "<etag>" : res.headers[name];
			}
			if (c.save) {
				try {
					state[c.save] = JSON.parse(raw);
				} catch (e) {
					state[c.save] = null;
				}
			}
			cb(null, out);
		});
	});
	req.on("error", cb);
	if (payload !== null) {
		req.write(payload);
	}
	req.end();
}

function run(cases, cb) {
	const state = {};
	const results = {};
	let i = 0;
	const next = () => {
		if (i >= cases.length) {
			return cb(null, results);
		}
		const c = cases[i++];
		send(c, state, (error, out) => {
			if (error) {
				return cb(error);
			}
			results[c.name] = out;
			next();
		});
	};
	next();
}

module.exports = {run, mask, "port": 4000};
