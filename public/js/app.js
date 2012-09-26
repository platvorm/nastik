$(function() {

	var appName = 'Nastik (alfa)';

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

	// setup map
	var mapContainer = $('<div>')
		.attr('id', 'map')
		.appendTo('body');

	var map = L.map('map', {
		center: [59.433769, 24.744315],
		zoom: 18,
		minZoom: 18,
		minZoom: 18,
		zoomControl: false,
		attributionControl: false,
		dragging: false,
		touchZoom: false,
		scrollWheelZoom: false,
		doubleClickZoom: false,
		boxZoom: false
	});

	L.tileLayer('http://{s}.tile.cloudmade.com/{apiKey}/{styleId}/256/{z}/{x}/{y}.png', {
		apiKey: '1ab3b2f5009e456c985183202cc675e0',
		styleId: 73433,
		attribution: 'Map data &copy;',
		minZoom: 18,
		maxZoom: 18
	}).addTo(map);

	// data containers
	var currentGameSite = {};
	var treats = [];
	

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
			
			socket.onopen = function() {
				connected = true;
				
				selfId = socket.id;
				
				console.log('Connected!');

				if (reconnectingInterval) clearInterval(reconnectingInterval);
				
				// message saatmine
				socket.onmessage = function(message) {
					
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
			'level': 4
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
			
			treats = data.treatsData;
			
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
	
	var getGameSite = function() {
		return currentGameSite;
	}
	

	// GET LOCATION
	
	var gpswatch = null;
	var virginGps = 0;
	
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
	
		if (!position.coords.latitude || !position.coords.longitude) return false;
		
		// don't trust first gps location
		/*
		if (virginGps < 1) {
			return false;
		}
		else {
			virginGps++;
		}
		*/
			
		var newLocation = [
			parseFloat(position.coords.latitude.toFixed(6)),
			parseFloat(position.coords.longitude.toFixed(6))
		];
		
		if (typeof clientsData[client.selfId()] === 'undefined') {
			clientsData[client.selfId()] = {};
		}
		
		if (typeof clientsData[client.selfId()].locations === 'undefined') {
			clientsData[client.selfId()].locations = [];
		}
   		
   		console.log("my location: " + newLocation[0] + ", " + newLocation[1]);
		
		if (clientsData[client.selfId()].locations.length > 0) {
			
			// DISTANCE CHECK
			var newLocationCoord = new L.LatLng(newLocation[0], newLocation[1]);
			
/*
			var pLocation = new L.LatLng(
				clientsData[client.selfId()].locations[clientsData[client.selfId()].locations.length - 1][0],
				clientsData[client.selfId()].locations[clientsData[client.selfId()].locations.length - 1][1]
			);
*/
			
		 	// var pLocation = clientsData[client.selfId()].locations[clientsData[client.selfId()].locations.length - 1];
		 	
		 	console.log(newLocationCoord);
		 	console.log('distance moved: ' + newLocationCoord.distanceTo(pLocation))
		 	
/*
		 	if (newLocation.distanceTo(pLocation) < 3 || newLocation.distanceTo(pLocation) > 60) {
		 		clientsData[client.selfId()].locations.push(newLocation);
		 	}
*/
			// TEMP
			clientsData[client.selfId()].locations.push(newLocation);
		}
		 else {
			clientsData[client.selfId()].locations.push(newLocation);
		}
		
		// score reflects player's length
		while (clientsData[client.selfId()].locations.length > clientsData[client.selfId()].level) {
			clientsData[client.selfId()].locations.shift();
		}
		
		// tell everyone
		client.send('update.locations', { locations: clientsData[client.selfId()].locations });

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
	
	
	// DRAW
	
	var playerVisual = L.layerGroup();
	var othersVisual = L.layerGroup();
	
	var snakeDotStyle = {
		color: 'white',
		stroke: false,
		opacity: 1,
		fillOpacity: 1,
		clickable: false
	};
	
	var draw = function() {

		playerVisual.clearLayers();
		othersVisual.clearLayers();
		
		for (property in clientsData) {
			if (clientsData.hasOwnProperty(property)) {
				
				(function(currentClient) {
					
					if (!currentClient.locations) return false;

					if (currentClient.id === client.selfId()) {
					
						// DRAW YOURSELF
						if (currentClient.locations.length > 1) {
							// draw body lines		
							var polyline = L.polyline(currentClient.locations, {
								color: '#ef4023',
								weight: 16,
								opacity: .75,
								fillOpacity: 1,
								clickable: false
							});
					
							var polylineThin = L.polyline(currentClient.locations, {
								color: 'white',
								weight: 1,
								opacity: 1,
								fillOpacity: 1,
								clickable: false
							});
					
							// add lines to layer
							playerVisual
								.addLayer(polyline)
								.addLayer(polylineThin);
					
							// draw junktion dots
							for (var i = 0, len = currentClient.locations.length; i < len; i++) {
								playerVisual.addLayer(L.circle(currentClient.locations[i], 1, snakeDotStyle));
							}
						}
						else {
							var circle = L.circleMarker(currentClient.locations[0], {
								color: '#ef4023',
								radius: 8,
								stroke: false,
								opacity: .75,
								fillOpacity: 1,
								clickable: false
							});
							
							playerVisual
								.addLayer(circle);
						}
				
						// add to map
						playerVisual
							.addTo(map);
				
						// center map to last position of the player
						map.panTo(clientsData[client.selfId()].locations[clientsData[client.selfId()].locations.length - 1]);
					
					}
					else {
					
						// DRAW ENEMIES
						if (currentClient.locations.length > 1) {
							// draw body lines		
							var polyline = L.polyline(currentClient.locations, {
								color: 'cyan',
								weight: 16,
								opacity: .75,
								fillOpacity: 1,
								clickable: false
							});
					
							var polylineThin = L.polyline(currentClient.locations, {
								color: 'white',
								weight: 1,
								opacity: 1,
								fillOpacity: 1,
								clickable: false
							});
					
							// add lines to layer
							othersVisual
								.addLayer(polyline)
								.addLayer(polylineThin);
					
							// draw junktion dots
							for (var i = 0, len = currentClient.locations.length; i < len; i++) {
								playerVisual.addLayer(L.circle(currentClient.locations[i], 1, snakeDotStyle));
							}
						}
						else {
							othersVisual
								.addLayer(
									L.circleMarker(currentClient.locations[0], {
										color: 'cyan',
										radius: 8,
										stroke: false,
										opacity: .75,
										fillOpacity: 1,
										clickable: false
									})
								);
						}
				
						// add to map
						othersVisual
							.addTo(map);
					}

				})(clientsData[property]);
			}
		}
	};

	var drawTreats = function(treats) {
		for (var i = 0, len = treats.length; i < len; i++) {

		}
		console.log('treats rendered', treats);
	};

});