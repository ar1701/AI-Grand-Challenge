/**
 * Tool: spawn_agent()
 * Dynamically spawns specialized Gemini agents for specific tasks
 * Each agent is named agent_0, agent_1, ... agent_n
 * Sub-agents have access to all tools EXCEPT spawn_agent (no recursive spawning)
 */

// Import agentManager - will be set after module loads to avoid circular dependency
let agentManager = null;

function setAgentManager(manager) {
  agentManager = manager;
}

/**
 * Agent counter for naming
 */
let agentCounter = 0;

/**
 * Active agents registry
 */
const activeAgents = new Map();

/**
 * Tool declaration for spawn_agent
 */
const spawnAgentTool = {
  name: 'spawn_agent',
  description: 'Creates a specialized Gemini agent with a specific assigned task. Sub-agents inherit all tools except spawn_agent. Use when parallelization or specialization offers clear benefit.',
  parameters: {
    type: 'object',
    properties: {
      purpose: {
        type: 'string',
        description: 'Clear description of the agent\'s task (e.g., "Analyze JWT logic", "Extract API route definitions", "Inspect authentication flow")'
      },
      context: {
        type: 'object',
        description: 'Context and data to provide to the agent',
        properties: {
          files: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional: Specific files for the agent to focus on'
          },
          instructions: {
            type: 'string',
            description: 'Optional: Specific instructions for the agent'
          },
          data: {
            type: 'object',
            description: 'Optional: Any additional data the agent needs'
          }
        }
      }
    },
    required: ['purpose']
  }
};

/**
 * Agent state tracking
 */
class AgentState {
  constructor(agentId, purpose, context) {
    this.agentId = agentId;
    this.purpose = purpose;
    this.context = context;
    this.status = 'initializing';
    this.createdAt = new Date();
    this.startedAt = null;
    this.completedAt = null;
    this.result = null;
    this.error = null;
    this.toolCallHistory = [];
  }

  start() {
    this.status = 'running';
    this.startedAt = new Date();
  }

  complete(result) {
    this.status = 'completed';
    this.completedAt = new Date();
    this.result = result;
  }

  fail(error) {
    this.status = 'failed';
    this.completedAt = new Date();
    this.error = error;
  }

  addToolCall(toolName, params, result) {
    this.toolCallHistory.push({
      tool: toolName,
      params,
      result,
      timestamp: new Date()
    });
  }

  getExecutionTime() {
    if (!this.startedAt) return 0;
    const endTime = this.completedAt || new Date();
    return endTime - this.startedAt;
  }
}

/**
 * Execute spawn_agent tool
 */
