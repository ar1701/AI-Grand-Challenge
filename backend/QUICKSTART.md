# Orchestration System Quick Start

## Installation

```bash
cd backend
pnpm install
```

## Start the Server

```bash
pnpm start
# or
nodemon app.js
```

Server will start at `http://localhost:3000`

## Quick Test

### 1. Test a Simple Tool

```bash
curl -X POST http://localhost:3000/tools/execute \
  -H "Content-Type: application/json" \
  -d '{
    "toolName": "dependency_graph",
    "params": {
      "projectPath": "/Users/ayushraj/Desktop/GitHub Desktop/AI-Grand-Challenge/backend"
    }
  }'
```

### 2. Run the Orchestrator

```bash
curl -X POST http://localhost:3000/orchestrate \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "Analyze the project structure and list all the main files",
    "projectPath": "/Users/ayushraj/Desktop/GitHub Desktop/AI-Grand-Challenge"
  }'
```

### 3. Check Agent Status

```bash
curl http://localhost:3000/agents
```

## Run Examples

```bash
pnpm run examples
```

This will run various example scenarios demonstrating the orchestration system capabilities.

## API Endpoints Summary

- `POST /orchestrate` - Main orchestration endpoint
- `GET /agents` - Get all agents summary
- `GET /agents/:agentId` - Get specific agent status
- `GET /agents/:agentId/result` - Get agent result
- `GET /agents/:agentId/history` - Get agent tool history
- `POST /tools/execute` - Execute a tool directly
- `DELETE /agents/completed` - Clear completed agents
- `DELETE /agents` - Clear all agents

## Available Tools

1. **dependency_graph** - Analyze project dependencies
2. **spawn_agent** - Spawn specialized sub-agents
3. **file_read** - Read file contents
4. **get_diffs** - Get Git changes
5. **web_search** - Search web with grounding
6. **apply_patch** - Apply code patches
7. **file_write** - Create new files

See `ORCHESTRATION_README.md` for complete documentation.
