# 🔒 Comprehensive Security Analysis Guide

This guide explains how to use the multi-agent orchestration system for in-depth vulnerability analysis.

## 🎯 Overview

The system now supports **comprehensive security analysis** by spawning **multiple specialized agents** that work in parallel to analyze different security domains. Each agent focuses deeply on their area of expertise, providing detailed findings with:

- Specific vulnerability types
- Severity ratings (CRITICAL, HIGH, MEDIUM, LOW)
- Exact file locations and line numbers
- Code snippets showing the issue
- Concrete remediation steps
- Secure code examples

## 🚀 Quick Start

### 1. Start the Backend Server

```bash
cd backend
npm start
```

The server will start on `http://localhost:3000`

### 2. Run Security Analysis

```bash
npm run test:security
```

This will:
1. Spawn 5 specialized security analysis agents
2. Each agent analyzes different security aspects in parallel
3. Collect detailed findings from all agents
4. Generate a comprehensive vulnerability report

## 🤖 Specialized Security Agents

The test spawns these specialized agents:

### 🔍 Agent 1: Authentication & Authorization
- JWT, sessions, API key security
- Authorization bypass vulnerabilities
- Missing authentication on endpoints
- Insecure password handling

### 🔍 Agent 2: Input Validation & Injection
- SQL/NoSQL injection risks
- Command injection vulnerabilities
- XSS and CSRF vulnerabilities
- File upload security

### 🔍 Agent 3: API Security & Rate Limiting
- API endpoint security issues
- Missing rate limiting
- Exposed sensitive endpoints
- Information disclosure
- CORS configuration

### 🔍 Agent 4: Dependency & Configuration
- Vulnerable dependencies in package.json
- Environment variable handling
- Hardcoded secrets
- Docker/deployment security

### 🔍 Agent 5: Code Execution & Logic
- Unsafe code execution (eval, etc.)
- Path traversal in file operations
- Insecure deserialization
- Race conditions
- Business logic flaws

## 📊 Output Format

The security analysis provides:

### 1. Agent Deployment Status
Shows which agents were spawned and their purposes

### 2. Detailed Findings by Agent
For each agent:
- **Purpose**: What they analyzed
- **Status**: Success/failure
- **Execution time**: How long analysis took
- **Tool calls**: Number of tools used
- **Findings**: Complete security analysis with:
  - Vulnerability categories
  - Severity levels (color-coded)
  - Specific code locations
  - Remediation steps

### 3. Orchestrator Summary
High-level synthesis of all findings

### 4. Statistics
- Total agents deployed
- Success/failure rates
- Execution times
- Severity distribution

## 🎨 Customizing the Analysis

### Analyze a Different Project

Edit `test-vulnerability-analysis.js`:

```javascript
const projectPath = '/path/to/your/project';
```

### Add More Specialized Agents

In the `goal` section, add more agent specifications:

```javascript
🔍 Agent 6 - Your Custom Analysis:
- Specific focus area
- What to check
- Files to analyze
```

### Adjust Agent Focus

Modify the goal description to change what each agent analyzes:

```javascript
🔍 Agent 1 - Custom Focus:
- Different authentication checks
- Additional security concerns
- Specific files to examine
```

### Change Timeout

For larger projects, increase the timeout:

```javascript
const response = await axios.post(API_URL, {
  goal: goal,
  projectPath: projectPath
}, {
  timeout: 900000 // 15 minutes
});
```

## 🔧 Using via API

You can also trigger security analysis via direct API call:

```bash
curl -X POST http://localhost:3000/orchestrate \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "Perform comprehensive security analysis with 5 specialized agents...",
    "projectPath": "/path/to/project"
  }'
```

The response includes:
```json
{
  "success": true,
  "result": {
    "type": "completion",
    "message": "Orchestrator summary..."
  },
  "spawnedAgents": [...],
  "agentResults": [
    {
      "agentId": "agent_0",
      "purpose": "Authentication analysis",
      "success": true,
      "result": {
        "message": "Detailed findings...",
        "type": "completion"
      },
      "executionTime": 15000,
      "toolCallCount": 3
    }
  ]
}
```

## 🎯 Best Practices

