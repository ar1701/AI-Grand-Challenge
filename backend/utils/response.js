// response.js

const vulnerabilitySchema = {
  type: "object",
  properties: {
    code_snippet: {
      type: "string",
      description: "The exact vulnerable code snippet"
    },
    severity: {
      type: "string",
      enum: ["Critical", "High", "Medium", "Low"],
      description: "Severity level of the vulnerability"
    },
    vulnerability_explanation: {
      type: "string",
      description: "Detailed explanation of why this specific code is vulnerable"
    },
    recommended_fix: {
      type: "string",
      description: "Concrete code example or steps to fix this vulnerability"
    },
    cve_ids: {
      type: "array",
      description: "Array of related CVE (Common Vulnerabilities and Exposures) entries",
      items: {
        type: "object",
        properties: {
          id: { type: "string", description: "CVE identifier or 'N/A'" },
          description: { type: "string", description: "Detailed description of the CVE" },
          mitigation: { type: "string", description: "Specific mitigation for this CVE" }
        },
        required: ["id", "description", "mitigation"]
      }
    },
    cwe_ids: {
      type: "array",
      description: "Array of related CWE (Common Weakness Enumeration) entries",
      items: {
        type: "object",
        properties: {
          id: { type: "string", description: "CWE identifier in format CWE-XXX" },
          description: { type: "string", description: "Detailed description of the weakness type" },
          mitigation: { type: "string", description: "Specific mitigation strategies for this CWE" }
        },
        required: ["id", "description", "mitigation"]
      }
    }
  },
  required: ["code_snippet", "severity", "vulnerability_explanation", "recommended_fix", "cve_ids", "cwe_ids"]
};

const responseSchema = {
  type: "object",
  properties: {
    files: {
      type: "array",
      description: "An array of file analysis results, one for each file provided.",
      items: {
        type: "object",
        properties: {
          file_path: {
            type: "string",
            description: "The full path of the file that was analyzed."
          },
          vulnerabilities: {
            type: "array",
            description: "Array of security vulnerability entries found in this specific file.",
            items: vulnerabilitySchema
          }
        },
        required: ["file_path", "vulnerabilities"]
      }
    }
  },
  required: ["files"]
};

module.exports = { responseSchema };