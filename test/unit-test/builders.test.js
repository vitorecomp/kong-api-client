const Service = require('../../src/libs/service.lib');
const Route = require('../../src/libs/route.lib');
const { KongError } = require('../../src/domain/kong.error');

test('Service build empty', async () => {
	try {
		new Service();
	} catch (e) {
		expect(e).toBeInstanceOf(KongError);
	}
});

test('Service with url', async () => {
	const service = new Service({
		url: 'http://www.teste.com:8080'
	});
	expect(service.data.url).not.toBeUndefined();
});

test('Service with parameters', async () => {
	const service = new Service({
		protocol: 'http',
		host: 'www.test.com',
		port: 8080
	});
	expect(service.data.protocol).not.toBeUndefined();
	expect(service.data.port).not.toBeUndefined();
	expect(service.data.host).not.toBeUndefined();
});

test('Service with invalid url', async () => {
	try {
		new Service({
			url: 'http://www.teste.com123:8080'
		});
	} catch (e) {
		expect(e).toBeInstanceOf(KongError);
	}
});

test('Service with missing parameters', async () => {
	try {
		new Service({
			protocol: 'http',
			host: 'www.test.com',
		});
	} catch (e) {
		expect(e).toBeInstanceOf(KongError);
	}
});

////////////////
//Routes
///////////////

test('Route build empty', async () => {
	try {
		new Route();
	} catch (e) {
		expect(e).toBeInstanceOf(KongError);
	}
});

test('Route with url', async () => {
	const route = new Route({
		protocols: 'http',
		methods: 'POST',
		destinations: 'http://teste.com'
	});
	expect(route.data.protocols).not.toBeUndefined();
	expect(route.data.methods).not.toBeUndefined();
	expect(route.data.destinations).not.toBeUndefined();
});

test('Route with missing parameters destinations', async () => {
	try {
		new Route({
			protocols: 'http',
			methods: 'POST',
		});
	} catch (e) {
		expect(e).toBeInstanceOf(KongError);
	}
});

test('Route with missing parameters methods', async () => {
	try {
		new Route({
			protocols: 'http',
			destinations: 'http://teste.com'
		});
	} catch (e) {
		expect(e).toBeInstanceOf(KongError);
	}
});