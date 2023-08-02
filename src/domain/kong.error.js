
class KongError extends Error {
	constructor(err) {
		super(err);
		if (typeof err == 'string') {
			this.type = 'NE';
			this.msg = err;
		} else {
			this.type = 'UN';
			this.err = err;
		}
	}
}

const undefinedUrl = new KongError('admin_url must be diferent of undefined');

const notFound = endpoint => new KongError(endpoint);

const serviceError = response => response instanceof KongError
	? response
	: new KongError(response);


const invalidField = field =>
	new KongError(`The field ${field} is invalid`);

const undefinedField = field =>
	new KongError(`The field ${field} cannot be undefined`);

const semiOptionalField = fields =>
	new KongError(`One of the files must be defined: ${fields}`);

module.exports = {
	KongError,
	undefinedUrl,
	notFound,
	serviceError,
	invalidField,
	undefinedField,
	semiOptionalField
};
