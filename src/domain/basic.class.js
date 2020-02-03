
import Service from '../libs/service.lib';
import Route from '../libs/route.lib';

export default class BasicApi {
	//services 
	async addServices(services) {
		let proms = services.map(async (ser) => await this.addService(ser));
		return await Promise.all(proms);
	}

	async findServices(limit = 100) {
		return await Service.findAll(limit);
	}

	async findService(id) {
		return await Service.findById(this.url, id);
	}

	async addService(service) {
		if (!(service instanceof Service))
			service = new Service(service);
		return await service.create(this.url);
	}

	async updateService(id, data) {
		const service = await this.findService(id);
		return await service.update(this.url, data);
	}

	async deleteService(id) {
		const service = await this.findService(id);
		return await service.delete(this.url);
	}

	//consumers
	async addPlugins() { }
	async addConsumers() { }
	async findConsumers() {
		return [];
	}
	async findPlugins() {
		return [];
	}


	//route methods
	async addRoutes(routes) {
		let proms = routes.map(async (ser) => await this.addRoute(ser));
		return await Promise.all(proms);
	}

	async findRoutes(limit = 100) {
		return Route.findAll(limit);
	}

	async findRoute(id) {
		return await Route.findById(this.url, id);
	}

	async addRoute(route) {
		if (!(route instanceof Route))
			route = new Route(route);
		return await route.create(this.url);
	}

	async updateRoute(id, data) {
		const route = await this.findRoute(id);
		return await route.update(this.url, data);
	}

	async deleteRoute(id) {
		const route = await this.findRoute(id);
		return await route.delete(this.url);
	}
}

