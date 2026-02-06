import { z } from 'zod';
import type { AiAction } from '../types';

const iconIdSchema = z.enum(['github', 'database', 'api', 'frontend', 'bug', 'feature', 'gear']);

const nonEmptyString = z.string().trim().min(1);
const tagsSchema = z.array(nonEmptyString).optional();

const createNodeSchema = z.object({
  action: z.literal('CREATE_NODE'),
  title: nonEmptyString,
  description: z.string().optional(),
  tags: tagsSchema,
  iconId: iconIdSchema.optional(),
  githubIssueUrl: z.string().url().optional()
}).strict();

const createSubtaskSchema = z.object({
  title: nonEmptyString,
  description: z.string().optional(),
  tags: tagsSchema,
  iconId: iconIdSchema.optional(),
  githubIssueUrl: z.string().url().optional()
}).strict();

const createSubtasksSchema = z.object({
  action: z.literal('CREATE_SUBTASKS'),
  parentNodeTitle: nonEmptyString,
  subtasks: z.array(createSubtaskSchema).min(1)
}).strict();

const aiActionSchema = z.union([createNodeSchema, createSubtasksSchema]);
const aiActionArraySchema = z.array(aiActionSchema).min(1);

const jsonCodeBlockRegex = /```json\s*([\s\S]*?)\s*```/g;

const extractJsonCodeBlocks = (input: string): string[] => {
  const blocks: string[] = [];
  jsonCodeBlockRegex.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = jsonCodeBlockRegex.exec(input)) !== null) {
    const content = match[1]?.trim();
    if (content) blocks.push(content);
  }
  return blocks;
};

const isResponseOnlyJsonCodeBlocks = (input: string): boolean => {
  jsonCodeBlockRegex.lastIndex = 0;
  const stripped = input.replace(jsonCodeBlockRegex, '').trim();
  return stripped.length === 0;
};

const normalizeAction = (action: z.infer<typeof aiActionSchema>): AiAction => {
  if (action.action === 'CREATE_NODE') {
    return {
      action: 'CREATE_NODE',
      title: action.title,
      description: action.description ?? '',
      tags: action.tags ?? [],
      iconId: action.iconId ?? 'github',
      githubIssueUrl: action.githubIssueUrl
    };
  }

  return {
    action: 'CREATE_SUBTASKS',
    parentNodeTitle: action.parentNodeTitle,
    subtasks: action.subtasks.map(subtask => ({
      title: subtask.title,
      description: subtask.description ?? '',
      tags: subtask.tags ?? [],
      iconId: subtask.iconId ?? 'github',
      githubIssueUrl: subtask.githubIssueUrl
    }))
  };
};

export const parseAiActionsFromResponse = (aiResponse: string): AiAction[] => {
  const actions: AiAction[] = [];

  if (!isResponseOnlyJsonCodeBlocks(aiResponse)) {
    console.warn('[aiActions] Ignoring AI response with non-JSON content outside code blocks.');
    return actions;
  }

  const jsonBlocks = extractJsonCodeBlocks(aiResponse);

  for (const jsonText of jsonBlocks) {
    try {
      const parsed = JSON.parse(jsonText);

      if (Array.isArray(parsed)) {
        const result = aiActionArraySchema.safeParse(parsed);
        if (result.success) {
          result.data.forEach(action => actions.push(normalizeAction(action)));
        } else {
          console.warn('[aiActions] Invalid AI action array payload:', result.error.flatten());
        }
        continue;
      }

      const result = aiActionSchema.safeParse(parsed);
      if (result.success) {
        actions.push(normalizeAction(result.data));
      } else {
        console.warn('[aiActions] Invalid AI action payload:', result.error.flatten());
      }
    } catch (error) {
      console.warn('[aiActions] Failed to parse JSON code block:', error);
    }
  }

  return actions;
};
