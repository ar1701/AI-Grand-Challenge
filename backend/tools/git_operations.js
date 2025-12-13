const { exec } = require('child_process');
const util = require('util');
const path = require('path');

const execPromise = util.promisify(exec);

/**
 * Tool: get_diffs()
 * Retrieves Git changes since the last checkpoint
 */
const getDiffsTool = {
  name: 'get_diffs',
  description: 'Retrieves only the Git changes made since the last checkpoint. Use when diagnosing incremental developer intent or validating patch effects.',
  parameters: {
    type: 'object',
    properties: {
      projectPath: {
        type: 'string',
        description: 'Absolute path to the Git repository'
      },
      staged: {
        type: 'boolean',
        description: 'Whether to get staged changes only (default: false)',
        default: false
      },
      files: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional: specific files to get diffs for'
      }
    },
    required: ['projectPath']
  }
};

/**
 * Execute get_diffs tool
 */
async function executeGetDiffs(projectPath, staged = false, files = []) {
  try {
    // Verify it's a git repository
    const isGitRepo = await checkIsGitRepository(projectPath);
    if (!isGitRepo) {
      return {
        success: false,
        error: 'Not a Git repository'
      };
    }

    const results = {
      success: true,
      repository: projectPath,
      timestamp: new Date().toISOString(),
      changes: {}
    };

    // Get different types of changes
    results.changes.unstaged = await getUnstagedChanges(projectPath, files);
    results.changes.staged = await getStagedChanges(projectPath, files);
    results.changes.untracked = await getUntrackedFiles(projectPath);
    
    // Get current branch and commit info
    results.branch = await getCurrentBranch(projectPath);
    results.lastCommit = await getLastCommit(projectPath);

    // If staged flag is set, return only staged changes
    if (staged) {
      results.changes = {
        staged: results.changes.staged
      };
    }

    return results;
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Check if directory is a git repository
 */
async function checkIsGitRepository(projectPath) {
  try {
    await execPromise('git rev-parse --git-dir', { cwd: projectPath });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get unstaged changes (working directory)
 */
async function getUnstagedChanges(projectPath, files = []) {
  try {
    const filesArg = files.length > 0 ? files.join(' ') : '';
    const { stdout } = await execPromise(
      `git diff ${filesArg}`,
      { cwd: projectPath, maxBuffer: 1024 * 1024 * 10 } // 10MB buffer
    );

    return {
      hasDiff: stdout.length > 0,
      diff: stdout,
      summary: await getDiffSummary(projectPath, false, files)
    };
  } catch (error) {
    return {
      hasDiff: false,
      error: error.message
    };
  }
}

/**
 * Get staged changes
 */
async function getStagedChanges(projectPath, files = []) {
  try {
    const filesArg = files.length > 0 ? files.join(' ') : '';
    const { stdout } = await execPromise(
      `git diff --cached ${filesArg}`,
      { cwd: projectPath, maxBuffer: 1024 * 1024 * 10 }
    );

    return {
      hasDiff: stdout.length > 0,
      diff: stdout,
      summary: await getDiffSummary(projectPath, true, files)
    };
  } catch (error) {
    return {
      hasDiff: false,
      error: error.message
    };
  }
}

/**
 * Get untracked files
 */
async function getUntrackedFiles(projectPath) {
  try {
    const { stdout } = await execPromise(
      'git ls-files --others --exclude-standard',
      { cwd: projectPath }
    );

    const files = stdout.trim().split('\n').filter(f => f.length > 0);
    
    return {
      count: files.length,
      files
    };
  } catch (error) {
    return {
      count: 0,
      files: [],
      error: error.message
    };
  }
}

/**
 * Get diff summary (files changed with stats)
 */
async function getDiffSummary(projectPath, staged = false, files = []) {
  try {
    const stagedFlag = staged ? '--cached' : '';
    const filesArg = files.length > 0 ? files.join(' ') : '';
    const { stdout } = await execPromise(
      `git diff ${stagedFlag} --numstat ${filesArg}`,
      { cwd: projectPath }
    );

    const changedFiles = [];
    const lines = stdout.trim().split('\n');
    
    for (const line of lines) {
      if (!line) continue;
      
      const [added, removed, file] = line.split('\t');
      changedFiles.push({
        file,
        added: parseInt(added) || 0,
        removed: parseInt(removed) || 0
      });
    }

    return {
      filesChanged: changedFiles.length,
      files: changedFiles,
      totalAdded: changedFiles.reduce((sum, f) => sum + f.added, 0),
      totalRemoved: changedFiles.reduce((sum, f) => sum + f.removed, 0)
    };
  } catch (error) {
    return {
      filesChanged: 0,
      files: []
    };
  }
}

/**
 * Get current branch name
 */
async function getCurrentBranch(projectPath) {
  try {
    const { stdout } = await execPromise(
      'git rev-parse --abbrev-ref HEAD',
      { cwd: projectPath }
    );
    return stdout.trim();
  } catch (error) {
    return 'unknown';
  }
}

/**
 * Get last commit info
 */
async function getLastCommit(projectPath) {
  try {
    const { stdout } = await execPromise(
      'git log -1 --pretty=format:"%H|%an|%ae|%ai|%s"',
      { cwd: projectPath }
    );

    const [hash, author, email, date, message] = stdout.split('|');
    
    return {
      hash,
      author,
      email,
      date,
      message
    };
  } catch (error) {
    return null;
  }
}

/**
 * Get file history
 */
async function getFileHistory(projectPath, filePath, limit = 10) {
  try {
    const { stdout } = await execPromise(
      `git log -${limit} --pretty=format:"%H|%an|%ai|%s" -- "${filePath}"`,
      { cwd: projectPath }
    );

    const commits = [];
    const lines = stdout.trim().split('\n');
    
    for (const line of lines) {
      if (!line) continue;
      const [hash, author, date, message] = line.split('|');
      commits.push({ hash, author, date, message });
    }

    return {
      success: true,
      file: filePath,
      commits
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get diff for a specific commit
 */
async function getCommitDiff(projectPath, commitHash) {
  try {
    const { stdout } = await execPromise(
      `git show ${commitHash}`,
      { cwd: projectPath, maxBuffer: 1024 * 1024 * 10 }
    );

    return {
      success: true,
      commit: commitHash,
      diff: stdout
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Check if there are uncommitted changes
 */
async function hasUncommittedChanges(projectPath) {
  try {
    const { stdout } = await execPromise(
      'git status --porcelain',
      { cwd: projectPath }
    );

    return stdout.trim().length > 0;
  } catch (error) {
    return false;
  }
}

module.exports = {
  getDiffsTool,
  executeGetDiffs,
  checkIsGitRepository,
  getUnstagedChanges,
  getStagedChanges,
  getUntrackedFiles,
  getCurrentBranch,
  getLastCommit,
  getFileHistory,
  getCommitDiff,
  hasUncommittedChanges
};
