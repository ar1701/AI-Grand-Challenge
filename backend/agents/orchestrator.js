const { GoogleGenAI } = require('@google/genai');
const OpenAI = require('openai');
const fs = require('fs').promises;
const path = require('path');
const { orchestratorTools, executeTool, validateToolParams } = require('../tools');
const { executeSpawnAgent, updateAgentState, recordAgentToolCall, getAgentResult, getAgentToolHistory } = require('../tools/spawn_agent');
require('dotenv').config();

const selectedEngine = process.env.ANALYSIS_ENGINE || 'gemini';

/**
 * Orchestrator Agent
 * The main hierarchical controller that coordinates specialized sub-agents
 * Uses the orch_agent_prompt for persona and capabilities
 */
class OrchestratorAgent {
  constructor() {
    this.engine = selectedEngine.toLowerCase();
    
    if (this.engine === 'openai') {
      this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      this.model = 'gpt-4o';
    } else {
      this.client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      this.model = 'gemini-2.0-flash-exp';
    }
    
    this.systemPrompt = null;
    this.conversationHistory = [];
    this.spawnedAgents = [];
    this.orchestratorToolHistory = [];
  }

  /**
   * Initialize with system prompt
   */
  async initialize() {
    try {
      // Load orchestrator agent prompt
      const promptPath = path.join(__dirname, '../prompts/orch_agent_prompt.txt');
      this.systemPrompt = await fs.readFile(promptPath, 'utf-8');
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Execute a task with the orchestrator agent
   */
  async execute(userPrompt, projectPath, options = {}) {
    try {
      // Initialize if not already done
      if (!this.systemPrompt) {
        await this.initialize();
      }

      // Build the full prompt with project context
      const fullPrompt = this.buildPrompt(userPrompt, projectPath);
      
      let executionResult;
      if (this.engine === 'openai') {
        executionResult = await this.executeWithOpenAI(fullPrompt, projectPath);
      } else {
        executionResult = await this.executeWithGemini(fullPrompt, projectPath);
      }

      // Wait for all spawned agents to complete and collect their results
      const agentResults = await this.waitForSpawnedAgents();
      
      // Include agent results in the response
      if (agentResults.length > 0) {
        executionResult.agentResults = agentResults;
      }

      return executionResult;
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Execute with OpenAI
   */
  async executeWithOpenAI(fullPrompt, projectPath) {
    // Convert tools to OpenAI format
    const tools = orchestratorTools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      }
    }));

    // Initialize messages
    const messages = [
      { role: 'system', content: this.systemPrompt },
      { role: 'user', content: fullPrompt }
    ];

    let iterations = 0;
    const maxIterations = 10;

    while (iterations < maxIterations) {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages,
        tools,
        tool_choice: 'auto',
        temperature: 0.7
      });

      const message = response.choices[0].message;
      messages.push(message);

