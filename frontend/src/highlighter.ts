import * as vscode from "vscode";
import { AnalyzerEntry, Issue, Severity } from "./types";

const highlightStyles: Record<Severity, vscode.TextEditorDecorationType> = {
  Critical: vscode.window.createTextEditorDecorationType({ backgroundColor: "rgba(255,0,0,0.3)" }),
  High: vscode.window.createTextEditorDecorationType({ backgroundColor: "rgba(255,165,0,0.3)" }),
  Medium: vscode.window.createTextEditorDecorationType({ backgroundColor: "rgba(255,255,0,0.3)" }),
  Low: vscode.window.createTextEditorDecorationType({ backgroundColor: "rgba(0,0,255,0.2)" })
};

// Clear previous decorations
export function clearHighlights(editor: vscode.TextEditor) {
  (Object.keys(highlightStyles) as Severity[]).forEach(sev => {
    editor.setDecorations(highlightStyles[sev], []);
  });
}

// MODIFIED: This function now returns the entries with line numbers
export function highlightEntries(editor: vscode.TextEditor, entries: AnalyzerEntry[]): Issue[] {
  clearHighlights(editor);
  const text = editor.document.getText();
  const issuesWithLines: Issue[] = [];

  const decorations: Record<Severity, vscode.DecorationOptions[]> = {
    Critical: [],
    High: [],
    Medium: [],
    Low: []
  };

  for (const entry of entries) {
    if (!entry.code_snippet || typeof entry.code_snippet !== "string") {
      continue;
    }

    try {
      const snippet = entry.code_snippet.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(snippet, "g");
      let match;
      
      while ((match = regex.exec(text)) !== null) {
        const start = editor.document.positionAt(match.index);
        const end = editor.document.positionAt(match.index + match[0].length);
        const range = new vscode.Range(start, end);
        const hoverMessage = new vscode.MarkdownString();
        hoverMessage.appendMarkdown(`**${entry.severity} Vulnerability**\n\n`);
        hoverMessage.appendMarkdown(`${entry.vulnerability_explanation}\n\n`);
        hoverMessage.appendCodeblock(entry.recommended_fix, 'diff');

        decorations[entry.severity].push({ range, hoverMessage });

        // Add the entry with its line number to our results
        issuesWithLines.push({
          ...entry,
          filePath: editor.document.uri.fsPath,
          line: start.line, // Get the starting line number
        });
      }
    } catch (err) {
      console.error("❌ Failed to build regex for entry:", entry, err);
    }
  }

  (Object.keys(decorations) as Severity[]).forEach(sev => {
    editor.setDecorations(highlightStyles[sev], decorations[sev]);
  });
  
  return issuesWithLines;
}