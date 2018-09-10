let test = async () => {


	let KongApi = require('../../index.js')
	let config = {
		admin_url: 'http://' + process.env.KONG_IP + ':8001',
		sync: true,
		plugins: [
			{
				name: 'jwt'
			}
		],
		consumers: [
			{
				username: 'admin',
				custom_id: 1010
			}
		]

	}

	console.log(process.env.KONG_IP)

	config.services = [{
		name: 'user-service',
		protocol: 'http',
		host: process.env.KONG_IP,
		port: 5000,
		routes: [{
			paths: [
				'/user-service'
			]
		}]
	}]
	let kong = new KongApi(config)

	kong.init()
	try {
		let consumer = await kong.addConsumer({
			username: 'basico',
			custom_id: 1
		})
	} catch (error) {
		console.log(error)
	}

	console.log(consumer)

	// try{
	// 	kongApi.addPlugin({
	// 		name:'jwt'
	// 	})
	// }catch(err){
	// 	console.log(err)
	// }
}

test()