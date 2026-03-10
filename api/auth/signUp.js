const { neon } = require("@neondatabase/serverless");
const bcrypt = require('bcryptjs');
const saltRounds = 10;

const sql = neon(process.env.DATABASE_URL);

module.exports.default = async function handler(req, res) {
    if (req.method !== "POST") {
        res.writeHead(405, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Invalid method" }));
    }
    if (req.method === 'OPTIONS') {
        res.status(200).end()
        return
    }
    res.setHeader('Access-Control-Allow-Origin', '*')  // or 'http://localhost:5173'
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    let body = "";
    req.on("data", chunk => {
        body += chunk.toString();
    });

    req.on("end", () => {
        try {
            const parsed = JSON.parse(body);
            const { username, email, password } = parsed;

            sql`SELECT * FROM users WHERE email = ${email}`.then((users) => {
                if (users.length === 0) {
                    bcrypt.hash(password, saltRounds).then((passwordHash) => {
                        sql`
                            INSERT INTO users (name, email, password_hash)
                            VALUES (${username}, ${email}, ${passwordHash})
                            RETURNING *
                        `.then((newUser) => {
                            res.writeHead(200, { "Content-Type": "application/json" });
                            res.end(JSON.stringify({
                                message: "signed up",
                                user: {
                                    id: newUser[0]["id"],
                                    name: newUser[0]["name"],
                                    email: newUser[0]["email"]
                                }
                            }));
                        });
                    });
                } else {
                    res.writeHead(200, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ message: "duplicate email" }));
                }
            });

        } catch (err) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ errror: err ? err.message : "Internal server error" }));
        }
    });
};