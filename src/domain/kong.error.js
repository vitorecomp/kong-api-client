
export class KongError extends Error {
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

export const undefinedUrl =
	new KongError('admin_url must be diferent of undefined');
export const notFound = endpoint => new KongError(endpoint);
export const serviceError = response => response instanceof KongError
	? response
	: new KongError(response);


export const invalidField = field =>
	new KongError(`The field ${field} is invalid`);

export const undefinedField = field =>
	new KongError(`The field ${field} cannot be undefined`);

export const semiOptionalField = fields =>
	new KongError(`One of the files must be defined: ${fields}`);

export default {
	undefinedUrl,
	notFound,
	serviceError,
	invalidField,
	undefinedField,
	semiOptionalField
};
