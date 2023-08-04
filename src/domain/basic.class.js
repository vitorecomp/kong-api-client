const Service = require('../libs/service.lib');
const Route = require('../libs/route.lib');
const Consumer = require('../libs/consumer.lib');
const Plugin = require('../libs/plugin.lib');


module.exports = class BasicApi {
  // services
  /**
    * Will transform the the instances of data into
    * a Service class and add them on the Kong Api Manager
    * @param {[object]} services this will be list of services
    * to be added on the Kong API manager
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
    * @return {Service} a instance of a specific service on the Kong Api manager
   */
  async findService(id) {
    return await Service.findById(this.url, id);
  }

  /**
    * Method to transform the object into a Service instance
    * and will correlated it to the Kong Api management
    * if the service does not exist it will will be created
    * @param {object} service this will be a service
    * that will be added to the Kong API manager
    * @return {Service} Service added on the kong api
   */
  async addService(service) {
    if (!(service instanceof Service)) {
      service = new Service(service);
    }
    return await service.create(this.url);
  }

  /**
    * Method to update a service, this will update
    * a existing plugin on the Kong API manager
    * @param {Number} id the id of the service to be updated
    * @param {object | Service} newService this will the new service
    * data to be update on the Kong API manager
    * @return {Service} The service with the updated values
 */
  async updateService(id, newService) {
    const service = await this.findService(id);
    return await service.update(this.url, newService);
  }

  /**
    * Method to remove a service from the Kong API manager
    * @param {Number} id the id of the service to be removed
    * @return {Service} The removed service
  */
  async deleteService(id) {
    const service = await this.findService(id);
    return await service.delete(this.url);
  }

  // route methods
  /**
    * Will transform the the instances of data into
    * a Route class and add them on the Kong Api Manager
    * @param {[object]} routes this will be list of routes
    * to be added on the Kong API manager
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

  /**
    * Look for a specific route on the Kong API
    * @param {Number} id the id of the route to be returned
    * @return {Route} a instance of a specific route on the Kong Api manager
   */
  async findRoute(id) {
    return await Route.findById(this.url, id);
  }

  /**
    * Method to transform the object into a Route instance
    * and will correlated it to the Kong Api management
    * if the route does not exist it will will be created
    * @param {object} route this will be a route
    * that will be added to the Kong API manager
    * @return {Route} route added on the kong api manager
  */
  async addRoute(route) {
    if (!(route instanceof Route)) {
      route = new Route(route);
    }
    return await route.create(this.url);
  }

  /**
    * Method to update a route, this will update
    * a existing plugin on the Kong API manager
    * @param {Number} id the id of the route to be updated
    * @param {object | Route} newRoute this will the new route
    * data to be update on the Kong API manager
    * @return {Route} The route with the updated values
 */
  async updateRoute(id, newRoute) {
    const route = await this.findRoute(id);
    return await route.update(this.url, newRoute);
  }

  /**
    * Method to remove a route from the Kong API manager
    * @param {Number} id the id of the route to be removed
    * @return {Route} The removed route
  */
  async deleteRoute(id) {
    const route = await this.findRoute(id);
    return await route.delete(this.url);
  }

  // consumer methods
  /**
    * Will transform the the instances of data into
    * a Consumer class and add them on the Kong Api Manager
    * @param {[object]} consumers this will be list of routes
    * to be added on the Kong API instance
    * @return {[Consumer]} List of consumers added on the kong api manager
  */
  async addConsumers(consumers) {
    const proms = consumers.map(async (ser) => await this.addConsumer(ser));
    return await Promise.all(proms);
  }

  /**
    * Look for the consumers on the Kong API
    * @return {[Consumer]} list of the routes on the Kong Api
  */
  async findConsumers() {
    return Consumer.findAll(this.url);
  }

  /**
    * Look for a specific consumer on the Kong API
    * @param {Number} id the id of the consumer to be returned
    * @return {Consumer} a instance of a specific
    * consumer on the Kong Api manager
   */
  async findConsumer(id) {
    return await Consumer.findById(this.url, id);
  }

  /**
    * Method to transform the object into a Consumer instance
    * and will correlated it to the Kong Api management
    * if the consumer does not exist it will will be created
    * @param {object} consumer this will be a consumer
    * that will be added to the Kong API manager
    * @return {Consumer} consumer added on the kong api
  */
  async addConsumer(consumer) {
    if (!(consumer instanceof Consumer)) {
      consumer = new Consumer(consumer);
    }
    return await consumer.create(this.url);
  }

  /**
    * Method to update a consumer, this will update
    * a existing consumer on the Kong API manager
    * @param {Number} id the id of the consumer to be updated
    * @param {object | Consumer} newConsumer this will the new consumer
    * data to be update on the Kong API manager
    * @return {Consumer} The consumer with the updated values
 */
  async updateConsumer(id, newConsumer) {
    const consumer = await this.findConsumer(id);
    return await consumer.update(this.url, newConsumer);
  }

  /**
    * Method to remove a consumer from the Kong API manager
    * @param {Number} id the id of the consumer to be removed
    * @return {Consumer} The removed consumer
  */
  async deleteConsumer(id) {
    const consumer = await this.findConsumer(id);
    return await consumer.delete(this.url);
  }

  // plugin methods
  /**
    * Will transform the the instances of data into
    * a Plugin class and add them on the Kong Api Manager
    * @param {[object]} plugins this will be list of plugins
    * to be added on the Kong API manager
    * @return {[Plugin]} List of routes added on the kong api
  */
  async addPlugins(plugins) {
    const proms = plugins.map(async (ser) => await this.addPlugin(ser));
    return await Promise.all(proms);
  }

  /**
    * Look for the plugins on the Kong API
    * @return {[Plugin]} list of the routes on the Kong Api
  */
  async findPlugins() {
    return Plugin.findAll(this.url);
  }

  /**
    * Look for a specific plugin on the Kong API
    * @param {Number} id the id of the plugin to be returned
    * @return {Plugin} a instance of a specific plugin on the Kong Api manager
   */
  async findPlugin(id) {
    return await Plugin.findById(this.url, id);
  }

  /**
    * Method to transform the object into a Plugin instance
    * and will correlated it to the Kong Api management
    * if the plugin does not exist it will will be created
    * @param {object} plugin this will be a plugin
    * that will be added to the Kong API manager
    * @return {Plugin} plugin added on the kong api
  */
  async addPlugin(plugin) {
    if (!(plugin instanceof Plugin)) {
      plugin = new Plugin(plugin);
    }
    return await plugin.create(this.url);
  }

  /**
    * Method to update a plugin, this will update
    * a existing plugin on the Kong API manager
    * @param {Number} id the id of the plugin to be updated
    * @param {object | Plugin} newPlugin this will the new plugin
    * data to be update on the Kong API manager
    * @return {Plugin} The plugin with the updated values
 */
  async updatePlugin(id, newPlugin) {
    const plugin = await this.findPlugin(id);
    return await plugin.update(this.url, newPlugin);
  }

  /**
    * Method to remove a plugin from the Kong API manager
    * @param {Number} id the id of the plugin to be removed
    * @return {Plugin} The removed plugin
  */
  async deletePlugin(id) {
    const plugin = await this.findPlugin(id);
    return await plugin.delete(this.url);
  }
};
