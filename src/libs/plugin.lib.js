import validator from 'validator';

import KongError from '../domain/kong.error';
import Domain from '../domain/domain.class';

export default class Plugin extends Domain {
	static endpoint() {
		return 'plugins';
	}
	endpoint() {
		return 'plugins';
	}

	static builder() {
		return Plugin;
	}

	constructor(input) {
		super();
		this.data = {
			...input,
			id: undefined
		};
		//in case
		this.id = input.id;

		//validate the fields of the service
		if (typeof this.data.protocols === 'undefined') {
			throw KongError.undefinedField('protocols');
		}
	}
}

module.exports = Plugin;
