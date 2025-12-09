require("dotenv").config();


    

const http = require("http");
const fs = require("fs");
const path = require("path");


// Import API route handlers
const helloHandler = require("./api/hello.js").default;
const userHandler = require("./api/users.js").default;
const signUpHandler = require("./api/auth/signUp.js").default;

const server = http.createServer((req, res) => {
    if (req.url.startsWith("/api/")) {
        if (req.url === "/api/hello.js") return helloHandler(req, res);
        if (req.url === "/api/users") return userHandler(req, res);
        if (req.url === "/api/auth/signUp") return signUpHandler(req, res);

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