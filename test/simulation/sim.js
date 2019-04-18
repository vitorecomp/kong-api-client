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
	console.log("teste")

	// try{
	// 	kongApi.addPlugin({
	// 		name:'jwt'
	// 	})
	// }catch(err){
	// 	console.log(err)
	// }
}

test()
