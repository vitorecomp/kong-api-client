
const axios = require('axios');

let urlPrep = (url) => {
	if(url[url.length - 1] != '/')
			url += '/'
	url += 'plugins'
	return url
}

class Plugin{
	
	constructor(){}

	async add(url, data){
		//[repare the url
		url = urlPrep(url)
		//call for the service
		plugin = axios.post(url, data)
		//return the response
		return plugin.data
	}
}

module.exports = Plugin
