const Domain = require('../domain/domain.class');

module.exports = class Consumer extends Domain {
	static endpoint() {
		return 'consumers';
	}
	endpoint() {
		return 'consumers';
	}

	static builder() {
		return Consumer;
	}

	constructor(input) {
		super();
		this.data = {
			...input,
			id: undefined
		};
		//in case
		this.id = input.id;
	}
};
