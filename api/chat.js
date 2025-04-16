import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.REDIS_URL,
  token: process.env.REDIS_TOKEN,
});

export default async function handler(req, res) {
  // CORS Setup
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, sessionId = crypto.randomUUID() } = req.body;

    // Validate input
    if (!message?.trim()) {
      return res.status(400).json({ error: 'Empty message' });
    }

    // Gemini API Call
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [{ text: `You are Mr. E, a Nigerian tutor. Respond to: ${message}` }]
          }]
        })
      }
    );

    const data = await geminiResponse.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "Let's continue learning!";

    // Save session
    await redis.set(
      `session:${sessionId}`,
      JSON.stringify({
        history: [...(JSON.parse(await redis.get(`session:${sessionId}`)?.history || []), 
        { user: message, ai: reply }
        ],
        lastUpdated: Date.now()
      })
    );

    return res.status(200).json({ reply, sessionId });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Mr. E is resting. Try again later!' });
  }
}