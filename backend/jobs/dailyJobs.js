import cron from "node-cron";
import { getRepositories } from "../models/repoStore.js";
import {
  fetchCommitsForToday,
  getCommitDetails,
  getCommitPatch,
} from "../services/githubService.js";
import {
  analyzeCommitWithLLM,
  buildStructuredPayload,
} from "../services/aiService.js";
import {
  saveCommitResult,
  isAlreadyProcessed,
} from "../models/resultStore.js";
import { logEmitter } from "../utils/logger.js";

// Schedule a job to run every day at 23:00 (11:00 PM)
// The cron expression "0 23 * * *" means: At minute 0 past hour 23.
// You can adjust this to any specific time you need (e.g., "0 18 * * *" for 6:00 PM).
cron.schedule("0 23 * * *", async () => {
  logEmitter.log("⏰ Running daily scheduled job to fetch commits...");
  const repos = getRepositories();

  if (repos.length === 0) {
    logEmitter.log("No repositories configured for daily check.");
    return;
  }

  for (const repo of repos) {
    const repoUrl = repo.repoUrl;
    try {
      const [owner, repoName] = repoUrl.split("/").slice(-2);
      const repoFullName = `${owner}/${repoName}`;
      logEmitter.log(`Fetching today's commits for ${repoFullName}...`);

      const commits = await fetchCommitsForToday(repoUrl);

      if (!commits || commits.length === 0) {
        logEmitter.log(`No commits found today for ${repoFullName}.`);
        continue;
      }

      logEmitter.log(
        `Found ${commits.length} commits for ${repoFullName}. Processing...`
      );

      for (const commitObj of commits) {
        const sha = commitObj.sha;

        // Skip if already processed (e.g. by a webhook or previous run)
        if (isAlreadyProcessed(sha)) {
          logEmitter.log(`Commit ${sha} already processed, skipping.`);
          continue;
        }

        try {
          logEmitter.log(`Processing commit ${sha} from ${repoFullName}`);

          // Fetch full commit details and patch
          const commitDetails = await getCommitDetails(owner, repoName, sha);
          const commitPatch = await getCommitPatch(owner, repoName, sha);

          // Build structured payload for AI server
          const payload = buildStructuredPayload(commitDetails, commitPatch);

          // Send to AI server for analysis
          const aiResult = await analyzeCommitWithLLM(payload);

          // Save result
          saveCommitResult({
            sha,
            repository: repoFullName,
            result: aiResult,
            timestamp: new Date(),
          });

          logEmitter.success(`✓ Commit ${sha} analyzed successfully`);
          logEmitter.log(`  -> LLM Score: ${aiResult.score}`);
          logEmitter.log(`  -> Verdict: ${aiResult.result}`);
          if (aiResult.ai_review) {
            logEmitter.log(`  -> Review: ${aiResult.ai_review}`);
          }

          if (aiResult.changed_files_data) {
            logEmitter.log(`Received file changes data for commit ${sha}`, {
              changedFiles: aiResult.changed_files_data,
            });
          }
        } catch (error) {
          logEmitter.error(
            `✗ Error processing commit ${sha}:`,
            error.message
          );
        }
      }
      logEmitter.log(`Finished daily processing for ${repoFullName}`);
      logEmitter.log(`--------------------------------------------------`);
    } catch (error) {
      logEmitter.error(`Error fetching commits for ${repoUrl}:`, error.message);
    }
  }
  logEmitter.log("✅ Daily scheduled job complete.");
});
