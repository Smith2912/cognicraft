# CogniCraft Backend Plan

## 1. Core Technologies (Assumptions)

*   **Language/Framework:** Node.js with Express.js (Common choice for rapid development, good with JSON APIs)
*   **Database:** PostgreSQL (Relational, robust, good JSONB support) or MongoDB (NoSQL, flexible schema, good for document-like data)
    *   _This plan will lean towards PostgreSQL for structure, but can be adapted._
*   **Authentication:** JWT (JSON Web Tokens) for stateless API authentication.
*   **ORM/Query Builder:** Sequelize (for PostgreSQL) or Mongoose (for MongoDB) to interact with the database.

## 2. Data Models (Database Schema)

We'll define tables/collections for users, projects, nodes, edges, tags, and chat messages.

### 2.1. `Users` Table/Collection

*   `id`: UUID (Primary Key)
*   `username`: STRING (Unique, e.g., GitHub username for simulated login)
*   `email`: STRING (Unique, Nullable, for potential future real auth)
*   `avatar_url`: STRING (Nullable)
*   `password_hash`: STRING (Nullable, for real auth if implemented)
*   `created_at`: TIMESTAMP
*   `updated_at`: TIMESTAMP

### 2.2. `Projects` Table/Collection

*   `id`: UUID (Primary Key)
*   `name`: STRING (Not Null)
*   `owner_user_id`: UUID (Foreign Key to `Users.id`, Not Null)
*   `github_repo_url`: STRING (Nullable)
*   `created_at`: TIMESTAMP
*   `updated_at`: TIMESTAMP

### 2.3. `ProjectMembers` Table/Collection (Many-to-Many for Users and Projects)

*   `project_id`: UUID (Foreign Key to `Projects.id`, Part of Composite Primary Key)
*   `user_id`: UUID (Foreign Key to `Users.id`, Part of Composite Primary Key)
*   `role`: STRING (e.g., 'owner', 'editor', 'viewer', Default: 'member')
*   `joined_at`: TIMESTAMP

### 2.4. `Nodes` Table/Collection

*   `id`: UUID (Primary Key, can be client-generated if preferred, backend validates uniqueness per project)
*   `project_id`: UUID (Foreign Key to `Projects.id`, Not Null, Indexed)
*   `title`: TEXT (Not Null)
*   `description`: TEXT (Nullable)
*   `status`: STRING (Enum: 'To Do', 'In Progress', 'Done', 'Blocked', Not Null)
*   `x_position`: INTEGER (Not Null)
*   `y_position`: INTEGER (Not Null)
*   `width`: INTEGER (Nullable, defaults to a constant if not provided)
*   `height`: INTEGER (Nullable, defaults to a constant if not provided)
*   `icon_id`: STRING (Nullable, e.g., 'github', 'api', 'bug')
*   `github_issue_url`: STRING (Nullable)
*   `created_at`: TIMESTAMP
*   `updated_at`: TIMESTAMP

### 2.5. `Tags` Table/Collection

*   `id`: UUID (Primary Key)
*   `project_id`: UUID (Foreign Key to `Projects.id`, Not Null, for project-specific tags)
*   `name`: STRING (Not Null, Unique within a project)
*   `created_at`: TIMESTAMP

### 2.6. `NodeTags` Table/Collection (Many-to-Many for Nodes and Tags)

*   `node_id`: UUID (Foreign Key to `Nodes.id`, Part of Composite Primary Key)
*   `tag_id`: UUID (Foreign Key to `Tags.id`, Part of Composite Primary Key)

### 2.7. `Edges` Table/Collection

*   `id`: UUID (Primary Key, client-generated)
*   `project_id`: UUID (Foreign Key to `Projects.id`, Not Null, Indexed)
*   `source_node_id`: UUID (Foreign Key to `Nodes.id`, Not Null)
*   `target_node_id`: UUID (Foreign Key to `Nodes.id`, Not Null)
*   `source_handle`: STRING (Nullable, e.g., 'top', 'bottom', 'left', 'right')
*   `target_handle`: STRING (Nullable)
*   `created_at`: TIMESTAMP
*   `updated_at`: TIMESTAMP

