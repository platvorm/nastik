var env = (process.env.NODE_ENV === 'production' ? 'production' : 'development'); // start up with NODE_ENV=production, Express-like.
var enabledTransports = ['polling']; // possible options: ['polling', 'websocket', 'flashsocket']

var httpRequestHandler = function (request, response) {
	var uri = request.url.substr(1).split('/');

	if (uri[0] !== 'engine.io' || uri[0] == '') {
		request.addListener('end', function () {
			staticServer.serve(request, response);
		});
    }
    else if (uri[0] == 'engine.io') {
    	server.handleRequest(request, response);
    }
};

var engine = require('engine.io');
var httpServer = require('http').createServer();

httpServer.listen(3000);

var server = new engine.Server({ transports: enabledTransports });

var staticServerProvider = require('node-static'),
	staticServer = new(staticServerProvider.Server)('./public');

var log = function() {
	if (env == 'development') {
		console.log.apply(this, arguments);
	}
};

httpServer.on('upgrade', function (req, socket, head) {
	server.handleUpgrade(req, socket, head);
});

httpServer.on('request', httpRequestHandler);

// make main data containers
var clientsData = {};
var treatsData = [];

// helper functions
var getRandomNumberBetween = function(lo, hi) {
	return (lo + Math.random() * (hi - lo));
};

var toPoint = function(lat, lon, map_width, map_height) {
    var y = ((-1 * lat) + 90) * (map_height / 180);
    var x = (lon + 180) * (map_width / 360);
    
    return {
    	x: x,
    	y: y
    };
}

// game setup
var getGameSite = function() {
	
	var currentGameSite = 'linda';
	
	var gameSites = {
		'vabaduse': {
			top: 59.43420,
			bottom: 59.43340,
			left: 24.74365,
			right: 24.74525
		},
		'linda': {
			top: 59.44345,
			bottom: 59.44265,	// 80
			left: 24.73060,
			right: 24.73220,	// 160
			lat_center: 59.443283,
			lon_center: 24.731743,
			diameter: 80
		},
		'rävala': {
			top: 59.43485,
			bottom: 59.43325,
			left: 24.75250,
			right: 24.75570
		}
	};
	
	return gameSites[currentGameSite];
};


var generateTreats = function() {
	var numberOfTreats = 3;
	
	while (treatsData.length < numberOfTreats) {
		treatsData.push({
			'lat': getRandomNumberBetween(getGameSite().bottom, getGameSite().top),
			'lng': getRandomNumberBetween(getGameSite().left, getGameSite().right)
		});
	}
};

generateTreats();


log('Server started. Now point your browser to http://localhost:3000/');

server.on('connection', function (client) {

	log('new client connected', client.id);

	clientsData[client.id] = { id: client.id };
	
	publishToAll({
		command: 'new.client.connected',
		data: {
			id: client.id
		}
	}, client);
	
	sendData(client, {
		command: 'current.connected.clients',
		data: {
			clients: clientsData
		}
	});
	
	sendData(client, {
		command: 'current.game.site',
		data: {
			site: getGameSite()
		}
	});
	
	client.on('message', function (message) {
		
		try {
			message = JSON.parse(message);
		}
		catch(err) {
			throw err;
		}

		log('new message received from ' + client.id, message);
		
		if (message.command && message.data && typeof handlers[message.command] === 'function') {
			handlers[message.command](client, message.data);
		}
	
	});
	
	client.on('close', function () {
	
		publishToAll({
			command: 'client.disconnected',
			data: {
				id: client.id
			}
		}, client);
		
		delete clientsData[client.id];
	
	});

});

var sendData = function(toClient, message) {
	toClient.send(JSON.stringify(message));
};

var publishToAll = function(message, byClient) {
	if (!message.data) message.data = {};
	if (byClient && byClient.id) message.data._sentBy = byClient.id;
	
	console.log('publishing message to all', message);
	
	for (var clientId in server.clients) {
		if (server.clients.hasOwnProperty(clientId)) {
			server.clients[clientId].send(JSON.stringify(message));
		}
	}
};

