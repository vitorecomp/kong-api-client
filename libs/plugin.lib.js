const axios = require('axios');
const helpers = require('../helpers/helpers');
const utils = require('../helpers/converters');
const KongError = require('../domain/kong.error');

class Plugin {
	constructor() { }

	static async findAll(url) {
		//[repare the url
		const pluginUrl = helpers.urlPrep(url, 'plugins');
		//call for the plugin
		let response = await axios.get(pluginUrl);
		if (response.status != 200) {
			throw KongError.serviceError(response);
		}
		//isolando o body
		const plugins = response.data.data;
		return utils.convertList(plugins, Plugin);
	}

	async add(url, data) {
		//[repare the url
		url = helpers.urlPrep(url, 'plugins');
		//call for the service
		let plugin = await axios.post(url, data);
		//return the response
		return plugin.data;
	}
}

module.exports = Plugin;
