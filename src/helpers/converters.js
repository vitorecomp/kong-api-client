const toArray = (inputArray) => {
  let array = [];
  if (inputArray) {
    array = Array.isArray(inputArray) ? inputArray : [inputArray];
  }
  return array;
};

const convertList = (list, Class, inject) => {
  return list.map((item) =>
    item instanceof Class ? item :
      new Class({
        ...item,
        ...inject,
      }),
  );
};

module.exports = {
  toArray,
  convertList,
};
