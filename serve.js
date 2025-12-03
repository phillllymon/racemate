const http = require("http");
const fs = require("fs");

// import http from "http";
// import fs from "fs";

const server = http.createServer((req, res) => {
    const file = req.url === "/" ? "/index.html" : req.url;
    fs.readFile("." + file, (err, data) => {
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