var handlers = {
	'update.name': function(client, data) {
		if (!data.name) return false;
		
		clientsData[client.id].name = data.name;
		
		publishToAll({
			command: 'client.name.updated',
			data: {
				id: client.id,
				name: data.name
			}
		}, client);
	},
	'update.locations': function(client, data) {
		if (!data.locations) return false;
		
		// id, lat, lng
		if (areCollided(client.id, data.locations[data.locations.length - 1].lat, data.locations[data.locations.length - 1].lng) == 1) {
			console.log('COLLISION!');
			
			// back to level1
			publishToAll({
				command: 'client.level.updated',
				data: {
					id: client.id,
					level: 1
				}
			}, client);
		}
		else if (areCollided(client.id, data.locations[data.locations.length - 1].lat, data.locations[data.locations.length - 1].lng) == 2) {
			console.log('FOUND A TREAT!');
			
			// level up!
			clientsData[client.id].level = data.level;
			
			publishToAll({
				command: 'client.level.updated',
				data: {
					id: client.id,
					level: (data.level + 1)
				}
			}, client);
		}
		
		clientsData[client.id].locations = data.locations;
		
		publishToAll({
			command: 'client.locations.updated',
			data: {
				id: client.id,
				locations: data.locations
			}
		}, client);
	},
	'update.level': function(client, data) {
		console.log('update.level');
		console.log(data);
		
		if (!data.level) return false;
		
		clientsData[client.id].level = data.level;
		
		publishToAll({
			command: 'client.level.updated',
			data: {
				id: client.id,
				level: data.level
			}
		}, client);
	},
	'get.treats': function(data) {
		publishToAll({
			command: 'treats.updated',
			data: {
				treatsData: treatsData
			}
		});
	}
};

var distanceBetweenPoints = function(lat1_temp, lng1_temp, lat2_temp, lng2_temp) {
	var lat1 = parseFloat(lat1_temp),
		lng1 = parseFloat(lng1_temp),
		lat2 = parseFloat(lat2_temp),
		lng2 = parseFloat(lng2_temp);
	
	var R = 6371 * 1000;						// Radius of the earth in km * 1000
	var dLat = (lat2-lat1) * Math.PI / 180;		// to rad
	var dLon = (lng2-lng1) * Math.PI / 180; 
	var a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2); 
	var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
	var d = R * c; 								// Distance in m
	return d;
};

var areCollided = function(id, lat, lng) {
	var others = clientsData;
	
	for (property in others) {
		if (others.hasOwnProperty(property)) {
			if (others[property].id === id) {
			}
			else {
				if (others[property].locations > others[property].level) {
					for (var i = 1; i <= others[property].level; i++) {
						console.log("areCollided : " + i + "i, level: " + others[property].level);
						if (others[property].hasOwnProperty('locations')) {
							var locations = others[property].locations;
						
							// var other_lat = others[property].locations[others[property].locations.length - i].lat;
							// var other_lng = others[property].locations[others[property].locations.length - i].lng;
							
							var other_lat = locations[locations.length - i].lat;
							var other_lng = locations[locations.length - i].lng;
						
							if (distanceBetweenPoints(lat, lng, other_lat, other_lng) < 3 * 2) {
								return 0;
							}
						}
					}
				}
			}
		}
	}
	
	if (treatsData) {
		for (var i in treatsData) {
			// console.log("treat @ " + treatsData[i].lat + ", " + treatsData[i].lng);
			
			if (distanceBetweenPoints(lat, lng, treatsData[i].lat, treatsData[i].lng) < 3 * 2) {
				return 1;
			}
			
			// remove
			treatsData.splice(i, 1);
			
			// gen new
			generateTreats();
			
		}
	}	
};