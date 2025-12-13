# Orchestration System - Quick Reference

## How It Works Now

### 1. Orchestrator Execution
The orchestrator runs continuously, calling tools until complete:
```javascript
const orchestrator = new OrchestratorAgent();
const result = await orchestrator.execute(goal, projectPath);
// Returns when orchestrator finishes (sub-agents may still be running)
```

### 2. Tool Calling Loop
Both orchestrator and sub-agents automatically continue calling tools:
- ✅ Call tool → Get result → Continue with next response
- ✅ Repeats until no more tool calls or max iterations
- ✅ OpenAI: max 10 iterations
- ✅ Gemini: max 15 iterations

### 3. Spawning Sub-Agents
When orchestrator calls `spawn_agent`:
```javascript
// Tool call triggers:
spawn_agent({ purpose: "Analyze authentication", context: {...} })
    ↓
// Agent created and queued immediately
agent_0 created → queued in AgentManager
    ↓
// Orchestrator continues (doesn't wait)
orchestrator continues calling other tools
    ↓
// Background: agent_0 executes independently
[Background] agent_0 → calls file_read, get_diffs, etc. → completes
```

## API Endpoints

### Start Orchestration
```bash
POST /orchestrate
{
  "goal": "Your task description",
  "projectPath": "/path/to/project"
}

# Or pass a text file as goal
{
  "goal": "/path/to/prompt.txt",
  "projectPath": "/path/to/project"
}
```

### Monitor Agents
```bash
# Get all agents status
GET /agents

# Get specific agent state
GET /agents/agent_0

# Get agent result (if completed)
GET /agents/agent_0/result

# Get agent tool call history
GET /agents/agent_0/history
```

### Direct Tool Execution
```bash
POST /tools/execute
{
  "tool": "dependency_graph",
  "params": { "projectPath": "/path/to/project" }
}
```

### Cleanup
```bash
# Clear completed agents
DELETE /agents/completed

# Clear all agents
DELETE /agents
```

## Testing

```bash
# Run full orchestration flow test
npm run test:flow

# Run OpenAI specific test
node test-openai-orchestration.js

# Run examples
npm run examples
```

## Key Features

### ✅ Continuous Tool Execution
- Orchestrator and sub-agents keep calling tools until task complete
- No manual intervention needed
- Automatic iteration management

### ✅ Non-Blocking Sub-Agents
- Sub-agents execute in background
- Orchestrator doesn't wait
- Multiple agents can work in parallel

### ✅ Tool Access Control
- Orchestrator: Has all 7 tools (including spawn_agent)
- Sub-agents: Have 6 tools (no spawn_agent, prevents recursion)

### ✅ State Tracking
- All agent states tracked in memory
- Accessible via API endpoints
- Includes execution time, tool calls, results

### ✅ Safety Mechanisms
- Iteration limits prevent infinite loops
- Error handling and recovery
- Validation on all tool parameters

## Available Tools

### For Orchestrator (7 tools):
1. `dependency_graph` - Analyze project structure
2. `spawn_agent` - Create specialized sub-agents
3. `file_read` - Read file contents
4. `file_write` - Create new files
5. `get_diffs` - Get git changes
6. `web_search` - Search the web
7. `apply_patch` - Apply code patches

### For Sub-Agents (6 tools):
Same as above, except NO `spawn_agent`

## Engine Support

### OpenAI (gpt-4o)
```bash
ANALYSIS_ENGINE=openai
OPENAI_API_KEY=your_key
```

### Gemini (gemini-2.0-flash-exp)
```bash
ANALYSIS_ENGINE=gemini
GEMINI_API_KEY=your_key
```

Both engines fully supported with identical functionality.

## Example Usage

### Simple Task (No Sub-Agents)
```javascript
POST /orchestrate
{
  "goal": "Analyze the git changes in this project",
  "projectPath": "/path/to/project"
}

// Orchestrator:
// 1. Calls get_diffs
// 2. Analyzes changes
// 3. Returns summary
// No sub-agents needed
```

