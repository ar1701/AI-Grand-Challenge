import * as vscode from "vscode";
import { scanSingleFileWithBackend, scanProjectWithBackend } from "./api";
import { highlightEntries, clearHighlights } from "./highlighter";
import { IssuesPanelProvider } from "./issuesPanel";
import { Issue } from "./types";

let projectIssues: Issue[] = [];

export function activate(context: vscode.ExtensionContext) {
  console.log("🔌 SecureScan extension activated");

  const issuesPanelProvider = new IssuesPanelProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      IssuesPanelProvider.viewType,
      issuesPanelProvider
    )
  );

  // Command to scan the currently active file
  const scanActiveFile = vscode.commands.registerCommand("secureScan.scanActiveFile", async () => {
    // ... (This command remains unchanged, but we now store its results)
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const document = editor.document;
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: `Scanning ${document.fileName.split(/[/\\]/).pop()}`,
      cancellable: false
    }, async (progress) => {
      try {
        const response = await scanSingleFileWithBackend(document.fileName, document.getText());
        if (!response || !Array.isArray(response.entries)) {
          throw new Error("Invalid response from backend");
        }
        
       
        const issuesWithLines = highlightEntries(editor, response.entries);
        projectIssues = issuesWithLines; 

        if (issuesWithLines.length > 0) {
          issuesPanelProvider.update(issuesWithLines);
          vscode.window.showInformationMessage(`Scan complete: ${issuesWithLines.length} issue(s) found.`);
        } else {
          clearHighlights(editor);
          issuesPanelProvider.update([]);
          vscode.window.showInformationMessage("Scan complete: No issues found.");
        }
      } catch (error: any) {
        console.error("💥 Scan failed:", error);
        vscode.window.showErrorMessage(`Scan failed: ${error.message}`);
      }
    });
  });

  // Command to scan the entire project
  const scanProject = vscode.commands.registerCommand("secureScan.scanProject", async () => {
    console.log("🚀 Starting project scan...");
    vscode.window.showInformationMessage("Starting project scan...");
    
     await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: "Scanning Project",
      cancellable: false
    }, async (progress) => {
      try {
        progress.report({ increment: 10, message: "Discovering files..." });
        console.log("📂 Discovering files...");
        
        // Check if we have a workspace
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
          vscode.window.showErrorMessage("No workspace folder found. Please open a folder first.");
          return;
        }
        console.log(`📁 Workspace folder: ${workspaceFolder.uri.fsPath}`);
        
        const files = await vscode.workspace.findFiles(
          '**/*.{js,ts,py,java,go,rb,php,cs,c,cpp,h,hpp,html,css,json,yaml,yml,jsx}',
          '**/{node_modules,venv,target,dist,.git,vendor,build,out}/**'
        );
        console.log(`📁 Found ${files.length} files`);
        vscode.window.showInformationMessage(`Found ${files.length} files to scan`);
        
        if (files.length === 0) {
          vscode.window.showInformationMessage("No scannable files found in the project.");
          return;
        }

        const filePaths = files.map(file => file.fsPath);
        console.log(`📄 File paths:`, filePaths.slice(0, 5), files.length > 5 ? `... and ${files.length - 5} more` : '');
        progress.report({ increment: 20, message: `Found ${filePaths.length} files. Analyzing...` });
        console.log("🔍 Calling backend API...");
        const response = await scanProjectWithBackend(filePaths);
        console.log("✅ Backend response received:", response);
        if (!response.success || !response.batches) {
            throw new Error(response.error || "Failed to get a valid response from the backend.");
        }

        progress.report({ increment: 70, message: "Processing analysis results..." });
        const allIssues: Issue[] = [];
        for (const batch of response.batches) {
          let analysisData = batch.analysis;
          if (typeof analysisData === 'string') {
            analysisData = JSON.parse(analysisData);
          }
          if (analysisData && analysisData.files) {
            for (const fileAnalysis of analysisData.files) {
              const doc = await vscode.workspace.openTextDocument(fileAnalysis.file_path);
              const editor = await vscode.window.showTextDocument(doc, { preview: true, preserveFocus: true });
              const issuesWithLines = highlightEntries(editor, fileAnalysis.vulnerabilities);
              allIssues.push(...issuesWithLines);
            }
          }
        }
        
        projectIssues = allIssues; 
        issuesPanelProvider.update(projectIssues);
        vscode.window.showInformationMessage(`Project scan complete: ${projectIssues.length} issue(s) found.`);
      } catch (error: any) {
        console.error("Project scan failed:", error);
        vscode.window.showErrorMessage(`Project scan failed: ${error.message}`);
      }
    });
  });

  const navigateToCommand = vscode.commands.registerCommand('secureScan.navigateTo', async (filePath: string, line: number) => {
    try {
      const uri = vscode.Uri.file(filePath);
      const doc = await vscode.workspace.openTextDocument(uri);
      const editor = await vscode.window.showTextDocument(doc);
      
      const position = new vscode.Position(line, 0);
      editor.selection = new vscode.Selection(position, position);
      editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
    } catch (error) {
      console.error("Failed to navigate:", error);
      vscode.window.showErrorMessage("Could not open the specified file.");
    }
  });

  
  const activeEditorListener = vscode.window.onDidChangeActiveTextEditor(editor => {
    if (editor) {
      const filePath = editor.document.uri.fsPath;
      const issuesForFile = projectIssues.filter(issue => issue.filePath === filePath);
      if (issuesForFile.length > 0) {
        highlightEntries(editor, issuesForFile);
      } else {
        clearHighlights(editor);
      }
    }
  });

  context.subscriptions.push(scanActiveFile, scanProject, navigateToCommand, activeEditorListener);
}

export function deactivate() {
  console.log("🔌 SecureScan extension deactivated");
}