import express from "express";
import { logEmitter } from "../utils/logger.js";

const router = express.Router();

router.get("/logs", (req, res) => {
  // Setup headers for SSE
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
  });

  // Tell the client we connected
  res.write(`data: ${JSON.stringify({ message: "Connected to log stream", level: "info" })}\n\n`);

  // Define listener function
  const logListener = (logEntry) => {
    res.write(`data: ${JSON.stringify(logEntry)}\n\n`);
  };

  // Attach listener to logEmitter
  logEmitter.on("log", logListener);

  // Clean up when client disconnects
  req.on("close", () => {
    logEmitter.off("log", logListener);
  });
});

export default router;
