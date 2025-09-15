const fs = require('fs');
const path = require('path');

// Configuration
const TOKEN_LIMIT = 30000; // Gemini-2.0-flash token limit (adjust based on model)
const BUFFER_TOKENS = 2000; // Buffer for prompt and response

/**
 * Manages batching of files based on token count
 */
class TokenManager {
  constructor(genAI) {
    this.genAI = genAI;
    this.currentBatchTokens = 0;
    this.currentBatch = [];
    this.batches = [];
  }

  /**
   * Count tokens for a text string
   */
  async countTokens(text) {
    try {
      const response = await this.genAI.models.countTokens({
        model: "gemini-2.0-flash",
        contents: text,
      });
      return response.totalTokens;
    } catch (error) {
      console.error("Error counting tokens:", error);
      throw error;
    }
  }

  /**
   * Process a single file and add to appropriate batch
   */
  async addFile(filePath) {
    try {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const fileName = path.basename(filePath);
      const fileTokens = await this.countTokens(fileContent);
      
      const fileObject = {
        name: fileName,
        path: filePath,
        content: fileContent,
        tokens: fileTokens
      };
      
      // If a single file exceeds limit (minus buffer), we need to handle separately
      if (fileTokens > TOKEN_LIMIT - BUFFER_TOKENS) {
        console.warn(`File ${fileName} exceeds token limit and will be truncated`);
        // Handle large file - could split or truncate based on your needs
        this.batches.push([{...fileObject, truncated: true}]);
        return;
      }
      
      // If adding this file would exceed the limit, create a new batch
      if (this.currentBatchTokens + fileTokens > TOKEN_LIMIT - BUFFER_TOKENS) {
        this.batches.push([...this.currentBatch]);
        this.currentBatch = [fileObject];
        this.currentBatchTokens = fileTokens;
      } else {
        // Add to current batch
        this.currentBatch.push(fileObject);
        this.currentBatchTokens += fileTokens;
      }
    } catch (error) {
      console.error(`Error processing file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Process multiple files and organize into batches
   */
  async processFiles(filePaths) {
    // Reset state
    this.currentBatchTokens = 0;
    this.currentBatch = [];
    this.batches = [];
    
    // Process each file
    for (const filePath of filePaths) {
      await this.addFile(filePath);
    }
    
    // Add any remaining files in the current batch
    if (this.currentBatch.length > 0) {
      this.batches.push([...this.currentBatch]);
    }
    
    return this.batches;
  }

  /**
   * Create a formatted prompt from a batch of files
   */
  createPrompt(batch, instructions) {
    let prompt = instructions || "Analyze the following code files:\n\n";
    
    batch.forEach(file => {
      prompt += `File: ${file.name}\n\`\`\`\n${file.content}\n\`\`\`\n\n`;
    });
    
    return prompt;
  }
}

module.exports = TokenManager;