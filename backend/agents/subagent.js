const { GoogleGenAI } = require('@google/genai');
const OpenAI = require('openai');
const fs = require('fs').promises;
const path = require('path');
const { subagentTools, executeTool, validateToolParams } = require('../tools');
const { recordAgentToolCall, updateAgentState } = require('../tools/spawn_agent');
require('dotenv').config();

const selectedEngine = process.env.ANALYSIS_ENGINE || 'gemini';

/**
 * Sub-Agent
 * Specialized agent spawned by the orchestrator for focused tasks
 * Uses orch_subagent_prompt and has access to all tools except spawn_agent
 */
class SubAgent {
  constructor(agentId, purpose, context = {}) {
    this.agentId = agentId;
    this.purpose = purpose;
    this.context = context;
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
    this.toolCallHistory = [];
  }

  /**
   * Initialize with system prompt
   */
  async initialize() {
    try {
      // Load sub-agent prompt
      const promptPath = path.join(__dirname, '../prompts/orch_subagent_prompt.txt');
      const basePrompt = await fs.readFile(promptPath, 'utf-8');
      
      // Customize system prompt with agent's specific purpose
      this.systemPrompt = `${basePrompt}

---

## **Your Assignment**

Agent ID: ${this.agentId}
Purpose: ${this.purpose}

${this.context.instructions ? `\n### Additional Instructions:\n${this.context.instructions}\n` : ''}

${this.context.files ? `\n### Files to Focus On:\n${this.context.files.map(f => `- ${f}`).join('\n')}\n` : ''}

${this.context.data ? `\n### Context Data:\n${JSON.stringify(this.context.data, null, 2)}\n` : ''}

---

**Remember:**
- Stay focused on your assigned purpose
- Use tools precisely and only when needed
- Never overwrite entire files - use apply_patch for modifications
- Return clear, structured results to the Orchestrator
`;

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Execute the sub-agent's task
   */
  async execute() {
    try {
      console.log(`[${this.agentId}] Starting execution`);
      console.log(`[${this.agentId}] Purpose: ${this.purpose}`);
      
      // Update agent state to running
      updateAgentState(this.agentId, { status: 'running' });

      // Initialize if not already done
      if (!this.systemPrompt) {
        await this.initialize();
      }

      // Build initial prompt
      const initialPrompt = `Begin your task now. Analyze the situation, determine what tools you need, and execute your purpose systematically.`;

      let result;
      if (this.engine === 'openai') {
        result = await this.executeWithOpenAI(initialPrompt);
      } else {
        result = await this.executeWithGemini(initialPrompt);
      }

      console.log(`[${this.agentId}] Completed successfully`);
      console.log(`[${this.agentId}] Tool calls made: ${this.toolCallHistory.length}`);
      
      // Update agent state to completed
      updateAgentState(this.agentId, { 
        status: 'completed',
        result 
      });

      return {
        success: true,
        agentId: this.agentId,
        purpose: this.purpose,
        result,
        toolCallsCount: this.toolCallHistory.length
      };
    } catch (error) {
      console.error(`[${this.agentId}] Failed with error: ${error.message}`);
      
      // Update agent state to failed
      updateAgentState(this.agentId, { 
        status: 'failed',
        error: error.message 
      });

      return {
        success: false,
        agentId: this.agentId,
        error: error.message
      };
    }
  }

  /**
   * Execute with OpenAI
   */
  async executeWithOpenAI(initialPrompt) {
    const tools = subagentTools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      }
    }));

    const messages = [
      { role: 'system', content: this.systemPrompt },
      { role: 'user', content: initialPrompt }
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

      if (message.tool_calls && message.tool_calls.length > 0) {
        console.log(`[${this.agentId}] Tool calls in iteration ${iterations + 1}: ${message.tool_calls.length}`);
        
        for (const toolCall of message.tool_calls) {
          const toolName = toolCall.function.name;
          const params = JSON.parse(toolCall.function.arguments);
          
          console.log(`[${this.agentId}] Calling ${toolName}()`);
          if (toolName === 'file_read') {
            console.log(`[${this.agentId}]   File: ${params.filePath}`);
          } else if (toolName === 'get_diffs') {
            console.log(`[${this.agentId}]   Project: ${params.projectPath}`);
          } else if (toolName === 'web_search') {
            console.log(`[${this.agentId}]   Query: ${params.query}`);
          }
          
          const result = await executeTool(toolName, params);
          console.log(`[${this.agentId}]   Result: ${result.success ? '✓' : '✗'} ${result.message || ''}`);
          
          this.toolCallHistory.push({
            tool: toolName,
            params,
            result,
            timestamp: new Date()
          });

          recordAgentToolCall(this.agentId, toolName, params, result);

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(result)
          });
        }
        iterations++;
        console.log(`[${this.agentId}] Tool results added to context. Continuing to iteration ${iterations + 1}...`);
        // Loop continues - agent will generate next response with tool results
      } else {
        // AI decided task is complete
        console.log(`[${this.agentId}] No more tool calls. Task complete.`);
        return {
          type: 'completion',
          message: message.content,
          iterations,
          toolCallCount: this.toolCallHistory.length
        };
      }
    }

    console.log(`[${this.agentId}] Maximum iterations (${maxIterations}) reached. Stopping.`);
    return {
      type: 'timeout',
      message: 'Maximum iterations reached',
      iterations
    };
  }

  /**
   * Execute with Gemini
   */
  async executeWithGemini(initialPrompt) {
    const config = {
      tools: subagentTools.map(tool => ({
        functionDeclarations: [tool]
      })),
      temperature: 0.7,
      maxOutputTokens: 8192
    };

    this.conversationHistory.push({
      role: 'user',
      parts: [{ text: `${this.systemPrompt}\n\n${initialPrompt}` }]
    });

    const response = await this.client.models.generateContent({
      model: this.model,
      contents: this.conversationHistory,
      config
    });

    return await this.processResponse(response);
  }

  /**
   * Process Gemini response and handle tool calls
   */
  async processResponse(response, maxIterations = 10) {
    let iterations = 0;

    while (iterations < maxIterations) {
      const candidate = response.response.candidates[0];
      
      if (!candidate || !candidate.content) {
        return {
          type: 'error',
          message: 'No response from model'
        };
      }

      const content = candidate.content;
      const parts = content.parts;

      // Check for function calls
      const functionCalls = parts.filter(part => part.functionCall);
      
      if (functionCalls.length > 0) {
        // AI decided to call tools - execute and continue
        await this.handleToolCalls(functionCalls);

        iterations++;
        console.log(`[${this.agentId}] Tool results added to context. Continuing to iteration ${iterations + 1}...`);
        
        // Generate next response with tool results in context
        response = await this.client.models.generateContent({
          model: this.model,
          contents: this.conversationHistory,
          config: {
            tools: subagentTools.map(tool => ({
              functionDeclarations: [tool]
            })),
            temperature: 0.7,
            maxOutputTokens: 8192
          }
        });

        // Continue loop - may have more tool calls or finish
        continue;
      }

      // AI decided no more tool calls needed - task complete
      console.log(`[${this.agentId}] No more tool calls. Task complete.`);
      
      // No more function calls, extract final text response
      const textParts = parts.filter(part => part.text);
      const responseText = textParts.map(part => part.text).join('\n');

      // Add to history
      this.conversationHistory.push({
        role: 'model',
        parts: [{ text: responseText }]
      });

      return {
        type: 'completion',
        message: responseText,
        iterations,
        toolCallCount: this.toolCallHistory.length
      };
    }

    console.log(`[${this.agentId}] Maximum iterations (${maxIterations}) reached. Stopping.`);
    return {
      type: 'timeout',
      message: 'Maximum iterations reached',
      iterations
    };
  }

  /**
   * Handle tool calls
   */
  async handleToolCalls(functionCalls) {
    const toolResults = [];
    
    console.log(`[${this.agentId}] Processing ${functionCalls.length} tool call(s)`);

    for (const call of functionCalls) {
      const toolName = call.functionCall.name;
      const params = call.functionCall.args;
      
      console.log(`[${this.agentId}] Calling ${toolName}()`);
      if (toolName === 'file_read') {
        console.log(`[${this.agentId}]   File: ${params.filePath}`);
      } else if (toolName === 'get_diffs') {
        console.log(`[${this.agentId}]   Project: ${params.projectPath}`);
      } else if (toolName === 'web_search') {
        console.log(`[${this.agentId}]   Query: ${params.query}`);
      }

      // Validate parameters
      const validation = validateToolParams(toolName, params);
      if (!validation.valid) {
        console.log(`[${this.agentId}]   Validation failed: ${validation.errors.join(', ')}`);
        toolResults.push({
          tool: toolName,
          success: false,
          errors: validation.errors
        });
        continue;
      }

      // Execute the tool
      const result = await executeTool(toolName, params);
      console.log(`[${this.agentId}]   Result: ${result.success ? '✓' : '✗'} ${result.message || ''}`);
      
      // Record tool call in agent's history
      this.toolCallHistory.push({
        tool: toolName,
        params,
        result,
        timestamp: new Date()
      });

      // Record in global agent manager
      recordAgentToolCall(this.agentId, toolName, params, result);

      toolResults.push({
        tool: toolName,
        params,
        result
      });
    }

    // Add tool results to conversation history
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
  }

  /**
   * Get agent execution summary
   */
  getSummary() {
    return {
      agentId: this.agentId,
      purpose: this.purpose,
      toolCallCount: this.toolCallHistory.length,
      toolsUsed: [...new Set(this.toolCallHistory.map(call => call.tool))],
      conversationTurns: this.conversationHistory.length
    };
  }

  /**
   * Get detailed tool call history
   */
  getToolCallHistory() {
    return this.toolCallHistory.map(call => ({
      tool: call.tool,
      timestamp: call.timestamp,
      success: call.result.success
    }));
  }

  /**
   * Additional query to the sub-agent (for multi-turn if needed)
   */
  async ask(question) {
    this.conversationHistory.push({
      role: 'user',
      parts: [{ text: question }]
    });

    const response = await this.client.models.generateContent({
      model: this.model,
      contents: this.conversationHistory,
      config: {
        tools: subagentTools.map(tool => ({
          functionDeclarations: [tool]
        })),
        temperature: 0.7,
        maxOutputTokens: 8192
      }
    });

    return await this.processResponse(response);
  }
}

/**
 * Factory function to create and execute a sub-agent
 */
async function createAndExecuteSubAgent(agentId, purpose, context = {}) {
  const subAgent = new SubAgent(agentId, purpose, context);
  return await subAgent.execute();
}

module.exports = {
  SubAgent,
  createAndExecuteSubAgent
};
