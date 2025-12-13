import * as vscode from "vscode";
import { AnalyzerEntry, SingleFileAnalyzerResponse, ProjectScanResponse } from "./types";

/**
 * ✅ Defines the structure of the JSON payload from the /code-block endpoint.
 */
interface BackendSingleFilePayload {
  success: boolean;
  tokenCount?: number;
  result?: {
    entries: AnalyzerEntry[];
  };
  error?: string;
}

/**
 * Scans a single block of code.
 * Used for the "Scan Active File" command.
 */
export async function scanSingleFileWithBackend(filename: string, content: string): Promise<SingleFileAnalyzerResponse> {
  const baseUrl = vscode.workspace.getConfiguration().get<string>("secureScan.backendUrl");
  if (!baseUrl) throw new Error("Backend URL not configured");

  const endpoint = `${baseUrl}/code-block`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename, codeBlock: content })
  });

  if (!res.ok) {
    throw new Error(`Backend error ${res.status}`);
  }

  const jsonResponse = (await res.json()) as BackendSingleFilePayload;


  if (jsonResponse.success && jsonResponse.result) {
      return { entries: jsonResponse.result.entries || [] };
  } else {
      throw new Error(jsonResponse.error || "Invalid response format from single file scan");
  }
}

/**
 * Performs comprehensive security analysis using multi-agent orchestration.
 * Used for the "Security Analysis" command.
 */
export async function orchestrateSecurityAnalysis(goal: string, projectPath: string): Promise<any> {
  const baseUrl = vscode.workspace.getConfiguration().get<string>("secureScan.backendUrl");
  if (!baseUrl) throw new Error("Backend URL not configured");

  const endpoint = `${baseUrl}/orchestrate`;

  console.log(`🌐 Making orchestration request to: ${endpoint}`);
  console.log(`📁 Project path: ${projectPath}`);
  console.log(`🎯 Goal: ${goal.substring(0, 100)}...`);

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal, projectPath })
    });

    console.log(`📡 Response status: ${res.status}`);

    if (!res.ok) {
      const errorBody = await res.text();
      console.error(`❌ Orchestration error response:`, errorBody);
      throw new Error(`Backend error ${res.status}: ${errorBody}`);
    }

    const result = await res.json();
    console.log(`✅ Received orchestration response:`, result);
    return result;
  } catch (error) {
    console.error(`🚨 Orchestration error:`, error);
    throw error;
  }
}

/**
 * Scans an entire project by sending file paths to the backend.
 * Used for the "Scan Entire Project" command.
 */
export async function scanProjectWithBackend(filePaths: string[]): Promise<ProjectScanResponse> {
  const baseUrl = vscode.workspace.getConfiguration().get<string>("secureScan.backendUrl");
  if (!baseUrl) throw new Error("Backend URL not configured");

  const endpoint = `${baseUrl}/analyze-multiple-files`;

  console.log(`🌐 Making request to: ${endpoint}`);
  console.log(`📁 Sending ${filePaths.length} file paths:`, filePaths);

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filePaths })
    });

    console.log(`📡 Response status: ${res.status}`);

    if (!res.ok) {
      const errorBody = await res.text();
      console.error(`❌ Backend error response:`, errorBody);
      throw new Error(`Backend error ${res.status}: ${errorBody}`);
    }

    const result = await res.json();
    console.log(`✅ Received response:`, result);
    return result as ProjectScanResponse;
  } catch (error) {
    console.error(`🚨 Network/fetch error:`, error);
    throw error;
  }
}