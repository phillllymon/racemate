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
            const { userId, token } = parsed;

            sql`SELECT * FROM users WHERE id = ${userId}`.then((users) => {
                if (users.length === 1) {
                    bcrypt.compare(token, users[0]["login_token"]).then((tokenMatch) => {
                        if (tokenMatch) {
                            // Find races where the user appears in the info.assistants JSON array
                            sql`
                                SELECT * FROM races
                                WHERE info::jsonb -> 'assistants' @> ${JSON.stringify([userId])}::jsonb
                            `.then((races) => {
                                // Also find the series that contain these races
                                const raceIds = races.map(r => r.id);
                                if (raceIds.length === 0) {
                                    res.writeHead(200, { "Content-Type": "application/json" });
                                    res.end(JSON.stringify({
                                        message: "search concluded",
                                        races: [],
                                        series: []
                                    }));
                                    return;
                                }
                                // Get all series and filter to ones containing these race IDs
                                sql`SELECT * FROM series`.then((allSeries) => {
                                    const relevantSeries = allSeries.filter(s => {
                                        try {
                                            const info = typeof s.info === 'string' ? JSON.parse(s.info) : s.info;
                                            return info.raceIds && info.raceIds.some(id => raceIds.includes(id));
                                        } catch {
                                            return false;
                                        }
                                    });
                                    res.writeHead(200, { "Content-Type": "application/json" });
                                    res.end(JSON.stringify({
                                        message: "search concluded",
                                        races: races,
                                        series: relevantSeries
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