### 1. Use Multiple Specialized Agents
Instead of one general agent, spawn 3-5 specialized agents for:
- Better coverage
- Deeper analysis in each domain
- Parallel execution (faster)
- More detailed findings

### 2. Provide Clear Purpose Statements
Each agent should have:
- Specific focus area
- Files to examine
- What to look for
- Expected output format

### 3. Set Appropriate Timeouts
- Small projects: 2-5 minutes
- Medium projects: 5-10 minutes
- Large projects: 10-15 minutes

### 4. Review Agent Results Individually
Each agent provides domain-specific expertise - review their findings separately before looking at the summary.

## 📝 Integration with VS Code Extension

To integrate with your VS Code extension:

### 1. Create a Command

In your extension's `extension.ts`:

```typescript
vscode.commands.registerCommand('ai-assistant.securityAnalysis', async () => {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) return;

  const response = await axios.post('http://localhost:3000/orchestrate', {
    goal: `Comprehensive security analysis with 5 specialized agents...`,
    projectPath: workspaceFolder.uri.fsPath
  });

  // Display results in a webview or output panel
  const panel = vscode.window.createWebviewPanel(
    'securityAnalysis',
    'Security Analysis Results',
    vscode.ViewColumn.One,
    {}
  );

  panel.webview.html = formatSecurityResults(response.data);
});
```

### 2. Display Agent Results

Create a formatted view showing:
- Each agent's findings
- Severity indicators
- Quick navigation to vulnerable files
- Remediation suggestions

### 3. Add Quick Fixes

For each vulnerability, provide CodeActions:
- Navigate to vulnerable line
- Show remediation diff
- Apply fix automatically

## 🔍 Example: Focus on Specific Vulnerability Type

If you want to focus deeply on a specific type:

```javascript
const goal = `
Deep analysis of SQL injection vulnerabilities:

1. Spawn 3 specialized agents:
   
   Agent 1 - Direct SQL Queries:
   - Find all direct SQL query constructions
   - Check for unsanitized user input
   
   Agent 2 - ORM/Query Builder Usage:
   - Analyze ORM query patterns
   - Check for raw query usage
   
   Agent 3 - Stored Procedures:
   - Review stored procedure calls
   - Check parameter binding

Each agent: provide specific locations, vulnerable code, and secure alternatives.
`;
```

## 📈 Interpreting Results

### Severity Levels

- 🔴 **CRITICAL**: Immediate fix required, high risk of exploitation
- 🟠 **HIGH**: Important to fix soon, significant security impact
- 🟡 **MEDIUM**: Should be addressed, moderate risk
- 🔵 **LOW**: Nice to fix, minimal security impact

### Prioritization

1. Fix all CRITICAL vulnerabilities first
2. Address HIGH severity issues
3. Plan fixes for MEDIUM issues
4. Schedule LOW priority improvements

## 🛠️ Advanced Usage

### Chain Multiple Analyses

Run different analysis types in sequence:

```bash
# Security analysis
npm run test:security

# Performance analysis
npm run test:performance

# Code quality analysis
npm run test:quality
```

### Export Results

Modify the test script to save results:

```javascript
const reportPath = path.join(__dirname, 'security-report.json');
fs.writeFileSync(reportPath, JSON.stringify(response.data, null, 2));
console.log(`Report saved to: ${reportPath}`);
```

## 🎓 Tips for Better Results

1. **Be Specific**: Clearly define what each agent should analyze
2. **Provide Context**: Include relevant files and areas to focus on
3. **Use Multiple Agents**: 3-5 specialized agents work better than 1 general agent
4. **Review Individually**: Check each agent's findings separately
5. **Iterate**: Run analysis multiple times as you fix issues

## 📚 Next Steps

1. Run the security analysis on your project
2. Review the detailed findings from each agent
3. Prioritize fixes based on severity
4. Integrate into your CI/CD pipeline
5. Schedule regular security audits

## 🤝 Contributing

To add new security analysis patterns:

1. Update agent prompts in the goal specification
2. Add new specialized agent types
3. Enhance output formatting in the test script
4. Share findings with the team

---

**Happy Secure Coding! 🔒**
