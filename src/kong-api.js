let BasicApi = require('../domain/basic.class');
let KongError = require('../domain/kong.error');
let Service = require('../libs/service.lib');
let Plugin = require('../libs/plugin.lib');
let Consumer = require('../libs/consumer.lib');


let utils = require('../helpers/converters');

var assert = require('assert');
const axios = require('axios');

//Agregation of all the non public funcions
let _KongApi = {
	sync: false,
	service: null
};

class KongApi extends BasicApi {
	constructor(options) {
		//call the cntructor of the basic API
		super(options);

		//validate if the argument have the necessary parameters
		//TODO tranform the errors messagens to a file
		//TODO pass all validations to a helper validation
		assert.notEqual(options, undefined, 'options not defined');
		assert.notEqual(options.admin_url, undefined,
			'admin_url not defined: examples ' +
			'{ admin_url:"http://kong_uri:kong_port"}');

		//Add / on kong url
		this.url = options.admin_url;
		if (this.url[this.url.length - 1] != '/')
			this.url += '/';

		this.sync = options.sync;

		//transforme services in a array
		this.services = utils.toArray(options.services);
		this.plugins = utils.toArray(options.plugins);
		this.consumers = utils.toArray(options.consumers);

		//TODO traform to conversors functions
		//validate if all the services are a Service, if not transform
		this.services = this.services.map(service =>
			(service instanceof Service)
				? service
				: new Service(service)
		);

		//validate if all the plugins are a Plugin, if not transform
		this.plugins = this.plugins.map(plugin =>
			(plugin instanceof Plugin)
				? plugin
				: new Plugin(plugin)
		);

		//validate if all the consumers are a Consumer, if not transform
		this.consumers = this.consumers.map(consumer =>
			(consumer instanceof Consumer)
				? consumer
				: new Consumer(consumer)
		);
	}

	async init() {
		//save all services of options
		if (this.services) {
			let proms = this.services.map(async (ser) => {
				await _KongApi.addService(this.url, this.sync, ser);
			});
			await Promise.all(proms);
		}

		//save all puglins of options
		if (this.plugins) {
			let proms = this.plugins.map(async (e) => {
				try {
					await this.addPlugin(e);
				} catch (error) {
					if (this.sync && error instanceof KongError) {
						//do same thing
					} else
						throw error;
				}
			});
			await Promise.all(proms);
		}

		//save all custumers of options
		if (this.consumers) {
			let proms = this.consumers.map(async (e) => {
				try {
					await this.addConsumer(e);
				} catch (error) {
					//Valida se já nao existe, se sync ele forca a criar
					if (this.sync && error instanceof KongError) {
						//do same thing
					} else
						throw error;
				}
			});
			await Promise.all(proms);
		}
	}

	async clean() {

	}

	async getServices(limit) {
		//llok for the services
		console.log(limit);
		let services = [];
		//convert to classes
		services.forEach((e) => new Service(e));
	}

	async getService(id) {
		//look for the service
		console.log(id);
		let service = null;
		//convert to class
		return new Service(service);
	}

	async addService(service) {
		//add service
		return _KongApi.addService(this.url, false, service);
	}

	async updateService(id, service) {
		//update service
		service = null;
		//convert to class
		return new Service(service);
	}

	async deleteService(id) {
		console.log(id);
		//delete service

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
