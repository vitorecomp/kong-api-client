
let KongApi = require('../../index.js');
let config = {
	admin_url: 'http://localhost:8001',
};

beforeEach(async () => {
	let kong = new KongApi(config);
	await kong.init();
	await kong.clean();
});

afterEach(async () => {
	let kong = new KongApi(config);
	await kong.init();
	await kong.clean();
});


test('Init with new service without class', async () => {
	let lConfig = {
		...config,
		services: {

		}
	};
	let kong = new KongApi(lConfig);
	await kong.init();
	await kong.clean();
});

test('Add Service', () => {
	//create kong

	//add service

	//get service
});

test('Update Service', () => {
	//create kong

	//add service

	//update service

	//get service
});

test('Remove Service', () => {
	//create kong

	//add service

	//delete service

	//get service
});