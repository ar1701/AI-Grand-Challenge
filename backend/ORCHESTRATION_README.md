# AI Grand Challenge - Orchestration System

## Overview

The backend has been refactored to implement a **hierarchical multi-agent orchestration system** using Gemini AI. The system consists of an orchestrator agent that coordinates specialized sub-agents to perform complex code analysis, dependency tracking, and automated patching tasks.

## Architecture

```
┌─────────────────────────────────────────┐
│      Orchestrator Agent (Gemini)        │
│  - Coordinates all tasks                │
│  - Spawns sub-agents dynamically        │
│  - Has access to all tools              │
└────────────┬────────────────────────────┘
             │
             │ spawns
             ▼
┌────────────────────────────────────────┐
│   Sub-Agents (agent_0 ... agent_n)     │
│  - Specialized focused tasks           │
│  - Same tools except spawn_agent       │
│  - Report back to orchestrator         │
└────────────────────────────────────────┘
```

## Tools Available

The system provides 7 core tools that agents can use:

### 1. **dependency_graph()**
- Creates a complete dependency graph of the project
- Analyzes import/require statements and module relationships
- Returns nodes and edges representing file dependencies

### 2. **spawn_agent(purpose, context)**
- Dynamically spawns specialized sub-agents (agent_0, agent_1, ..., agent_n)
- Each agent receives a specific purpose and context
- **Only available to the orchestrator** (prevents recursive spawning)

### 3. **file_read(filePath)**
- Reads the contents of a specific file
- Returns file content, size, and line count

### 4. **get_diffs(projectPath, staged, files)**
- Retrieves Git changes since the last checkpoint
- Returns unstaged, staged, and untracked changes
- Includes commit history and branch information

### 5. **web_search(query, context)**
- Performs external research using Google Search grounding
- Used for vulnerability validation, OWASP checks, best practices
- Returns grounded answers with citations and sources

### 6. **apply_patch(filePath, patches)**
- Applies structured patches to existing code
- **Never rewrites entire files** - only minimal diffs
- Creates automatic backups before modifying files
- Returns diff preview of changes

### 7. **file_write(filePath, content)**
- Creates new files or writes to non-existent files
- **Should NOT be used** to overwrite existing scripts
- Use `apply_patch` for modifications

## API Endpoints

### Main Orchestration Endpoint

#### `POST /orchestrate`
Execute a task using the orchestration system.

**Request Body:**
```json
{
  "goal": "Your task description here",
  "projectPath": "/absolute/path/to/project",
  "customPrompt": "Optional custom instructions"
}
```

**Response:**
```json
{
  "success": true,
  "result": {
    "type": "completion",
    "message": "Task completion summary"
  },
  "spawnedAgents": [
    {
      "agentId": "agent_0",
      "purpose": "Analyze authentication logic",
      "spawnedAt": "2024-12-12T10:30:00.000Z"
    }
  ],
  "conversationTurns": 5
}
```

### Agent Management Endpoints

#### `GET /agents`
Get summary of all agents.

**Response:**
```json
{
  "success": true,
  "summary": {
    "totalAgents": 3,
    "queuedTasks": 0,
    "byStatus": {
      "initializing": 0,
      "running": 1,
      "completed": 2,
      "failed": 0
    },
    "totalToolCalls": 15,
    "averageExecutionTime": 5243
  },
  "isProcessing": false
}
```

#### `GET /agents/:agentId`
Get status of a specific agent.

#### `GET /agents/:agentId/result`
Get the result of a completed agent.

#### `GET /agents/:agentId/history`
Get tool call history of an agent.

#### `DELETE /agents/completed`
Clear all completed agents from memory.

#### `DELETE /agents`
Clear all agents and reset the system.

### Tool Testing Endpoint

#### `POST /tools/execute`
Directly execute a tool for testing.

**Request Body:**
```json
{
  "toolName": "dependency_graph",
  "params": {
    "projectPath": "/path/to/project"
  }
}
```

## Usage Examples

### Example 1: Analyze Project Structure

```bash
curl -X POST http://localhost:3000/orchestrate \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "Analyze the project structure and create a dependency graph",
    "projectPath": "/Users/ayushraj/Desktop/GitHub Desktop/AI-Grand-Challenge"
  }'
```

### Example 2: Find and Fix Security Vulnerabilities

```bash
curl -X POST http://localhost:3000/orchestrate \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "Scan the project for security vulnerabilities, research best practices, and generate patches to fix them",
    "projectPath": "/Users/ayushraj/Desktop/GitHub Desktop/AI-Grand-Challenge"
  }'
```

### Example 3: Analyze Git Changes

```bash
curl -X POST http://localhost:3000/orchestrate \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "Review the recent git changes and provide a summary of what was modified",
    "projectPath": "/Users/ayushraj/Desktop/GitHub Desktop/AI-Grand-Challenge"
  }'
```

### Example 4: Direct Tool Execution

