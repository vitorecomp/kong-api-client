let KongApi = require('../index.js');

const config = {
	admin_url: 'http://localhost:8001',
};

const clean = async (done) => {
	try {
		let kong = new KongApi(config);
		await kong.init();
		await kong.clean();
	} catch (error) {
		await new Promise(r => setTimeout(r, 1000));
		let kong = new KongApi(config);
		await kong.init();
		await kong.clean();
	}
	done();
};

module.exports = {
	config,
	clean
};