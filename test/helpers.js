const KongApi = require('../index.js');

const config = {
  adminUrl: 'http://127.0.0.1:8001',
};

const clean = async () => {
  try {
    const kong = new KongApi(config);
    await kong.init();
    await kong.clean();
  } catch (error) {
    await new Promise((r) => setTimeout(r, 1000));
    const kong = new KongApi(config);
    await kong.init();
    await kong.clean();
  }
};

module.exports = {
  config,
  clean,
};
