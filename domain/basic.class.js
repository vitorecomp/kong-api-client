let Plugin = require('../libs/plugin.lib')
let Consumer = require('../libs/consumer.lib')



Plugin = new Plugin()
Consumer = new Consumer()


class BasicApi {
	constructor(Service) {

	}

	async getConsumers(limit) {
		return await Consumer.getAll(this.url, limit)
	}

	async getConsumer(id) {
		return await Consumer.getOne(this.url, id)
	}

	async addConsumer(consumer) {
		return await Consumer.add(this.url, consumer)
	}
	async updateConsumer(id, consumer) {
		return await Consumer.update(this.url, id, consumer)
	}
	async deleteConsumer(id) {
		return await Consumer.remove(this.url, id)
	}


	async getPlugins(limit) {
		return await Plugin.getAll(this.url, limit)
	}

	async getPlugin(id) {
		return await Plugin.getOne(this.url, id)
	}

	async addPlugin(plugin) {
		return await Plugin.add(this.url, plugin)
	}

	async updatePlugin(id, plugin) {
		return await Plugin.update(this.url, id, plugin)
	}

	async deletePlugin(id) {
		return await Plugin.remove(this.url, id)
	}
}

module.exports = BasicApi
