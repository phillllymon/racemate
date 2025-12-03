export default function handler(req, res) {
    // Allow all origins (safe for dev — you can restrict later)
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  
    // Respond to preflight requests immediately
    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }
  
    // Your actual response
    res.status(200).json({ message: "Hello from the backend!" });
}