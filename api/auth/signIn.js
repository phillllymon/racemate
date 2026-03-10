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
            const { email, password } = parsed;

            sql`SELECT * FROM users WHERE email = ${email}`.then((users) => {
                if (users.length > 0) {
                    bcrypt.compare(password, users[0]["password_hash"]).then((passwordMatch) => {
                        if (passwordMatch) {
                            const token = generateToken(20);
                            bcrypt.hash(token, saltRounds).then((tokenHash) => {
                                const returnObj = {
                                    message: "signed in",
                                    token: token,
                                    user: {
                                        id: users[0]["id"],
                                        name: users[0]["name"],
                                        email: users[0]["email"]
                                    }
                                };
                                sql`
                                    UPDATE users
                                    SET login_token = ${tokenHash}
                                    WHERE id = ${users[0]["id"]}
                                `.then(() => {
                                    res.writeHead(200, { "Content-Type": "application/json" });
                                    res.end(JSON.stringify(returnObj));
                                });
                            });
                        } else {
                            res.writeHead(200, { "Content-Type": "application/json" });
                            res.end(JSON.stringify({ message: "wrong password" }));
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