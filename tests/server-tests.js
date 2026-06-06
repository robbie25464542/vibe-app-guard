const assert = require("node:assert/strict");
const { createAppServer } = require("../server");

async function requestJson(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers || {})
    }
  });
  const body = await response.json();
  return { response, body };
}

async function waitForCompletedScan(baseUrl, scanId) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const { body } = await requestJson(baseUrl, `/api/scans/${scanId}`);
    if (body.status === "completed") return body;
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
  throw new Error("Scan did not complete");
}

async function testServerRunsRealScan() {
  const app = createAppServer({ port: 0 });
  await app.start();
  try {
    const baseUrl = app.url;
    const createResult = await requestJson(baseUrl, "/api/scans", {
      method: "POST",
      body: JSON.stringify({ targetUrl: `${baseUrl}/demo-target` })
    });

    assert.equal(createResult.response.status, 202);
    assert.equal(createResult.body.status, "queued");
    assert.ok(createResult.body.scanId);

    const completed = await waitForCompletedScan(baseUrl, createResult.body.scanId);
    assert.equal(completed.status, "completed");
    assert.equal(completed.report.targetUrl, `${baseUrl}/demo-target`);
    assert(completed.report.findings.some((finding) => finding.id === "image-upload-public-url"));
    assert(completed.report.findings.some((finding) => finding.id === "ai-chat-without-guardrails"));
  } finally {
    await app.stop();
  }
}

testServerRunsRealScan()
  .then(() => console.log("Server tests passed"))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
