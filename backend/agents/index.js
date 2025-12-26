/**
 * Agents Index
 * Exports orchestrator, sub-agent, and agent manager
 */

const OrchestratorAgent = require('./orchestrator');
const { SubAgent, createAndExecuteSubAgent } = require('./subagent');
const agentManager = require('./agentManager');

module.exports = {
  OrchestratorAgent,
  SubAgent,
  createAndExecuteSubAgent,
  agentManager
};
