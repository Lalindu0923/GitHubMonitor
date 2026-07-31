import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pool from "../db/database.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FILE_PATH = path.join(__dirname, "../data/repositories.json");
const CSV_PATH = path.join(__dirname, "../../projects_filtered.csv");

// Helper to read repositories from JSON file
function readReposFromFile() {
  try {
    if (!fs.existsSync(FILE_PATH)) {
      return [];
    }
    const data = fs.readFileSync(FILE_PATH, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Error reading repositories file:", error);
    return [];
  }
}

// Helper to write repositories to JSON file
function writeReposToFile(repos) {
  try {
    const dir = path.dirname(FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(FILE_PATH, JSON.stringify(repos, null, 2), "utf8");
  } catch (error) {
    console.error("Error writing repositories file:", error);
  }
}

// Parse repo_name column into username and repoName
function parseRepoName(repoNameStr) {
  if (!repoNameStr) return null;
  let cleanStr = repoNameStr.trim();
  
  if (cleanStr.endsWith(".git")) {
    cleanStr = cleanStr.slice(0, -4);
  }
  
  if (cleanStr.startsWith("http://") || cleanStr.startsWith("https://")) {
    try {
      const url = new URL(cleanStr);
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length >= 2) {
        return {
          username: parts[0],
          repoName: parts[1]
        };
      }
    } catch (e) {
      // url parse failed
    }
  }
  
  const parts = cleanStr.split("/");
  if (parts.length >= 2) {
    return {
      username: parts[0].trim(),
      repoName: parts[1].trim()
    };
  } else if (parts.length === 1 && parts[0].trim()) {
    return {
      username: parts[0].trim(),
      repoName: parts[0].trim()
    };
  }
  
  return null;
}

// Automatically ensure the token column exists in the database
async function initializeSchema() {
  try {
    // Attempt to add 'token' column to repositories table
    await pool.query("ALTER TABLE repositories ADD COLUMN IF NOT EXISTS token VARCHAR(500) DEFAULT NULL");
    console.log("[Database] Verified token column in repositories table.");
  } catch (error) {
    // Fallback if 'IF NOT EXISTS' is not supported in the database MySQL version
    if (error.code === 'ER_PARSE_ERROR' || error.code === 'ER_BAD_FIELD_ERROR' || error.code === 'ER_DUP_FIELDNAME') {
      try {
        await pool.query("ALTER TABLE repositories ADD COLUMN token VARCHAR(500) DEFAULT NULL");
        console.log("[Database] Added token column to repositories table.");
      } catch (err) {
        if (err.errno === 1060 || err.code === 'ER_DUP_FIELDNAME') {
          // Column already exists, ignore
          console.log("[Database] 'token' column already exists in 'repositories' table.");
        } else {
          console.error("[Database] Error adding 'token' column:", err);
        }
      }
    } else {
      console.error("[Database] Error initializing database schema:", error);
    }
  }
}

// Automatic CSV to Database & JSON Sync on server startup
async function importCsvIfPresent() {
  if (!fs.existsSync(CSV_PATH)) {
    console.log("[CSV Import] No projects_filtered.csv found at root. Skipping import.");
    return;
  }

  console.log("[CSV Import] Found projects_filtered.csv. Initiating sync to JSON and Database...");
  try {
    const csvContent = fs.readFileSync(CSV_PATH, "utf8");
    const lines = csvContent.split(/\r?\n/);
    if (lines.length <= 1) return;

    const currentRepos = readReposFromFile();
    let updatedJson = false;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const cols = line.split(",");
      if (cols.length < 2) continue;

      const projectName = cols[0]?.trim();
      const repoNameRaw = cols[1]?.trim();
      const accessToken = cols[2]?.trim() || "";

      const parsed = parseRepoName(repoNameRaw);
      if (!parsed) continue;

      const { username, repoName } = parsed;
      const repoUrl = `https://github.com/${username}/${repoName}`;

      // Check for duplicates in JSON list
      const existsInJson = currentRepos.some(
        (r) =>
          r.username.toLowerCase() === username.toLowerCase() &&
          r.repoName.toLowerCase() === repoName.toLowerCase()
      );

      if (!existsInJson) {
        currentRepos.push({
          id: Date.now() + Math.floor(Math.random() * 10000), // Random offset to prevent ID collision
          username,
          repoName,
          repoUrl,
          token: accessToken || null,
          projectName: projectName || null
        });
        updatedJson = true;
        console.log(`[CSV Import] Added new repo to JSON: ${username}/${repoName}`);
      } else {
        // Update token in JSON if it exists but is different
        const existingIndex = currentRepos.findIndex(
          (r) =>
            r.username.toLowerCase() === username.toLowerCase() &&
            r.repoName.toLowerCase() === repoName.toLowerCase()
        );
        if (existingIndex !== -1 && currentRepos[existingIndex].token !== accessToken) {
          currentRepos[existingIndex].token = accessToken || null;
          updatedJson = true;
          console.log(`[CSV Import] Updated token in JSON for: ${username}/${repoName}`);
        }
      }

      // Check for duplicates in MySQL Database and sync
      try {
        const [rows] = await pool.execute(
          `SELECT * FROM repositories WHERE github_user = ? AND repo_name = ?`,
          [username, repoName]
        );
        if (rows.length === 0) {
          await saveReposToDatabase({
            username,
            repoName,
            repoUrl,
            token: accessToken || null
          });
          console.log(`[CSV Import] Added new repo to DB: ${username}/${repoName}`);
        } else {
          // Update the token in the database if it differs or is missing
          const dbRepo = rows[0];
          if (dbRepo.token !== accessToken) {
            await pool.execute(
              `UPDATE repositories SET token = ? WHERE github_user = ? AND repo_name = ?`,
              [accessToken || null, username, repoName]
            );
            console.log(`[CSV Import] Updated token in DB for: ${username}/${repoName}`);
          }
        }
      } catch (dbErr) {
        console.error(`[CSV Import] Database sync failed for ${username}/${repoName}:`, dbErr.message);
      }
    }

    if (updatedJson) {
      writeReposToFile(currentRepos);
      console.log("[CSV Import] JSON database successfully synchronized with CSV!");
    } else {
      console.log("[CSV Import] JSON file is already up to date with CSV.");
    }
  } catch (error) {
    console.error("[CSV Import] Error during CSV sync:", error);
  }
}

