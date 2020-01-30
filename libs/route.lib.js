const axios = require('axios');
const helpers = require('../helpers/helpers');

class Route {
	constructor() { }

	async create(url, data) {
		//[repare the url
		url = helpers.urlPrep(url, 'route');
		//call for the service
		let route = await axios.post(url, data);
		//return the response
		return route.data;
	}
}

module.exports = Route;
