# AI Prompts Documentation

This document contains all AI prompts and model configurations used in VoiceTasker.

## Models Used

### 1. Llama 3.1 70B Instruct (Text Generation)
- **Model ID**: `@cf/meta/llama-3.1-70b-instruct`
- **Provider**: Cloudflare Workers AI
- **Purpose**: Natural language understanding, task parsing, conversation

### 2. Whisper Large v3 Turbo (Speech-to-Text)
- **Model ID**: `@cf/openai/whisper-large-v3-turbo`
- **Provider**: Cloudflare Workers AI
- **Purpose**: Transcribe voice recordings to text

---

## System Prompt

**Location**: `src/server.ts` - `getSystemPrompt()` function

**Purpose**: Instructs Llama 3.1 to act as a task scheduling assistant that responds with natural language AND a JSON action block.

```
You are VoiceTasker, a helpful task scheduling assistant.

CURRENT DATE/TIME: ${getCurrentDateString()}

You help users manage tasks. Based on user input, respond naturally AND include a JSON action block when needed.

ACTIONS YOU CAN PERFORM:
1. ADD_TASK - When user wants to create/schedule/remind something
2. LIST_TASKS - When user wants to see their tasks
3. DELETE_TASK - When user wants to remove a task
4. COMPLETE_TASK - When user marks a task as done
5. NONE - Just conversation, no action needed

RESPONSE FORMAT:
Always respond conversationally first, then add the action block at the END of your response like this:

```action
{"action": "ADD_TASK", "title": "Task title", "scheduledAt": "2025-12-19T17:00:00", "description": "optional"}
```

EXAMPLES:

User: "Remind me to call mom tomorrow at 5pm"
Response: I'll set that reminder for you! ✅

```action
{"action": "ADD_TASK", "title": "Call mom", "scheduledAt": "2025-12-19T17:00:00"}
```

User: "Show my tasks"
Response: Here are your tasks:

```action
{"action": "LIST_TASKS"}
```

User: "Delete the call mom task"
Response: I'll remove that task for you.

```action
{"action": "DELETE_TASK", "taskIdentifier": "call mom"}
```

User: "Hello!"
Response: Hi! I'm VoiceTasker, your task scheduling assistant. How can I help you today?

```action
{"action": "NONE"}
```

IMPORTANT:
- ALWAYS include the action block at the end
- For ADD_TASK, convert relative times to ISO format (YYYY-MM-DDTHH:MM:SS)
- Use the current date/time provided to calculate future dates
- "tomorrow" = next day, "next Monday" = upcoming Monday, etc.
- Default times: "morning" = 09:00, "afternoon" = 14:00, "evening" = 18:00, "night" = 21:00
```

---

## Design Decisions

### Why JSON Action Blocks Instead of Tool Calling?

We initially attempted to use the AI SDK's tool calling feature with Workers AI, but encountered issues:
- The `workers-ai-provider` package didn't reliably pass tool arguments
- Tool calls were detected but parameters were empty `{}`
- This is a known limitation with some Workers AI models

**Solution**: We switched to a JSON-based approach where:
1. The LLM includes a structured `action` block in its response
2. We parse this JSON on the server
3. We execute the corresponding action

This approach is:
- More reliable with Workers AI models
- Easier to debug (you can see the JSON in responses)
- Still provides structured data extraction

### Dynamic Date/Time Injection

The current date/time is injected into every prompt so the LLM can correctly calculate:
- "tomorrow at 5pm" → actual date
- "next Monday" → correct Monday
- "in 2 hours" → relative time from now

```typescript
function getCurrentDateString(): string {
  const now = new Date();
  return now.toLocaleString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short"
  });
}
```

### Default Time Assumptions

To handle ambiguous times, we instruct the LLM:
- "morning" = 09:00
- "afternoon" = 14:00
- "evening" = 18:00
- "night" = 21:00

---

## Action Schema

### ADD_TASK
```json
{
  "action": "ADD_TASK",
  "title": "string (required)",
  "scheduledAt": "ISO 8601 datetime (required)",
  "description": "string (optional)"
}
```

### LIST_TASKS
```json
{
  "action": "LIST_TASKS",
  "status": "all | pending | completed (optional, defaults to all)"
}
```

### DELETE_TASK
```json
{
  "action": "DELETE_TASK",
  "taskIdentifier": "string - title or partial match (required)"
}
```

### COMPLETE_TASK
```json
{
  "action": "COMPLETE_TASK",
  "taskIdentifier": "string - title or partial match (required)"
}
```

### NONE
```json
{
  "action": "NONE"
}
```

---

## Speech-to-Text Configuration

**Location**: `src/server.ts` (fetch handler, `/api/transcribe` endpoint)

```typescript
const result = await env.AI.run("@cf/openai/whisper-large-v3-turbo", {
  audio: base64Audio
});
```

**Configuration**:
- Audio converted to base64 string
- No language specification (Whisper auto-detects)
- Returns `{ text: string }` with transcription

---

## Action Parsing

**Location**: `src/server.ts` - `parseAction()` function

```typescript
function parseAction(text: string): { action: string; [key: string]: any } | null {
  const actionMatch = text.match(/```action\s*([\s\S]*?)\s*```/);
  if (actionMatch) {
    try {
      return JSON.parse(actionMatch[1].trim());
    } catch (e) {
      console.error("Failed to parse action:", e);
    }
  }
  return null;
}
```

The regex ```` ```action\s*([\s\S]*?)\s*``` ```` captures JSON between the action code block markers.

---

## Frontend Cleanup

**Location**: `src/app.tsx` - `cleanActionBlocks()` function

To hide the JSON action blocks from users:

```typescript
const cleanActionBlocks = (text: string): string => {
  return text.replace(/```action\s*[\s\S]*?```/g, "").trim();
};
```

---

## Testing Prompts

Use these to test the application:

**Task Creation**:
- "Remind me to call mom tomorrow at 5pm"
- "Schedule a meeting for next Monday at 2pm"
- "Add a task: buy groceries this evening"
- "I need to submit my assignment by Friday"

**Task Listing**:
- "Show me my tasks"
- "What's on my schedule?"
- "List pending tasks"
- "Show completed tasks"

**Task Management**:
- "Delete the grocery task"
- "Mark the call as complete"
- "Remove the meeting"
- "Complete my homework task"

**Conversation**:
- "Hello!"
- "What can you do?"
- "Thanks for your help!"

---