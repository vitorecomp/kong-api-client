let Plugin = require('../libs/plugin.lib');
let Consumer = require('../libs/consumer.lib');



const plugin = new Plugin();
const consumer = new Consumer();



class BasicApi {

	async getConsumers(limit = 100) {
		return await consumer.getAll(this.url, limit);
	}

	async getConsumer(id) {
		return await consumer.getOne(this.url, id);
	}

	async addConsumer(consumer) {
		return await consumer.add(this.url, consumer);
	}
	async updateConsumer(id, consumer) {
		return await consumer.update(this.url, id, consumer);
	}
	async deleteConsumer(id) {
		return await consumer.remove(this.url, id);
	}


	async getPlugins(limit) {
		return await plugin.getAll(this.url, limit);
	}

	async getPlugin(id) {
		return await plugin.getOne(this.url, id);
	}

	async addPlugin(plugin) {
		return await plugin.add(this.url, plugin);
	}

	async updatePlugin(id, plugin) {
		return await plugin.update(this.url, id, plugin);
	}

	async deletePlugin(id) {
		return await plugin.remove(this.url, id);
	}
}

module.exports = BasicApi;
