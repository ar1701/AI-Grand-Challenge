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

app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));

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
  console.log(`[${new Date().toISOString()}] --- Received new request ---`);
  try {
    const { filePaths } = req.body;
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
        const response = await generateContent(codeBlock);

        return res.json({
            success: true,
            tokenCount,
            result: response
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