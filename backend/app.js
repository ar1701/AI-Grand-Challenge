const dotenv = require('dotenv').config()
const express = require('express')
const app = express()
const port = process.env.PORT
const apiKey = process.env.GEMINI_API_KEY
const selectedEngine = process.env.ANALYSIS_ENGINE || 'gemini';
const crypto = require('crypto');
const { redisClient, connectRedis } = require('./utils/redisClient');
console.log(`Server configured to use analysis engine: ${selectedEngine.toUpperCase()}`);


const { GoogleGenAI } = require('@google/genai')
const { generateContent, analyzeMultipleFiles } = require("./utils/codeAnalysis.js")
const fs = require('fs')
const path = require('path')
const TokenManager = require('./utils/tokenManager')
const { analyzeMultipleFilesWithOpenAI } = require('./utils/openaiAnalysis.js');

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

      console.log(`[${new Date().toISOString()}] 2. Batch #${index + 1}: Checking Redis for key...`);
      const cachedResult = await redisClient.get(cacheKey);
      console.log(`[${new Date().toISOString()}] 3. Batch #${index + 1}: Finished checking Redis.`);

      if (cachedResult) {
        console.log(`[${new Date().toISOString()}] 4a. Batch #${index + 1}: Cache HIT.`);
        analysisResult = cachedResult;
      } else {
        console.log(`[${new Date().toISOString()}] 4b. Batch #${index + 1}: Cache MISS.`);
        
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
    try {
        const {codeBlock} = req.body;
        
        // Count tokens before processing
        const tokenCount = await tokenManager.countTokens(codeBlock);
        
        // Check if token count exceeds limits
        if (tokenCount > 30000) { // Adjust based on model limits
          return res.status(400).json({
            success: false,
            error: "Code block exceeds token limit",
            tokenCount
          });
        }

        // Use the generateContent function directly from codeAnalysis.js
        const rawResponse = await generateContent(codeBlock);
        
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