
const KongApi = require('../../index.js');
const {config, clean} = require('../helpers');
const {KongError} = require('../../src/domain/kong.error');


beforeEach(async () => {
  await clean();
});

afterEach(async () => {
  await clean();
});

const getService = async () => {
  const kong = new KongApi(config);
  await kong.init();
  // add service
  const addedService = await kong.addService({
    protocol: 'http',
    host: 'www.test.com',
    port: 8080,
    name: 'teste',
  });
  return {
    id: addedService.id,
  };
};

test('Init with new route', async () => {
  const lConfig = {
    ...config,
    routes: {
      protocols: ['http', 'https'],
      methods: ['GET', 'POST'],
      hosts: ['example.com', 'foo.test'],
      paths: ['/foo', '/bar'],
      service: await getService(),
    },
  };
  const kong = new KongApi(lConfig);

  const sended = await kong.init();
  expect(sended.routes).toHaveLength(1);
  expect(sended.routes[0].id)
      .not.toBeUndefined();
});

test('Add Route without class', async () => {
  // create kong
  const kong = new KongApi(config);
  await kong.init();
  // add route
  const sended = await kong.addRoute({
    protocols: ['http', 'https'],
    methods: ['GET', 'POST'],
    hosts: ['example.com', 'foo.test'],
    paths: ['/foo', '/bar'],
    service: await getService(),
  });

  expect(sended.id).not.toBeUndefined();
  // get route
  const recived = await kong.findRoute(sended.id);

  expect(recived.id).toBe(sended.id);
  expect(String(recived.data.methods))
      .toBe(String(sended.data.methods));
  expect(String(recived.data.protocols))
      .toBe(String(sended.data.protocols));
  expect(recived.data.sources).toBe(sended.data.sources);
  expect(recived.data.name).toBe(sended.data.name);
});

test('Update Route', async () => {
  // create kong
  const kong = new KongApi(config);
  await kong.init();
  // add route
  let sended = await kong.addRoute({
    protocols: ['http'],
    methods: ['GET', 'POST'],
    hosts: ['example.com', 'foo.test'],
    paths: ['/foo', '/bar'],
    service: await getService(),
  });

  sended = await kong.updateRoute(sended.id, {
    protocols: ['https'],
  });
  expect(sended.id).not.toBeUndefined();
  const recived = await kong.findRoute(sended.id);

  expect(recived.id).toBe(sended.id);
  expect(String(recived.data.methods))
      .toBe(String(sended.data.methods));
  expect(String(recived.data.protocols))
      .toBe(String(sended.data.protocols));
  expect(recived.data.sources).toBe(sended.data.sources);
  expect(recived.data.name).toBe(sended.data.name);
});

test('Remove Route', async () => {
  // create kong
  const kong = new KongApi(config);
  await kong.init();
  // add route
  const sended = await kong.addRoute({
    protocols: ['http', 'https'],
    methods: ['GET', 'POST'],
    hosts: ['example.com', 'foo.test'],
    paths: ['/foo', '/bar'],
    service: await getService(),
  });


  await kong.deleteRoute(sended.id);
  // get route
  try {
    await kong.findRoute(sended.id);
  } catch (e) {
    expect(e).toBeInstanceOf(KongError);
  }
});

test('Remove a invalid Route', async () => {
  // create kong
  const kong = new KongApi(config);
  await kong.init();

  // get route
  try {
    await kong.deleteRoute('123jdaskd');
  } catch (e) {
    expect(e).toBeInstanceOf(KongError);
  }
});

test('Update a invalid Route', async () => {
  // create kong
  const kong = new KongApi(config);
  await kong.init();

  // get route
  try {
    await kong.updateRoute('123jdaskd', {});
  } catch (e) {
    expect(e).toBeInstanceOf(KongError);
  }
});
