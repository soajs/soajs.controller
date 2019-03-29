#!/bin/bash

pushd ./provision
mongo ./environment.js
mongo ./hosts.js
mongo ./product.js
mongo ./services.js
mongo ./tenant.js
popd