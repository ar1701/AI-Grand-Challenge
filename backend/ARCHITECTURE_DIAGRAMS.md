# Orchestration System Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Backend Server                           │
│                      (Express on port 8080)                      │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
        ┌──────────────────────────────────────────┐
        │         API Endpoints Layer              │
        │                                          │
        │  POST /orchestrate                       │
        │  GET  /agents                            │
        │  GET  /agents/:id                        │
        │  GET  /agents/:id/result                 │
        │  POST /tools/execute                     │
        │  DELETE /agents/completed                │
        └──────────────┬───────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────────────────┐
        │      OrchestratorAgent Instance          │
        │                                          │
        │  • System Prompt Loader                  │
        │  • Tool Calling Engine                   │
        │  • Iteration Management                  │
        │  • Agent Tracking                        │
        └──────────────┬───────────────────────────┘
                       │
         ┌─────────────┴─────────────┐
         │                           │
         ▼                           ▼
┌─────────────────┐         ┌─────────────────┐
│   OpenAI API    │         │   Gemini API    │
│   (gpt-4o)      │         │  (2.0-flash)    │
└─────────────────┘         └─────────────────┘
         │                           │
         └─────────────┬─────────────┘
                       │
                       ▼
        ┌──────────────────────────────────────────┐
        │           Tools Registry                  │
        │                                          │
        │  orchestratorTools (7 tools)             │
        │  ├─ dependency_graph                     │
        │  ├─ spawn_agent      ◄───────┐          │
        │  ├─ file_read                │          │
        │  ├─ file_write               │          │
        │  ├─ get_diffs                │          │
        │  ├─ web_search               │          │
        │  └─ apply_patch              │          │
        │                              │          │
        │  subagentTools (6 tools)     │          │
        │  ├─ dependency_graph         │          │
        │  ├─ file_read                │          │
        │  ├─ file_write               │          │
        │  ├─ get_diffs                │          │
        │  ├─ web_search               │          │
        │  └─ apply_patch              │          │
        └──────────────┬───────────────┘          │
                       │                           │
                       ▼                           │
        ┌──────────────────────────────┐          │
        │      executeTool()            │          │
        │   (Tool Dispatcher)           │          │
        └──────────────┬────────────────┘          │
                       │                           │
          ┌────────────┼────────────┐              │
          │            │            │              │
          ▼            ▼            ▼              │
    ┌─────────┐  ┌─────────┐  ┌─────────┐        │
    │ Tool 1  │  │ Tool 2  │  │ Tool 3  │        │
    │ Executor│  │ Executor│  │ Executor│        │
    └─────────┘  └─────────┘  └─────────┘        │
                                                   │
                       │                           │
                       │ (spawn_agent called)      │
                       ▼                           │
        ┌──────────────────────────────┐          │
        │   executeSpawnAgent()         │          │
        │                               │          │
        │  1. Create AgentState         │          │
        │  2. Add to activeAgents       │          │
        │  3. Notify AgentManager ──────┼──────────┘
        │  4. Return immediately        │
        └───────────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────────────────┐
        │         AgentManager (Singleton)          │
        │                                          │
        │  executionQueue: [                       │
        │    { agentId, purpose, context },        │
        │    { agentId, purpose, context }         │
        │  ]                                       │
        │                                          │
        │  processQueue() ─────────────────┐      │
        └──────────────────────────────────┼───────┘
                                           │
                    ┌──────────────────────┘
                    │
         ┌──────────┴──────────┐
         │                     │
         ▼                     ▼
┌─────────────────┐   ┌─────────────────┐
│   agent_0       │   │   agent_1       │
│   (SubAgent)    │   │   (SubAgent)    │
│                 │   │                 │
│  • Initialize   │   │  • Initialize   │
│  • Load Prompt  │   │  • Load Prompt  │
│  • Execute Task │   │  • Execute Task │
│  • Call Tools   │   │  • Call Tools   │
│  • Return Result│   │  • Return Result│
└─────────┬───────┘   └─────────┬───────┘
          │                     │
          ▼                     ▼
    ┌─────────────────────────────────┐
    │    activeAgents Map             │
    │                                 │
    │  agent_0 → AgentState           │
    │    ├─ status: 'completed'       │
    │    ├─ toolCallHistory: [...]    │
    │    └─ result: {...}             │
    │                                 │
    │  agent_1 → AgentState           │
    │    ├─ status: 'completed'       │
    │    ├─ toolCallHistory: [...]    │
    │    └─ result: {...}             │
    └─────────────────────────────────┘
