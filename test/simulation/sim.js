let KongApi = require('../../index.js');
let config = {
	admin_url:"http://localhost:8001",
	sync:true,
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

}

config.services = [{
	name:'user-service',
	protocol:'http',
	host:'172.16.238.110',
	port:5000,
	routes: [{
		paths: [
			'/user-service'
		]
	}]
}]
let kong = new KongApi(config)

kong.init()

// try{
// 	kongApi.addPlugin({
// 		name:'jwt'
// 	})
// }catch(err){
// 	console.log(err)
// }
