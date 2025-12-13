const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

/**
 * Tool: apply_patch(diff)
 * Applies a structured patch to existing source code
 * NEVER rewrites entire files - only minimal diffs
 */
const applyPatchTool = {
  name: 'apply_patch',
  description: 'Applies a structured patch to existing source code. Always propose patches with explicit before/after line blocks. Never rewrite entire files. Limit changes to minimal necessary diffs.',
  parameters: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: 'Absolute path to the file to patch'
      },
      patches: {
        type: 'array',
        description: 'Array of patch objects to apply',
        items: {
          type: 'object',
          properties: {
            oldCode: {
              type: 'string',
              description: 'The exact code to find and replace (must match exactly including whitespace)'
            },
            newCode: {
              type: 'string',
              description: 'The new code to replace with'
            },
            description: {
              type: 'string',
              description: 'Description of what this patch does'
            }
          },
          required: ['oldCode', 'newCode']
        }
      }
    },
    required: ['filePath', 'patches']
  }
};

/**
 * Structured output schema for patch generation
 * Used with Gemini's structured output feature
 */
const patchGenerationSchema = {
  type: 'object',
  properties: {
    patches: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          filePath: {
            type: 'string',
            description: 'Path to the file to modify'
          },
          reason: {
            type: 'string',
            description: 'Why this change is necessary'
          },
          changes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                lineStart: {
                  type: 'integer',
                  description: 'Starting line number (1-indexed)'
                },
                lineEnd: {
                  type: 'integer',
                  description: 'Ending line number (1-indexed)'
                },
                oldCode: {
                  type: 'string',
                  description: 'The existing code to replace'
                },
                newCode: {
                  type: 'string',
                  description: 'The new code to insert'
                },
                description: {
                  type: 'string',
                  description: 'What this specific change does'
                }
              },
              required: ['oldCode', 'newCode', 'description']
            }
          }
        },
        required: ['filePath', 'reason', 'changes']
      }
    },
    summary: {
      type: 'string',
      description: 'Overall summary of all patches'
    }
  },
  required: ['patches', 'summary']
};

/**
 * Execute patch application
 */
