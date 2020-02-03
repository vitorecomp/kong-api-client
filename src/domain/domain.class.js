import axios from 'axios';

import helpers from '../helpers/helpers';
import converters from '../helpers/converters';

import KongError from '../domain/kong.error';

export default class Domain {
	static endpoint() {
		return 'null';
	}

	//Static methods
	static async findAll(url) {
		if (typeof url == undefined)
			throw KongError.undefinedUrl;
		//[repare the url
		const domainUrl = helpers.urlPrep(url, this.endpoint());

		//call for the domain
		try {
			let response = await axios.get(domainUrl);
			//isolando o body
			const domains = response.data.data;
			//TODO add the url on the domains
			const Builder = this.builder();
			return converters
				.convertList(domains, Builder, {
					kongUrl: url
				});
		} catch (e) {
			throw KongError.serviceError(e);
		}
	}

	static async findById(url, id) {
		if (typeof url == undefined)
			throw KongError.undefinedUrl;
		//[repare the url
		const domainUrl = helpers.urlPrep(url, `${this.endpoint()}/${id}`);
		//call for the domain
		try {
			let response = await axios.get(domainUrl);
			//isolando o body
			const Builder = this.builder();
			return new Builder(response.data);
		} catch (e) {
			throw KongError.serviceError(e);
		}
	}

	static async delete(url, id) {
		const domain = await Domain.findById(url, id);
		if (!domain)
			throw KongError.notFound(this.endpoint());
		return await domain.delete(url);
	}

	//domain methods
	async create(url) {
		if (typeof url == undefined)
			throw KongError.undefinedUrl;
		//[repare the url
		const domainUrl = helpers.urlPrep(url, this.endpoint());
		//call for the domain
		try {
			let response = await axios.post(domainUrl, this.data);
			//isolando o body
			const Builder = this.constructor;
			return new Builder(response.data);
		} catch (e) {
			throw KongError.serviceError(e);
		}

	}

	async update(url) {
		if (typeof url == undefined)
			throw KongError.undefinedUrl;
		//[repare the url
		const domainUrl = helpers.urlPrep(url, `${this.endpoint()}/${this.id}`);
		//call for the domain
		try {
			let response = await axios.patch(domainUrl, this.data);
			//isolando o body
			const Builder = this.constructor;
			return new Builder(response.data);
		} catch (e) {
			throw KongError.serviceError(e);
		}
	}

	async delete(url) {
		if (typeof url == undefined)
			throw KongError.undefinedUrl;
		//[repare the url
		const domainUrl = helpers.urlPrep(url, `${this.endpoint()}/${this.id}`);
		//call for the domain
		try {
			await axios.delete(domainUrl);
			//isolando o body
			return this.id;
		} catch (e) {
			throw KongError.serviceError(e);
		}
	}
}
