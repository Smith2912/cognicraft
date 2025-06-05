
# CogniCraft Development Plan & Roadmap

## 1. Project Overview

CogniCraft is a visual, AI-powered planning tool designed to help users, from individuals to teams, conceptualize and structure software, game, and mod development projects. It combines a dynamic node-based canvas with an intelligent AI assistant to facilitate brainstorming, task breakdown, technical design, and preparation for AI-assisted code generation.

## 2. Current Status (as of this version)

### Core Canvas & Node Management:
*   **Node Creation**: Manual ("Create" button), double-click on canvas, context-menu (right-click) on canvas.
*   **Node Manipulation**: Selection (single/multi with Shift), dragging (grid-snapped), resizing (grid-snapped).
*   **Edge Creation**: Dragging connection handles between nodes. Edges are directional with arrowheads.
*   **Node Editor Sidebar**:
    *   Edit title, description, status (ToDo, InProgress, Done, Blocked).
    *   Select from a predefined set of icons (GitHub, Database, API, Frontend, Bug, Feature, Gear).
    *   Manage tags (add predefined, add custom, remove).
    *   Link to GitHub Issues (create new issue URL, link existing).
*   **Zoom & Pan**: Mouse wheel zoom, middle-mouse/Alt+click pan.
*   **Fit to Screen**: Adjusts viewbox to show all nodes.
*   **Grid**: Toggleable dot grid for visual guidance.
*   **Auto-Layout**: Basic hierarchical layout for nodes.

### AI Integration (Gemini):
*   **Chat Panel**: Interact with an AI assistant.
*   **AI-Powered Node Creation**: AI can create new nodes based on chat.
*   **AI-Powered Node Updates**: AI can update descriptions of existing nodes.
*   **AI-Powered Subtask Creation**: AI can create subtasks linked to a parent node.
*   **AI-Generated Descriptions**: For selected nodes in the editor.
*   **AI-Suggested Subtasks**: For selected nodes in the editor.
*   **System Prompt**: Detailed instructions guide the AI's behavior for planning and JSON action generation.

### Project & State Management:
*   **Simulated Multi-Project Support**:
    *   Create, switch, edit (name, repo URL, team members), delete projects.
    *   Project data (nodes, edges, chat, history) is stored in `localStorage`, scoped per project.
*   **Simulated User Accounts**:
    *   "Login" with a GitHub username (no real auth).
    *   User info (avatar) displayed.
*   **Undo/Redo**: For canvas operations (node/edge changes, selections). Implemented using a history stack.
*   **Persistence**: Canvas state, chat messages, and project list are saved to `localStorage`.
*   **Markdown Export**: Export the current project plan to a structured Markdown file, designed to be comprehensive for AI or human developers.

### UI/UX:
*   **Dark Theme**: Consistent dark theme applied.
*   **Header**: App title, project name, create/clear buttons, settings access.
*   **Left Controls Toolbar**: Quick access to grid, zoom, fit, undo/redo, auto-layout.
*   **Settings Panel (Modal)**:
    *   Account management (simulated login/logout).
    *   Project management (create, switch, delete, edit details like name, GitHub repo, team members).
    *   Subscription placeholders (current plan, upgrade button, Pro benefits list).
    *   Data management (export Markdown).
    *   Placeholders for Appearance and AI Configuration.
*   **Responsive Design Elements**: Basic responsiveness considered.

## 3. Frontend Enhancements (Short-Term Focus)

These are features to round out the core user experience on the frontend.

*   **Edge Editing & Deletion**:
    *   Allow selection of edges (currently possible).
    *   Context menu for selected edge: "Delete Edge".
    *   Keyboard shortcut (`Delete`/`Backspace`) for selected edge.
*   **Improved Connection Flow**:
    *   Drag from a node's connection handle to an empty canvas space to automatically create a new node and link to it.
*   **Node Copy/Paste**:
    *   Context menu options: "Copy Node(s)", "Paste Node(s)".
    *   Keyboard shortcuts (`Ctrl+C`/`Cmd+C`, `Ctrl+V`/`Cmd+V`).
    *   Handle pasting at mouse cursor position, potentially with offset for multiple pastes.
*   **Mini-map**:
    *   A small, draggable overview of the entire canvas, especially useful for large projects.
*   **Advanced Node Search & Filter**:
    *   Input field (perhaps in header or a dedicated panel) to search nodes by title, description, or tags.
    *   Highlight or filter visible nodes based on search criteria.
*   **Enhanced Keyboard Shortcuts**:
    *   `Ctrl+G`/`Cmd+G` to group selected nodes (visual grouping initially).
    *   Arrow keys for fine-tuning selected node positions.
    *   `Tab` to cycle through nodes or editable fields.
*   **Refined Auto-Layout Options**:
    *   Offer different layout algorithms (e.g., tree, force-directed for different views).
    *   Option to layout only a selection of nodes.
*   **Loading/Saving Indicators**:
    *   Visual feedback when loading data or saving to `localStorage` (will be more important with a real backend).

## 4. Backend Integration (Medium-Term Major Phase)

Transition from `localStorage` to a persistent backend database. Refer to `CogniCraft_BackEnd_Plan.md` for detailed API and data models.

