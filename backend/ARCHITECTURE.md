# Backend Architecture Diagram

## System Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│                         USER / VS CODE EXTENSION                         │
│                                                                          │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │
                                │ HTTP Request
                                │ POST /orchestrate
                                │ { goal, projectPath }
                                │
┌───────────────────────────────▼──────────────────────────────────────────┐
│                                                                          │
│                          EXPRESS SERVER (app.js)                         │
│                          Port 3000                                       │
│                                                                          │
│  Endpoints:                                                              │
│  • POST /orchestrate          → Main orchestration                       │
│  • POST /tools/execute        → Direct tool execution                    │
│  • GET  /agents               → Agent status summary                     │
│  • GET  /agents/:id/result    → Agent results                           │
│  • POST /analyze-multiple-files → Original analysis (preserved)          │
│  • POST /code-block           → Single file analysis (preserved)         │
│                                                                          │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │
                                ▼
┌────────────────────────────────────────────────────────────────────────┐
│                                                                        │
│                    ORCHESTRATOR AGENT                                  │
│                    (agents/orchestrator.js)                            │
│                                                                        │
│  System Prompt: orch_agent_prompt.txt                                 │
│  Model: gemini-2.0-flash-exp                                          │
│                                                                        │
│  Capabilities:                                                         │
│  ✓ Coordinates all tasks                                              │
│  ✓ Plans multi-step workflows                                         │
│  ✓ Spawns specialized sub-agents                                      │
│  ✓ Aggregates results                                                 │
│                                                                        │
│  Available Tools: ALL 7 TOOLS                                          │
│  [dependency_graph, spawn_agent, file_read, get_diffs,                │
│   web_search, apply_patch, file_write]                                │
│                                                                        │
└──────┬─────────────────────────────────────────────────────────┬───────┘
       │                                                          │
       │ Calls Tools                              Spawns Agents   │
       │                                                          │
       ▼                                                          ▼
┌─────────────────────────────────────────┐   ┌──────────────────────────────┐
│                                         │   │                              │
│         TOOLS MODULE                    │   │      AGENT MANAGER           │
│         (tools/index.js)                │   │   (agents/agentManager.js)   │
│                                         │   │                              │
│  Manages tool declarations,             │   │  • Tracks agent lifecycle    │
│  execution, and validation              │   │  • Execution queue           │
│                                         │   │  • State monitoring          │
│  orchestratorTools: All 7               │   │  • Performance metrics       │
│  subagentTools: 6 (no spawn_agent)      │   │                              │
│                                         │   │  Agent Registry:             │
└──────────┬──────────────────────────────┘   │  agent_0, agent_1, ..., n    │
           │                                   │                              │
           ▼                                   └──────────────┬───────────────┘
┌──────────────────────────────────────────┐                 │
│                                          │                 │ Creates
│      INDIVIDUAL TOOLS                    │                 │
│                                          │                 ▼
│  1. dependency_graph.js                  │   ┌─────────────────────────────┐
│     └─► DependencyGraph class            │   │                             │
│         • Scans project files            │   │      SUB-AGENT              │
│         • Parses imports/requires        │   │   (agents/subagent.js)      │
│         • Builds graph structure         │   │                             │
│                                          │   │  System Prompt:             │
│  2. spawn_agent.js                       │   │  orch_subagent_prompt.txt   │
│     └─► AgentState class                 │   │                             │
│         • Creates agent instances        │   │  Assigned:                  │
│         • Tracks state                   │   │  • agentId: agent_X         │
│         • Records tool history           │   │  • purpose: specific task   │
│                                          │   │  • context: { ... }         │
│  3. file_operations.js                   │   │                             │
│     ├─► file_read()                      │   │  Available Tools: 6 tools   │
│     │   • Reads file contents            │   │  (no spawn_agent)           │
│     └─► file_write()                     │   │                             │
│         • Creates new files only         │   └──────────┬──────────────────┘
│                                          │              │
│  4. git_operations.js                    │              │ Uses Tools
│     └─► get_diffs()                      │              │
│         • Gets unstaged changes          │              ▼
│         • Gets staged changes            │   ┌──────────────────────────────┐
│         • Gets commit history            │   │  Tools (same as above)       │
│         • Analyzes file changes          │   │  • file_read                 │
│                                          │   │  • get_diffs                 │
│  5. web_search.js                        │   │  • web_search                │
│     └─► executeWebSearch()               │   │  • apply_patch               │
│         • Google Search grounding        │   │  • dependency_graph          │
│         • Returns citations              │   │  • file_write                │
│         • Extracts sources               │   └──────────────────────────────┘
│                                          │
│  6. apply_patch.js                       │
│     └─► executeApplyPatch()              │
│         • Exact string matching          │
│         • Creates backups                │
│         • Generates diffs                │
│         • Minimal changes only           │
│                                          │
│  7. dependency_graph.js                  │
│     └─► executeDependencyGraph()         │
│         • Already described above        │
│                                          │
└──────────────────────────────────────────┘
```

## Data Flow

```
1. Request arrives at /orchestrate endpoint
   ↓
