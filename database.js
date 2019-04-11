const sqlite3 = require('sqlite3').verbose();
const config = require('./config.js');
// const logging = require('./logging.js');
// config.database.debug = config.system.debug;
let dab = new sqlite3.Database(':memory:');
module.exports = {
    exec: function (req, param, callback) {
        'use strict';
        dab.serialize(function() {
            dab.run("CREATE TABLE lorem (info TEXT)");

            var stmt = dab.prepare("INSERT INTO lorem VALUES (?)");
            for (var i = 0; i < 10; i++) {
                stmt.run("Ipsum " + i);
            }
            stmt.finalize();

            dab.each("SELECT rowid AS id, info FROM lorem", function(err, row) {
                console.log(row.id + ": " + row.info);
            });
        });

        dab.close();


    },
    error: function (req, err) {
        'use strict';
        // logging.write("./logs/database_error.log", req);
        // logging.write("./logs/database_error.log", JSON.stringify(err));
        throw err;
    }
};


