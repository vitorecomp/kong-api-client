let BasicApi = require('../domain/basic.class')
let KongError = require('../domain/kong.error')

let Route  = require('../libs/route.lib')
Route = new Route()

class Service extends BasicApi {
	constructor(input, url) {
		super(input)
		this.name = input.name
		this.id = input.id
		this.basic_url = url
		this.url = url + 'service/'
		this.url += input.name
	}

	getRoute(id){
		return Route.getOne(this.url, id)
	}

	addRoute(route){
		route.service = {
			id:this.id
		}
		return Route.add(this.basic_url, route)
	}

	updateRoute(id, route){
		return Route.update(this.basic_url, id, route)
	}

	deleteRoute(id){
		return Route.remove(this.basic_url, id)
	}
}


module.exports = Service


