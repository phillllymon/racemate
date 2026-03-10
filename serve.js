require("dotenv").config();


    

const http = require("http");
const fs = require("fs");
const path = require("path");


// Import API route handlers
const helloHandler = require("./api/hello.js").default;
const userHandler = require("./api/users.js").default;
const signUpHandler = require("./api/auth/signUp.js").default;
const signInHandler = require("./api/auth/signIn.js").default;
const signOutHandler = require("./api/auth/signOut.js").default;

const addBoatHandler = require("./api/addBoat.js").default;
const updateBoatHandler = require("./api/updateBoat.js").default;
const addRaceHandler = require("./api/addRace.js").default;
const updateRaceHandler = require("./api/updateRace.js").default;
const addSeriesHandler = require("./api/addSeries.js").default;
const updateSeriesHandler = require("./api/updateSeries.js").default;
const getBoatsByPropertiesHandler = require("./api/getBoatsByProperties.js").default;

const server = http.createServer((req, res) => {
    if (req.url.startsWith("/api/")) {
        if (req.url === "/api/hello.js") return helloHandler(req, res);
        if (req.url === "/api/users") return userHandler(req, res);
        if (req.url === "/api/auth/signUp") return signUpHandler(req, res);
        if (req.url === "/api/auth/signIn") return signInHandler(req, res);
        if (req.url === "/api/auth/signOut") return signOutHandler(req, res);

        if (req.url === "/api/addBoat") return addBoatHandler(req, res);
        if (req.url === "/api/updateBoat") return updateBoatHandler(req, res);
        if (req.url === "/api/addRace") return addRaceHandler(req, res);
        if (req.url === "/api/updateRace") return updateRaceHandler(req, res);
        if (req.url === "/api/addSeries") return addSeriesHandler(req, res);
        if (req.url === "/api/updateSeries") return updateSeriesHandler(req, res);
        if (req.url === "/api/getBoatsByProperties") return getBoatsByPropertiesHandler(req, res);

        res.writeHead(404);
        return res.end("API route not found");
    }

    const file = req.url === "/" ? "/index.html" : req.url;
    const safePath = path.join(__dirname, file);

    fs.readFile(safePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end("Not found");
        } else {
            res.writeHead(200);
            res.end(data);
        }
    });
});

server.listen(3000, () => {
    console.log("Serving on http://localhost:3000");
});