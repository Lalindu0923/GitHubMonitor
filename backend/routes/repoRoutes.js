import express from "express";
import { getRepositories, addRepository } from "../models/repoStore.js";

const router = express.Router();

/*
  Repo API quick guide

  Base path: /repos (mounted in server.js)

  1) Add a repository
     POST /repos/add
     Body: { "repoUrl": "https://github.com/owner/repo" }

     Example (curl):
     curl -X POST http://localhost:3000/repos/add \
       -H "Content-Type: application/json" \
       -d "{\"repoUrl\":\"https://github.com/octocat/hello-world\"}"

  2) List all repositories
     GET /repos

     Example (curl):
     curl http://localhost:3000/repos

  Request flow (how request comes in):
  Step 1: Client sends HTTP request to the backend.
  Example line: POST /repos/add HTTP/1.1
  Step 2: Express matches the route under /repos.
  Example line: app.use("/repos", repoRoutes) -> router.post("/add", ...)
  Step 3: Handler validates/parses req.body or req params.
  Example line: const { repoUrl } = req.body
  Step 4: Handler calls repoStore methods (addRepository/getRepositories).
  Example line: addRepository("https://github.com/octocat/hello-world")
  Step 5: Handler sends JSON response back to the client.
  Example line: res.json({ message: "Repository added successfully" })
*/

router.post("/add", (req, res) => {
  // Step 3: Read body sent by client.
  const { repoUrl } = req.body;

  // Step 3: Validate required input.
  if (!repoUrl) return res.status(400).json({ error: "repoUrl is required" });

  // Step 4: Save repository in the in-memory store.
  addRepository(repoUrl);

  // Step 5: Return success response.
  res.json({ message: "Repository added successfully" });
});

router.get("/", (req, res) => {
  // Step 4 + 5: Read all repositories and return them as JSON.
  res.json(getRepositories());
});

export default router;
