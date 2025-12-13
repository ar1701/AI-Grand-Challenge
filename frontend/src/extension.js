"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
var vscode = require("vscode");
var path = require("path");
var api_1 = require("./api");
var highlighter_1 = require("./highlighter");
var issuesPanel_1 = require("./issuesPanel");
var projectIssues = [];
var snippetFileLineCache = new Map();
function normalizeLineForMatch(line) {
    var trimmed = line.trim();
    if (!trimmed) {
        return "";
    }
    var commentPrefixes = ["//", "#", "/*", "*", "--"];
    if (commentPrefixes.some(function (prefix) { return trimmed.startsWith(prefix); })) {
        return "";
    }
    return trimmed.replace(/\s+/g, " ").toLowerCase();
}
function buildSnippetComparableLines(snippet) {
    var _a;
    return snippet
        .replace(/\r/g, "")
        .split("\n");
    if (issue) {
        if (issue.calculatedEndLine === undefined || issue.calculatedEndLine < targetLine) {
            issue.calculatedEndLine = targetLine;
        }
        projectIssues.forEach(function (record) {
            record.isActive = false;
        });
        issue.isActive = true;
        (0, highlighter_1.highlightEntries)(editor, [issue]);
        console.log("Highlighting active issue from line ".concat(targetLine + 1, " to ").concat(((_a = issue.calculatedEndLine) !== null && _a !== void 0 ? _a : targetLine) + 1));
    }
    else {
        (0, highlighter_1.clearHighlights)(editor);
    }
    editor.selection = new vscode.Selection(position, position);
    editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
    var matches = 1;
    var endIdx = startIdx;
    for (var offset = 1; offset < snippetLines.length; offset++) {
        var fileIdx = startIdx + offset;
        if (fileIdx >= normalizedFileLines.length) {
            break;
        }
        if (fuzzyLineIncludes(normalizedFileLines[fileIdx], snippetLines[offset])) {
            matches++;
            endIdx = fileIdx;
        }
        else {
            break;
        }
    }
    var score = matches * 100 - Math.abs(startIdx - safeFallback);
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
var resolvedStart = Math.max(0, Math.min(bestStart, fileLines.length - 1));
var resolvedEnd = Math.max(resolvedStart, Math.min(bestEnd, fileLines.length - 1));
var resolvedText = fileLines.slice(resolvedStart, resolvedEnd + 1).join('\n');
return {
    line: resolvedStart,
    endLine: resolvedEnd,
    matched: true,
    resolvedText: resolvedText
};
function getFileLines(filePath) {
    return __awaiter(this, void 0, void 0, function () {
        var document_1, lines, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (snippetFileLineCache.has(filePath)) {
                        return [2 /*return*/, snippetFileLineCache.get(filePath)];
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, vscode.workspace.openTextDocument(vscode.Uri.file(filePath))];
                case 2:
                    document_1 = _a.sent();
                    lines = document_1.getText().replace(/\r/g, "").split("\n");
                    snippetFileLineCache.set(filePath, lines);
                    return [2 /*return*/, lines];
                case 3:
                    error_1 = _a.sent();
                    console.warn("Unable to cache lines for ".concat(filePath), error_1);
                    return [2 /*return*/, null];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function alignSnippetWithFile(filePath, snippet, fallbackLine) {
    return __awaiter(this, void 0, void 0, function () {
        var fileLines;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getFileLines(filePath)];
                case 1:
                    fileLines = _a.sent();
                    if (!fileLines) {
                        return [2 /*return*/, {
                                line: Math.max(0, fallbackLine),
                                endLine: Math.max(0, fallbackLine),
                                matched: false,
                                resolvedText: snippet
                            }];
                    }
                    return [2 /*return*/, alignSnippetInLines(fileLines, snippet, fallbackLine)];
            }
        });
    });
}
function resolveReportedFile(projectPath, reportedFile) {
    return __awaiter(this, void 0, void 0, function () {
        var normalized, candidates, _i, candidates_1, candidate, _a, baseName, foundFiles, _b, foundFiles_1, file, searchError_1;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (!reportedFile) {
                        return [2 /*return*/, null];
                    }
                    normalized = reportedFile.replace(/\\/g, path.sep).replace(/^\.\/+/, '').trim();
                    candidates = [];
                    if (path.isAbsolute(normalized)) {
                        candidates.push(path.normalize(normalized));
                    }
                    else {
                        candidates.push(path.normalize(path.join(projectPath, normalized)));
                    }
                    _i = 0, candidates_1 = candidates;
                    _c.label = 1;
                case 1:
                    if (!(_i < candidates_1.length)) return [3 /*break*/, 6];
                    candidate = candidates_1[_i];
                    _c.label = 2;
                case 2:
                    _c.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, vscode.workspace.fs.stat(vscode.Uri.file(candidate))];
                case 3:
                    _c.sent();
                    return [2 /*return*/, candidate];
                case 4:
                    _a = _c.sent();
                    return [3 /*break*/, 5];
                case 5:
                    _i++;
                    return [3 /*break*/, 1];
                case 6:
                    baseName = path.basename(normalized);
                    if (!baseName) {
                        return [2 /*return*/, null];
                    }
                    _c.label = 7;
                case 7:
                    _c.trys.push([7, 9, , 10]);
                    return [4 /*yield*/, vscode.workspace.findFiles("**/".concat(baseName), '**/{node_modules,.git,dist,build,out,coverage,tmp}/**', 10)];
                case 8:
                    foundFiles = _c.sent();
                    for (_b = 0, foundFiles_1 = foundFiles; _b < foundFiles_1.length; _b++) {
                        file = foundFiles_1[_b];
                        if (normalized === baseName || file.fsPath.endsWith(normalized)) {
                            return [2 /*return*/, file.fsPath];
                        }
                    }
                    return [3 /*break*/, 10];
                case 9:
                    searchError_1 = _c.sent();
                    console.warn("File search failed for ".concat(reportedFile, ":"), searchError_1);
                    return [3 /*break*/, 10];
                case 10: return [2 /*return*/, null];
            }
        });
    });
}
/**
 * Display the nested tool call tree in console
 */
