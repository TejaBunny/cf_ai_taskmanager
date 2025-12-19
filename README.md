# 🎙️ VoiceTasker

An AI-powered task scheduler with voice input, built on Cloudflare's serverless platform.

## 🚀 Live Demo

[https://cf-ai-voicetasker.tejareddypapadasu.workers.dev/]

## ✨ Features

- 🎤 **Voice Input**: Hold the microphone button to speak your tasks naturally
- 🧠 **Natural Language Understanding**: Powered by Llama 3.1 70B to parse commands like "Remind me to call mom tomorrow at 5pm"
- 📋 **Task Management**: Create, list, complete, and delete tasks
- ⚡ **Real-time Responses**: WebSocket-based streaming for instant feedback
- 🌐 **Serverless**: Runs entirely on Cloudflare's global edge network - no servers to manage
- 🆓 **Free Tier**: Works within Cloudflare's generous free tier limits

## 🏗️ Architecture

| Component | Technology |
|-----------|------------|
| **LLM** | Llama 3.1 70B Instruct via Workers AI |
| **Speech-to-Text** | Whisper Large v3 Turbo via Workers AI |
| **Agent Framework** | Cloudflare Agents SDK |
| **State Management** | Durable Objects |
| **Frontend** | React + Tailwind CSS |
| **Build Tool** | Vite with Cloudflare plugin |

## 🔄 How It Works

```
┌─────────────────────────────────────────────────────────────┐
│  User speaks: "Remind me to call mom tomorrow at 5pm"       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Whisper (Workers AI) → Transcribes audio to text           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Llama 3.1 70B → Understands intent, generates response     │
│  with JSON action block                                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Action Parser → Extracts and executes task operation       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Response: "I'll set that reminder for you! ✅"             │
│  Task: "Call mom" scheduled for Dec 19, 2025 at 5:00 PM     │
└─────────────────────────────────────────────────────────────┘
```

## 📁 Project Structure

```
cf_ai_taskmanager/
├── src/
│   ├── app.tsx          # React frontend with chat UI + voice recorder
│   ├── server.ts        # Agent logic, LLM integration, action parsing
│   ├── tools.ts         # Tool definitions (legacy, kept for compatibility)
│   ├── utils.ts         # Helper functions
│   └── components/      # UI components (from starter template)
├── wrangler.jsonc       # Cloudflare Workers configuration
├── package.json         # Dependencies
├── README.md            # This file
├── PROMPTS.md           # AI prompts documentation
└── vite.config.ts       # Build configuration
```

## 🛠️ Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier works!)

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/TejaBunny/cf_ai_taskmanager.git
cd cf_ai_taskmanager
npm install
```

### 2. Login to Cloudflare

```bash
npx wrangler login
```

### 3. Run Locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### 4. Deploy to Production

```bash
npm run deploy
```

Your app will be live at the URL shown in the terminal.

## 💬 Usage Examples

### Voice Commands (hold microphone button)

- "Remind me to submit my assignment tomorrow at 5pm"
- "Schedule a meeting for next Monday at 2pm"
- "Add a task to buy groceries this evening"

### Text Commands

- "Show me my tasks" - List all tasks
- "Delete the grocery task" - Remove a specific task
- "Mark the meeting as complete" - Complete a task
- "What tasks do I have pending?" - Filter by status

## ☁️ Cloudflare Services Used

| Service | Purpose |
|---------|---------|
| **Workers AI** | LLM inference (Llama 3.1) and speech recognition (Whisper) |
| **Durable Objects** | Stateful agent with WebSocket support |
| **Workers** | Serverless compute for API endpoints |
| **Assets** | Serve static frontend files |

## 📊 Free Tier Limits

| Resource | Free Limit |
|----------|------------|
| Worker Requests | 100,000/day |
| Workers AI (Neurons) | 10,000/day |
| Durable Objects Requests | 1,000,000/month |
| Durable Objects Storage | 1 GB |

## 🔧 Development

### Generate TypeScript Types

```bash
npm run types
```

### Format Code

```bash
npm run format
```

### Run Linter

```bash
npm run check
```

## ⚠️ Known Limitations

- Voice recording requires microphone permission
- Maximum audio length ~30 seconds per recording
- Tasks stored in-memory (reset on Durable Object hibernation)
- Workers AI models may have occasional latency spikes

## 🗺️ Future Improvements

- [ ] Persistent SQLite storage for tasks
- [ ] Browser push notifications when tasks are due
- [ ] Recurring task support (daily, weekly)
- [ ] Multiple user support with authentication
- [ ] Calendar integration

## 📄 License

MIT

## 🙏 Acknowledgments

Built with:
- [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/)
- [Cloudflare Agents SDK](https://developers.cloudflare.com/agents/)
- [Vercel AI SDK](https://sdk.vercel.ai/)
- [React](https://react.dev/)
- [Tailwind CSS](https://tailwindcss.com/)