# GitHub Monitor Backend

Node.js Express backend that receives GitHub webhooks, fetches commit details/patches, and sends structured payloads to a Python AI server for analysis.

## Features

✅ **GitHub Webhook Receiver** — Listens for `push` events from GitHub  
✅ **Webhook Signature Verification** — Validates GitHub signatures using HMAC-SHA256  
✅ **Commit Extraction** — Parses commits from webhook payload  
✅ **GitHub API Integration** — Fetches commit details and unified diffs  
✅ **Structured Payload** — Builds rich JSON payload with commit metadata, files, and patches  
✅ **AI Analysis** — Sends payload to Python AI server for LLM analysis  
✅ **Result Storage** — Stores analysis results with deduplication  
✅ **Daily Job** — Optional scheduled job to fetch recent commits  

## Setup

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Create `.env` File

Copy `.env.example` to `.env` and fill in:

```bash
cp .env.example .env
```

Edit `.env`:
```
GITHUB_API_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
GITHUB_WEBHOOK_SECRET=your_webhook_secret
AI_SERVER_URL=http://localhost:8000/analyze
PORT=3000
```

**How to get values:**
- **GITHUB_API_TOKEN**: Create a personal access token at https://github.com/settings/tokens (needs `repo` scope)
- **GITHUB_WEBHOOK_SECRET**: Any random string (used for signature verification)
- **AI_SERVER_URL**: URL of your Python AI server

### 3. Start the Backend

```bash
npm start
```

Or for development with auto-reload:

```bash
npm run dev
```

The server will listen on `http://localhost:3000`

## API Endpoints

### Webhook Receiver
```
POST /webhooks/github
```
Receives GitHub push events. GitHub will POST to this endpoint.

**Response:**
```json
{
  "message": "Webhook processed",
  "repository": "owner/repo",
  "commitsProcessed": 2,
  "results": [
    {
      "sha": "abc1234",
      "status": "processed",
      "aiResult": { ... }
    }
  ]
}
```

### Health Check
```
GET /webhooks/health
GET /health
```

### Repository Management
```
GET /repos
POST /repos/add
```

## GitHub Webhook Setup

1. Go to your repository → **Settings** → **Webhooks**
2. Click **Add webhook**
3. **Payload URL**: `http://your-server-domain/webhooks/github`
4. **Content type**: `application/json`
5. **Secret**: Paste your `GITHUB_WEBHOOK_SECRET` value
6. **Events**: Select `Push events`
7. Click **Add webhook**

## Data Flow

```
GitHub Repository
        ↓
  Push Event (Webhook)
        ↓
  Webhook Receiver (/webhooks/github)
        ↓
  Extract commit data
        ↓
  GitHub API → Fetch commit details & patches
        ↓
  Build Structured Payload
        ↓
  Python AI Server (/analyze)
        ↓
  Store Results
```

## Structured Payload Example

The backend sends this JSON to your AI server:

```json
{
  "sha": "abc123def456...",
  "message": "Fix: handle null pointer exception",
  "author": {
    "name": "John Doe",
    "email": "john@example.com"
  },
  "committer": {
    "name": "John Doe",
    "email": "john@example.com"
  },
  "timestamp": "2026-05-07T15:30:00Z",
  "url": "https://github.com/owner/repo/commit/abc123...",
  "files": [
    {
      "filename": "src/handler.js",
      "status": "modified",
      "additions": 5,
      "deletions": 2,
      "changes": 7,
      "patch": "@@-1,10 +1,13@@\n..."
    }
  ],
  "diff": "unified diff output...",
  "stats": {
    "total": 1,
    "additions": 5,
    "deletions": 2
  }
}
```

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `GITHUB_API_TOKEN` | GitHub personal access token | `ghp_xxxx...` |
| `GITHUB_WEBHOOK_SECRET` | Secret for webhook verification | `my_secret_123` |
| `AI_SERVER_URL` | Python AI server endpoint | `http://localhost:8000/analyze` |
| `PORT` | Server port | `3000` |

## Error Handling

- **Invalid signature**: Returns `401 Unauthorized`
- **Missing payload**: Returns `400 Bad Request`
- **API errors**: Logged to console; individual commits marked as "error"
- **Already processed**: Commits with duplicate SHA are skipped

## Project Structure

```
backend/
├── controllers/
│   └── webhookController.js     # Webhook handler logic
├── models/
│   ├── repoStore.js             # Repository storage
│   └── resultStore.js           # Result storage
├── routes/
│   ├── repoRoutes.js            # Repository endpoints
│   └── webhookRoutes.js         # Webhook endpoints
├── services/
│   ├── githubService.js         # GitHub API calls
│   └── aiService.js             # AI server integration
├── jobs/
│   └── dailyJobs.js             # Scheduled job (optional)
├── server.js                     # Express app
├── package.json
├── .env.example
└── README.md
```

## Next Steps

1. Set up GitHub webhook pointing to `/webhooks/github`
2. Create Python AI server endpoint that accepts the structured payload
3. Test with `npm start` and trigger a test webhook from GitHub
4. Monitor logs for processed commits
