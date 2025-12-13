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

export type IssueType = 'vulnerability' | 'edge-case' | 'cross-file-bug' | 'business-logic';

export interface AnalyzerEntry {
  code_snippet: string;
  severity: Severity;
  vulnerability_explanation: string;
  recommended_fix: string;
  cve_ids: CVEEntry[];
  cwe_ids: CWEEntry[];
  /** Type of finding: vulnerability, edge-case, cross-file-bug, or business-logic */
  issueType?: IssueType;
  /** For edge cases / cross-file bugs: list of affected files/functions */
  affectedDependencies?: string[];
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
  // Optional: Calculated end line for precise highlighting
  calculatedEndLine?: number;
  isActive?: boolean;
  /** Override from AnalyzerEntry for convenience */
  issueType?: IssueType;
}

// Orchestration types for multi-agent security analysis
export interface SpawnedAgent {
  agentId: string;
  purpose: string;
  spawnedAt?: string;
}

export interface ToolCall {
  tool: string;
  success: boolean;
  timestamp: string;
  hasResult?: boolean;
}

export interface AgentResult {
  agentId: string;
  purpose: string;
  success: boolean;
  result?: {
    type: string;
    message: string;
    iterations?: number;
    toolCallCount?: number;
  };
  executionTime?: number;
  toolCallCount?: number;
  toolHistory?: ToolCall[];
  error?: string;
}

export interface OrchestrationResponse {
  success: boolean;
  result: {
    type: string;
    message: string;
  };
  spawnedAgents: SpawnedAgent[];
  agentResults: AgentResult[];
  orchestratorToolHistory?: ToolCall[];
  conversationTurns: number;
  error?: string;
}

// Parsed security finding from agent analysis
export interface SecurityFinding {
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  file: string;
  line: string;
  vulnerableCode: string;
  issue: string;
  fix: string;
  impact: string;
  agentId: string;
}