*   **Backend Setup**:
    *   Choose and set up language/framework (e.g., Node.js/Express.js, Python/Flask).
    *   Set up database (e.g., PostgreSQL, MongoDB).
    *   Implement ORM/ODM (e.g., Sequelize, Mongoose).
*   **User Authentication**:
    *   Implement real user authentication (OAuth with GitHub, or email/password with JWT).
*   **Project CRUD APIs**:
    *   Endpoints for creating, reading, updating, deleting projects.
    *   Endpoints for managing project members and roles.
*   **Canvas State APIs**:
    *   Endpoints for saving and loading nodes and edges for a project.
    *   Consider real-time updates using WebSockets if collaboration is a priority.
*   **Chat History APIs**:
    *   Endpoints for saving and retrieving chat messages per project.
*   **Server-Side History Management**:
    *   Implement undo/redo logic on the backend, storing snapshots in the database.
*   **Frontend Migration**:
    *   Update all frontend services to interact with the new backend APIs.
    *   Replace `localStorage` calls with API calls.
    *   Handle API loading states, errors, and authentication tokens.

## 5. AI Enhancements (Ongoing)

Continuously improve AI capabilities and interaction.

*   **Refine AI System Prompt**:
    *   Iteratively improve the Gemini system instruction based on user feedback and observed AI behavior.
    *   Add more sophisticated examples for action generation and technical design.
*   **AI for Edge Creation/Suggestions**:
    *   Allow AI to suggest or create connections (edges) between nodes based on semantic relationships.
    *   Example: "Link 'User Login API' to 'User Authentication Module'."
*   **AI for Plan Validation & Improvement**:
    *   AI analyzes the current plan for inconsistencies, missing prerequisites, or suggests improvements.
    *   Example: "I see a 'Payment Processing' task, but no 'User Billing Profile' data model. Should we add one?"
*   **Full Implementation of "Development Brief" & "Code Prompt" Generation (Phase 2 of AI Flow)**:
    *   Guide users through creating a detailed textual Development Brief based on the canvas plan.
    *   Help users formulate specific, actionable prompts for code generation AIs (like Gemini itself, or Copilot). This is a core value proposition.
*   **Backend Proxy for AI Calls (Optional but Recommended for Scale/Security)**:
    *   Route Gemini API calls through the backend to manage API keys securely and potentially cache common requests or manage rate limits.

## 6. Monetization Features (Medium to Long-Term, post-backend)

Implement features to support a subscription model.

*   **Subscription Management Integration**:
    *   Integrate with a payment provider (e.g., Stripe, Paddle).
    *   Backend logic for handling subscription statuses, webhooks from payment provider.
*   **Feature Gating**:
    *   Frontend and backend logic to enable/disable "Pro" features based on the user's subscription status.
    *   Examples: Unlimited projects, advanced AI model access, increased AI usage limits, expanded version history, exclusive templates.
*   **Usage Quotas & Limits**:
    *   Implement mechanisms to track and enforce usage limits for free-tier users (e.g., number of projects, number of nodes per project, monthly AI interactions).
*   **Admin Panel**:
    *   Basic admin interface for managing users and subscriptions.

## 7. UX/UI Polish & Advanced Features (Ongoing / Long-Term)

*   **Node Grouping**:
    *   Allow users to visually group related nodes with a container.
    *   Groups can be collapsed/expanded.
*   **Customizable Themes**:
    *   Allow users to switch between light/dark themes (and potentially user-created themes).
*   **Import/Export Options**:
    *   More robust import/export (JSON, CSV, potentially other project management tool formats).
*   **Accessibility (A11y)**:
    *   Conduct an accessibility audit and implement improvements (ARIA attributes, keyboard navigation, color contrast).
*   **Performance Optimization**:
    *   Optimize rendering for very large canvases (virtualization, WebGL).
    *   Optimize backend queries and data handling for many concurrent users.
*   **User Onboarding & Tutorials**:
    *   Interactive tutorials or guided tours for new users.
    *   Contextual help and tooltips.
*   **Templates**:
    *   Provide pre-built project templates for common project types (e.g., SaaS app, mobile game, blog).
    *   Allow users to save their own projects as templates.
*   **Public Project Sharing / Read-Only Views**:
    *   Allow users to share a read-only link to their projects.

## 8. Development Workflow & Best Practices

*   **Version Control**: Use Git with a clear branching strategy (e.g., Gitflow).
*   **Issue Tracking**: Use a tool like GitHub Issues, Jira, or Trello.
*   **Testing**:
    *   **Unit Tests**: For individual functions and components.
    *   **Integration Tests**: For interactions between components/modules and API endpoints.
    *   **End-to-End (E2E) Tests**: For user flows (e.g., using Playwright, Cypress).
*   **Code Quality**: Linting (ESLint), formatting (Prettier), code reviews.
*   **CI/CD Pipeline**: Automate testing and deployment (e.g., GitHub Actions, Jenkins).
*   **Documentation**: Maintain code documentation and API documentation (e.g., Swagger/OpenAPI for backend).

This plan provides a high-level roadmap. Each major section will require further breakdown into specific tasks and sprints as development progresses.
