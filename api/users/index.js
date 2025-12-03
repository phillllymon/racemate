const crypto = require("crypto");

export default async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  
    if (req.method === "OPTIONS") return res.status(200).end();
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  
    try {
        // Read request body
        let body;
        if (req.body && Object.keys(req.body).length) {
            body = req.body;
        } else {
            let raw = "";
            for await (const chunk of req) raw += chunk;
            body = raw ? JSON.parse(raw) : {};
        }
    
        const { email, password } = body;
        if (!email || !password) return res.status(400).json({ error: "email and password required" });
    
        if (!process.env.STACK_SECRET_SERVER_KEY) {
            return res.status(500).json({ error: "Server missing STACK_SECRET_SERVER_KEY" });
        }
    
        // Call Neon Auth API
        const response = await fetch("https://auth.neon.tech/v1/users", {
            method: "POST",
            headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.STACK_SECRET_SERVER_KEY}`
            },
            body: JSON.stringify({ email, password })
        });
    
        const data = await response.json();
    
        if (!response.ok) {
            return res.status(response.status).json({ error: "Neon Auth API error", details: data });
        }
  
        return res.status(200).json({ user: data });
    } catch (err) {
        console.error("Error creating user:", err);
        return res.status(500).json({ error: "Unhandled server error", details: String(err) });
    }
}