```bash
# Execute dependency graph tool
curl -X POST http://localhost:3000/tools/execute \
  -H "Content-Type: application/json" \
  -d '{
    "toolName": "dependency_graph",
    "params": {
      "projectPath": "/Users/ayushraj/Desktop/GitHub Desktop/AI-Grand-Challenge"
    }
  }'

# Execute web search tool
curl -X POST http://localhost:3000/tools/execute \
  -H "Content-Type: application/json" \
  -d '{
    "toolName": "web_search",
    "params": {
      "query": "SQL injection prevention in Node.js Express applications",
      "context": "Researching security best practices"
    }
  }'
```

## System Prompts

The orchestration system uses two specialized prompts:

### 1. **Orchestrator Agent Prompt** (`prompts/orch_agent_prompt.txt`)
- Defines the orchestrator's persona as a hierarchical multi-agent controller
- Describes global capabilities and tool usage rules
- Emphasizes methodical, precise, and safe operations
- Focuses on minimal code disruption and explicit structured patches

### 2. **Sub-Agent Prompt** (`prompts/orch_subagent_prompt.txt`)
- Defines sub-agents as specialized focused workers
- Emphasizes precision, minimalism, and safety
- Must follow the exact purpose given by orchestrator
- Cannot spawn other agents

## Implementation Details

### Function Calling
The system uses Gemini's function calling feature to enable tool use:
- Tools are declared with JSON schemas
- Gemini decides when to call tools based on context
- Responses are processed and fed back into conversation
- Multi-turn conversations support complex workflows

### Structured Output
For patch generation, the system uses structured output with Pydantic-style schemas:
- Ensures consistent patch format
- Validates before and after code blocks
- Includes descriptions and reasoning
- Type-safe and parseable results

### Web Search Grounding
Uses Google Search grounding for real-time information:
- Automatically grounds responses in web content
- Provides citations and sources
- Used for vulnerability research and best practices
- Returns structured metadata with URLs and titles

## File Structure

```
backend/
├── agents/
│   ├── index.js                 # Agents module exports
│   ├── orchestrator.js          # Main orchestrator agent
│   ├── subagent.js              # Sub-agent implementation
│   └── agentManager.js          # Agent lifecycle management
├── tools/
│   ├── index.js                 # Tools registry and executor
│   ├── dependency_graph.js      # Dependency analysis tool
│   ├── spawn_agent.js           # Agent spawning tool
│   ├── file_operations.js       # File read/write tools
│   ├── git_operations.js        # Git diff and history tools
│   ├── web_search.js            # Web search with grounding
│   └── apply_patch.js           # Code patching tool
├── prompts/
│   ├── orch_agent_prompt.txt    # Orchestrator system prompt
│   └── orch_subagent_prompt.txt # Sub-agent system prompt
├── docs/
│   ├── tool_call.txt            # Function calling documentation
│   ├── structured_output.txt    # Structured output guide
│   └── gemini_web_search.txt    # Web search grounding guide
├── utils/
│   ├── codeAnalysis.js          # Original code analysis
│   ├── openaiAnalysis.js        # OpenAI analysis
│   ├── prompt.js                # Analysis prompts
│   ├── redisClient.js           # Redis caching
│   ├── response.js              # Response schemas
│   └── tokenManager.js          # Token counting
└── app.js                        # Express server with all endpoints
```

## Environment Variables

Make sure these are set in your `.env` file:

```env
PORT=3000
GEMINI_API_KEY=your_gemini_api_key_here
ANALYSIS_ENGINE=gemini
```

## Running the Server

```bash
# Install dependencies
pnpm install

# Start the server
nodemon app.js

# Or use the terminal
npm start
```

The server will start on `http://localhost:3000`

## Key Features

✅ **Hierarchical Multi-Agent System** - Orchestrator spawns specialized sub-agents  
✅ **7 Powerful Tools** - Dependency analysis, Git diffs, web search, patching, etc.  
✅ **Function Calling** - Gemini intelligently decides when to use tools  
✅ **Structured Output** - Type-safe patch generation with schemas  
✅ **Web Search Grounding** - Real-time information with citations  
✅ **Agent Lifecycle Management** - Track, monitor, and manage all agents  
✅ **No File Overwrites** - Safe patching with backups  
✅ **Redis Caching** - Efficient caching for repeated analyses  

## Safety Features

- **Automatic Backups**: Every patch creates a timestamped backup
- **Exact Matching**: Patches require exact old code matches to prevent errors
- **No Overwrites**: `file_write` refuses to overwrite existing large files
- **Minimal Changes**: All tools emphasize minimal, targeted modifications
- **Agent Isolation**: Sub-agents cannot spawn other agents (prevents recursion)

## Future Enhancements

- [ ] Add support for parallel sub-agent execution
- [ ] Implement agent result merging strategies
- [ ] Add rollback functionality for patches
- [ ] Enhance web search with domain-specific filtering
- [ ] Add support for custom tool plugins
- [ ] Implement conversational checkpoints

## Troubleshooting

### Agent not spawning
- Check that the orchestrator has access to `spawn_agent` tool
- Verify the purpose string is clear and specific

### Patch application fails
- Ensure old code matches exactly (including whitespace)
- Add more context lines to make the match unique
- Check file permissions

### Web search not working
- Verify GEMINI_API_KEY is set correctly
- Check internet connectivity
- Ensure the Gemini model supports grounding

## License

This project is part of the AI Grand Challenge.
