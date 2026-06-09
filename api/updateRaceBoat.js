const { neon } = require("@neondatabase/serverless");
const bcrypt = require('bcryptjs');

const sql = neon(process.env.DATABASE_URL);

module.exports.default = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.status(200).end(); return; }
    if (req.method !== "POST") {
        res.writeHead(405, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Invalid method" }));
    }

    let body = "";
    req.on("data", chunk => { body += chunk.toString(); });
    req.on("end", async () => {
        try {
            const { userId, token, raceId, boatId, class: boatClass, status, finishTime, lapsCompleted, lapTimes, info } = JSON.parse(body);

            const users = await sql`SELECT * FROM users WHERE id = ${userId}`;
            if (users.length !== 1) {
                res.writeHead(200, { "Content-Type": "application/json" });
                return res.end(JSON.stringify({ message: "user not found" }));
            }
            const tokenMatch = await bcrypt.compare(token, users[0]["login_token"]);
            if (!tokenMatch) {
                res.writeHead(200, { "Content-Type": "application/json" });
                return res.end(JSON.stringify({ message: "token mismatch" }));
            }

            const lapTimesStr = JSON.stringify(lapTimes || []);
            const infoStr = JSON.stringify(info || {});
            const result = await sql`
                UPDATE race_boats
                SET class = ${boatClass || ''}, status = ${status || 'registered'},
                    finish_time = ${finishTime ?? null}, laps_completed = ${lapsCompleted || 0},
                    lap_times = ${lapTimesStr}, info = ${infoStr}
                WHERE race_id = ${raceId} AND boat_id = ${boatId}
                RETURNING *
            `;

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ message: "boat updated", row: result[0] || null }));
        } catch (err) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: err ? err.message : "Internal server error" }));
        }
    });
};
