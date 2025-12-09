const { neon } = require("@neondatabase/serverless");

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
            const { myVar } = parsed;
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ message: myVar }));
        } catch (err) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ errror: err ? err.message : "Internal server error" }));
        }
    });
};