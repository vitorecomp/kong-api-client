
let KongApi = require('../../index.js');
import { config } from '../helpers';
import { KongError } from '../../src/domain/kong.error';

beforeEach(async () => {
	let kong = new KongApi(config);
	await kong.init();
	return await kong.clean();
});

afterEach(async () => {
	let kong = new KongApi(config);
	await kong.init();
	return await kong.clean();
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
	expect(addedService.port).toBe(service.port);
	expect(addedService.protocol).toBe(service.protocol);
	expect(addedService.host).toBe(service.host);
	expect(addedService.name).toBe(service.name);
});

test('Update Service', async () => {
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

	sended = await kong.updateService(sended.id, {
		port: 8081,
		name: 'teste2'
	});
	expect(sended.id).not.toBeUndefined();
	//get service
	const recived = await kong.findService(sended.id);

	expect(recived.id).toBe(sended.id);
	expect(recived.data.url).toBe(sended.data.url);
	expect(recived.port).toBe(sended.port);
	expect(recived.protocol).toBe(sended.protocol);
	expect(recived.host).toBe(sended.host);
	expect(recived.name).toBe(sended.name);
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
