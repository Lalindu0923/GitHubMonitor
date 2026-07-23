import axios from "axios";

const GITHUB_API_BASE_URL = "https://api.github.com";

let isGlobalTokenValid = true;

function buildGitHubHeaders(token, accept) {
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(accept ? { Accept: accept } : {}),
    "User-Agent": "GitHubMonitor",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

function getGitHubErrorMessage(error) {
  const status = error.response?.status;
  const message = error.response?.data?.message;
  const details = Array.isArray(error.response?.data?.errors)
    ? JSON.stringify(error.response.data.errors)
    : null;

  if (!status) {
    return error.message;
  }

  return [
    `GitHub API ${status}`,
    message ? `- ${message}` : null,
    details ? `- ${details}` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

function getGitHubToken(customToken = null) {
  if (customToken) return customToken;
  if (isGlobalTokenValid) {
    return process.env.GITHUB_API_TOKEN || process.env.GITHUB_TOKEN || null;
  }
  return null;
}

/*
  Fetches all commits for a repository since midnight today.
*/
export async function fetchCommitsForToday(repoUrl, customToken = null) {
  const [owner, repoName] = repoUrl.split("/").slice(-2);
  const since = new Date();
  since.setHours(0, 0, 0, 0);

  const requestUrl = `${GITHUB_API_BASE_URL}/repos/${owner}/${repoName}/commits`;
  console.log(`[GitHub API] Requesting commits since midnight: ${requestUrl}`);

  const token = getGitHubToken(customToken);

  try {
    const res = await axios.get(requestUrl, {
      headers: buildGitHubHeaders(token),
      params: {
        since: since.toISOString(),
      },
    });
    return res.data;
  } catch (error) {
    // If a global token failed previously, retry without token
    if (error.response?.status === 401) {
      // Case A: request used a global token and it was rejected -> try without token
      if (token && !customToken && isGlobalTokenValid) {
        console.warn(
          `[GitHub API] Global GITHUB_API_TOKEN is invalid (401). Retrying request without token.`,
        );
        isGlobalTokenValid = false;
        const res = await axios.get(requestUrl, {
          headers: buildGitHubHeaders(null),
          params: {
            since: since.toISOString(),
          },
        });
        return res.data;
      }

      // Case B: request used a per-repo custom token that failed -> try the global token (if available)
      if (token && customToken) {
        const globalToken = getGitHubToken(null);
        if (globalToken) {
          console.warn(
            `[GitHub API] Custom repo token invalid (401). Retrying request with global token.`,
          );
          const res = await axios.get(requestUrl, {
            headers: buildGitHubHeaders(globalToken),
            params: {
              since: since.toISOString(),
            },
          });
          return res.data;
        }
      }
    }

    throw new Error(getGitHubErrorMessage(error));
  }
}

/*
  Retrieves detailed information about a specific commit.
*/
export async function getCommitDetails(
  owner,
  repoName,
  sha,
  customToken = null,
) {
  const requestUrl = `${GITHUB_API_BASE_URL}/repos/${owner}/${repoName}/commits/${sha}`;
  console.log(`[GitHub API] Fetching details for SHA ${sha}: ${requestUrl}`);

  const token = getGitHubToken(customToken);

  try {
    const res = await axios.get(requestUrl, {
      headers: buildGitHubHeaders(token),
    });
    return res.data;
  } catch (error) {
    if (error.response?.status === 401) {
      if (token && !customToken && isGlobalTokenValid) {
        console.warn(
          `[GitHub API] Global GITHUB_API_TOKEN is invalid (401). Retrying request without token.`,
        );
        isGlobalTokenValid = false;
        const res = await axios.get(requestUrl, {
          headers: buildGitHubHeaders(null),
        });
        return res.data;
      }

      if (token && customToken) {
        const globalToken = getGitHubToken(null);
        if (globalToken) {
          console.warn(
            `[GitHub API] Custom repo token invalid (401). Retrying request with global token.`,
          );
          const res = await axios.get(requestUrl, {
            headers: buildGitHubHeaders(globalToken),
          });
          return res.data;
        }
      }
    }

    throw new Error(getGitHubErrorMessage(error));
  }
}

/*
  Retrieves the unified diff/patch for a specific commit.
*/
export async function getCommitPatch(owner, repoName, sha, customToken = null) {
  const requestUrl = `${GITHUB_API_BASE_URL}/repos/${owner}/${repoName}/commits/${sha}`;
  console.log(`[GitHub API] Fetching patch/diff for SHA ${sha}: ${requestUrl}`);

  const token = getGitHubToken(customToken);

  try {
    const res = await axios.get(requestUrl, {
      headers: buildGitHubHeaders(token, "application/vnd.github.v3.patch"),
    });
    return res.data;
  } catch (error) {
    if (error.response?.status === 401) {
      if (token && !customToken && isGlobalTokenValid) {
        console.warn(
          `[GitHub API] Global GITHUB_API_TOKEN is invalid (401). Retrying request without token.`,
        );
        isGlobalTokenValid = false;
        const res = await axios.get(requestUrl, {
          headers: buildGitHubHeaders(null, "application/vnd.github.v3.patch"),
        });
        return res.data;
      }

      if (token && customToken) {
        const globalToken = getGitHubToken(null);
        if (globalToken) {
          console.warn(
            `[GitHub API] Custom repo token invalid (401). Retrying request with global token.`,
          );
          const res = await axios.get(requestUrl, {
            headers: buildGitHubHeaders(
              globalToken,
              "application/vnd.github.v3.patch",
            ),
          });
          return res.data;
        }
      }
    }

    throw new Error(getGitHubErrorMessage(error));
  }
}

export default {
  fetchCommitsForToday,
  getCommitDetails,
  getCommitPatch,
};
