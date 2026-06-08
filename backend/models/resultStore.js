import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FILE_PATH = path.join(__dirname, "../data/results.json");

// Helper to read results from JSON file
function readResultsFromFile() {
  try {
    if (!fs.existsSync(FILE_PATH)) {
      return [];
    }
    const data = fs.readFileSync(FILE_PATH, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Error reading results file:", error);
    return [];
  }
}

// Helper to write results to JSON file
function writeResultsToFile(results) {
  try {
    const dir = path.dirname(FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(FILE_PATH, JSON.stringify(results, null, 2), "utf8");
  } catch (error) {
    console.error("Error writing results file:", error);
  }
}

export function saveCommitResult(data) {
  const results = readResultsFromFile();
  results.push({
    id: Date.now(),
    data,
  });
  writeResultsToFile(results);
}

export function isAlreadyProcessed(sha) {
  const results = readResultsFromFile();
  return results.some((r) => r.data.sha === sha);
}

export function getCommitResults() {
  const results = readResultsFromFile();
  // Sort results newest first based on the result insertion ID
  return results.sort((a, b) => b.id - a.id);
}

export default {
  saveCommitResult,
  isAlreadyProcessed,
  getCommitResults,
};
