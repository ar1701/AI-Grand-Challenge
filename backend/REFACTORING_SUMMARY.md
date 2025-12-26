# Backend Refactoring Summary

## What Was Changed

The backend has been completely refactored to implement a hierarchical multi-agent orchestration system as specified in the diagram and requirements.

## New Structure

### 1. **Tools Module** (`backend/tools/`)

Created 7 specialized tools that agents can use:

| Tool | File | Purpose |
|------|------|---------|
| `dependency_graph()` | `dependency_graph.js` | Creates complete project dependency graph |
| `spawn_agent()` | `spawn_agent.js` | Dynamically spawns specialized sub-agents |
| `file_read()` | `file_operations.js` | Reads file contents |
| `file_write()` | `file_operations.js` | Creates new files (never overwrites) |
| `get_diffs()` | `git_operations.js` | Retrieves Git changes and history |
| `web_search()` | `web_search.js` | Searches web with Google grounding |
| `apply_patch()` | `apply_patch.js` | Applies minimal code patches |

**Tool Registry** (`tools/index.js`):
- Central registry of all tools
- Separate tool lists for orchestrator (all tools) and sub-agents (no spawn_agent)
- Tool execution dispatcher
- Parameter validation

### 2. **Agents Module** (`backend/agents/`)

#### **Orchestrator Agent** (`orchestrator.js`)
- Main hierarchical controller
- Uses `prompts/orch_agent_prompt.txt`
- Has access to ALL tools including `spawn_agent`
- Coordinates sub-agents
- Manages conversation flow with function calling
- Generates structured patches

**Key Methods:**
- `initialize()` - Loads system prompt
- `execute(userPrompt, projectPath)` - Main execution
- `processResponse()` - Handles tool calls recursively
- `handleToolCalls()` - Executes tools and updates conversation
- `generatePatches()` - Creates structured patches using schemas

#### **Sub-Agent** (`subagent.js`)
- Specialized focused workers
- Uses `prompts/orch_subagent_prompt.txt`
- Has access to all tools EXCEPT `spawn_agent`
- Reports back to orchestrator
- Each named `agent_0`, `agent_1`, etc.

**Key Methods:**
- `initialize()` - Loads system prompt with specific purpose
- `execute()` - Executes assigned task
- `processResponse()` - Handles multi-turn tool calling
- `getSummary()` - Returns execution summary

#### **Agent Manager** (`agentManager.js`)
- Centralized agent lifecycle management
- Tracks all spawned agents (agent_0 to agent_n)
- Execution queue for agents
- State monitoring and reporting

**Key Methods:**
- `spawnAgent()` - Queue new agent for execution
- `processQueue()` - Execute agents sequentially
- `waitForAgent()` - Wait for specific agent completion
- `getSummary()` - Get comprehensive status
- `clearCompleted()` - Clean up memory

### 3. **API Endpoints** (updated `app.js`)

#### New Orchestration Endpoints:

```
POST   /orchestrate              - Main orchestration endpoint
GET    /agents                   - Get all agents summary
GET    /agents/:agentId          - Get specific agent status
GET    /agents/:agentId/result   - Get agent result
GET    /agents/:agentId/history  - Get agent tool history
POST   /tools/execute            - Direct tool execution
DELETE /agents/completed         - Clear completed agents
DELETE /agents                   - Clear all agents
```

#### Existing Endpoints (preserved):
```
POST   /analyze-multiple-files   - Original analysis endpoint
POST   /code-block               - Single code block analysis
GET    /                         - Health check
```

### 4. **Implementation Details**

#### **Function Calling** (from `docs/tool_call.txt`)
- Tools declared with JSON schemas compatible with Gemini
- Model decides when to call tools
- Multi-turn conversation with function responses
- Automatic tool result integration

#### **Structured Output** (from `docs/structured_output.txt`)
- Patch generation uses Pydantic-style schemas
- Ensures type-safe, parseable results
- Schema for patches includes filePath, reason, changes[]
- Each change has oldCode, newCode, description

#### **Web Search Grounding** (from `docs/gemini_web_search.txt`)
- Uses Google Search tool for real-time information
- Returns grounded answers with citations
- Extracts sources with URLs and titles
- Used for vulnerability research and best practices

### 5. **System Prompts**

Both prompts from `backend/prompts/` are integrated:

- **`orch_agent_prompt.txt`**: Defines orchestrator persona, capabilities, tool rules, and operating principles
- **`orch_subagent_prompt.txt`**: Defines sub-agent behavior, constraints, and focus

### 6. **Documentation**

Created comprehensive documentation:

- **`ORCHESTRATION_README.md`**: Complete system documentation
- **`QUICKSTART.md`**: Quick start guide
- **`examples/orchestration_examples.js`**: 9 example usage scenarios
- **`REFACTORING_SUMMARY.md`**: This document

### 7. **Package Updates**

