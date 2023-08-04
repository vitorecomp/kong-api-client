/**
   * The standard error class for the Kong API errors
   * allow the easy treatment of the api errors
 */
class KongError extends Error {
  /**
    * The constructor of the Kong Error class, this will
    * this will make possible to convert the errors to a standard
    * error message, and error class
   * @param {object} err The error message
 */
  constructor(err) {
    super(err);
    if (typeof err == 'string') {
      this.type = 'NE';
      this.msg = err;
    } else {
      this.type = 'UN';
      this.err = err;
    }
  }
}

const undefinedUrl = new KongError('adminUrl shouldn\'t be null');
const undefinedEndPoint = new KongError(
    'Calling a command from abstract class',
);

const notFound = (endpoint) => new KongError(endpoint);

const serviceError = (response) =>
  response instanceof KongError ? response : new KongError(response);

const invalidField = (field) => new KongError(`The field ${field} is invalid`);

const undefinedField = (field) =>
  new KongError(`The field ${field} cannot be undefined`);

const semiOptionalField = (fields) =>
  new KongError(`One of the files must be defined: ${fields}`);

module.exports = {
  KongError,
  undefinedUrl,
  notFound,
  serviceError,
  invalidField,
  undefinedField,
  semiOptionalField,
  undefinedEndPoint,
};
