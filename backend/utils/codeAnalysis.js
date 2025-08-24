const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Using flash model for lower quota usage

const generationConfig = {
  maxOutputTokens: 8192, // Reduced from 65535 to save quota
  temperature: 0.7, // Reduced for more consistent responses
  topP: 0.95,
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

const prompt = `
You are a secure code analysis assistant.
Your task is to analyze the given code file for potential security vulnerabilities.

Follow these rules strictly:
1. Only evaluate and comment on code that is provided as input.
2. Identify vulnerable code snippets (if any) and explain why they are vulnerable.
3. Associate each vulnerability with relevant CWE/CVE IDs (if applicable).
4. Suggest practical mitigation measures or safer alternatives.
5. Respond ONLY in valid JSON format.

### JSON Response Schema:
{
"file": "<filename>",
"analysis": [
{
"snippet": "<the exact vulnerable code snippet>",
"line_numbers": [start_line, end_line],
"cwe_ids": [],
"cve_ids": [],
"explanation": "<why this code is vulnerable>",
"mitigation": "<suggested fix or best practice>"
}
]
}

### Notes:
- If no vulnerabilities are found, return: { "file": "<filename>", "analysis": [] }
- Make sure the JSON is strictly valid (no comments, no trailing commas).
- Do not include any natural language outside JSON.

Now analyze the following code file:`;

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
            file: "unknown",
            analysis: [],
            error: "Rate limit exceeded. Please try again in a few minutes."
          });
        }
      } else {
        // Other errors
        console.error("An unexpected error occurred:", error);
        return JSON.stringify({
          file: "unknown", 
          analysis: [],
          error: `Analysis failed: ${error.message}`
        });
      }
    }
  }
}

module.exports = { generateContent };