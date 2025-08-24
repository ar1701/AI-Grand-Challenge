const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();
const {responseSchema} = require('./response.js')

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); 

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

const prompt = `
You are a secure code analysis assistant.
Your task is to analyze the given code file for potential security vulnerabilities.

Follow these rules strictly:
1. Only evaluate and comment on code that is provided as input.
2. Identify vulnerable code snippets (if any) and explain why they are vulnerable.
3. For each vulnerability, provide detailed CWE and CVE information with descriptions and mitigations.
4. Respond ONLY in valid JSON format with the exact schema provided below.

### JSON Response Schema:
{
  "entries": [
    {
      "code_snippet": "<the exact vulnerable code snippet>",
      "severity": "<Critical|High|Medium|Low>",
      "vulnerability_explanation": "<why this specific code is vulnerable>",
      "recommended_fix": "<concrete code example or steps to fix this vulnerability>",
      "cve_ids": [
        {
          "id": "<CVE-YYYY-XXXXX or 'N/A' if not applicable>",
          "description": "<detailed description of the CVE>",
          "mitigation": "<specific mitigation for this CVE>"
        }
      ],
      "cwe_ids": [
        {
          "id": "<CWE-XXX>",
          "description": "<detailed description of the weakness type>",
          "mitigation": "<specific mitigation strategies for this CWE>"
        }
      ]
    }
  ]
}

### Important Notes:
- If no vulnerabilities are found, return: { "entries": [] }
- Each vulnerability can have multiple CWE and CVE IDs (arrays)
- Provide real CWE IDs that match the vulnerability type
- Include severity levels: Critical, High, Medium, or Low
- Make sure the JSON is strictly valid (no comments, no trailing commas)
- Do not include any text outside the JSON response
- Focus on actual security vulnerabilities, not code quality issues



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

module.exports = { generateContent };