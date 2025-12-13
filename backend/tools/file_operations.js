const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

/**
 * Tool: file_read()
 * Reads the contents of a file
 */
const fileReadTool = {
  name: 'file_read',
  description: 'Reads the contents of a specific file. Use for targeted reads when you need to inspect code.',
  parameters: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: 'Absolute path to the file to read'
      }
    },
    required: ['filePath']
  }
};

async function executeFileRead(filePath) {
  try {
    // Validate file exists
    if (!fsSync.existsSync(filePath)) {
      return {
        success: false,
        error: `File not found: ${filePath}`
      };
    }

    // Check if it's actually a file
    const stats = await fs.stat(filePath);
    if (!stats.isFile()) {
      return {
        success: false,
        error: `Path is not a file: ${filePath}`
      };
    }

    // Read file content
    const content = await fs.readFile(filePath, 'utf-8');
    
    return {
      success: true,
      filePath,
      relativePath: path.basename(filePath),
      content,
      size: stats.size,
      lines: content.split('\n').length
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Tool: file_write()
 * Creates or writes to a new file
 * NEVER use this to rewrite entire existing scripts
 */
const fileWriteTool = {
  name: 'file_write',
  description: 'Creates a new file or writes to a file. NEVER use this to rewrite entire existing scripts. Only for new utilities, configs, or small additions.',
  parameters: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: 'Absolute path where the file should be created'
      },
      content: {
        type: 'string',
        description: 'Content to write to the file'
      },
      createDirectories: {
        type: 'boolean',
        description: 'Whether to create parent directories if they don\'t exist',
        default: true
      }
    },
    required: ['filePath', 'content']
  }
};

async function executeFileWrite(filePath, content, createDirectories = true) {
  try {
    // Check if file already exists and has significant content
    if (fsSync.existsSync(filePath)) {
      const existingStats = await fs.stat(filePath);
      if (existingStats.size > 100) {
        return {
          success: false,
          error: `File already exists with significant content. Use apply_patch instead to modify existing files: ${filePath}`
        };
      }
    }

    // Create parent directories if needed
    if (createDirectories) {
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });
    }

    // Write the file
    await fs.writeFile(filePath, content, 'utf-8');

    return {
      success: true,
      filePath,
      bytesWritten: Buffer.byteLength(content, 'utf-8'),
      message: 'File created successfully'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Helper: Read multiple files at once
 */
async function readMultipleFiles(filePaths) {
  const results = [];
  
  for (const filePath of filePaths) {
    const result = await executeFileRead(filePath);
    results.push(result);
  }
  
  return {
    success: true,
    files: results
  };
}

/**
 * Helper: List files in a directory
 */
async function listDirectory(dirPath, options = {}) {
  try {
    const {
      recursive = false,
      includeExtensions = [],
      excludeDirs = ['node_modules', '.git', 'dist', 'build']
    } = options;

    const files = [];

    async function scan(currentPath) {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);

        if (entry.isDirectory()) {
          if (recursive && !excludeDirs.includes(entry.name)) {
            await scan(fullPath);
          }
        } else {
          // Check file extension filter
          if (includeExtensions.length === 0 || 
              includeExtensions.some(ext => entry.name.endsWith(ext))) {
            files.push(fullPath);
          }
        }
      }
    }

    await scan(dirPath);

    return {
      success: true,
      directory: dirPath,
      files,
      count: files.length
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Helper: Check if file exists
 */
function fileExists(filePath) {
  return fsSync.existsSync(filePath);
}

/**
 * Helper: Get file info without reading content
 */
async function getFileInfo(filePath) {
  try {
    const stats = await fs.stat(filePath);
    return {
      success: true,
      filePath,
      size: stats.size,
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory(),
      created: stats.birthtime,
      modified: stats.mtime
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  fileReadTool,
  executeFileRead,
  fileWriteTool,
  executeFileWrite,
  readMultipleFiles,
  listDirectory,
  fileExists,
  getFileInfo
};
