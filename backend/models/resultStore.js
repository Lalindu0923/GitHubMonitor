import pool from "../db/database.js";

function formatList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean).map((item) => String(item).trim()).filter(Boolean);
  return [String(value).trim()].filter(Boolean);
}

function formatChangedFiles(files) {
  if (!Array.isArray(files) || files.length === 0) {
    return ["- No changed files were provided."];
  }

  return files.map((file) => {
    const additions = Number.isFinite(file.additions) ? file.additions : 0;
    const deletions = Number.isFinite(file.deletions) ? file.deletions : 0;
    const header = `- ${file.filename || "unknown file"} (+${additions} / -${deletions})`;
    const patch = file.patch ? `  Patch: ${file.patch}` : null;
    return patch ? `${header}\n${patch}` : header;
  });
}

function buildAuditReport(data) {
  const result = data.result || {};
  const raw = result.raw_llm_output || {};
  const score = result.score ?? raw.score ?? 0;
  const verdict = result.result ?? result.verdict ?? raw.verdict ?? "unknown";
  const summary = result.ai_review ?? raw.summary ?? "No summary provided.";
  const strengths = formatList(raw.strengths);
  const risks = formatList(raw.risks);
  const suggestions = formatList(raw.suggestions);
  const files = Array.isArray(data.files) ? data.files : [];

  const lines = [
    `AI Code Quality Score: ${score} / 100`,
    `Audit Verdict: ${verdict}`,
    "",
    "AI Summary Analysis",
    summary,
    "",
    "Detailed Audit Report",
  ];

  if (strengths.length > 0) {
    lines.push("", "Code Strengths & Best Practices", ...strengths.map((item) => `- ${item}`));
  }

  if (risks.length > 0) {
    lines.push("", "Code Risks & Concerns", ...risks.map((item) => `- ${item}`));
  }

  if (suggestions.length > 0) {
    lines.push("", "AI Refactoring Suggestions", ...suggestions.map((item) => `- ${item}`));
  }

  lines.push("", "Changed Files", ...formatChangedFiles(files));

  return lines.join("\n");
}

// Ensure table schema has raw_llm_output and files columns
async function ensureSchema() {
  try {
    const [columns] = await pool.query("SHOW COLUMNS FROM analysis_results");
    const columnNames = columns.map((c) => c.Field || c.field || "");
    
    const lowerColumnNames = columnNames.map(name => name.toLowerCase());

    if (!lowerColumnNames.includes("raw_llm_output")) {
      console.log("[DB Setup] Adding raw_llm_output column to analysis_results...");
      await pool.query("ALTER TABLE analysis_results ADD COLUMN raw_llm_output LONGTEXT NULL");
    }
    
    if (!lowerColumnNames.includes("files")) {
      console.log("[DB Setup] Adding files column to analysis_results...");
      await pool.query("ALTER TABLE analysis_results ADD COLUMN files LONGTEXT NULL");
    }
  } catch (error) {
    console.error("Error verifying/updating database schema:", error);
  }
}

// Trigger check in background
ensureSchema();

export async function saveCommitResult(data) {
  const id = Date.now();
  const repository = data.repository;
  const commit_sha = data.sha;
  const score = data.result?.score ?? 0;
  const verdict = data.result?.result ?? 'unknown';
  const files_changed = data.result?.files_changed ?? data.files?.length ?? 0;
  const additions = data.result?.additions ?? 0;
  const deletions = data.result?.deletions ?? 0;
  
  // Format ai_review as a readable report that includes the changed files list.
  const ai_review = buildAuditReport(data);
  
  const provider = data.result?.provider ?? null;
  const model = data.result?.model ?? null;
  const analyzed_at = data.timestamp ? new Date(data.timestamp) : new Date();
  
  // Store entire raw_llm_output and files as serialized JSON strings
  const raw_llm_output = data.result?.raw_llm_output ? JSON.stringify(data.result.raw_llm_output) : null;
  const files = data.files ? JSON.stringify(data.files) : null;
  
  const sql = `
    INSERT INTO analysis_results (
      id, repository, commit_sha, score, verdict, files_changed,
      additions, deletions, ai_review, provider, model, analyzed_at,
      raw_llm_output, files
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  
  const values = [
    id, repository, commit_sha, score, verdict, files_changed,
    additions, deletions, ai_review, provider, model, analyzed_at,
    raw_llm_output, files
  ];
  
  try {
    await pool.execute(sql, values);
    console.log(`[DB] Successfully saved analysis result for commit ${commit_sha}`);
  } catch (error) {
    console.error("Error saving commit result to database:", error);
    throw error;
  }
}

export async function isAlreadyProcessed(sha) {
  try {
    const sql = `SELECT id FROM analysis_results WHERE commit_sha = ? LIMIT 1`;
    const [rows] = await pool.execute(sql, [sha]);
    return rows.length > 0;
  } catch (error) {
    console.error("Error checking processed commits in database:", error);
    return false;
  }
}

export async function getCommitResults() {
  try {
    const sql = `SELECT * FROM analysis_results ORDER BY id DESC`;
    const [rows] = await pool.execute(sql);
    
    return rows.map((row) => {
      let parsedRawLlmOutput = null;
      if (row.raw_llm_output) {
        try {
          parsedRawLlmOutput = JSON.parse(row.raw_llm_output);
        } catch (e) {
          console.error("Error parsing raw_llm_output JSON:", e);
        }
      }
      
      let parsedFiles = [];
      if (row.files) {
        try {
          parsedFiles = JSON.parse(row.files);
        } catch (e) {
          console.error("Error parsing files JSON:", e);
        }
      }

      const reportData = {
        repository: row.repository,
        sha: row.commit_sha,
        result: {
          score: row.score,
          result: row.verdict,
          ai_review: row.ai_review,
          raw_llm_output: parsedRawLlmOutput,
        },
        files: parsedFiles,
      };
      
      return {
        id: Number(row.id),
        data: {
          sha: row.commit_sha,
          repository: row.repository,
          result: {
            score: row.score,
            result: row.verdict,
            files_changed: row.files_changed,
            additions: row.additions,
            deletions: row.deletions,
            ai_review: buildAuditReport(reportData),
            provider: row.provider,
            model: row.model,
            raw_llm_output: parsedRawLlmOutput
          },
          timestamp: row.analyzed_at instanceof Date ? row.analyzed_at.toISOString() : row.analyzed_at,
          files: parsedFiles
        }
      };
    });
  } catch (error) {
    console.error("Error fetching commit results from database:", error);
    return [];
  }
}

export default {
  saveCommitResult,
  isAlreadyProcessed,
  getCommitResults,
};
