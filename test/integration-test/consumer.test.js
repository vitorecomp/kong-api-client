
const KongApi = require('../../index.js');
const {config, clean} = require('../helpers');
const {KongError} = require('../../src/domain/kong.error');


beforeEach(async () => {
  await clean();
});

afterEach(async () => {
  await clean();
});


test('Init with new consumer', async () => {
  const lConfig = {
    ...config,
    consumers: {
      username: 'my-username',
      custom_id: 'my-custom-id',
    },
  };
  const kong = new KongApi(lConfig);

  const sended = await kong.init();
  expect(sended.consumers).toHaveLength(1);
  expect(sended.consumers[0].id)
      .not.toBeUndefined();
});

test('Add Consumer without class', async () => {
  // create kong
  const kong = new KongApi(config);
  await kong.init();
  // add consumer
  const sended = await kong.addConsumer({
    username: 'my-username',
    custom_id: 'my-custom-id',
  });

  expect(sended.id).not.toBeUndefined();
  // get consumer
  const received = await kong.findConsumer(sended.id);

  expect(received.id).toBe(sended.id);

  expect(received.data.username).toBe(sended.data.username);
  expect(received.data.custom_id).toBe(sended.data.custom_id);
});

test('Update Consumer', async () => {
  // create kong
  const kong = new KongApi(config);
  await kong.init();
  // add consumer
  let sended = await kong.addConsumer({
    username: 'my-username',
    custom_id: 'my-custom-id',
  });

  sended = await kong.updateConsumer(sended.id, {
    protocols: ['https'],
  });
  expect(sended.id).not.toBeUndefined();
  const received = await kong.findConsumer(sended.id);


  expect(received.id).toBe(sended.id);

  expect(received.data.username).toBe(sended.data.username);
  expect(received.data.custom_id).toBe(sended.data.custom_id);
});

test('Remove Consumer', async () => {
  // create kong
  const kong = new KongApi(config);
  await kong.init();
  // add consumer
  const sended = await kong.addConsumer({
    username: 'my-username',
    custom_id: 'my-custom-id',
  });


  await kong.deleteConsumer(sended.id);
  // get consumer
  try {
    await kong.findConsumer(sended.id);
  } catch (e) {
    expect(e).toBeInstanceOf(KongError);
  }
});

test('Remove a invalid Consumer', async () => {
  // create kong
  const kong = new KongApi(config);
  await kong.init();

  // get consumer
  try {
    await kong.deleteConsumer('notFoundConsumer');
  } catch (e) {
    expect(e).toBeInstanceOf(KongError);
  }
});

test('Update a invalid Consumer', async () => {
  // create kong
  const kong = new KongApi(config);
  await kong.init();

  // get consumer
  try {
    await kong.updateConsumer('notFoundConsumer', {});
  } catch (e) {
    expect(e).toBeInstanceOf(KongError);
  }
});
