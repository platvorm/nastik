$(function() {

	var appName = 'nastik (alfa)';

	document.title = appName;

	// ylesehitus
	var header = $('<div>')
		.addClass('header')
		.appendTo('body');

	var appTitleElement = $('<h1>')
		.text(appName)
		.appendTo(header);
	
	var nameForm = $('<div>')
		.appendTo('body')
		.addClass('name-form');
	
	var globalLoadingElement = $('<div>')
		.addClass('global-loader')
		.appendTo('body');

	var treatsData = [];
	var currentGameSite = {};
	
	var client = (function() {
		var connected = false;
		var selfId = false;
		
		var reconnectTimeout = 3000;
		var reconnectingInterval = false;

		var socket = false;
		
		// connect
		var connect = function() {
			if (connected) return false;
			
			socket = new eio.Socket({ host: document.location.hostname, port: 3000 });
			
			socket.onopen = function () {
				connected = true;
				
				selfId = socket.id;
				
				console.log('Connected!');

				if (reconnectingInterval) clearInterval(reconnectingInterval);
				
				// message saatmine
				socket.onmessage = function (message) {
					
					if (!message.data) return false;
					
					try {
						message = JSON.parse(message.data);
					}
					catch(err) {
						throw err;
					}
					
					if (message.command) console.log('new message received: ' + message.command, message);
					
					if (message.command && message.data && typeof handlers[message.command] === 'function') {
						handlers[message.command](message.data);
					}
 					
				};
				
				// disconnect
				socket.onclose = function () {
					connected = false;
					reconnectingInterval = setInterval(connect, reconnectTimeout);

					onDisconnect();
				};
				
				onConnect();
				
			};
		};
		
		connect();
		
		return {
			send: function(command, data) {
				console.log('sending message', command, data);
				if (connected) {
					socket.send(JSON.stringify({ command: command, data: data }));
				}
				else {
					alert('not connected');
				}
			},
			isConnected: function() {
				return connected;
			},
			selfId: function() {
				return selfId;
			}
		}
	})();
	
	var connectedClientsElements = {};
	
	var clientsData = {};
	
	var connectedClientsContainer = $('<div>')
		.addClass('connected-clients-container')
		.appendTo('body');

	var connectedUsersCounter = $('<span>')
		.addClass('connected-users-counter')
		.appendTo(appTitleElement)
		.text(0);
	
	var updateClientsCount = function() {
		var count = 0;
		for (var key in clientsData) {
			if (clientsData.hasOwnProperty(key)) count++;
		}
		connectedUsersCounter.text(count);
	};

	var onConnect = function() {
		// do smth when connected
		gpsWatchStart();
		
		// start with level 1
		clientsData[client.selfId()] = {
			'level': 1
		};
		
		client.send('update.level', { 'level': clientsData[client.selfId()].level });
		
		// get treats
		client.send('get.treats', {});
		
		globalLoadingElement.detach();
	};

	var onDisconnect = function() {
		// do smth when disconnected
		globalLoadingElement.appendTo('body');
		clientsData = {};
		connectedClientsContainer.empty();
		connectedClientsElements = {};
	};
	
	var constructClientNameElement = function(data) {
	
		connectedClientsElements[data.id] = $('<div>')
			.text((!data.name ? data.id : data.name) + (data.id == client.selfId() ? ' (you)' : ''))
			.addClass('client-name' + (data.id == client.selfId() ? ' you' : ''));
		
		return connectedClientsElements[data.id];
	};

	// handlers
	var handlers = {
		'new.client.connected': function(data) {
			clientsData[data.id] = data;
			constructClientNameElement(data);
			updateClientsCount();
		},
		'client.disconnected': function(data) {
			delete clientsData[data.id];
			
			if (connectedClientsElements[data.id]) {
				connectedClientsElements[data.id].remove();
				delete connectedClientsElements[data.id];
			}
			updateClientsCount();
		},
		'current.connected.clients': function(data) {
			for (var key in data.clients) {
				if (data.clients.hasOwnProperty(key) && !connectedClientsElements[data.clients[key].id]) {
					
					clientsData[data.clients[key].id] = data.clients[key];
					constructClientNameElement(data.clients[key]);

				}
			}
			updateClientsCount();
		},
		'client.name.updated': function(data) {
			if (!clientsData[data.id]) return false;
			clientsData[data.id].name = data.name;
			
			if (connectedClientsElements[data.id]) {
				constructClientNameElement(data);
			}
			
			draw();
		},
		'client.level.updated': function(data) {
			if (!clientsData[data.id]) return false;

			clientsData[data.id].level = data.level;
		},
		'client.locations.updated': function(data) {
			if (!clientsData[data.id]) return false;

			clientsData[data.id].locations = data.locations;
			draw();
		},
		'treats.updated': function(data) {
			if (!data.treatsData) return false;
			
			treatsData = data.treatsData;
			
			draw();
		},
		'current.game.site': function(data) {
			currentGameSite = data.site;
		}
	};
	
	var updateNameHandler = function(e) {
		client.send('update.name', { name: nameInput.val() });
	};

	var nameUpdateTimeout = false;
		
	var nameInput = $('<input type="text" placeholder="Enter Your Name">')
		.appendTo(nameForm)
		.on('keyup', function(e) {
			if (nameUpdateTimeout) clearTimeout(nameUpdateTimeout);
			if (nameInput.val() != '') nameUpdateTimeout = setTimeout(updateNameHandler, 300);
		});
	
	var locations = $('<div>')
		.appendTo('body')
		.addClass('locations');
	
	var map_wrap = $('<div>')
		.css({
			position: 'fixed',
			top: '48px',
			left: '0',
			right: '0',
			bottom: '0'
		})
		.addClass('map-wrapper')
		.appendTo('body');
	
	var map = $('<canvas>')
		.attr('id', 'map')
		.attr('width', map_wrap[map_wrap.height() < map_wrap.width() ? 'height' : 'width']())
		.attr('height', map_wrap[map_wrap.height() < map_wrap.width() ? 'height' : 'width']())
		.css({
			position: 'absolute',
			top: 0,
			bottom: 0
		})
		.appendTo(map_wrap);
	
	var canvas = document.getElementById("map"); 
	var ctx = canvas.getContext("2d");
	
	var getGameSite = function() {
		return currentGameSite;
	}
	
	var dot_radius = canvas.width / 29.6 / 2;

	
	// GPS SECTION
	
	var toPoint = function(lat, lon, map_width, map_height) {
	    var y = ((-1 * lat) + 90) * (map_height / 180);
	    var x = (lon + 180) * (map_width / 360);
	    
	    return {
	    	x: x,
	    	y: y
	    };
	}
		
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
	}

	// geo
	var gpswatch = null;
	// var dot_radius = 3;
	
	var gpsWatchStart = function(e) {
		
		if (!navigator.geolocation) {
			alert('Device has no geolocation support.');
			return false;
		}
		
		gpswatch = navigator.geolocation.watchPosition(gpsNewPosition, gpsError, {
			maximumAge: 0,
			timeout: 30000,
			enableHighAccuracy: true
		});
		
		console.log('gpswatch started');
	};
	
	var gpsNewPosition = function(position) {
		
		var lat = parseFloat(position.coords.latitude.toFixed(6)),
			lng = parseFloat(position.coords.longitude.toFixed(6));
		
		// if (typeof clientsData[client.selfId()].locations === 'undefined') clientsData[client.selfId()].locations = [];

		if (typeof clientsData[client.selfId()] === 'undefined') {
			clientsData[client.selfId()] = {};
		}
		
		if (typeof clientsData[client.selfId()].locations === 'undefined') {
			clientsData[client.selfId()].locations = [];
		}
		
   		var locations = clientsData[client.selfId()].locations;
   		
   		console.log("self location : " + lat + ", " + lng);
		
		if (locations.length > 0) {
			var last_location = locations[locations.length - 1];
			var distance = distanceBetweenPoints(last_location.lat, last_location.lng, lat, lng);
			
			console.log("distance from previous: " + distance);
			
			if (distance >= dot_radius * 2) {
				locations.push({
					'lat': lat,
					'lng': lng
				});
				
				client.send('update.locations', { locations: locations });
			}
		}
		else {
			client.send('update.locations', { locations: [{'lat': lat, 'lng': lng}] });
		}
		locations.push({
			'lat': lat,
			'lng': lng
		});
		
		client.send('update.locations', { locations: locations });
		
	};

	var gpsError = function(error) {
		if (error.code==1) {
			console.log("User denied geolocation.");
		}
		else if (error.code==2) {
			console.log("Position unavailable.");
		}
		else if (error.code==3) {
			console.log("Timeout expired.");
		}
		else {
			console.log("ERROR:"+ error.message);
		}
	};
		
	var draw = function() {
	
		// clear canvas
		ctx.clearRect(0, 0, canvas.width, canvas.height)

		// oige map range
		var map_range = function(value, from_start, from_end, to_start, to_end) {
			return to_start + (to_end - to_start) * (value - from_start) / (from_end - from_start);
		};
		
		var norm = function(value, start, stop) {
			return (value - start) / (stop - start);
		};

				
		// these are treats
		if (treatsData) {
			for (i in treatsData) {
				
				// var xpos = map_range(treatsData[i].lng, getGameSite().left, getGameSite().right, canvas.width, 0);
				// var ypos = map_range(treatsData[i].lat, getGameSite().bottom, getGameSite().top, canvas.height, 0);
				
				var xpos_norm = norm(treatsData[i].lng, getGameSite().left, getGameSite().right);
				var ypos_norm = norm(treatsData[i].lat, getGameSite().bottom, getGameSite().top);
				
				var xpos = canvas.width * xpos_norm;
				var ypos = canvas.height - (canvas.height * ypos_norm);
				
				console.log("treats pos: " + xpos + " " + ypos);
			
				ctx.fillStyle = "#fff";
				ctx.fillRect(xpos - dot_radius, ypos - dot_radius, dot_radius * 2 - 4, dot_radius * 2 - 4);
			}
			console.log('treats rendered', treatsData);
		}
		
		var drawSnake = function(clientToDraw, colorToDraw) {
		
			var toPoint_p4j = function(lat, lon) {
				return Proj4js.transform(new Proj4js.Proj('WGS84'), new Proj4js.Proj('EPSG:3785'), new Proj4js.Point(lat, lon));
			};

			for (var i = 1; i <= clientToDraw.level; i++) {
			
				var pointOnWorld = toPoint_p4j(clientToDraw.locations[clientToDraw.locations.length - i].lat, clientToDraw.locations[clientToDraw.locations.length - i].lng);
								
				var gameSiteTopLeft = toPoint_p4j(getGameSite().top, getGameSite().left);
				var gameSiteBottomRight = toPoint_p4j(getGameSite().bottom, getGameSite().right);
				
				var point = {};
				
				// (value, from_start, from_end, to_start, to_end)
				point.x = map_range(pointOnWorld.x, gameSiteTopLeft.x, gameSiteBottomRight.x, 0, canvas.width);
				point.y = map_range(pointOnWorld.y, gameSiteTopLeft.y, gameSiteBottomRight.y, 0, canvas.height);
				
				// console.log("point drawn: " + + clientToDraw.id + ": " + pointOnWorld.x + ", " + pointOnWorld.y + " / " + point.x + ", " + point.y);
				
				// visualize								
				ctx.fillStyle = colorToDraw;
				ctx.beginPath();
				ctx.arc(point.x, point.y, dot_radius, (Math.PI / 180) * 0, (Math.PI / 180) * 360, true);  
				ctx.fill();
				
				ctx.fillStyle = '#fff';
				ctx.fillText((!clientToDraw.name ? clientToDraw.id : clientToDraw.name), point.x, point.y);
				
				console.log('client ' + clientToDraw.id + ' position rendered: ' + point.x + ", " + point.y);
			}
		
/*
			for (var i = 1; i <= clientToDraw.level; i++) {
			
				// toPoint(lat, lon, map_width, map_height);
				var pointOnWorld = toPoint(clientToDraw.locations[clientToDraw.locations.length - i].lat, clientToDraw.locations[clientToDraw.locations.length - i].lng, 100, 100);
				
				// var gameSiteWidth = getGameSite().right - getGameSite().left;
				// var gameSiteHeight = getGameSite().top - getGameSite().bottom;
				
				var gameSiteTopLeft = toPoint(getGameSite().top, getGameSite().left, 100, 100);
				var gameSiteBottomRight = toPoint(getGameSite().bottom, getGameSite().right, 100, 100);
				
				var point = {};
				
				// (value, from_start, from_end, to_start, to_end)
				point.x = map_range(pointOnWorld.x, gameSiteTopLeft.x, gameSiteBottomRight.x, 0, canvas.width);
				point.y = map_range(pointOnWorld.y, gameSiteTopLeft.y, gameSiteBottomRight.y, 0, canvas.height);
				
				// console.log("point drawn: " + + clientToDraw.id + ": " + pointOnWorld.x + ", " + pointOnWorld.y + " / " + point.x + ", " + point.y);
				
				// visualize								
				ctx.fillStyle = colorToDraw;
				ctx.beginPath();
				ctx.arc(point.x, point.y, dot_radius, (Math.PI / 180) * 0, (Math.PI / 180) * 360, true);  
				ctx.fill();
				
				ctx.fillStyle = '#fff';
				ctx.fillText((!clientToDraw.name ? clientToDraw.id : clientToDraw.name), point.x, point.y);
				
				console.log('client ' + clientToDraw.id + ' position rendered: ' + point.x + ", " + point.y);
			}
*/
		
		};
		
		for (property in clientsData) {
			if (clientsData.hasOwnProperty(property)) {
				
				(function(currentClient) {
					
					if (!currentClient.locations || !currentClient.level) return false;
					
					if (currentClient.id === client.selfId()) {
						// draw me:
						drawSnake(currentClient, '#f6ec53');
					}
					else {
						// draw enemy:
						drawSnake(currentClient, '#b9232e');
					}
					
				})(clientsData[property]);
				
			}
		}
	}
});