      // Check if there are tool calls
      if (message.tool_calls && message.tool_calls.length > 0) {
        console.log(`[Orchestrator] Tool calls in iteration ${iterations + 1}: ${message.tool_calls.length}`);
        
        // Execute tool calls synchronously and collect results
        for (const toolCall of message.tool_calls) {
          const toolName = toolCall.function.name;
          const params = JSON.parse(toolCall.function.arguments);
          
          console.log(`[Orchestrator] Calling ${toolName}()`);
          if (toolName === 'spawn_agent') {
            console.log(`[Orchestrator]   Purpose: ${params.purpose}`);
          } else if (toolName === 'file_read') {
            console.log(`[Orchestrator]   File: ${params.filePath}`);
          } else if (toolName === 'dependency_graph') {
            console.log(`[Orchestrator]   Project: ${params.projectPath}`);
          }
          
          const result = await executeTool(toolName, params);
          console.log(`[Orchestrator]   Result: ${result.success ? '✓' : '✗'} ${result.message || ''}`);
          
          // Track this tool call
          this.orchestratorToolHistory.push({
            tool: toolName,
            success: result.success,
            timestamp: new Date().toISOString()
          });
          
          // Track spawned agents
          if (toolName === 'spawn_agent' && result.success) {
            this.spawnedAgents.push({
              agentId: result.agentId,
              purpose: params.purpose,
              spawnedAt: new Date()
            });
          }

          // Add tool result to conversation - orchestrator will see this in next iteration
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(result)
          });
        }
        
        iterations++;
        console.log(`[Orchestrator] Tool results added to context. Continuing to iteration ${iterations + 1}...`);
        // Loop continues - orchestrator will generate next response with tool results in context
        // It may decide to call more tools or finish
      } else {
        // AI decided no more tool calls needed - task complete
        console.log(`[Orchestrator] No more tool calls. Task complete.`);
        return {
          success: true,
          result: {
            type: 'completion',
            message: message.content
          },
          spawnedAgents: this.spawnedAgents,
          orchestratorToolHistory: this.orchestratorToolHistory,
          conversationTurns: messages.length
        };
      }
    }

    // Max iterations reached
    console.log(`[Orchestrator] Maximum iterations (${maxIterations}) reached. Stopping.`);
    return {
      success: true,
      result: {
        type: 'timeout',
        message: 'Maximum iterations reached'
      },
      spawnedAgents: this.spawnedAgents,
      orchestratorToolHistory: this.orchestratorToolHistory,
      conversationTurns: messages.length
    };
  }

  /**
   * Execute with Gemini
   */
  async executeWithGemini(fullPrompt, projectPath) {
    // Configure with function calling
    const config = {
      tools: orchestratorTools.map(tool => ({
        functionDeclarations: [tool]
      })),
      temperature: 0.7,
      maxOutputTokens: 8192
    };

    // Add conversation to history
    this.conversationHistory.push({
      role: 'user',
      parts: [{ text: fullPrompt }]
    });

    // Track iterations
    this.iterationCount = 0;
    this.maxIterations = 15;

    // Generate response with tool calling
    const response = await this.client.models.generateContent({
      model: this.model,
      contents: this.conversationHistory,
      config
    });

    // Process response and handle tool calls
    const result = await this.processResponse(response, projectPath);

    return {
      success: true,
      result,
      spawnedAgents: this.spawnedAgents,
      orchestratorToolHistory: this.orchestratorToolHistory,
      conversationTurns: this.conversationHistory.length,
      iterations: this.iterationCount
    };
  }

  /**
   * Build the complete prompt with system instructions and user request
   */
  buildPrompt(userPrompt, projectPath) {
    return `${this.systemPrompt}

---

## **Project Context**

Project Path: ${projectPath}

## **Developer's Goal**

${userPrompt}

---

**Instructions:**
1. Start by calling dependency_graph() to understand the project structure
2. Break down the goal into specific tasks
3. Spawn specialized agents if needed for parallel work
4. Use tools strategically to gather context and make informed decisions
5. Generate minimal, precise patches for any code modifications
6. Validate your reasoning at each step
7. Provide a clear summary of actions taken and results
`;
  }

  /**
   * Process Gemini response and handle tool calls
   */
  async processResponse(response, projectPath) {
    const candidate = response.response.candidates[0];
    
    if (!candidate || !candidate.content) {
      return {
        type: 'error',
        message: 'No response from model'
      };
    }

    const content = candidate.content;
    const parts = content.parts;

    // Check if there are function calls
    const functionCalls = parts.filter(part => part.functionCall);
    
    if (functionCalls.length > 0) {
      // AI decided to call tools - execute them and continue
      return await this.handleToolCalls(functionCalls, projectPath);
    }

    // AI decided no more tool calls needed - task complete
    console.log(`[Orchestrator] No more tool calls. Task complete.`);
    
    // Regular text response
    const textParts = parts.filter(part => part.text);
    const responseText = textParts.map(part => part.text).join('\n');

    // Add assistant response to history
    this.conversationHistory.push({
      role: 'model',
      parts: [{ text: responseText }]
    });

    return {
      type: 'text',
      message: responseText
    };
  }

  /**
   * Handle multiple tool calls
   */
  async handleToolCalls(functionCalls, projectPath) {
    const toolResults = [];
    
    console.log(`[Orchestrator] Processing ${functionCalls.length} tool call(s)`);

    for (const call of functionCalls) {
      const toolName = call.functionCall.name;
      const params = call.functionCall.args;
      
      console.log(`[Orchestrator] Calling ${toolName}()`);
      if (toolName === 'spawn_agent') {
        console.log(`[Orchestrator]   Purpose: ${params.purpose}`);
      } else if (toolName === 'file_read') {
        console.log(`[Orchestrator]   File: ${params.filePath}`);
      } else if (toolName === 'dependency_graph') {
        console.log(`[Orchestrator]   Project: ${params.projectPath}`);
      }

      // Validate parameters
      const validation = validateToolParams(toolName, params);
      if (!validation.valid) {
        console.log(`[Orchestrator]   Validation failed: ${validation.errors.join(', ')}`);
        toolResults.push({
          tool: toolName,
          success: false,
          errors: validation.errors
        });
        continue;
      }

      // Execute the tool
      const result = await executeTool(toolName, params);
      console.log(`[Orchestrator]   Result: ${result.success ? '✓' : '✗'} ${result.message || ''}`);
      
      // Track this tool call
      this.orchestratorToolHistory.push({
        tool: toolName,
        success: result.success,
        timestamp: new Date().toISOString()
      });
      
      // Track spawned agents
      if (toolName === 'spawn_agent' && result.success) {
        this.spawnedAgents.push({
          agentId: result.agentId,
          purpose: params.purpose,
          spawnedAt: new Date()
        });
      }

      toolResults.push({
        tool: toolName,
        params,
        result
      });
    }

    // Add tool results to conversation history as function responses
    const functionResponses = toolResults.map(tr => ({
      functionResponse: {
        name: tr.tool,
        response: tr.result
      }
    }));

    this.conversationHistory.push({
      role: 'function',
      parts: functionResponses
    });

    // Check iteration limit before continuing
    this.iterationCount++;
    if (this.iterationCount >= this.maxIterations) {
      console.log(`[Orchestrator] Maximum iterations (${this.maxIterations}) reached. Stopping.`);
      return {
        type: 'timeout',
        message: `Maximum iterations (${this.maxIterations}) reached`,
        toolResults,
        iterations: this.iterationCount
      };
    }

    console.log(`[Orchestrator] Tool results added to context. Continuing to iteration ${this.iterationCount + 1}...`);
    
    // Continue the conversation to get the next response
    // Orchestrator will analyze tool results and decide next action:
    // - Call more tools if needed
    // - Generate final response if task complete
    const nextResponse = await this.client.models.generateContent({
      model: this.model,
      contents: this.conversationHistory,
      config: {
        tools: orchestratorTools.map(tool => ({
          functionDeclarations: [tool]
        })),
        temperature: 0.7,
        maxOutputTokens: 8192
      }
    });

    // Recursively process the next response (might have more tool calls)
    return await this.processResponse(nextResponse, projectPath);
  }

  /**
   * Wait for all spawned agents to complete and collect their results
   */
  async waitForSpawnedAgents(timeoutMs = 120000) {
    if (this.spawnedAgents.length === 0) {
      return [];
    }

    console.log(`[Orchestrator] Waiting for ${this.spawnedAgents.length} spawned agent(s) to complete...`);
    
    const startTime = Date.now();
    const agentResults = [];

    for (const spawnedAgent of this.spawnedAgents) {
      const agentId = spawnedAgent.agentId;
      const purpose = spawnedAgent.purpose;
      
      // Wait for this specific agent
      let completed = false;
      while (Date.now() - startTime < timeoutMs) {
        const result = getAgentResult(agentId);
        
        if (result.success) {
          // Agent completed successfully
          console.log(`[Orchestrator] ✓ ${agentId} completed`);
          
          // Get tool call history for this agent
          const toolHistoryResult = getAgentToolHistory(agentId);
          const toolHistory = toolHistoryResult.success ? toolHistoryResult.toolCalls : [];
          
          agentResults.push({
            agentId,
            purpose,
            success: true,
            result: result.result,
            executionTime: result.executionTime,
            toolCallCount: result.toolCallCount,
            toolHistory: toolHistory
          });
          completed = true;
          break;
        }
        
        // Check if agent failed
        if (result.error && result.error.includes('has not completed yet')) {
          // Still running, wait a bit
          await new Promise(resolve => setTimeout(resolve, 500));
          continue;
        } else if (result.error) {
          // Agent failed or not found
          console.log(`[Orchestrator] ✗ ${agentId} failed: ${result.error}`);
          agentResults.push({
            agentId,
            purpose,
            success: false,
            error: result.error
          });
          completed = true;
          break;
        }
      }
      
      if (!completed) {
        console.log(`[Orchestrator] ⏱ ${agentId} timed out`);
        agentResults.push({
          agentId,
          purpose,
          success: false,
          error: 'Timeout waiting for agent to complete'
        });
      }
    }

    console.log(`[Orchestrator] All spawned agents processed. Completed: ${agentResults.filter(r => r.success).length}/${this.spawnedAgents.length}`);
    return agentResults;
  }

  /**
   * Get conversation history
   */
  getHistory() {
    return this.conversationHistory;
  }

  /**
   * Clear conversation history and reset
   */
  reset() {
    this.conversationHistory = [];
    this.spawnedAgents = [];
  }

  /**
   * Get status of spawned agents
   */
  getSpawnedAgentsStatus() {
    return this.spawnedAgents;
  }

  /**
   * Multi-turn conversation support
   */
  async continueConversation(userMessage) {
    this.conversationHistory.push({
      role: 'user',
      parts: [{ text: userMessage }]
    });

    const response = await this.client.models.generateContent({
      model: this.model,
      contents: this.conversationHistory,
      config: {
        tools: orchestratorTools.map(tool => ({
          functionDeclarations: [tool]
        })),
        temperature: 0.7,
        maxOutputTokens: 8192
      }
    });

    return await this.processResponse(response, null);
  }

  /**
   * Generate structured patches using structured output
   */
  async generatePatches(analysisResult, projectPath) {
    const { patchGenerationSchema } = require('../tools');
    
    const patchPrompt = `Based on the following analysis, generate structured patches to fix the issues:

${JSON.stringify(analysisResult, null, 2)}

Generate minimal, precise patches following the schema. Each patch should:
1. Target only the necessary changes
2. Include clear descriptions
3. Preserve existing code structure
4. Be safe to apply

Project Path: ${projectPath}
`;

    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: patchPrompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: patchGenerationSchema,
          temperature: 0.3
        }
      });

      const patchData = JSON.parse(response.response.text());
      
      return {
        success: true,
        patches: patchData
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = OrchestratorAgent;
