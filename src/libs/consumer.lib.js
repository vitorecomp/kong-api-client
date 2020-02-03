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

		//validate url
		if (typeof this.data.url !== 'undefined') {
			if (typeof this.data.url !== 'string')
				throw KongError.invalidField('url');
			if (!validator.isURL(this.data.url))
				throw KongError.invalidField('url');
			return;
		}

		//validate the fields of the consumer
		if (typeof this.data.protocol === 'undefined') {
			throw KongError.undefinedField('protocol');
		}
		if (typeof this.data.host === 'undefined') {
			throw KongError.undefinedField('host');
		}
		if (typeof this.data.port === 'undefined') {
			throw KongError.undefinedField('port');
		}
	}
}

module.exports = Consumer;
