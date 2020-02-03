import validator from 'validator';

import KongError from '../domain/kong.error';
import Domain from '../domain/domain.class';

export default class Consumer extends Domain {
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
}

module.exports = Consumer;
