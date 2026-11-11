# Vibe App Guard MVP Demo

This is a runnable local MVP demo for the Vibe App Guard scanner.

## Run

```bash
node local-server.js
```

Open:

```text
http://127.0.0.1:4173
```

The app defaults to scanning the built-in target:

```text
http://127.0.0.1:4173/demo-target
```

## What Is Real

- `POST /api/scans` creates a scan job.
- `GET /api/scans/:id` polls scan status.
- The scanner fetches the target page.
- It extracts headers, HTML, and linked scripts.
- It runs MVP rules for UGC, public image storage, AI chat guardrails, OTP abuse, source maps, CSP, and Supabase signals.
- The frontend renders the returned report and fix prompts.

## What Is Still Demo Scope

- Jobs are stored in memory.
- The built-in target is intentionally risky.
- The crawler is single-page plus linked scripts.
- No authenticated scan, repo scan, destructive testing, or runtime moderation API is included yet.

## Verify

```bash
node tests/run-tests.js
node tests/server-tests.js
node tests/vercel-handler-tests.js
node tests/client-tests.js
node verify-demo.js
```

## Vercel Deployment Shape

The Vercel version uses a synchronous API route:

```text
POST /api/scans
```

It fetches the submitted URL, extracts the target HTML, response headers, and linked scripts, then returns a completed report in the same response. This avoids in-memory job queues in serverless environments. The local `local-server.js` flow still supports asynchronous scan polling for development.
