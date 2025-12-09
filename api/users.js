const { neon } = require("@neondatabase/serverless");

const sql = neon(process.env.DATABASE_URL);

module.exports.default = async function handler(req, res) {
  if (req.method !== "GET") {
    res.writeHead(405, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "Method not allowed" }));
  }

  try {
    const users = await sql`
      SELECT id, name, email, created_at
      FROM users
      ORDER BY id ASC
    `;

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(users));
  } catch (err) {
    console.error("Database query failed:", err);

    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error: err?.message || "Internal server error",
      })
    );
  }
};