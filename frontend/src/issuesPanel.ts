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

    // NEW: Handle messages from the webview (when an issue is clicked)
    view.webview.onDidReceiveMessage(message => {
      switch (message.command) {
        case 'navigateTo':
          vscode.commands.executeCommand('secureScan.navigateTo', message.filePath, message.line);
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
    const listItems = issues.map((issue) => {
      const escapeHtml = (unsafe: string) => {
        return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
      };
      
      const fileName = issue.filePath.split(/[/\\]/).pop() || issue.filePath;

      // MODIFIED: Added onclick and data attributes to the list item
      return `
      <li 
        class="issue-item"
        onclick="navigateTo('${escapeHtml(issue.filePath)}', ${issue.line})"
        title="Click to navigate to ${escapeHtml(fileName)} line ${issue.line + 1}"
      >
        <p><strong>File:</strong> ${escapeHtml(fileName)} (line ${issue.line + 1})</p>
        <strong>Severity:</strong> ${escapeHtml(issue.severity)} <br/>
        <pre>${escapeHtml(issue.code_snippet)}</pre>
        <p><strong>Explanation:</strong> ${escapeHtml(issue.vulnerability_explanation)}</p>
      </li>
    `;
    }).join("");

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 10px; color: #ccc; }
          ul { list-style-type: none; padding: 0; }
          li.issue-item { 
            margin-bottom: 15px; 
            padding: 10px; 
            border: 1px solid #333; 
            border-radius: 5px;
            cursor: pointer;
            transition: background-color 0.2s;
          }
          li.issue-item:hover { background-color: #333; }
          p { margin-top: 5px; margin-bottom: 5px; }
          pre { background:#222; color:#eee; padding:8px; border-radius:3px; white-space: pre-wrap; word-wrap: break-word; }
        </style>
      </head>
      <body>
        <h2>🔍 SecureScan Issues</h2>
        <ul>${listItems.length > 0 ? listItems : "<li>No issues found.</li>"}</ul>
        
        <script>
          const vscode = acquireVsCodeApi();
          function navigateTo(filePath, line) {
            vscode.postMessage({
              command: 'navigateTo',
              filePath: filePath,
              line: line
            });
          }
        </script>
      </body>
      </html>
    `;
  }
}