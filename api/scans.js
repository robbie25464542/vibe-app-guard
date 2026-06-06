const { analyzeTarget } = require("../scanner");

function isSafeHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

async function fetchText(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: "follow" });
    const text = await response.text();
    return {
      url: response.url,
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      text
    };
  } finally {
    clearTimeout(timer);
  }
}

function extractScriptUrls(baseUrl, html) {
  const urls = [];
  const pattern = /<script[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let match = pattern.exec(html);
  while (match) {
    urls.push(new URL(match[1], baseUrl).toString());
    match = pattern.exec(html);
  }
  return urls.slice(0, 8);
}

async function scanTarget(targetUrl) {
  const page = await fetchText(targetUrl);
  const scriptUrls = extractScriptUrls(page.url, page.text);
  const scripts = [];

  for (const scriptUrl of scriptUrls) {
    try {
      const script = await fetchText(scriptUrl, 4000);
      scripts.push({ url: script.url, body: script.text.slice(0, 250_000) });
    } catch (error) {
      scripts.push({ url: scriptUrl, body: "", error: error.message });
    }
  }

  return analyzeTarget({
    targetUrl,
    headers: page.headers,
    html: page.text.slice(0, 500_000),
    scripts
  });
}

module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("allow", "POST");
    response.status(405).json({ error: "只支持 POST /api/scans" });
    return;
  }

  const body = typeof request.body === "string" ? JSON.parse(request.body || "{}") : request.body || {};
  if (!isSafeHttpUrl(body.targetUrl)) {
    response.status(400).json({ error: "targetUrl 必须是 http 或 https URL" });
    return;
  }

  try {
    const report = await scanTarget(body.targetUrl);
    response.status(200).json({
      scanId: `scan_${Date.now()}`,
      status: "completed",
      progress: 100,
      message: "报告已生成",
      report
    });
  } catch (error) {
    response.status(500).json({
      status: "failed",
      error: error.message
    });
  }
};
