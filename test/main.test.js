let KongApi = require('../index.js');
import { config, clean } from './helpers';
import { KongError } from './../src/domain/kong.error';

beforeEach(async (done) => {
	await clean(done)
});

afterEach(async (done) => {
	await clean(done)
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


