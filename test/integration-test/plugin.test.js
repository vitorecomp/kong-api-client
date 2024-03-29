
const KongApi = require('../../index.js');
const {config, clean} = require('../helpers');
const {KongError} = require('../../src/domain/kong.error');


beforeEach(async () => {
  await clean();
});

afterEach(async () => {
  await clean();
});

test('Init with new plugin', async () => {
  const lConfig = {
    ...config,
    plugins: {
      protocols: ['http', 'https'],
      name: 'jwt',
    },
  };
  const kong = new KongApi(lConfig);
  const sended = await kong.init();
  expect(sended.plugins).toHaveLength(1);
  expect(sended.plugins[0].id)
      .not.toBeUndefined();
});

test('Add Plugin without class', async () => {
  // create kong
  const kong = new KongApi(config);
  await kong.init();
  // add plugin
  const sended = await kong.addPlugin({
    protocols: ['http', 'https'],
    name: 'jwt',
  });

  expect(sended.id).not.toBeUndefined();
  // get plugin
  const recived = await kong.findPlugin(sended.id);

  expect(recived.id).toBe(sended.id);
  expect(String(recived.data.protocols))
      .toBe(String(sended.data.protocols));
  expect(recived.data.name).toBe(sended.data.name);
});

test('Update Plugin', async () => {
  // create kong
  const kong = new KongApi(config);
  await kong.init();
  // add plugin
  let sended = await kong.addPlugin({
    protocols: ['http', 'https'],
    name: 'jwt',
  });

  sended = await kong.updatePlugin(sended.id, {
    protocols: ['https'],
  });
  expect(sended.id).not.toBeUndefined();
  const recived = await kong.findPlugin(sended.id);

  expect(recived.id).toBe(sended.id);
  expect(String(recived.data.protocols))
      .toBe(String(sended.data.protocols));
  expect(recived.data.name).toBe(sended.data.name);
});

test('Remove Plugin', async () => {
  // create kong
  const kong = new KongApi(config);
  await kong.init();
  // add plugin
  const sended = await kong.addPlugin({
    protocols: ['http', 'https'],
    name: 'jwt',
  });


  await kong.deletePlugin(sended.id);
  // get plugin
  try {
    await kong.findPlugin(sended.id);
  } catch (e) {
    expect(e).toBeInstanceOf(KongError);
  }
});

test('Remove a invalid Plugin', async () => {
  // create kong
  const kong = new KongApi(config);
  await kong.init();

  // get plugin
  try {
    await kong.deletePlugin('123jdaskd');
  } catch (e) {
    expect(e).toBeInstanceOf(KongError);
  }
});

test('Update a invalid Plugin', async () => {
  // create kong
  const kong = new KongApi(config);
  await kong.init();

  // get plugin
  try {
    await kong.updatePlugin('123jdaskd', {});
  } catch (e) {
    expect(e).toBeInstanceOf(KongError);
  }
});
