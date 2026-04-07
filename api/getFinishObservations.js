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
            const { userId, token, raceId } = parsed;

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

            // Step 1: get observations
            const observations = await sql`
                SELECT * FROM finish_observations
                WHERE race_id = ${raceId}
                ORDER BY observed_time ASC
            `;

            if (observations.length === 0) {
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({
                    message: "observations retrieved",
                    observations: []
                }));
                return;
            }

            // Step 2: get observer names
            const observerIds = [...new Set(observations.map(o => o.user_id))];
            const observerUsers = await sql`SELECT id, name FROM users WHERE id = ANY(${observerIds})`;

            const enriched = observations.map(o => {
                const u = observerUsers.find(u => u.id === o.user_id);
                return {
                    ...o,
                    observer_name: u ? u.name : null
                };
            });

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
                message: "observations retrieved",
                observations: enriched
            }));

        } catch (err) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: err ? err.message : "Internal server error" }));
        }
    });
};
