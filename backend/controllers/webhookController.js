import { getCommitDetails, getCommitPatch } from "../services/githubService.js";
import {
  analyzeCommitWithLLM,
  buildStructuredPayload,
} from "../services/aiService.js";
import { saveCommitResult, isAlreadyProcessed } from "../models/resultStore.js";
import { logEmitter } from "../utils/logger.js";

export async function handleGitHubPush(req, res) {
  try {
    const payload = req.body;
    const githubEvent = req.headers["x-github-event"];

    if (githubEvent === "ping") {
      return res.json({ message: "Webhook ping received" });
    }

    if (githubEvent && githubEvent !== "push") {
      logEmitter.log(`🚫 Ignored '${githubEvent}' event.`);
      return res.status(202).json({
        message: `Ignored ${githubEvent} event`,
      });
    }

    // Validate push payload
    if (!payload?.repository?.full_name) {
      logEmitter.error(
        "⚠️ Returning 400 Bad Request: Invalid push payload (missing repository.full_name).",
      );
      return res.status(400).json({
        error: "Invalid push payload: missing repository.full_name",
      });
    }

    const repo = payload.repository;
    const commits = Array.isArray(payload.commits) ? payload.commits : [];
    const repoFullName = repo.full_name; // "owner/repo"
    const [owner, repoName] = repoFullName.split("/");

    if (!commits.length) {
      return res.json({ message: "No commits to process" });
    }

    // Immediately respond to GitHub/Ngrok
    res.status(202).json({
      message: "Webhook accepted, processing commits in background...",
      repository: repoFullName,
      commitsReceived: commits.length,
    });

    // Process commits in the background
    (async () => {
      try {
        const results = [];

        for (const commit of commits) {
          const sha = commit.id;

          // Skip if already processed
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

            results.push({
              sha: sha.substring(0, 7),
              status: "processed",
              aiResult,
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
              error.message,
            );
            results.push({
              sha: sha.substring(0, 7),
              status: "error",
              error: error.message,
            });
          }
        }

        logEmitter.log(
          `Background processing complete for ${repoFullName} (${results.length} commits)`,
        );
        logEmitter.log(`--------------------------------------------------`);
      } catch (err) {
        logEmitter.error("Unhandled background processing error:", err);
      }
    })();
  } catch (error) {
    logEmitter.error("Webhook error:", error);
    res.status(500).json({ error: error.message });
  }
}
