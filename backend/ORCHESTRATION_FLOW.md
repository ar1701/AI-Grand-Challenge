# Orchestration System Flow

## Overview

The orchestration system implements a hierarchical multi-agent architecture where:
1. **Orchestrator Agent** coordinates the overall task
2. **Sub-Agents** execute specialized subtasks independently
3. **Tools** provide capabilities to both agent types
4. **Agent Manager** handles async execution and lifecycle

## Complete Execution Flow

### Phase 1: Orchestrator Initialization

```
User Request
    ↓
POST /orchestrate
    ↓
OrchestratorAgent.execute(goal, projectPath)
    ↓
Initialize system prompt (orch_agent_prompt.txt)
    ↓
Build full prompt with project context
```

### Phase 2: Orchestrator Tool Calling Loop

The orchestrator enters a continuous loop that:

#### For OpenAI (gpt-4o):
```
while (iterations < maxIterations):
    ↓
Generate response with function calling
    ↓
Check for tool_calls in response
    ↓
If tool_calls exist:
    │
    ├─→ For each tool_call:
    │   ├─→ Execute tool via executeTool()
    │   ├─→ Get result synchronously
    │   ├─→ Add tool result to messages
    │   └─→ Track spawned agents if spawn_agent
    │
    ├─→ Continue to next iteration
    └─→ Generate next response with updated context
    
If no tool_calls:
    ↓
Return final text response
    ↓
Exit loop
```

#### For Gemini (gemini-2.0-flash-exp):
```
Recursive processResponse():
    ↓
Check response for functionCall parts
    ↓
If functionCalls exist:
    │
    ├─→ For each functionCall:
    │   ├─→ Validate parameters
    │   ├─→ Execute tool via executeTool()
    │   ├─→ Get result synchronously
    │   ├─→ Track spawned agents if spawn_agent
    │   └─→ Add functionResponse to history
    │
    ├─→ Check iteration limit
    ├─→ Generate next response
    └─→ Recursively call processResponse()
    
If no functionCalls:
    ↓
Return text response
    ↓
Exit recursion
```

### Phase 3: spawn_agent Tool Execution

When the orchestrator calls `spawn_agent`:

```
executeTool('spawn_agent', { purpose, context })
    ↓
executeSpawnAgent()
    ↓
├─→ Create agentId (agent_0, agent_1, ...)
├─→ Create AgentState in activeAgents map
├─→ Call agentManager.spawnAgent() [NON-BLOCKING]
└─→ Return immediately with agent info
    ↓
Orchestrator continues without waiting
```

### Phase 4: Sub-Agent Async Execution

The AgentManager executes sub-agents independently:

```
agentManager.spawnAgent(agentId, purpose, context)
    ↓
Add to executionQueue
    ↓
Start processQueue() [non-blocking async]
    ↓
For each queued task:
    ↓
createAndExecuteSubAgent(agentId, purpose, context)
    ↓
new SubAgent(agentId, purpose, context)
    ↓
subAgent.execute()
    ↓
├─→ Initialize with orch_subagent_prompt.txt
├─→ Customize prompt with agent's purpose
└─→ Enter tool calling loop (same as orchestrator)
    ↓
Execute tools independently:
    ├─→ dependency_graph
    ├─→ file_read
    ├─→ file_write
    ├─→ get_diffs
    ├─→ web_search
    └─→ apply_patch
    (NO spawn_agent - prevents recursion)
    ↓
Update AgentState:
    ├─→ status: 'running'
    ├─→ Record tool calls
    ├─→ Track execution time
    └─→ status: 'completed' or 'failed'
    ↓
Return result to AgentManager
```

### Phase 5: Parallel Execution

```
Orchestrator Thread:
    ├─→ Calls dependency_graph
    ├─→ Spawns agent_0
    ├─→ Spawns agent_1
    ├─→ Calls web_search
    ├─→ Analyzes results
    └─→ Completes

Background Thread (AgentManager):
    ├─→ agent_0 executes
    │   ├─→ file_read
    │   ├─→ get_diffs
    │   └─→ Returns result
    │
    └─→ agent_1 executes
        ├─→ file_read
        ├─→ apply_patch
        └─→ Returns result
```

## Key Design Principles

### 1. Non-Blocking Spawn
```javascript
// ❌ WRONG - Would block orchestrator
await agentManager.spawnAgent(agentId, purpose, context);
await waitForAgent(agentId);

// ✅ CORRECT - Orchestrator continues immediately
agentManager.spawnAgent(agentId, purpose, context);
// Orchestrator continues with other tools/tasks
```

### 2. Continuous Tool Calling
Both orchestrator and sub-agents continue calling tools until:
- No more tool calls in response
- Maximum iterations reached (10-15)
- Error occurs

### 3. Tool Execution Synchronicity
```javascript
// Tools execute synchronously within their agent
const result = await executeTool(toolName, params);
// Agent waits for tool result before continuing

// But agents themselves run asynchronously
agentManager.spawnAgent(...); // Returns immediately
// Sub-agent executes in background
```