### Complex Task (With Sub-Agents)
```javascript
POST /orchestrate
{
  "goal": "Refactor the authentication system. Analyze current implementation, identify issues, and generate patches.",
  "projectPath": "/path/to/project"
}

// Orchestrator:
// 1. Calls dependency_graph
// 2. Spawns agent_0: "Analyze auth implementation"
// 3. Spawns agent_1: "Identify security issues"
// 4. Calls web_search for best practices
// 5. Compiles results
// 6. Returns summary

// Background:
// agent_0: file_read auth files → analyzes → returns findings
// agent_1: file_read config → checks security → returns issues
```

## Monitoring Agent Progress

```bash
# While orchestrator is running or after it completes,
# check sub-agent status:

curl http://localhost:8080/agents

# Response shows:
{
  "count": 2,
  "agents": [
    {
      "agentId": "agent_0",
      "purpose": "Analyze auth implementation",
      "status": "running",  // or "completed", "failed"
      "executionTime": 1234,
      "toolCallCount": 3
    },
    {
      "agentId": "agent_1",
      "purpose": "Identify security issues",
      "status": "completed",
      "executionTime": 2345,
      "toolCallCount": 5
    }
  ]
}
```

## Common Patterns

### Pattern 1: Parallel Analysis
```
Goal: "Analyze multiple modules in parallel"
→ Orchestrator spawns one agent per module
→ Each agent analyzes independently
→ Orchestrator compiles results
```

### Pattern 2: Sequential Refinement
```
Goal: "Analyze → Generate patches → Apply fixes"
→ Orchestrator calls dependency_graph
→ Orchestrator analyzes structure
→ Orchestrator spawns agent to generate patches
→ Agent uses file_read and apply_patch
→ Orchestrator verifies results
```

### Pattern 3: Research + Implementation
```
Goal: "Research best practices and implement"
→ Orchestrator calls web_search
→ Orchestrator spawns agent to implement findings
→ Agent calls file_write to create new code
→ Orchestrator summarizes changes
```

## Troubleshooting

### Agents Not Executing?
- Check AgentManager connection initialized
- Verify setAgentManager called in constructor
- Check logs for spawn errors

### Infinite Loops?
- Check iteration counts in response
- Should hit max iterations (10-15)
- Review tool call logic in prompts

### Tools Not Working?
- Verify tool parameters match schema
- Check executeTool function mapping
- Review tool executor implementation

### Sub-Agents Can't Spawn?
- This is intentional - prevents recursion
- Only orchestrator can spawn agents

## Performance Tips

1. **Use spawn_agent for parallel work**
   - Independent tasks → separate agents
   - Dependent tasks → orchestrator handles

2. **Monitor iteration counts**
   - High iterations may indicate unclear prompts
   - Refine system prompts for efficiency

3. **Cleanup completed agents**
   - `DELETE /agents/completed` frees memory
   - Important for long-running servers

4. **Use appropriate tools**
   - file_read for inspection
   - apply_patch for modifications (not file_write)
   - web_search for external context

## Documentation

- `ORCHESTRATION_README.md` - Complete system overview
- `ORCHESTRATION_FLOW.md` - Detailed execution flow
- `ORCHESTRATION_FIX_SUMMARY.md` - Recent fixes explained
- `QUICKSTART.md` - Getting started guide
- `ARCHITECTURE.md` - System architecture
- `OPENAI_SUPPORT.md` - OpenAI integration details

## Server

Start the backend server:
```bash
npm start
# or
nodemon app.js

# Server runs on http://localhost:8080
```

## Status

✅ **System is production-ready!**

All components working:
- ✅ Orchestrator tool calling
- ✅ Sub-agent spawning and execution
- ✅ Independent tool usage by sub-agents
- ✅ Non-blocking architecture
- ✅ State tracking and monitoring
- ✅ Both OpenAI and Gemini support
- ✅ Comprehensive error handling
- ✅ Iteration limits and safety
