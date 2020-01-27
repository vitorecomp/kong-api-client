# kong-api-client

[![Build Status](https://travis-ci.com/vitorecomp/kong-api-client.svg?branch=master)](https://travis-ci.com/vitorecomp/kong-api-client)

This is a sdk, to the Kong Gateway Admin API <https://konghq.com/solutions/gateway/>. The implemented endpois are:

- Services
- Custumers
- Plugins
- Routes

The version of the kong api, is 1.1.x decribed on <https://docs.konghq.com/1.1.x/getting-started/introduction>

Is possible to find examples on the examples folder, and the complete reference guide to this lib on
the documentation folder.

## How connect to the kong instance

```javascript

let KongApi = require('../../index.js')
let config = {
    admin_url: 'http://' + process.env.KONG_IP + ':8001'
}
let kong = new KongApi(config)
kong.init()

```

### How save new service

```javascript

let KongApi = require('../../index.js')
let config = {
    admin_url: 'http://' + process.env.KONG_IP + ':8001'
}
let kong = new KongApi(config)
kong.init()

```

### How update new service

```javascript

let KongApi = require('../../index.js')
let config = {
    admin_url: 'http://' + process.env.KONG_IP + ':8001'
}
let kong = new KongApi(config)
kong.init()

```

### Save a new custumer

```javascript

let KongApi = require('../../index.js')
let config = {
    admin_url: 'http://' + process.env.KONG_IP + ':8001'
}
let kong = new KongApi(config)
kong.init()

```

### Complete documentation

> Init Api [contructor](./documentation/init.md)
> Services Api [domains](./documentation/services.md)
> Consumers Api [consumers](./documentation/consumers.md)
> Route Api [routes](./documentation/routes.md)
> Plugin Api [plugins](./documentation/plugins.md)

## Need fix

- Better error msg in case of offline kong server

## Road Map

- add unit tests
- add a dockerfile to up kong
- add the plugins on the consumers (auth)
- create the documantation
- add the custom exception
- add routes capabilite to add itens (plugins, consumers)
