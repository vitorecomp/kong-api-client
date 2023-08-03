const utils = require('./helpers/converters');

const BasicApi = require('./domain/basic.class');
const KongError = require('./domain/kong.error');

const Service = require('./libs/service.lib');
const Route = require('./libs/route.lib');
const Plugin = require('./libs/plugin.lib');
const Consumer = require('./libs/consumer.lib');

module.exports = class KongApi extends BasicApi {
  constructor({admin_url, services, plugins, consumers, routes} = {}) {
    super();
    if (typeof admin_url === 'undefined') {
      throw KongError.undefinedUrl;
    }
    // Add / on kong url
    this.url = admin_url;
    if (this.url[this.url.length - 1] != '/') {
      this.url += '/';
    }

    // transforme services in a array
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

  async init() {
    const kong = {};

    // save all services of options
    kong.services = await this.addServices(this.services);
    // save all puglins of options
    kong.plugins = await this.addPlugins(this.plugins);
    // save all custumers of options
    kong.consumers = await this.addConsumers(this.consumers);
    // save all custumers of options
    kong.routes = await this.addRoutes(this.routes);

    return kong;
  }

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
