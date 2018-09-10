let BasicApi = require('../domain/basic.class')
let KongError = require('../domain/kong.error')
let Service = require('../libs/service.lib')


var assert = require('assert')
const axios = require('axios')

let aux = {
	sync: false,
	service: null
}

let addService = async function (url_entry, sync, input) {
	let url = url_entry + 'services'
	let service = null

	let routes = input.routes
	let consumers = input.consumers
	let plugins = input.plugins

	input.consumers = undefined
	input.routes = undefined
	input.plugins = undefined

	try {
		//cop
		service = await axios.post(url, input)
		service = new Service(service.data, url_entry)

		//adding routes
		await aux.addRoutes(service, sync, routes ? routes : [])

	} catch (error) {
		if (!error.response)
			throw error
		if (!(sync && error.response.status == 409))
			throw error

		//buid the existing service here
		service = await axios.get(url + '/' + input.name)
		service = new Service(service.data, url_entry)
	}

	//adding plugins on service 
	await aux.addPlugins(service, sync, plugins ? plugins : [])


	//adding consumers
	await aux.addConsumers(service, sync, consumers ? consumers : [])
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
		if (options.services) {
			this.services = Array.isArray(options.services)
				? options.services
				: [options.services]
		}

		this.plugins = options.plugins
		this.consumers = options.consumers
	}

	async init() {
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
		return await addService(this.url, false, service)
	}

	async updateService(id, service) {
		//update service

		let serviceOn = service
		//convert to class
		return new Service(serviceOn)
	}

	async deleteService(id) {
		//delete service

	}
}


module.exports = KongApi


aux.addRoutes = async function (service, sync, routes) {
	let proms = routes.map(async (route) => {
		try {
			await service.addRoute(route)
		} catch (error) {
			console.log(error)
			if (!(sync && error instanceof KongError && error.code == 'R401'))
				throw error
		}
	})

	await Promise.all(proms)
}

aux.addPlugins = async function (service, sync, plugins) {
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

aux.addConsumers = async function (service, sync, consumers) {
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

