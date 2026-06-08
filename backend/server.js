import "dotenv/config";
import express from "express";
import cors from "cors";
import repoRoutes from "./routes/repoRoutes.js";
import webhookRoutes from "./routes/webhookRoutes.js";
import streamRoutes from "./routes/streamRoutes.js";
import "./jobs/dailyJobs.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// Debug logging for all requests (BEFORE body parsing)
app.use((req, res, next) => {
  if (req.path.startsWith("/webhooks")) {
    console.log("\n\n=======================================================");
    console.log("--- INCOMING WEBHOOK ---");
    console.log("Path:", req.path);
    console.log(
      "Headers:",
      req.headers["content-type"],
      req.headers["x-github-event"],
    );
  }
  next();
});

// Middleware: JSON parsing with rawBody preservation for webhook signature verification
app.use(
  express.json({
    limit: "50mb",
    verify: (req, res, buf) => {
      req.rawBody = buf.toString();
    },
  }),
);

// Middleware: URL-encoded parsing (GitHub's default) with rawBody preservation
app.use(
  express.urlencoded({
    limit: "50mb",
    extended: true,
    verify: (req, res, buf) => {
      req.rawBody = buf.toString();
    },
  }),
);

// Error handler for JSON parsing errors
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    console.error("JSON Parsing Error:", err.message);
    return res.status(400).json({ error: "Invalid JSON format" });
  }
  next();
});

// Middleware to normalize GitHub's urlencoded payload into standard JSON
app.use("/webhooks", (req, res, next) => {
  console.log("RawBody exists:", !!req.rawBody);
  if (
    req.headers["content-type"] === "application/x-www-form-urlencoded" &&
    req.body &&
    req.body.payload
  ) {
    try {
      // GitHub sends the JSON as a string inside the 'payload' field
      req.body = JSON.parse(req.body.payload);
    } catch (e) {
      console.error("Failed to parse form-urlencoded payload");
    }
  }
  next();
});

// Routes
app.use("/webhooks", webhookRoutes);
app.use("/repos", repoRoutes);
app.use("/stream", streamRoutes);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "github-monitor-backend" });
});

// Test webhook endpoint (for quick verification)
app.post("/webhook", (req, res) => {
  console.log("GitHub event received 🚀");
  console.log("Payload:", JSON.stringify(req.body, null, 2));
  res.sendStatus(200);
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
