export const urlPrep = (url, prefix) => {
	if (url[url.length - 1] != '/') url += '/';
	url += prefix;
	return url;
};

export default {
	urlPrep
};
