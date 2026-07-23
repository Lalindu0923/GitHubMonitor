import "dotenv/config";
import axios from "axios";

async function main() {
  const token = process.env.GITHUB_TOKEN || process.env.GITHUB_API_TOKEN;

  if (!token) {
    console.error("No GitHub token found in GITHUB_TOKEN or GITHUB_API_TOKEN.");
    process.exitCode = 1;
    return;
  }

  console.log(
    `Using GitHub token from environment (${token.length} characters).`,
  );

  try {
    const response = await axios.get("https://api.github.com/rate_limit", {
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": "GitHubMonitor",
      },
    });

    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error("Status:", error.response?.status);
    console.error("Data:", error.response?.data);
    console.error("Headers:", error.response?.headers);
    console.error("Message:", error.message);
    process.exitCode = 1;
  }
}

main();
