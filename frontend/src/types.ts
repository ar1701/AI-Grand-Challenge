export type Severity = "Critical" | "High" | "Medium" | "Low";

export interface CVEEntry {
  id: string;
  description: string;
  mitigation: string;
}

export interface CWEEntry {
  id: string;
  description: string;
  mitigation: string;
}

export interface AnalyzerEntry {
  code_snippet: string;
  severity: Severity;
  vulnerability_explanation: string;
  recommended_fix: string;
  cve_ids: CVEEntry[];
  cwe_ids: CWEEntry[];
}

// Response for a single file scan (/code-block)
export interface SingleFileAnalyzerResponse {
  entries: AnalyzerEntry[];
  error?: string;
}

// New Types for Project Scan (/analyze-multiple-files)
export interface ProjectFileAnalysis {
  file_path: string;
  vulnerabilities: AnalyzerEntry[];
}

export interface ProjectScanBatch {
  engine: string;
  files: string[];
  analysis: {
    files: ProjectFileAnalysis[];
  };
}

export interface ProjectScanResponse {
  success: boolean;
  batches: ProjectScanBatch[];
  error?: string;
}

// A unified type for displaying issues in the panel
export interface Issue extends AnalyzerEntry {
  filePath: string;
  // NEW: Add line number for navigation
  line: number; 
}