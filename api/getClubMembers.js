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
                            // Step 1: get club members
                            sql`SELECT * FROM club_members WHERE club_id = ${clubId}`.then((members) => {
                                if (members.length === 0) {
                                    res.writeHead(200, { "Content-Type": "application/json" });
                                    res.end(JSON.stringify({
                                        message: "members retrieved",
                                        members: []
                                    }));
                                    return;
                                }

                                // Step 2: get user info for each member
                                const memberUserIds = members.map(m => m.user_id);
                                sql`SELECT id, name, email FROM users WHERE id = ANY(${memberUserIds})`.then((memberUsers) => {
                                    const enriched = members.map(m => {
                                        const u = memberUsers.find(u => u.id === m.user_id);
                                        return {
                                            id: m.id,
                                            club_id: m.club_id,
                                            user_id: m.user_id,
                                            role: m.role,
                                            info: m.info,
                                            user_name: u ? u.name : null,
                                            user_email: u ? u.email : null
                                        };
                                    });
                                    res.writeHead(200, { "Content-Type": "application/json" });
                                    res.end(JSON.stringify({
                                        message: "members retrieved",
                                        members: enriched
                                    }));
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
