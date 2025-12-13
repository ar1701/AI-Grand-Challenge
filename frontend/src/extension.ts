import * as vscode from "vscode";
import * as path from "path";
import { orchestrateSecurityAnalysis } from "./api";
import { highlightEntries, clearHighlights } from "./highlighter";
import { IssuesPanelProvider } from "./issuesPanel";
import { Issue, OrchestrationResponse, AgentResult, ToolCall } from "./types";

let projectIssues: Issue[] = [];

interface SnippetAlignmentResult {
  line: number;
  endLine: number;
  matched: boolean;
  resolvedText?: string;
}

const snippetFileLineCache = new Map<string, string[]>();

function normalizeLineForMatch(line: string): string {
  const trimmed = line.trim();
  if (!trimmed) {
    return "";
  }

  const commentPrefixes = ["//", "#", "/*", "*", "--"];
  if (commentPrefixes.some(prefix => trimmed.startsWith(prefix))) {
    return "";
  }

  return trimmed.replace(/\s+/g, " ").toLowerCase();
}

function buildSnippetComparableLines(snippet: string): string[] {
  return snippet
    .replace(/\r/g, "")
    .split("\n")
    .map(normalizeLineForMatch)
    .filter(line => line.length > 3);
}

function buildSearchOrder(totalLines: number, centerLine: number): number[] {
  const indices: number[] = [];
  const maxDelta = Math.max(centerLine, totalLines - centerLine);
  for (let delta = 0; delta <= maxDelta; delta++) {
    const down = centerLine - delta;
    if (down >= 0) {
      indices.push(down);
    }
    if (delta === 0) {
      continue;
    }
    const up = centerLine + delta;
    if (up < totalLines) {
      indices.push(up);
    }
  }
  return indices;
}

function fuzzyLineIncludes(fileLine: string, snippetLine: string): boolean {
  if (!snippetLine || !fileLine) {
    return false;
  }
  if (fileLine === snippetLine) {
    return true;
  }
  if (fileLine.includes(snippetLine)) {
    return true;
  }
  if (snippetLine.length >= 8) {
    const prefixLength = Math.max(6, Math.floor(snippetLine.length * 0.6));
    return fileLine.includes(snippetLine.slice(0, prefixLength));
  }
  return false;
}

function alignSnippetInLines(
  fileLines: string[],
  snippet: string,
  fallbackLine: number
): SnippetAlignmentResult {
  if (fileLines.length === 0) {
    return { line: 0, endLine: 0, matched: false };
  }

  const normalizedFileLines = fileLines.map(normalizeLineForMatch);
  const snippetLines = buildSnippetComparableLines(snippet);
  const safeFallback = Math.min(
    Math.max(Number.isFinite(fallbackLine) ? fallbackLine : 0, 0),
    fileLines.length - 1
  );

  if (snippetLines.length === 0) {
    return { line: safeFallback, endLine: safeFallback, matched: false };
  }

  const searchOrder = buildSearchOrder(normalizedFileLines.length, safeFallback);
  let bestScore = -Infinity;
  let bestStart = safeFallback;
  let bestEnd = safeFallback;
  let bestMatched = false;

  for (const startIdx of searchOrder) {
    if (!fuzzyLineIncludes(normalizedFileLines[startIdx], snippetLines[0])) {
      continue;
    }

    let matches = 1;
    let endIdx = startIdx;

    for (let offset = 1; offset < snippetLines.length; offset++) {
      const fileIdx = startIdx + offset;
      if (fileIdx >= normalizedFileLines.length) {
        break;
      }

      if (fuzzyLineIncludes(normalizedFileLines[fileIdx], snippetLines[offset])) {
        matches++;
        endIdx = fileIdx;
      } else {
        break;
      }
    }

    const score = matches * 100 - Math.abs(startIdx - safeFallback);
    if (score > bestScore) {
      bestScore = score;
      bestStart = startIdx;
      bestEnd = endIdx;
      bestMatched = true;
    }

    if (matches >= Math.min(snippetLines.length, 3)) {
      break;
    }
  }

  if (!bestMatched) {
    return { line: safeFallback, endLine: safeFallback, matched: false };
  }

  const resolvedStart = Math.max(0, Math.min(bestStart, fileLines.length - 1));
  const resolvedEnd = Math.max(resolvedStart, Math.min(bestEnd, fileLines.length - 1));
  const resolvedText = fileLines.slice(resolvedStart, resolvedEnd + 1).join('\n');

  return {
    line: resolvedStart,
    endLine: resolvedEnd,
    matched: true,
    resolvedText
  };
}

async function getFileLines(filePath: string): Promise<string[] | null> {
  if (snippetFileLineCache.has(filePath)) {
    return snippetFileLineCache.get(filePath)!;
  }

  try {
    const document = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
    const lines = document.getText().replace(/\r/g, "").split("\n");
    snippetFileLineCache.set(filePath, lines);
    return lines;
  } catch (error) {
    console.warn(`Unable to cache lines for ${filePath}`, error);
    return null;
  }
}

