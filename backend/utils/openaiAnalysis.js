const { OpenAI } = require("openai");
require("dotenv").config();
const { masterPrompt } = require('./prompt.js'); // Import the shared prompt

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function generateContentWithOpenAI(code) {
  try {
    console.log(`Analyzing code with OpenAI...`);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo", // Or "gpt-3.5-turbo" for a faster, cheaper option
      messages: [
        {
          role: "system",
          content: masterPrompt // The detailed prompt acts as the system's instructions
        },
        {
          role: "user",
          content: code // The combined code is the user's input
        }
      ],
      response_format: { type: "json_object" }, // Crucial for getting a JSON response
      temperature: 0.5,
    });
    
    const text = response.choices[0].message.content;
    console.log("OpenAI analysis complete!");
    console.log("Result:", text);

    return text;
  } catch (error) {
    console.error("Error in OpenAI analysis:", error.message);
    return JSON.stringify({
      files: [],
      error: `OpenAI analysis failed: ${error.message}`
    });
  }
}

async function analyzeMultipleFilesWithOpenAI(files) {
  // This logic is identical to the Gemini version
  let combinedCode = "";
  files.forEach(file => {
    combinedCode += `\n\n// File Path: ${file.path}\n\`\`\`\n${file.content}\n\`\`\`\n`;
  });
  
  return await generateContentWithOpenAI(combinedCode);
}

module.exports = { 
  analyzeMultipleFilesWithOpenAI,
  generateContentWithOpenAI // Exporting for consistency if you adapt the /code-block route
};