```

## Execution Flow Diagram

```
┌───────────────────────────────────────────────────────────────┐
│                    User Request                               │
│                                                               │
│  POST /orchestrate                                            │
│  { goal: "Task", projectPath: "/path" }                      │
└─────────────────────────┬─────────────────────────────────────┘
                          │
                          ▼
         ┌────────────────────────────────────┐
         │   Create OrchestratorAgent         │
         │   Load orch_agent_prompt.txt       │
         └────────────────┬───────────────────┘
                          │
                          ▼
         ┌────────────────────────────────────┐
         │   Build Full Prompt                │
         │   • System Prompt                  │
         │   • User Goal                      │
         │   • Project Context                │
         └────────────────┬───────────────────┘
                          │
                          ▼
         ┌────────────────────────────────────┐
         │   Generate Response with Tools     │
         │   (OpenAI or Gemini API)           │
         └────────────────┬───────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │   Has Tool Calls?     │
              └───────┬───────────────┘
                      │
        ┌─────────────┴─────────────┐
        │                           │
       YES                         NO
        │                           │
        ▼                           ▼
┌───────────────────┐     ┌─────────────────┐
│  Execute Tools    │     │  Return Final   │
│  Sequentially     │     │  Response       │
└─────┬─────────────┘     └─────────────────┘
      │
      │  ┌─────────────────────────────────────────┐
      ├──┤ Tool: dependency_graph                  │
      │  │ Result: Project structure               │
      │  └─────────────────────────────────────────┘
      │
      │  ┌─────────────────────────────────────────┐
      ├──┤ Tool: spawn_agent                       │
      │  │ Params: { purpose: "...", context }     │
      │  │                                         │
      │  │ ┌─────────────────────────────────────┐ │
      │  │ │ executeSpawnAgent()                 │ │
      │  │ │  • Create agent_0                   │ │
      │  │ │  • Add to activeAgents              │ │
      │  │ │  • Notify AgentManager              │ │
      │  │ │  • Return immediately               │ │
      │  │ └─────────────────────────────────────┘ │
      │  │ Result: { agentId: "agent_0", ... }     │
      │  └─────────────────────────────────────────┘
      │         │
      │         ▼ (Background - Non-blocking)
      │  ┌─────────────────────────────────────────┐
      │  │ AgentManager.spawnAgent()               │
      │  │  • Queue agent_0                        │
      │  │  • Start processQueue()                 │
      │  └──────────────┬──────────────────────────┘
      │                 │
      │                 ▼
      │  ┌─────────────────────────────────────────┐
      │  │ createAndExecuteSubAgent(agent_0)       │
      │  │  • new SubAgent(agent_0, purpose)       │
      │  │  • Load orch_subagent_prompt.txt        │
      │  │  • subAgent.execute()                   │
      │  │    ├─→ Generate response                │
      │  │    ├─→ Call file_read                   │
      │  │    ├─→ Call get_diffs                   │
      │  │    ├─→ Continue until complete          │
      │  │    └─→ Update AgentState                │
      │  └─────────────────────────────────────────┘
      │
      │  ┌─────────────────────────────────────────┐
      ├──┤ Tool: file_read                         │
      │  │ Result: File contents                   │
      │  └─────────────────────────────────────────┘
      │
      │  ┌─────────────────────────────────────────┐
      ├──┤ Tool: web_search                        │
      │  │ Result: Search findings                 │
      │  └─────────────────────────────────────────┘
      │
      ▼
┌─────────────────────┐
│ Add Tool Results to │
│ Conversation        │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Generate Next       │
│ Response            │
└─────────┬───────────┘
          │
          ▼
    (Loop continues)
          │
          ▼
┌─────────────────────┐
│ No More Tool Calls  │
│ Return Final Result │
└─────────────────────┘
```

## Tool Execution Flow

```
┌────────────────────────────────────────────────────────────┐
│                    Tool Call Received                      │
│   functionCall: { name: "file_read", args: {...} }        │
└─────────────────────────┬──────────────────────────────────┘
                          │
                          ▼
         ┌────────────────────────────────────┐
         │   validateToolParams()             │
         │   Check required parameters        │
         └────────────────┬───────────────────┘
                          │
                  ┌───────┴────────┐
                  │                │
               Valid            Invalid
                  │                │
                  ▼                ▼
    ┌─────────────────────┐  ┌──────────────┐
    │  executeTool()       │  │ Return Error │
    │  Dispatch to         │  │ { errors: [] }│
    │  specific executor   │  └──────────────┘
    └──────────┬───────────┘
               │
    ┌──────────┴──────────┐
    │                     │
    ▼                     ▼
┌────────────┐    ┌──────────────┐
│ Sync Tool  │    │ Async Tool   │
│ (spawn)    │    │ (file_read)  │
└─────┬──────┘    └──────┬───────┘
      │                  │
      ▼                  ▼
