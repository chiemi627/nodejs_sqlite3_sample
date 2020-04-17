// Adapted from https://github.com/danmactough/node-feedparser#usage

const request = require("request");
const FeedParser = require("feedparser");

exports.parse = requestedFeed =>
  new Promise((resolve, reject) => {
    let feedResponse = {};
    let feedItems = [];

    // Set up the request for the feed.
    const feedRequest = request(requestedFeed);

    // We're not setting options because the defaults are fine.
    const options = [];
    const feedparser = new FeedParser([options]);

    feedRequest.on("error", function(error) {
      // Reject the Promise by returning an error, with the origin
      // of the error set to the request.
      reject({ error: error, origin: "request" });
    });

    feedRequest.on("response", function(response) {
      if (response.statusCode !== 200) {
        // If we didn't get a 200 OK, emit an error.
        feedRequest.emit("error", new Error("Bad status code: " + response.statusCode));
      } else {
        // Otherwise, pipe the request into feedparser.
        feedRequest.pipe(feedparser);
      }
    });
  
    feedparser.on("error", function(error) {
      // Reject the Promise by returning an error, with the origin
      // of the error set to feedparser.
      reject({ error: error, origin: "feedparser" });
    });

    feedparser.on("meta", function(meta) {
      // When the meta event is received, add it as a property on feedResponse.
      feedResponse.meta = meta;
    });

    feedparser.on("readable", function() {
      var stream = this,
        item;

      while ((item = stream.read())) {
        // Push each item in the feed into the feedItems array.
        feedItems.push(item);
      }
    });

    feedparser.on("end", function() {
      // Add the feedItems array as a property on feedResponse.
      feedResponse.items = feedItems;
      // Resolve the Promise and return the feedResponse object.
      resolve(feedResponse);
    });
  });
