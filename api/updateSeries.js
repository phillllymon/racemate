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
            const { userId, token, seriesId, seriesName, seriesInfo } = parsed;

            sql`SELECT * FROM users WHERE id = ${userId}`.then((users) => {
                if (users.length === 1) {
                    bcrypt.compare(token, users[0]["login_token"]).then((tokenMatch) => {
                        if (tokenMatch) {
                            sql`SELECT * FROM series WHERE id = ${seriesId}`.then((series) => {
                                if (series.length === 1) {
                                    if (series[0]["owner"] === userId) {
                                        sql`
                                            UPDATE series
                                            SET info = ${JSON.stringify(seriesInfo)}, name = ${seriesName}
                                            WHERE id = ${seriesId}
                                        `.then((updatedSeriesInfo) => {
                                            res.writeHead(200, { "Content-Type": "application/json" });
                                            res.end(JSON.stringify({
                                                message: "series updated",
                                                series: updatedSeriesInfo
                                            }));
                                        });
                                    } else {
                                        res.writeHead(200, { "Content-Type": "application/json" });
                                        res.end(JSON.stringify({ message: "wrong series owner" }));
                                    }
                                } else {
                                    res.writeHead(200, { "Content-Type": "application/json" });
                                    res.end(JSON.stringify({ message: "series not found" }));
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