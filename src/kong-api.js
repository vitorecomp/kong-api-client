let BasicApi = require('../domain/basic.class');
let KongError = require('../domain/kong.error');
let Service = require('../libs/service.lib');
let Plugin = require('../libs/plugin.lib');
let Consumer = require('../libs/consumer.lib');


const utils = require('../helpers/converters');

const axios = require('axios');

//Agregation of all the non public funcions
let _KongApi = {
	sync: false,
	service: null
};

class KongApi extends BasicApi {
	constructor({ admin_url, services, plugins, consumers } = {}) {
		super();
		if (typeof admin_url === 'undefined') {
			throw KongError.UndefinedUrl;
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
		//save all services of options
		this.addServices(this.services);
		//save all puglins of options
		this.addPlugins(this.plugins);
		//save all custumers of options
		this.addConsumers(this.consumers);
	}

	async clean() {
		//get all services
		const services = await this.findServices(this.url);
		const serviceProms = services.map(el => this.deleteService(el.id));

		//get all plugins
		const plugins = await this.findPlugins(this.url);
		const pluginProms = plugins.map(el => this.deletePlugin(el.id));

		//get all consumers
		const consumers = await this.findConsumers(this.url);
		const consumerProms = consumers.map(el => this.deleteConsumer(el.id));

		let proms = consumerProms + pluginProms + serviceProms;
		await Promise.all(proms);
	}

	async addServices(services) {
		let proms = services.map(async (ser) => {
			await this.addService(ser);
		});
		await Promise.all(proms);
	}

	async findServices(limit = 100) {
		return Service.findAll(limit);
	}

	async findService(id) {
		return Service.findById(id);
	}

	async addService(service) {
		if (!(service instanceof Service))
			service = new Service(service);
		return service.create();
	}

	async updateService(id, data) {
		const service = this.findService(id);
		if (!service)
			throw KongError.notFound('Service');
		return service.update(data);
	}

	async deleteService(id) {
		const service = this.findService(id);
		if (!service)
			throw KongError.notFound('Service');
		return Service.delete();
	}
}


module.exports = KongApi;


_KongApi.addRoutes = async function (service, sync, routes) {
	let proms = routes.map(async (route) => {
		try {
			await service.addRoute(route);
		} catch (error) {
			console.log(error);
			if (!(sync && error instanceof KongError && error.code == 'R401'))
				throw error;
		}
	});

	await Promise.all(proms);
};

_KongApi.addPlugins = async function (service, sync, plugins) {
	let proms = plugins.map(async (plugin) => {
		try {
			await service.addPlugin(plugin);
		} catch (error) {
			if (!(sync && error instanceof KongError && error.code == 'P401'))
				throw error;
		}
	});
	await Promise.all(proms);
};

_KongApi.addConsumers = async function (service, sync, consumers) {
	let proms = consumers.map(async (consumer) => {
		try {
			await service.addConsumer(consumer);
		} catch (error) {
			if (!(sync && error instanceof KongError && error.code == 'C401'))
				throw error;
		}
	});
	await Promise.all(proms);
};

_KongApi.addService = async function (url_entry, sync, input) {
	let url = url_entry + 'services';
	let service = null;

	let routes = input.routes;
	let consumers = input.consumers;
	let plugins = input.plugins;

	input.consumers = undefined;
	input.routes = undefined;
	input.plugins = undefined;

	try {
		//cop
		service = await axios.post(url, input);
		service = new Service(service.data, url_entry);

		//adding routes
		await _KongApi.addRoutes(service, sync, routes ? routes : []);

	} catch (error) {
		if (!error.response)
			throw error;
		if (!(sync && error.response.status == 409))
			throw error;

		//buid the existing service here
		service = await axios.get(url + '/' + input.name);
		service = new Service(service.data, url_entry);
	}

	//adding plugins on service 
	await _KongApi.addPlugins(service, sync, plugins ? plugins : []);


	//adding consumers
	await _KongApi.addConsumers(service, sync, consumers ? consumers : []);
};
