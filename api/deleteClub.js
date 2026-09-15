const { neon } = require("@neondatabase/serverless");
const bcrypt = require('bcryptjs');

const sql = neon(process.env.DATABASE_URL);

module.exports.default = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
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
            const { userId, token, clubId } = parsed;

            sql`SELECT * FROM users WHERE id = ${userId}`.then((users) => {
                if (users.length === 1) {
                    bcrypt.compare(token, users[0]["login_token"]).then((tokenMatch) => {
                        if (tokenMatch) {
                            // Only an admin member may delete the club
                            sql`
                                SELECT * FROM club_members
                                WHERE club_id = ${clubId} AND user_id = ${userId} AND role = 'admin'
                            `.then((admins) => {
                                if (admins.length === 0) {
                                    res.writeHead(200, { "Content-Type": "application/json" });
                                    res.end(JSON.stringify({ message: "only an admin can delete this club" }));
                                    return;
                                }
                                sql`DELETE FROM club_members WHERE club_id = ${clubId}`.then(() => {
                                    sql`DELETE FROM clubs WHERE id = ${clubId}`.then(() => {
                                        res.writeHead(200, { "Content-Type": "application/json" });
                                        res.end(JSON.stringify({ message: "club deleted" }));
                                    });
                                });
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
            res.end(JSON.stringify({ error: err ? err.message : "Internal server error" }));
        }
    });
};
