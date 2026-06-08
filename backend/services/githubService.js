/*
  GitHub Service Module
  
  Purpose: Interface with GitHub API to fetch commit data.
  
  This service:
  1. Fetches all commits made to a repository since midnight (today)
  2. Retrieves detailed information about a specific commit
  3. Retrieves the unified diff/patch for a specific commit
  
  Authentication:
  - Uses GitHub Personal Access Token from GITHUB_API_TOKEN env var
  - Token must have repo read permissions
  
  Example workflow:
  fetchCommitsForToday() -> getCommitDetails() -> getCommitPatch() -> analysis
*/

import axios from "axios";

// GitHub's REST API base URL
const GITHUB_API_BASE_URL = "https://api.github.com";

/*
  Fetches all commits for a repository since midnight today.
  
  Purpose:
  - Get all commits made to a repo within the current day
  - Used by daily jobs to analyze today's activity
  
  Parameters:
  - repoUrl: Full repository URL (e.g., "https://github.com/octocat/hello-world")
  
  Returns:
  - Array of commit objects from GitHub API with basic info:
    { sha, commit: { message, author, committer }, html_url, ... }
  
  Example:
  const commits = await fetchCommitsForToday("https://github.com/octocat/hello-world");
  // Returns: [{ sha: "abc123", commit: {...}, ... }, ...]
  
  Flow:
  1. Extract owner and repo name from the URL
  2. Calculate timestamp for midnight today (start of day)
  3. Query GitHub API for commits since that time
  4. Return the list of commits
*/
export async function fetchCommitsForToday(repoUrl) {
  // Step 1: Extract owner and repo name from URL
  // Input: "https://github.com/octocat/hello-world"
  // Output: owner = "octocat", repoName = "hello-world"
  const [owner, repoName] = repoUrl.split("/").slice(-2);

  // Step 2: Calculate midnight of today (start of current day)
  const since = new Date();
  since.setHours(0, 0, 0, 0);

  // Step 3: Query GitHub API for commits since midnight
  const requestUrl = `${GITHUB_API_BASE_URL}/repos/${owner}/${repoName}/commits`;
  console.log(`[GitHub API] Requesting commits since midnight: ${requestUrl}`);
  const res = await axios.get(
    requestUrl,
    {
      headers: {
        // Authenticate using Personal Access Token
        Authorization: `Bearer ${process.env.GITHUB_API_TOKEN}`,
      },
      params: {
        // Filter commits to only those since midnight today
        since: since.toISOString(),
      },
    },
  );

  // Step 4: Return the commit data from GitHub
  return res.data;
}

/*
  Retrieves detailed information about a specific commit.
  
  Purpose:
  - Get full commit details including all files changed, stats, and metadata
  - More comprehensive than fetchCommitsForToday results
  
  Parameters:
  - owner: Repository owner (e.g., "octocat")
  - repoName: Repository name (e.g., "hello-world")
  - sha: Commit SHA-1 hash (e.g., "abc123def456")
  
  Returns:
  - Full commit object with:
    { sha, commit, files: [...], stats: {...}, html_url, ... }
  
  Example:
  const details = await getCommitDetails("octocat", "hello-world", "abc123");
  // Returns: { sha: "abc123", files: [{filename, status, additions, deletions, patch}], stats: {...} }
  
  Flow:
  1. Build API URL with owner, repo, and commit SHA
  2. Send GET request with authentication
  3. Return detailed commit data
*/
export async function getCommitDetails(owner, repoName, sha) {
  // Query GitHub API for the specific commit
  const requestUrl = `${GITHUB_API_BASE_URL}/repos/${owner}/${repoName}/commits/${sha}`;
  console.log(`[GitHub API] Fetching details for SHA ${sha}: ${requestUrl}`);
  const res = await axios.get(
    requestUrl,
    {
      headers: {
        // Authenticate using Personal Access Token
        Authorization: `Bearer ${process.env.GITHUB_API_TOKEN}`,
      },
    },
  );

  // Return full commit details (includes file changes and stats)
  return res.data;
}

/*
  Retrieves the unified diff/patch for a specific commit.
  
  Purpose:
  - Get the complete diff showing all line-by-line changes
  - Used to provide context and detailed diffs to AI analyzer
  
  Parameters:
  - owner: Repository owner (e.g., "octocat")
  - repoName: Repository name (e.g., "hello-world")
  - sha: Commit SHA-1 hash (e.g., "abc123def456")
  
  Returns:
  - Unified diff format string (same as git diff or patch)
    Shows all changes with context lines (@@, +, -, etc.)
  
  Example:
  const patch = await getCommitPatch("octocat", "hello-world", "abc123");
  // Returns:
  // diff --git a/file.js b/file.js
  // @@ -10,5 +10,6 @@
  //  old line
  // -removed line
  // +added line
  //  context line
  
  Flow:
  1. Build API URL with owner, repo, and commit SHA
  2. Send GET request with special Accept header (application/vnd.github.v3.patch)
  3. Return raw patch data
*/
export async function getCommitPatch(owner, repoName, sha) {
  // Query GitHub API for the commit patch
  const requestUrl = `${GITHUB_API_BASE_URL}/repos/${owner}/${repoName}/commits/${sha}`;
  console.log(`[GitHub API] Fetching patch/diff for SHA ${sha}: ${requestUrl}`);
  const res = await axios.get(
    requestUrl,
    {
      headers: {
        // Authenticate using Personal Access Token
        Authorization: `Bearer ${process.env.GITHUB_API_TOKEN}`,
        // Special GitHub Accept header to get response as unified diff/patch format
        Accept: "application/vnd.github.v3.patch",
      },
    },
  );

  // Return raw patch data as a string
  return res.data;
}

/*
  Export all functions for use in controllers and jobs.
  
  Typical usage flow:
  1. fetchCommitsForToday(repoUrl) - Get list of today's commits
  2. For each commit SHA:
     - getCommitDetails(owner, repo, sha) - Get full details with file changes
     - getCommitPatch(owner, repo, sha) - Get the unified diff
  3. Pass both to AI service for analysis
  
  Example in controller:
  const commits = await fetchCommitsForToday(repoUrl);
  for (const commit of commits) {
    const details = await getCommitDetails(owner, repo, commit.sha);
    const patch = await getCommitPatch(owner, repo, commit.sha);
    // Send to AI for analysis
  }
*/
export default {
  fetchCommitsForToday,
  getCommitDetails,
  getCommitPatch,
};
