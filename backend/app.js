const dotenv = require('dotenv').config()
const express = require('express')
const app = express()
const port = process.env.PORT
const apiKey = process.env.GEMINI_API_KEY
const selectedEngine = process.env.ANALYSIS_ENGINE || 'gemini';
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

app.post("/analyze-multiple-files", async (req, res) => {
  try {
    // REMOVED: The 'engine' is no longer read from the request body
    const { filePaths, instructions } = req.body;
    
    if (!filePaths || !Array.isArray(filePaths) || filePaths.length === 0) {
      return res.status(400).json({ success: false, error: "Please provide an array of file paths" });
    }

    const batches = await tokenManager.processFiles(filePaths);
    const batchResults = [];
    
    for (const batch of batches) {
      const fullFilePaths = batch.map(file => file.path);
      let analysisResult;

      // CHANGED: Logic now uses the 'selectedEngine' variable defined globally
      if (selectedEngine.toLowerCase() === 'openai') {
        analysisResult = await analyzeMultipleFilesWithOpenAI(batch);
      } else {
        analysisResult = await analyzeMultipleFiles(batch);
      }
      
      batchResults.push({
        engine: selectedEngine, // Use the globally configured engine
        files: fullFilePaths,
        analysis: JSON.parse(analysisResult),
      });
    }
    
    return res.json({ success: true, batches: batchResults });
  } catch (error) {
    console.error("Error in /analyze-multiple-files:", error);
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

app.listen(port, ()=>{
    console.log(`Server Started: http://localhost:${port}`)
})