2. OrchestratorAgent.execute() called
   ↓
3. Orchestrator loads orch_agent_prompt.txt
   ↓
4. Gemini analyzes the goal
   ↓
5. Orchestrator decides to use tools:
   ├─→ dependency_graph() → Understands project structure
   ├─→ spawn_agent() → Creates agent_0 for specialized task
   │   ↓
   │   agent_0 executes with its own tools
   │   ↓
   │   agent_0 returns results
   ├─→ file_read() → Examines specific files
   ├─→ get_diffs() → Checks recent changes
   ├─→ web_search() → Researches best practices
   └─→ apply_patch() → Applies fixes
   ↓
6. Results aggregated
   ↓
7. Response returned to user
```

## Tool Calling Flow

```
┌─────────────────────────────────────────────────────────────┐
│  Gemini Model generates function call                       │
│  {                                                           │
│    "functionCall": {                                         │
│      "name": "dependency_graph",                             │
│      "args": { "projectPath": "/path/to/project" }           │
│    }                                                         │
│  }                                                           │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  toolExecutors[toolName](params)                             │
│  → executeDependencyGraph(projectPath)                       │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  Tool executes and returns result                            │
│  {                                                            │
│    "success": true,                                           │
│    "graph": { "nodes": [...], "edges": [...] },              │
│    "stats": { "totalFiles": 15, "totalDependencies": 42 }    │
│  }                                                            │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  Result added to conversation history as function response   │
│  Model generates next action or final response               │
└──────────────────────────────────────────────────────────────┘
```

## Agent State Machine

```
┌─────────────┐
│             │
│ Spawn Agent │
│             │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│             │
│ Initializing│ ←── AgentState created
│             │     Added to registry
└──────┬──────┘
       │
       ▼
┌─────────────┐
│             │
│   Running   │ ←── execute() called
│             │     Tools being used
└──────┬──────┘
       │
       ├────────────┐
       │            │
       ▼            ▼
┌──────────┐  ┌─────────┐
│          │  │         │
│Completed │  │ Failed  │
│          │  │         │
└──────────┘  └─────────┘
```

## File Structure Map

```
backend/
│
├── agents/                    # Agent implementations
│   ├── index.js               # Module exports
│   ├── orchestrator.js        # Main orchestrator agent
│   ├── subagent.js            # Specialized sub-agent
│   └── agentManager.js        # Agent lifecycle manager
│
├── tools/                     # Tool implementations
│   ├── index.js               # Tool registry
│   ├── dependency_graph.js    # Dependency analysis
│   ├── spawn_agent.js         # Agent spawning
│   ├── file_operations.js     # File I/O
│   ├── git_operations.js      # Git operations
│   ├── web_search.js          # Web search with grounding
│   └── apply_patch.js         # Code patching
│
├── prompts/                   # System prompts
│   ├── orch_agent_prompt.txt  # Orchestrator persona
│   └── orch_subagent_prompt.txt # Sub-agent persona
│
├── docs/                      # Implementation docs
│   ├── tool_call.txt          # Function calling guide
│   ├── structured_output.txt  # Structured output guide
│   └── gemini_web_search.txt  # Web search guide
│
├── examples/                  # Usage examples
│   └── orchestration_examples.js # 9 example scenarios
│
├── utils/                     # Original utilities (preserved)
│   ├── codeAnalysis.js
│   ├── openaiAnalysis.js
│   ├── prompt.js
│   ├── redisClient.js
│   ├── response.js
│   └── tokenManager.js
│
├── app.js                     # Express server (updated)
├── package.json               # Dependencies & scripts
├── ORCHESTRATION_README.md    # Complete documentation
├── QUICKSTART.md              # Quick start guide
└── REFACTORING_SUMMARY.md     # This refactoring summary
```

## Integration Points

```
┌────────────────────────────────────────────────────────────┐
│                                                            │
│                  EXISTING SYSTEM                           │
│                  (Preserved)                               │
│                                                            │
│  • /analyze-multiple-files                                 │
│  • /code-block                                             │
│  • Redis caching                                           │
│  • Token management                                        │
│  • Original utils                                          │
│                                                            │
└────────────────────────────────────────────────────────────┘
                           ⬆
                           │
                           │ Coexists with
                           │
                           ⬇
┌────────────────────────────────────────────────────────────┐
│                                                            │
│                  NEW ORCHESTRATION SYSTEM                  │
│                                                            │
│  • /orchestrate                                            │
│  • /agents                                                 │
│  • /tools/execute                                          │
│  • Orchestrator agent                                      │
│  • Sub-agents                                              │
│  • 7 specialized tools                                     │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

## Summary

This architecture implements:
- ✅ Hierarchical multi-agent orchestration
- ✅ 7 specialized tools
- ✅ Dynamic agent spawning (agent_0 to agent_n)
- ✅ Function calling with Gemini
- ✅ Structured output for patches
- ✅ Web search grounding
- ✅ Full backward compatibility
- ✅ Comprehensive monitoring and management
