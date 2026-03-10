const { neon } = require("@neondatabase/serverless");
const bcrypt = require('bcryptjs');

const sql = neon(process.env.DATABASE_URL);

module.exports.default = async function handler(req, res) {
    if (req.method !== "POST") {
        res.writeHead(405, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Invalid method" }));
    }

    let body = "";
    req.on("data", chunk => {
        body += chunk.toString();
    });

    req.on("end", () => {
        try {
            const parsed = JSON.parse(body);
            const { userId, token, properties } = parsed;
            /* 
            properties: [
                {key: "name", value: "Kari-J"},
                {key: "boatType", value: "J-24"}
            ]
            */

            sql`SELECT * FROM users WHERE id = ${userId}`.then((users) => {
                if (users.length === 1) {
                    bcrypt.compare(token, users[0]["login_token"]).then((tokenMatch) => {
                        if (tokenMatch) {
                            sql`
                                SELECT * FROM series
                            `.then((items) => {
                                const answer = [];
                                items.forEach((item) => {
                                    let itemGood = true;
                                    const infoObj = JSON.parse(item["info"]);
                                    properties.forEach((propertyPair) => {
                                        if (infoObj[propertyPair.key] || infoObj[propertyPair.key].toLowerCase() !== propertyPair.value.toLowerCase()) {
                                            itemGood = false;
                                        }
                                    });
                                    if (itemGood) {
                                        answer.push(item);
                                    }
                                });
                                res.writeHead(200, { "Content-Type": "application/json" });
                                res.end(JSON.stringify({
                                    message: "search concluded",
                                    results: answer
                                }));
                            });
                        } else {
                            res.writeHead(200, { "Content-Type": "application/json" });
                            res.end(JSON.stringify({ message: "token mismatch" }));
                        }
                    });
                } else {
                    res.writeHead(200, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ message: "user not found" }));
                }
            });

        } catch (err) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ errror: err ? err.message : "Internal server error" }));
        }
    });
};