async function alignSnippetWithFile(
  filePath: string,
  snippet: string,
  fallbackLine: number
): Promise<SnippetAlignmentResult> {
  const fileLines = await getFileLines(filePath);
  if (!fileLines) {
    return {
      line: Math.max(0, fallbackLine),
      endLine: Math.max(0, fallbackLine),
      matched: false,
      resolvedText: snippet
    };
  }

  return alignSnippetInLines(fileLines, snippet, fallbackLine);
}

async function resolveReportedFile(projectPath: string, reportedFile: string): Promise<string | null> {
  if (!reportedFile) {
    return null;
  }

  const normalized = reportedFile.replace(/\\/g, path.sep).replace(/^\.\/+/, '').trim();
  const candidates: string[] = [];

  if (path.isAbsolute(normalized)) {
    candidates.push(path.normalize(normalized));
  } else {
    candidates.push(path.normalize(path.join(projectPath, normalized)));
  }

  // Try each candidate directly
  for (const candidate of candidates) {
    try {
      await vscode.workspace.fs.stat(vscode.Uri.file(candidate));
      return candidate;
    } catch {
      continue;
    }
  }

  const baseName = path.basename(normalized);
  if (!baseName) {
    return null;
  }

  try {
    const foundFiles = await vscode.workspace.findFiles(
      `**/${baseName}`,
      '**/{node_modules,.git,dist,build,out,coverage,tmp}/**',
      10
    );

    for (const file of foundFiles) {
      if (normalized === baseName || file.fsPath.endsWith(normalized)) {
        return file.fsPath;
      }
    }
  } catch (searchError) {
    console.warn(`File search failed for ${reportedFile}:`, searchError);
  }

  return null;
}

/**
 * Display the nested tool call tree in console
 */
function displayToolCallTree(response: OrchestrationResponse): void {
  console.log('\n📊 ===== TOOL CALL TREE =====\n');
  console.log('Orch Agent');
  
  // Display orchestrator's own tool calls
  if (response.orchestratorToolHistory && response.orchestratorToolHistory.length > 0) {
    for (const call of response.orchestratorToolHistory) {
      const status = call.success ? '✓ success' : '✗ failed';
      console.log(`  |_____ ${call.tool}(): ${status}`);
    }
  }
  
  // Display each sub-agent and their tool calls
  if (response.agentResults && response.agentResults.length > 0) {
    for (const agent of response.agentResults) {
      const agentStatus = agent.success ? '✓' : '✗';
      console.log(`  |`);
      console.log(`  |_____ ${agent.agentId} (${agent.purpose}) ${agentStatus}`);
      
      if (agent.toolHistory && agent.toolHistory.length > 0) {
        for (let i = 0; i < agent.toolHistory.length; i++) {
          const call = agent.toolHistory[i];
          const status = call.success ? '✓ success' : '✗ failed';
          const prefix = i === agent.toolHistory.length - 1 ? '          |__________' : '          |__________';
          console.log(`${prefix}${call.tool}(): ${status}`);
        }
      } else {
        console.log('          |__________(no tool calls recorded)');
      }
    }
  }
  
  console.log('\n===== END TOOL CALL TREE =====\n');
}

