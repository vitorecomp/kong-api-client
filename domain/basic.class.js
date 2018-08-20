let Plugin  = require('../libs/plugin.lib')
let Consumer  = require('../libs/consumer.lib')
let Route  = require('../libs/route.lib')


Plugin = new Plugin()
Consumer = new Consumer()
Route = new Route()

class BasicApi {
	constructor(Service){
		
	}

	getConsumers(limit){
		return Consumer.getAll(this.url, limit)
	}
	getConsumer(id){
		return Consumer.getOne(this.url, id)
	}
	addConsumer(consumer){
		return Consumer.add(this.url, consumer)
	}
	updateConsumer(id, consumer){
		return Consumer.update(this.url, id, consumer)
	}
	deleteConsumer(id){
		return Consumer.remove(this.url, id)
	}
	
	
	async getPlugins(limit){
		return Plugin.getAll(this.url, limit)
	}
	
	getPlugin(id){
		return Plugin.getOne(this.url, id)
	}

	addPlugin(plugin){
		return Plugin.add(this.url, plugin)
	}
	updatePlugin(id, plugin){
		return Plugin.update(this.url, id, plugin)
	}
	deletePlugin(id){
		return Plugin.remove(this.url, id)
	}

	async getPlugins(limit){
		return Plugin.getAll(this.url, limit)
	}
	
	getRoute(id){
		return Route.getOne(this.url, id)
	}
	addRoute(route){
		return Route.add(this.url, route)
	}
	updateRoute(id, route){
		return Route.update(this.url, id, route)
	}
	deleteRoute(id){
		return Route.remove(this.url, id)
	}
}

module.exports  = BasicApi
