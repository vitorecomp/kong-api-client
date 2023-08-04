const validator = require('validator');

const KongError = require('../domain/kong.error');
const Domain = require('../domain/domain.class');

module.exports = class Service extends Domain {
  /**
  * Set the base endpoint of the Service class,
  * that will be used in the static methods
  * that came from the Domain class
  * @return {string} the base endpoint of the Service class
  */
  static endpoint() {
    return 'services';
  }

  /**
  * Set the base endpoint of the Service class,
  * that will be used in the class methods
  * that came from the Domain class
  * @return {string} the base endpoint of the Service instance
  */
  endpoint() {
    return 'services';
  }

  /**
  * Implement the builder pattern for the Service class
  * @return {Service} a instance of the Service class
  */
  static builder() {
    return Service;
  }

  /**
  * The constructor of the Service class, this will
  * make possible to receive a request from the
  * api and convert it to a Service instance
  * @param {object} inputData the data that came from the api
  */
  constructor(inputData = {}) {
    super();

    this.data = {
      ...inputData,
      id: undefined,
    };
    // in case
    this.id = inputData.id;

    // validate url
    if (typeof this.data.url !== 'undefined') {
      if (typeof this.data.url !== 'string') {
        throw KongError.invalidField('url');
      }
      if (!validator.isURL(this.data.url)) {
        throw KongError.invalidField('url');
      }
      return;
    }

    // validate the fields of the service
    if (typeof this.data.protocol === 'undefined') {
      throw KongError.undefinedField('protocol');
    }
    if (typeof this.data.host === 'undefined') {
      throw KongError.undefinedField('host');
    }
    if (typeof this.data.port === 'undefined') {
      throw KongError.undefinedField('port');
    }
  }
};
