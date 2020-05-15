// server.js
// where your node app starts

// init project
const express = require("express");
const bodyParser = require("body-parser");
const feedparser = require("./feedparser");
const opmlparser = require("./opmlparser");
const storage = require("./storageController")
const app = express();
const fs = require("fs");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// we've started you off with Express,
// but feel free to use whatever libs or frameworks you'd like through `package.json`.

// http://expressjs.com/en/starter/static-files.html
app.use(express.static("public"));

// init sqlite db
const dbFile = "./.data/sqlite.db";
const exists = fs.existsSync(dbFile);
const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database(dbFile);

// Initialize our persistent storage.
storage.initialize();

// http://expressjs.com/en/starter/basic-routing.html
app.get("/", (request, response) => {
  response.sendFile(`${__dirname}/views/index.html`);
});

// A test endpoint for parsing the OPML file in the public directory.
app.get("/opml", async function(request, response) {
  // Call the `getFeedsFromOPML` method in opmlparser.js
  opmlparser.getFeedsFromOPML().then(data => {
    const feeds = [];
    
    // For each feed we find in the OPML file, send it to the
    // feed parser and add the response to the `feeds` array.
    // If there are any errors, send them back to the client.
    data.forEach((feed, index) => {
      feedparser.parse(feed).then(items => {
        feeds.push(items);
        // When we get to the last feed, send the whole feed
        // array back to the client.
        if (index === data.length - 1) { response.send(feeds); }
      }).catch(error => {
        response.send({ error: error });
      });
    });
  }).catch(error => {
    response.send({ error: error });
  });
});

// API endpoint to parse an RSS/Atom feed.
app.get("/api/parse/:feed", async function(request, response) {
  // Try to parse the feed, and return the result to the API client.
  feedparser
    .parse(request.params.feed)
    .then(data => {
      // Success! Return the result to the API client.
      const lastFetched = new Date();    
      storage.insertNewestEntries(data);
      response.send(data);
    })
    .catch(error => {
      // Oh no! Return the error to the API client.
      response.send(error);
    });
});

// endpoint to get all the dreams in the database
app.get("/getDreams", (request, response) => {
  db.all("SELECT * from Dreams", (err, rows) => {
    response.send(JSON.stringify(rows));
  });
});

// endpoint to add a dream to the database
app.post("/addDream", (request, response) => {
  console.log(`add to dreams ${request.body.dream}`);

  // DISALLOW_WRITE is an ENV variable that gets reset for new projects
  // so they can write to the database
  if (!process.env.DISALLOW_WRITE) {
    const cleansedDream = cleanseString(request.body.dream);
    db.run(`INSERT INTO Dreams (dream) VALUES (?)`, cleansedDream, error => {
      if (error) {
        response.send({ message: "error!" });
      } else {
        response.send({ message: "success" });
      }
    });
  }
});

// endpoint to clear dreams from the database
app.get("/clearDreams", (request, response) => {
  // DISALLOW_WRITE is an ENV variable that gets reset for new projects so you can write to the database
  if (!process.env.DISALLOW_WRITE) {
    db.each(
      "SELECT * from Dreams",
      (err, row) => {
        console.log("row", row);
        db.run(`DELETE FROM Dreams WHERE ID=?`, row.id, error => {
          if (row) {
            console.log(`deleted row ${row.id}`);
          }
        });
      },
      err => {
        if (err) {
          response.send({ message: "error!" });
        } else {
          response.send({ message: "success" });
        }
      }
    );
  }
});

// helper function that prevents html/css/script malice
const cleanseString = function(string) {
  return string.replace(/</g, "&lt;").replace(/>/g, "&gt;");
};

// listen for requests :)
var listener = app.listen(process.env.PORT, () => {
  console.log(`Your app is listening on port ${listener.address().port}`);
});
