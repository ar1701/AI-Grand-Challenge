/**
 * Test Script: Orchestration Flow
 * 
 * This test verifies the complete orchestration system:
 * 1. Orchestrator receives a task
 * 2. Orchestrator calls tools
 * 3. Orchestrator spawns sub-agents
 * 4. Sub-agents execute independently
 * 5. Sub-agents call their own tools
 * 6. All agents complete and return results
 */

require('dotenv').config();
const OrchestratorAgent = require('./agents/orchestrator');
const agentManager = require('./agents/agentManager');
const { getAllAgents } = require('./tools/spawn_agent');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testOrchestrationFlow() {
  console.log('='.repeat(80));
  console.log('ORCHESTRATION FLOW TEST');
  console.log('='.repeat(80));
  console.log();

  const projectPath = __dirname;
  const goal = `Analyze the backend orchestration system:

1. Use dependency_graph to understand the project structure
2. Spawn 2 sub-agents:
   - agent_0: Analyze the orchestrator.js file and identify its main capabilities
   - agent_1: Analyze the subagent.js file and explain how sub-agents work
3. Each sub-agent should use file_read to examine their assigned files
4. Compile a summary of the orchestration architecture

Project: ${projectPath}`;

  console.log('📋 Goal:');
  console.log(goal);
  console.log();
  console.log('-'.repeat(80));
  console.log();

  try {
    // Create orchestrator
    const orchestrator = new OrchestratorAgent();
    
    console.log('🚀 Starting orchestrator execution...');
    console.log();

    // Execute (non-blocking for sub-agents)
    const startTime = Date.now();
    const result = await orchestrator.execute(goal, projectPath);
    const orchestratorTime = Date.now() - startTime;

    console.log();
    console.log('✅ Orchestrator completed!');
    console.log(`⏱️  Orchestrator execution time: ${orchestratorTime}ms`);
    console.log(`🔄 Iterations: ${result.iterations || 'N/A'}`);
    console.log(`📝 Conversation turns: ${result.conversationTurns}`);
    console.log();
    
    // Get orchestrator's tool call history
    const orchestratorHistory = orchestrator.getHistory();
    console.log('-'.repeat(80));
    console.log('🔧 ORCHESTRATOR TOOL CALLS');
    console.log('-'.repeat(80));
    console.log();
    
    let toolCallCount = 0;
    for (const turn of orchestratorHistory) {
      if (turn.role === 'function' || (turn.role === 'tool')) {
        // Gemini uses role:'function', OpenAI uses role:'tool'
        const calls = Array.isArray(turn.parts) ? turn.parts : [turn];
        calls.forEach((call, idx) => {
          toolCallCount++;
          if (call.functionResponse) {
            // Gemini format
            console.log(`${toolCallCount}. ${call.functionResponse.name}()`);
            const response = call.functionResponse.response;
            if (response.success !== undefined) {
              console.log(`   Success: ${response.success}`);
            }
            if (response.agentId) {
              console.log(`   Spawned: ${response.agentId}`);
            }
            if (response.nodes) {
              console.log(`   Nodes found: ${response.nodes.length}`);
            }
            if (response.content) {
              console.log(`   Content length: ${response.content.length} chars`);
            }
            if (response.changes) {
              console.log(`   Changes: ${response.changes.length} files`);
            }
          } else if (turn.tool_call_id) {
            // OpenAI format - content is stringified result
            const toolName = turn.content ? JSON.parse(turn.content).tool || 'unknown' : 'unknown';
            console.log(`${toolCallCount}. Tool call (${turn.tool_call_id})`);
            try {
              const result = JSON.parse(turn.content);
              if (result.success !== undefined) {
                console.log(`   Success: ${result.success}`);
              }
              if (result.agentId) {
                console.log(`   Spawned: ${result.agentId}`);
              }
            } catch (e) {
              console.log(`   Result: ${turn.content.substring(0, 100)}...`);
            }
          }
        });
      }
    }
    
    if (toolCallCount === 0) {
      console.log('No tool calls detected in conversation history');
    }
    console.log();
    console.log(`Total orchestrator tool calls: ${toolCallCount}`);
    console.log();
    
    if (result.spawnedAgents && result.spawnedAgents.length > 0) {
      console.log(`🤖 Spawned ${result.spawnedAgents.length} sub-agent(s):`);
      result.spawnedAgents.forEach(agent => {
        console.log(`   - ${agent.agentId}: ${agent.purpose}`);
      });
      console.log();

      // Wait for sub-agents to complete
      console.log('⏳ Waiting for sub-agents to complete...');
      console.log();

      const maxWait = 60000; // 60 seconds
      const checkInterval = 2000; // 2 seconds
      let waited = 0;

      while (waited < maxWait) {
        const agentsStatus = getAllAgents();
        
        if (agentsStatus.success) {
          const running = agentsStatus.agents.filter(
            a => a.status === 'running' || a.status === 'initializing'
          );
          const completed = agentsStatus.agents.filter(a => a.status === 'completed');
          const failed = agentsStatus.agents.filter(a => a.status === 'failed');

          console.log(`   Status: ${running.length} running, ${completed.length} completed, ${failed.length} failed`);

          if (running.length === 0) {
            console.log();
            console.log('✅ All sub-agents completed!');
            console.log();
            break;
          }
        }

        await sleep(checkInterval);
        waited += checkInterval;
      }

      if (waited >= maxWait) {
        console.log('⚠️  Timeout waiting for sub-agents');
        console.log();
      }

      // Get final agent summary
      const summary = agentManager.getSummary();
      
      if (summary.success) {
        console.log('-'.repeat(80));
        console.log('📊 EXECUTION SUMMARY');
        console.log('-'.repeat(80));
        console.log();
        console.log(`Total agents spawned: ${summary.summary.totalAgents}`);
        console.log(`Total tool calls (all agents): ${summary.summary.totalToolCalls}`);
        console.log(`Average agent execution time: ${Math.round(summary.summary.averageExecutionTime)}ms`);
        console.log();
        console.log(`Status breakdown:`);
        console.log(`  - Initializing: ${summary.summary.byStatus.initializing}`);
        console.log(`  - Running: ${summary.summary.byStatus.running}`);
        console.log(`  - Completed: ${summary.summary.byStatus.completed}`);
        console.log(`  - Failed: ${summary.summary.byStatus.failed}`);
        console.log();

        // Get detailed results for each agent
        const allAgents = getAllAgents();
        if (allAgents.success && allAgents.agents.length > 0) {
          console.log('-'.repeat(80));
          console.log('🔍 DETAILED AGENT RESULTS');
          console.log('-'.repeat(80));
          console.log();

          for (const agent of allAgents.agents) {
            console.log(`${agent.agentId}:`);
            console.log(`  Purpose: ${agent.purpose}`);
            console.log(`  Status: ${agent.status}`);
            console.log(`  Execution time: ${agent.executionTime}ms`);
            console.log(`  Tool calls: ${agent.toolCallCount}`);
            
            // Get detailed tool call history
            const agentHistory = agentManager.getAgentHistory(agent.agentId);
            if (agentHistory.success && agentHistory.toolCalls && agentHistory.toolCalls.length > 0) {
              console.log(`  Tools used:`);
              agentHistory.toolCalls.forEach((call, idx) => {
                console.log(`    ${idx + 1}. ${call.tool}()`);
                if (call.result) {
                  if (call.result.success !== undefined) {
                    console.log(`       Success: ${call.result.success}`);
                  }
                  if (call.result.content) {
                    console.log(`       Content: ${call.result.content.length} chars`);
                  }
                  if (call.result.linesRead) {
                    console.log(`       Lines read: ${call.result.linesRead}`);
                  }
                  if (call.result.changes) {
                    console.log(`       Changes: ${call.result.changes.length} files`);
                  }
                  if (call.result.sources) {
                    console.log(`       Sources: ${call.result.sources.length} found`);
                  }
                }
              });
            }
            
            const agentResult = agentManager.getAgentResult(agent.agentId);
            if (agentResult.success && agentResult.result) {
              console.log(`  Result type: ${agentResult.result.type}`);
              if (agentResult.result.message) {
                const preview = agentResult.result.message.substring(0, 200);
                console.log(`  Message preview: ${preview}${agentResult.result.message.length > 200 ? '...' : ''}`);
              }
            }
            console.log();
          }
        }
      }
    } else {
      console.log('ℹ️  No sub-agents were spawned');
      console.log();
    }

    console.log('-'.repeat(80));
    console.log('📄 ORCHESTRATOR FINAL RESULT');
    console.log('-'.repeat(80));
    console.log();
    console.log(`Result type: ${result.result.type}`);
    
    if (result.result.message) {
      console.log();
      console.log('Complete response:');
      console.log(result.result.message);
    }
    
    if (result.result.toolResults) {
      console.log();
      console.log('Tool results included in response:');
      result.result.toolResults.forEach((tr, idx) => {
        console.log(`  ${idx + 1}. ${tr.tool}: ${tr.result.success ? 'Success' : 'Failed'}`);
      });
    }
    console.log();

    console.log('='.repeat(80));
    console.log('✅ TEST COMPLETED SUCCESSFULLY');
    console.log('='.repeat(80));
    
    return {
      success: true,
      orchestratorResult: result,
      agentsSummary: agentManager.getSummary()
    };

  } catch (error) {
    console.error();
    console.error('❌ TEST FAILED');
    console.error('Error:', error.message);
    console.error();
    console.error('Stack trace:');
    console.error(error.stack);
    console.error();
    
    return {
      success: false,
      error: error.message
    };
  }
}

// Run the test
if (require.main === module) {
  console.log();
  console.log('Starting orchestration flow test...');
  console.log(`Using AI engine: ${process.env.ANALYSIS_ENGINE || 'gemini'}`);
  console.log();

  testOrchestrationFlow()
    .then(result => {
      if (result.success) {
        console.log();
        console.log('🎉 All systems operational!');
        process.exit(0);
      } else {
        console.log();
        console.log('❌ Test failed');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('Unhandled error:', error);
      process.exit(1);
    });
}

module.exports = { testOrchestrationFlow };
