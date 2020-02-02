
export class KongError {
	constructor(err) {
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
export const serviceError = response =>
	new KongError(response);


export const invalidField = field =>
	new KongError(`The field ${field} is invalid`);

export const undefinedField = field =>
	new KongError(`The field ${field} cannot be undefined`);

export default {
	undefinedUrl,
	notFound,
	serviceError,
	invalidField,
	undefinedField
};
