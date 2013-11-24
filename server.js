// Express
var app = require('express')();
// Required for socket.io
var server = require('http').createServer(app);
// Socket io
var io = require('socket.io').listen(server);
// Twitter
var twitter = require('ntwitter');
var cred = require('./credentials');
// Categories
var categories = require('./categories');
var holidays = categories.holidays;
// Redis (& Heroku)
if (process.env.REDISTOGO_URL) {
    var rtg   = require("url").parse(process.env.REDISTOGO_URL);
	var client = require("redis").createClient(rtg.port, rtg.hostname);

	client.auth(rtg.auth.split(":")[1]);
} else {
    var client = require("redis").createClient();
}

// Start the server
server.listen(process.env.PORT || 3000);


//Set the sockets.io configuration.
//THIS IS NECESSARY ONLY FOR HEROKU!
io.configure(function() {
  io.set('transports', ['xhr-polling']);
  io.set('polling duration', 10);
});


// Setting up basic routing
app.get('/', function (req, res) {
  res.sendfile(__dirname + '/index.html');
});


// ------------ Filter tweets using Twitter's streaming API, -------------
// ------------ and send them to the client. 				 -------------

// Connect to twitter
var t = new twitter({
	consumer_key: cred.consumer_key,
	consumer_secret: cred.consumer_secret,
    access_token_key: cred.access_token_key,
    access_token_secret: cred.access_token_secret
});

// Initializing the data we'll send to the client
var total_data = {};
var hourly_data = {};

var hours_array = [];

// Set the first hour so we have a reference for "prev_hour"
var starting_hour = (new Date()).getHours();
hours_array[starting_hour] = {}
client.set('prev_hour', starting_hour);

// Construct a list of holidays
var holidays_list = [];
for (holiday in categories.holidays) {
	holidays_list.push(holiday);

	client.get(holiday, function(err, res) {
		total_data[holiday] = res;
	});

	var starting_hour_obj = hours_array[starting_hour];
	starting_hour_obj[holiday] = 0;
}

// On first connection, send whatever data we have
io.sockets.on('connection', function(socket) {
	socket.emit('data', total_data);

	// Filter live tweets
	t.stream(
		'statuses/filter',
		{track: holidays_list},
		function(stream) {
			stream.on('data', function(tweet) {
				// Let's see the tweet!
				console.log(tweet.text);

				// Update the hourly data
				var hour = (new Date()).getHours();

				client.get('prev_hour', function(err, previous) {
					// The hour changed!
					if(hour != previous) {
						// So clear the current hour's data
						hours_array[hour] = {}; 
						// And update Redis
						client.set('prev_hour', hour);
					}
					var cur_hour_obj = hours_array[hour];

					// Emit an event for every occurrence, and update the counts
					for(holiday in categories.holidays) {
						if(tweet.text !== undefined && tweet.text !== null) {
							if(tweet.text.toLowerCase().indexOf(categories.holidays[holiday]) > -1) {
								client.incr(holiday);
								cur_hour_obj[holiday]++;
							}
						}
					}

					// Send from Redis
					client.mget(holidays_list, function(err, data) {
						for(holiday in categories.holidays) {
							total_data[holiday] = data[holidays_list.indexOf(holiday)];
						}
					});
				})
				socket.emit('data', { total_data: total_data, hourly_data: hours_array[hour] });
			});
		}
	);
});