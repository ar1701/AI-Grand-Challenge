/**
 * Tools Index
 * Central registry of all tools available to the orchestrator and sub-agents
 */

const { dependencyGraphTool, executeDependencyGraph } = require('./dependency_graph');
const { fileReadTool, executeFileRead, fileWriteTool, executeFileWrite } = require('./file_operations');
const { getDiffsTool, executeGetDiffs } = require('./git_operations');
const { webSearchTool, executeWebSearch } = require('./web_search');
const { applyPatchTool, executeApplyPatch, patchGenerationSchema } = require('./apply_patch');
const { spawnAgentTool, executeSpawnAgent } = require('./spawn_agent');

/**
 * All available tools for the orchestrator agent
 * (includes spawn_agent)
 */
const orchestratorTools = [
  dependencyGraphTool,
  spawnAgentTool,
  fileReadTool,
  getDiffsTool,
  webSearchTool,
  applyPatchTool,
  fileWriteTool
];

/**
 * Tools available to sub-agents
 * (excludes spawn_agent to prevent recursive spawning)
 */
const subagentTools = [
  dependencyGraphTool,
  fileReadTool,
  getDiffsTool,
  webSearchTool,
  applyPatchTool,
  fileWriteTool
];

/**
 * Tool executors mapped by tool name
 */
const toolExecutors = {
  'dependency_graph': executeDependencyGraph,
  'spawn_agent': executeSpawnAgent,
  'file_read': executeFileRead,
  'get_diffs': executeGetDiffs,
  'web_search': executeWebSearch,
  'apply_patch': executeApplyPatch,
  'file_write': executeFileWrite
};

/**
 * Execute a tool by name with parameters
 */
async function executeTool(toolName, params) {
  const executor = toolExecutors[toolName];
  
  if (!executor) {
    return {
      success: false,
      error: `Unknown tool: ${toolName}`
    };
  }

  try {
    // Handle different parameter structures for each tool
    let result;
    
    switch (toolName) {
      case 'dependency_graph':
        result = await executor(params.projectPath);
        break;
      
      case 'spawn_agent':
        result = executor(params.purpose, params.context);
        break;
      
      case 'file_read':
        result = await executor(params.filePath);
        break;
      
      case 'get_diffs':
        result = await executor(params.projectPath, params.staged, params.files);
        break;
      
      case 'web_search':
        result = await executor(params.query, params.context);
        break;
      
      case 'apply_patch':
        result = await executor(params.filePath, params.patches);
        break;
      
      case 'file_write':
        result = await executor(params.filePath, params.content, params.createDirectories);
        break;
      
      default:
        result = {
          success: false,
          error: `No executor implementation for: ${toolName}`
        };
    }
    
    return result;
  } catch (error) {
    return {
      success: false,
      error: error.message,
      tool: toolName
    };
  }
}

/**
 * Get tool declaration by name
 */
function getToolDeclaration(toolName) {
  const allTools = [...orchestratorTools, ...subagentTools];
  return allTools.find(tool => tool.name === toolName);
}

/**
 * Validate tool parameters against declaration
 */
function validateToolParams(toolName, params) {
  const tool = getToolDeclaration(toolName);
  
  if (!tool) {
    return {
      valid: false,
      errors: [`Unknown tool: ${toolName}`]
    };
  }

  const errors = [];
  const required = tool.parameters.required || [];
  
  // Check required parameters
  for (const param of required) {
    if (!(param in params)) {
      errors.push(`Missing required parameter: ${param}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = {
  orchestratorTools,
  subagentTools,
  toolExecutors,
  executeTool,
  getToolDeclaration,
  validateToolParams,
  patchGenerationSchema
};
