module.exports.default = function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        return res.writeHead(200).end();
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
        message: "Hello from the backend!",
        key: process.env.NEON_DATA_API_KEY,
        url: process.env.NEON_DATA_API_ENDPOINT
    }));
};