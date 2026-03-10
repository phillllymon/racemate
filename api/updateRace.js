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
            const { userId, token, raceId, raceName, raceInfo } = parsed;

            sql`SELECT * FROM users WHERE id = ${userId}`.then((users) => {
                if (users.length === 1) {
                    bcrypt.compare(token, users[0]["login_token"]).then((tokenMatch) => {
                        if (tokenMatch) {
                            sql`SELECT * FROM races WHERE id = ${raceId}`.then((races) => {
                                if (races.length === 1) {
                                    if (races[0]["owner"] === userId) {
                                        sql`
                                            UPDATE races
                                            SET info = ${JSON.stringify(raceInfo)}, name = ${raceName}
                                            WHERE id = ${raceId}
                                        `.then((updatedRaceInfo) => {
                                            res.writeHead(200, { "Content-Type": "application/json" });
                                            res.end(JSON.stringify({
                                                message: "race updated",
                                                race: updatedRaceInfo
                                            }));
                                        });
                                    } else {
                                        res.writeHead(200, { "Content-Type": "application/json" });
                                        res.end(JSON.stringify({ message: "wrong race owner" }));
                                    }
                                } else {
                                    res.writeHead(200, { "Content-Type": "application/json" });
                                    res.end(JSON.stringify({ message: "race not found" }));
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