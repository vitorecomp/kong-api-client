let BasicApi = require('../domain/basic.class')
let KongError = require('../domain/kong.error')
let Service = require('../libs/service.lib')


var assert = require('assert');
const axios = require('axios');

let aux = {
	sync: false,
	service: null
}

addService = async function (url_entry, sync, input) {
	let url = url_entry + 'services'
	let service = null
	
	try {
		//cop
		service = await axios.post(url, input)
		service = new Service(service, url_entry)
	} catch (error) {
		if (!(sync && error.response.status == 409))
			throw error

		//buid the existing service here
		service = await axios.get(url + '/' + input.name);
		service = new Service(service.data, url_entry)
	}

	//adding plugins on service 
	await aux.addPlugins(service, sync, input.plugins ? input.plugins : [])

	//adding routes
	await aux.addRoutes(service, sync, input.routes ? input.routes : [])

	//adding consumers
	let consumers = input.consumers ? input.consumers : []
	await aux.addConsumers(service, sync, consumers)
}



class KongApi extends BasicApi {
	constructor(options) {
		super(options)
		
		assert.notEqual(options, undefined, 'options not defined')
		assert.notEqual(options.admin_url, undefined, 'admin_url not defined')

		this.url = options.admin_url
		if (this.url[this.url.length - 1] != '/')
			this.url += '/'

		this.sync = options.sync

		this.services = []
		if(options.services){
			this.services = Array.isArray(options.services) 
				? options.services
				: [options.services]
			}

		this.plugins = options.plugins
		this.consumers = options.consumers
		this.routes = options.routes
	}

	async init(){
		if (this.services) {
			let proms = this.services.map(async (ser) => {
				await addService(this.url, this.sync, ser)
			})
			await Promise.all(proms)
		}

		if (this.plugins) {
			let proms = this.plugins.map(async (e) => {
				try {
					await this.addPlugin(e)
				} catch (error) {
					if (this.sync && error instanceof KongError) {
						//do same thing
					} else
						throw error
				}
			})
			await Promise.all(proms)
		}

		if (this.consumers) {
			let proms = this.consumers.map(async (e) => {
				try {
					await this.addConsumer(e)
				} catch (error) {
					if (this.sync && error instanceof KongError) {
						//do same thing
					} else
						throw error
				}
			})
			await Promise.all(proms)
		}

		if (this.routes) {
			let proms = this.routes.map(async (e) => {
				try {
					await this.addRoute(e)
				} catch (error) {
					if (this.sync && error instanceof KongError) {
						//do same thing
					} else
						throw error
				}
			})
			await Promise.all(proms)
		}
	}


	async getServices(limit) {
		//llok for the services
		let services = []
		//convert to classes
		await services.forEach((e) => new Service(e))
	}

	async getService(id) {
		//look for the service
		let service = null
		//convert to class
		return new Service(service)
	}

	async addService(service) {
		//add service
		return addService(this.url, service)
	}

	async updateService(id, service) {
		//update service

		let service = null
		//convert to class
		return new Service(service)
	}

	async deleteService(id) {
		//delete service

	}
}


module.exports = KongApi


aux.addRoutes = async function (sync, service, routes) {
	let proms = routes.map(async (route) => {
		try {
			await service.addRoute(route)
		} catch (error) {
			if (!(sync && error instanceof KongError && error.code == 'R401'))
				throw error
		}
	})

	await Promise.all(proms)
}

aux.addPlugins = async function (sync, service, plugins) {
	let proms = plugins.map(async (plugin) => {
		try {
			await service.addPlugin(plugin)
		} catch (error) {
			if (!(sync && error instanceof KongError && error.code == 'P401'))
				throw error
		}
	})
	await Promise.all(proms)
}

aux.addConsumers = async function (sync, service, consumers) {
	let proms = consumers.map(async (consumer) => {
		try {
			await service.addConsumer(consumer)
		} catch (error) {
			if (!(sync && error instanceof KongError && error.code == 'C401'))
				throw error
		}
	})
	await Promise.all(proms)
}

