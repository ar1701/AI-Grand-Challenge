const { 
  getAllAgents, 
  getAgentState, 
  getAgentResult,
  getAgentToolHistory,
  clearCompletedAgents,
  clearAllAgents,
  setAgentManager
} = require('../tools/spawn_agent');
const { createAndExecuteSubAgent } = require('./subagent');

/**
 * Agent Manager
 * Centralized management for all spawned agents (agent_0 to agent_n)
 * Tracks state, coordinates execution, and provides monitoring
 */
class AgentManager {
  constructor() {
    this.executionQueue = [];
    this.isProcessing = false;
    
    // Set this manager in spawn_agent tool to enable automatic execution
    setAgentManager(this);
  }

  /**
   * Spawn and queue a new agent for execution
   * Returns immediately without blocking - agent executes asynchronously
   */
  async spawnAgent(agentId, purpose, context = {}) {
    try {
      // Add to execution queue
      this.executionQueue.push({
        agentId,
        purpose,
        context,
        queuedAt: new Date()
      });

      // Start processing queue if not already processing (non-blocking)
      if (!this.isProcessing) {
        // Don't await - let it run in background
        this.processQueue().catch(error => {
          console.error('[AgentManager] Queue processing error:', error.message);
        });
      }

      return {
        success: true,
        agentId,
        purpose,
        queuePosition: this.executionQueue.length,
        message: 'Agent queued for asynchronous execution'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Process the execution queue
   */
  async processQueue() {
    if (this.isProcessing || this.executionQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.executionQueue.length > 0) {
      const task = this.executionQueue.shift();
      
      try {
        console.log(`[AgentManager] Executing ${task.agentId} for: ${task.purpose}`);
        
        // Execute the sub-agent
        const result = await createAndExecuteSubAgent(
          task.agentId,
          task.purpose,
          task.context
        );

        console.log(`[AgentManager] ${task.agentId} completed. Success: ${result.success}`);
      } catch (error) {
        console.error(`[AgentManager] Error executing ${task.agentId}:`, error.message);
      }
    }

    this.isProcessing = false;
  }

  /**
   * Get all agents with their current states
   */
  getAllAgentsStatus() {
    return getAllAgents();
  }

  /**
   * Get specific agent state
   */
  getAgentStatus(agentId) {
    return getAgentState(agentId);
  }

  /**
   * Get agent result (only if completed)
   */
  getAgentResult(agentId) {
    return getAgentResult(agentId);
  }

  /**
   * Get agent tool call history
   */
  getAgentHistory(agentId) {
    return getAgentToolHistory(agentId);
  }

  /**
   * Wait for specific agent to complete
   */
  async waitForAgent(agentId, timeoutMs = 300000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      const state = getAgentState(agentId);
      
      if (!state.success) {
        return { success: false, error: `Agent ${agentId} not found` };
      }

      if (state.status === 'completed') {
        return getAgentResult(agentId);
      }

      if (state.status === 'failed') {
        return { success: false, error: `Agent ${agentId} failed` };
      }

      // Wait 500ms before checking again
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return { success: false, error: `Timeout waiting for agent ${agentId}` };
  }

  /**
   * Wait for all agents to complete
   */
  async waitForAllAgents(timeoutMs = 300000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      const allAgents = getAllAgents();
      
      if (!allAgents.success) {
        return { success: false, error: 'Failed to get agents status' };
      }

      const runningAgents = allAgents.agents.filter(
        agent => agent.status === 'running' || agent.status === 'initializing'
      );

      if (runningAgents.length === 0 && this.executionQueue.length === 0) {
        // All agents completed, collect results
        const results = allAgents.agents.map(agent => ({
          agentId: agent.agentId,
          purpose: agent.purpose,
          status: agent.status,
          result: getAgentResult(agent.agentId)
        }));

        return {
          success: true,
          totalAgents: allAgents.count,
          results
        };
      }

      // Wait 1 second before checking again
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return { success: false, error: 'Timeout waiting for all agents' };
  }

  /**
   * Get agents by status
   */
  getAgentsByStatus(status) {
    const allAgents = getAllAgents();
    
    if (!allAgents.success) {
      return { success: false, error: 'Failed to get agents' };
    }

    const filtered = allAgents.agents.filter(agent => agent.status === status);
    
    return {
      success: true,
      status,
      count: filtered.length,
      agents: filtered
    };
  }

  /**
   * Get comprehensive summary of all agents
   */
  getSummary() {
    const allAgents = getAllAgents();
    
    if (!allAgents.success) {
      return { success: false, error: 'Failed to get agents' };
    }

    const summary = {
      totalAgents: allAgents.count,
      queuedTasks: this.executionQueue.length,
      byStatus: {
        initializing: 0,
        running: 0,
        completed: 0,
        failed: 0
      },
      totalToolCalls: 0,
      averageExecutionTime: 0
    };

    let totalExecutionTime = 0;
    let completedCount = 0;

    for (const agent of allAgents.agents) {
      summary.byStatus[agent.status] = (summary.byStatus[agent.status] || 0) + 1;
      summary.totalToolCalls += agent.toolCallCount;
      
      if (agent.status === 'completed' && agent.executionTime) {
        totalExecutionTime += agent.executionTime;
        completedCount++;
      }
    }

    if (completedCount > 0) {
      summary.averageExecutionTime = totalExecutionTime / completedCount;
    }

    return {
      success: true,
      summary,
      isProcessing: this.isProcessing
    };
  }

  /**
   * Clear completed agents from memory
   */
  clearCompleted() {
    return clearCompletedAgents();
  }

  /**
   * Clear all agents and reset
   */
  clearAll() {
    this.executionQueue = [];
    this.isProcessing = false;
    return clearAllAgents();
  }

  /**
   * Get queue status
   */
  getQueueStatus() {
    return {
      success: true,
      queueLength: this.executionQueue.length,
      isProcessing: this.isProcessing,
      queue: this.executionQueue.map(task => ({
        agentId: task.agentId,
        purpose: task.purpose,
        queuedAt: task.queuedAt
      }))
    };
  }

  /**
   * Cancel all queued tasks
   */
  cancelQueue() {
    const cancelledCount = this.executionQueue.length;
    this.executionQueue = [];
    
    return {
      success: true,
      cancelledTasks: cancelledCount
    };
  }
}

// Singleton instance
const agentManager = new AgentManager();

module.exports = agentManager;
