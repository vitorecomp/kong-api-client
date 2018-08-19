let Plugin = require('../libs/service.lib')
let Consumer = require('../libs/service.lib')

let BasicApi = require('../domain/basic.class')
let KongError = require('../domain/kong.error')

var assert = require('assert');
const axios = require('axios');


class Service extends BasicApi {
	constructor(input, url) {
		super(input)
		this.name = input.name
		this.id = input.id
		this.url = url + 'service/'
		this.url += input.name
	}
}


module.exports = Service


