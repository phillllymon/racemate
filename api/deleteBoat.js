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
            const { userId, token, boatId } = parsed;

            sql`SELECT * FROM users WHERE id = ${userId}`.then((users) => {
                if (users.length === 1) {
                    bcrypt.compare(token, users[0]["login_token"]).then((tokenMatch) => {
                        if (tokenMatch) {
                            sql`
                                SELECT * FROM boats
                                WHERE id = ${boatId} AND owner = ${userId}
                            `.then((existingBoatInfo) => {
                                if (existingBoatInfo.length === 1) {
                                    sql`
                                        DELETE FROM boats
                                        WHERE id = ${boatId} AND owner = ${userId}
                                    `.then(() => {
                                        res.writeHead(200, { "Content-Type": "application/json" });
                                        res.end(JSON.stringify({
                                            message: "boat deleted"
                                        }));
                                    });
                                } else {
                                    res.writeHead(200, { "Content-Type": "application/json" });
                                    res.end(JSON.stringify({ message: "boat not found or user not owner" }));
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