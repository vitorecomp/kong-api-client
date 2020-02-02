import Service from '../../src/libs/service.lib';
import { KongError } from '../../src/domain/kong.error';

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