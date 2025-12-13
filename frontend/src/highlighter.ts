import * as vscode from "vscode";
import { Issue, Severity } from "./types";

const highlightStyles: Record<Severity, vscode.TextEditorDecorationType> = {
  Critical: vscode.window.createTextEditorDecorationType({ backgroundColor: "rgba(255,0,0,0.3)" }),
  High: vscode.window.createTextEditorDecorationType({ backgroundColor: "rgba(255,165,0,0.3)" }),
  Medium: vscode.window.createTextEditorDecorationType({ backgroundColor: "rgba(255,255,0,0.3)" }),
  Low: vscode.window.createTextEditorDecorationType({ backgroundColor: "rgba(0,0,255,0.2)" })
};

export function clearHighlights(editor: vscode.TextEditor) {
  (Object.keys(highlightStyles) as Severity[]).forEach(sev => {
    editor.setDecorations(highlightStyles[sev], []);
  });
}


function clampLine(line: number, maxLine: number): number {
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

export function highlightEntries(editor: vscode.TextEditor, entries: Issue[]): Issue[] {
  clearHighlights(editor);
  const issuesWithLines: Issue[] = [];
  const maxLineIndex = Math.max(editor.document.lineCount - 1, 0);

  const decorations: Record<Severity, vscode.DecorationOptions[]> = {
    Critical: [],
    High: [],
    Medium: [],
    Low: []
  };

  for (const entry of entries) {
    const startLine = clampLine(entry.line ?? 0, maxLineIndex);
    const snippetLineEstimate = entry.calculatedEndLine !== undefined
      ? Math.max(entry.calculatedEndLine - startLine + 1, 1)
      : Math.max(
          entry.code_snippet
            ? entry.code_snippet
                .replace(/```\w*\n?/g, '')
                .split('\n')
                .filter(line => line.trim().length > 0).length
            : 1,
          1
        );
    const endLine = clampLine(
      entry.calculatedEndLine !== undefined
        ? entry.calculatedEndLine
        : startLine + snippetLineEstimate - 1,
      maxLineIndex
    );

    const range = new vscode.Range(
      new vscode.Position(startLine, 0),
      new vscode.Position(endLine, editor.document.lineAt(endLine).text.length)
    );

    const resolvedSnippet = editor.document.getText(range).trimEnd();
    entry.line = startLine;
    entry.calculatedEndLine = endLine;
    if (resolvedSnippet.length > 0) {
      entry.code_snippet = resolvedSnippet;
    }

    const hoverMessage = new vscode.MarkdownString();
    hoverMessage.appendMarkdown(`**${entry.severity} Vulnerability**\n\n`);
    hoverMessage.appendMarkdown(`${entry.vulnerability_explanation}\n\n`);
    if (entry.recommended_fix) {
      hoverMessage.appendCodeblock(entry.recommended_fix, 'diff');
    }

    decorations[entry.severity].push({ range, hoverMessage });
    issuesWithLines.push({ ...entry });
  }

  (Object.keys(decorations) as Severity[]).forEach(sev => {
    editor.setDecorations(highlightStyles[sev], decorations[sev]);
  });
  
  return issuesWithLines;
}