function displayToolCallTree(response) {
    console.log('\n📊 ===== TOOL CALL TREE =====\n');
    console.log('Orch Agent');
    // Display orchestrator's own tool calls
    if (response.orchestratorToolHistory && response.orchestratorToolHistory.length > 0) {
        for (var _i = 0, _a = response.orchestratorToolHistory; _i < _a.length; _i++) {
            var call = _a[_i];
            var status_1 = call.success ? '✓ success' : '✗ failed';
            console.log("  |_____ ".concat(call.tool, "(): ").concat(status_1));
        }
    }
    // Display each sub-agent and their tool calls
    if (response.agentResults && response.agentResults.length > 0) {
        for (var _b = 0, _c = response.agentResults; _b < _c.length; _b++) {
            var agent = _c[_b];
            var agentStatus = agent.success ? '✓' : '✗';
            console.log("  |");
            console.log("  |_____ ".concat(agent.agentId, " (").concat(agent.purpose, ") ").concat(agentStatus));
            if (agent.toolHistory && agent.toolHistory.length > 0) {
                for (var i = 0; i < agent.toolHistory.length; i++) {
                    var call = agent.toolHistory[i];
                    var status_2 = call.success ? '✓ success' : '✗ failed';
                    var prefix = i === agent.toolHistory.length - 1 ? '          |__________' : '          |__________';
                    console.log("".concat(prefix).concat(call.tool, "(): ").concat(status_2));
                }
            }
            else {
                console.log('          |__________(no tool calls recorded)');
            }
        }
    }
    console.log('\n===== END TOOL CALL TREE =====\n');
}
function activate(context) {
    var _this = this;
    console.log("🔌 SecureScan extension activated");
    var issuesPanelProvider = new issuesPanel_1.IssuesPanelProvider(context);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(issuesPanel_1.IssuesPanelProvider.viewType, issuesPanelProvider));
    // Helper function to perform security analysis using orchestrator
    function performOrchestratorAnalysis(projectPath, targetDescription, specificFiles) {
        return __awaiter(this, void 0, void 0, function () {
            var folderName, goal;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        folderName = projectPath.split(/[/\\]/).pop() || 'project';
                        goal = "Perform a comprehensive security vulnerability analysis on the project at: ".concat(projectPath, "\n\n");
                        if (specificFiles && specificFiles.length > 0) {
                            goal += "**FOCUS ON THESE SPECIFIC FILES:**\n";
                            specificFiles.forEach(function (f) {
                                goal += "- ".concat(f, "\n");
                            });
                            goal += "\nAnalyze ONLY these ".concat(specificFiles.length, " file(s) for security vulnerabilities.\n");
                        }
                        else {
                            goal += "Analyze the ENTIRE project for security vulnerabilities.\n";
                        }
                        goal += "\n**MANDATORY OUTPUT FORMAT for each finding:**\n\n#### [\uD83D\uDD34 CRITICAL / \uD83D\uDFE0 HIGH / \uD83D\uDFE1 MEDIUM / \uD83D\uDD35 LOW] - [Vulnerability Name]\n**File:** path/to/actual/file.js\n**Line:** 45-48\n**Vulnerable Code:**\n```javascript\n// ACTUAL code from the file\nconst dangerous = eval(userInput);\n```\n**Issue:** Specific explanation\n**Fix:**\n```javascript\n// Secure alternative\nconst safe = JSON.parse(userInput);\n```\n**Impact:** What attacker can do\n\nProvide AT LEAST 3-5 concrete findings per agent from ACTUAL code you read.\n";
                        return [4 /*yield*/, vscode.window.withProgress({
                                location: vscode.ProgressLocation.Notification,
                                title: "🔒 Security Analysis",
                                cancellable: false
                            }, function (progress) { return __awaiter(_this, void 0, void 0, function () {
                                var response, securityIssues, error_2;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            _a.trys.push([0, 3, , 4]);
                                            progress.report({ increment: 10, message: "Analyzing ".concat(targetDescription, "...") });
                                            return [4 /*yield*/, (0, api_1.orchestrateSecurityAnalysis)(goal, projectPath)];
                                        case 1:
                                            response = _a.sent();
                                            if (!response.success) {
                                                throw new Error(response.error || "Security analysis failed");
                                            }
                                            // Display the nested tool call tree
                                            displayToolCallTree(response);
                                            progress.report({ increment: 60, message: "Processing findings..." });
                                            return [4 /*yield*/, parseSecurityFindings(response, projectPath)];
                                        case 2:
                                            securityIssues = _a.sent();
                                            progress.report({ increment: 30, message: "Displaying results..." });
                                            // Update the Issues Panel with findings
                                            issuesPanelProvider.update(securityIssues);
                                            projectIssues = securityIssues;
                                            vscode.window.showInformationMessage("Security analysis complete! Found ".concat(securityIssues.length, " issue(s)."));
                                            return [3 /*break*/, 4];
                                        case 3:
                                            error_2 = _a.sent();
                                            console.error("Security analysis failed:", error_2);
                                            vscode.window.showErrorMessage("Security analysis failed: ".concat(error_2.message));
                                            return [3 /*break*/, 4];
                                        case 4: return [2 /*return*/];
                                    }
                                });
                            }); })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    }
    // Command to scan the currently active file (using orchestrator)
    var scanActiveFile = vscode.commands.registerCommand("secureScan.scanActiveFile", function () { return __awaiter(_this, void 0, void 0, function () {
        var editor, filePath, workspaceFolder, projectPath, fileName;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("🔒 Starting security analysis for active file...");
                    editor = vscode.window.activeTextEditor;
                    if (!editor) {
                        vscode.window.showErrorMessage("No active file. Please open a file first.");
                        return [2 /*return*/];
                    }
                    filePath = editor.document.uri.fsPath;
                    workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
                    if (!workspaceFolder) {
                        vscode.window.showErrorMessage("File is not part of a workspace.");
                        return [2 /*return*/];
                    }
                    projectPath = workspaceFolder.uri.fsPath;
                    fileName = filePath.split(/[/\\]/).pop() || 'file';
                    return [4 /*yield*/, performOrchestratorAnalysis(projectPath, fileName, [filePath])];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    // Command to scan the entire project (using orchestrator)
    var scanProject = vscode.commands.registerCommand("secureScan.scanProject", function () { return __awaiter(_this, void 0, void 0, function () {
        var workspaceFolder, projectPath, folderName;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    console.log("🔒 Starting security analysis for entire project...");
                    workspaceFolder = (_a = vscode.workspace.workspaceFolders) === null || _a === void 0 ? void 0 : _a[0];
                    if (!workspaceFolder) {
                        vscode.window.showErrorMessage("No workspace folder found. Please open a folder first.");
                        return [2 /*return*/];
                    }
                    projectPath = workspaceFolder.uri.fsPath;
                    folderName = projectPath.split(/[/\\]/).pop() || 'project';
                    return [4 /*yield*/, performOrchestratorAnalysis(projectPath, "entire project: ".concat(folderName))];
                case 1:
                    _b.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    // Command to scan selected files (using orchestrator)
    var scanSelectedFiles = vscode.commands.registerCommand("secureScan.scanSelectedFiles", function () { return __awaiter(_this, void 0, void 0, function () {
        var workspaceFolder, allFiles, quickPickItems, selectedItems, selectedFilePaths, projectPath;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    console.log("🔒 Starting security analysis for selected files...");
                    workspaceFolder = (_a = vscode.workspace.workspaceFolders) === null || _a === void 0 ? void 0 : _a[0];
                    if (!workspaceFolder) {
                        vscode.window.showErrorMessage("No workspace folder found. Please open a folder first.");
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, vscode.workspace.findFiles('**/*.{js,ts,py,java,go,rb,php,cs,c,cpp,h,hpp,html,css,json,yaml,yml,jsx,tsx}', '**/{node_modules,venv,target,dist,.git,vendor,build,out}/**')];
                case 1:
                    allFiles = _b.sent();
                    if (allFiles.length === 0) {
                        vscode.window.showInformationMessage("No scannable files found in the project.");
                        return [2 /*return*/];
                    }
                    quickPickItems = allFiles.map(function (file) { return ({
                        label: vscode.workspace.asRelativePath(file),
                        description: file.fsPath,
                        picked: false
                    }); });
                    return [4 /*yield*/, vscode.window.showQuickPick(quickPickItems, {
                            placeHolder: "Select files to scan (use Space to select/deselect, Enter to confirm)",
                            canPickMany: true,
                            matchOnDescription: true
                        })];
                case 2:
                    selectedItems = _b.sent();
                    if (!selectedItems || selectedItems.length === 0) {
                        vscode.window.showInformationMessage("No files selected for scanning.");
                        return [2 /*return*/];
                    }
                    selectedFilePaths = selectedItems.map(function (item) { return item.description; });
                    projectPath = workspaceFolder.uri.fsPath;
                    return [4 /*yield*/, performOrchestratorAnalysis(projectPath, "".concat(selectedFilePaths.length, " selected file(s)"), selectedFilePaths)];
                case 3:
                    _b.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    var navigateToCommand = vscode.commands.registerCommand('secureScan.navigateTo', function (filePath, line) { return __awaiter(_this, void 0, void 0, function () {
        var uri, doc, editor, fileLines, issue, targetLine, needsAlignment, alignment, position, endLine, snippetLineCount, range, backgroundColor, borderColor, decorationType_1, error_3;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 3, , 4]);
                    console.log("\n\uD83D\uDD0D ===== NAVIGATION DEBUG =====");
                    console.log("Target: ".concat(filePath, ", reported line: ").concat(line + 1));
                    uri = vscode.Uri.file(filePath);
                    return [4 /*yield*/, vscode.workspace.openTextDocument(uri)];
                case 1:
                    doc = _b.sent();
                    return [4 /*yield*/, vscode.window.showTextDocument(doc)];
                case 2:
                    editor = _b.sent();
                    fileLines = doc.getText().split('\n');
                    issue = projectIssues.find(function (i) { return i.filePath === filePath && i.line === line; });
                    if (!issue) {
                        console.log("\u26A0\uFE0F No exact match, searching nearby lines...");
                        issue = projectIssues.find(function (i) { return i.filePath === filePath && Math.abs(i.line - line) <= 10; });
                    }
                    targetLine = Math.max(0, Math.min(issue ? issue.line : line, doc.lineCount - 1));
                    if (issue && issue.code_snippet) {
                        console.log("\n\uD83D\uDCDD Issue found with code snippet (".concat(issue.code_snippet.length, " chars)"));
                        needsAlignment = issue.calculatedEndLine === undefined || issue.calculatedEndLine < issue.line;
                        alignment = needsAlignment
                            ? alignSnippetInLines(fileLines, issue.code_snippet, targetLine)
                            : { line: issue.line, endLine: (_a = issue.calculatedEndLine) !== null && _a !== void 0 ? _a : issue.line, matched: true };
                        if (alignment.matched) {
                            targetLine = alignment.line;
                            issue.line = alignment.line;
                            issue.calculatedEndLine = alignment.endLine;
                            console.log("\uD83C\uDFAF Aligned snippet to lines ".concat(alignment.line + 1, "-").concat(alignment.endLine + 1));
                        }
                        else {
                            console.log("\u26A0\uFE0F Could not align snippet, falling back to stored line ".concat(targetLine + 1));
                        }
                    }
                    else if (!issue) {
                        console.log("\n\u26A0\uFE0F No corresponding issue entry, using reported line");
                    }
                    position = new vscode.Position(targetLine, 0);
                    console.log("\n\uD83D\uDCCD Navigating to line ".concat(targetLine + 1));
                    console.log("Actual file line: \"".concat(doc.lineAt(targetLine).text.substring(0, 80), "\""));
                    if (issue) {
                        endLine = void 0;
                        if (issue.calculatedEndLine !== undefined && issue.calculatedEndLine >= targetLine) {
                            endLine = Math.min(issue.calculatedEndLine, doc.lineCount - 1);
                            console.log("Using cached end line: ".concat(endLine + 1));
                        }
                        else if (issue.code_snippet) {
                            snippetLineCount = issue.code_snippet
                                .replace(/```\w*\n?/g, '')
                                .split('\n')
                                .filter(function (l) { return l.trim().length > 0; })
                                .length;
                            endLine = Math.min(targetLine + Math.max(0, snippetLineCount - 1), doc.lineCount - 1);
                            console.log("Estimating end line via snippet length: ".concat(endLine + 1));
                        }
                        else {
                            endLine = targetLine;
                        }
                        range = new vscode.Range(new vscode.Position(targetLine, 0), new vscode.Position(endLine, doc.lineAt(endLine).text.length));
                        console.log("Highlighting lines ".concat(targetLine + 1, " to ").concat(endLine + 1, " (").concat(endLine - targetLine + 1, " lines)"));
                        backgroundColor = void 0;
                        borderColor = void 0;
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
                        decorationType_1 = vscode.window.createTextEditorDecorationType({
                            backgroundColor: backgroundColor,
                            isWholeLine: false,
                            borderWidth: '1px 0 1px 3px',
                            borderStyle: 'solid',
                            borderColor: borderColor,
                            overviewRulerColor: borderColor,
                            overviewRulerLane: vscode.OverviewRulerLane.Right
                        });
                        editor.setDecorations(decorationType_1, [range]);
                        console.log("\u2705 Applied ".concat(issue.severity, " decoration"));
                        setTimeout(function () {
                            decorationType_1.dispose();
                        }, 5000);
                    }
                    editor.selection = new vscode.Selection(position, position);
                    editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
                    console.log("===== END NAVIGATION DEBUG =====\n");
                    return [3 /*break*/, 4];
                case 3:
                    error_3 = _b.sent();
                    console.error("Failed to navigate:", error_3);
                    vscode.window.showErrorMessage("Could not open the specified file.");
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); });
    var activeEditorListener = vscode.window.onDidChangeActiveTextEditor(function (editor) {
        if (editor) {
            var filePath_1 = editor.document.uri.fsPath;
            var issuesForFile = projectIssues.filter(function (issue) { return issue.filePath === filePath_1 && issue.isActive; });
            if (issuesForFile.length > 0) {
                (0, highlighter_1.highlightEntries)(editor, issuesForFile);
            }
            else {
                (0, highlighter_1.clearHighlights)(editor);
            }
        }
    });
    context.subscriptions.push(scanActiveFile, scanProject, scanSelectedFiles, navigateToCommand, activeEditorListener);
}
/**
 * Parse security findings from agent results into Issue format
 */
function parseSecurityFindings(response, projectPath) {
    return __awaiter(this, void 0, void 0, function () {
        var issues, _i, _a, agentResult, message, emojiBlocks, _b, emojiBlocks_1, block, severity, hasFileMarker, titleMatch, fileMatch, lineMatch, vulnMatch, issueMatch, fixMatch_1, impactMatch_1, problemMatch_1, issueText, fileName_1, lineStr, lineNumMatch, lineNum, filePath_2, vulnerableCode, snippetAlignment_1, fileLineMatch, fileName, lineNumber, parsedLine, line, filePath, problemMatch, problem, vulnCodeMatch, rawSnippet, displaySnippet, fixMatch, fix, impactMatch, impact, snippetAlignment, err_1, _c, _d, agentResult;
        var _e, _f, _g, _h, _j;
        return __generator(this, function (_k) {
            switch (_k.label) {
                case 0:
                    issues = [];
                    snippetFileLineCache.clear();
                    console.log('🔍 Parsing security findings...');
                    console.log('Project Path:', projectPath);
                    console.log('Agent Results count:', ((_e = response.agentResults) === null || _e === void 0 ? void 0 : _e.length) || 0);
                    if (!response.agentResults || response.agentResults.length === 0) {
                        console.log('⚠️ No agent results to parse');
                        return [2 /*return*/, issues];
                    }
                    _i = 0, _a = response.agentResults;
                    _k.label = 1;
                case 1:
                    if (!(_i < _a.length)) return [3 /*break*/, 13];
                    agentResult = _a[_i];
                    console.log("\n\uD83D\uDCCB Processing agent: ".concat(agentResult.agentId));
                    console.log("Success: ".concat(agentResult.success));
                    if (!agentResult.success || !((_f = agentResult.result) === null || _f === void 0 ? void 0 : _f.message)) {
                        console.log('⏭️ Skipping agent (no successful result)');
                        return [3 /*break*/, 12];
                    }
                    message = agentResult.result.message;
                    console.log("\uD83D\uDCDD Message length: ".concat(message.length));
                    emojiBlocks = message.split(/(?=🔴|🟠|🟡|🔵)/);
                    _b = 0, emojiBlocks_1 = emojiBlocks;
                    _k.label = 2;
                case 2:
                    if (!(_b < emojiBlocks_1.length)) return [3 /*break*/, 12];
                    block = emojiBlocks_1[_b];
                    if (block.trim().length < 20)
                        return [3 /*break*/, 11];
                    console.log('\n--- Processing emoji block ---');
                    console.log(block.substring(0, 300));
                    _k.label = 3;
                case 3:
                    _k.trys.push([3, 10, , 11]);
                    severity = 'Medium';
                    if (block.includes('🔴') || block.includes('CRITICAL')) {
                        severity = 'Critical';
                    }
                    else if (block.includes('🟠') || block.includes('HIGH')) {
                        severity = 'High';
                    }
                    else if (block.includes('🟡') || block.includes('MEDIUM')) {
                        severity = 'Medium';
                    }
                    else if (block.includes('🔵') || block.includes('LOW')) {
                        severity = 'Low';
                    }
                    hasFileMarker = block.includes('**File:**');
                    if (!hasFileMarker) return [3 /*break*/, 6];
                    // Format 2: #### 🔴 CRITICAL - Title\n**File:**...**Line:**...
                    console.log('Using Format 2 (File marker)');
                    titleMatch = block.match(/####?\s*(?:🔴|🟠|🟡|🔵)?\s*(?:CRITICAL|HIGH|MEDIUM|LOW)?\s*-\s*([^\n]+)/);
                    fileMatch = block.match(/\*\*File:\*\*\s*`?([^`\n]+)`?/);
                    lineMatch = block.match(/\*\*Line:\*\*\s*`?([^`\n]+)`?/);
                    vulnMatch = block.match(/\*\*Vulnerable Code:\*\*\s*```\w*\n([\s\S]*?)```/);
                    if (!vulnMatch) {
                        // Try without code blocks - match until next ** marker or end
                        vulnMatch = block.match(/\*\*Vulnerable Code:\*\*\s*\n([\s\S]*?)(?=\n\*\*|$)/);
                    }
                    issueMatch = block.match(/\*\*Issue:\*\*\s*([^\n]+(?:\n(?!\*\*)[^\n]+)*)/);
                    fixMatch_1 = block.match(/\*\*Fix:\*\*\s*```\w*\n([\s\S]*?)```/);
                    if (!fixMatch_1) {
                        fixMatch_1 = block.match(/\*\*Fix:\*\*\s*\n([\s\S]*?)(?=\n\*\*|---|\n\n\n|$)/);
                    }
                    impactMatch_1 = block.match(/\*\*Impact:\*\*\s*([^\n]+(?:\n(?!\*\*|---|####)[^\n]+)*)/);
                    problemMatch_1 = block.match(/\*\*Problem:\*\*\s*([^\n]+(?:\n(?!\*\*)[^\n]+)*)/);
                    issueText = issueMatch ? issueMatch[1].trim() : (problemMatch_1 ? problemMatch_1[1].trim() : '');
                    if (!fileMatch) {
                        console.log('⚠️ No file marker found in Format 2 block');
                        return [3 /*break*/, 11];
                    }
                    fileName_1 = fileMatch[1].trim();
                    lineStr = lineMatch ? lineMatch[1].trim() : '';
                    lineNumMatch = lineStr.match(/\d+/);
                    if (!lineNumMatch) {
                        console.log("\u26A0\uFE0F No valid line number found (lineStr: \"".concat(lineStr, "\"), skipping issue"));
                        return [3 /*break*/, 11];
                    }
                    lineNum = Math.max(0, parseInt(lineNumMatch[0]) - 1);
                    console.log("\uD83D\uDCC4 Format 2 - File: ".concat(fileName_1, ", Line string: \"").concat(lineStr, "\", Parsed line: ").concat(lineNum + 1));
                    return [4 /*yield*/, resolveReportedFile(projectPath, fileName_1)];
                case 4:
                    filePath_2 = _k.sent();
                    if (!filePath_2) {
                        console.log("\u26A0\uFE0F Skipping issue; file not found in workspace: ".concat(fileName_1));
                        return [3 /*break*/, 11];
                    }
                    vulnerableCode = vulnMatch ? vulnMatch[1].trim().replace(/```\w*\n?/g, '').trim() : '';
                    if (!vulnerableCode || vulnerableCode.length < 10) {
                        console.log("\u26A0\uFE0F No valid vulnerable code found (length: ".concat(vulnerableCode.length, "), skipping issue"));
                        return [3 /*break*/, 11];
                    }
                    console.log("Vulnerable code (first 100 chars): ".concat(vulnerableCode.substring(0, 100)));
                    return [4 /*yield*/, alignSnippetWithFile(filePath_2, vulnerableCode, lineNum)];
                case 5:
                    snippetAlignment_1 = _k.sent();
                    if (snippetAlignment_1.matched) {
                        console.log("\uD83D\uDD01 Refined snippet to lines ".concat(snippetAlignment_1.line + 1, "-").concat(snippetAlignment_1.endLine + 1));
                    }
                    else {
                        console.log("\u26A0\uFE0F Unable to refine snippet, using provided line ".concat(lineNum + 1));
                    }
                    issues.push({
                        filePath: filePath_2,
                        line: snippetAlignment_1.line,
                        code_snippet: (snippetAlignment_1.resolvedText || vulnerableCode).trimEnd(),
                        severity: severity,
                        vulnerability_explanation: "".concat(((_g = titleMatch === null || titleMatch === void 0 ? void 0 : titleMatch[1]) === null || _g === void 0 ? void 0 : _g.trim()) || 'Security Issue', "\n\n").concat(issueText, "\n\nImpact: ").concat(((_h = impactMatch_1 === null || impactMatch_1 === void 0 ? void 0 : impactMatch_1[1]) === null || _h === void 0 ? void 0 : _h.trim()) || 'Security risk'),
                        recommended_fix: fixMatch_1 ? fixMatch_1[1].trim().replace(/```\w*\n?/g, '').trim() : 'Review and apply security best practices',
                        cve_ids: [],
                        cwe_ids: [],
                        calculatedEndLine: snippetAlignment_1.endLine,
                        isActive: false
                    });
                    console.log("\u2705 Added Format 2 issue");
                    return [3 /*break*/, 11];
                case 6:
                    fileLineMatch = block.match(/([^\s:]+\.[a-zA-Z0-9]+):(\d+)/);
                    if (!fileLineMatch) {
                        console.log('⚠️ No file:line pattern found in Format 1 block');
                        return [3 /*break*/, 11];
                    }
                    fileName = fileLineMatch[1], lineNumber = fileLineMatch[2];
                    console.log("\uD83D\uDCC4 Format 1 - File: ".concat(fileName, ", Line: ").concat(lineNumber));
                    parsedLine = parseInt(lineNumber);
                    line = parsedLine > 0 ? parsedLine - 1 : 0;
                    return [4 /*yield*/, resolveReportedFile(projectPath, fileName)];
                case 7:
                    filePath = _k.sent();
                    if (!filePath) {
                        console.log("\u26A0\uFE0F Skipping issue; file not found in workspace: ".concat(fileName));
                        return [3 /*break*/, 11];
                    }
                    problemMatch = block.match(/Problem:\s*([^\n]+(?:\n(?!Vulnerable Code:|Fix:|Impact:)[^\n]+)*)/i);
                    problem = problemMatch ? problemMatch[1].trim() : 'Security Issue';
                    vulnCodeMatch = block.match(/Vulnerable Code:\s*([\s\S]*?)(?=\n(?:Fix:|Impact:)|$)/i);
                    rawSnippet = vulnCodeMatch ? vulnCodeMatch[1].trim() : '';
                    displaySnippet = rawSnippet
                        ? rawSnippet.replace(/```\w*\n?/g, '').replace(/```/g, '').trim()
                        : 'See details';
                    fixMatch = block.match(/Fix:\s*([\s\S]*?)(?=\n(?:Impact:|$)|---)/i);
                    fix = fixMatch ? fixMatch[1].trim() : 'Review the code';
                    impactMatch = block.match(/Impact:\s*([^\n]+(?:\n(?!---)[^\n]+)*)/i);
                    impact = impactMatch ? impactMatch[1].trim() : 'Security vulnerability';
                    snippetAlignment = {
                        line: line,
                        endLine: line,
                        matched: false
                    };
                    if (!(displaySnippet && displaySnippet.length >= 5 && displaySnippet !== 'See details')) return [3 /*break*/, 9];
                    return [4 /*yield*/, alignSnippetWithFile(filePath, displaySnippet, line)];
                case 8:
                    snippetAlignment = _k.sent();
                    if (snippetAlignment.matched) {
                        console.log("\uD83D\uDD01 Refined Format 1 snippet to lines ".concat(snippetAlignment.line + 1, "-").concat(snippetAlignment.endLine + 1));
                    }
                    else {
                        console.log("\u26A0\uFE0F Could not align Format 1 snippet, using reported line ".concat(line + 1));
                    }
                    _k.label = 9;
                case 9:
                    console.log("\u2705 Adding issue: ".concat(problem, " in ").concat(filePath, " at line ").concat(snippetAlignment.line + 1));
                    issues.push({
                        filePath: filePath,
                        line: snippetAlignment.line,
                        code_snippet: (snippetAlignment.resolvedText || displaySnippet).trimEnd(),
                        severity: severity,
                        vulnerability_explanation: "".concat(problem, "\n\n").concat(impact),
                        recommended_fix: fix.replace(/```\w*\n?/g, '').trim(),
                        cve_ids: [],
                        cwe_ids: [],
                        calculatedEndLine: snippetAlignment.endLine,
                        isActive: false
                    });
                    return [3 /*break*/, 11];
                case 10:
                    err_1 = _k.sent();
                    console.error('Error parsing block:', err_1);
                    return [3 /*break*/, 11];
                case 11:
                    _b++;
                    return [3 /*break*/, 2];
                case 12:
                    _i++;
                    return [3 /*break*/, 1];
                case 13:
                    console.log("\n\u2705 Total issues parsed: ".concat(issues.length));
                    // If no issues found but we have agent results, show the raw messages
                    if (issues.length === 0 && response.agentResults && response.agentResults.length > 0) {
                        console.log('\n⚠️ No issues parsed, but agent results exist. Showing raw agent messages:');
                        for (_c = 0, _d = response.agentResults; _c < _d.length; _c++) {
                            agentResult = _d[_c];
                            if (agentResult.success && ((_j = agentResult.result) === null || _j === void 0 ? void 0 : _j.message)) {
                                console.log("\n=== ".concat(agentResult.agentId, " ==="));
                                console.log(agentResult.result.message);
                                console.log('=== END ===\n');
                            }
                        }
                    }
                    return [2 /*return*/, issues];
            }
        });
    });
}
/**
 * Generate HTML for security analysis results display
 */
function generateSecurityAnalysisHTML(response) {
    var result = response.result, spawnedAgents = response.spawnedAgents, agentResults = response.agentResults, conversationTurns = response.conversationTurns;
    var html = "\n<!DOCTYPE html>\n<html>\n<head>\n  <style>\n    body {\n      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;\n      padding: 20px;\n      line-height: 1.6;\n      color: var(--vscode-foreground);\n      background-color: var(--vscode-editor-background);\n    }\n    h1, h2, h3 { color: var(--vscode-editor-foreground); }\n    h1 { border-bottom: 2px solid var(--vscode-textLink-foreground); padding-bottom: 10px; }\n    h2 { margin-top: 30px; border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 5px; }\n    .stats {\n      display: flex;\n      gap: 20px;\n      margin: 20px 0;\n      flex-wrap: wrap;\n    }\n    .stat-card {\n      background: var(--vscode-editor-inactiveSelectionBackground);\n      padding: 15px;\n      border-radius: 5px;\n      border-left: 3px solid var(--vscode-textLink-foreground);\n    }\n    .stat-value { font-size: 24px; font-weight: bold; }\n    .stat-label { font-size: 12px; opacity: 0.8; }\n    .agent-section {\n      background: var(--vscode-editor-inactiveSelectionBackground);\n      padding: 20px;\n      margin: 20px 0;\n      border-radius: 5px;\n      border-left: 4px solid var(--vscode-textLink-activeForeground);\n    }\n    .agent-header {\n      display: flex;\n      justify-content: space-between;\n      align-items: center;\n      margin-bottom: 15px;\n    }\n    .agent-badge {\n      background: var(--vscode-badge-background);\n      color: var(--vscode-badge-foreground);\n      padding: 3px 8px;\n      border-radius: 3px;\n      font-size: 11px;\n      font-weight: bold;\n    }\n    .severity-critical { color: #f14c4c; font-weight: bold; }\n    .severity-high { color: #ff8800; font-weight: bold; }\n    .severity-medium { color: #e3b341; font-weight: bold; }\n    .severity-low { color: #4ec9b0; font-weight: bold; }\n    .findings {\n      white-space: pre-wrap;\n      background: var(--vscode-textCodeBlock-background);\n      padding: 15px;\n      border-radius: 3px;\n      overflow-x: auto;\n      margin-top: 10px;\n    }\n    .summary {\n      background: var(--vscode-textBlockQuote-background);\n      border-left: 4px solid var(--vscode-textBlockQuote-border);\n      padding: 15px;\n      margin: 20px 0;\n    }\n    code {\n      background: var(--vscode-textCodeBlock-background);\n      padding: 2px 6px;\n      border-radius: 3px;\n    }\n    .success { color: #4ec9b0; }\n    .error { color: #f14c4c; }\n  </style>\n</head>\n<body>\n  <h1>\uD83D\uDD12 Comprehensive Security Analysis Results</h1>\n  \n  <div class=\"stats\">\n    <div class=\"stat-card\">\n      <div class=\"stat-value\">".concat((agentResults === null || agentResults === void 0 ? void 0 : agentResults.length) || 0, "</div>\n      <div class=\"stat-label\">Security Agents</div>\n    </div>\n    <div class=\"stat-card\">\n      <div class=\"stat-value\">").concat((agentResults === null || agentResults === void 0 ? void 0 : agentResults.filter(function (a) { return a.success; }).length) || 0, "</div>\n      <div class=\"stat-label\">Successful Analyses</div>\n    </div>\n    <div class=\"stat-card\">\n      <div class=\"stat-value\">").concat(conversationTurns || 0, "</div>\n      <div class=\"stat-label\">Conversation Turns</div>\n    </div>\n  </div>\n\n  <h2>\uD83E\uDD16 Deployed Security Agents</h2>\n  <ul>\n  ").concat((spawnedAgents === null || spawnedAgents === void 0 ? void 0 : spawnedAgents.map(function (agent) { return "\n    <li><strong>".concat(agent.agentId, "</strong>: ").concat(agent.purpose, "</li>\n  "); }).join('')) || '<li>No agents spawned</li>', "\n  </ul>\n\n  <h2>\uD83D\uDD0D Detailed Agent Findings</h2>\n  ");
    if (agentResults && agentResults.length > 0) {
        agentResults.forEach(function (agentResult) {
            var _a;
            var statusClass = agentResult.success ? 'success' : 'error';
            var statusIcon = agentResult.success ? '✅' : '❌';
            html += "\n      <div class=\"agent-section\">\n        <div class=\"agent-header\">\n          <h3>".concat(statusIcon, " ").concat(agentResult.agentId.toUpperCase(), "</h3>\n          <span class=\"agent-badge ").concat(statusClass, "\">").concat(agentResult.success ? 'COMPLETED' : 'FAILED', "</span>\n        </div>\n        <p><strong>Purpose:</strong> ").concat(agentResult.purpose, "</p>\n        ").concat(agentResult.executionTime ? "<p><strong>Execution Time:</strong> ".concat(agentResult.executionTime, "ms</p>") : '', "\n        ").concat(agentResult.toolCallCount ? "<p><strong>Tool Calls:</strong> ".concat(agentResult.toolCallCount, "</p>") : '', "\n        ");
            if (agentResult.success && ((_a = agentResult.result) === null || _a === void 0 ? void 0 : _a.message)) {
                var message = agentResult.result.message
                    .replace(/CRITICAL/g, '<span class="severity-critical">CRITICAL</span>')
                    .replace(/HIGH/g, '<span class="severity-high">HIGH</span>')
                    .replace(/MEDIUM/g, '<span class="severity-medium">MEDIUM</span>')
                    .replace(/LOW/g, '<span class="severity-low">LOW</span>');
                html += "<div class=\"findings\">".concat(message, "</div>");
            }
            else if (agentResult.error) {
                html += "<p class=\"error\"><strong>Error:</strong> ".concat(agentResult.error, "</p>");
            }
            html += "</div>";
        });
    }
    else {
        html += "<p>No agent results available.</p>";
    }
    html += "\n  <h2>\uD83D\uDCCA Orchestrator Summary</h2>\n  <div class=\"summary\">\n    ".concat((result === null || result === void 0 ? void 0 : result.message) ? result.message.replace(/\n/g, '<br>') : 'No summary available.', "\n  </div>\n\n  <hr>\n  <p style=\"opacity: 0.7; font-size: 12px;\">Generated by AI Grand Challenge Security Analysis</p>\n</body>\n</html>\n  ");
    return html;
}
function deactivate() {
    console.log("🔌 SecureScan extension deactivated");
}
