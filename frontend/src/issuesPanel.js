"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IssuesPanelProvider = void 0;
var vscode = require("vscode");
var IssuesPanelProvider = /** @class */ (function () {
    function IssuesPanelProvider(context) {
        this.context = context;
    }
    IssuesPanelProvider.prototype.resolveWebviewView = function (view, _resolveContext, _token) {
        this._view = view;
        view.webview.options = { enableScripts: true };
        view.webview.onDidReceiveMessage(function (message) {
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
    };
    IssuesPanelProvider.prototype.update = function (issues) {
        var _a, _b;
        if (this._view) {
            (_b = (_a = this._view).show) === null || _b === void 0 ? void 0 : _b.call(_a, true);
            this._view.webview.html = this._getHtmlForIssues(issues);
        }
    };
    IssuesPanelProvider.prototype._getHtmlForIssues = function (issues) {
        var escapeHtml = function (unsafe) {
            return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
        };
        var getSeverityColor = function (severity) {
            switch (severity.toLowerCase()) {
                case 'critical': return '#f14c4c';
                case 'high': return '#ff8800';
                case 'medium': return '#e3b341';
                case 'low': return '#4ec9b0';
                default: return '#858585';
            }
        };
        var getSeverityEmoji = function (severity) {
            switch (severity.toLowerCase()) {
                case 'critical': return '🔴';
                case 'high': return '🟠';
                case 'medium': return '🟡';
                case 'low': return '🔵';
                default: return '⚪';
            }
        };
        var quickActions = [
            { label: 'Scan Active File', command: 'secureScan.scanActiveFile', title: 'Analyze the currently open editor' },
            { label: 'Scan Entire Project', command: 'secureScan.scanProject', title: 'Analyze every file in the workspace' },
            { label: 'Scan Selected Files', command: 'secureScan.scanSelectedFiles', title: 'Pick specific files to analyze' }
        ];
        var quickActionButtons = quickActions.map(function (action) { return "\n      <button class=\"quick-action\" title=\"".concat(escapeHtml(action.title), "\" onclick=\"runCommand('").concat(action.command, "')\">\n        ").concat(escapeHtml(action.label), "\n      </button>\n    "); }).join('');
        var listItems = issues.map(function (issue) {
            var fileName = issue.filePath.split(/[/\\]/).pop() || issue.filePath;
            var severityColor = getSeverityColor(issue.severity);
            var severityEmoji = getSeverityEmoji(issue.severity);
            var lineNumber = issue.line + 1;
            return "\n      <div \n        class=\"issue-item\"\n        onclick=\"navigateTo('".concat(escapeHtml(issue.filePath), "', ").concat(issue.line, ")\"\n        title=\"Click to open ").concat(escapeHtml(fileName), ":").concat(lineNumber, "\"\n      >\n        <div class=\"issue-header\">\n          <span class=\"severity\" style=\"color: ").concat(severityColor, ";\">").concat(severityEmoji, " ").concat(escapeHtml(issue.severity.toUpperCase()), "</span>\n          <span class=\"file-location\">").concat(escapeHtml(fileName), ":").concat(lineNumber, "</span>\n        </div>\n        \n        <div class=\"issue-body\">\n          <div class=\"section\">\n            <strong>Problem:</strong>\n            <p>").concat(escapeHtml(issue.vulnerability_explanation), "</p>\n          </div>\n          \n          ").concat(issue.code_snippet ? "\n          <div class=\"section\">\n            <strong>Vulnerable Code:</strong>\n            <pre class=\"code-block\">".concat(escapeHtml(issue.code_snippet), "</pre>\n          </div>\n          ") : '', "\n          \n          ").concat(issue.recommended_fix ? "\n          <div class=\"section\">\n            <strong>Fix:</strong>\n            <pre class=\"code-block fix\">".concat(escapeHtml(issue.recommended_fix), "</pre>\n          </div>\n          ") : '', "\n        </div>\n      </div>\n    ");
        }).join("");
        return "\n      <!DOCTYPE html>\n      <html lang=\"en\">\n      <head>\n        <meta charset=\"UTF-8\">\n        <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n        <style>\n          body { \n            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; \n            padding: 10px; \n            color: var(--vscode-foreground);\n            background: var(--vscode-editor-background);\n            font-size: 13px;\n          }\n          \n          .toolbar {\n            display: flex;\n            flex-wrap: wrap;\n            gap: 8px;\n            margin-bottom: 16px;\n          }\n\n          .quick-action {\n            flex: 1 1 140px;\n            border: 1px solid var(--vscode-button-border, var(--vscode-panel-border));\n            background: var(--vscode-button-secondaryBackground);\n            color: var(--vscode-button-secondaryForeground);\n            padding: 6px 10px;\n            border-radius: 4px;\n            cursor: pointer;\n            font-weight: 600;\n            transition: background 0.2s ease, transform 0.1s ease;\n          }\n\n          .quick-action:hover {\n            background: var(--vscode-button-secondaryHoverBackground);\n            transform: translateY(-1px);\n          }\n\n          h2 {\n            margin: 0 0 15px 0;\n            font-size: 16px;\n            font-weight: 600;\n            color: var(--vscode-foreground);\n          }\n          \n          .issue-item { \n            margin-bottom: 12px; \n            padding: 12px; \n            background: var(--vscode-editor-inactiveSelectionBackground);\n            border-left: 3px solid var(--vscode-textLink-foreground);\n            border-radius: 4px;\n            cursor: pointer;\n            transition: all 0.2s;\n          }\n          \n          .issue-item:hover { \n            background: var(--vscode-list-hoverBackground);\n            transform: translateX(2px);\n          }\n          \n          .issue-header {\n            display: flex;\n            justify-content: space-between;\n            align-items: center;\n            margin-bottom: 10px;\n            font-size: 12px;\n          }\n          \n          .severity {\n            font-weight: bold;\n            font-size: 11px;\n            letter-spacing: 0.5px;\n          }\n          \n          .file-location {\n            opacity: 0.8;\n            font-family: 'Courier New', monospace;\n            font-size: 11px;\n          }\n          \n          .issue-body {\n            font-size: 12px;\n          }\n          \n          .section {\n            margin-bottom: 10px;\n          }\n          \n          .section:last-child {\n            margin-bottom: 0;\n          }\n          \n          .section strong {\n            display: block;\n            margin-bottom: 4px;\n            color: var(--vscode-textLink-foreground);\n            font-size: 11px;\n            text-transform: uppercase;\n            letter-spacing: 0.5px;\n          }\n          \n          .section p {\n            margin: 0;\n            line-height: 1.5;\n            color: var(--vscode-foreground);\n          }\n          \n          .code-block {\n            background: var(--vscode-textCodeBlock-background);\n            color: var(--vscode-editor-foreground);\n            padding: 8px;\n            border-radius: 3px;\n            white-space: pre-wrap;\n            word-wrap: break-word;\n            font-family: 'Courier New', monospace;\n            font-size: 11px;\n            line-height: 1.4;\n            margin: 4px 0 0 0;\n            border: 1px solid var(--vscode-panel-border);\n          }\n          \n          .code-block.fix {\n            border-left: 3px solid #4ec9b0;\n          }\n          \n          .no-issues {\n            text-align: center;\n            padding: 40px 20px;\n            color: var(--vscode-descriptionForeground);\n            font-size: 13px;\n          }\n          \n          .no-issues-icon {\n            font-size: 48px;\n            margin-bottom: 10px;\n          }\n        </style>\n      </head>\n      <body>\n        <h2>\uD83D\uDD12 Security Findings</h2>\n        <div class=\"toolbar\">\n          ".concat(quickActionButtons, "\n        </div>\n        ").concat(listItems.length > 0 ? listItems : "\n          <div class=\"no-issues\">\n            <div class=\"no-issues-icon\">\u2705</div>\n            <div>No security issues found.</div>\n          </div>\n        ", "\n        \n        <script>\n          const vscode = acquireVsCodeApi();\n          function navigateTo(filePath, line) {\n            vscode.postMessage({\n              command: 'navigateTo',\n              filePath: filePath,\n              line: line\n            });\n          }\n\n          function runCommand(commandId) {\n            vscode.postMessage({\n              command: 'runCommand',\n              commandId\n            });\n          }\n        </script>\n      </body>\n      </html>\n    ");
    };
    IssuesPanelProvider.viewType = "secureScan.issuesPanel";
    return IssuesPanelProvider;
}());
exports.IssuesPanelProvider = IssuesPanelProvider;
