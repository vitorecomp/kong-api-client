const Service = require('../libs/service.lib');
const Route = require('../libs/route.lib');
const Consumer = require('../libs/consumer.lib');
const Plugin = require('../libs/plugin.lib');


module.exports = class BasicApi {
  // services
  /**
    * Will transform into class and add all the services passed
    * on the parameter, making the services available on the Kong
    * API
    * @param {[object]} services this will be list of services
    * to be added on the Kong API instance
    * @return {[Service]} List of services added on the kong api
   */
  async addServices(services) {
    const servicePromises = services.map(async (ser) =>
      await this.addService(ser),
    );
    return await Promise.all(servicePromises);
  }

  /**
    * Look for the services on the Kong API
    * @return {[Service]} list of the services on the Kong Api
   */
  async findServices() {
    return await Service.findAll(this.url);
  }

  /**
    * Look for a specific service on the Kong API
    * @param {Number} id the id of the service to be returned
    * @return {Service} a instance of a specific service on the Kong Api
   */
  async findService(id) {
    return await Service.findById(this.url, id);
  }

  /**
    * Will transform into class and add a services passed
    * on the parameter, making the service available on the Kong
    * API
    * @param {object} service this will be a services
    * to be added on the Kong API instance
    * @return {[Service]} List of services added on the kong api
   */
  async addService(service) {
    if (!(service instanceof Service)) {
      service = new Service(service);
    }
    return await service.create(this.url);
  }

  /**
    * Will transform into class and update a services passed
    * on the parameter.
    * @param {Number} id the id of the service to be updated
    * @param {object | Service} newService this will the new service
    * data to be update on the Kong API instance
    * @return {Service} The service with the values updated
 */
  async updateService(id, newService) {
    const service = await this.findService(id);
    return await service.update(this.url, newService);
  }

  /**
    * This service will remove a service from the Kong API
    * @param {Number} id the id of the service to be deleted
    * @return {Service} The deleted service
  */
  async deleteService(id) {
    const service = await this.findService(id);
    return await service.delete(this.url);
  }

  // route methods
  /**
    * Will transform into class and add all the routes passed
    * on the parameter, making the routes available on the Kong
    * API
    * @param {[object]} routes this will be list of routes
    * to be added on the Kong API instance
    * @return {[Route]} List of routes added on the kong api
  */
  async addRoutes(routes) {
    const proms = routes.map(async (ser) => await this.addRoute(ser));
    return await Promise.all(proms);
  }

  /**
    * Look for the routes on the Kong API
    * @return {[Route]} list of the routes on the Kong Api
  */
  async findRoutes() {
    return Route.findAll(this.url);
  }

  async findRoute(id) {
    return await Route.findById(this.url, id);
  }

  async addRoute(route) {
    if (!(route instanceof Route)) {
      route = new Route(route);
    }
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

  // consumer methods
  async addConsumers(consumers) {
    const proms = consumers.map(async (ser) => await this.addConsumer(ser));
    return await Promise.all(proms);
  }

  async findConsumers() {
    return Consumer.findAll(this.url);
  }

  async findConsumer(id) {
    return await Consumer.findById(this.url, id);
  }

  async addConsumer(consumer) {
    if (!(consumer instanceof Consumer)) {
      consumer = new Consumer(consumer);
    }
    return await consumer.create(this.url);
  }

  async updateConsumer(id, data) {
    const consumer = await this.findConsumer(id);
    return await consumer.update(this.url, data);
  }

  async deleteConsumer(id) {
    const consumer = await this.findConsumer(id);
    return await consumer.delete(this.url);
  }

  // plugin methods
  async addPlugins(plugins) {
    const proms = plugins.map(async (ser) => await this.addPlugin(ser));
    return await Promise.all(proms);
  }

  async findPlugins() {
    return Plugin.findAll(this.url);
  }

  async findPlugin(id) {
    return await Plugin.findById(this.url, id);
  }

  async addPlugin(plugin) {
    if (!(plugin instanceof Plugin)) {
      plugin = new Plugin(plugin);
    }
    return await plugin.create(this.url);
  }

  async updatePlugin(id, data) {
    const plugin = await this.findPlugin(id);
    return await plugin.update(this.url, data);
  }

  async deletePlugin(id) {
    const plugin = await this.findPlugin(id);
    return await plugin.delete(this.url);
  }
};