┌────────────┐    ┌──────────────┐
│ Execute    │    │ await exec   │
│ Immediate  │    │ File I/O     │
└─────┬──────┘    └──────┬───────┘
      │                  │
      └────────┬─────────┘
               │
               ▼
    ┌──────────────────────┐
    │   Return Result      │
    │   { success, ... }   │
    └──────────────────────┘
```

## Agent State Lifecycle

```
┌───────────────┐
│   CREATED     │  ← Agent spawned
│  (initialized)│
└───────┬───────┘
        │
        │ execute() called
        ▼
┌───────────────┐
│   RUNNING     │  ← Agent executing
│               │    Calling tools
│               │    Processing results
└───────┬───────┘
        │
        │ Task complete
        ▼
┌───────────────┐
│  COMPLETED    │  ← Result stored
│               │    Accessible via API
└───────────────┘

        OR

┌───────────────┐
│    FAILED     │  ← Error occurred
│               │    Error stored
└───────────────┘
```

## Data Flow Between Components

```
┌─────────────────────────────────────────────────────────────┐
│                     User Request                            │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │  Express API │
                    └──────┬───────┘
                           │
                           ▼
              ┌────────────────────────┐
              │  OrchestratorAgent     │
              │                        │
              │  conversationHistory[] │
              │  spawnedAgents[]       │
              │  iterationCount        │
              └───────┬────────────────┘
                      │
         ┌────────────┼────────────┐
         │            │            │
         ▼            ▼            ▼
    ┌────────┐  ┌────────┐  ┌────────┐
    │ Tool 1 │  │ Tool 2 │  │ Tool 3 │
    └───┬────┘  └───┬────┘  └───┬────┘
        │           │           │
        └───────────┼───────────┘
                    │
                    ▼
         ┌──────────────────────┐
         │   Tool Results       │
         │   Added to History   │
         └──────────┬───────────┘
                    │
                    ▼
         ┌──────────────────────┐
         │   Next API Call      │
         │   (with context)     │
         └──────────┬───────────┘
                    │
                    ▼
              (Loop continues)
```

## Memory Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Process Memory                           │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           activeAgents (Map)                         │  │
│  │                                                      │  │
│  │  "agent_0" → AgentState {                           │  │
│  │                status: "completed",                 │  │
│  │                purpose: "...",                      │  │
│  │                toolCallHistory: [...],              │  │
│  │                result: {...}                        │  │
│  │              }                                      │  │
│  │                                                      │  │
│  │  "agent_1" → AgentState { ... }                     │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │       AgentManager.executionQueue (Array)            │  │
│  │                                                      │  │
│  │  [                                                   │  │
│  │    { agentId: "agent_2", purpose: "...", ... },     │  │
│  │    { agentId: "agent_3", purpose: "...", ... }      │  │
│  │  ]                                                   │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │    OrchestratorAgent Instances                       │  │
│  │                                                      │  │
│  │    Each request creates new instance                │  │
│  │    ├─ conversationHistory[]                         │  │
│  │    ├─ spawnedAgents[]                               │  │
│  │    └─ iterationCount                                │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Key Design Patterns

### 1. Non-Blocking Spawn Pattern
```
Caller Thread:              Background Thread:
     │                           │
     ├─ spawn_agent()           │
     │  └─ returns immediately   │
     │                           │
     ├─ continue execution       │
     │                           ▼
     │                      execute agent
     │                           │
     ▼                           ▼
  complete                   complete
```

### 2. Recursive Tool Calling Pattern (Gemini)
```
processResponse()
    ↓
  Has tool calls?
    ├─ Yes → Execute tools
    │        Add results to history
    │        Generate next response
    │        processResponse() ← (Recursive)
    │
    └─ No → Return final response
```

### 3. Iterative Tool Calling Pattern (OpenAI)
```
while (iterations < max):
    ↓
  Generate response
    ↓
  Has tool_calls?
    ├─ Yes → Execute tools
    │        Add to messages
    │        iterations++
    │        Continue loop
    │
    └─ No → Return response
            Exit loop
```

## Security & Safety

```
┌─────────────────────────────────────────────────────────┐
│                  Safety Mechanisms                      │
│                                                         │
│  • Iteration Limits (10-15 max)                        │
│  • Parameter Validation                                │
│  • No Recursive Agent Spawning                         │
│  • Tool Access Control (orchestrator vs sub-agent)     │
│  • Error Handling & Recovery                           │
│  • State Tracking & Monitoring                         │
└─────────────────────────────────────────────────────────┘
```

## Summary

The architecture implements:
- ✅ **Hierarchical multi-agent system**
- ✅ **Non-blocking async execution**
- ✅ **Continuous tool calling loops**
- ✅ **State tracking and monitoring**
- ✅ **Dual AI engine support (OpenAI + Gemini)**
- ✅ **Safe iteration limits**
- ✅ **Comprehensive error handling**
