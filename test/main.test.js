let KongApi = require('../index.js');
import { config } from './helpers';
import { KongError } from '../src/domain/kong.error';

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

test('Simple init test', async () => {
	let kong = new KongApi(config);
	kong.init();
});

test('Init test without url', async () => {
	try {
		new KongApi({});
	} catch (e) {
		expect(e).toBeInstanceOf(KongError);
	}
});


