$(function() {

	var appName = 'Uss';

	document.title = appName;

	var globalLoadingElement = $('<div>')
		.addClass('global-loader')
		.appendTo('body')
		.activity();

	var appContainer = $('<div>')
		.addClass('app-container')
		.html('Your app will be here. <small>To get started, open this URL in another browser tab.</small>')
		.appendTo('body');
	
	var client = (function() {
		var connected = false;
		var selfId = false;
		
		var reconnectTimeout = 1 * 1000; // 1 sec
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
					
					console.log(message);
					
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
		.addClass('connected-clients')
		.appendTo('body');

	var connectedClientsContainerHeader = $('<h1>')
		.text('Connected users');

	var connectedUsersCounter = $('<span>')
		.addClass('connected-users-counter')
		.appendTo(connectedClientsContainerHeader)
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
		gpswatch_start();
		
		globalLoadingElement.detach();
		connectedClientsContainerHeader.appendTo(connectedClientsContainer);
	};

	var onDisconnect = function() {
		// do smth when disconnected
		globalLoadingElement.appendTo('body');
		clientsData = {};
		connectedClientsContainer.empty();
		connectedClientsElements = {};
	};
	
	var constructClientNameElement = function(data) {
		if (!connectedClientsElements[data.id]) {
			connectedClientsElements[data.id] = $('<div>')
				.appendTo(connectedClientsContainer)
				.text((!data.name ? data.id : data.name) + (data.id == client.selfId() ? ' (you)' : ''))
				.addClass('client-name' + (data.id == client.selfId() ? ' you' : ''));
		}
		else {
			connectedClientsElements[data.id]
				.text((!data.name ? data.id : data.name) + (data.id == client.selfId() ? ' (you)' : ''))
				.addClass('client-name' + (data.id == client.selfId() ? ' you' : ''));
		}
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
		},
		'client.locations.updated': function(data) {
			if (!clientsData[data.id]) return false;
			clientsData[data.id].locations = locations;
		}
	};
	
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
	
	// GPS SECTION
		
	var distance = function(lat1, lng1, lat2, lng2) {
		var lat1 = parseFloat(lat1),
			lng1 = parseFloat(lng1),
			lat2 = parseFloat(lat2),
			lng2 = parseFloat(lng2);
		
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
	var locations = new Array();
	var dot_radius = 3;
	
	// temp
	locations.push({
		'lat': 59.44314,
		'lng': 24.73192
	});
	
	var gpswatch_start = function(e) {
		
		if (!navigator.geolocation) {
			console.log('Device has no geolocation support.');
			return false;
		}
		
		gpswatch = navigator.geolocation.watchPosition(gpsNewPosition, gpsError, {
			maximumAge: 0,
			timeout: 10000,
			enableHighAccuracy: true
		});
		
		console.log('gpswatch started');
		
	};
	
	var gpsNewPosition = function(position) {
	
		var lat = parseFloat(position.coords.latitude.toFixed(5)),
			lng = parseFloat(position.coords.longitude.toFixed(5));
		
		if (locations.length > 0) {
            // var selfId = client.selfId();
            // console.log(clientsData);
            // var last_location = clientsData[client.selfId()][locations][locations.length - 1];
			var last_location = locations[locations.length - 1];
			distance = distance(last_location.lat, last_location.lng, lat, lng);
			
			console.log(distance);
			
			if (distance >= dot_radius * 2) {
				locations.push({
					'lat': lat,
					'lng': lng
				});

				client.send('update.locations', { locations: locations });
			}
		}
		
		console.log("locations: " + locations);
		console.log("locations.length: " + locations.length);
	};

	var gpsError = function(error) {
		if (error.code==1) {
			alert("User denied geolocation.");
		}
		else if (error.code==2) {
			alert("Position unavailable.");
		}
		else if (error.code==3) {
			alert("Timeout expired.");
		}
		else {
			alert("ERROR:"+ error.message);
		}
	};
		
});
