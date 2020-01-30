const helpers = {};
helpers.urlPrep = (url, prefix) => {
	if (url[url.length - 1] != '/') url += '/';
	url += prefix;
	return url;
};

module.exports = helpers;
