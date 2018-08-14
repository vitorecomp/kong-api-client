let Plugin  = require('../libs/plugin.lib')
let Consumer  = require('../libs/consumer.lib')

class BasicApi {
	constructor(Service){
		
	}

	getConsumers(limit){
		return Consumer.getAll(url, limit)
	}
	getConsumer(id){
		return Consumer.getOne(url, id)
	}
	addConsumer(consumer){
		return Consumer.add(url, consumer)
	}
	updateConsumer(id, consumer){
		return Consumer.update(url, id, consumer)
	}
	deleteConsumer(id){
		return Consumer.remove(url, id)
	}
	
	
	async getPlugins(limit){
		return Plugin.getAll(url, limit)
	}
	
	getPlugin(id){
		return Plugin.getOne(url, id)
	}

	addPlugin(plugin){
		return Plugin.add(url, plugin)
	}
	updatePlugin(id, plugin){
		return Plugin.update(url, id, plugin)
	}
	deletePlugin(id){
		return Plugin.remove(url, id)
	}

	getOne(){}
}

module.exports  = BasicApi
