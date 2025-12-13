const dotenv = require('dotenv').config()
const express = require('express')
const app = express()
const port = process.env.PORT
const apiKey = process.env.GEMINI_API_KEY
const selectedEngine = process.env.ANALYSIS_ENGINE || 'gemini';
const crypto = require('crypto');
const util = require('util');
const { execFile } = require('child_process');
const execFileAsync = util.promisify(execFile);
const { redisClient, connectRedis } = require('./utils/redisClient');
console.log(`Server configured to use analysis engine: ${selectedEngine.toUpperCase()}`);


const { GoogleGenAI } = require('@google/genai')
const { generateContent, analyzeMultipleFiles } = require("./utils/codeAnalysis.js")
const fs = require('fs')
const path = require('path')
const TokenManager = require('./utils/tokenManager')
const { analyzeMultipleFilesWithOpenAI } = require('./utils/openaiAnalysis.js');

// Import orchestration system
const { OrchestratorAgent, agentManager } = require('./agents');
const { executeTool } = require('./tools');

app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Middleware to handle JSON parsing errors
app.use((error, req, res, next) => {
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    console.error(`[${new Date().toISOString()}] JSON Parse Error:`, error.message);
    return res.status(400).json({ 
      success: false, 
      error: 'Invalid JSON in request body' 
    });
  }
  next();
});

// Debug middleware to log all requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  console.log(`[${new Date().toISOString()}] Content-Type: ${req.headers['content-type']}`);
  next();
});

// Initialize Google GenAI
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const tokenManager = new TokenManager(genAI);

function getContentHash(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

async function computeDirectoryFingerprint(rootPath, maxFiles = 2000) {
  const hash = crypto.createHash('sha1');
  const stack = [rootPath];
  let processed = 0;

  while (stack.length > 0 && processed < maxFiles) {
    const current = stack.pop();
    try {
      const entries = await fs.promises.readdir(current, { withFileTypes: true });
      for (const entry of entries) {
        if (['node_modules', '.git', 'dist', 'build', 'out', 'coverage', 'tmp'].includes(entry.name)) {
          continue;
        }

        const fullPath = path.join(current, entry.name);
        if (entry.isDirectory()) {
          stack.push(fullPath);
        } else if (entry.isFile()) {
          try {
            const stats = await fs.promises.stat(fullPath);
            hash.update(fullPath.replace(rootPath, ''));
            hash.update(String(stats.mtimeMs));
            hash.update(String(stats.size));
            processed++;
            if (processed >= maxFiles) break;
          } catch (fileErr) {
            continue;
          }
        }
      }
    } catch (dirErr) {
      continue;
    }
  }

  hash.update(`count:${processed}`);
  return `fp:${hash.digest('hex')}`;
}

async function getProjectStateSignature(projectPath) {
  try {
    const [headResult, statusResult] = await Promise.all([
      execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: projectPath }),
      execFileAsync('git', ['status', '--porcelain'], { cwd: projectPath })
    ]);
    const gitSignature = `${headResult.stdout.trim()}|${statusResult.stdout.trim()}`;
    if (gitSignature.trim()) {
      return gitSignature;
    }
  } catch (gitError) {
    console.warn(`[${new Date().toISOString()}] Unable to derive git signature for ${projectPath}: ${gitError.message}`);
  }

  try {
    return await computeDirectoryFingerprint(projectPath);
  } catch (fpError) {
    console.warn(`[${new Date().toISOString()}] Unable to derive directory fingerprint for ${projectPath}: ${fpError.message}`);
    return null;
  }
}

// app.post("/analyze-multiple-files", async (req, res) => {
//   try {
//     // REMOVED: The 'engine' is no longer read from the request body
//     const { filePaths, instructions } = req.body;
    
//     if (!filePaths || !Array.isArray(filePaths) || filePaths.length === 0) {
//       return res.status(400).json({ success: false, error: "Please provide an array of file paths" });
//     }

