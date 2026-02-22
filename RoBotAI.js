// RoBotAI Proxy Server
// Made for Roblox games via HttpService
// Uses Puter.js compatible endpoint — free, no key needed
// Open source — MIT License

const http = require("http")
const https = require("https")

const PORT = process.env.PORT || 3000

// Words we don't want the bot saying or this shit might get us banned 
const BANNED_WORDS = [
    "shit", "fuck", "ass", "bitch", "damn", "hell", "crap",
    "bastard", "dick", "piss", "cunt", "fag", "slut", "whore"
]

function filterResponse(text) {
    let clean = text
    for (const word of BANNED_WORDS) {
        // Replace with asterisks, case-insensitive
        const regex = new RegExp(`\\b${word}\\b`, "gi")
        clean = clean.replace(regex, "*".repeat(word.length))
    }
    return clean
}

function askAI(userMessage, callback) {
    const body = JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
            {
                role: "system",
                content:
                    "You are a friendly AI assistant inside a Roblox game. " +
                    "Keep responses short (1-3 sentences), fun, and suitable for all ages. " +
                    "Never swear, use slurs, or say anything inappropriate. " +
                    "Be helpful and positive."
            },
            {
                role: "user",
                content: userMessage
            }
        ],
        max_tokens: 150,
        temperature: 0.8
    })

    const options = {
        hostname: "api.openai.com",
        path: "/v1/chat/completions",
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.OPENAI_API_KEY || ""}`,
            "Content-Length": Buffer.byteLength(body)
        }
    }

    // If no OpenAI key, fall back to a free proxy
    const useProxy = !process.env.OPENAI_API_KEY
    if (useProxy) {
        options.hostname = "api.puter.com"
        options.path = "/v2/ai/chat"
        delete options.headers["Authorization"]
    }

    const req = https.request(options, (res) => {
        let data = ""
        res.on("data", (chunk) => { data += chunk })
        res.on("end", () => {
            try {
                const parsed = JSON.parse(data)
                let reply = ""

                if (useProxy) {
                    reply = parsed?.message?.content || "I didn't catch that, try again!"
                } else {
                    reply = parsed?.choices?.[0]?.message?.content || "I didn't catch that, try again!"
                }

                callback(null, filterResponse(reply.trim()))
            } catch (err) {
                callback("Parse error: " + err.message)
            }
        })
    })

    req.on("error", (err) => callback("Request failed: " + err.message))
    req.setTimeout(10000, () => {
        req.destroy()
        callback("Request timed out")
    })

    req.write(body)
    req.end()
}

const server = http.createServer((req, res) => {
    // CORS headers so Roblox can talk to this
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

            const userMessage = parsed?.message?.toString().slice(0, 500)

            if (!userMessage || userMessage.trim().length === 0) {
                res.writeHead(400, { "Content-Type": "application/json" })
                res.end(JSON.stringify({ error: "No message provided" }))
                return
            }

            console.log(`[Chat] User asked: ${userMessage}`)

            askAI(userMessage, (err, reply) => {
                if (err) {
                    console.error("[Error]", err)
                    res.writeHead(500, { "Content-Type": "application/json" })
                    res.end(JSON.stringify({ error: "AI request failed", details: err }))
                    return
                }

                console.log(`[Chat] AI replied: ${reply}`)
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
    console.log(`POST /chat — send { "message": "your message" }`)
})
