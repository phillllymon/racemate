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
            const { userId, token, raceId, boatId, observedTime, observationInfo } = parsed;

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

            const infoStr = JSON.stringify(observationInfo || {});
            const result = await sql`
                INSERT INTO finish_observations (race_id, user_id, boat_id, observed_time, info)
                VALUES (${raceId}, ${userId}, ${boatId}, ${observedTime}, ${infoStr})
                RETURNING *
            `;

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
                message: "observation added",
                observation: result
            }));

        } catch (err) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: err ? err.message : "Internal server error" }));
        }
    });
};
