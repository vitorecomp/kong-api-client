
const axios = require('axios');

let urlPrep = (url) => {
	if(url[url.length - 1] != '/')
			url += '/'
	url += 'consumers'
	return url
}

class Consumer{
	
	constructor(){}

	async add(url, data){
		//[repare the url
		url = urlPrep(url)
		//call for the service
		let consumer = await axios.post(url, data)
		//return the response
		return consumer.data
	}
}

module.exports = Consumer
