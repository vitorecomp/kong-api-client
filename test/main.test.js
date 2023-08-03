const KongApi = require('../index.js');
const {config, clean} = require('./helpers');
const {KongError} = require('./../src/domain/kong.error');

beforeEach(async () => {
  return await clean();
});

afterEach(async () => {
  return await clean();
});


test('Simple init test', async () => {
  const kong = new KongApi(config);
  kong.init();
});

test('Init test without url', async () => {
  try {
    new KongApi({});
  } catch (e) {
    expect(e).toBeInstanceOf(KongError);
  }
});


