class TempLog {
    #rl
    #port
    #navigator

    constructor() {
        const readline = require('node:readline');
        const { stdin: input, stdout: output } = require('node:process');
        this.#rl = readline.createInterface({ input, output });
    
        if (process.argv.length !== 3) {
            console.log('Usage TempLog.js PORT_NUMBER');
            process.exit(0);
        }

        this.#port = process.argv[2];

        const { Navigator } = require("node-navigator");
        this.#navigator = new Navigator();

        this.initRoutes();
        this.processInput();
    }

    initRoutes() {
        const express = require("express");
        const app = express();
        const path = require("path");
        const url = require('url');
        let db = new MongoDB();
        app.use('/css', express.static(path.join(__dirname, './public/css')));

        app.set("views", path.resolve(__dirname, "templates"));
        app.set("view engine", "ejs");

        const bodyParser = require("body-parser");
        app.use(bodyParser.urlencoded({ extended: false }));

        app.listen(this.#port);
        console.log(`To access server: http://localhost:${this.#port}`);
        app.get("/", (request, response) => {
            response.render("home");
        });

        app.get("/log", (request, response) => {
            response.render("log");
        });

        app.post("/log", (request, response) => {
            response.redirect(url.format({
                pathname: "/logSubmitted",
                query: {
                    "temp": request.body.temp,
                }
            }));
        });

        app.get("/logSubmitted", async (request, response) => {
            this.#navigator.geolocation.getCurrentPosition(async (success, error) => {
                if (error) {
                    console.error(error);
                }
                else {
                    const variables = {
                        temp: parseInt(request.query.temp),
                        lat: success.latitude,
                        long: success.longitude,
                    };
                    await db.insertEntry(variables);
                    response.render("logSubmitted", variables);
                };
            });
        });

        app.get("/getLogs", (request, response) => {
            response.render("getLogs");
        });

        app.post("/getLogs", (request, response) => {
            response.redirect(url.format({
                pathname: "/showLogs",
                query: {
                    "bottomRange": request.body.bottomRange,
                    "topRange": request.body.topRange,
                }
            }));
        });

        app.get("/showLogs", async (request, response) => {
            const entries = await db.getEntries(parseInt(request.query.bottomRange), parseInt(request.query.topRange));
            let table = '<table border="1"><tr><th>Temp</th><th>Lat</th><th>Long</th></tr>'
            await entries.forEach((entry) => {
                table += `<tr><td>${entry.temp}</td><td>${entry.lat}</td><td>${entry.long}</td></tr>`
            });
            table += `</table>`;
            const variables = {
                table: table
            };

            response.render("showLogs", variables);
        });
    }

    processInput() {
        this.#rl.question('Type stop to shutdown the server: ', (input) => {
            switch(input) {
                case 'stop':
                    console.log('Shutting down the server');
                    process.exit(0);
                    break;

                default:
                    console.log(`Invalid command: ${input}`);
                    break;
            }
            this.processInput();
        })
    }
}

class MongoDB {
    #client_promise;
    #databaseAndCollection;

    constructor() {
        const path = require("path");
        require("dotenv").config({ path: path.resolve(__dirname, './.env') }) 

        const uri = process.env.MONGO_CONNECTION_STRING;

        /* Our database and collection */
        this.#databaseAndCollection = {db: process.env.MONGO_DB_NAME, collection: process.env.MONGO_COLLECTION};

        /****** DO NOT MODIFY FROM THIS POINT ONE ******/
        const { MongoClient, ServerApiVersion } = require('mongodb');
        let unconnected_client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
        this.#client_promise = unconnected_client.connect();
    }

    async closeClient() {
        const client = await this.#client_promise;
        await client.close();
    }

    async insertEntry(temp_loc) {
        const client = await this.#client_promise;
        const result = await client.db(this.#databaseAndCollection.db).collection(this.#databaseAndCollection.collection).insertOne(temp_loc);
    }

    async getEntries(bottomRange, topRange) {
        const client = await this.#client_promise;
        const filter = {temp:{$gte:bottomRange,$lte:topRange}};
        const result = await client.db(this.#databaseAndCollection.db).collection(this.#databaseAndCollection.collection).find(filter);
        return result;
    }
}
new TempLog()