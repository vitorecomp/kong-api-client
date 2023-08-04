const KongError = require('../domain/kong.error');
const Domain = require('../domain/domain.class');

module.exports = class Route extends Domain {
  /**
  * Set the base endpoint of the Route class,
  * that will be used in the static methods
  * that came from the Domain class
  * @return {string} the base endpoint of the Route class
  */
  static endpoint() {
    return 'routes';
  }


  /**
   * Set the base endpoint of the Route class,
   * that will be used in the class methods
   * that came from the Domain class
   * @return {string} the base endpoint of the Route instance
   */
  endpoint() {
    return 'routes';
  }

  /**
  * Implement the builder pattern for the Route class
  * @return {Route} a instance of the Route class
  */
  static builder() {
    return Route;
  }

  /**
  * The constructor of the Route class, this will
  * make possible to receive a request from the
  * api and convert it to a Route instance
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

    // validate the fields of the route
    if (
      typeof this.data.methods === 'undefined' &&
      typeof this.data.hosts === 'undefined' &&
      typeof this.data.paths === 'undefined'
    ) {
      throw KongError.semiOptionalField('methods, host, paths');
    }
  }
};
