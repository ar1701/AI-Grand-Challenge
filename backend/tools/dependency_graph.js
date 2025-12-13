const fs = require('fs');
const path = require('path');

/**
 * Tool: dependency_graph()
 * Creates a complete dependency graph of the project
 * Analyzes import/require statements and module relationships
 */

class DependencyGraph {
  constructor(projectPath) {
    this.projectPath = projectPath;
    this.graph = new Map();
    this.fileExtensions = ['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs'];
  }

  /**
   * Build the complete dependency graph
   * @returns {Object} Graph structure with nodes and edges
   */
  async build() {
    try {
      const files = await this.getAllFiles(this.projectPath);
      
      // Analyze each file for dependencies
      for (const file of files) {
        await this.analyzeFile(file);
      }

      return {
        success: true,
        graph: this.serializeGraph(),
        stats: {
          totalFiles: files.length,
          totalDependencies: this.getTotalDependencies()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Recursively get all relevant files in the project
   */
  async getAllFiles(dir, fileList = []) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      // Skip node_modules, .git, and other common directories
      if (entry.isDirectory()) {
        if (!this.shouldSkipDirectory(entry.name)) {
          await this.getAllFiles(fullPath, fileList);
        }
      } else if (this.isRelevantFile(entry.name)) {
        fileList.push(fullPath);
      }
    }

    return fileList;
  }

  /**
   * Check if directory should be skipped
   */
  shouldSkipDirectory(dirName) {
    const skipDirs = ['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '.vscode'];
    return skipDirs.includes(dirName);
  }

  /**
   * Check if file is relevant for dependency analysis
   */
  isRelevantFile(fileName) {
    return this.fileExtensions.some(ext => fileName.endsWith(ext));
  }

  /**
   * Analyze a single file for its dependencies
   */
  async analyzeFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const dependencies = this.extractDependencies(content, filePath);
      
      this.graph.set(filePath, {
        path: filePath,
        relativePath: path.relative(this.projectPath, filePath),
        dependencies,
        type: this.getFileType(filePath)
      });
    } catch (error) {
      console.error(`Error analyzing file ${filePath}:`, error.message);
    }
  }

  /**
   * Extract dependencies from file content
   */
  extractDependencies(content, filePath) {
    const dependencies = [];
    
    // Match require() statements
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    let match;
    while ((match = requireRegex.exec(content)) !== null) {
      dependencies.push({
        module: match[1],
        type: this.isLocalModule(match[1]) ? 'local' : 'external',
        resolvedPath: this.resolveModule(match[1], filePath)
      });
    }

    // Match ES6 import statements
    const importRegex = /import\s+(?:[\w{},\s*]+\s+from\s+)?['"]([^'"]+)['"]/g;
    while ((match = importRegex.exec(content)) !== null) {
      dependencies.push({
        module: match[1],
        type: this.isLocalModule(match[1]) ? 'local' : 'external',
        resolvedPath: this.resolveModule(match[1], filePath)
      });
    }

    // Match dynamic imports
    const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = dynamicImportRegex.exec(content)) !== null) {
      dependencies.push({
        module: match[1],
        type: this.isLocalModule(match[1]) ? 'local' : 'external',
        resolvedPath: this.resolveModule(match[1], filePath),
        dynamic: true
      });
    }

    return dependencies;
  }

  /**
   * Check if module is local (relative path)
   */
  isLocalModule(modulePath) {
    return modulePath.startsWith('.') || modulePath.startsWith('/');
  }

  /**
   * Resolve module path relative to the file
   */
  resolveModule(modulePath, fromFile) {
    if (!this.isLocalModule(modulePath)) {
      return null; // External module
    }

    try {
      const fileDir = path.dirname(fromFile);
      let resolved = path.resolve(fileDir, modulePath);
      
      // Try adding common extensions if file doesn't exist
      if (!fs.existsSync(resolved)) {
        for (const ext of this.fileExtensions) {
          if (fs.existsSync(resolved + ext)) {
            resolved = resolved + ext;
            break;
          }
        }
      }
      
      // Check if it's a directory with index file
      if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
        for (const ext of this.fileExtensions) {
          const indexFile = path.join(resolved, 'index' + ext);
          if (fs.existsSync(indexFile)) {
            resolved = indexFile;
            break;
          }
        }
      }

      return resolved;
    } catch (error) {
      return null;
    }
  }

  /**
   * Determine file type/role
   */
  getFileType(filePath) {
    const fileName = path.basename(filePath).toLowerCase();
    
    if (fileName.includes('test') || fileName.includes('spec')) {
      return 'test';
    }
    if (fileName.includes('config')) {
      return 'config';
    }
    if (fileName.startsWith('index.')) {
      return 'entry';
    }
    if (filePath.includes('/utils/') || filePath.includes('/helpers/')) {
      return 'utility';
    }
    if (filePath.includes('/api/') || filePath.includes('/routes/')) {
      return 'api';
    }
    
    return 'module';
  }

  /**
   * Serialize graph for JSON output
   */
  serializeGraph() {
    const nodes = [];
    const edges = [];
    
    for (const [filePath, data] of this.graph.entries()) {
      nodes.push({
        id: filePath,
        relativePath: data.relativePath,
        type: data.type
      });
      
      for (const dep of data.dependencies) {
        if (dep.resolvedPath && this.graph.has(dep.resolvedPath)) {
          edges.push({
            from: filePath,
            to: dep.resolvedPath,
            module: dep.module,
            dynamic: dep.dynamic || false
          });
        }
      }
    }
    
    return { nodes, edges };
  }

  /**
   * Get total number of dependencies
   */
  getTotalDependencies() {
    let count = 0;
    for (const [, data] of this.graph.entries()) {
      count += data.dependencies.length;
    }
    return count;
  }

  /**
   * Find all files that depend on a given file
   */
  findDependents(targetFile) {
    const dependents = [];
    
    for (const [filePath, data] of this.graph.entries()) {
      const hasDependency = data.dependencies.some(
        dep => dep.resolvedPath === targetFile
      );
      if (hasDependency) {
        dependents.push(filePath);
      }
    }
    
    return dependents;
  }

  /**
   * Get the dependency chain for a file
   */
  getDependencyChain(filePath, visited = new Set()) {
    if (visited.has(filePath)) {
      return []; // Circular dependency detected
    }
    
    visited.add(filePath);
    const chain = [filePath];
    const data = this.graph.get(filePath);
    
    if (data) {
      for (const dep of data.dependencies) {
        if (dep.resolvedPath && this.graph.has(dep.resolvedPath)) {
          chain.push(...this.getDependencyChain(dep.resolvedPath, visited));
        }
      }
    }
    
    return [...new Set(chain)]; // Remove duplicates
  }
}

/**
 * Main function declaration for Gemini function calling
 */
const dependencyGraphTool = {
  name: 'dependency_graph',
  description: 'Creates a complete dependency graph of the project. Analyzes import/require statements, module relationships, and file dependencies. Use this at the start of complex tasks to understand project structure.',
  parameters: {
    type: 'object',
    properties: {
      projectPath: {
        type: 'string',
        description: 'Absolute path to the project directory'
      }
    },
    required: ['projectPath']
  }
};

/**
 * Execute the dependency_graph tool
 */
async function executeDependencyGraph(projectPath) {
  const graph = new DependencyGraph(projectPath);
  return await graph.build();
}

module.exports = {
  DependencyGraph,
  dependencyGraphTool,
  executeDependencyGraph
};
