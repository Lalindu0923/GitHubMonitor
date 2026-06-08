import express from "express";
import crypto from "crypto";
import { handleGitHubPush } from "../controllers/webhookController.js";

const router = express.Router();

/*
  Webhook API quick guide

  Base path: /webhooks (mounted in server.js)

  1) Receive GitHub webhook (production)
     POST /webhooks/github
     Headers: X-Hub-Signature-256 (for verification), X-GitHub-Event (e.g. "push")
     Body: GitHub push event JSON payload
     
     This endpoint ONLY accepts requests from GitHub with valid signatures.

  2) Receive GitHub webhook (development/testing)
     POST /webhooks/github/test
     Body: GitHub push event JSON (no signature required)
     
     Only works when NODE_ENV !== "production"

  3) Health check
     GET /webhooks/health

  Request flow (how webhook is processed):
  Step 1: GitHub sends a push event to POST /webhooks/github with a signature header.
  Example line: POST /webhooks/github with header X-Hub-Signature-256: sha256=...
  
  Step 2: Middleware extracts the signature from X-Hub-Signature-256 header.
  Example line: const signature = req.headers["x-hub-signature-256"]
  
  Step 3: Middleware verifies the signature using GITHUB_WEBHOOK_SECRET.
  Example line: crypto.createHmac("sha256", secret).update(payload).digest("hex")
  
  Step 4: If signature is valid, the request is passed to handleGitHubPush controller.
  Example line: handleGitHubPush(req, res) processes the GitHub event
  
  Step 5: Controller processes the webhook and responds with success or error.
  Example line: res.json({ message: "Webhook processed", event: "push" })
*/

// GitHub webhook signature verification middleware
function verifyGitHubSignature(req, res, next) {
  // Step 2: Extract the signature from the request header.
  const signature =
    req.headers["x-hub-signature-256"] || req.headers["x-hub-signature"];
  // Step 2: Get the secret from environment variables.
  const secret = process.env.GITHUB_WEBHOOK_SECRET;

  if (!secret) {
    console.warn("GITHUB_WEBHOOK_SECRET not set, skipping verification");
    return next();
  }

  // Step 2: Check if signature header exists.
  if (!signature) {
    return res.status(401).json({
      error: "Missing signature header",
      expectedHeaders: ["X-Hub-Signature-256", "X-Hub-Signature"],
    });
  }

  // Step 2: Extract the raw request body (needed for HMAC calculation).
  const payload = req.rawBody || (req.body ? JSON.stringify(req.body) : "");

  if (!payload) {
    console.warn(
      "⚠️ Returning 400 Bad Request: Empty or unparsed request body.",
    );
    return res.status(400).json({
      error:
        "Empty or unparsed request body. Please ensure your GitHub Webhook 'Content type' is set to 'application/json'.",
    });
  }

  // Step 3: Determine the hashing algorithm (sha1 or sha256).
  const algorithm = signature.startsWith("sha1=") ? "sha1" : "sha256";

  // Step 3: Calculate the expected signature using the secret and payload.
  const expected = `${algorithm}=${crypto
    .createHmac(algorithm, secret)
    .update(payload)
    .digest("hex")}`;

  // Step 3: Compare signatures using timing-safe comparison.
  const signatureBuffer = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    // Signature mismatch - request is rejected.
    return res.status(401).json({ error: "Invalid signature" });
  }

  // Step 4: Signature is valid, proceed to the next middleware/handler.
  next();
}

// Route to receive GitHub webhooks
// Step 1+2+3: Verify signature first, then process webhook in handleGitHubPush.
router.post("/github", verifyGitHubSignature, handleGitHubPush);

// Dev-only test route for Postman/local debugging without signature headers
router.post(
  "/github/test",
  (req, res, next) => {
    // Check if running in production mode; if so, reject the test endpoint.
    if (process.env.NODE_ENV === "production") {
      return res
        .status(403)
        .json({ error: "Test route disabled in production" });
    }

    // Skip signature verification for local testing.
    next();
  },
  // Step 4+5: Process the webhook payload.
  handleGitHubPush,
);

// Health check endpoint
// Simple check to verify the webhook service is running.
router.get("/health", (req, res) => {
  res.json({ status: "ok", service: "webhook-receiver" });
});

export default router;
