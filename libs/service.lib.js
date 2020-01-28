let BasicApi = require('../domain/basic.class');

let Route = require('../libs/route.lib');
Route = new Route();

class Service extends BasicApi {
	constructor(input, url) {
		super(input);
		this.name = input.name;
		this.id = input.id;
		this.basic_url = url;
		this.url = url + 'service/';
		this.url += input.name;
	}

	async getRoute(id) {
		return await Route.getOne(this.url, id);
	}

	async addRoute(route) {
		route.service = {
			id: this.id
		};
		return await Route.add(this.basic_url, route);
	}

	async updateRoute(id, route) {
		return await Route.update(this.basic_url, id, route);
	}

	async deleteRoute(id) {
		return await Route.remove(this.basic_url, id);
	}
}


module.exports = Service;


