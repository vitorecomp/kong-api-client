import Plugin from '../libs/plugin.lib';
import Consumer from '../libs/consumer.lib';

export default class BasicApi {
	async addConsumers(consumers) {
		let proms = consumers.map(async (e) => {
			await this.addConsumer(e);
		});
		await Promise.all(proms);
	}

	async findConsumers(limit = 100) {
		return await Consumer.findAll(this.url, limit);
	}

	async findConsumerById(id) {
		return await Consumer.findById(this.url, id);
	}

	async addConsumer(consumer) {
		return await Consumer.add(this.url, consumer);
	}
	async updateConsumer(id, consumer) {
		return await Consumer.update(this.url, id, consumer);
	}
	async deleteConsumer(id) {
		return await Consumer.remove(this.url, id);
	}

	async addPlugins(plugins) {
		let proms = plugins.map(async (e) => {
			await this.addPlugin(e);
		});
		await Promise.all(proms);
	}

	async findPlugins(limit) {
		return await Plugin.findAll(this.url, limit);
	}

	async findPluginById(id) {
		return await Plugin.findById(this.url, id);
	}

	async addPlugin(plugin) {
		return await Plugin.add(this.url, plugin);
	}

	async updatePlugin(id, plugin) {
		return await Plugin.update(this.url, id, plugin);
	}

	async deletePlugin(id) {
		return await Plugin.remove(this.url, id);
	}
}

