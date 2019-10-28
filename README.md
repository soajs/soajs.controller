# soajs.controller
The Controller is the main gateway to all of SOAJS services.

##Installation

```sh
$ npm install soajs.controller
$ node.
```

---

###Self Awareness:
The controller's main functionality is to perform heartbeat checks on the remaining services.<br>
This approach allows the self awareness feature that SOAJS offers.

If a service is down or does not exist, the controller will return a message back to the sender without crashing.<br>
When a new service is created or added to the cloud, the controller will detect its presence.<br>
All requests to this new service will then be forwarded.

###Security:
When a request is made to a SOAJS service, the controller checks if this service is running, and accessible.<br>
Before forwarding the request or checking if the service is up and running, the controller makes performs some clearance checks:

1. Checks if the service needs a key and that the key is provided in the request and allows access to this service.
2. Retrieves the ACL of the tenant of this key and checks if the tenant has permission to use the requested service.
3. Performs a heartbeat check to make sure the service is alive.
4. Checks the Authorization of the header if the service requires authorization to be accessed like oAuth.
5. Forwards the request if all is ok.

###Cors:
SOAJS controller also provides support for CORS (Cross Origin Resource Sharing).

Enabling CORS allows different domains to communicate with SOAJS via its gateway to post and pull resources without having to deal with "cross-domain" issues and by simply using the standard protocols: GET - POST - DELETE - PUT.

---

More information on the Controller is available on the website section [Controller](http://www.soajs.org/#/documentation/controller)


### License
*Copyright SOAJS All Rights Reserved.*

Use of this source code is governed by an Apache license that can be found in the LICENSE file at the root of this repository.
