const utils = require('./helpers/converters');

const BasicApi = require('./domain/basic.class');
const KongError = require('./domain/kong.error');

const Service = require('./libs/service.lib');
const Route = require('./libs/route.lib');
const Plugin = require('./libs/plugin.lib');
const Consumer = require('./libs/consumer.lib');

module.exports = class KongApi extends BasicApi {
  /**
  * The constructor of the KongApi class, this will
  * make possible to receive the base information of the Kong
  * API instance
  * @param {string} adminUrl the url for the kong api gateway
  * @param {[object]} services the list of services to be added on the gateway
  * @param {[object]} plugins the list of plugins to be added on the gateway
  * @param {[object]} consumers the list of consumers to be added on the gateway
  * @param {[object]} routes the list of routes to be added on the gateway
  */
  constructor({
    adminUrl,
    services,
    plugins,
    consumers,
    routes,
  } = {}) {
    super();
    if (typeof adminUrl === 'undefined') {
      throw KongError.undefinedUrl;
    }
    // Add / on kong url
    this.url = adminUrl;
    if (this.url[this.url.length - 1] != '/') {
      this.url += '/';
    }

    // transform services in a array
    this.services = utils.toArray(services);
    this.routes = utils.toArray(routes);
    this.plugins = utils.toArray(plugins);
    this.consumers = utils.toArray(consumers);

    // validate if all the services are a Kong Class, if not transform
    this.services = utils.convertList(this.services, Service);
    this.routes = utils.convertList(this.routes, Route);
    this.plugins = utils.convertList(this.plugins, Plugin);
    this.consumers = utils.convertList(this.consumers, Consumer);
  }

  /**
  * This method will create all the local elements on the Kong API,
  * if the element already exists, it will be updated, if not, it will
  * be created.
  */
  async init() {
    const kong = {};

    // save all services of options
    kong.services = await this.addServices(this.services);
    // save all plugins of options
    kong.plugins = await this.addPlugins(this.plugins);
    // save all customers of options
    kong.consumers = await this.addConsumers(this.consumers);
    // save all customers of options
    kong.routes = await this.addRoutes(this.routes);

    return kong;
  }

  /**
  * This method will delete all elements on a Kong API,
  * this is useful in case of a clean install
  * allowing for the creation of a complete new Kong API
  */
  async clean() {
    // get all plugins
    const plugins = await this.findPlugins(this.url);
    const pluginProms = plugins.map(async (el) => await el.delete(this.url));

    await Promise.all(pluginProms);

    // get all consumers
    const consumers = await this.findConsumers(this.url);
    const consumerProms = consumers.map(
        async (el) => await el.delete(this.url),
    );

    await Promise.all(consumerProms);

    // get all routes
    const routes = await this.findRoutes(this.url);
    const routesProms = routes.map(async (el) => await el.delete(this.url));

    await Promise.all(routesProms);

    // get all services
    const services = await this.findServices(this.url);
    const serviceProms = services.map(async (el) => await el.delete(this.url));

    await Promise.all(serviceProms);
  }
};
