# API Payload Format Documentation

## Overview

This document describes the payload formats for the security analysis API endpoints in the AI Grand Challenge backend.

## API Endpoints

### 1. `/code-block` (POST)

**Purpose**: Analyze a single code block/string for security vulnerabilities

**Payload Format**:

```json
{
  "codeBlock": "string containing the code to analyze"
}
```

**Example Request**:

```json
{
  "codeBlock": "#include <stdio.h>\nint main() {\n    char buffer[10];\n    gets(buffer);\n    return 0;\n}"
}
```

**Description**:

- `codeBlock` (string, required): The code snippet to be analyzed for security vulnerabilities
- The code can be in any programming language
- Multi-line code should use `\n` for line breaks

---

### 2. `/analyze-multiple-files` (POST)

**Purpose**: Analyze multiple files in batches based on token limits

**Payload Format**:

```json
{
  "filePaths": ["array", "of", "file", "paths"],
  "instructions": "optional custom instructions for analysis"
}
```

**Example Request**:

```json
{
  "filePaths": ["/path/to/file1.js", "/path/to/file2.c", "/path/to/file3.py"],
  "instructions": "Focus on authentication vulnerabilities"
}
```

**Description**:

- `filePaths` (array of strings, required): Array of absolute file paths to analyze
- `instructions` (string, optional): Custom instructions to guide the security analysis
- Files are automatically batched based on the 30,000 token limit

---

## API Response Format

Both endpoints return responses following a standardized schema:

### Success Response Structure

```json
{
  "success": true,
  "result": {
    "entries": [
      {
        "code_snippet": "vulnerable code here",
        "severity": "Critical|High|Medium|Low",
        "vulnerability_explanation": "detailed explanation of the vulnerability",
        "recommended_fix": "specific steps or code to fix the vulnerability",
        "cve_ids": [
          {
            "id": "CVE-YYYY-XXXXX",
            "description": "detailed description of the CVE",
            "mitigation": "specific mitigation strategy for this CVE"
          }
        ],
        "cwe_ids": [
          {
            "id": "CWE-XXX",
            "description": "detailed description of the weakness type",
            "mitigation": "specific mitigation strategies for this CWE"
          }
        ]
      }
    ]
  }
}
```

### Error Response Structure

```json
{
  "success": false,
  "error": "Error message describing what went wrong"
}
```

### Response Fields Description

#### Entry Object

- **`code_snippet`** (string): The exact vulnerable code snippet identified
- **`severity`** (string): Severity level - one of: `Critical`, `High`, `Medium`, `Low`
- **`vulnerability_explanation`** (string): Detailed explanation of why the code is vulnerable
- **`recommended_fix`** (string): Specific remediation steps or code examples
- **`cve_ids`** (array): Array of related CVE (Common Vulnerabilities and Exposures) entries
- **`cwe_ids`** (array): Array of related CWE (Common Weakness Enumeration) entries

#### CVE/CWE Object

- **`id`** (string): The CVE or CWE identifier
- **`description`** (string): Detailed description of the vulnerability/weakness
- **`mitigation`** (string): Specific mitigation strategies

---

## Severity Levels

### Critical

- Remote Code Execution (RCE)
- SQL Injection with database access
- Authentication bypass allowing admin access
- Hardcoded secrets with high privilege access
- Memory corruption leading to system compromise

### High

- Privilege escalation vulnerabilities
- Sensitive data exposure (PII, financial, health)
- Cross-Site Scripting (XSS) in sensitive contexts
- Insecure direct object references with data access
- Cryptographic failures with significant impact

### Medium

- Information disclosure vulnerabilities
- CSRF vulnerabilities
- Weak authentication mechanisms
- Insecure configurations with potential impact
- Input validation bypasses with limited impact

### Low

- Information leakage with minimal impact
- Missing security headers with low exploitability
- Weak encryption with limited exposure
- Minor configuration issues
- Deprecated functions with available alternatives

---

## Implementation Details

### Token Management

- The system uses a `TokenManager` class to handle batching files based on the 30,000 token limit for the Gemini model
- Files are automatically split into appropriate batches to avoid exceeding API limits

### Rate Limiting

- Built-in retry logic with exponential backoff for handling rate limits (429 errors)
- Default retry attempts: 3
- Wait times: 60 seconds for first retry, then 30 seconds per subsequent attempt

### File Processing

- For multiple files, the system reads file contents from the provided file paths
- Files are processed in batches to stay within token limits
- Each file is clearly marked with its path in the analysis

### Security Analysis Categories

The system analyzes code across multiple security dimensions:

1. **Input Validation Analysis**
2. **Authentication & Authorization Flaws**
3. **Data Exposure & Privacy Violations**
4. **Cryptographic Weaknesses**
5. **Business Logic Flaws**
6. **Configuration & Deployment Issues**
7. **Dependency & Supply Chain Risks**
8. **Memory & Resource Management**
9. **Concurrency & Race Conditions**
10. **Client-Side Security (Web Applications)**

---

## Example Usage

### Single Code Block Analysis

```bash
curl -X POST http://localhost:3000/code-block \
  -H "Content-Type: application/json" \
  -d '{
    "codeBlock": "const express = require(\"express\");\nconst app = express();\napp.get(\"/user/:id\", (req, res) => {\n  const query = \"SELECT * FROM users WHERE id = \" + req.params.id;\n  db.query(query, (err, result) => {\n    res.json(result);\n  });\n});"
  }'
```

### Multiple Files Analysis

```bash
curl -X POST http://localhost:3000/analyze-multiple-files \
  -H "Content-Type: application/json" \
  -d '{
    "filePaths": [
      "/app/src/auth.js",
      "/app/src/database.js",
      "/app/src/api.js"
    ],
    "instructions": "Focus on SQL injection and authentication bypass vulnerabilities"
  }'
```

---

## Notes

- If no vulnerabilities are found, the `entries` array will be empty: `{ "entries": [] }`
- Each vulnerability can have multiple CWE and CVE IDs
- The analysis focuses on actual security vulnerabilities, not general code quality issues
- All responses are in valid JSON format without comments or trailing commas
