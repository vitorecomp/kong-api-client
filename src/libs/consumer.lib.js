const Domain = require('../domain/domain.class');

module.exports = class Consumer extends Domain {
  /**
   * Set the base endpoint of the Consumer class,
   * that will be used in the static methods
   * that came from the Domain class
   * @return {string} the base endpoint of the Consumer class
   */
  static endpoint() {
    return 'consumers';
  }

  /**
   * Set the base endpoint of the Consumer class,
   * that will be used in the class methods
   * that came from the Domain class
   * @return {string} the base endpoint of the Consumer instance
   */
  endpoint() {
    return 'consumers';
  }

  /**
   * Implement the builder pattern for the Consumer class
   * @return {Consumer} a instance of the Consumer class
   */
  static builder() {
    return Consumer;
  }

  /**
   * The constructor of the Consumer class, this will
   * make possible to receive a request from the
   * api and convert it to a Consumer instance
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
