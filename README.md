# VOICECRAFT — AI Video Voice Enhancer

Transform your raw video voice into a smooth AI-powered voiceover with auto-generated captions.

**Stack:** Next.js · Claude API · ElevenLabs

---

## Deploy to Vercel (5 minutes)

### Step 1 — Push to GitHub
1. Create a new repo on github.com
2. Upload all these files to it (drag & drop works)

### Step 2 — Deploy on Vercel
1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click **"Add New Project"**
3. Import your GitHub repo
4. Click **Deploy** (no build settings needed — Vercel auto-detects Next.js)

### Step 3 — Add your API Keys
1. In Vercel, go to your project → **Settings → Environment Variables**
2. Add these two variables:

| Name | Value |
|------|-------|
| `ANTHROPIC_API_KEY` | Your Claude API key from console.anthropic.com |
| `ELEVENLABS_API_KEY` | Your ElevenLabs key from elevenlabs.io → Profile → API Key |

3. Click **Save** then go to **Deployments → Redeploy** (so the keys take effect)

### Done! 🎉
Your app is live at `https://your-project.vercel.app`

---

## How to use

1. Upload your raw video
2. Paste your raw transcript (what you said, mistakes and all)
3. Choose output language (optional — translate automatically)
4. Claude cleans the script
5. Pick a voice from your ElevenLabs account
6. Download: cleaned script (.txt), AI audio (.mp3), captions (.srt)
7. Import into CapCut / DaVinci / Premiere to replace your original voice

---

## Local development

```bash
npm install
cp .env.example .env.local
# Edit .env.local and add your keys
npm run dev
# Open http://localhost:3000
```