### 2.8. `ChatMessages` Table/Collection

*   `id`: UUID (Primary Key, client-generated)
*   `project_id`: UUID (Foreign Key to `Projects.id`, Not Null, Indexed)
*   `session_id`: STRING (Indexed, could be `user_id` + `project_id` or a dedicated chat session ID if chat can be independent of project context - for now, assume per project)
*   `sender_type`: STRING (Enum: 'user', 'ai', Not Null)
*   `user_id`: UUID (Foreign Key to `Users.id`, Nullable, populated if `sender_type` is 'user')
*   `text_content`: TEXT (Not Null)
*   `timestamp`: TIMESTAMP (Not Null, client-provided)
*   `is_error`: BOOLEAN (Default: false)
*   `is_processing_stub`: BOOLEAN (Internal flag, not directly from client, indicates if this was a placeholder before full AI response was ready - useful if backend proxies AI streaming. For client-side AI, this might not be needed here.)
*   `ai_action_parsed`: JSONB (Nullable, stores the structured `AiAction` if one was parsed from this AI message)
*   `created_at`: TIMESTAMP (Server-side)

### 2.9. `ProjectHistory` Table/Collection (For Undo/Redo)

*   `id`: UUID (Primary Key)
*   `project_id`: UUID (Foreign Key to `Projects.id`, Not Null, Indexed)
*   `user_id`: UUID (Foreign Key to `Users.id`, Not Null, identifies who made the change)
*   `sequence_number`: INTEGER (Auto-incrementing per project or strictly ordered by timestamp to manage the stack)
*   `snapshot_nodes`: JSONB (Full array of `NodeData` at this point in history)
*   `snapshot_edges`: JSONB (Full array of `EdgeData` at this point)
*   `snapshot_selected_node_ids`: JSONB (Array of selected node IDs)
*   `snapshot_selected_edge_id`: STRING (Nullable, ID of the selected edge)
*   `created_at`: TIMESTAMP (Timestamp of when the state was snapshotted)
    *   _Note: The backend will manage a stack of these per project, respecting `HISTORY_LIMIT`._

## 3. API Endpoints

All endpoints are prefixed with `/api/v1`.
Authentication: Assume a middleware checks for a valid JWT on protected routes and attaches `req.user` (containing `id`, `username`).

### 3.1. Authentication Endpoints

*   **`POST /auth/login`** (Simulated GitHub Login)
    *   Request Body: `{ "username": "string" }`
    *   Response (200 OK): `{ "token": "jwt_string", "user": UserObject }`
    *   Logic: Finds or creates a user, generates JWT.
*   **`POST /auth/logout`**
    *   Request Body: (None, token from header)
    *   Response (204 No Content)
    *   Logic: Can be client-side only by deleting the token. If server-side token blocklist is used, update it here.

### 3.2. User Endpoints

*   **`GET /users/me`**
    *   Response (200 OK): `{ "user": UserObject }` (Fetched based on JWT)

### 3.3. Project Endpoints

*   **`POST /projects`**
    *   Request Body: `{ "name": "string", "github_repo_url": "string" (optional), "team_member_usernames": ["string"] (optional) }`
    *   Response (201 Created): `{ "project": ProjectObject }`
    *   Logic: Creates project, sets `owner_user_id` to `req.user.id`. Adds team members.
*   **`GET /projects`** (List projects accessible by the authenticated user)
    *   Response (200 OK): `{ "projects": [ProjectObject] }`
*   **`GET /projects/{projectId}`** (Get full project details including canvas and chat)
    *   Response (200 OK): `{ "project": ProjectObject, "nodes": [NodeObject], "edges": [EdgeObject], "chat_messages": [ChatMessageObject], "history_state": { "current_index": number, "total_snapshots": number } }`
    *   Logic: Ensures user has access.
