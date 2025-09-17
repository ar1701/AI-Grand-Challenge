# API Payload and Response Format Documentation

**Last Updated**: September 17, 2025

## Overview

This document describes the payload and response formats for the security analysis API endpoints. The backend is designed to be a robust, high-performance engine for a VS Code extension or other developer tools.

## Authentication

All API endpoints require an API key for security and access control. The key must be passed in the request headers.

-   **Header**: `X-API-Key`
-   **Value**: `your-secret-api-key`
-   Requests without a valid key will be rejected with a `401 Unauthorized` error.

---

## API Endpoints

The API offers two interaction models: a simple synchronous model for quick checks and a robust asynchronous model recommended for production clients.

### Model 1: Synchronous API

The server processes the request and holds the connection open until the analysis is complete.

#### Endpoint: `POST /code-block`

**Purpose**: Analyze a single code block/string for vulnerabilities.

* **Payload Format**:
    ```json
    {
      "codeBlock": "string containing the code to analyze"
    }
    ```

#### Endpoint: `POST /analyze-multiple-files`

**Purpose**: Analyze multiple files, returning the result in the same request.

* **Payload Format**:
    ```json
    {
      "filePaths": ["/path/to/file1.js", "/path/to/file2.c"]
    }
    ```
    -   `filePaths` (array of strings, required): An array of absolute file paths to analyze.

---

### Model 2: Asynchronous API (Recommended)

This model uses a job queue, making it ideal for responsive clients. The client submits a job and polls for the result.

#### Endpoint: `POST /analysis-jobs`

**Purpose**: Submits a new analysis job to the queue.

* **Payload Format**: Same as `/analyze-multiple-files`.
* **Success Response (`202 Accepted`)**: Responds immediately with a `jobId`.
    ```json
    {
        "success": true,
        "message": "Analysis job accepted.",
        "jobId": "a1b2c3d4-e5f6-7890-1234-567890abcdef"
    }
    ```

#### Endpoint: `GET /analysis-jobs/result/:jobId`

**Purpose**: Checks the status and retrieves the result of an analysis job.

* **URL Parameter**: `jobId` from the POST request.
* **Response States**:
    * **Pending**: `{ "status": "pending" }`
    * **Failed**: `{ "status": "failed", "error": "Reason for failure" }`
    * **Completed**:
        ```json
        {
          "status": "completed",
          "result": {
            "engine": "openai",
            "files": ["/path/to/file1.js"],
            "analysis": { /* ... see full analysis structure below ... */ }
          }
        }
        ```

---

## API Response Format

The core analysis object is standardized across all endpoints.

### Success Response Structure (for `/analyze-multiple-files`)

```json
{
  "success": true,
  "batches": [
    {
      "engine": "openai",
      "files": [
        "/path/to/file1.js",
        "/path/to/file2.c"
      ],
      "analysis": {
        "files": [
          {
            "file_path": "/path/to/file1.js",
            "vulnerabilities": []
          },
          {
            "file_path": "/path/to/file2.c",
            "vulnerabilities": [
              {
                "code_snippet": "gets(buffer);",
                "severity": "Critical",
                "vulnerability_explanation": "The 'gets' function is deprecated and extremely dangerous because it does not perform bounds checking, leading to buffer overflows.",
                "recommended_fix": "Replace 'gets' with a bounds-checked function like 'fgets'. Example: fgets(buffer, sizeof(buffer), stdin);",
                "cve_ids": [],
                "cwe_ids": [
                  {
                    "id": "CWE-120",
                    "description": "Buffer Copy without Checking Size of Input ('Classic Buffer Overflow')",
                    "mitigation": "Use functions that limit the input size to the size of the destination buffer."
                  }
                ]
              }
            ]
          }
        ]
      }
    }
  ]
}
```

### Error Response Structure

```json
{
  "success": false,
  "error": "Error message describing what went wrong"
}
```

---

## Severity Levels

### Critical
- Remote Code Execution (RCE)
- SQL Injection with database access
- Authentication bypass allowing admin access

### High
- Privilege escalation vulnerabilities
- Sensitive data exposure (PII, financial, health)
- Cross-Site Scripting (XSS) in sensitive contexts

### Medium
- Information disclosure vulnerabilities
- CSRF vulnerabilities
- Weak authentication mechanisms

### Low
- Information leakage with minimal impact
- Missing security headers with low exploitability

---

## Implementation Details

### Dual AI Engine
-   The backend supports both **Google Gemini** and **OpenAI GPT** models.
-   The active engine is configured globally on the server via the `ANALYSIS_ENGINE` variable in the `.env` file. It is not selectable per-request.

### Caching Layer
-   A robust caching system using **Redis** is implemented to dramatically improve performance and reduce costs.
-   **Content Hashing (SHA-256)** is used to generate cache keys. The cache is keyed by the file's content, not its path, ensuring that any modification to a file results in a fresh analysis.

### Token Management
-   The `TokenManager` class automatically batches files to stay within the AI model's context window limits (e.g., 30,000 tokens).

### Rate Limiting & Security
-   **Server-Side Rate Limiting**: The API is protected against abuse using middleware to limit request frequency per IP.
-   **API Key Authentication**: All endpoints are protected and require a valid `X-API-Key`.

### Security Analysis Categories
1.  **Input Validation Analysis**
2.  **Authentication & Authorization Flaws**
3.  **Data Exposure & Privacy Violations**
4.  **Cryptographic Weaknesses**
5.  **Business Logic Flaws**
6.  **Configuration & Deployment Issues**
7.  **Dependency & Supply Chain Risks**
8.  **Memory & Resource Management**
9.  **Concurrency & Race Conditions**
10. **Client-Side Security (Web Applications)**

---

## Example Usage

### Synchronous Analysis

```bash
curl -X POST http://localhost:8080/analyze-multiple-files \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-secret-api-key" \
  -d '{
    "filePaths": [
      "/app/src/auth.js",
      "/app/src/database.js"
    ]
  }'
```

### Asynchronous Analysis

**Step 1: Submit the job**
```bash
curl -X POST http://localhost:8080/analysis-jobs \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-secret-api-key" \
  -d '{
    "filePaths": ["/app/src/main.py"]
  }'
```
> **Response:** `{ "success": true, "jobId": "some-unique-job-id" }`

**Step 2: Poll for the result**
```bash
curl -X GET http://localhost:8080/analysis-jobs/result/some-unique-job-id \
  -H "X-API-Key: your-secret-api-key"
```
> **Response:** `{ "status": "completed", "result": { ... } }`