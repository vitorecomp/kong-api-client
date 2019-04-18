# kong-api-client

This is a sdk, to the Kong Gateway Admin API (https://konghq.com/solutions/gateway/). The implemented endpois are:

- Services
- Custumers
- Plugins
- Routes

The version of the kong api, is 1.1.x decribed on https://docs.konghq.com/1.1.x/getting-started/introduction

Is possible to find examples on the examples folder, and the complete reference guide to this lib on
the documentation folder.

## How connect to the kong instance:

```
let KongApi = require('../../index.js')
let config = {
	admin_url: 'http://' + process.env.KONG_IP + ':8001'
}
let kong = new KongApi(config)
kong.init()
```
### How save new service:

### How update new service:

###save a new custumer


### Complete documentation
    //add link here to the complete documentation

# Need fix
 - good msg on kong offline

# Road Map
 - add unit tests
 - add a dockerfile to up kong
 - add the plugins on the consumers (auth)
 - create the documantation
 - add the custom exception
 - add routes capabilite to add itens (plugins, consumers)
