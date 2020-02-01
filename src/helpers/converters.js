export const toArray = (inputArray) => {
	let array = [];
	if (inputArray) {
		array = Array.isArray(inputArray)
			? inputArray
			: [inputArray];
	}
	return array;
};

export const convertList = (list, Class) => {
	return list.map(item =>
		(item instanceof Class)
			? item
			: new Class(item)
	);
};


export default {
	toArray,
	convertList
};