Updated `package.json`:
- Added `start` script: `nodemon app.js`
- Added `examples` script: `node examples/orchestration_examples.js`

## Architecture Flow

```
┌─────────────────────────────────────────────────────┐
│  User Request (via /orchestrate endpoint)           │
│  - goal: "What to accomplish"                       │
│  - projectPath: "/path/to/project"                  │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│  Orchestrator Agent (Gemini)                        │
│  - Loads orch_agent_prompt.txt                      │
│  - Has access to ALL 7 tools                        │
│  - Analyzes goal and plans approach                 │
└────────────────────┬────────────────────────────────┘
                     │
                     ├─── Tool: dependency_graph() ───►
                     │
                     ├─── Tool: spawn_agent() ────────►
                     │        │
                     │        ├─── agent_0 (specialized task 1)
                     │        ├─── agent_1 (specialized task 2)
                     │        └─── agent_n (specialized task n)
                     │                │
                     │                ├─── file_read()
                     │                ├─── get_diffs()
                     │                ├─── web_search()
                     │                └─── apply_patch()
                     │
                     ├─── Tool: web_search() ─────────►
                     │
                     └─── Tool: apply_patch() ────────►
                              │
                              ▼
┌─────────────────────────────────────────────────────┐
│  Response with results and agent summary            │
└─────────────────────────────────────────────────────┘
```

## Key Features Implemented

✅ **Hierarchical Multi-Agent System**
- Orchestrator coordinates everything
- Sub-agents handle specialized tasks
- Agent manager tracks all agents

✅ **7 Specialized Tools**
- Each tool has proper function declaration
- Parameter validation
- Centralized execution dispatcher

✅ **Function Calling Integration**
- Gemini intelligently calls tools
- Multi-turn conversations
- Automatic result integration

✅ **Structured Output**
- Type-safe patch generation
- Schema-based responses
- Consistent format

✅ **Web Search Grounding**
- Real-time information
- Citations and sources
- Security research capability

✅ **Agent Lifecycle Management**
- State tracking (initializing, running, completed, failed)
- Execution queue
- Tool call history
- Performance metrics

✅ **Safety Features**
- No file overwrites (backups created)
- Exact matching for patches
- Minimal change philosophy
- Agent spawn prevention (no recursion)

## Files Added

```
backend/
├── agents/
│   ├── index.js                      ✨ NEW
│   ├── orchestrator.js               ✨ NEW
│   ├── subagent.js                   ✨ NEW
│   └── agentManager.js               ✨ NEW
├── tools/
│   ├── index.js                      ✨ NEW
│   ├── dependency_graph.js           ✨ NEW
│   ├── spawn_agent.js                ✨ NEW
│   ├── file_operations.js            ✨ NEW
│   ├── git_operations.js             ✨ NEW
│   ├── web_search.js                 ✨ NEW
│   └── apply_patch.js                ✨ NEW
├── examples/
│   └── orchestration_examples.js     ✨ NEW
├── ORCHESTRATION_README.md           ✨ NEW
├── QUICKSTART.md                     ✨ NEW
├── REFACTORING_SUMMARY.md            ✨ NEW
├── app.js                            🔧 MODIFIED
└── package.json                      🔧 MODIFIED
```

## Files Preserved

All original functionality is preserved:
- `utils/codeAnalysis.js` - Original Gemini analysis
- `utils/openaiAnalysis.js` - OpenAI analysis
- `utils/prompt.js` - Analysis prompts
- `utils/redisClient.js` - Redis caching
- `utils/response.js` - Response schemas
- `utils/tokenManager.js` - Token management
- Original endpoints: `/analyze-multiple-files`, `/code-block`

## How to Use

### 1. Start Server
```bash
cd backend
pnpm install
pnpm start
```

### 2. Test Orchestration
```bash
curl -X POST http://localhost:3000/orchestrate \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "Analyze the project and create dependency graph",
    "projectPath": "/Users/ayushraj/Desktop/GitHub Desktop/AI-Grand-Challenge"
  }'
```

### 3. Run Examples
```bash
pnpm run examples
```

### 4. Monitor Agents
```bash
curl http://localhost:3000/agents
```

## Testing the System

The system can be tested through:

1. **Direct Tool Testing**: Use `/tools/execute` to test individual tools
2. **Simple Tasks**: Use `/orchestrate` with simple goals
3. **Complex Tasks**: Use `/orchestrate` with multi-step goals that require agent spawning
4. **Example Suite**: Run `pnpm run examples` to see all capabilities

## Next Steps

The system is now ready for:
- Complex code analysis tasks
- Security vulnerability scanning
- Automated patch generation
- Multi-agent parallel processing
- Real-time web research integration

## Compatibility

- ✅ Backwards compatible with existing endpoints
- ✅ Existing code analysis features still work
- ✅ Redis caching preserved
- ✅ Token management preserved
- ✅ All original utilities intact

The refactoring adds new capabilities while maintaining full backward compatibility with the existing API.
