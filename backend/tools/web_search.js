const { GoogleGenAI } = require('@google/genai');
require('dotenv').config();

/**
 * Tool: web_search()
 * Searches the web using Google Search grounding
 * Used for vulnerability validation, OWASP checks, best practices, deployment configs
 */
const webSearchTool = {
  name: 'web_search',
  description: 'Performs external web research using Google Search. Use for vulnerability validation, OWASP/secure coding checks, framework best practices, and deployment configurations.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query to execute'
      },
      context: {
        type: 'string',
        description: 'Optional: Additional context about why this search is being performed'
      }
    },
    required: ['query']
  }
};

/**
 * Execute web search with Google Search grounding
 */
async function executeWebSearch(query, context = '') {
  try {
    const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    // Configure with Google Search grounding tool
    const groundingTool = {
      googleSearch: {}
    };

    const config = {
      tools: [groundingTool]
    };

    // Build the prompt with context if provided
    let fullPrompt = query;
    if (context) {
      fullPrompt = `Context: ${context}\n\nQuery: ${query}`;
    }

    // Generate content with grounding
    const response = await client.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      contents: fullPrompt,
      config
    });

    // Extract text and grounding metadata
    const text = response.response.text();
    const groundingMetadata = response.response.candidates?.[0]?.groundingMetadata;

    // Process citations and sources
    const result = {
      success: true,
      query,
      answer: text,
      timestamp: new Date().toISOString()
    };

    if (groundingMetadata) {
      result.grounding = {
        webSearchQueries: groundingMetadata.webSearchQueries || [],
        sources: extractSources(groundingMetadata),
        citations: extractCitations(text, groundingMetadata)
      };
    }

    return result;
  } catch (error) {
    return {
      success: false,
      error: error.message,
      query
    };
  }
}

/**
 * Extract sources from grounding metadata
 */
function extractSources(groundingMetadata) {
  const sources = [];
  
  if (groundingMetadata.groundingChunks) {
    for (const chunk of groundingMetadata.groundingChunks) {
      if (chunk.web) {
        sources.push({
          url: chunk.web.uri,
          title: chunk.web.title
        });
      }
    }
  }
  
  return sources;
}

/**
 * Extract inline citations from the response
 */
function extractCitations(text, groundingMetadata) {
  const citations = [];
  
  if (groundingMetadata.groundingSupports) {
    for (const support of groundingMetadata.groundingSupports) {
      const segment = support.segment;
      const citedText = segment.text || text.substring(segment.startIndex, segment.endIndex);
      
      const sourceIndices = support.groundingChunkIndices || [];
      const sources = sourceIndices.map(idx => {
        const chunk = groundingMetadata.groundingChunks?.[idx];
        return chunk?.web ? {
          url: chunk.web.uri,
          title: chunk.web.title
        } : null;
      }).filter(s => s !== null);
      
      citations.push({
        text: citedText,
        startIndex: segment.startIndex,
        endIndex: segment.endIndex,
        sources
      });
    }
  }
  
  return citations;
}

/**
 * Search for specific security vulnerabilities
 */
async function searchVulnerability(vulnerabilityType, frameworkOrLibrary = '') {
  const query = frameworkOrLibrary 
    ? `${vulnerabilityType} vulnerability in ${frameworkOrLibrary} latest best practices mitigation`
    : `${vulnerabilityType} vulnerability OWASP best practices mitigation`;
  
  return await executeWebSearch(
    query,
    `Researching security vulnerability: ${vulnerabilityType}`
  );
}

/**
 * Search for deployment best practices
 */
async function searchDeploymentPractices(platform, technology) {
  const query = `${technology} production deployment best practices on ${platform} 2024`;
  
  return await executeWebSearch(
    query,
    `Researching deployment practices for ${technology} on ${platform}`
  );
}

/**
 * Search for framework-specific best practices
 */
async function searchFrameworkBestPractices(framework, topic) {
  const query = `${framework} ${topic} best practices 2024 official documentation`;
  
  return await executeWebSearch(
    query,
    `Researching ${framework} best practices for: ${topic}`
  );
}

/**
 * Search for API security guidelines
 */
async function searchAPISecurity(apiType = 'REST') {
  const query = `${apiType} API security best practices OWASP 2024 authentication authorization`;
  
  return await executeWebSearch(
    query,
    'Researching API security guidelines'
  );
}

/**
 * Search for dependency vulnerabilities
 */
async function searchDependencyVulnerabilities(packageName, version = '') {
  const versionPart = version ? `version ${version}` : 'latest version';
  const query = `${packageName} ${versionPart} known vulnerabilities CVE security issues`;
  
  return await executeWebSearch(
    query,
    `Checking for known vulnerabilities in ${packageName}`
  );
}

/**
 * Batch search multiple queries
 */
async function batchSearch(queries) {
  const results = [];
  
  for (const query of queries) {
    const result = await executeWebSearch(
      typeof query === 'string' ? query : query.query,
      typeof query === 'object' ? query.context : ''
    );
    results.push(result);
    
    // Add a small delay between requests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return {
    success: true,
    count: results.length,
    results
  };
}

module.exports = {
  webSearchTool,
  executeWebSearch,
  searchVulnerability,
  searchDeploymentPractices,
  searchFrameworkBestPractices,
  searchAPISecurity,
  searchDependencyVulnerabilities,
  batchSearch
};
