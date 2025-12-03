const crypto = require("crypto");

export default async function handler(req, res) {
    // FOR LOCAL TESTING ONLY IN DEV - DELETE FOR PROD!!!!
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    if (req.method === "POST") {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: "Email and password required" });
        }

        const hashedPassword = crypto.createHath("sha256").update(password).digest("hex");

        const query = `
            INSERT INTO neon_auth.users_sync (email, hashed_password)
            VALUES ($1, $2)
            RETURNING id, email, created_at;
        `;

        try {
            const response = await fetch(process.env.NEON_DATA_API_ENDPOINT, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${process.env.NEON_DATA_API_KEY}`
                },
                body: JSON.stringify({
                    query,
                    params: [email, hashedPassword]
                })
            });

            const result = await response.json();
            return res.status(200).json(result);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    res.status(405).json({ error: "Method not allowed" });
}