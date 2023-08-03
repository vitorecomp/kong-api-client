const Service = require('../libs/service.lib');
const Route = require('../libs/route.lib');
const Consumer = require('../libs/consumer.lib');
const Plugin = require('../libs/plugin.lib');

module.exports = class BasicApi {
  // services
  async addServices(services) {
    const proms = services.map(async (ser) => await this.addService(ser));
    return await Promise.all(proms);
  }

  async findServices() {
    return await Service.findAll(this.url);
  }

  async findService(id) {
    return await Service.findById(this.url, id);
  }

  async addService(service) {
    if (!(service instanceof Service)) {
      service = new Service(service);
    }
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

  // route methods
  async addRoutes(routes) {
    const proms = routes.map(async (ser) => await this.addRoute(ser));
    return await Promise.all(proms);
  }

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
