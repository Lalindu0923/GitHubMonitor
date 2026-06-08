let result = [];

// Stores commit processing results in memory for this server process only.
// Note: this will reset whenever the server restarts.

export function saveCommitResult(data) {
  // Save each commit with a simple timestamp-based id.
  result.push({
    id: Date.now(),
    data,
  });
}

export function isAlreadyProcessed(sha) {
  // Prevent duplicate work by checking whether the commit SHA already exists.
  return result.some((r) => r.data.sha === sha);
}

// Example usage:
// saveCommitResult({ sha: "abc123", repo: "octocat/hello-world" });
// const processed = isAlreadyProcessed("abc123"); // true

export default {
  saveCommitResult,
  isAlreadyProcessed,
};
