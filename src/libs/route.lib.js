import KongError from '../domain/kong.error';
import Domain from '../domain/domain.class';

export default class Route extends Domain {
	static endpoint() {
		return 'routes';
	}
	endpoint() {
		return 'routes';
	}

	static builder() {
		return Route;
	}

	constructor(input = {}) {
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

		//validate the fields of the route
		if (typeof this.data.methods === 'undefined'
			&& typeof this.data.hosts === 'undefined'
			&& typeof this.data.paths === 'undefined') {
			throw KongError.semiOptionalField('methods, host, paths');
		}
	}
}

module.exports = Route;
