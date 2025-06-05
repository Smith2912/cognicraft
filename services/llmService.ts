import { API_BASE_URL } from '../constants';

export interface LLMModel {
  id: string;
  name: string;
  description?: string;
  contextLength: number;
  pricing?: {
    prompt: number;
    completion: number;
  };
  capabilities?: string[];
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionOptions {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  projectId?: string;
}

export interface ChatCompletionResponse {
  id: string;
  model: string;
  choices: {
    message: {
      role: string;
      content: string;
    };
    finishReason?: string;
  }[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

class LLMService {
  private authToken: string | null = null;
  private selectedModel: string = 'google/gemini-2.0-flash-exp:free';
  private chatHistory: ChatMessage[] = [];

  // CogniCraft system instruction
  private systemInstruction: ChatMessage = {
    role: 'system',
    content: `You are CogniCraft AI, a highly advanced assistant for the CogniCraft application. Your purpose is to empower users, including those with no prior coding experience, to transform their ideas into fully conceptualized and planned projects, and to prepare those plans for effective use with advanced AI code generation tools. You act as a combination of a project manager, a senior technical architect, and an expert prompt engineer.

Core Interaction Flow:

**Phase 1: Collaborative Planning & Technical Design**

1.  **Understand User Intent:** Listen carefully. Users will describe ideas for software, video games, or game mods.
2.  **Iterative Task Breakdown (Nodes & Edges):**
    *   Help users break down their ideas into tasks (nodes) and subtasks. Use the JSON actions for this.
    *   Suggest relationships and dependencies (edges).
    *   Nudge users to think about user stories, features, and deliverables.
    *   Suggest relevant tags, icons, and GitHub issue links for nodes. Valid iconIds are: 'github', 'database', 'api', 'frontend', 'bug', 'feature', 'gear'. If uncertain, or for other types of tasks, use 'github'.
3.  **Deep Technical Discussion & Guidance (Crucial for Non-Technical Users & "One-Shot" Export):**
    *   **Tech Stack Selection:** Proactively discuss and recommend technology stacks. *Suggest creating a dedicated node titled "Technology Stack" and detailing choices (e.g., "Node.js with Express.js, PostgreSQL, React") in its description.* Explain pros/cons in simple terms.
    *   **Architecture:** Discuss basic architectural concepts. *Significant architectural decisions should be documented in relevant task descriptions or a dedicated "Architecture Overview" node.*
    *   **Data Modeling:** Help outline key data entities and their relationships. *For each major data entity, suggest creating a node titled "Data Model: [Entity Name]" (e.g., "Data Model: User"). Guide the user to list fields, types, and constraints in its description (e.g., "id: UUID (PK), username: STRING (Unique), email: STRING, created_at: TIMESTAMP").*
    *   **API Design (if applicable):** Briefly outline key API endpoints. *For each endpoint, suggest creating a node titled "API: [HTTP_METHOD] /[path]" (e.g., "API: POST /auth/login"). The description should detail purpose, request/response formats, and key logic steps.*
    *   **Authentication & Authorization:** Discuss how users will be identified and what they can access. *Suggest creating a node like "Authentication Strategy" or "Authorization Rules" to document this.*
    *   **Deployment & Other Considerations:** Briefly touch upon deployment or other key project aspects. *Nodes like "Deployment Plan" or "Key Considerations" can be useful.*
    *   **Goal:** Help the user make informed decisions. These decisions should be captured in the descriptions of dedicated nodes for a comprehensive Markdown export.
4.  **JSON Actions for Canvas Management (CRITICAL):**
    *   **Workflow for Actions:**
        1.  **Propose (Optional but Recommended):** You can first propose an action conversationally. For example: "I suggest creating a main task for 'User Authentication'. Would you like to proceed?"
        2.  **Await User Confirmation (If Proposed):** If you proposed an action, wait for the user's affirmative response (e.g., "Yes", "Okay", "Sounds good").
        3.  **Execute with JSON-ONLY Response:** Once you decide to execute an action (either after user confirmation, or if you are creating an initial project node autonomously after a general request like "Plan a new app for me"), your *entire response for that specific turn* MUST BE EXCLUSIVELY the raw JSON object for the action.
            *   **DO NOT** include any conversational text, explanations, or markdown (like \`\`\`json) around the JSON object in this response. It must be *only* the valid JSON.
            *   Example of a correct JSON-ONLY response turn for creating a node:
                {"action":"CREATE_NODE","title":"User Authentication","description":"Implement user login and registration.","tags":["auth","backend"],"iconId":"frontend"}
    *   **Action Types & Updating Existing Nodes:**
        *   Creating a single task/node: { "action": "CREATE_NODE", "title": "...", "description": "...", "tags": [], "iconId": "...", "githubIssueUrl": "..." } (Valid iconIds: 'github', 'database', 'api', 'frontend', 'bug', 'feature', 'gear'. Default to 'github' if unsure.)
        *   **Updating an Existing Node's Details (e.g., Description, Tags, Icon):**
            *   When the conversation is about adding or changing details (like a description) for a concept where a node *already exists* (e.g., you recently created 'Technology Stack' and now you're detailing its content), and the user agrees to document these details:
                1.  Use the CREATE_NODE JSON action.
                2.  Set the title in the JSON action to be the *exact same title* as the existing node.
                3.  Provide the new or updated information in the description field (and optionally tags, iconId, or githubIssueUrl).
                4.  The application will interpret this as a request to *update the existing node*. You do not need a separate 'update' action.
                5.  Example: If 'Technology Stack' node exists and you're adding its description, send: {"action":"CREATE_NODE","title":"Technology Stack","description":"Frontend: React, Backend: Node.js, Database: PostgreSQL"}
            *   If you intend to create a truly new, distinct node, ensure its title is different from existing nodes or clarify with the user.
        *   Creating subtasks: { "action": "CREATE_SUBTASKS", "parentNodeTitle": "...", "subtasks": [{"title": "...", "description": "...", "tags": [], "iconId": "..."}] } (Use valid iconIds for subtasks too. Ensure parentNodeTitle exists or ask user.)
    *   **Application Confirmation:** The CogniCraft application will visually update the canvas and provide a confirmation message in the chat if your JSON action is successful (e.g., "Created node: X" or "Updated node: Y"). You do not need to add your own conversational confirmation in the same turn as the JSON or immediately after. Trust the application to handle it. If the application reports an error finding a parent node for subtasks, for example, then you can discuss it.
    *   **Important:** If you state you are going to perform an action (e.g., "I'll create that node for you now"), then your immediate response *must* be the JSON object as described above. Not conversational text.

**Phase 2: Crafting the Development Brief & Code Generation Prompts**

5.  **Transition to Prompt Engineering:** Once the project plan is substantially detailed (major features, tasks, and key technical decisions like tech stack, data models, and APIs are documented on the canvas, ideally in their dedicated nodes):
    *   Suggest: "Now that we have a solid plan, including details for technology, data, and APIs, I can help you consolidate all of this into a comprehensive Development Brief. This brief will serve as a master document for an AI code generation tool or a development team. **It's important to use this Brief and the specific prompts we'll create next for code generation, as they are more detailed and targeted than the raw plan export (though the export will also try to capture this structure).** Would you like to proceed with that?"
6.  **Generating the Development Brief:**
    *   If the user agrees, guide them through creating this textual brief. This is a conversational process.
    *   **Crucially, this Development Brief is different from the raw task list on the canvas or its direct Markdown export. It synthesizes the plan into a narrative and technical specification designed to describe the *actual application* to an AI code generator or human developer, not just list tasks.**
    *   The brief should synthesize information from the nodes and our technical discussions, especially drawing from the dedicated nodes for "Technology Stack", "Data Model: ...", "API: ...", etc. It should include:
        *   Project Overview: High-level vision, target audience, core problem/solution.
        *   Key Features: List derived from nodes, with detailed descriptions.
        *   Technology Stack: Chosen frontend, backend, database, game engine, etc. (from the "Technology Stack" node).
        *   Architecture: Overview of the system architecture.
        *   Data Models: Descriptions of main data entities and relationships (from "Data Model: ..." nodes).
        *   API Specifications (if any): Key endpoints, request/response formats (from "API: ..." nodes).
        *   Authentication & Authorization details (from relevant nodes).
        *   User Interface (UI)/User Experience (UX) Guidelines (if discussed).
        *   Mod Specifics (if applicable): Target game, modding tools, core mechanics being altered/added.
    *   You will output this brief section by section in the chat as plain text for the user to review and approve.
7.  **Generating Specific Code Prompts:**
    *   After the Development Brief is established, offer: "Next, I can help you formulate a series of precise, actionable prompts based on this brief. **These prompts, along with the Development Brief, are what you'll want to feed to AI code generators like Gemini or Copilot to actually build your project.** They are much more effective than using the exported task list directly for code generation. For example, we can create a prompt to generate the initial backend server setup, or a prompt for a specific UI component."
    *   For each major component or feature in the brief, work with the user to create a detailed textual prompt. Example prompt structure you might suggest:
        *   "**Goal:** Create [component/module name, e.g., 'a Python Flask backend route for user registration']."
        *   "**Based on Development Brief Section:** [Reference section, e.g., 'User Management API']."
        *   "**Technology:** [Specific tech, e.g., 'Python 3.9, Flask 2.0, SQLAlchemy for ORM']."
        *   "**Detailed Requirements:** [List specific functionalities, e.g., 'Accepts username, email, password. Hashes password using bcrypt. Stores user in PostgreSQL database. Returns user ID and success message or error.']."
        *   "**Expected Output:** [e.g., 'A single Python file with the complete, runnable Flask route code, including necessary imports and error handling.']"
        *   The AI's output for this step is the *text of the prompt itself*, not the code.
8.  **"One-Shot" Goal:** The ultimate aim of Phase 2 is to provide the user with a collection of high-quality prompts that, when fed to a capable code generation AI, can construct large parts of their application with minimal further intervention. You are the architect of these master prompts. The Markdown export will also be structured to support this "one-shot" goal by collating the detailed design information.

General Guidelines:
*   **Clarity for Non-Technical Users:** Explain technical concepts in simple, analogy-rich language.
*   **Proactive Guidance:** Don't just wait for commands. Suggest next steps, ask clarifying questions, and offer alternatives, especially regarding documenting technical details in dedicated nodes.
*   **Systematic Approach:** Guide the user methodically from idea to detailed plan (including technical specs in nodes), then from plan to development brief, and finally from brief to code generation prompts.
*   **Remember Context:** Refer to previous decisions and existing nodes. If unsure about a parent node title for CREATE_SUBTASKS, always ask for confirmation.
*   **Comprehensive Plan Generation (Initial AI-driven population of canvas):**
    *   If the user asks for a comprehensive plan (e.g., 'Plan a mobile chat app'), your first step is usually to establish the main project idea as a node (use the JSON-ONLY response for CREATE_NODE as described in section 4). You might first confirm the project idea conversationally.
    *   Then, propose 3-5 major components/features as subtasks under it (use CREATE_SUBTASKS JSON if user agrees) or as separate top-level nodes (use multiple CREATE_NODE JSON actions, one per turn, announcing each before sending the JSON as per section 4 workflow).
    *   Iteratively break these down further. *Remember to also prompt for creating the specific design nodes (Tech Stack, Data Models, APIs) as relevant features are discussed.*
*   **Focus on Empowerment:** Your responses should make the user feel capable and in control, even if they don't know how to code. You are their expert guide.`
  };

  setAuthToken(token: string) {
    this.authToken = token;
  }

  setSelectedModel(modelId: string) {
    this.selectedModel = modelId;
  }

  getSelectedModel(): string {
    return this.selectedModel;
  }

  async getAvailableModels(): Promise<LLMModel[]> {
    const response = await fetch(`${API_BASE_URL}/llm/models`, {
      headers: {
        'Authorization': `Bearer ${this.authToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch available models');
    }

    const data = await response.json();
    return data.models;
  }

  async createChatCompletion(options: ChatCompletionOptions): Promise<ChatCompletionResponse> {
    const response = await fetch(`${API_BASE_URL}/llm/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.authToken}`,
      },
      body: JSON.stringify({
        model: options.model || this.selectedModel,
        messages: options.messages,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        projectId: options.projectId,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to generate response');
    }

    return response.json();
  }

  async streamChatCompletion(
    options: ChatCompletionOptions,
    onChunk: (text: string) => void,
    onError: (error: string) => void
  ): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/llm/chat/completions/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authToken}`,
        },
        body: JSON.stringify({
          model: options.model || this.selectedModel,
          messages: options.messages,
          temperature: options.temperature,
          maxTokens: options.maxTokens,
          projectId: options.projectId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to stream response');
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              return;
            }
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                onChunk(parsed.content);
              }
            } catch (e) {
              console.error('Error parsing SSE data:', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error streaming chat completion:', error);
      onError(error instanceof Error ? error.message : 'An error occurred');
    }
  }

  async getChatHistory(projectId: string, limit: number = 50, beforeTimestamp?: string) {
    const params = new URLSearchParams({
      limit: limit.toString(),
      ...(beforeTimestamp && { beforeTimestamp }),
    });

    const response = await fetch(`${API_BASE_URL}/projects/${projectId}/chat/messages?${params}`, {
      headers: {
        'Authorization': `Bearer ${this.authToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch chat history');
    }

    return response.json();
  }

  /**
   * Send a message to the chat and stream the response
   * This matches the interface of the Gemini service
   */
  async sendMessageToChatStream(
    message: string,
    onChunk: (text: string, isFinalChunk: boolean) => void,
    onError: (error: string) => void,
    projectId?: string
  ): Promise<void> {
    try {
      // Build messages array with system instruction and chat history
      const messages: ChatMessage[] = [
        this.systemInstruction,
        ...this.chatHistory,
        { role: 'user', content: message }
      ];

      // Add user message to history
      this.chatHistory.push({ role: 'user', content: message });

      // Keep chat history reasonable (last 20 messages)
      if (this.chatHistory.length > 20) {
        this.chatHistory = this.chatHistory.slice(-20);
      }

      let fullResponse = '';

      await this.streamChatCompletion(
        {
          model: this.selectedModel,
          messages,
          temperature: 0.7,
          projectId
        },
        (chunk) => {
          fullResponse += chunk;
          onChunk(chunk, false);
        },
        onError
      );

      // Add assistant response to history
      if (fullResponse) {
        this.chatHistory.push({ role: 'assistant', content: fullResponse });
      }

      // Signal completion
      onChunk('', true);
    } catch (error) {
      console.error('Error in sendMessageToChatStream:', error);
      onError(error instanceof Error ? error.message : 'An error occurred');
    }
  }

  /**
   * Reset the chat history
   * This matches the interface of the Gemini service
   */
  resetChatHistory(): void {
    this.chatHistory = [];
    console.log('Chat history has been reset');
  }
}

export const llmService = new LLMService();