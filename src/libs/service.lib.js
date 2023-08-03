const validator = require('validator');

const KongError = require('../domain/kong.error');
const Domain = require('../domain/domain.class');

module.exports = class Service extends Domain {
  static endpoint() {
    return 'services';
  }
  endpoint() {
    return 'services';
  }

  static builder() {
    return Service;
  }

  constructor(input = {}) {
    super();

    this.data = {
      ...input,
      id: undefined,
    };
    // in case
    this.id = input.id;

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
