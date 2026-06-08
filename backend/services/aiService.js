/*
  AI Service Module
  
  Purpose: Interface with an external AI/LLM server to analyze GitHub commits.
  
  This service:
  1. Sends structured commit data to an AI server for analysis
  2. Transforms raw GitHub commit data into a structured payload
  3. Returns AI analysis results back to the calling controller
  
  Example workflow:
  commitData -> buildStructuredPayload() -> analyzeCommitWithLLM() -> AI result
*/

import axios from "axios";

/*
  Analyzes a GitHub commit using an external LLM/AI server.
  
  Flow:
  1. Validates that AI_SERVER_URL environment variable is set
  2. Sends commit data to the AI server via HTTP POST
  3. Returns the AI's analysis response
  
  Parameters:
  - commitData: Structured commit payload (from buildStructuredPayload)
  
  Returns:
  - Promise resolving to AI analysis result
  
  Throws:
  - Error if AI_SERVER_URL is not configured
  - Network errors if AI server is unreachable
  
  Example:
  const result = await analyzeCommitWithLLM(payload);
  // result: { summary: "...", risk: "...", etc }
*/
export async function analyzeCommitWithLLM(commitData) {
  // Get the AI server URL from environment configuration.
  const url = process.env.AI_SERVER_URL;
  if (!url) throw new Error("AI_SERVER_URL env var not set");

  // Send the commit data to the AI server for analysis.
  const res = await axios.post(url, commitData);

  // Return the AI's analysis response.
  return res.data;
}

/*
  Transforms raw GitHub commit data into a structured payload for AI analysis.
  
  Purpose:
  - Converts GitHub API response format into a standardized format
  - Ensures all necessary fields are present for AI analysis
  - Separates file-level data from commit-level metadata
  
  Parameters:
  - commitData: GitHub commit object (from webhooks or API)
  - patchData: Unified diff/patch of all changes in the commit
  
  Returns:
  - Structured object with all commit details organized by category
  
  Example input (commitData):
  {
    sha: "abc123",
    commit: { message: "Fix bug", author: {...}, committer: {...} },
    files: [...],
    stats: { additions: 5, deletions: 2 }
  }
  
  Example output:
  {
    sha: "abc123",
    message: "Fix bug",
    author: { name: "John", email: "john@example.com" },
    files: [...], 
    stats: { total: 3, additions: 5, deletions: 2 },
    ...
  }
*/
export function buildStructuredPayload(commitData, patchData) {
  return {
    // Commit identifier (SHA-1 hash from Git)
    sha: commitData.sha,
    // Main commit message describing the changes
    message: commitData.commit.message,
    // Author who created the commit (may differ from committer)
    author: {
      name: commitData.commit.author.name,
      email: commitData.commit.author.email,
    },
    // Committer who applied the commit (may be different from author)
    committer: {
      name: commitData.commit.committer.name,
      email: commitData.commit.committer.email,
    },
    // When the commit was authored (ISO 8601 format)
    timestamp: commitData.commit.author.date,
    // URL to view the commit on GitHub
    url: commitData.html_url,
    // Array of files changed in this commit with detailed change info
    files:
      commitData.files?.map((f) => ({
        filename: f.filename, // Path to the file
        status: f.status, // "added", "modified", or "removed"
        additions: f.additions, // Number of lines added
        deletions: f.deletions, // Number of lines deleted
        changes: f.changes, // Total changes (additions + deletions)
        patch: f.patch, // Unified diff for this file
      })) || [],
    // Full unified diff of all changes in the commit
    diff: patchData,
    // High-level statistics about all changes in the commit
    stats: {
      total: commitData.files?.length || 0, // Number of files changed
      additions: commitData.stats?.additions || 0, // Total lines added
      deletions: commitData.stats?.deletions || 0, // Total lines deleted
    },
  };
}

/*
  Export both functions for use in controllers and other services.
  
  Usage examples:
  - buildStructuredPayload: Convert GitHub webhook data before sending to AI
  - analyzeCommitWithLLM: Send the structured payload to AI server for analysis
*/
export default {
  analyzeCommitWithLLM,
  buildStructuredPayload,
};
