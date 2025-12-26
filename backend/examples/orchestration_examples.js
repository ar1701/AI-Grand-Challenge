/**
 * Example Usage of the Orchestration System
 * 
 * This file demonstrates various ways to use the orchestration API
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3000';

// ============================================================================
// Example 1: Simple Project Analysis
// ============================================================================

async function exampleProjectAnalysis() {
  console.log('\n=== Example 1: Project Analysis ===\n');
  
  try {
    const response = await axios.post(`${API_BASE}/orchestrate`, {
      goal: 'Analyze the project structure, create a dependency graph, and identify the main entry points and API routes.',
      projectPath: '/Users/ayushraj/Desktop/GitHub Desktop/AI-Grand-Challenge'
    });

    console.log('Success:', response.data.success);
    console.log('Result:', response.data.result.message);
    console.log('Spawned Agents:', response.data.spawnedAgents.length);
    console.log('Conversation Turns:', response.data.conversationTurns);
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

// ============================================================================
// Example 2: Security Vulnerability Scan
// ============================================================================

async function exampleSecurityScan() {
  console.log('\n=== Example 2: Security Vulnerability Scan ===\n');
  
  try {
    const response = await axios.post(`${API_BASE}/orchestrate`, {
      goal: `Perform a comprehensive security audit of the backend code:
      1. Scan for common vulnerabilities (SQL injection, XSS, auth issues)
      2. Use web search to research current best practices
      3. Generate patches to fix any issues found
      4. Prioritize critical security flaws`,
      projectPath: '/Users/ayushraj/Desktop/GitHub Desktop/AI-Grand-Challenge/backend'
    });

    console.log('Security Scan Complete');
    console.log('Result:', response.data.result.message);
    
    // Check agents
    const agentsResponse = await axios.get(`${API_BASE}/agents`);
    console.log('\nAgent Summary:', agentsResponse.data.summary);
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

// ============================================================================
// Example 3: Git Diff Analysis
// ============================================================================

async function exampleGitDiffAnalysis() {
  console.log('\n=== Example 3: Git Diff Analysis ===\n');
  
  try {
    const response = await axios.post(`${API_BASE}/orchestrate`, {
      goal: `Review the git changes in the repository:
      1. Get all unstaged and staged changes
      2. Analyze what was modified and why
      3. Check if the changes introduce any potential bugs
      4. Provide a summary of the changes`,
      projectPath: '/Users/ayushraj/Desktop/GitHub Desktop/AI-Grand-Challenge'
    });

    console.log('Git Analysis Complete');
    console.log('Result:', response.data.result.message);
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

// ============================================================================
// Example 4: Direct Tool Usage - Dependency Graph
// ============================================================================

async function exampleDependencyGraph() {
  console.log('\n=== Example 4: Direct Tool Usage - Dependency Graph ===\n');
  
  try {
    const response = await axios.post(`${API_BASE}/tools/execute`, {
      toolName: 'dependency_graph',
      params: {
        projectPath: '/Users/ayushraj/Desktop/GitHub Desktop/AI-Grand-Challenge/backend'
      }
    });

    console.log('Success:', response.data.success);
    console.log('Total Files:', response.data.stats?.totalFiles);
    console.log('Total Dependencies:', response.data.stats?.totalDependencies);
    console.log('Nodes:', response.data.graph?.nodes.length);
    console.log('Edges:', response.data.graph?.edges.length);
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

// ============================================================================
// Example 5: Direct Tool Usage - Web Search
// ============================================================================

async function exampleWebSearch() {
  console.log('\n=== Example 5: Direct Tool Usage - Web Search ===\n');
  
  try {
    const response = await axios.post(`${API_BASE}/tools/execute`, {
      toolName: 'web_search',
      params: {
        query: 'Express.js security best practices 2024 OWASP',
        context: 'Researching security guidelines for Node.js backend'
      }
    });

    console.log('Success:', response.data.success);
    console.log('Answer:', response.data.answer);
    console.log('\nSources:');
    response.data.grounding?.sources.forEach((source, i) => {
      console.log(`  ${i + 1}. ${source.title}`);
      console.log(`     ${source.url}`);
    });
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

// ============================================================================
// Example 6: Direct Tool Usage - Get Git Diffs
// ============================================================================

async function exampleGetDiffs() {
  console.log('\n=== Example 6: Direct Tool Usage - Get Git Diffs ===\n');
  
  try {
    const response = await axios.post(`${API_BASE}/tools/execute`, {
      toolName: 'get_diffs',
      params: {
        projectPath: '/Users/ayushraj/Desktop/GitHub Desktop/AI-Grand-Challenge',
        staged: false
      }
    });

    console.log('Success:', response.data.success);
    console.log('Branch:', response.data.branch);
    console.log('Last Commit:', response.data.lastCommit?.message);
    console.log('\nUnstaged Changes:');
    console.log('  Files Changed:', response.data.changes?.unstaged?.summary?.filesChanged);
    console.log('  Lines Added:', response.data.changes?.unstaged?.summary?.totalAdded);
    console.log('  Lines Removed:', response.data.changes?.unstaged?.summary?.totalRemoved);
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

// ============================================================================
// Example 7: Direct Tool Usage - File Read
// ============================================================================

async function exampleFileRead() {
  console.log('\n=== Example 7: Direct Tool Usage - File Read ===\n');
  
  try {
    const response = await axios.post(`${API_BASE}/tools/execute`, {
      toolName: 'file_read',
      params: {
        filePath: '/Users/ayushraj/Desktop/GitHub Desktop/AI-Grand-Challenge/backend/app.js'
      }
    });

    console.log('Success:', response.data.success);
    console.log('File:', response.data.filePath);
    console.log('Size:', response.data.size, 'bytes');
    console.log('Lines:', response.data.lines);
    console.log('\nFirst 200 characters:');
    console.log(response.data.content.substring(0, 200) + '...');
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

// ============================================================================
// Example 8: Monitor Agents
// ============================================================================

async function exampleMonitorAgents() {
  console.log('\n=== Example 8: Monitor Agents ===\n');
  
  try {
    // Get all agents summary
    const summary = await axios.get(`${API_BASE}/agents`);
    console.log('Total Agents:', summary.data.summary.totalAgents);
    console.log('Status Breakdown:', summary.data.summary.byStatus);
    console.log('Total Tool Calls:', summary.data.summary.totalToolCalls);
    console.log('Average Execution Time:', summary.data.summary.averageExecutionTime, 'ms');
    
    // If there are any agents, get details of the first one
    if (summary.data.summary.totalAgents > 0) {
      const agentsResponse = await axios.get(`${API_BASE}/agents`);
      // This would need the actual agent list - for demo purposes
      console.log('\nNote: Use GET /agents/:agentId for specific agent details');
    }
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

// ============================================================================
// Example 9: Complex Multi-Agent Task
// ============================================================================

async function exampleComplexTask() {
  console.log('\n=== Example 9: Complex Multi-Agent Task ===\n');
  
  try {
    const response = await axios.post(`${API_BASE}/orchestrate`, {
      goal: `Perform a comprehensive project audit:
      1. Create a dependency graph to understand the project structure
      2. Spawn specialized agents to:
         - Analyze authentication and authorization logic
         - Review API endpoints for security issues
         - Check database query patterns for SQL injection risks
         - Examine file handling for path traversal vulnerabilities
      3. Research best practices for any issues found using web search
      4. Generate structured patches to fix critical issues
      5. Provide a detailed report with priorities`,
      projectPath: '/Users/ayushraj/Desktop/GitHub Desktop/AI-Grand-Challenge/backend'
    });

    console.log('Complex Task Initiated');
    console.log('Spawned Agents:', response.data.spawnedAgents);
    
    // Wait a bit and check agent status
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const agentsStatus = await axios.get(`${API_BASE}/agents`);
    console.log('\nAgent Status:', agentsStatus.data.summary);
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

// ============================================================================
// Run Examples
// ============================================================================

async function runAllExamples() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║   Orchestration System - Example Usage                    ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  // Uncomment the examples you want to run:
  
  // await exampleProjectAnalysis();
  // await exampleSecurityScan();
  // await exampleGitDiffAnalysis();
  await exampleDependencyGraph();
  await exampleWebSearch();
  await exampleGetDiffs();
  await exampleFileRead();
  await exampleMonitorAgents();
  // await exampleComplexTask();
  
  console.log('\n✅ Examples completed!\n');
}

// Run if executed directly
if (require.main === module) {
  runAllExamples().catch(console.error);
}

module.exports = {
  exampleProjectAnalysis,
  exampleSecurityScan,
  exampleGitDiffAnalysis,
  exampleDependencyGraph,
  exampleWebSearch,
  exampleGetDiffs,
  exampleFileRead,
  exampleMonitorAgents,
  exampleComplexTask
};
