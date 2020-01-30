const axios = require('axios');
const helpers = require('../helpers/helpers');
const utils = require('../helpers/converters');
const KongError = require('../domain/kong.error');

const BasicApi = require('../domain/basic.class');
const Route = require('../libs/route.lib');
const route = new Route();


class Service extends BasicApi {
	constructor(input) {
		super(input);
		this.name = input.name;
		this.id = input.id;
	}

	static async findAll(url) {
		//[repare the url
		const serviceUrl = helpers.urlPrep(url, 'services');
		//call for the service
		let response = await axios.get(serviceUrl);
		if (response.status != 200) {
			throw KongError.serviceError(response);
		}
		//isolando o body
		const services = response.data.data;
		return utils.convertList(services, Service);
	}

	async getRoute(id) {
		return await route.getOne(this.url, id);
	}

	async addRoute(route) {
		route.service = {
			id: this.id
		};
		return await route.add(this.basic_url, route);
	}

	async updateRoute(id, route) {
		return await route.update(this.basic_url, id, route);
	}

	async deleteRoute(id) {
		return await route.remove(this.basic_url, id);
	}
}


module.exports = Service;


