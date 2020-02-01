
export const undefinedUrl =
	new Error('admin_url must be diferent of undefined');
export const notFound = endpoint => new Error(endpoint);
export const serviceError = response =>
	new Error(response);


export const invalidField = field =>
	new Error(`The field ${field} is invalid`);

export const undefinedField = field =>
	new Error(`The field ${field} cannot be undefined`);

export default {
	undefinedUrl,
	notFound,
	serviceError,
	invalidField,
	undefinedField
};
