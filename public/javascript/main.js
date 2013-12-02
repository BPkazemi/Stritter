$(document).ready(function() {
	var socket = io.connect(window.location.hostname);

	// Everytime we get new data, update the list
	var last_ten_tweets = [];
	socket.on('data', function(data) {
		var total_data_list = "", 
		hourly_data_list = "", 
		previous_hourly_data_list = "",
		tweet="", 
		tweetHTML = "";

		for(category in data.total_data) {
			total_data_list += "<li>" + category + ": " + data.total_data[category] + "</li>";
			hourly_data_list += "<li>" + category + ": " + data.hourly_data[category] + "</li>";

			// If the previous hour's data has been set, update that list!
			if(data.previous_hourly_data !== undefined && data.previous_hourly_data !== null) {
				previous_hourly_data_list += "<li>" + category + ": " + data.previous_hourly_data[category] + "</li>";
			} else {
				previous_hourly_data_list = "(Not enough data)";
			}
		}
		tweet = "<p>" + data.tweet + "</p>";
		last_ten_tweets.push(tweet);


		// Keep only the last 10 tweets! Using a queue.
		if(last_ten_tweets.length > 10) {
			last_ten_tweets.shift();
		}
		for(var i=0; i<last_ten_tweets.length; i++) {
			tweetHTML += last_ten_tweets[i];
		}

		document.getElementById("total_data_container").innerHTML = total_data_list;
		document.getElementById("hourly_data_container").innerHTML = hourly_data_list;
		document.getElementById("previous_hourly_data_container").innerHTML = previous_hourly_data_list;
		document.getElementById("tweet-container").innerHTML = tweetHTML;
	});
});