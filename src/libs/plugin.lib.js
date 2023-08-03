const KongError = require('../domain/kong.error');
const Domain = require('../domain/domain.class');

module.exports = class Plugin extends Domain {
  static endpoint() {
    return 'plugins';
  }
  endpoint() {
    return 'plugins';
  }

  static builder() {
    return Plugin;
  }

  constructor(input) {
    super();
    this.data = {
      ...input,
      id: undefined,
    };
    // in case
    this.id = input.id;
  }
};
