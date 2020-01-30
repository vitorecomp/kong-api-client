const KongError = {};
KongError.UndefinedUrl = new Error('admin_url must be diferent of undefined');
KongError.notFound = endpoint => new Error(endpoint);
KongError.serviceError = response => new Error(response);

module.exports = KongError;
