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
 * Scans an entire project by sending file paths to the backend.
 * Used for the "Scan Entire Project" command.
 */
export async function scanProjectWithBackend(filePaths: string[]): Promise<ProjectScanResponse> {
  const baseUrl = vscode.workspace.getConfiguration().get<string>("secureScan.backendUrl");
  if (!baseUrl) throw new Error("Backend URL not configured");

  const endpoint = `${baseUrl}/analyze-multiple-files`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filePaths })
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Backend error ${res.status}: ${errorBody}`);
  }

  return (await res.json()) as ProjectScanResponse;
}