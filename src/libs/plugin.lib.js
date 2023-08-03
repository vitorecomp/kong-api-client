const Domain = require('../domain/domain.class');

module.exports = class Plugin extends Domain {
  /**
 * Set the base endpoint of the Plugin class,
 * that will be used in the static methods
 * that came from the Domain class
 * @return {string} the base endpoint of the Plugin class
 */
  static endpoint() {
    return 'plugins';
  }

  /**
 * Set the base endpoint of the Plugin class,
 * that will be used in the class methods
 * that came from the Domain class
 * @return {string} the base endpoint of the Plugin instance
 */
  endpoint() {
    return 'plugins';
  }

  /**
 * Implement the builder pattern for the Plugin class
 * @return {Plugin} a instance of the Plugin class
 */
  static builder() {
    return Plugin;
  }

  /**
 * The constructor of the Plugin class, this will
 * make possible to receive a request from the
 * api and convert it to a Plugin instance
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
  }
};