function executeSpawnAgent(purpose, context = {}) {
  try {
    const agentId = `agent_${agentCounter++}`;
    
    // Create agent state
    const agentState = new AgentState(agentId, purpose, context);
    activeAgents.set(agentId, agentState);

    // Trigger AgentManager to execute the agent asynchronously
    if (agentManager) {
      // Non-blocking: queue the agent for execution
      agentManager.spawnAgent(agentId, purpose, context).catch(error => {
        console.error(`[spawn_agent] Failed to queue ${agentId}:`, error.message);
        agentState.fail(error.message);
      });
    } else {
      console.warn('[spawn_agent] AgentManager not initialized - agent will not execute');
    }

    return {
      success: true,
      agentId,
      purpose,
      message: `Spawned ${agentId} for: ${purpose}. Agent will execute asynchronously.`,
      state: {
        status: agentState.status,
        createdAt: agentState.createdAt
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get agent state
 */
function getAgentState(agentId) {
  const agent = activeAgents.get(agentId);
  
  if (!agent) {
    return {
      success: false,
      error: `Agent ${agentId} not found`
    };
  }

  return {
    success: true,
    agentId: agent.agentId,
    purpose: agent.purpose,
    status: agent.status,
    createdAt: agent.createdAt,
    startedAt: agent.startedAt,
    completedAt: agent.completedAt,
    executionTime: agent.getExecutionTime(),
    toolCallCount: agent.toolCallHistory.length,
    hasResult: agent.result !== null,
    hasError: agent.error !== null
  };
}

/**
 * Update agent state
 */
function updateAgentState(agentId, updates) {
  const agent = activeAgents.get(agentId);
  
  if (!agent) {
    return {
      success: false,
      error: `Agent ${agentId} not found`
    };
  }

  if (updates.status) {
    agent.status = updates.status;
  }

  if (updates.status === 'running' && !agent.startedAt) {
    agent.start();
  }

  if (updates.result) {
    agent.complete(updates.result);
  }

  if (updates.error) {
    agent.fail(updates.error);
  }

  return {
    success: true,
    agentId,
    status: agent.status
  };
}

/**
 * Record a tool call made by an agent
 */
function recordAgentToolCall(agentId, toolName, params, result) {
  const agent = activeAgents.get(agentId);
  
  if (agent) {
    agent.addToolCall(toolName, params, result);
  }
}

/**
 * Get all active agents
 */
function getAllAgents() {
  const agents = [];
  
  for (const [agentId, agent] of activeAgents.entries()) {
    agents.push({
      agentId,
      purpose: agent.purpose,
      status: agent.status,
      executionTime: agent.getExecutionTime(),
      toolCallCount: agent.toolCallHistory.length
    });
  }

  return {
    success: true,
    count: agents.length,
    agents
  };
}

/**
 * Get agents by status
 */
function getAgentsByStatus(status) {
  const agents = [];
  
  for (const [agentId, agent] of activeAgents.entries()) {
    if (agent.status === status) {
      agents.push({
        agentId,
        purpose: agent.purpose,
        status: agent.status,
        createdAt: agent.createdAt
      });
    }
  }

  return {
    success: true,
    status,
    count: agents.length,
    agents
  };
}

/**
 * Clear completed agents
 */
function clearCompletedAgents() {
  let cleared = 0;
  
  for (const [agentId, agent] of activeAgents.entries()) {
    if (agent.status === 'completed' || agent.status === 'failed') {
      activeAgents.delete(agentId);
      cleared++;
    }
  }

  return {
    success: true,
    cleared,
    remaining: activeAgents.size
  };
}

/**
 * Clear all agents
 */
function clearAllAgents() {
  const count = activeAgents.size;
  activeAgents.clear();
  agentCounter = 0;

  return {
    success: true,
    cleared: count
  };
}

/**
 * Get agent result
 */
function getAgentResult(agentId) {
  const agent = activeAgents.get(agentId);
  
  if (!agent) {
    return {
      success: false,
      error: `Agent ${agentId} not found`
    };
  }

  if (agent.status !== 'completed') {
    return {
      success: false,
      error: `Agent ${agentId} has not completed yet. Status: ${agent.status}`
    };
  }

  return {
    success: true,
    agentId,
    purpose: agent.purpose,
    result: agent.result,
    executionTime: agent.getExecutionTime(),
    toolCallCount: agent.toolCallHistory.length
  };
}

/**
 * Get agent tool call history
 */
function getAgentToolHistory(agentId) {
  const agent = activeAgents.get(agentId);
  
  if (!agent) {
    return {
      success: false,
      error: `Agent ${agentId} not found`
    };
  }

  return {
    success: true,
    agentId,
    toolCalls: agent.toolCallHistory.map(call => ({
      tool: call.tool,
      timestamp: call.timestamp,
      hasResult: call.result !== null
    }))
  };
}

/**
 * Check if agent can spawn sub-agents (prevent recursion)
 */
function canSpawnAgent(parentAgentId = null) {
  // Only orchestrator (parentAgentId = null) can spawn agents
  // Sub-agents cannot spawn other agents
  return parentAgentId === null;
}

module.exports = {
  spawnAgentTool,
  executeSpawnAgent,
  setAgentManager,
  getAgentState,
  updateAgentState,
  recordAgentToolCall,
  getAllAgents,
  getAgentsByStatus,
  clearCompletedAgents,
  clearAllAgents,
  getAgentResult,
  getAgentToolHistory,
  canSpawnAgent,
  AgentState
};
