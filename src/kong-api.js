import utils from './helpers/converters';

import BasicApi from './domain/basic.class';

import Service from './libs/service.lib';
import Plugin from './libs/plugin.lib';
import Consumer from './libs/consumer.lib';

import KongError from './domain/kong.error';

export default class KongApi extends BasicApi {
	constructor({ admin_url, services, plugins, consumers } = {}) {
		super();
		if (typeof admin_url === 'undefined') {
			throw KongError.undefinedUrl;
		}

		//Add / on kong url
		this.url = admin_url;
		if (this.url[this.url.length - 1] != '/')
			this.url += '/';

		//transforme services in a array
		this.services = utils.toArray(services);
		this.plugins = utils.toArray(plugins);
		this.consumers = utils.toArray(consumers);

		//validate if all the services are a Kong Class, if not transform
		this.services = utils.convertList(this.services, Service);
		this.plugins = utils.convertList(this.plugins, Plugin);
		this.consumers = utils.convertList(this.consumers, Consumer);
	}

	async init() {
		const kong = {};
		//save all services of options
		kong.services = await this.addServices(this.services);
		//save all puglins of options
		kong.plugins = await this.addPlugins(this.plugins);
		//save all custumers of options
		kong.consumers = await this.addConsumers(this.consumers);

		return kong;
	}

	async clean() {
		//get all services
		const services = await this.findServices(this.url);
		const serviceProms = services.map(async el =>
			await el.delete(this.url));

		await Promise.all(serviceProms);
		//get all plugins
		const plugins = await this.findPlugins(this.url);
		const pluginProms = plugins.map(async el =>
			await this.deletePlugin(el.id));

		await Promise.all(pluginProms);
		//get all consumers
		const consumers = await this.findConsumers(this.url);
		const consumerProms = consumers.map(el => this.deleteConsumer(el.id));
		await Promise.all(consumerProms);

	}

	async addServices(services) {
		let proms = services.map(async (ser) => await this.addService(ser));
		return await Promise.all(proms);
	}

	async findServices(limit = 100) {
		return Service.findAll(limit);
	}

	async findService(id) {
		return await Service.findById(this.url, id);
	}

	async addService(service) {
		if (!(service instanceof Service))
			service = new Service(service);
		return await service.create(this.url);
	}

	async updateService(id, data) {
		const service = await this.findService(id);
		return await service.update(this.url, data);
	}

	async deleteService(id, data) {
		const service = await this.findService(id);
		return await service.delete(this.url);
	}
}
