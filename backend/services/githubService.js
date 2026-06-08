import axios from "axios";

const GITHUB_API_BASE_URL = "https://api.github.com";

/*
  Fetches all commits for a repository since midnight today.
*/
export async function fetchCommitsForToday(repoUrl, customToken = null) {
  const [owner, repoName] = repoUrl.split("/").slice(-2);
  const since = new Date();
  since.setHours(0, 0, 0, 0);

  const requestUrl = `${GITHUB_API_BASE_URL}/repos/${owner}/${repoName}/commits`;
  console.log(`[GitHub API] Requesting commits since midnight: ${requestUrl}`);
  
  const token = customToken || process.env.GITHUB_API_TOKEN;

  const res = await axios.get(
    requestUrl,
    {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      params: {
        since: since.toISOString(),
      },
    },
  );

  return res.data;
}

/*
  Retrieves detailed information about a specific commit.
*/
export async function getCommitDetails(owner, repoName, sha, customToken = null) {
  const requestUrl = `${GITHUB_API_BASE_URL}/repos/${owner}/${repoName}/commits/${sha}`;
  console.log(`[GitHub API] Fetching details for SHA ${sha}: ${requestUrl}`);
  
  const token = customToken || process.env.GITHUB_API_TOKEN;

  const res = await axios.get(
    requestUrl,
    {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    },
  );

  return res.data;
}

/*
  Retrieves the unified diff/patch for a specific commit.
*/
export async function getCommitPatch(owner, repoName, sha, customToken = null) {
  const requestUrl = `${GITHUB_API_BASE_URL}/repos/${owner}/${repoName}/commits/${sha}`;
  console.log(`[GitHub API] Fetching patch/diff for SHA ${sha}: ${requestUrl}`);
  
  const token = customToken || process.env.GITHUB_API_TOKEN;

  const res = await axios.get(
    requestUrl,
    {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        Accept: "application/vnd.github.v3.patch",
      },
    },
  );

  return res.data;
}

export default {
  fetchCommitsForToday,
  getCommitDetails,
  getCommitPatch,
};
