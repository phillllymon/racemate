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
const getBoatsByColumnHandler = require("./api/getBoatsByColumn.js").default;
const getRacesByPropertiesHandler = require("./api/getRacesByProperties.js").default;
const getRacesByColumnHandler = require("./api/getRacesByColumn.js").default;
const getSeriesByPropertiesHandler = require("./api/getSeriesByProperties.js").default;
const getSeriesByColumnHandler = require("./api/getSeriesByColumn.js").default;
const deleteBoatHandler = require("./api/deleteBoat.js").default;
const deleteRaceHandler = require("./api/deleteRace.js").default;
const deleteSeriesHandler = require("./api/deleteSeries.js").default;

const createClubHandler = require("./api/createClub.js").default;
const getAllClubsHandler = require("./api/getAllClubs.js").default;
const getClubMembersHandler = require("./api/getClubMembers.js").default;
const getMyClubsHandler = require("./api/getMyClubs.js").default;
const joinClubHandler = require("./api/joinClub.js").default;
const leaveClubHandler = require("./api/leaveClub.js").default;

const getAssistantRacesHandler = require("./api/getAssistantRaces.js").default;
const addFinishObservationHandler = require("./api/addFinishObservation.js").default;
const getFinishObservationsHandler = require("./api/getFinishObservations.js").default;
const deleteFinishObservationHandler = require("./api/deleteFinishObservation.js").default;

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
        if (req.url === "/api/getBoatsByColumn") return getBoatsByColumnHandler(req, res);
        if (req.url === "/api/getRacesByProperties") return getRacesByPropertiesHandler(req, res);
        if (req.url === "/api/getRacesByColumn") return getRacesByColumnHandler(req, res);
        if (req.url === "/api/getSeriesByProperties") return getSeriesByPropertiesHandler(req, res);
        if (req.url === "/api/getSeriesByColumn") return getSeriesByColumnHandler(req, res);
        if (req.url === "/api/deleteBoat") return deleteBoatHandler(req, res);
        if (req.url === "/api/deleteRace") return deleteRaceHandler(req, res);
        if (req.url === "/api/deleteSeries") return deleteSeriesHandler(req, res);
        if (req.url === "/api/createClub") return createClubHandler(req, res);
        if (req.url === "/api/getAllClubs") return getAllClubsHandler(req, res);
        if (req.url === "/api/getClubMembers") return getClubMembersHandler(req, res);
        if (req.url === "/api/getMyClubs") return getMyClubsHandler(req, res);
        if (req.url === "/api/joinClub") return joinClubHandler(req, res);
        if (req.url === "/api/leaveClub") return leaveClubHandler(req, res);
        if (req.url === "/api/getAssistantRaces") return getAssistantRacesHandler(req, res);
        if (req.url === "/api/addFinishObservation") return addFinishObservationHandler(req, res);
        if (req.url === "/api/getFinishObservations") return getFinishObservationsHandler(req, res);
        if (req.url === "/api/deleteFinishObservation") return deleteFinishObservationHandler(req, res);

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