//     const batches = await tokenManager.processFiles(filePaths);
//     const batchResults = [];
    
//     for (const batch of batches) {
//       const fullFilePaths = batch.map(file => file.path);
//       let analysisResult;

//       // CHANGED: Logic now uses the 'selectedEngine' variable defined globally
//       if (selectedEngine.toLowerCase() === 'openai') {
//         analysisResult = await analyzeMultipleFilesWithOpenAI(batch);
//       } else {
//         analysisResult = await analyzeMultipleFiles(batch);
//       }
      
//       batchResults.push({
//         engine: selectedEngine, // Use the globally configured engine
//         files: fullFilePaths,
//         analysis: JSON.parse(analysisResult),
//       });
//     }
    
//     return res.json({ success: true, batches: batchResults });
//   } catch (error) {
//     console.error("Error in /analyze-multiple-files:", error);
//     return res.status(500).json({ success: false, error: "Failed to analyze files" });
//   }
// });


// In app.js
app.post("/analyze-multiple-files", async (req, res) => {
  // Force logging to stdout
  console.log("=".repeat(80));
  console.log(`🔥 [${new Date().toISOString()}] NEW REQUEST TO /analyze-multiple-files`);
  console.log(`🔥 Request method: ${req.method}`);
  console.log(`🔥 Request headers:`, JSON.stringify(req.headers, null, 2));
  console.log(`🔥 Request body:`, JSON.stringify(req.body, null, 2));
  console.log("=".repeat(80));
  
  try {
    // Check if req.body exists and has the required properties
    if (!req.body) {
      console.error(`[${new Date().toISOString()}] --- FATAL ERROR in route --- req.body is undefined`);
      return res.status(400).json({ 
        success: false, 
        error: "Request body is missing. Please ensure you're sending a JSON request with Content-Type: application/json" 
      });
    }

    const { filePaths } = req.body;
    
    // Validate filePaths
    if (!filePaths) {
      console.error(`[${new Date().toISOString()}] --- ERROR --- filePaths is missing from request body`);
      return res.status(400).json({ 
        success: false, 
        error: "filePaths is required in the request body" 
      });
    }

    if (!Array.isArray(filePaths)) {
      console.error(`[${new Date().toISOString()}] --- ERROR --- filePaths must be an array`);
      return res.status(400).json({ 
        success: false, 
        error: "filePaths must be an array of file paths" 
      });
    }

    console.log(`[${new Date().toISOString()}] Processing ${filePaths.length} file(s)`);
    // ... validation

    const batches = await tokenManager.processFiles(filePaths);
    console.log(`[${new Date().toISOString()}] Created ${batches.length} batch(es).`);
    const batchResults = [];

    for (const [index, batch] of batches.entries()) {
      console.log(`[${new Date().toISOString()}] --- Starting processing for batch #${index + 1} ---`);
      const fullFilePaths = batch.map(file => file.path);
      let analysisResult;

      const batchContent = batch.map(f => f.content).join('');
      const cacheKey = getContentHash(batchContent);
      console.log(`[${new Date().toISOString()}] 1. Batch #${index + 1}: Generated cache key: ${cacheKey}`);
      console.log(`[${new Date().toISOString()}] 1a. Batch #${index + 1}: Content length: ${batchContent.length} chars`);
      console.log(`[${new Date().toISOString()}] 1b. Batch #${index + 1}: First 100 chars: ${batchContent.substring(0, 100).replace(/\n/g, '\\n')}`);

      console.log(`[${new Date().toISOString()}] 2. Batch #${index + 1}: Checking Redis for key...`);
      const cachedResult = await redisClient.get(cacheKey);
      console.log(`[${new Date().toISOString()}] 3. Batch #${index + 1}: Finished checking Redis.`);

      if (cachedResult) {
        console.log(`[${new Date().toISOString()}] 4a. Batch #${index + 1}: Cache HIT for key: ${cacheKey}`);
        analysisResult = cachedResult;
      } else {
        console.log(`[${new Date().toISOString()}] 4b. Batch #${index + 1}: Cache MISS for key: ${cacheKey}`);
        
        // Debug: Let's see what keys exist in Redis
        const existingKeys = await redisClient.keys('*');
        console.log(`[${new Date().toISOString()}] 4c. Batch #${index + 1}: Existing Redis keys: ${existingKeys.slice(0, 5)}`);
        
        console.log(`[${new Date().toISOString()}] 5. Batch #${index + 1}: Calling AI analysis...`);
        if (selectedEngine.toLowerCase() === 'openai') {
          analysisResult = await analyzeMultipleFilesWithOpenAI(batch);
        } else {
          analysisResult = await analyzeMultipleFiles(batch);
        }
        console.log(`[${new Date().toISOString()}] 6. Batch #${index + 1}: AI analysis finished.`);
        
        console.log(`[${new Date().toISOString()}] 7. Batch #${index + 1}: Setting result in Redis...`);
        await redisClient.set(cacheKey, analysisResult, { EX: 3600 });
        console.log(`[${new Date().toISOString()}] 8. Batch #${index + 1}: Finished setting result in Redis.`);
      }

      batchResults.push({
        engine: selectedEngine,
        files: fullFilePaths,
        analysis: JSON.parse(analysisResult),
      });
      console.log(`[${new Date().toISOString()}] --- Finished processing for batch #${index + 1} ---`);
    }
    
    console.log(`[${new Date().toISOString()}] --- Sending final response ---`);
    return res.json({ success: true, batches: batchResults });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] --- FATAL ERROR in route ---`, error);
    return res.status(500).json({ success: false, error: "Failed to analyze files" });
  }
});



app.post("/code-block", async (req,res)=>{
    console.log(`[${new Date().toISOString()}] POST /code-block`);
    console.log(`[${new Date().toISOString()}] Content-Type: ${req.headers['content-type']}`);
    
    try {
        const {codeBlock, filename} = req.body;
        console.log(`[${new Date().toISOString()}] Processing single file: ${filename || 'unnamed'}`);
        console.log(`[${new Date().toISOString()}] Code block length: ${codeBlock ? codeBlock.length : 0} characters`);
        
        // Count tokens before processing
        const tokenCount = await tokenManager.countTokens(codeBlock);
        console.log(`[${new Date().toISOString()}] Token count: ${tokenCount}`);
        
        // Check if token count exceeds limits
        if (tokenCount > 30000) { // Adjust based on model limits
          return res.status(400).json({
            success: false,
            error: "Code block exceeds token limit",
            tokenCount
          });
        }

        // Generate cache key for the code block
        const cacheKey = getContentHash(codeBlock);
        console.log(`[${new Date().toISOString()}] Generated cache key: ${cacheKey}`);
        
        // Check Redis cache first
        console.log(`[${new Date().toISOString()}] Checking Redis cache...`);
        const cachedResult = await redisClient.get(cacheKey);
        
        let rawResponse;
        if (cachedResult) {
            console.log(`[${new Date().toISOString()}] Cache HIT! Using cached result.`);
            rawResponse = cachedResult;
        } else {
            console.log(`[${new Date().toISOString()}] Cache MISS. Calling AI model...`);
            
            // Use the generateContent function directly from codeAnalysis.js
            rawResponse = await generateContent(codeBlock);
            
            // Store in cache
            console.log(`[${new Date().toISOString()}] Storing result in Redis cache...`);
            await redisClient.set(cacheKey, rawResponse, { EX: 3600 }); // Cache for 1 hour
            console.log(`[${new Date().toISOString()}] Result cached successfully.`);
        }
        
        // Parse the JSON response from the AI model
        let parsedResponse;
        try {
            // The AI returns JSON wrapped in markdown code blocks, so extract it
            const jsonMatch = rawResponse.match(/```json\n([\s\S]*?)\n```/);
            if (jsonMatch) {
                parsedResponse = JSON.parse(jsonMatch[1]);
            } else {
                // If no markdown wrapper, try parsing directly
                parsedResponse = JSON.parse(rawResponse);
            }
        } catch (parseError) {
            console.error("Error parsing AI response:", parseError);
            console.log("Raw response:", rawResponse);
            return res.status(500).json({
                success: false,
                error: "Failed to parse AI response"
            });
        }

        // Convert the parsed response to the expected format
        let entries = [];
        if (parsedResponse.files && parsedResponse.files[0] && parsedResponse.files[0].vulnerabilities) {
            entries = parsedResponse.files[0].vulnerabilities;
        }

        return res.json({
            success: true,
            tokenCount,
            result: {
                entries: entries
            }
        });
    } catch (error) {
        console.error("Error in /code-block:", error);
        return res.status(500).json({
            success: false,
            error: "Failed to analyze code"
        });
    }
})

// ============================================================================
// ORCHESTRATION SYSTEM API ENDPOINTS
// (Now supports both Gemini and OpenAI)
// ============================================================================

/**
 * POST /orchestrate
 * Main endpoint for the orchestration system
 * Receives: system prompt (optional), user goal, and project path
 * Works with both Gemini and OpenAI based on ANALYSIS_ENGINE setting
 */
app.post("/orchestrate", async (req, res) => {
  console.log(`[${new Date().toISOString()}] POST /orchestrate (Engine: ${selectedEngine})`);
  
  try {
    let { goal, projectPath, customPrompt } = req.body;
    
    // Validate required parameters
    if (!goal) {
      return res.status(400).json({
        success: false,
        error: "Missing required parameter: goal"
      });
    }

    if (!projectPath) {
      return res.status(400).json({
        success: false,
        error: "Missing required parameter: projectPath"
      });
    }

    // Check if goal is a file path and read it automatically
    if (typeof goal === 'string' && (goal.endsWith('.txt') || goal.endsWith('.md')) && fs.existsSync(goal)) {
      console.log(`[${new Date().toISOString()}] Reading goal from file: ${goal}`);
      try {
        goal = fs.readFileSync(goal, 'utf-8');
        console.log(`[${new Date().toISOString()}] Successfully loaded goal from file (${goal.length} characters)`);
      } catch (error) {
        return res.status(400).json({
          success: false,
          error: `Failed to read goal file: ${error.message}`
        });
      }
    }

    // Validate project path exists
    if (!fs.existsSync(projectPath)) {
      return res.status(400).json({
        success: false,
        error: `Project path does not exist: ${projectPath}`
      });
    }

    // Build cache identity (goal + project state + engine) to reuse orchestrator work when nothing changed
    let orchestratorCacheKey = null;
    try {
      const projectSignature = await getProjectStateSignature(projectPath);
      const cacheIdentity = {
        engine: selectedEngine,
        goal,
        projectPath,
        customPrompt: customPrompt || '',
        projectSignature: projectSignature || `unknown-${Date.now()}`
      };
      orchestratorCacheKey = `orchestrator:${getContentHash(JSON.stringify(cacheIdentity))}`;
      console.log(`[${new Date().toISOString()}] Orchestrator cache key: ${orchestratorCacheKey}`);
      if (projectSignature) {
        console.log(`[${new Date().toISOString()}] Project signature: ${projectSignature.substring(0, 80)}${projectSignature.length > 80 ? '...' : ''}`);
      }
    } catch (signatureError) {
      console.warn(`[${new Date().toISOString()}] Unable to build orchestrator cache identity: ${signatureError.message}`);
    }

    if (orchestratorCacheKey) {
      try {
        const cachedPayload = await redisClient.get(orchestratorCacheKey);
        if (cachedPayload) {
          console.log(`[${new Date().toISOString()}] ✅ Orchestrator cache HIT (${orchestratorCacheKey})`);
          try {
            return res.json(JSON.parse(cachedPayload));
          } catch (parseError) {
            console.warn(`[${new Date().toISOString()}] Cached orchestrator payload malformed: ${parseError.message}`);
          }
        }
        console.log(`[${new Date().toISOString()}] ⚠️ Orchestrator cache MISS (${orchestratorCacheKey})`);
      } catch (cacheError) {
        console.warn(`[${new Date().toISOString()}] Unable to read orchestrator cache: ${cacheError.message}`);
      }
    }

    console.log(`[${new Date().toISOString()}] Orchestrating task for: ${projectPath}`);
    console.log(`[${new Date().toISOString()}] Goal length: ${goal.length} characters`);

    // Create orchestrator agent
    const orchestrator = new OrchestratorAgent();
    
    // Execute the task
    const result = await orchestrator.execute(goal, projectPath);

    const responsePayload = {
      success: result.success,
      result: result.result,
      spawnedAgents: result.spawnedAgents || [],
      agentResults: result.agentResults || [],
      conversationTurns: result.conversationTurns || 0,
      error: result.error
    };

    if (responsePayload.success && orchestratorCacheKey) {
      try {
        await redisClient.set(orchestratorCacheKey, JSON.stringify(responsePayload), { EX: 1800 });
        console.log(`[${new Date().toISOString()}] 💾 Stored orchestrator result in cache (${orchestratorCacheKey})`);
      } catch (cacheError) {
        console.warn(`[${new Date().toISOString()}] Failed to store orchestrator cache: ${cacheError.message}`);
      }
    }

    return res.json(responsePayload);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error in /orchestrate:`, error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /agents
 * Get status of all spawned agents
 */
app.get("/agents", async (req, res) => {
  try {
    const summary = agentManager.getSummary();
    return res.json(summary);
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /agents/:agentId
 * Get status of a specific agent
 */
app.get("/agents/:agentId", async (req, res) => {
  try {
    const { agentId } = req.params;
    const status = agentManager.getAgentStatus(agentId);
    return res.json(status);
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /agents/:agentId/result
 * Get result of a completed agent
 */
app.get("/agents/:agentId/result", async (req, res) => {
  try {
    const { agentId } = req.params;
    const result = agentManager.getAgentResult(agentId);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /agents/:agentId/history
 * Get tool call history of an agent
 */
app.get("/agents/:agentId/history", async (req, res) => {
  try {
    const { agentId } = req.params;
    const history = agentManager.getAgentHistory(agentId);
    return res.json(history);
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /tools/execute
 * Direct tool execution endpoint for testing
 */
app.post("/tools/execute", async (req, res) => {
  try {
    const { toolName, params } = req.body;
    
    if (!toolName) {
      return res.status(400).json({
        success: false,
        error: "Missing required parameter: toolName"
      });
    }

    console.log(`[${new Date().toISOString()}] Executing tool: ${toolName}`);
    
    const result = await executeTool(toolName, params || {});
    
    return res.json(result);
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /agents
 * Clear all completed agents
 */
app.delete("/agents/completed", async (req, res) => {
  try {
    const result = agentManager.clearCompleted();
    return res.json(result);
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /agents
 * Clear all agents and reset
 */
app.delete("/agents", async (req, res) => {
  try {
    const result = agentManager.clearAll();
    return res.json(result);
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// END ORCHESTRATION SYSTEM API ENDPOINTS
// ============================================================================


app.get('/', (req,res)=>{
    res.json("Hello, this is an express server !")
})

// app.listen(port, ()=>{
//     console.log(`Server Started: http://localhost:${port}`)
// })

// --- Connect to Redis and Start Server ---
// In app.js, at the bottom

async function startServer() {
  try {
    // Try to connect to Redis
    await connectRedis();

    // If connection is successful, start the Express server
    app.listen(port, () => {
      console.log(`Server Started: http://localhost:${port}`);
    });
  } catch (err) {
    console.error('Failed to connect to Redis, shutting down.', err);
    // Exit the process with an error code
    process.exit(1);
  }
}

startServer();