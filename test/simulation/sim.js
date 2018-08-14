let KongApi = require('../../index.js');

let kong = new KongApi({
	admin_url:"http://localhost:8001",
	services:{

	}
})

kong.init()
