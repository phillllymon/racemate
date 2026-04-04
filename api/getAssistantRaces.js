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

    req.on("end", async () => {
        try {
            const parsed = JSON.parse(body);
            const { userId, token } = parsed;

            const users = await sql`SELECT * FROM users WHERE id = ${userId}`;
            if (users.length !== 1) {
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ message: "user not found" }));
                return;
            }

            const tokenMatch = await bcrypt.compare(token, users[0]["login_token"]);
            if (!tokenMatch) {
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ message: "token mismatch" }));
                return;
            }

            // Find all races, then filter in JS for ones where user is an assistant
            const allRaces = await sql`SELECT * FROM races`;
            const assistantRaces = allRaces.filter(r => {
                try {
                    const info = typeof r.info === 'string' ? JSON.parse(r.info) : r.info;
                    return Array.isArray(info.assistants) && info.assistants.includes(userId);
                } catch {
                    return false;
                }
            });

            // Find series containing these races
            const raceIds = assistantRaces.map(r => r.id);
            let relevantSeries = [];
            if (raceIds.length > 0) {
                const allSeries = await sql`SELECT * FROM series`;
                relevantSeries = allSeries.filter(s => {
                    try {
                        const info = typeof s.info === 'string' ? JSON.parse(s.info) : s.info;
                        return Array.isArray(info.raceIds) && info.raceIds.some(id => raceIds.includes(id));
                    } catch {
                        return false;
                    }
                });
            }

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
                message: "search concluded",
                races: assistantRaces,
                series: relevantSeries
            }));

        } catch (err) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: err ? err.message : "Internal server error" }));
        }
    });
};
