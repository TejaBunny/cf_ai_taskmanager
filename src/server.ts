
import { routeAgentRequest, type Schedule } from "agents";
import { AIChatAgent } from "agents/ai-chat-agent";
import {
  generateId,
  streamText,
  createUIMessageStream,
  convertToModelMessages,
  createUIMessageStreamResponse
} from "ai";
import { createWorkersAI } from "workers-ai-provider";

// In-memory task storage
interface Task {
  id: string;
  title: string;
  description: string;
  scheduledAt: string;
  createdAt: string;
  status: "pending" | "completed";
}

const taskStore: Map<string, Task> = new Map();

// Get current date string for the prompt
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

// Format tasks for display
function formatTasks(status: "all" | "pending" | "completed" = "all"): string {
  const allTasks = Array.from(taskStore.values());
  let filteredTasks = allTasks;

  if (status !== "all") {
    filteredTasks = allTasks.filter((t) => t.status === status);
  }

  if (filteredTasks.length === 0) {
    return status === "all"
      ? "📋 You have no tasks yet."
      : `📋 No ${status} tasks found.`;
  }

  const taskList = filteredTasks
    .map((t) => {
      const date = new Date(t.scheduledAt);
      const formattedDate = date.toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit"
      });
      const icon = t.status === "completed" ? "✅" : "📅";
      return `${icon} **${t.title}**\n   📆 ${formattedDate} | Status: ${t.status}`;
    })
    .join("\n\n");

  return `📋 **Your Tasks (${filteredTasks.length}):**\n\n${taskList}`;
}

// System prompt for VoiceTasker
const getSystemPrompt = () => `You are VoiceTasker, a helpful task scheduling assistant.

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

\`\`\`action
{"action": "ADD_TASK", "title": "Task title", "scheduledAt": "2025-12-19T17:00:00", "description": "optional"}
\`\`\`

EXAMPLES:

User: "Remind me to call mom tomorrow at 5pm"
Response: I'll set that reminder for you! ✅

\`\`\`action
{"action": "ADD_TASK", "title": "Call mom", "scheduledAt": "2025-12-19T17:00:00"}
\`\`\`

User: "Show my tasks"
Response: Here are your tasks:

\`\`\`action
{"action": "LIST_TASKS"}
\`\`\`

User: "Delete the call mom task"
Response: I'll remove that task for you.

\`\`\`action
{"action": "DELETE_TASK", "taskIdentifier": "call mom"}
\`\`\`

User: "Hello!"
Response: Hi! I'm VoiceTasker, your task scheduling assistant. How can I help you today?

\`\`\`action
{"action": "NONE"}
\`\`\`

IMPORTANT:
- ALWAYS include the action block at the end
- For ADD_TASK, convert relative times to ISO format (YYYY-MM-DDTHH:MM:SS)
- Use the current date/time provided to calculate future dates
- "tomorrow" = next day, "next Monday" = upcoming Monday, etc.
- Default times: "morning" = 09:00, "afternoon" = 14:00, "evening" = 18:00, "night" = 21:00`;

// Parse action from LLM response
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

// Execute action and return result
function executeAction(actionData: { action: string; [key: string]: any }): string {
  switch (actionData.action) {
    case "ADD_TASK": {
      const id = crypto.randomUUID();
      const task: Task = {
        id,
        title: actionData.title || "Untitled Task",
        description: actionData.description || "",
        scheduledAt: actionData.scheduledAt || new Date().toISOString(),
        createdAt: new Date().toISOString(),
        status: "pending"
      };
      taskStore.set(id, task);

      const date = new Date(task.scheduledAt);
      const formattedDate = date.toLocaleString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit"
      });
      return `\n\n✅ **Task Created:**\n- **Title:** ${task.title}\n- **Scheduled:** ${formattedDate}`;
    }

    case "LIST_TASKS": {
      const status = actionData.status || "all";
      return `\n\n${formatTasks(status)}`;
    }

    case "DELETE_TASK": {
      const identifier = (actionData.taskIdentifier || "").toLowerCase();
      for (const [id, task] of taskStore.entries()) {
        if (task.title.toLowerCase().includes(identifier)) {
          taskStore.delete(id);
          return `\n\n🗑️ Deleted task: "${task.title}"`;
        }
      }
      return `\n\n❌ Could not find a task matching "${actionData.taskIdentifier}"`;
    }

    case "COMPLETE_TASK": {
      const identifier = (actionData.taskIdentifier || "").toLowerCase();
      for (const [id, task] of taskStore.entries()) {
        if (task.title.toLowerCase().includes(identifier)) {
          task.status = "completed";
          taskStore.set(id, task);
          return `\n\n✅ Marked as complete: "${task.title}"`;
        }
      }
      return `\n\n❌ Could not find a task matching "${actionData.taskIdentifier}"`;
    }

    case "NONE":
    default:
      return "";
  }
}

/**
 * Chat Agent implementation for VoiceTasker
 */
export class Chat extends AIChatAgent<Env> {
  async onChatMessage(onFinish: any) {
    const workersai = createWorkersAI({ binding: this.env.AI });
    const model = workersai("@cf/meta/llama-3.1-70b-instruct" as any);

    const systemPrompt = getSystemPrompt();

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        let fullResponse = "";

        const result = streamText({
          system: systemPrompt,
          messages: convertToModelMessages(this.messages),
          model,
          onFinish: async (result) => {
            fullResponse = result.text;

            // Parse and execute action
            const actionData = parseAction(fullResponse);
            if (actionData && actionData.action !== "NONE") {
              const actionResult = executeAction(actionData);
              // The action result will be part of the next response context
              console.log("Action executed:", actionData.action, actionResult);
            }

            if (onFinish) {
              onFinish(result);
            }
          }
        });

        writer.merge(result.toUIMessageStream());
      }
    });

    return createUIMessageStreamResponse({ stream });
  }

  async executeTask(description: string, _task: Schedule<string>) {
    await this.saveMessages([
      ...this.messages,
      {
        id: generateId(),
        role: "user",
        parts: [{ type: "text", text: `⏰ Scheduled task triggered: ${description}` }],
        metadata: { createdAt: new Date() }
      }
    ]);
  }
}

/**
 * Worker entry point
 */
export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext) {
    const url = new URL(request.url);

    // Voice transcription endpoint
    if (url.pathname === "/api/transcribe" && request.method === "POST") {
      try {
        const formData = await request.formData();
        const audioFile = formData.get("audio") as File;

        if (!audioFile) {
          return Response.json({ error: "No audio file provided" }, { status: 400 });
        }

        const arrayBuffer = await audioFile.arrayBuffer();
        const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

        const result = await env.AI.run("@cf/openai/whisper-large-v3-turbo", {
          audio: base64Audio
        });

        return Response.json({ text: result.text, success: true });
      } catch (error) {
        console.error("Transcription error:", error);
        return Response.json({ error: "Transcription failed" }, { status: 500 });
      }
    }

    // Health check
    if (url.pathname === "/check-open-ai-key") {
      return Response.json({ success: true });
    }

    return (await routeAgentRequest(request, env)) || new Response("Not found", { status: 404 });
  }
} satisfies ExportedHandler<Env>;