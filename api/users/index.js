const crypto = require("crypto");

export default async function handler(req, res) {
    // Basic CORS for dev
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  
    if (req.method === "OPTIONS") return res.status(200).end();
  
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }
  
    try {
      // Read body robustly in case req.body is undefined in this runtime
      let body;
      if (req.body && Object.keys(req.body).length) {
        body = req.body;
      } else {
        // fallback: stream the body
        let raw = "";
        for await (const chunk of req) raw += chunk;
        body = raw ? JSON.parse(raw) : {};
      }
  
      const { email, password } = body || {};
  
      if (!email || !password) {
        return res.status(400).json({ error: "email and password required" });
      }
  
      // Simple, deterministic hash for now (replace with stronger algo in prod)
      const hashedPassword = crypto.createHash("sha256").update(password).digest("hex");
  
      // SQL using parameter placeholders with Data API "sql" + "params"
      const sql = `
        INSERT INTO neon_auth.users_sync (email, hashed_password)
        VALUES ($1, $2)
        RETURNING id, email, created_at;
      `;
  
      // Basic sanity checks for env vars
      if (!process.env.NEON_DATA_API_ENDPOINT || !process.env.NEON_DATA_API_KEY) {
        console.error("Missing NEON env vars", {
          hasEndpoint: Boolean(process.env.NEON_DATA_API_ENDPOINT),
          hasKey: Boolean(process.env.NEON_DATA_API_KEY)
        });
        return res.status(500).json({ error: "Server configuration error: missing NEON env vars" });
      }
  
      // Call Neon Data API
      const neonRes = await fetch(process.env.NEON_DATA_API_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.NEON_DATA_API_KEY}`,
        },
        body: JSON.stringify({
          sql,
          params: [email, hashedPassword]
        })
      });
  
      // Grab the body as text and log it for debugging if it's not ok
      const neonText = await neonRes.text();
  
      if (!neonRes.ok) {
        console.error("Neon returned non-OK", {
          status: neonRes.status,
          body: neonText
        });
        // return neon error body as text to help debug (safe because it shouldn't contain your API key)
        return res.status(502).json({ error: "Neon returned error", status: neonRes.status, body: neonText });
      }
  
      // Parse successful response (Data API typically returns JSON)
      let payload;
      try {
        payload = JSON.parse(neonText);
      } catch (e) {
        // If neon didn't return JSON, include the text
        payload = { raw: neonText };
      }
  
      // return the inserted row(s)
      const rows = payload.results?.[0]?.rows ?? payload.rows ?? payload;
      console.log("Insert success, rows count:", Array.isArray(rows) ? rows.length : "unknown");
      return res.status(200).json({ rows });
  
    } catch (err) {
      console.error("Unhandled error in /api/users:", err && err.stack ? err.stack : String(err));
      return res.status(500).json({ error: "Unhandled server error", details: String(err?.message || err) });
    }
  }

// export default async function handler(req, res) {
//     // FOR LOCAL TESTING ONLY IN DEV - DELETE FOR PROD!!!!
//     res.setHeader("Access-Control-Allow-Origin", "*");
//     res.setHeader("Access-Control-Allow-Methods", "POST, DELETE, OPTIONS");
//     res.setHeader("Access-Control-Allow-Headers", "Content-Type");

//     if (req.method === "OPTIONS") {
//         return res.status(200).end();
//     }

//     if (req.method === "POST") {
//         const { email, password } = req.body;

//         if (!email || !password) {
//             return res.status(400).json({ error: "Email and password required" });
//         }

//         const hashedPassword = crypto.createHath("sha256").update(password).digest("hex");

//         const query = `
//             INSERT INTO neon_auth.users_sync (email, hashed_password)
//             VALUES ($1, $2)
//             RETURNING id, email, created_at;
//         `;

//         try {
//             const response = await fetch(process.env.NEON_DATA_API_ENDPOINT, {
//                 method: "POST",
//                 headers: {
//                     "Content-Type": "application/json",
//                     Authorization: `Bearer ${process.env.NEON_DATA_API_KEY}`
//                 },
//                 body: JSON.stringify({
//                     query,
//                     params: [email, hashedPassword]
//                 })
//             });

//             const result = await response.json();
//             return res.status(200).json(result);
//         } catch (err) {
//             return res.status(500).json({ error: err.message });
//         }
//     }

//     res.status(405).json({ error: "Method not allowed" });
// }