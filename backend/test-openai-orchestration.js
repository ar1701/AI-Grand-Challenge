/**
 * Test OpenAI Orchestration
 * Quick test to verify OpenAI engine works with orchestration system
 */

const axios = require('axios');
const fs = require('fs');

const API_BASE = 'http://localhost:8080'; // Using port from .env

async function testOpenAIOrchestration() {
  console.log('\n=== Testing OpenAI Orchestration ===\n');
  console.log('Current engine should be: openai\n');
  
  try {
    const goal = fs.readFileSync('/Users/ayushraj/Desktop/GitHub Desktop/AI-Grand-Challenge/backend/prompts/orch_agent_prompt.txt', 'utf8');
    
    const response = await axios.post(`${API_BASE}/orchestrate`, {
      goal: goal,
      projectPath: '/Users/ayushraj/    Desktop/GitHub Desktop/AI-Grand-Challenge/frontend'
    });

    console.log('✅ SUCCESS!');
    console.log('\nResult:', response.data.result.message);
    console.log('\nSpawned Agents:', response.data.spawnedAgents.length);
    console.log('Conversation Turns:', response.data.conversationTurns);
    
    if (response.data.spawnedAgents.length > 0) {
      console.log('\nAgent Details:');
      response.data.spawnedAgents.forEach(agent => {
        console.log(`  - ${agent.agentId}: ${agent.purpose}`);
      });
    }
    
  } catch (error) {
    console.error('❌ ERROR:', error.response?.data?.error || error.message);
    
    if (error.response?.data) {
      console.error('\nFull error response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

async function testDirectTool() {
  console.log('\n=== Testing Direct Tool Execution ===\n');
  
  try {
    const response = await axios.post(`${API_BASE}/tools/execute`, {
      toolName: 'file_read',
      params: {
        filePath: '/Users/ayushraj/Desktop/GitHub Desktop/AI-Grand-Challenge/backend/app.js'
      }
    });

    console.log('✅ Tool execution successful!');
    console.log('File:', response.data.filePath);
    console.log('Size:', response.data.size, 'bytes');
    console.log('Lines:', response.data.lines);
    
  } catch (error) {
    console.error('❌ Tool execution failed:', error.response?.data || error.message);
  }
}

async function runTests() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║   OpenAI Orchestration Test Suite                         ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  console.log('\n⚠️  Make sure your .env has:');
  console.log('   ANALYSIS_ENGINE=openai');
  console.log('   OPENAI_API_KEY=sk-...\n');
  console.log('Press Ctrl+C to cancel or wait 3 seconds...\n');
  
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  await testDirectTool();
  await testOpenAIOrchestration();
  
  console.log('\n✅ Tests completed!\n');
}

if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { testOpenAIOrchestration, testDirectTool };
