const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();
const {responseSchema} = require('./response.js')
const { masterPrompt } = require('./prompt.js');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-3-pro-preview" }); 
const prompt = masterPrompt;

const generationConfig = {
  maxOutputTokens: 8192, // Reduced from 65535 to save quota
  temperature: 0.7, // Reduced for more consistent responses
  topP: 0.95,
  responseMimeType: "application/json",
  responseSchema: responseSchema
};

const safetySettings = [
  {
    category: "HARM_CATEGORY_HATE_SPEECH",
    threshold: "BLOCK_NONE",
  },
  {
    category: "HARM_CATEGORY_DANGEROUS_CONTENT",
    threshold: "BLOCK_NONE",
  },
  {
    category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
    threshold: "BLOCK_NONE",
  },
  {
    category: "HARM_CATEGORY_HARASSMENT",
    threshold: "BLOCK_NONE",
  },
];



// Helper function to wait for a specified time
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function generateContent(code, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`Attempt ${attempt}/${retries} - Analyzing code...`);
      
      const fullPrompt = prompt + "\n\n" + code;

      // Use generateContent instead of streaming to reduce API calls
      const result = await model.generateContent(fullPrompt);
      const response = await result.response;
      const text = response.text();
      
      console.log("Analysis complete!");
      console.log("Result:", text);
      
      return text;
    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error.message);
      
      if (error.status === 429) {
        // Rate limit exceeded
        const waitTime = attempt === 1 ? 60000 : attempt * 30000; // 1 min, then 30s per attempt
        console.log(`Rate limit exceeded. Waiting ${waitTime/1000} seconds before retry...`);
        
        if (attempt < retries) {
          await wait(waitTime);
          continue;
        } else {
          console.error("All retry attempts exhausted. Please try again later.");
          return JSON.stringify({
            entries: [],
            error: "Rate limit exceeded. Please try again in a few minutes."
          });
        }
      } else {
        // Other errors
        console.error("An unexpected error occurred:", error);
        return JSON.stringify({
          entries: [],
          error: `Analysis failed: ${error.message}`
        });
      }
    }
  }
}


async function analyzeMultipleFiles(files) {
  // Combine files content with clear separators and full paths
  let combinedCode = "";
  files.forEach(file => {
    // THIS IS THE FIX: Use file.path instead of file.name
    combinedCode += `\n\n// File Path: ${file.path}\n\`\`\`\n${file.content}\n\`\`\`\n`;
  });
  
  // Analyze the combined code
  return await generateContent(combinedCode);
}

module.exports = { generateContent, analyzeMultipleFiles };