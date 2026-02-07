import { generateText, sendMessageToChatStream, resetChatHistory } from './geminiService';

export interface AiProvider {
  id: string;
  generateText: (prompt: string) => Promise<string>;
  sendMessageToChatStream: (
    message: string,
    onChunk: (chunkText: string, isFinalChunk: boolean) => void,
    onError: (errorMessage: string) => void,
    options?: { signal?: AbortSignal }
  ) => Promise<void>;
  resetChatHistory: () => void;
}

const localProvider: AiProvider = {
  id: 'local',
  generateText,
  sendMessageToChatStream,
  resetChatHistory
};

const PROVIDERS: Record<string, AiProvider> = {
  local: localProvider
};

export const getAiProvider = (): AiProvider => {
  const envProvider = (import.meta.env.VITE_AI_PROVIDER as string | undefined)?.toLowerCase().trim();
  if (envProvider && PROVIDERS[envProvider]) {
    return PROVIDERS[envProvider];
  }
  return PROVIDERS.local;
};

export const getAiProviderId = (): string => getAiProvider().id;
