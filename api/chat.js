const crypto = require("crypto");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiUrl = process.env.CLOVA_API_URL;
  const secretKey = process.env.CLOVA_SECRET_KEY;

  if (!apiUrl || !secretKey) {
    res.status(500).json({ error: "Missing CLOVA_API_URL or CLOVA_SECRET_KEY" });
    return;
  }

  try {
    const { userId, event, text } = req.body || {};
    const normalizedEvent = event === "open" ? "open" : "send";

    const requestBody = {
      version: "v2",
      userId: String(userId || `web-${Date.now()}`),
      timestamp: Date.now(),
      event: normalizedEvent,
      bubbles: [
        {
          type: "text",
          data: {
            description: normalizedEvent === "open" ? "open" : String(text || "")
          }
        }
      ]
    };

    const bodyString = JSON.stringify(requestBody);
    const signature = crypto
      .createHmac("sha256", Buffer.from(secretKey, "utf-8"))
      .update(Buffer.from(bodyString, "utf-8"))
      .digest("base64");

    const clovaRes = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json;UTF-8",
        "X-NCP-CHATBOT_SIGNATURE": signature
      },
      body: bodyString
    });

    const rawText = await clovaRes.text();
    let data;
    try {
      data = JSON.parse(rawText);
    } catch (_err) {
      data = { message: rawText };
    }

    if (!clovaRes.ok) {
      res.status(clovaRes.status).json({
        error: "CLOVA API request failed",
        detail: data
      });
      return;
    }

    res.status(200).json({ answers: extractAnswers(data) });
  } catch (err) {
    res.status(500).json({ error: "Internal server error", detail: String(err.message || err) });
  }
};

function extractAnswers(response) {
  const bubbles = Array.isArray(response && response.bubbles) ? response.bubbles : [];
  const answers = [];

  for (const bubble of bubbles) {
    const type = bubble && bubble.type;
    const data = (bubble && bubble.data) || {};

    if (type === "text" && typeof data.description === "string" && data.description.trim()) {
      answers.push(data.description.trim());
      continue;
    }

    if (typeof data.description === "string" && data.description.trim()) {
      answers.push(data.description.trim());
    }
  }

  return answers;
}
