import express from "express";
import { getRepositories, addRepository, deleteRepository } from "../models/repoStore.js";
import { getCommitResults } from "../models/resultStore.js";
import { runDailyCheckJob } from "../jobs/dailyJobs.js";

const router = express.Router();

// 1) Add a repository (accepts username and repoName)
router.post("/add", (req, res) => {
  const { username, repoName } = req.body;

  if (!username || !repoName) {
    return res.status(400).json({ error: "Both username and repoName are required" });
  }

  try {
    const newRepo = addRepository(username, repoName);
    res.json({ message: "Repository added successfully", repository: newRepo });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 2) List all repositories
router.get("/", (req, res) => {
  res.json(getRepositories());
});

// 3) Delete a repository by ID
router.delete("/:id", (req, res) => {
  const { id } = req.params;
  try {
    deleteRepository(id);
    res.json({ message: "Repository deleted successfully" });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

// 4) Get all commit analysis results
router.get("/results", (req, res) => {
  res.json(getCommitResults());
});

// 5) Manually trigger the daily check job immediately
router.post("/trigger", (req, res) => {
  // Run it in the background so the HTTP response is returned immediately
  runDailyCheckJob()
    .then(() => {
      console.log("Manual check job finished successfully.");
    })
    .catch((err) => {
      console.error("Error running manual check job:", err);
    });

  res.status(202).json({ message: "Check triggered. Follow progress on the Live Feed." });
});

export default router;
