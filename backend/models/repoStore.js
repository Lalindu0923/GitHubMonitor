import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

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

// Automatic CSV to JSON Import on server startup
function importCsvIfPresent() {
  if (!fs.existsSync(CSV_PATH)) {
    console.log("[CSV Import] No projects_filtered.csv found at root. Skipping import.");
    return;
  }

  console.log("[CSV Import] Found projects_filtered.csv. Initiating sync to JSON...");
  try {
    const csvContent = fs.readFileSync(CSV_PATH, "utf8");
    const lines = csvContent.split(/\r?\n/);
    if (lines.length <= 1) return;

    const currentRepos = readReposFromFile();
    let updated = false;

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

      // Check for duplicates
      const exists = currentRepos.some(
        (r) =>
          r.username.toLowerCase() === username.toLowerCase() &&
          r.repoName.toLowerCase() === repoName.toLowerCase()
      );

      if (!exists) {
        currentRepos.push({
          id: Date.now() + Math.floor(Math.random() * 10000), // Random offset to prevent ID collision
          username,
          repoName,
          repoUrl,
          token: accessToken || null,
          projectName: projectName || null
        });
        updated = true;
        console.log(`[CSV Import] Added new repo: ${username}/${repoName}`);
      }
    }

    if (updated) {
      writeReposToFile(currentRepos);
      console.log("[CSV Import] JSON database successfully synchronized with CSV!");
    } else {
      console.log("[CSV Import] No new repositories found in CSV.");
    }
  } catch (error) {
    console.error("[CSV Import] Error during CSV sync:", error);
  }
}

// Run the CSV import check immediately on module load
importCsvIfPresent();

export function getRepositories() {
  return readReposFromFile();
}

export function addRepository(username, repoName) {
  const repos = readReposFromFile();
  
  const cleanUsername = username.trim();
  const cleanRepoName = repoName.trim();
  const repoUrl = `https://github.com/${cleanUsername}/${cleanRepoName}`;

  const exists = repos.some(
    (r) =>
      r.username.toLowerCase() === cleanUsername.toLowerCase() &&
      r.repoName.toLowerCase() === cleanRepoName.toLowerCase()
  );

  if (exists) {
    throw new Error("Repository already exists in the tracking list.");
  }

  const newRepo = {
    id: Date.now(),
    username: cleanUsername,
    repoName: cleanRepoName,
    repoUrl,
    token: null
  };

  repos.push(newRepo);
  writeReposToFile(repos);
  return newRepo;
}

export function deleteRepository(id) {
  const repos = readReposFromFile();
  const numericId = Number(id);
  const updatedRepos = repos.filter((r) => r.id !== numericId);
  
  if (repos.length === updatedRepos.length) {
    throw new Error(`Repository with ID ${id} not found.`);
  }

  writeReposToFile(updatedRepos);
  return true;
}

export default {
  getRepositories,
  addRepository,
  deleteRepository,
};
