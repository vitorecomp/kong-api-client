
let KongApi = require('../../index.js');
import { config, clean } from '../helpers';
import { KongError } from '../../src/domain/kong.error';

beforeEach(async (done) => {
	await clean(done);
});

afterEach(async (done) => {
	await clean(done);
});

test('Init with new service on init with url', async () => {
	let lConfig = {
		...config,
		services: {
			url: 'http://www.teste.com:8080'
		}
	};
	let kong = new KongApi(lConfig);
	const services = await kong.init();
	expect(services.services).toHaveLength(1);
	expect(services.services[0].id).not.toBeUndefined(); services.services[0];
});

test('Init with new service on init with parameter', async () => {
	let lConfig = {
		...config,
		services: {
			protocol: 'http',
			host: 'www.test.com',
			port: 8080
		}
	};
	let kong = new KongApi(lConfig);
	const services = await kong.init();
	expect(services.services).toHaveLength(1);
	expect(services.services[0].id).not.toBeUndefined(); services.services[0];
});

test('Add Service without class', async () => {
	//create kong
	let kong = new KongApi(config);
	await kong.init();
	//add service
	const addedService = await kong.addService({
		protocol: 'http',
		host: 'www.test.com',
		port: 8080,
		name: 'teste'
	});

	expect(addedService.id).not.toBeUndefined();
	//get service
	const service = await kong.findService(addedService.id);

	expect(addedService.id).toBe(service.id);
	expect(addedService.data.url).toBe(service.data.url);
	expect(addedService.data.port).toBe(service.data.port);
	expect(addedService.data.protocol).toBe(service.data.protocol);
	expect(addedService.data.host).toBe(service.data.host);
	expect(addedService.data.name).toBe(service.data.name);
});

test('Update Service', async () => {
	// console.log('start update');
	//create kong
	let kong = new KongApi(config);
	await kong.init();
	//add service
	let sended = await kong.addService({
		protocol: 'http',
		host: 'www.test.com',
		port: 8080,
		name: 'teste'
	});
	// console.log(sended);

	sended = await kong.updateService(sended.id, {
		port: 8081
	});

	// console.log(sended);

	expect(sended.id).not.toBeUndefined();
	//get service
	const recived = await kong.findService(sended.id);

	expect(recived.id).toBe(sended.id);
	expect(recived.data.url).toBe(sended.data.url);
	expect(recived.data.port).toBe(sended.data.port);
	expect(recived.data.protocol).toBe(sended.data.protocol);
	expect(recived.data.host).toBe(sended.data.host);
	expect(recived.data.name).toBe(sended.data.name);
});

test('Remove Service', async () => {
	//create kong
	let kong = new KongApi(config);
	await kong.init();
	//add service
	let sended = await kong.addService({
		protocol: 'http',
		host: 'www.test.com',
		port: 8080,
		name: 'teste'
	});

	await kong.deleteService(sended.id);
	//get service
	try {
		await kong.findService(sended.id);
	} catch (e) {
		expect(e).toBeInstanceOf(KongError);
	}
});

test('Remove a invalid Service', async () => {
	//create kong
	let kong = new KongApi(config);
	await kong.init();

	//get service
	try {
		await kong.deleteService('123jdaskd');
	} catch (e) {
		expect(e).toBeInstanceOf(KongError);
	}
});

test('Update a invalid Service', async () => {
	//create kong
	let kong = new KongApi(config);
	await kong.init();

	//get service
	try {
		await kong.updateService('123jdaskd', {});
	} catch (e) {
		expect(e).toBeInstanceOf(KongError);
	}
});
