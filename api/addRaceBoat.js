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
            // Upsert: safe to call for a brand-new boat or to resend an edited one,
            // regardless of whether the original insert has reached the server yet —
            // callers don't need to know which case they're in.
            const result = await sql`
                INSERT INTO race_boats (race_id, boat_id, class, status, finish_time, laps_completed, lap_times, info, created_at)
                VALUES (${raceId}, ${boatId}, ${boatClass || ''}, ${status || 'registered'}, ${finishTime ?? null}, ${lapsCompleted || 0}, ${lapTimesStr}, ${infoStr}, NOW())
                ON CONFLICT (race_id, boat_id) DO UPDATE SET
                    class = EXCLUDED.class,
                    status = EXCLUDED.status,
                    finish_time = EXCLUDED.finish_time,
                    laps_completed = EXCLUDED.laps_completed,
                    lap_times = EXCLUDED.lap_times,
                    info = EXCLUDED.info
                RETURNING *
            `;

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ message: "boat added", row: result[0] || null }));
        } catch (err) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: err ? err.message : "Internal server error" }));
        }
    });
};
