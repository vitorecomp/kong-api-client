const axios = require('axios');

const helpers = require('../helpers/helpers');
const converters = require('../helpers/converters');

const KongError = require('../domain/kong.error');

module.exports = class Domain {
  /**
   * Abstract method of the endpoint
   * this method should be implemented in all
   * the class that extends the domain
   * @throws {KongError} if this method is called without been
   * overwritten it should throw an error
   */
  static endpoint() {
    throw KongError.undefinedEndPoint;
  }

  // Static methods
  /**
   * Method that will be used to find all the the
   * instances of the defined call, it will make a Rest call to
   * the Kong API
   * @param {string} url this is the url for the Kong Api
   * it will be appended with the endpoint specific for each class
   * @throws {KongError} The kong error is thrown when a error in the
   * request is found
   */
  static async findAll(url) {
    if (typeof url == undefined) {
      throw KongError.undefinedUrl;
    }
    // repair the url
    const domainUrl = helpers.urlPrep(url, this.endpoint());

    // call for the domain
    try {
      const response = await axios.get(domainUrl);
      // get the axios data body
      const domains = response.data.data;
      // TODO add the url on the domains
      const Builder = this.builder();
      return converters.convertList(domains, Builder, {
        kongUrl: url,
      });
    } catch (e) {
      if (e instanceof axios.AxiosError) {
        throw KongError.serviceError(e.cause);
      } else {
        throw KongError.serviceError(e);
      }
    }
  }

  // Static methods
  /**
   * Method that will be used to find a specific
   * instance of this object type on the Kong API, it will make a Rest call
   * to it.
   * @param {string} url this is the url for the Kong Api
   * it will be appended with the endpoint specific for each class
   * @param {string} id the id of the element to be found
   * @throws {KongError} The kong error is thrown when a error in the
   * request is found
   */
  static async findById(url, id) {
    if (typeof url == undefined) {
      throw KongError.undefinedUrl;
    }
    // repair the url
    const domainUrl = helpers.urlPrep(url, `${this.endpoint()}/${id}`);
    // call for the domain
    try {
      const response = await axios.get(domainUrl);
      const Builder = this.builder();
      return new Builder(response.data);
    } catch (e) {
      throw KongError.serviceError(e);
    }
  }

  /**
   * Method that will be delete a specific a instance
   * object type on the Kong API by the param id, it will be done by
   * making a Rest call to it
   * @param {string} url this is the url for the Kong Api that
   * will be appended with the endpoint specific for each class
   * @param {string} id the id of the element to be found
   * @throws {KongError} The kong error is thrown when a error in the
   * request is found
   */
  static async delete(url, id) {
    const domain = await Domain.findById(url, id);
    if (!domain) {
      throw KongError.notFound(this.endpoint());
    }
    return await domain.delete(url);
  }

  // domain methods
  /**
 * define the method that will be create a new
 * instance of this object type, using the data
 * for itself that will be done by
 * making a Rest call to the Kong API
 * @param {string} url this is the url for the Kong Api that
 * will be appended with the endpoint specific for each class
 * @throws {KongError} The kong error is thrown when a error in the
 * request is found
 */
  async create(url) {
    if (typeof url == undefined) {
      throw KongError.undefinedUrl;
    }
    // repair the url
    const domainUrl = helpers.urlPrep(url, this.endpoint());

    // call for the domain
    try {
      const response = await axios.post(domainUrl, this.data);
      const Builder = this.constructor;
      return new Builder(response.data);
    } catch (e) {
      throw KongError.serviceError(e);
    }
  }

  /**
   * Define the method that will be update the instance
   * represented by this object on the Kong API,
   * the new data will came from the instance data.
   * That will be done by making a request to Rest API
   * @param {string} url this is the url for the Kong Api
   * it will be appended with the endpoint specific for each class
   * @throws {KongError} The kong error is thrown when a error in the
   * request is found
   */
  async update(url) {
    if (typeof url == undefined) {
      throw KongError.undefinedUrl;
    }
    // repair the url
    const domainUrl = helpers.urlPrep(url, `${this.endpoint()}/${this.id}`);
    // call for the domain
    try {
      const response = await axios.patch(domainUrl, this.data);
      const Builder = this.constructor;
      return new Builder(response.data);
    } catch (e) {
      throw KongError.serviceError(e);
    }
  }

  /**
   * Method that will be delete the
   * instance that this object is representing of the
   * kong Api. That will be done by making a Rest call to the
   * API
   * @param {string} url this is the url for the Kong Api
   * it will be appended with the endpoint specific for each class
   * @param {string} id the id of the element to be found
   * @throws {KongError} The kong error is thrown when a error in the
   * request is found
   */
  async delete(url) {
    if (typeof url == undefined) {
      throw KongError.undefinedUrl;
    }
    // repair the url
    const domainUrl = helpers.urlPrep(url, `${this.endpoint()}/${this.id}`);
    // call for the domain
    try {
      await axios.delete(domainUrl);
      // get the id
      return this.id;
    } catch (e) {
      throw KongError.serviceError(e);
    }
  }
};
