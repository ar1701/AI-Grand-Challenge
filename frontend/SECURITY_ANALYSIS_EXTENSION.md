# 🔒 Security Analysis Extension Guide

Your VS Code extension now has comprehensive multi-agent security analysis capabilities!

## 🎯 New Command

### **Comprehensive Security Analysis (Multi-Agent)**

This command orchestrates 5 specialized AI agents to perform deep security analysis of your entire project.

## 🚀 How to Use

### 1. Start the Backend Server

```bash
cd backend
npm start
```

Server runs on `http://localhost:8080`

### 2. Open Your Extension in VS Code

Press `F5` in VS Code to launch the Extension Development Host with your extension loaded.

### 3. Run Security Analysis

**Method 1: Command Palette**
1. Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
2. Type: `Secure Scan: Comprehensive Security Analysis`
3. Press Enter

**Method 2: Right-click in Explorer**
- Right-click on any file or folder
- Select "Secure Scan: Comprehensive Security Analysis"

### 4. View Results

The analysis will:
1. Show progress in a notification
2. Spawn 5 specialized security agents
3. Open a new webview panel with beautiful, formatted results
4. Display findings from each agent with syntax highlighting

## 🤖 What the 5 Agents Analyze

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
- Vulnerable dependencies
- Environment variable handling
- Hardcoded secrets
- Docker/deployment security

### 🔍 Agent 5: Code Execution & Logic
- Unsafe code execution
- Path traversal vulnerabilities
- Insecure deserialization
- Race conditions
- Business logic flaws

## 📊 Results Display

The webview shows:

### Statistics Dashboard
- Number of security agents deployed
- Successful analyses count
- Conversation turns

### Deployed Agents Section
- List of all spawned agents
- Their specific purposes

### Detailed Findings (Per Agent)
- Agent ID and status (✅ success / ❌ failed)
- Execution time and tool usage
- Complete security findings with:
  - 🔴 **CRITICAL** vulnerabilities (color-coded red)
  - 🟠 **HIGH** severity issues (color-coded orange)
  - 🟡 **MEDIUM** severity issues (color-coded yellow)
  - 🔵 **LOW** severity issues (color-coded blue)
  - Specific file locations and line numbers
  - Code snippets showing vulnerabilities
  - Concrete remediation steps

### Orchestrator Summary
- Executive summary of all findings
- Prioritized recommendations
- Overall security assessment

## 🎨 Features

- **Beautiful UI**: Dark mode compatible, color-coded severity levels
- **Parallel Processing**: All 5 agents analyze simultaneously
- **Deep Analysis**: Each agent specializes in their security domain
- **Actionable Results**: Specific line numbers, code snippets, and fixes
- **Real Results**: Shows actual vulnerability findings, not just metadata

## ⚙️ Configuration

Update your settings in `.vscode/settings.json`:

```json
{
  "secureScan.backendUrl": "http://localhost:8080"
}
```

Or through VS Code Settings:
1. Open Settings (`Cmd+,`)
2. Search for "Secure Scan"
3. Update "Backend URL" if needed

## 🔧 Customizing the Analysis

### Change Analysis Focus

Edit `frontend/src/extension.ts` in the `securityAnalysisCommand` function to modify the `goal` variable:

```typescript
const goal = `
Your custom analysis instructions here...

1. Focus on specific areas
2. Add custom security checks
3. Target particular files or patterns
`;
```

### Add More Agents

Simply add more agent specifications in the goal:

```typescript
🔍 Agent 6 - Custom Security Analysis:
- Your specific security concerns
- Files or patterns to check
- Expected findings format
```

### Change Timeout

In `api.ts`, adjust the fetch timeout if needed for larger projects.

## 📈 Performance

- **Small projects** (< 50 files): ~1-2 minutes
- **Medium projects** (50-200 files): ~2-5 minutes
- **Large projects** (200+ files): ~5-10 minutes

Agents work in parallel, so analysis is much faster than sequential scanning!

## 🐛 Troubleshooting

### "Backend URL not configured"
- Check your settings: `secureScan.backendUrl`
- Ensure backend is running on the correct port

### "No workspace folder found"
- Open a folder in VS Code before running analysis
- Use File > Open Folder

### Analysis Takes Too Long
- Normal for large projects (up to 10 minutes)
- Check backend server logs for progress
- Ensure stable network connection to backend

### Empty Results
- Verify backend server is running
- Check backend logs for errors
- Ensure project path is accessible

## 💡 Tips

1. **Run on specific directories**: The analysis scans your entire workspace. For faster results on large projects, open just the directory you want to analyze.

2. **Review agent findings separately**: Each agent provides specialized insights. Don't skip individual agent results—they contain the details!

3. **Priority order**: Focus on CRITICAL and HIGH severity findings first.

4. **Regular scans**: Run analysis periodically as your codebase evolves.

5. **Compare with other tools**: Use this alongside your existing security tools for comprehensive coverage.

## 🔗 Integration Options

### Add to Keybinding

Add to `keybindings.json`:

```json
{
  "key": "cmd+shift+s",
  "command": "secureScan.securityAnalysis"
}
```

### Add to Context Menu

Already available when you right-click in the Explorer!

### Add to Status Bar

Extend the extension to add a status bar button for quick access.

## 📚 Next Steps

1. **Test the extension**: Press `F5` to launch Extension Development Host
2. **Run analysis**: Use Command Palette > "Comprehensive Security Analysis"
3. **Review results**: Check the webview panel for detailed findings
4. **Fix vulnerabilities**: Use the remediation suggestions from agents
5. **Re-scan**: Run again after fixes to verify improvements

## 🤝 Advanced Usage

### Programmatic Access

You can also call the orchestration API directly:

```typescript
import { orchestrateSecurityAnalysis } from './api';

const result = await orchestrateSecurityAnalysis(goal, projectPath);
console.log(result.agentResults);
```

### Custom Result Processing

Modify `generateSecurityAnalysisHTML()` in `extension.ts` to customize how results are displayed.

### Export Results

Add functionality to export analysis results to JSON/PDF:

```typescript
// Save to file
const fs = require('fs');
fs.writeFileSync('security-report.json', JSON.stringify(result, null, 2));
```

---

**Happy Secure Coding! 🔒✨**

Your extension now provides enterprise-grade security analysis powered by multiple specialized AI agents!
