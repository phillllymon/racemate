const { neon } = require("@neondatabase/serverless");
const bcrypt = require('bcryptjs');

const sql = neon(process.env.DATABASE_URL);

module.exports.default = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*')  // or 'http://localhost:5173'
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    if (req.method === 'OPTIONS') {
        res.status(200).end()
        return
    }
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
            const { userId, token, column, targetVal } = parsed;
            

            sql`SELECT * FROM users WHERE id = ${userId}`.then((users) => {
                if (users.length === 1) {
                    bcrypt.compare(token, users[0]["login_token"]).then((tokenMatch) => {
                        if (tokenMatch) {
                            if (column === "id") {
                                sql`
                                    SELECT * FROM series
                                    WHERE id = ${targetVal}
                                `.then((series) => {
                                    res.end(JSON.stringify({
                                        message: "search concluded",
                                        results: series
                                    }));
                                });
                            } else if (column === "name") {
                                sql`
                                    SELECT * FROM series
                                    WHERE name = ${targetVal}
                                `.then((series) => {
                                    res.end(JSON.stringify({
                                        message: "search concluded",
                                        results: series
                                    }));
                                });
                            } else if (column === "owner") {
                                sql`
                                    SELECT * FROM series
                                    WHERE owner = ${targetVal}
                                `.then((series) => {
                                    res.end(JSON.stringify({
                                        message: "search concluded",
                                        results: series
                                    }));
                                });
                            } else {
                                res.writeHead(200, { "Content-Type": "application/json" });
                                res.end(JSON.stringify({ message: "invalid column" }));
                            }
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