// Run database schema initialization and CSV import on startup
async function init() {
  await initializeSchema();
  await importCsvIfPresent();
}
init().catch((err) => {
  console.error("Failed to initialize database or import CSV:", err);
});

export async function getRepositories() {
  const sql = `SELECT * FROM repositories`;
  try {
    const [rows] = await pool.execute(sql);
    return rows.map((row) => ({
      id: row.id,
      username: row.github_user,
      repoName: row.repo_name,
      repoUrl: row.repo_url,
      token: row.token || null,
      projectName: row.repo_name
    }));
  } catch (error) {
    console.error("Error fetching repositories from database:", error);
    // Fallback to local JSON file if database is down/fails
    const fileRepos = readReposFromFile();
    return fileRepos;
  }
}
// Helper to write/update repository in the CSV file
function saveOrUpdateRepoInCsv(username, repoName, token, projectName = null) {
  try {
    if (!fs.existsSync(CSV_PATH)) {
      const header = "project_name,repo_name,repo_access_token\n";
      fs.writeFileSync(CSV_PATH, header, "utf8");
    }

    const csvContent = fs.readFileSync(CSV_PATH, "utf8");
    const lines = csvContent.split(/\r?\n/);
    const updatedLines = [];
    let found = false;

    if (lines.length > 0) {
      updatedLines.push(lines[0]); // Header row
    }

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const cols = line.split(",");
      const rowRepoNameRaw = cols[1]?.trim();

      const parsed = parseRepoName(rowRepoNameRaw);
      if (parsed &&
          parsed.username.toLowerCase() === username.toLowerCase() &&
          parsed.repoName.toLowerCase() === repoName.toLowerCase()) {
        cols[2] = token || "";
        updatedLines.push(cols.join(","));
        found = true;
        console.log(`[CSV Sync] Updated token for ${username}/${repoName} in CSV.`);
      } else {
        updatedLines.push(line);
      }
    }

    if (!found) {
      const newProjName = projectName || repoName;
      const newRepoName = `${username}/${repoName}`;
      const newRow = `${newProjName},${newRepoName},${token || ""}`;
      updatedLines.push(newRow);
      console.log(`[CSV Sync] Added new repo ${username}/${repoName} to CSV.`);
    }

    fs.writeFileSync(CSV_PATH, updatedLines.join("\n") + "\n", "utf8");
  } catch (error) {
    console.error("Error writing to CSV:", error);
  }
}

