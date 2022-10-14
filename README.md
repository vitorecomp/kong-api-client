# kong-api-client

[![Build Status](https://travis-ci.com/vitorecomp/kong-api-client.svg?branch=master)](https://travis-ci.com/vitorecomp/kong-api-client)
[![codecov](https://codecov.io/gh/vitorecomp/kong-api-client/branch/master/graph/badge.svg)](https://codecov.io/gh/vitorecomp/kong-api-client)

## Desciption

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

await kong.addService({
    protocol: 'http',
    host: 'www.test.com',
    port: 8080,
    name: 'teste'
});

```

### How update a service host

```javascript

let KongApi = require('../../index.js')
let config = {
    admin_url: 'http://' + process.env.KONG_IP + ':8001'
}
let kong = new KongApi(config)
kong.init()

await kong.updateService(testHostId, {
    host: "www.newtest.com"
});

```

### Save a new custumer

```javascript

let KongApi = require('../../index.js')
let config = {
    admin_url: 'http://' + process.env.KONG_IP + ':8001'
}
let kong = new KongApi(config)
kong.init()

await kong.addConsumer({
    username: 'my-username',
    custom_id: 'my-custom-id',
});

```

## Complete documentation

### [Builder Api](./documentation/init.md)

> This is the block of documentations that will define the base objects that the lib will use and/or recive from kong.

### [Services Api](./documentation/services.md)

> In this block of documentations will be defined interact with the kong services using the lib.

### [Routes Api](./documentation/routes.md)

> In this block of documentations will be defined interact with the kong routes using the lib.

### [Consumers Api](./documentation/consumers.md)

> In this block of documentations will be defined interact with the kong consumers using the lib.

### [Plugins Api](./documentation/plugins.md)

> In this block of documentations will be defined interact with the kong plugins using the lib.

## Need fix

- Better error msg in case of offline kong server
- User jest expect thorw on the tests

## Road Map

- add unit tests
    -- builder (done)
- add a dockerfile to up kong (Done)
- add the plugins on the consumers (auth)
- create the documantation
    -- main readme (done)
    -- contructor
    -- domains
    -- routes
    -- consumers
    -- plugins
- add the custom exception (done)
- add routes capabilite to add itens (plugins, consumers)
