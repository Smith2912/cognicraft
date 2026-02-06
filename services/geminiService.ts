// Local AI service (OpenClaw integration placeholder)
// This replaces external Gemini/OpenRouter calls.

const DEFAULT_CHAT_REPLY =
  "OpenClaw AI is running locally. Tell me what you want to plan, and I’ll help break it into tasks.";

const generateLocalDescription = (title: string): string => {
  return `Define the goal, key requirements, acceptance criteria, dependencies, and any risks for "${title}".`;
};

const generateLocalSubtasks = (title: string): string => {
  return [
    `Outline requirements for ${title}`,
    `Design the approach and data flow for ${title}`,
    `Implement core logic for ${title}`,
    `Test and validate ${title}`,
  ].join('\n');
};

export const generateText = async (prompt: string): Promise<string> => {
  // Heuristic responses for description/subtask prompts.
  if (/Generate a concise, actionable description/i.test(prompt)) {
    const match = prompt.match(/titled "([^"]+)"/i);
    return generateLocalDescription(match?.[1] || 'this task');
  }
  if (/Suggest 3 to 5 potential sub-tasks/i.test(prompt)) {
    const match = prompt.match(/Title: "([^"]+)"/i);
    return generateLocalSubtasks(match?.[1] || 'this task');
  }
  return DEFAULT_CHAT_REPLY;
};

export const sendMessageToChatStream = async (
  message: string,
  onChunk: (chunkText: string, isFinalChunk: boolean) => void,
  onError: (errorMessage: string) => void,
  _options?: { signal?: AbortSignal }
): Promise<void> => {
  try {
    const reply = message?.trim().length
      ? `${DEFAULT_CHAT_REPLY} (You said: "${message.trim()}")`
      : DEFAULT_CHAT_REPLY;

    onChunk(reply, false);
    onChunk('', true);
  } catch (error) {
    console.error('[LocalAI] Error:', error);
    onError('Local AI is unavailable.');
    onChunk('', true);
  }
};

export const resetChatHistory = () => {
  // No-op for local AI
};
