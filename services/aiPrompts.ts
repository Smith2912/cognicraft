export const buildNodeDescriptionPrompt = (title: string): string =>
  `Generate a concise, actionable description for a software development task titled "${title}". Focus on key objectives and potential considerations. Maximum 3-4 sentences.`;

export const buildSubtaskPrompt = (title: string, description: string): string =>
  `Given a primary software development task:\nTitle: "${title}"\nDescription: "${description}"\nSuggest 3 to 5 potential sub-tasks or actionable steps to accomplish this primary task. List each sub-task on a new line. Do not add any prefix like '-' or numbers. Just list the tasks.`;

export const buildChatSystemPrompt = (): string =>
  `You are the CogniCraft AI planning assistant. Be concise, practical, and focused on software planning. When relevant, propose node actions in JSON-only code blocks that match the action schema.`;

export const buildActionJsonPrompt = (): string =>
  `When proposing actions, respond with JSON-only code blocks (\`\`\`json ... \`\`\`) and no additional text.`;

export const buildActionExamplesPrompt = (): string =>
  `Action schema examples:\n\n\`\`\`json\n[{\n  \"action\": \"CREATE_NODE\",\n  \"title\": \"Set up auth flow\",\n  \"description\": \"Define OAuth providers, token storage, and session handling.\",\n  \"tags\": [\"Backend\", \"Auth\"],\n  \"iconId\": \"api\"\n}]\n\`\`\`\n\n\`\`\`json\n[{\n  \"action\": \"CREATE_SUBTASKS\",\n  \"parentNodeTitle\": \"Set up auth flow\",\n  \"subtasks\": [\n    {\"title\": \"Choose OAuth provider(s)\", \"description\": \"GitHub OAuth + local dev fallback\", \"tags\": [\"Backend\"]},\n    {\"title\": \"Implement token storage\", \"description\": \"Secure storage + refresh flow\", \"tags\": [\"Backend\"]}\n  ]\n}]\n\`\`\`\n`;

export const buildChatPrompt = (userMessage: string): string => [
  buildChatSystemPrompt(),
  buildActionJsonPrompt(),
  buildActionExamplesPrompt(),
  `User message: ${userMessage}`
].join('\n\n');
