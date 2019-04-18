# kong-api-client


Work in progrees

#Start a simple api
let KongApi = require('../../index.js')
let config = {
	admin_url: 'http://' + process.env.KONG_IP + ':8001'
}
let kong = new KongApi(config)
kong.init()

#save new service

#add a plugin

#save a new custumer


Complete documentation
    //add link here to the complete documentation
