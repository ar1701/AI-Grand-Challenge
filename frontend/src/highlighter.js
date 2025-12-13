"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearHighlights = clearHighlights;
exports.highlightEntries = highlightEntries;
var vscode = require("vscode");
var highlightStyles = {
    Critical: vscode.window.createTextEditorDecorationType({ backgroundColor: "rgba(255,0,0,0.3)" }),
    High: vscode.window.createTextEditorDecorationType({ backgroundColor: "rgba(255,165,0,0.3)" }),
    Medium: vscode.window.createTextEditorDecorationType({ backgroundColor: "rgba(255,255,0,0.3)" }),
    Low: vscode.window.createTextEditorDecorationType({ backgroundColor: "rgba(0,0,255,0.2)" })
};
function clearHighlights(editor) {
    Object.keys(highlightStyles).forEach(function (sev) {
        editor.setDecorations(highlightStyles[sev], []);
    });
}
function clampLine(line, maxLine) {
    if (!Number.isFinite(line)) {
        return 0;
    }
    if (line < 0) {
        return 0;
    }
    if (line > maxLine) {
        return maxLine;
    }
    return line;
}
function highlightEntries(editor, entries) {
    var _a;
    clearHighlights(editor);
    var activeEntries = entries.filter(function (entry) { return entry.isActive; });
    if (activeEntries.length === 0) {
        return [];
    }
    var issuesWithLines = [];
    var maxLineIndex = Math.max(editor.document.lineCount - 1, 0);
    var decorations = {
        Critical: [],
        High: [],
        Medium: [],
        Low: []
    };
    for (var _i = 0, activeEntries_1 = activeEntries; _i < activeEntries_1.length; _i++) {
        var entry = activeEntries_1[_i];
        var startLine = clampLine((_a = entry.line) !== null && _a !== void 0 ? _a : 0, maxLineIndex);
        var snippetLineEstimate = entry.calculatedEndLine !== undefined
            ? Math.max(entry.calculatedEndLine - startLine + 1, 1)
            : Math.max(entry.code_snippet
                ? entry.code_snippet
                    .replace(/```\w*\n?/g, '')
                    .split('\n')
                    .filter(function (line) { return line.trim().length > 0; }).length
                : 1, 1);
        var endLine = clampLine(entry.calculatedEndLine !== undefined
            ? entry.calculatedEndLine
            : startLine + snippetLineEstimate - 1, maxLineIndex);
        var range = new vscode.Range(new vscode.Position(startLine, 0), new vscode.Position(endLine, editor.document.lineAt(endLine).text.length));
        var resolvedSnippet = editor.document.getText(range).trimEnd();
        entry.line = startLine;
        entry.calculatedEndLine = endLine;
        if (resolvedSnippet.length > 0) {
            entry.code_snippet = resolvedSnippet;
        }
        var hoverMessage = new vscode.MarkdownString();
        hoverMessage.appendMarkdown("**".concat(entry.severity, " Vulnerability**\n\n"));
        hoverMessage.appendMarkdown("".concat(entry.vulnerability_explanation, "\n\n"));
        if (entry.recommended_fix) {
            hoverMessage.appendCodeblock(entry.recommended_fix, 'diff');
        }
        decorations[entry.severity].push({ range: range, hoverMessage: hoverMessage });
        issuesWithLines.push(__assign({}, entry));
    }
    Object.keys(decorations).forEach(function (sev) {
        editor.setDecorations(highlightStyles[sev], decorations[sev]);
    });
    return issuesWithLines;
}
