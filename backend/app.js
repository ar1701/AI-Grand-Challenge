const dotenv = require('dotenv').config()
const express = require('express')
const app = express()
const port = process.env.PORT
const apiKey = process.env.GEMINI_API_KEY
const { GoogleGenAI } = require('@google/genai')
const { generateContent, analyzeMultipleFiles } = require("./utils/codeAnalysis.js")
const fs = require('fs')
const path = require('path')
const TokenManager = require('./utils/tokenManager')

app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));

// Initialize Google GenAI
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const tokenManager = new TokenManager(genAI);

app.post("/analyze-multiple-files", async (req, res) => {
  try {
    const { filePaths, instructions } = req.body;
    
    if (!filePaths || !Array.isArray(filePaths) || filePaths.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Please provide an array of file paths"
      });
    }

    // Process files into batches based on token limits
    const batches = await tokenManager.processFiles(filePaths);
    
    // Generate analysis for each batch
    const batchResults = [];
    
    for (const batch of batches) {
      const fileNames = batch.map(file => file.name);
    //   const totalTokens = batch.reduce((sum, file) => sum + file.tokens, 0);
      
      // Use analyzeMultipleFiles from codeAnalysis.js instead of createPrompt + generateContentWithMetadata
      const analysis = await analyzeMultipleFiles(batch);
      
      batchResults.push({
        files: fileNames,
        // totalTokens,
        analysis: analysis.analysis || analysis.error,
      });
    }
    
    return res.json({
      success: true,
      batches: batchResults
    });
  } catch (error) {
    console.error("Error in /analyze-multiple-files:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to analyze files"
    });
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