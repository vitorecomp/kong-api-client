const axios = require('axios');

let urlPrep = url => {
	if (url[url.length - 1] != '/') url += '/';
	url += 'routes';
	return url;
};

class Route {
	constructor() { }

	async add(url, data) {
		//[repare the url
		url = urlPrep(url);
		//call for the service
		let route = await axios.post(url, data);
		//return the response
		return route.data;
	}
}

module.exports = Route;
