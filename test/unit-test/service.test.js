
beforeEach(() => {
	//create kong
	let KongApi = require('../../index.js');
	let config = {
		admin_url: 'http://localhost:8001',
		sync: true
	};
	let kong = new KongApi(config);
	kong.init();
	kong.clean();
});

afterEach(() => {
	//create kong
	let KongApi = require('../../index.js');
	let config = {
		admin_url: 'http://localhost:8001',
		sync: true
	};
	let kong = new KongApi(config);
	kong.init();
	kong.clean();
});


test('Init with new service', () => {
	//create kong with service
	let KongApi = require('../../index.js');
	let config = {
		admin_url: 'http://localhost:8001',
		sync: true
	};
	let kong = new KongApi(config);
	kong.init();

	//get service

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