export function activate(context: vscode.ExtensionContext) {
  console.log("🔌 SecureScan extension activated");

  const issuesPanelProvider = new IssuesPanelProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      IssuesPanelProvider.viewType,
      issuesPanelProvider
    )
  );

  // Helper function to perform security analysis using orchestrator
  async function performOrchestratorAnalysis(
    projectPath: string, 
    targetDescription: string,
    specificFiles?: string[]
  ): Promise<void> {
    const folderName = projectPath.split(/[/\\]/).pop() || 'project';
    
    // Build goal based on target
    let goal = `Perform a comprehensive code analysis on the project at: ${projectPath}\n\n`;
    
    if (specificFiles && specificFiles.length > 0) {
      goal += `**FOCUS ON THESE SPECIFIC FILES:**\n`;
      specificFiles.forEach(f => {
        goal += `- ${f}\n`;
      });
      goal += `\nAnalyze ONLY these ${specificFiles.length} file(s).\n`;
    } else {
      goal += `Analyze the ENTIRE project.\n`;
    }
    
    goal += `
**ANALYZE FOR ALL OF THE FOLLOWING:**
1. Security vulnerabilities (SQL injection, XSS, auth bypass, etc.)
2. Edge cases caused by bugs - including which other files/functions they affect via dependency graph
3. Cross-file bugs that span multiple modules
4. Business logic issues that could break user journeys

**MANDATORY OUTPUT FORMATS:**

### For Security Vulnerabilities:
#### [🔴 CRITICAL / 🟠 HIGH / 🟡 MEDIUM / 🔵 LOW] - [Vulnerability Name]
**Type:** \`vulnerability\`
**File:** path/to/actual/file.js
**Line:** 45-48
**Vulnerable Code:**
\`\`\`javascript
// ACTUAL code from the file
\`\`\`
**Issue:** Specific explanation
**Fix:**
\`\`\`javascript
// Secure alternative
\`\`\`
**Impact:** What attacker can do

### For Edge Cases:
#### ⚠️ EDGE CASE - [Title]
**Type:** \`edge-case\`
**File:** path/to/file.js
**Line:** 45-48
**Problematic Code:**
\`\`\`javascript
// Code that causes edge-case
\`\`\`
**Edge Case:** Describe inputs/conditions that trigger unexpected behavior
**Affected Dependencies:**
- path/to/dependentFile.js:functionName()
**Fix:**
\`\`\`javascript
// Defensive handling
\`\`\`
**User Impact:** Which user flows break

### For Cross-File Bugs:
#### 🔗 CROSS-FILE BUG - [Title]
**Type:** \`cross-file-bug\`
**Primary File:** path/to/source.js
**Line:** 30-35
**Root Cause Code:**
\`\`\`javascript
// Code initiating the bug
\`\`\`
**Issue:** Root cause and propagation
**Ripple Effect Files:**
- path/to/consumer1.js:12 – impact
- path/to/consumer2.js:45 – impact
**Fix:**
\`\`\`javascript
// Correction
\`\`\`
**Impact:** What breaks across system

### For Business Logic Issues:
#### 💼 BUSINESS LOGIC - [Title]
**Type:** \`business-logic\`
**File:** path/to/file.js
**Line:** 100-110
**Problematic Code:**
\`\`\`javascript
// Code with flawed logic
\`\`\`
**Issue:** Incorrect business rule / state transition
**Affected User Journeys:**
- Journey 1: step sequence that breaks
**Fix:**
\`\`\`javascript
// Correct logic
\`\`\`
**Business Impact:** Revenue loss, data integrity issues, UX failures

Provide AT LEAST 3-5 concrete findings per agent from ACTUAL code you read.
`;

    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: "🔍 Code Analysis",
      cancellable: false
    }, async (progress) => {
      try {
        progress.report({ increment: 10, message: `Analyzing ${targetDescription}...` });
        
        const response: OrchestrationResponse = await orchestrateSecurityAnalysis(goal, projectPath, {
          forceRefresh: true
        });
        
        if (!response.success) {
          throw new Error(response.error || "Security analysis failed");
        }

        // Display the nested tool call tree
        displayToolCallTree(response);

        progress.report({ increment: 60, message: "Processing findings..." });

        // Parse agent results into structured issues
        const securityIssues: Issue[] = await parseSecurityFindings(response, projectPath);
        
        progress.report({ increment: 30, message: "Displaying results..." });
        
        // Update the Issues Panel with findings
        issuesPanelProvider.update(securityIssues);
        projectIssues = securityIssues;
        
        vscode.window.showInformationMessage(
          `Security analysis complete! Found ${securityIssues.length} issue(s).`
        );

      } catch (error: any) {
        console.error("Security analysis failed:", error);
        vscode.window.showErrorMessage(`Security analysis failed: ${error.message}`);
      }
    });
  }

  // Command to scan the currently active file (using orchestrator)
  const scanActiveFile = vscode.commands.registerCommand("secureScan.scanActiveFile", async () => {
    console.log("🔒 Starting security analysis for active file...");
    
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage("No active file. Please open a file first.");
      return;
    }

    const filePath = editor.document.uri.fsPath;
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
    
    if (!workspaceFolder) {
      vscode.window.showErrorMessage("File is not part of a workspace.");
      return;
    }

    const projectPath = workspaceFolder.uri.fsPath;
    const fileName = filePath.split(/[/\\]/).pop() || 'file';
    
    await performOrchestratorAnalysis(projectPath, fileName, [filePath]);
  });

  // Command to scan the entire project (using orchestrator)
  const scanProject = vscode.commands.registerCommand("secureScan.scanProject", async () => {
    console.log("🔒 Starting security analysis for entire project...");
    
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      vscode.window.showErrorMessage("No workspace folder found. Please open a folder first.");
      return;
    }

    const projectPath = workspaceFolder.uri.fsPath;
    const folderName = projectPath.split(/[/\\]/).pop() || 'project';
    
    await performOrchestratorAnalysis(projectPath, `entire project: ${folderName}`);
  });

  // Command to scan selected files (using orchestrator)
  const scanSelectedFiles = vscode.commands.registerCommand("secureScan.scanSelectedFiles", async () => {
    console.log("🔒 Starting security analysis for selected files...");

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      vscode.window.showErrorMessage("No workspace folder found. Please open a folder first.");
      return;
    }

    // Discover available files
    const allFiles = await vscode.workspace.findFiles(
      '**/*.{js,ts,py,java,go,rb,php,cs,c,cpp,h,hpp,html,css,json,yaml,yml,jsx,tsx}',
      '**/{node_modules,venv,target,dist,.git,vendor,build,out}/**'
    );

    if (allFiles.length === 0) {
      vscode.window.showInformationMessage("No scannable files found in the project.");
      return;
    }

    // Create quick pick items
    const quickPickItems = allFiles.map(file => ({
      label: vscode.workspace.asRelativePath(file),
      description: file.fsPath,
      picked: false
    }));

    // Show multi-select quick pick
    const selectedItems = await vscode.window.showQuickPick(quickPickItems, {
      placeHolder: "Select files to scan (use Space to select/deselect, Enter to confirm)",
      canPickMany: true,
      matchOnDescription: true
    });

    if (!selectedItems || selectedItems.length === 0) {
      vscode.window.showInformationMessage("No files selected for scanning.");
      return;
    }

    const selectedFilePaths = selectedItems.map(item => item.description!);
    const projectPath = workspaceFolder.uri.fsPath;
    
    await performOrchestratorAnalysis(projectPath, `${selectedFilePaths.length} selected file(s)`, selectedFilePaths);
  });

  const navigateToCommand = vscode.commands.registerCommand('secureScan.navigateTo', async (filePath: string, line: number) => {
    try {
      console.log(`\n🔍 ===== NAVIGATION DEBUG =====`);
      console.log(`Target: ${filePath}, reported line: ${line + 1}`);

      const uri = vscode.Uri.file(filePath);
      const doc = await vscode.workspace.openTextDocument(uri);
      const editor = await vscode.window.showTextDocument(doc);
      const fileLines = doc.getText().split('\n');

      let issue = projectIssues.find(i => i.filePath === filePath && i.line === line);

      if (!issue) {
        console.log(`⚠️ No exact match, searching nearby lines...`);
        issue = projectIssues.find(i => i.filePath === filePath && Math.abs(i.line - line) <= 10);
      }

      let targetLine = Math.max(0, Math.min(issue ? issue.line : line, doc.lineCount - 1));

      if (issue && issue.code_snippet) {
        console.log(`\n📝 Issue found with code snippet (${issue.code_snippet.length} chars)`);
        const needsAlignment =
          issue.calculatedEndLine === undefined || issue.calculatedEndLine < issue.line;
        const alignment = needsAlignment
          ? alignSnippetInLines(fileLines, issue.code_snippet, targetLine)
          : { line: issue.line, endLine: issue.calculatedEndLine ?? issue.line, matched: true };

        if (alignment.matched) {
          targetLine = alignment.line;
          issue.line = alignment.line;
          issue.calculatedEndLine = alignment.endLine;
          console.log(`🎯 Aligned snippet to lines ${alignment.line + 1}-${alignment.endLine + 1}`);
        } else {
          console.log(`⚠️ Could not align snippet, falling back to stored line ${targetLine + 1}`);
        }
      } else if (!issue) {
        console.log(`\n⚠️ No corresponding issue entry, using reported line`);
      }

      const position = new vscode.Position(targetLine, 0);
      console.log(`\n📍 Navigating to line ${targetLine + 1}`);
      console.log(`Actual file line: "${doc.lineAt(targetLine).text.substring(0, 80)}"`);

      if (issue) {
        let endLine: number;

        if (issue.calculatedEndLine !== undefined && issue.calculatedEndLine >= targetLine) {
          endLine = Math.min(issue.calculatedEndLine, doc.lineCount - 1);
          console.log(`Using cached end line: ${endLine + 1}`);
        } else if (issue.code_snippet) {
          const snippetLineCount = issue.code_snippet
            .replace(/```\w*\n?/g, '')
            .split('\n')
            .filter(l => l.trim().length > 0)
            .length;
          endLine = Math.min(targetLine + Math.max(0, snippetLineCount - 1), doc.lineCount - 1);
          console.log(`Estimating end line via snippet length: ${endLine + 1}`);
        } else {
          endLine = targetLine;
        }

        const range = new vscode.Range(
          new vscode.Position(targetLine, 0),
          new vscode.Position(endLine, doc.lineAt(endLine).text.length)
        );

        console.log(`Highlighting lines ${targetLine + 1} to ${endLine + 1} (${endLine - targetLine + 1} lines)`);

        let backgroundColor: string;
        let borderColor: string;

        switch (issue.severity) {
          case 'Critical':
            backgroundColor = 'rgba(255, 76, 76, 0.3)';
            borderColor = 'rgba(255, 76, 76, 0.8)';
            break;
          case 'High':
            backgroundColor = 'rgba(255, 136, 0, 0.3)';
            borderColor = 'rgba(255, 136, 0, 0.8)';
            break;
          case 'Medium':
            backgroundColor = 'rgba(227, 179, 65, 0.25)';
            borderColor = 'rgba(227, 179, 65, 0.8)';
            break;
          case 'Low':
            backgroundColor = 'rgba(78, 201, 176, 0.2)';
            borderColor = 'rgba(78, 201, 176, 0.7)';
            break;
          default:
            backgroundColor = 'rgba(133, 133, 133, 0.2)';
            borderColor = 'rgba(133, 133, 133, 0.6)';
        }

        const decorationType = vscode.window.createTextEditorDecorationType({
          backgroundColor: backgroundColor,
          isWholeLine: false,
          borderWidth: '1px 0 1px 3px',
          borderStyle: 'solid',
          borderColor: borderColor,
          overviewRulerColor: borderColor,
          overviewRulerLane: vscode.OverviewRulerLane.Right
        });

        editor.setDecorations(decorationType, [range]);
        console.log(`✅ Applied ${issue.severity} decoration`);

        setTimeout(() => {
          decorationType.dispose();
        }, 5000);
      }

      editor.selection = new vscode.Selection(position, position);
      editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);

      console.log(`===== END NAVIGATION DEBUG =====\n`);
    } catch (error) {
      console.error("Failed to navigate:", error);
      vscode.window.showErrorMessage("Could not open the specified file.");
    }
  });

  
  const activeEditorListener = vscode.window.onDidChangeActiveTextEditor(editor => {
    if (editor) {
      const filePath = editor.document.uri.fsPath;
      const issuesForFile = projectIssues.filter(issue => issue.filePath === filePath && issue.isActive);
      if (issuesForFile.length > 0) {
        highlightEntries(editor, issuesForFile);
      } else {
        clearHighlights(editor);
      }
    }
  });

  context.subscriptions.push(
    scanActiveFile, 
    scanProject, 
    scanSelectedFiles, 
    navigateToCommand,
    vscode.commands.registerCommand('secureScan.applyFix', applyFixCommand),
    activeEditorListener
  );
}

async function applyFixCommand(filePath: string, line: number, endLine: number | undefined, fixText: string) {
  try {
    const targetUri = vscode.Uri.file(filePath);
    const doc = await vscode.workspace.openTextDocument(targetUri);
    const editor = await vscode.window.showTextDocument(doc);

    const issue = projectIssues.find(i => i.filePath === filePath && Math.abs(i.line - line) <= 2);
    const startLine = Math.max(0, Math.min(line, doc.lineCount - 1));
    const snippetLineCount = issue && issue.code_snippet
      ? issue.code_snippet.split('\n').filter(l => l.trim().length > 0).length
      : 1;
    const computedEndLine = endLine !== undefined && endLine >= startLine
      ? Math.min(endLine, doc.lineCount - 1)
      : Math.min(startLine + Math.max(0, snippetLineCount - 1), doc.lineCount - 1);

    const range = new vscode.Range(
      new vscode.Position(startLine, 0),
      new vscode.Position(computedEndLine, doc.lineAt(computedEndLine).text.length)
    );

    const edit = new vscode.WorkspaceEdit();
    edit.replace(targetUri, range, fixText);
    const success = await vscode.workspace.applyEdit(edit);

    if (success) {
      await doc.save();
      vscode.window.showInformationMessage(`Applied fix to ${path.basename(filePath)}:${startLine + 1}`);
      // Update cached lines and re-highlight only this issue
      snippetFileLineCache.delete(filePath);
      if (issue) {
        issue.line = startLine;
        issue.calculatedEndLine = startLine + fixText.split('\n').length - 1;
        issue.code_snippet = fixText;
        projectIssues.forEach(rec => { rec.isActive = false; });
        issue.isActive = true;
        highlightEntries(editor, [issue]);
      }
    } else {
      vscode.window.showErrorMessage(`Could not apply fix to ${path.basename(filePath)}`);
    }
  } catch (error: any) {
    console.error('Failed to apply fix:', error);
    vscode.window.showErrorMessage(`Failed to apply fix: ${error.message}`);
  }
}

/**
 * Parse security findings from agent results into Issue format
 */
async function parseSecurityFindings(response: OrchestrationResponse, projectPath: string): Promise<Issue[]> {
  const issues: Issue[] = [];
  snippetFileLineCache.clear();
  
  console.log('🔍 Parsing security findings...');
  console.log('Project Path:', projectPath);
  console.log('Agent Results count:', response.agentResults?.length || 0);
  
  if (!response.agentResults || response.agentResults.length === 0) {
    console.log('⚠️ No agent results to parse');
    return issues;
  }

  for (const agentResult of response.agentResults) {
    console.log(`\n📋 Processing agent: ${agentResult.agentId}`);
    console.log(`Success: ${agentResult.success}`);
    
    if (!agentResult.success || !agentResult.result?.message) {
      console.log('⏭️ Skipping agent (no successful result)');
      continue;
    }

    const message = agentResult.result.message;
    console.log(`📝 Message length: ${message.length}`);
    
    // Parse findings - handle multiple formats:
    // Format 1: Your format - 🔴 CRITICAL\nDBConnector.py:124\nProblem:...
    // Format 2: Prompt format - #### 🔴 CRITICAL - Title\n**File:**...\n**Line:**...
    // New formats: ⚠️ EDGE CASE, 🔗 CROSS-FILE BUG, 💼 BUSINESS LOGIC
    
    // Split on emoji markers for both vulnerabilities and new issue types
    const emojiBlocks = message.split(/(?=🔴|🟠|🟡|🔵|⚠️|🔗|💼)/);
    
    for (const block of emojiBlocks) {
      if (block.trim().length < 20) continue;
      
      console.log('\n--- Processing emoji block ---');
      console.log(block.substring(0, 300));
      
      try {
        // Detect issue type from block content
        let issueType: 'vulnerability' | 'edge-case' | 'cross-file-bug' | 'business-logic' = 'vulnerability';
        if (block.includes('⚠️') || block.includes('EDGE CASE') || block.includes('**Type:** `edge-case`')) {
          issueType = 'edge-case';
        } else if (block.includes('🔗') || block.includes('CROSS-FILE BUG') || block.includes('**Type:** `cross-file-bug`')) {
          issueType = 'cross-file-bug';
        } else if (block.includes('💼') || block.includes('BUSINESS LOGIC') || block.includes('**Type:** `business-logic`')) {
          issueType = 'business-logic';
        }
        
        // Extract severity
        let severity: 'Critical' | 'High' | 'Medium' | 'Low' = 'Medium';
        if (block.includes('🔴') || block.includes('CRITICAL')) {
          severity = 'Critical';
        } else if (block.includes('🟠') || block.includes('HIGH')) {
          severity = 'High';
        } else if (block.includes('🟡') || block.includes('MEDIUM')) {
          severity = 'Medium';
        } else if (block.includes('🔵') || block.includes('LOW')) {
          severity = 'Low';
        }
        
        // Check if it's Format 2 (with **File:** markers)
        const hasFileMarker = block.includes('**File:**') || block.includes('**Primary File:**');
        
        if (hasFileMarker) {
          // Format 2: #### 🔴 CRITICAL - Title\n**File:**...**Line:**...
          // Also handles: EDGE CASE, CROSS-FILE BUG, BUSINESS LOGIC formats
          console.log(`Using Format 2 (File marker), issueType: ${issueType}`);
          
          const titleMatch = block.match(/####?\s*(?:🔴|🟠|🟡|🔵|⚠️|🔗|💼)?\s*(?:CRITICAL|HIGH|MEDIUM|LOW|EDGE CASE|CROSS-FILE BUG|BUSINESS LOGIC)?\s*-?\s*([^\n]+)/);
          // Support both **File:** and **Primary File:** for cross-file bugs
          const fileMatch = block.match(/\*\*(?:File|Primary File):\*\*\s*`?([^`\n]+)`?/);
          const lineMatch = block.match(/\*\*Line:\*\*\s*`?([^`\n]+)`?/);
          
          // Extract code snippet - try multiple field names based on issue type
          let vulnMatch = block.match(/\*\*(?:Vulnerable Code|Problematic Code|Root Cause Code):\*\*\s*```\w*\n([\s\S]*?)```/);
          if (!vulnMatch) {
            vulnMatch = block.match(/\*\*(?:Vulnerable Code|Problematic Code|Root Cause Code):\*\*\s*\n([\s\S]*?)(?=\n\*\*|$)/);
          }
          
          // Extract issue/problem description - try multiple field names
          const issueMatch = block.match(/\*\*(?:Issue|Edge Case):\*\*\s*([^\n]+(?:\n(?!\*\*)[^\n]+)*)/);
          
          // Improved fix extraction
          let fixMatch = block.match(/\*\*Fix:\*\*\s*```\w*\n([\s\S]*?)```/);
          if (!fixMatch) {
            fixMatch = block.match(/\*\*Fix:\*\*\s*\n([\s\S]*?)(?=\n\*\*|---|\n\n\n|$)/);
          }
          
          // Extract impact - try multiple field names
          const impactMatch = block.match(/\*\*(?:Impact|User Impact|Business Impact):\*\*\s*([^\n]+(?:\n(?!\*\*|---|####)[^\n]+)*)/);
          
          // Also try alternative format: "Problem:" instead of "Issue:"
          const problemMatch = block.match(/\*\*Problem:\*\*\s*([^\n]+(?:\n(?!\*\*)[^\n]+)*)/);
          const issueText = issueMatch ? issueMatch[1].trim() : (problemMatch ? problemMatch[1].trim() : '');
          
          // Extract affected dependencies for edge-case and cross-file-bug types
          const affectedDepsMatch = block.match(/\*\*(?:Affected Dependencies|Ripple Effect Files|Affected User Journeys):\*\*\s*([\s\S]*?)(?=\n\*\*Fix|\n---|\n\n\n|$)/);
          let affectedDependencies: string[] = [];
          if (affectedDepsMatch) {
            const depsText = affectedDepsMatch[1].trim();
            affectedDependencies = depsText.split('\n')
              .map(line => line.replace(/^[-*]\s*/, '').trim())
              .filter(line => line.length > 0);
          }
          
          if (!fileMatch) {
            console.log('⚠️ No file marker found in Format 2 block');
            continue;
          }
          
          const fileName = fileMatch[1].trim();
          const lineStr = lineMatch ? lineMatch[1].trim() : '';
          
          // Extract first number from line string (could be "45", "45-48", etc.)
          // If no line number found, skip this issue as we can't navigate to it
          const lineNumMatch = lineStr.match(/\d+/);
          if (!lineNumMatch) {
            console.log(`⚠️ No valid line number found (lineStr: "${lineStr}"), skipping issue`);
            continue;
          }
          
          const lineNum = Math.max(0, parseInt(lineNumMatch[0]) - 1);
          
          console.log(`📄 Format 2 - File: ${fileName}, Line string: "${lineStr}", Parsed line: ${lineNum + 1}, Type: ${issueType}`);
          
          const filePath = await resolveReportedFile(projectPath, fileName);
          if (!filePath) {
            console.log(`⚠️ Skipping issue; file not found in workspace: ${fileName}`);
            continue;
          }
          
          const vulnerableCode = vulnMatch ? vulnMatch[1].trim().replace(/```\w*\n?/g, '').trim() : '';

          if (!vulnerableCode || vulnerableCode.length < 10) {
            console.log(`⚠️ No valid vulnerable code found (length: ${vulnerableCode.length}), skipping issue`);
            continue;
          }

          console.log(`Vulnerable code (first 100 chars): ${vulnerableCode.substring(0, 100)}`);

          const snippetAlignment = await alignSnippetWithFile(filePath, vulnerableCode, lineNum);
          if (snippetAlignment.matched) {
            console.log(`🔁 Refined snippet to lines ${snippetAlignment.line + 1}-${snippetAlignment.endLine + 1}`);
          } else {
            console.log(`⚠️ Unable to refine snippet, using provided line ${lineNum + 1}`);
          }

          // Build explanation based on issue type
          let explanation = titleMatch?.[1]?.trim() || 'Issue';
          explanation += `\n\n${issueText}`;
          if (impactMatch?.[1]) {
            explanation += `\n\nImpact: ${impactMatch[1].trim()}`;
          }
          if (affectedDependencies.length > 0) {
            explanation += `\n\nAffected: ${affectedDependencies.join(', ')}`;
          }

          issues.push({
            filePath: filePath,
            line: snippetAlignment.line,
            code_snippet: (snippetAlignment.resolvedText || vulnerableCode).trimEnd(),
            severity: severity,
            vulnerability_explanation: explanation,
            recommended_fix: fixMatch ? fixMatch[1].trim().replace(/```\w*\n?/g, '').trim() : 'Review and apply best practices',
            cve_ids: [],
            cwe_ids: [],
            calculatedEndLine: snippetAlignment.endLine,
            isActive: false,
            issueType: issueType,
            affectedDependencies: affectedDependencies.length > 0 ? affectedDependencies : undefined
          });
          
          console.log(`✅ Added Format 2 issue (${issueType})`);
          continue;
        }
        
        // Format 1: Extract file path and line number from patterns like:
        // "DBConnector.py:124" or "path/to/file.js:45"
        const fileLineMatch = block.match(/([^\s:]+\.[a-zA-Z0-9]+):(\d+)/);
        
        if (!fileLineMatch) {
          console.log('⚠️ No file:line pattern found in Format 1 block');
          continue;
        }
        
        const [, fileName, lineNumber] = fileLineMatch;
        console.log(`📄 Format 1 - File: ${fileName}, Line: ${lineNumber}`);
        
        // Try to find the file in the workspace
        // Ensure line number is valid (at least 1)
        const parsedLine = parseInt(lineNumber);
        const line = parsedLine > 0 ? parsedLine - 1 : 0; // VS Code uses 0-based indexing
        
        const filePath = await resolveReportedFile(projectPath, fileName);
        if (!filePath) {
          console.log(`⚠️ Skipping issue; file not found in workspace: ${fileName}`);
          continue;
        }
        
        // Extract problem/title
        const problemMatch = block.match(/Problem:\s*([^\n]+(?:\n(?!Vulnerable Code:|Fix:|Impact:)[^\n]+)*)/i);
        const problem = problemMatch ? problemMatch[1].trim() : 'Security Issue';
        
        // Extract vulnerable code
        const vulnCodeMatch = block.match(/Vulnerable Code:\s*([\s\S]*?)(?=\n(?:Fix:|Impact:)|$)/i);
        const rawSnippet = vulnCodeMatch ? vulnCodeMatch[1].trim() : '';
        const displaySnippet = rawSnippet
          ? rawSnippet.replace(/```\w*\n?/g, '').replace(/```/g, '').trim()
          : 'See details';
        
        const fixMatch = block.match(/Fix:\s*([\s\S]*?)(?=\n(?:Impact:|$)|---)/i);
        const fix = fixMatch ? fixMatch[1].trim() : 'Review the code';
        
        // Extract impact
        const impactMatch = block.match(/Impact:\s*([^\n]+(?:\n(?!---)[^\n]+)*)/i);
        const impact = impactMatch ? impactMatch[1].trim() : 'Security vulnerability';
        
        let snippetAlignment: SnippetAlignmentResult = {
          line,
          endLine: line,
          matched: false
        };

        if (displaySnippet && displaySnippet.length >= 5 && displaySnippet !== 'See details') {
          snippetAlignment = await alignSnippetWithFile(filePath, displaySnippet, line);
          if (snippetAlignment.matched) {
            console.log(`🔁 Refined Format 1 snippet to lines ${snippetAlignment.line + 1}-${snippetAlignment.endLine + 1}`);
          } else {
            console.log(`⚠️ Could not align Format 1 snippet, using reported line ${line + 1}`);
          }
        }

        console.log(`✅ Adding issue: ${problem} in ${filePath} at line ${snippetAlignment.line + 1}`);
        
        issues.push({
          filePath: filePath,
          line: snippetAlignment.line,
          code_snippet: (snippetAlignment.resolvedText || displaySnippet).trimEnd(),
          severity: severity,
          vulnerability_explanation: `${problem}\n\n${impact}`,
          recommended_fix: fix.replace(/```\w*\n?/g, '').trim(),
          cve_ids: [],
          cwe_ids: [],
          calculatedEndLine: snippetAlignment.endLine,
          isActive: false
        });
        
      } catch (err) {
        console.error('Error parsing block:', err);
      }
    }
  }
  
  console.log(`\n✅ Total issues parsed: ${issues.length}`);
  
  // If no issues found but we have agent results, show the raw messages
  if (issues.length === 0 && response.agentResults && response.agentResults.length > 0) {
    console.log('\n⚠️ No issues parsed, but agent results exist. Showing raw agent messages:');
    
    for (const agentResult of response.agentResults) {
      if (agentResult.success && agentResult.result?.message) {
        console.log(`\n=== ${agentResult.agentId} ===`);
        console.log(agentResult.result.message);
        console.log('=== END ===\n');
      }
    }
  }
  
  return issues;
}

/**
 * Generate HTML for security analysis results display
 */
function generateSecurityAnalysisHTML(response: OrchestrationResponse): string {
  const { result, spawnedAgents, agentResults, conversationTurns } = response;
  
  let html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 20px;
      line-height: 1.6;
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
    }
    h1, h2, h3 { color: var(--vscode-editor-foreground); }
    h1 { border-bottom: 2px solid var(--vscode-textLink-foreground); padding-bottom: 10px; }
    h2 { margin-top: 30px; border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 5px; }
    .stats {
      display: flex;
      gap: 20px;
      margin: 20px 0;
      flex-wrap: wrap;
    }
    .stat-card {
      background: var(--vscode-editor-inactiveSelectionBackground);
      padding: 15px;
      border-radius: 5px;
      border-left: 3px solid var(--vscode-textLink-foreground);
    }
    .stat-value { font-size: 24px; font-weight: bold; }
    .stat-label { font-size: 12px; opacity: 0.8; }
    .agent-section {
      background: var(--vscode-editor-inactiveSelectionBackground);
      padding: 20px;
      margin: 20px 0;
      border-radius: 5px;
      border-left: 4px solid var(--vscode-textLink-activeForeground);
    }
    .agent-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
    }
    .agent-badge {
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      padding: 3px 8px;
      border-radius: 3px;
      font-size: 11px;
      font-weight: bold;
    }
    .severity-critical { color: #f14c4c; font-weight: bold; }
    .severity-high { color: #ff8800; font-weight: bold; }
    .severity-medium { color: #e3b341; font-weight: bold; }
    .severity-low { color: #4ec9b0; font-weight: bold; }
    .findings {
      white-space: pre-wrap;
      background: var(--vscode-textCodeBlock-background);
      padding: 15px;
      border-radius: 3px;
      overflow-x: auto;
      margin-top: 10px;
    }
    .summary {
      background: var(--vscode-textBlockQuote-background);
      border-left: 4px solid var(--vscode-textBlockQuote-border);
      padding: 15px;
      margin: 20px 0;
    }
    code {
      background: var(--vscode-textCodeBlock-background);
      padding: 2px 6px;
      border-radius: 3px;
    }
    .success { color: #4ec9b0; }
    .error { color: #f14c4c; }
  </style>
</head>
<body>
  <h1>🔒 Comprehensive Security Analysis Results</h1>
  
  <div class="stats">
    <div class="stat-card">
      <div class="stat-value">${agentResults?.length || 0}</div>
      <div class="stat-label">Security Agents</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${agentResults?.filter(a => a.success).length || 0}</div>
      <div class="stat-label">Successful Analyses</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${conversationTurns || 0}</div>
      <div class="stat-label">Conversation Turns</div>
    </div>
  </div>

  <h2>🤖 Deployed Security Agents</h2>
  <ul>
  ${spawnedAgents?.map(agent => `
    <li><strong>${agent.agentId}</strong>: ${agent.purpose}</li>
  `).join('') || '<li>No agents spawned</li>'}
  </ul>

  <h2>🔍 Detailed Agent Findings</h2>
  `;

  if (agentResults && agentResults.length > 0) {
    agentResults.forEach((agentResult: AgentResult) => {
      const statusClass = agentResult.success ? 'success' : 'error';
      const statusIcon = agentResult.success ? '✅' : '❌';
      
      html += `
      <div class="agent-section">
        <div class="agent-header">
          <h3>${statusIcon} ${agentResult.agentId.toUpperCase()}</h3>
          <span class="agent-badge ${statusClass}">${agentResult.success ? 'COMPLETED' : 'FAILED'}</span>
        </div>
        <p><strong>Purpose:</strong> ${agentResult.purpose}</p>
        ${agentResult.executionTime ? `<p><strong>Execution Time:</strong> ${agentResult.executionTime}ms</p>` : ''}
        ${agentResult.toolCallCount ? `<p><strong>Tool Calls:</strong> ${agentResult.toolCallCount}</p>` : ''}
        `;
      
      if (agentResult.success && agentResult.result?.message) {
        let message = agentResult.result.message
          .replace(/CRITICAL/g, '<span class="severity-critical">CRITICAL</span>')
          .replace(/HIGH/g, '<span class="severity-high">HIGH</span>')
          .replace(/MEDIUM/g, '<span class="severity-medium">MEDIUM</span>')
          .replace(/LOW/g, '<span class="severity-low">LOW</span>');
        
        html += `<div class="findings">${message}</div>`;
      } else if (agentResult.error) {
        html += `<p class="error"><strong>Error:</strong> ${agentResult.error}</p>`;
      }
      
      html += `</div>`;
    });
  } else {
    html += `<p>No agent results available.</p>`;
  }

  html += `
  <h2>📊 Orchestrator Summary</h2>
  <div class="summary">
    ${result?.message ? result.message.replace(/\n/g, '<br>') : 'No summary available.'}
  </div>

  <hr>
  <p style="opacity: 0.7; font-size: 12px;">Generated by AI Grand Challenge Security Analysis</p>
</body>
</html>
  `;
  
  return html;
}

export function deactivate() {
  console.log("🔌 SecureScan extension deactivated");
}