
const axios = require('axios');
const helpers = require('../helpers/helpers');
const utils = require('../helpers/converters');
const KongError = require('../domain/kong.error');



class Consumer {

	constructor() { }

	static async findAll(url) {
		//[repare the url
		const consumerUrl = helpers.urlPrep(url, 'consumers');
		//call for the consumer
		let response = await axios.get(consumerUrl);
		if (response.status != 200) {
			throw KongError.serviceError(response);
		}
		//isolando o body
		const consumers = response.data.data;
		return utils.convertList(consumers, Consumer);
	}

	async add(url, data) {
		//[repare the url
		url = helpers.urlPrep(url, 'consumers');
		//call for the service
		let consumer = await axios.post(url, data);
		//return the response
		return consumer.data;
	}
}

module.exports = Consumer;
