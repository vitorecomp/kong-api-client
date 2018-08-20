let KongApi = require('../../index.js');

let kong = new KongApi({
	admin_url:"http://localhost:8001",
	sync:true,
	services:{
		name:'user-service',
		protocol:'http',
		host:'172.16.238.110',
		port:5000
	},
	plugins:[
		{
			name:'jwt'
		}
	],
	consumers:[
		{
			username:'admin',
			custom_id:1010
		}
	]
})

kong.init()
