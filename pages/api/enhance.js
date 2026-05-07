// pages/api/enhance.js
// Cleans raw transcript using Claude API (key stored server-side)
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { rawText, targetLang } = req.body
  if (!rawText) return res.status(400).json({ error: 'rawText is required' })

  const LANGS = {
    en:'English', es:'Spanish', fr:'French', de:'German',
    hi:'Hindi', ar:'Arabic', zh:'Chinese', ja:'Japanese',
    pt:'Portuguese', ko:'Korean'
  }
  const langLabel = LANGS[targetLang] || 'English'
  const translateNote = targetLang !== 'en'
    ? `After cleaning, translate the entire script into ${langLabel}.`
    : 'Output in English.'

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: `You are a professional video script editor. Rewrite this raw spoken transcript into a clean, natural voiceover script:
- Remove all filler words (um, uh, like, basically, you know, so, right, etc.)
- Fix all grammar and sentence structure
- Keep the same meaning, tone, and personality
- Make it flow smoothly when read aloud
- Do NOT add new content — only clean what is there
${translateNote}

Raw transcript:
"""
${rawText}
"""

Return ONLY the cleaned script. No preamble, no quotes around it.`
        }]
      })
    })

    if (!response.ok) {
      const err = await response.json()
      return res.status(500).json({ error: err?.error?.message || 'Claude API error' })
    }

    const data = await response.json()
    const cleanScript = data.content?.[0]?.text?.trim() || rawText
    return res.status(200).json({ cleanScript })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
