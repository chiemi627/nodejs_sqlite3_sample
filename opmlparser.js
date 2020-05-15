// Adapted from https://github.com/danmactough/node-opmlparser/blob/master/examples/simple.js

const OpmlParser = require("opmlparser");
const request = require("request");

exports.getFeedsFromOPML = () =>
  new Promise((resolve, reject) => {
    const opmlparser = new OpmlParser()
    let feedUrls = [];

    var opmlRequest = request(`https://${process.env.PROJECT_DOMAIN}.glitch.me/subscriptions.opml`);
    
    opmlRequest.on("error", function(error) {
      // Reject the Promise by returning an error, with the origin
      // of the error set to the request.
      console.log("opmlRequest error!")
      reject({ error: error });
    });
  
    opmlRequest.on("response", function (response) {
      // If we didn't get a 200 OK, emit an error.
      if (response.statusCode != 200) reject(new Error("Bad status code"));
      // Otherwise, pipe the request into feedparser.
      this.pipe(opmlparser);
    })

    opmlparser.on("error", function(error) {
      // Reject the Promise by returning an error, with the origin
      // of the error set to the request.
      console.log("opmlparser error!")
      reject({ error: error });
    });
  
    // If we get a `readable` event, then...
    opmlparser.on("readable", function () {
      let outline;

      // ...so long as there's an outline item
      // available to read.. 
      while (outline = this.read()) {
        if (outline['#type'] === "feed") {
          // ...add its feed URL to the `feedUrls` array.
          feedUrls.push(outline.xmlurl);
        }
      }
    });
  
    // When we're done, resolve the Promise and send back the `feedUrls` object.
    opmlparser.on("end", function () {
      resolve(feedUrls);
    });
  });