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
            const { userId, token, boatId, boatName, boatInfo } = parsed;

            sql`SELECT * FROM users WHERE id = ${userId}`.then((users) => {
                if (users.length === 1) {
                    bcrypt.compare(token, users[0]["login_token"]).then((tokenMatch) => {
                        if (tokenMatch) {
                            sql`SELECT * FROM boats WHERE id = ${boatId}`.then((boats) => {
                                if (boats.length === 1) {
                                    if (boats[0]["owner"] === userId) {
                                        sql`
                                            UPDATE boats
                                            SET info = ${JSON.stringify(boatInfo)}, name = ${boatName}
                                            WHERE id = ${boatId}
                                            RETURNING *
                                        `.then((updatedBoatInfo) => {
                                            res.writeHead(200, { "Content-Type": "application/json" });
                                            res.end(JSON.stringify({
                                                message: "boat updated",
                                                boat: updatedBoatInfo
                                            }));
                                        });
                                    } else {
                                        res.writeHead(200, { "Content-Type": "application/json" });
                                        res.end(JSON.stringify({ message: "wrong boat owner" }));
                                    }
                                } else {
                                    res.writeHead(200, { "Content-Type": "application/json" });
                                    res.end(JSON.stringify({ message: "boat not found" }));
                                }
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