// Helper to delete a repository from the CSV file
function deleteRepoFromCsv(username, repoName) {
  try {
    if (!fs.existsSync(CSV_PATH)) return;

    const csvContent = fs.readFileSync(CSV_PATH, "utf8");
    const lines = csvContent.split(/\r?\n/);
    const updatedLines = [];

    if (lines.length > 0) {
      updatedLines.push(lines[0]); // Header row
    }

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const cols = line.split(",");
      const rowRepoNameRaw = cols[1]?.trim();

      const parsed = parseRepoName(rowRepoNameRaw);
      if (parsed &&
          parsed.username.toLowerCase() === username.toLowerCase() &&
          parsed.repoName.toLowerCase() === repoName.toLowerCase()) {
        console.log(`[CSV Sync] Removed ${username}/${repoName} from CSV.`);
      } else {
        updatedLines.push(line);
      }
    }

    fs.writeFileSync(CSV_PATH, updatedLines.join("\n") + "\n", "utf8");
  } catch (error) {
    console.error("Error deleting from CSV:", error);
  }
}

export async function addRepository(username, repoName, token = null) {
  const cleanUsername = username.trim();
  const cleanRepoName = repoName.trim();
  const repoUrl = `https://github.com/${cleanUsername}/${cleanRepoName}`;

  // Check duplicate in Database; if exists, update token instead of throwing error
  const exists = await getReposFromDatabaase(cleanUsername, cleanRepoName);
  if (exists) {
    // Update the token in MySQL Database
    await pool.execute(
      `UPDATE repositories SET token = ? WHERE github_user = ? AND repo_name = ?`,
      [token || null, cleanUsername, cleanRepoName]
    );

    // Sync with JSON file
    const repos = readReposFromFile();
    const existingIndex = repos.findIndex(
      (r) =>
        r.username.toLowerCase() === cleanUsername.toLowerCase() &&
        r.repoName.toLowerCase() === cleanRepoName.toLowerCase()
    );
    let projectName = null;
    if (existingIndex !== -1) {
      repos[existingIndex].token = token || null;
      projectName = repos[existingIndex].projectName;
      writeReposToFile(repos);
    }

    // Sync with CSV
    saveOrUpdateRepoInCsv(cleanUsername, cleanRepoName, token, projectName);

    // Fallback if JSON file didn't have it but DB did
    const [rows] = await pool.execute(
      `SELECT * FROM repositories WHERE github_user = ? AND repo_name = ?`,
      [cleanUsername, cleanRepoName]
    );
    return {
      id: rows[0]?.id || Date.now(),
      username: cleanUsername,
      repoName: cleanRepoName,
      repoUrl,
      token
    };
  }

  const newRepo = {
    username: cleanUsername,
    repoName: cleanRepoName,
    repoUrl,
    token
  };

  // Insert into database and obtain the auto-increment ID
  const dbResult = await saveReposToDatabase(newRepo);
  newRepo.id = dbResult.insertId;

  // Sync with JSON file
  const repos = readReposFromFile();
  repos.push({
    id: newRepo.id,
    username: newRepo.username,
    repoName: newRepo.repoName,
    repoUrl: newRepo.repoUrl,
    token: newRepo.token
  });
  writeReposToFile(repos);

  // Sync with CSV
  saveOrUpdateRepoInCsv(cleanUsername, cleanRepoName, token, cleanRepoName);

  return newRepo;
}

export async function deleteRepository(id) {
  const numericId = Number(id);

  // Find username and repoName from DB first (so we can remove it from JSON too)
  const [rows] = await pool.execute(`SELECT github_user, repo_name FROM repositories WHERE id = ?`, [numericId]);
  if (rows.length === 0) {
    throw new Error(`Repository with ID ${id} not found.`);
  }
  const { github_user, repo_name } = rows[0];

  // Delete from DB
  await pool.execute(`DELETE FROM repositories WHERE id = ?`, [numericId]);

  // Sync with JSON
  const repos = readReposFromFile();
  const updatedRepos = repos.filter(
    (r) => !(r.username.toLowerCase() === github_user.toLowerCase() && r.repoName.toLowerCase() === repo_name.toLowerCase())
  );
  writeReposToFile(updatedRepos);

  // Sync with CSV
  deleteRepoFromCsv(github_user, repo_name);

  return true;
}

export async function saveReposToDatabase(repo) {
  const sql = `INSERT INTO repositories (github_user, repo_name, repo_url, token) VALUES (?, ?, ?, ?)`;
  const values = [repo.username, repo.repoName, repo.repoUrl, repo.token || null];

  try {
    const [result] = await pool.execute(sql, values);
    return result;
  } catch (error) {
    console.error("Error saving repository to database:", error);
    throw error;
  }
}

export async function getReposFromDatabaase(username, repoName) {
  const sql = `SELECT * FROM repositories WHERE github_user = ? AND repo_name = ?`;

  const [rows] = await pool.execute(sql, [username, repoName]);

  return rows.length > 0;
}

export default {
  getRepositories,
  addRepository,
  deleteRepository,
  saveReposToDatabase,
  getReposFromDatabaase
};

