"use strict";

/**
 * A fake Kubernetes API server for the driver tests: it answers the calls the driver makes with
 * fixed JSON, as the API server does, and records each request it receives.
 */

const fs = require("fs");
const http = require("http");
const https = require("https");
const path = require("path");

// a self-signed certificate for 127.0.0.1, for the tests only
const tls = {
	"key": fs.readFileSync(path.join(__dirname, "../../../data/kubernetes/test-server.key")),
	"cert": fs.readFileSync(path.join(__dirname, "../../../data/kubernetes/test-server.crt"))
};

const services = {
	"kind": "ServiceList",
	"apiVersion": "v1",
	"metadata": {"resourceVersion": "12345"},
	"items": [
		{
			"metadata": {
				"name": "dev-urac-v3-service",
				"namespace": "soajs",
				"uid": "1c1d9c50-1111-4b7e-9a3c-000000000001",
				"resourceVersion": "100",
				"creationTimestamp": "2026-01-02T03:04:05Z",
				"labels": {"soajs.content": "true", "soajs.service.name": "urac", "soajs.service.version": "3", "soajs.env.code": "dev"},
				"annotations": {"note": "a/b"}
			},
			"spec": {
				"ports": [{"name": "service-port", "protocol": "TCP", "port": 4001, "targetPort": 4001}, {"name": "maintenance-port", "protocol": "TCP", "port": 5001, "targetPort": "maintenance"}],
				"selector": {"soajs.service.label": "dev-urac-v3"},
				"clusterIP": "10.0.0.11",
				"clusterIPs": ["10.0.0.11"],
				"type": "ClusterIP",
				"sessionAffinity": "None",
				"ipFamilies": ["IPv4"],
				"ipFamilyPolicy": "SingleStack",
				"internalTrafficPolicy": "Cluster"
			},
			"status": {"loadBalancer": {}}
		},
		{
			"metadata": {
				"name": "dev-urac-v3x1-service",
				"namespace": "soajs",
				"creationTimestamp": "2026-01-03T03:04:05Z",
				"labels": {"soajs.content": "true", "soajs.service.name": "urac", "soajs.service.version": "3x1", "soajs.env.code": "dev"}
			},
			"spec": {"ports": [{"protocol": "TCP", "port": 4001, "targetPort": 4001, "nodePort": 30001}], "clusterIP": "10.0.0.12", "type": "NodePort"},
			"status": {"loadBalancer": {}}
		},
		{
			"metadata": {
				"name": "dev-oauth-v1-service",
				"namespace": "soajs",
				"creationTimestamp": "2026-01-04T03:04:05Z",
				"labels": {"soajs.content": "true", "soajs.service.name": "oauth", "soajs.service.version": "1", "soajs.env.code": "dev"}
			},
			"spec": {"ports": [{"protocol": "TCP", "port": 4002, "targetPort": 4002}], "clusterIP": "10.0.0.13", "type": "LoadBalancer"},
			"status": {"loadBalancer": {"ingress": [{"ip": "203.0.113.7", "ipMode": "VIP"}]}}
		}
	]
};

const nodes = {
	"kind": "NodeList",
	"apiVersion": "v1",
	"metadata": {"resourceVersion": "999"},
	"items": [
		{
			"metadata": {"name": "node-a", "creationTimestamp": "2026-01-01T00:00:00Z", "labels": {"kubernetes.io/hostname": "node-a"}},
			"spec": {"podCIDR": "10.244.0.0/24"},
			"status": {
				"capacity": {"cpu": "4", "memory": "16374024Ki", "pods": "110"},
				"addresses": [{"type": "InternalIP", "address": "192.168.1.10"}, {"type": "Hostname", "address": "node-a"}],
				"conditions": [{"type": "Ready", "status": "True", "lastHeartbeatTime": "2026-11-18T10:00:00Z", "lastTransitionTime": "2026-01-01T00:00:00Z", "reason": "KubeletReady", "message": "kubelet is posting ready status"}]
			}
		}
	]
};

function status(code, reason, message) {
	return {"kind": "Status", "apiVersion": "v1", "metadata": {}, "status": "Failure", "message": message, "reason": reason, "code": code};
}

function start(cb) {
	const seen = [];
	let mode = "ok";
	const handler = (req, res) => {
		const url = new URL(req.url, "http://localhost");
		seen.push({
			"method": req.method,
			"path": url.pathname,
			"query": Object.fromEntries(url.searchParams),
			"authorization": req.headers.authorization || null
		});
		let code = 200;
		let body;
		if (mode === "forbidden") {
			code = 403;
			body = status(403, "Forbidden", 'services is forbidden: User "system:serviceaccount:soajs:default" cannot list resource "services" in API group "" in the namespace "soajs"');
		} else if (mode === "empty" && url.pathname.endsWith("/services")) {
			body = Object.assign({}, services, {"items": []});
		} else if (url.pathname === "/api/v1/namespaces/soajs/services") {
			const selector = url.searchParams.get("labelSelector") || "";
			const items = services.items.filter((s) => selector.split(",").every((term) => {
				if (!term) {
					return true;
				}
				const [k, v] = term.split("=");
				return s.metadata.labels[k] === v;
			}));
			body = Object.assign({}, services, {"items": items});
		} else if (url.pathname.startsWith("/api/v1/namespaces/soajs/services/")) {
			const name = url.pathname.split("/").pop();
			const item = services.items.find((s) => s.metadata.name === name);
			if (item) {
				body = Object.assign({"kind": "Service", "apiVersion": "v1"}, item);
			} else {
				code = 404;
				body = status(404, "NotFound", 'services "' + name + '" not found');
			}
		} else if (url.pathname === "/api/v1/nodes") {
			body = nodes;
		} else {
			code = 404;
			body = status(404, "NotFound", "the server could not find the requested resource");
		}
		res.writeHead(code, {"Content-Type": "application/json"});
		res.end(JSON.stringify(body));
	};
	// the same API over HTTP and over HTTPS
	const server = http.createServer(handler);
	const secure = https.createServer(tls, handler);
	server.listen(0, "127.0.0.1", () => {
		secure.listen(0, "127.0.0.1", () => {
			cb({
				"url": "http://127.0.0.1:" + server.address().port,
				"secureUrl": "https://127.0.0.1:" + secure.address().port,
				"ca": tls.cert.toString(),
				"seen": seen,
				"setMode": (m) => {
					mode = m;
				},
				"close": (done) => server.close(() => secure.close(done))
			});
		});
	});
}

module.exports = {start};
