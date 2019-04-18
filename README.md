# kong-api-client

##Documentation

Work in progrees

##Start a simple api

let KongApi = require('../../index.js')
let config = {
	admin_url: 'http://' + process.env.KONG_IP + ':8001'
}
let kong = new KongApi(config)
kong.init()

###save new service

###add a plugin

###save a new custumer


###Complete documentation
    //add link here to the complete documentation
Work in progrees (Not working yet)

##Config

- add the code here as a basisic example

- show the capablitictes fo the contrutuctions

##Service

###Route

###Plugin

###Consumer

##Plugin

##Consumer

# Need fix
 - good msg on kong offline

# Road Map
 - add unit tests
 - add a dockerfile to up kong
 - add the plugins on the consumers (auth)
 - create the documantation
 - add the custom exception
 - add routes capabilite to add itens (plugins, consumers)
