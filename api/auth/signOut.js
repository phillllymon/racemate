const { neon } = require("@neondatabase/serverless");
const bcrypt = require('bcryptjs');
const saltRounds = 10;

const sql = neon(process.env.DATABASE_URL);

module.exports.default = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*')  // or 'http://localhost:5173'
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    if (req.method === 'OPTIONS') {
        res.status(200).end()
        return
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
                if (users.length > 0) {
                    bcrypt.compare(token, users[0]["login_token"]).then((tokenMatch) => {
                        if (tokenMatch) {
                            sql`
                                UPDATE users
                                SET login_token = ${null}
                                WHERE id = ${users[0]["id"]}
                            `.then(() => {
                                res.writeHead(200, { "Content-Type": "application/json" });
                                res.end(JSON.stringify({ message: "signed out" }));
                            });
                        } else {
                            res.writeHead(200, { "Content-Type": "application/json" });
                            res.end(JSON.stringify({ message: "token mismatch" }));
                        }
                    });
                } else {
                    res.writeHead(200, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ message: "email not found" }));
                }
            });

        } catch (err) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ errror: err ? err.message : "Internal server error" }));
        }
    });
};

function generateToken(n) {
    const chars = [
        "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n",
        "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z"
    ];
    let token = "";
    while (token.length < n) {
        token += chars[Math.floor(chars.length * Math.random())];
    }
    return token;
}