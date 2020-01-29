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

module.exports = utils;