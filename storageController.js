const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();

const dbFile = "./.data/sqlite.db";
const db = new sqlite3.Database(dbFile);
const exists = fs.existsSync(dbFile);

// Prepare the schema for the database.
const dbSchema = `CREATE TABLE IF NOT EXISTS feed (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    feedUrl TEXT UNIQUE,
    lastFetched INTEGER
  );

  CREATE TABLE IF NOT EXISTS entry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guid TEXT UNIQUE,
    title TEXT,
    entryUrl TEXT,
    publishDate INTEGER,
    feedId INTEGER NOT NULL,
    FOREIGN KEY (feedId) REFERENCES feed (id)
  );
`;

exports.initialize = () => {
  db.serialize(() => {
    // If ./.data/sqlite.db does not exist, create it...
    if (!exists) {
      console.log("📝 Creating 'feed' and 'entry' tables in database...");
      db.exec(dbSchema, error => {
        error ? console.log("🚫 Error creating database:", error) : console.log("✅ Done!");
      });
    } else {
      // ...otherwise print records to console.
      console.log("✅ Database tables 'feed' and 'entry' ready to go!");
      db.each("SELECT COUNT(*) AS count FROM feed", (err, row) => {
        if (row) {
          console.log(
            `💫 There are ${row.count} entries in the 'feed' table.`
          );
        } else {
          console.log("📥 The 'feed' table is empty!");
        }
      });
      db.each("SELECT COUNT(*) AS count FROM entry", (err, row) => {
        if (row) {
          console.log(
            `💫 There are ${row.count} entries in the 'entry' table.`
          );
        } else {
          console.log("📥 The 'entry' table is empty!");
        }
      });
    }
  });
};

exports.insertNewestEntries = async function(feedObject) {
  // Add a way to lock insertions to the database.
  if (process.env.DISALLOW_WRITE) {
    console.log("🔏 Writing to the database is locked.");
    return;
  }
  
  const lastFetched = new Date();
  let feedId;
  
  // Try to find the feed in the database, and return early if we can't.
  try {
    feedId = await findFeedIdFromURL(feedObject.meta.link);
  }
  catch (error) {
    console.error(error);
    return;
  }
  
  // If the feed exists, add any new entries. If not, add all found entries.
  if (feedId) {
    console.log("✅ Found the feed!");
    
    // Get the date of the last article published.
    let lastPublishDate;
    try {
      lastPublishDate = await getLastPublishedDateFromFeedWithId(feedId);
    }
    catch (error) {
      console.error(error);
      return;
    }
    
    feedObject.items.forEach(item => {
      if (item.pubdate > lastPublishDate) {
        console.log("🔍 Found newer entry with date", new Date(item.pubdate));
        insertEntry(item, feedId);
      }
    });
    console.log("✅ Done adding new entries.");
    
  } else {
    console.log("🚫 No feed found!");
        
    // Set up our insert queries.
    const feedSql = "INSERT INTO feed (title, feedUrl, lastFetched) VALUES (?, ?, ?)";
    const entrySql = "INSERT INTO entry (guid, title, entryUrl, publishDate, feedId) VALUES (?, ?, ?, ?, ?)";
    
    db.serialize(() => {
      // Insert the feed metadata into the 'feed' table.
      db.run(
        feedSql, [feedObject.meta.title, feedObject.meta.link, Date.parse(lastFetched)], function(error) {
          console.log("📝 Inserting metadata into 'feed' table...");
          if (error) {
            console.log("🚫 Error inserting feed:", error);
            return 400;
          } else {
            console.log("✅ Done inserting feed!");
            feedId = this.lastID;
            console.log("📝 Created feed with id", feedId);
      
            // Insert the entries into the 'entry' table.
            console.log("📝 Inserting " + feedObject.items.length + " entries into 'entry' table...");
            feedObject.items.forEach(item => {
              insertEntry(item, feedId);
            });
            console.log("✅ Done inserting feed entries!");
          }
        }
      );
    });
  }
};

function findFeedIdFromURL(feedUrl) {
  return new Promise((resolve, reject) => {
    console.log("🔍 Looking for", feedUrl);
    const sql = `SELECT id FROM feed WHERE feedUrl = ?`;
    db.serialize(() => {
      db.get(sql, [feedUrl], (error, row) => {
        if (error) {
          console.error("🚫 Error querying 'feed' table for feedUrl");
          reject(undefined);
        }

        if (row) {
          console.log("✅ Found a matching feed with id", row.id);
          resolve(row.id);
        } else {
          console.log("🚫 No matching feed found.");
          resolve(undefined);
        }
      });
    });
  })  
}

function getLastPublishedDateFromFeedWithId(feedId) {
  return new Promise((resolve, reject) => {
    console.log("🔍 Looking for last publish date for feed with id", feedId);
    const sql = `SELECT publishDate FROM entry WHERE feedId = ? ORDER BY publishDate DESC LIMIT 1`;
    db.serialize(() => {
      db.get(sql, [feedId], (error, row) => {
        if (error) {
          console.error("🚫 Error querying 'entry' table for last publishDate");
          reject(undefined);
        }

        if (row) {
          const lastPublishDate = new Date(row.publishDate);
          console.log("✅ Last publishDate found as", lastPublishDate);
          resolve(row.publishDate);
        } else {
          console.log("🚫 No matching entry found.");
          resolve(undefined);
        }
      })
    })
  });
  
}

function insertEntry(item, feedId) {
  console.log("📝 Inserting new item into 'entry' table...");
  const entrySql = "INSERT INTO entry (guid, title, entryUrl, publishDate, feedId) VALUES (?, ?, ?, ?, ?)";
  const publishDate = Date.parse(item.pubdate);
  db.run(entrySql, [item.guid, item.title, item.permalink, publishDate, feedId], function(error) {
    if (error) {
      console.log("🚫 Error inserting entry:", error);
      return 400;
    } else {
      console.log("📝 Inserted entry with title '" + item.title + "'");
    }
  });
}