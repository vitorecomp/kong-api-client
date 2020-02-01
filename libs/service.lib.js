import validator from 'validator';
import axios from 'axios';

import helpers from '../helpers/helpers';
import converters from '../helpers/converters';

import KongError from '../domain/kong.error';
import BasicApi from '../domain/basic.class';
import Route from '../libs/route.lib';


export default class Service extends BasicApi {

	constructor(input) {
		super(input);
		this.data = {
			...input,
			id: undefined
		};
		//in case
		this.id = input.id;

		//validate url
		if (typeof this.data.url !== 'undefined') {
			if (typeof this.data.url !== 'string')
				throw KongError.invalidField('url');
			if (!validator.isURL(this.data.url))
				throw KongError.invalidField('url');
			return;
		}

		//validate the fields of the service
		if (typeof this.data.protocol === 'undefined') {
			throw KongError.undefinedField('protocol');
		}
		if (typeof this.data.host === 'undefined') {
			throw KongError.undefinedField('host');
		}
		if (typeof this.data.port === 'undefined') {
			throw KongError.undefinedField('port');
		}

	}

	static async findAll(url) {
		if (typeof url == undefined)
			throw KongError.UndefinedUrl;
		//[repare the url
		const serviceUrl = helpers.urlPrep(url, 'services');
		//call for the service
		try {
			let response = await axios.get(serviceUrl);
			//isolando o body
			const services = response.data.data;
			return converters.convertList(services, Service);
		} catch (e) {
			throw KongError.serviceError(e);
		}
	}

	static async findById(url, id) {
		if (typeof url == undefined)
			throw KongError.UndefinedUrl;
		//[repare the url
		const serviceUrl = helpers.urlPrep(url, `services/${id}`);
		//call for the service
		try {
			let response = await axios.get(serviceUrl);
			//isolando o body
			const services = response.data.data;
			return converters.convertList(services, Service);
		} catch (e) {
			throw KongError.serviceError(e);
		}
	}

	async create(url) {
		if (typeof url == undefined)
			throw KongError.UndefinedUrl;
		//[repare the url
		const serviceUrl = helpers.urlPrep(url, 'services');
		//call for the service
		try {
			let response = await axios.post(serviceUrl, this.data);
			//isolando o body
			return new Service(response.data);
		} catch (e) {
			throw KongError.serviceError(e);
		}
	}

	static async deleteService(url, id) {
		const service = await Service.findById(url, id);
		if (!service)
			throw KongError.notFound('Service');
		return await service.delete(url);
	}

	async delete(url) {
		if (typeof url == undefined)
			throw KongError.UndefinedUrl;
		//[repare the url
		const serviceUrl = helpers.urlPrep(url, `services/${this.id}`);
		//call for the service
		try {
			await axios.delete(serviceUrl, this.data);
			//isolando o body
			return this.id;
		} catch (e) {
			throw KongError.serviceError(e);
		}
	}

	async getRoute(id) {
		return await Route.getOne(this.url, id);
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
		return await Route.remove(this.basic_url, id);
	}


}