async function executeApplyPatch(filePath, patches) {
  try {
    // Validate file exists
    if (!fsSync.existsSync(filePath)) {
      return {
        success: false,
        error: `File not found: ${filePath}`
      };
    }

    // Read original content
    const originalContent = await fs.readFile(filePath, 'utf-8');
    let modifiedContent = originalContent;
    const appliedPatches = [];
    const failedPatches = [];

    // Apply each patch
    for (let i = 0; i < patches.length; i++) {
      const patch = patches[i];
      
      // Validate patch has required fields
      if (!patch.oldCode || !patch.newCode) {
        failedPatches.push({
          index: i,
          error: 'Patch missing oldCode or newCode',
          patch
        });
        continue;
      }

      // Try to apply the patch
      const patchResult = applyStringReplacement(
        modifiedContent,
        patch.oldCode,
        patch.newCode
      );

      if (patchResult.success) {
        modifiedContent = patchResult.content;
        appliedPatches.push({
          index: i,
          description: patch.description || 'No description',
          linesChanged: countLines(patch.oldCode)
        });
      } else {
        failedPatches.push({
          index: i,
          error: patchResult.error,
          patch
        });
      }
    }

    // If no patches succeeded, don't modify the file
    if (appliedPatches.length === 0) {
      return {
        success: false,
        error: 'No patches could be applied',
        failedPatches
      };
    }

    // Create backup before writing
    const backupPath = `${filePath}.backup.${Date.now()}`;
    await fs.writeFile(backupPath, originalContent, 'utf-8');

    // Write modified content
    await fs.writeFile(filePath, modifiedContent, 'utf-8');

    return {
      success: true,
      filePath,
      backupPath,
      appliedPatches: appliedPatches.length,
      failedPatches: failedPatches.length,
      details: {
        applied: appliedPatches,
        failed: failedPatches
      },
      diff: generateDiff(originalContent, modifiedContent)
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Apply a single string replacement with exact matching
 */
function applyStringReplacement(content, oldCode, newCode) {
  // Normalize line endings
  const normalizedContent = content.replace(/\r\n/g, '\n');
  const normalizedOldCode = oldCode.replace(/\r\n/g, '\n');
  
  // Check if old code exists exactly once
  const occurrences = countOccurrences(normalizedContent, normalizedOldCode);
  
  if (occurrences === 0) {
    return {
      success: false,
      error: 'Old code not found in file. Ensure exact match including whitespace.'
    };
  }
  
  if (occurrences > 1) {
    return {
      success: false,
      error: `Old code appears ${occurrences} times. Patch must be unique. Add more context.`
    };
  }

  // Replace the code
  const newContent = normalizedContent.replace(normalizedOldCode, newCode);
  
  return {
    success: true,
    content: newContent
  };
}

/**
 * Count occurrences of a string in content
 */
function countOccurrences(content, searchString) {
  let count = 0;
  let pos = 0;
  
  while ((pos = content.indexOf(searchString, pos)) !== -1) {
    count++;
    pos += searchString.length;
  }
  
  return count;
}

/**
 * Count number of lines in a string
 */
function countLines(str) {
  return str.split('\n').length;
}

/**
 * Generate a unified diff between two strings
 */
function generateDiff(original, modified) {
  const originalLines = original.split('\n');
  const modifiedLines = modified.split('\n');
  
  const diff = [];
  let i = 0, j = 0;
  
  while (i < originalLines.length || j < modifiedLines.length) {
    if (i < originalLines.length && j < modifiedLines.length) {
      if (originalLines[i] === modifiedLines[j]) {
        diff.push(`  ${originalLines[i]}`);
        i++;
        j++;
      } else {
        // Find the next matching line
        let foundMatch = false;
        for (let k = j + 1; k < Math.min(j + 5, modifiedLines.length); k++) {
          if (originalLines[i] === modifiedLines[k]) {
            // Lines were added
            while (j < k) {
              diff.push(`+ ${modifiedLines[j]}`);
              j++;
            }
            foundMatch = true;
            break;
          }
        }
        
        if (!foundMatch) {
          // Line was changed or removed
          diff.push(`- ${originalLines[i]}`);
          if (j < modifiedLines.length) {
            diff.push(`+ ${modifiedLines[j]}`);
            j++;
          }
          i++;
        }
      }
    } else if (i < originalLines.length) {
      diff.push(`- ${originalLines[i]}`);
      i++;
    } else {
      diff.push(`+ ${modifiedLines[j]}`);
      j++;
    }
  }
  
  return diff.slice(0, 100).join('\n') + (diff.length > 100 ? '\n... (truncated)' : '');
}

/**
 * Validate patch before applying
 */
function validatePatch(patch) {
  const errors = [];
  
  if (!patch.oldCode) {
    errors.push('Missing oldCode');
  }
  
  if (!patch.newCode) {
    errors.push('Missing newCode');
  }
  
  if (patch.oldCode === patch.newCode) {
    errors.push('oldCode and newCode are identical');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Batch apply multiple patches to different files
 */
async function batchApplyPatches(patchSets) {
  const results = [];
  
  for (const patchSet of patchSets) {
    const result = await executeApplyPatch(patchSet.filePath, patchSet.patches);
    results.push({
      filePath: patchSet.filePath,
      ...result
    });
  }
  
  return {
    success: true,
    totalFiles: results.length,
    successfulFiles: results.filter(r => r.success).length,
    results
  };
}

/**
 * Preview patch without applying
 */
async function previewPatch(filePath, patches) {
  try {
    if (!fsSync.existsSync(filePath)) {
      return {
        success: false,
        error: `File not found: ${filePath}`
      };
    }

    const originalContent = await fs.readFile(filePath, 'utf-8');
    let modifiedContent = originalContent;
    const previewResults = [];

    for (const patch of patches) {
      const result = applyStringReplacement(
        modifiedContent,
        patch.oldCode,
        patch.newCode
      );

      previewResults.push({
        description: patch.description,
        success: result.success,
        error: result.error
      });

      if (result.success) {
        modifiedContent = result.content;
      }
    }

    return {
      success: true,
      filePath,
      originalLines: originalContent.split('\n').length,
      modifiedLines: modifiedContent.split('\n').length,
      diff: generateDiff(originalContent, modifiedContent),
      patches: previewResults
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  applyPatchTool,
  patchGenerationSchema,
  executeApplyPatch,
  validatePatch,
  batchApplyPatches,
  previewPatch,
  applyStringReplacement
};
