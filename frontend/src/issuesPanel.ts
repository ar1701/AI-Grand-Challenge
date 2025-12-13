import * as vscode from "vscode";
import { Issue } from "./types";

export class IssuesPanelProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "secureScan.issuesPanel";
  private _view?: vscode.WebviewView;

  constructor(private readonly context: vscode.ExtensionContext) {}

  resolveWebviewView(
    view: vscode.WebviewView,
    _resolveContext: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = view;
    view.webview.options = { enableScripts: true };

    view.webview.onDidReceiveMessage(message => {
      switch (message.command) {
        case 'navigateTo':
          vscode.commands.executeCommand('secureScan.navigateTo', message.filePath, message.line);
          return;
        case 'runCommand':
          if (message.commandId) {
            vscode.commands.executeCommand(message.commandId);
          }
          return;
      }
    });

    view.webview.html = this._getHtmlForIssues([]);
  }

  public update(issues: Issue[]) {
    if (this._view) {
      this._view.show?.(true); 
      this._view.webview.html = this._getHtmlForIssues(issues);
    }
  }

  private _getHtmlForIssues(issues: Issue[]): string {
    const escapeHtml = (unsafe: string) => {
      return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    };
    
    const getSeverityColor = (severity: string) => {
      switch(severity.toLowerCase()) {
        case 'critical': return '#f14c4c';
        case 'high': return '#ff8800';
        case 'medium': return '#e3b341';
        case 'low': return '#4ec9b0';
        default: return '#858585';
      }
    };

    const getSeverityEmoji = (severity: string) => {
      switch(severity.toLowerCase()) {
        case 'critical': return '🔴';
        case 'high': return '🟠';
        case 'medium': return '🟡';
        case 'low': return '🔵';
        default: return '⚪';
      }
    };

    const quickActions = [
      { label: 'Scan Active File', command: 'secureScan.scanActiveFile', title: 'Analyze the currently open editor' },
      { label: 'Scan Entire Project', command: 'secureScan.scanProject', title: 'Analyze every file in the workspace' },
      { label: 'Scan Selected Files', command: 'secureScan.scanSelectedFiles', title: 'Pick specific files to analyze' }
    ];

    const quickActionButtons = quickActions.map(action => `
      <button class="quick-action" title="${escapeHtml(action.title)}" onclick="runCommand('${action.command}')">
        ${escapeHtml(action.label)}
      </button>
    `).join('');

    const listItems = issues.map((issue) => {
      const fileName = issue.filePath.split(/[/\\]/).pop() || issue.filePath;
      const severityColor = getSeverityColor(issue.severity);
      const severityEmoji = getSeverityEmoji(issue.severity);
      const lineNumber = issue.line + 1;

      return `
      <div 
        class="issue-item"
        onclick="navigateTo('${escapeHtml(issue.filePath)}', ${issue.line})"
        title="Click to open ${escapeHtml(fileName)}:${lineNumber}"
      >
        <div class="issue-header">
          <span class="severity" style="color: ${severityColor};">${severityEmoji} ${escapeHtml(issue.severity.toUpperCase())}</span>
          <span class="file-location">${escapeHtml(fileName)}:${lineNumber}</span>
        </div>
        
        <div class="issue-body">
          <div class="section">
            <strong>Problem:</strong>
            <p>${escapeHtml(issue.vulnerability_explanation)}</p>
          </div>
          
          ${issue.code_snippet ? `
          <div class="section">
            <strong>Vulnerable Code:</strong>
            <pre class="code-block">${escapeHtml(issue.code_snippet)}</pre>
          </div>
          ` : ''}
          
          ${issue.recommended_fix ? `
          <div class="section">
            <strong>Fix:</strong>
            <pre class="code-block fix">${escapeHtml(issue.recommended_fix)}</pre>
          </div>
          ` : ''}
        </div>
      </div>
    `;
    }).join("");

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            padding: 10px; 
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
            font-size: 13px;
          }
          
          .toolbar {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-bottom: 16px;
          }

          .quick-action {
            flex: 1 1 140px;
            border: 1px solid var(--vscode-button-border, var(--vscode-panel-border));
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            padding: 6px 10px;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 600;
            transition: background 0.2s ease, transform 0.1s ease;
          }

          .quick-action:hover {
            background: var(--vscode-button-secondaryHoverBackground);
            transform: translateY(-1px);
          }

          h2 {
            margin: 0 0 15px 0;
            font-size: 16px;
            font-weight: 600;
            color: var(--vscode-foreground);
          }
          
          .issue-item { 
            margin-bottom: 12px; 
            padding: 12px; 
            background: var(--vscode-editor-inactiveSelectionBackground);
            border-left: 3px solid var(--vscode-textLink-foreground);
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.2s;
          }
          
          .issue-item:hover { 
            background: var(--vscode-list-hoverBackground);
            transform: translateX(2px);
          }
          
          .issue-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
            font-size: 12px;
          }
          
          .severity {
            font-weight: bold;
            font-size: 11px;
            letter-spacing: 0.5px;
          }
          
          .file-location {
            opacity: 0.8;
            font-family: 'Courier New', monospace;
            font-size: 11px;
          }
          
          .issue-body {
            font-size: 12px;
          }
          
          .section {
            margin-bottom: 10px;
          }
          
          .section:last-child {
            margin-bottom: 0;
          }
          
          .section strong {
            display: block;
            margin-bottom: 4px;
            color: var(--vscode-textLink-foreground);
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          
          .section p {
            margin: 0;
            line-height: 1.5;
            color: var(--vscode-foreground);
          }
          
          .code-block {
            background: var(--vscode-textCodeBlock-background);
            color: var(--vscode-editor-foreground);
            padding: 8px;
            border-radius: 3px;
            white-space: pre-wrap;
            word-wrap: break-word;
            font-family: 'Courier New', monospace;
            font-size: 11px;
            line-height: 1.4;
            margin: 4px 0 0 0;
            border: 1px solid var(--vscode-panel-border);
          }
          
          .code-block.fix {
            border-left: 3px solid #4ec9b0;
          }
          
          .no-issues {
            text-align: center;
            padding: 40px 20px;
            color: var(--vscode-descriptionForeground);
            font-size: 13px;
          }
          
          .no-issues-icon {
            font-size: 48px;
            margin-bottom: 10px;
          }
        </style>
      </head>
      <body>
        <h2>🔒 Security Findings</h2>
        <div class="toolbar">
          ${quickActionButtons}
        </div>
        ${listItems.length > 0 ? listItems : `
          <div class="no-issues">
            <div class="no-issues-icon">✅</div>
            <div>No security issues found.</div>
          </div>
        `}
        
        <script>
          const vscode = acquireVsCodeApi();
          function navigateTo(filePath, line) {
            vscode.postMessage({
              command: 'navigateTo',
              filePath: filePath,
              line: line
            });
          }

          function runCommand(commandId) {
            vscode.postMessage({
              command: 'runCommand',
              commandId
            });
          }
        </script>
      </body>
      </html>
    `;
  }
}
