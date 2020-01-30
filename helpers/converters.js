let utils = {};

utils.toArray = (inputArray) => {
	let array = [];
	if (inputArray) {
		array = Array.isArray(inputArray)
			? inputArray
			: [inputArray];
	}
	return array;
};

utils.convertList = (list, Class) => {
	return list.map(item =>
		(item instanceof Class)
			? item
			: new Class(item)
	);
};


module.exports = utils;