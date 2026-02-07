// Local AI service (OpenClaw integration placeholder)
// This replaces external Gemini/OpenRouter calls.

const DEFAULT_CHAT_REPLY =
  "OpenClaw AI is running locally. Tell me what you want to plan, and I’ll help break it into tasks.";

const buildCreateNodesResponse = (topic: string): string => {
  const titleSuffix = topic ? ` for ${topic}` : '';
  return [
    '```json',
    JSON.stringify([
      {
        action: 'CREATE_NODE',
        title: `Define requirements${titleSuffix}`,
        description: `Clarify scope, success criteria, and constraints${titleSuffix}.`,
        tags: ['Research'],
        iconId: 'feature'
      },
      {
        action: 'CREATE_NODE',
        title: `Design data model${titleSuffix}`,
        description: 'Identify entities, fields, and relationships.',
        tags: ['Backend'],
        iconId: 'database'
      },
      {
        action: 'CREATE_NODE',
        title: `Implement core workflow${titleSuffix}`,
        description: 'Build the main flow and integrate dependencies.',
        tags: ['Backend'],
        iconId: 'api'
      },
      {
        action: 'CREATE_NODE',
        title: `Build UI${titleSuffix}`,
        description: 'Create the user interface and validation states.',
        tags: ['Frontend'],
        iconId: 'frontend'
      },
      {
        action: 'CREATE_NODE',
        title: `Test and verify${titleSuffix}`,
        description: 'Validate happy path, edge cases, and error handling.',
        tags: ['Test'],
        iconId: 'bug'
      }
    ], null, 2),
    '```'
  ].join('\n');
};

const buildSubtasksResponse = (parentTitle: string): string => {
  return [
    '```json',
    JSON.stringify([
      {
        action: 'CREATE_SUBTASKS',
        parentNodeTitle: parentTitle,
        subtasks: [
          {
            title: 'Outline requirements',
            description: 'Define scope, inputs, outputs, and constraints.',
            tags: ['Research'],
            iconId: 'feature'
          },
          {
            title: 'Design implementation',
            description: 'Plan data flow and component responsibilities.',
            tags: ['Backend'],
            iconId: 'api'
          },
          {
            title: 'Implement core logic',
            description: 'Build the main functionality and integrations.',
            tags: ['Backend'],
            iconId: 'gear'
          },
          {
            title: 'Validate and test',
            description: 'Cover edge cases and error handling.',
            tags: ['Test'],
            iconId: 'bug'
          }
        ]
      }
    ], null, 2),
    '```'
  ].join('\n');
};

const buildLocalActionResponse = (message: string): string | null => {
  const normalized = message.toLowerCase();
  if (normalized.includes('create nodes') || normalized.includes('create node') || normalized.includes('nodes for')) {
    const topicMatch = message.match(/nodes? for (.+)/i);
    return buildCreateNodesResponse(topicMatch?.[1]?.trim() || 'this feature');
  }
  if (normalized.includes('subtasks') && normalized.includes('titled')) {
    const match = message.match(/titled\s+["'](.+?)["']/i);
    return buildSubtasksResponse(match?.[1] || 'this task');
  }
  return null;
};

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
    const trimmed = message?.trim() || '';
    const actionResponse = trimmed ? buildLocalActionResponse(trimmed) : null;
    const reply = actionResponse || (trimmed.length
      ? `${DEFAULT_CHAT_REPLY} (You said: "${trimmed}")`
      : DEFAULT_CHAT_REPLY);

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