*   **`PUT /projects/{projectId}`**
    *   Request Body: `{ "name": "string" (optional), "github_repo_url": "string" (optional), "team_member_usernames": ["string"] (optional) }`
    *   Response (200 OK): `{ "project": ProjectObject }`
    *   Logic: Only owner or authorized members can update.
*   **`DELETE /projects/{projectId}`**
    *   Response (204 No Content)
    *   Logic: Only owner can delete. Deletes associated nodes, edges, chat, history.

### 3.4. Canvas State Endpoints (Nodes & Edges collectively)

*   **`GET /projects/{projectId}/canvas`** (If separated from main project GET)
    *   Response (200 OK): `{ "nodes": [NodeObject], "edges": [EdgeObject] }`
*   **`PUT /projects/{projectId}/canvas`** (To save the entire canvas state, triggering history snapshot)
    *   Request Body: `{ "nodes": [NodeObjectFromClient], "edges": [EdgeObjectFromClient], "selected_node_ids": ["string"], "selected_edge_id": "string" (nullable) }`
    *   Response (200 OK): `{ "message": "Canvas state saved.", "new_history_sequence": number }`
    *   Logic:
        1.  Validates input.
        2.  Replaces all nodes and edges for the project with the provided ones (or performs a more complex diff/merge if needed, but full replacement is simpler for frontend's current history model).
        3.  Creates a new `ProjectHistory` entry. Manages `HISTORY_LIMIT`.
        4.  Returns the sequence number of the new history state.

    _Alternative for granular updates (more RESTful, but more calls from client):_
    Separate endpoints for Nodes and Edges for CRUD. The client would then call these individually. The `PUT /projects/{projectId}/canvas` is simpler if the client already aggregates the state.

    **Individual Node Endpoints (if granular approach chosen):**
    *   `POST /projects/{projectId}/nodes` -> `NodeObject`
    *   `PUT /projects/{projectId}/nodes/{nodeId}` -> `NodeObject`
    *   `DELETE /projects/{projectId}/nodes/{nodeId}`

    **Individual Edge Endpoints (if granular approach chosen):**
    *   `POST /projects/{projectId}/edges` -> `EdgeObject`
    *   `DELETE /projects/{projectId}/edges/{edgeId}`

### 3.5. Tag Endpoints

*   **`POST /projects/{projectId}/tags`** (Create a tag if not exists for project)
    *   Request Body: `{ "name": "string" }`
    *   Response (201 Created or 200 OK): `{ "tag": TagObject }`
*   **`GET /projects/{projectId}/tags`**
    *   Response (200 OK): `{ "tags": [TagObject] }`
*   **`POST /projects/{projectId}/nodes/{nodeId}/tags`** (Assign tag to node)
    *   Request Body: `{ "tag_id": "uuid" }` or `{ "tag_name": "string" }` (backend creates tag if `tag_name` provided and not exists)
    *   Response (200 OK): `{ "node_tags": [TagObject] }` (current tags for the node)
*   **`DELETE /projects/{projectId}/nodes/{nodeId}/tags/{tagId}`** (Unassign tag)
    *   Response (204 No Content)

### 3.6. Chat Message Endpoints

*   **`POST /projects/{projectId}/chat/messages`**
    *   Request Body: `{ "text_content": "string", "sender_type": "user", "timestamp": "ISO_string_client_timestamp" }`
    *   Response (201 Created): `{ "user_message": ChatMessageObject }`
    *   Logic: Stores the user's message.
        *   _Note:_ AI responses are handled client-side by Gemini. The client then saves the AI's response via a separate call or as part of a general state update if needed (e.g. `PUT /projects/{projectId}/chat/ai-message`). For simplicity, let's assume client makes a distinct call to save AI message.
*   **`POST /projects/{projectId}/chat/ai-message`** (Client calls this after Gemini responds)
    *   Request Body: `{ "text_content": "string", "timestamp": "ISO_string_client_timestamp", "is_error": boolean (optional), "parsed_action": AiActionObject (optional from client parsing) }`
    *   Response (201 Created): `{ "ai_message": ChatMessageObject }`
    *   Logic: Stores the AI's message. If `parsed_action` is provided, it's stored.
*   **`GET /projects/{projectId}/chat/messages`** (Paginated)
    *   Query Params: `?limit=50&before_timestamp=ISO_string`
    *   Response (200 OK): `{ "messages": [ChatMessageObject] }`
*   **`POST /projects/{projectId}/chat/reset`**
    *   Response (200 OK): `{ "message": "Chat history for this project has been cleared." }`
    *   Logic: Deletes/archives chat messages for the project. Resets Gemini context on client.

### 3.7. History (Undo/Redo) Endpoints

*   **`POST /projects/{projectId}/history/undo`**
    *   Response (200 OK): `{ "restored_state": { "nodes": [NodeObject], "edges": [EdgeObject], "selected_node_ids": [], "selected_edge_id": null }, "new_history_index": number }`
    *   Response (404 Not Found): If no previous state.
    *   Logic: Retrieves the previous history snapshot, updates the current project nodes/edges to this state, and returns it.
*   **`POST /projects/{projectId}/history/redo`**
    *   Response (200 OK): `{ "restored_state": { ... }, "new_history_index": number }`
    *   Response (404 Not Found): If no next state.
    *   Logic: Retrieves the next history snapshot.

    _Client interaction for Undo/Redo:_
    1. Client calls `/undo` or `/redo`.
    2. Backend provides the full canvas state for that history point.
    3. Client updates its local `nodes`, `edges`, `selectedNodeIds`, `selectedEdgeId` with the response.
    4. Client also updates its `historyIndex` based on `new_history_index`.

### 3.8. Export Endpoints

*   **`GET /projects/{projectId}/export/markdown`**
    *   Response (200 OK): `text/markdown` content
    *   Logic: Generates markdown based on project nodes and edges.

## 4. AI Interaction Logic (Backend Support)

*   **Gemini API Key:** Store securely on the backend (environment variable), NOT exposed to the client if backend proxies calls.
    *   _Current app structure implies client-side Gemini calls. If this remains, backend only stores messages._
*   **Chat Context Management:** If backend proxies, it would fetch relevant `ChatMessages` history for the current project/session to send to Gemini.
*   **AI Action Parsing:**
    *   The client currently parses `AiAction` JSON.
    *   If AI calls were proxied, the backend could parse this JSON from Gemini's response.
    *   If an action is parsed (e.g., `CREATE_NODE`), the backend would:
        1.  Execute the database operations (create node, link edges).
        2.  Potentially create new `ProjectHistory` snapshot after the action.
        3.  Send a confirmation message back to the client (e.g., "Node 'X' created.").
    *   The `ChatMessages.ai_action_parsed` field can store the structured action that the AI intended, for audit or re-processing.

## 5. Authorization Logic Details

*   A middleware for routes like `/projects/{projectId}/*` will:
    1.  Verify JWT.
    2.  Fetch the project by `projectId`.
    3.  Check if `req.user.id` is `project.owner_user_id` OR if `req.user.id` is in `ProjectMembers` with an appropriate role for the requested action (e.g., 'editor' for PUT/POST/DELETE, 'viewer' for GET).
    4.  If not authorized, return 403 Forbidden.

## 6. Key Considerations & Future Work

*   **Scalability:** For very large projects or many users, consider database optimizations, caching (e.g., Redis).
*   **Real-time Collaboration:** If needed, WebSockets (e.g., Socket.IO) would be integrated for broadcasting canvas changes. This significantly increases complexity (CRDTs or OT might be needed).
*   **File Storage:** If nodes could have attachments, integrate with a cloud storage service (S3, Firebase Storage).
*   **Advanced Search/Filtering:** Implement dedicated search capabilities for nodes.
*   **API Versioning:** The `/v1/` prefix is a good start.
*   **Testing:** Comprehensive unit, integration, and end-to-end tests.
*   **Deployment:** Docker, CI/CD pipelines.

This plan should provide a solid foundation for developing the CogniCraft backend.