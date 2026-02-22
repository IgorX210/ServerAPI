// RoBotAI Proxy Server
// Free AI chat proxy for Roblox games via HttpService
// Uses pollinations.ai
// MIT License

const http = require("http")
const https = require("https")

const PORT = process.env.PORT || 3000

const BANNED_WORDS = [
    "shit", "fuck", "ass", "bitch", "damn", "hell", "crap",
    "bastard", "dick", "piss", "cunt", "fag", "slut", "whore"
]

function filterResponse(text) {
    let clean = text
    for (const word of BANNED_WORDS) {
        const regex = new RegExp(`\\b${word}\\b`, "gi")
        clean = clean.replace(regex, "*".repeat(word.length))
    }
    return clean
}

function askAI(userMessage, callback) {
    const systemPrompt =
        "You are a friendly AI assistant inside a Roblox game. " +
        "Keep responses short (1-3 sentences), fun, and suitable for all ages. " +
        "Never swear or say anything inappropriate. Be helpful and positive."

    const fullPrompt = encodeURIComponent(systemPrompt + "\n\nUser: " + userMessage + "\nAssistant:")

    const options = {
        hostname: "text.pollinations.ai",
        path: "/" + fullPrompt,
        method: "GET",
        headers: {
            "User-Agent": "RoboChat/1.0"
        }
    }

    let raw = ""

    const req = https.request(options, (res) => {
        res.setEncoding("utf8")
        res.on("data", (chunk) => { raw += chunk })
        res.on("end", () => {
            const reply = raw.trim()
            if (!reply || reply.length === 0) {
                callback("Empty response from AI")
                return
            }
            callback(null, filterResponse(reply))
        })
    })

    req.on("error", (err) => callback("Request failed: " + err.message))

    req.setTimeout(15000, () => {
        req.destroy()
        callback("Request timed out")
    })

    req.end()
}

const server = http.createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*")
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
    res.setHeader("Access-Control-Allow-Headers", "Content-Type")

    if (req.method === "OPTIONS") {
        res.writeHead(204)
        res.end()
        return
    }

    // Health check
    if (req.method === "GET" && req.url === "/") {
        res.writeHead(200, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ status: "online", message: "RoboChat proxy is running!" }))
        return
    }

    // Main chat endpoint
    if (req.method === "POST" && req.url === "/chat") {
        let body = ""
        req.on("data", (chunk) => { body += chunk })
        req.on("end", () => {
            let parsed
            try {
                parsed = JSON.parse(body)
            } catch {
                res.writeHead(400, { "Content-Type": "application/json" })
                res.end(JSON.stringify({ error: "Invalid JSON body" }))
                return
            }

            const userMessage = parsed?.message?.toString().slice(0, 300)

            if (!userMessage || userMessage.trim().length === 0) {
                res.writeHead(400, { "Content-Type": "application/json" })
                res.end(JSON.stringify({ error: "No message provided" }))
                return
            }

            console.log(`[Chat] User: ${userMessage}`)

            askAI(userMessage, (err, reply) => {
                if (err) {
                    console.error("[Error]", err)
                    res.writeHead(500, { "Content-Type": "application/json" })
                    res.end(JSON.stringify({ error: "AI request failed", details: err }))
                    return
                }

                console.log(`[Chat] AI: ${reply}`)
                res.writeHead(200, { "Content-Type": "application/json" })
                res.end(JSON.stringify({ reply }))
            })
        })
        return
    }

    res.writeHead(404, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "Route not found" }))
})

server.listen(PORT, () => {
    console.log(`RoboChat proxy running on port ${PORT}`)
})