### 4. State Tracking
```javascript
AgentState:
  - status: 'initializing' → 'running' → 'completed' | 'failed'
  - createdAt, startedAt, completedAt
  - toolCallHistory[]
  - result or error
```

## Tool Call Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Orchestrator Agent                       │
│                                                               │
│  [System Prompt] + [User Goal] + [Project Context]          │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
         ┌────────────────────┐
         │  Generate Response  │
         └────────┬───────────┘
                  │
         ┌────────▼────────┐
         │  Has Tool Calls? │
         └────────┬────────┘
                  │
        ┌─────────┴─────────┐
        │                   │
       YES                 NO
        │                   │
        ▼                   ▼
┌───────────────┐    ┌──────────────┐
│ Execute Tools │    │ Return Final │
│  Sequentially │    │   Response   │
└───────┬───────┘    └──────────────┘
        │
        ├─→ dependency_graph() → returns structure
        │
        ├─→ spawn_agent(purpose) → creates agent_0
        │   │
        │   └─→ [Background] agent_0 starts executing
        │       └─→ file_read() → gets data
        │       └─→ apply_patch() → makes changes
        │       └─→ completes with result
        │
        ├─→ file_read() → returns content
        │
        ├─→ web_search() → returns findings
        │
        └─→ Continue to next iteration
            └─→ Generate next response with tool results
                └─→ May call more tools or finish
```

## Sub-Agent Independent Execution

```
┌─────────────────────────────────────────────────────────────┐
│                      AgentManager                            │
│                                                               │
│  executionQueue: [agent_0, agent_1, ...]                    │
│  isProcessing: boolean                                       │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
         ┌────────────────────┐
         │   processQueue()    │
         │   (async loop)      │
         └────────┬───────────┘
                  │
     ┌────────────┴────────────┐
     │                         │
     ▼                         ▼
┌─────────────┐         ┌─────────────┐
│   agent_0   │         │   agent_1   │
│             │         │             │
│ Execute     │         │ Execute     │
│ ↓           │         │ ↓           │
│ Call Tools  │         │ Call Tools  │
│ ↓           │         │ ↓           │
│ Return      │         │ Return      │
└─────────────┘         └─────────────┘
```

## Example Execution Timeline

```
Time  Orchestrator                     Background (AgentManager)
----  -------------------------------  ---------------------------
0ms   Start execute()
      Load system prompt
      
10ms  Call dependency_graph
      
50ms  Get dependency results
      Decide to spawn agents
      
60ms  Call spawn_agent(agent_0)       → agent_0 queued
      Returns immediately                
      
65ms  Call spawn_agent(agent_1)       → agent_1 queued
      Returns immediately                processQueue() starts
      
70ms  Call web_search                  → agent_0 executing
                                          ├─ file_read
                                       
120ms Get web_search results           → agent_0 still running
      Continue analysis
      
150ms Generate summary                 → agent_0 completes
                                       → agent_1 starts
                                          ├─ file_read
      
200ms Orchestrator completes           → agent_1 running
      Returns response                    ├─ apply_patch
      
280ms                                  → agent_1 completes
                                       → All agents done
```

## Checking Agent Status

Users can monitor agent execution:

```javascript
// Get all agents
GET /agents
→ Returns list with status, execution time, tool call count

// Get specific agent
GET /agents/agent_0
→ Returns detailed state

// Get agent result (if completed)
GET /agents/agent_0/result
→ Returns final result from agent

// Get agent tool history
GET /agents/agent_0/history
→ Returns all tools called by agent
```

## Error Handling

### Orchestrator Errors
- Caught and returned in response
- Execution stops
- Spawned agents continue independently

### Sub-Agent Errors
- Caught and stored in AgentState
- Status set to 'failed'
- Other agents continue
- Error accessible via GET /agents/:agentId

## Important Notes

1. **Orchestrator never waits for sub-agents** - It completes its own execution and returns
2. **Sub-agents execute completely independently** - They can outlive the orchestrator response
3. **Tool calls are synchronous within each agent** - Agent waits for tool result before continuing
4. **Agents spawn asynchronously** - spawn_agent returns immediately, actual execution happens in background
5. **No recursive spawning** - Sub-agents cannot spawn other sub-agents (prevented by tool list)
6. **Iteration limits prevent infinite loops** - Both OpenAI and Gemini paths have max iterations
7. **State is tracked globally** - activeAgents Map persists across all executions

## Testing

Run the flow test:
```bash
node test-orchestration-flow.js
```

This test verifies:
- ✅ Orchestrator receives task and initializes
- ✅ Orchestrator calls tools successfully
- ✅ Orchestrator spawns sub-agents
- ✅ Sub-agents execute independently
- ✅ Sub-agents call their own tools
- ✅ All agents complete with results
- ✅ State tracking works correctly
- ✅ No blocking between orchestrator and sub-agents
