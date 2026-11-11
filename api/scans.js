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

async function scanTarget(targetUrl, { useBuiltInFixture = false } = {}) {
  if (useBuiltInFixture) {
    return analyzeTarget({
      targetUrl,
      headers: {
        "content-type": "text/html; charset=utf-8"
      },
      html: createDemoTargetHtml(),
      scripts: [
        {
          url: new URL("/demo-target-app.js", targetUrl).toString(),
          body: createDemoTargetScript()
        }
      ]
    });
  }

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

function createDemoTargetHtml() {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <title>演示应用 VibeBook</title>
    <script src="/demo-target-app.js"></script>
  </head>
  <body>
    <main>
      <h1>演示应用 VibeBook</h1>
      <section>
        <h2>评论</h2>
        <form action="/api/comments/create">
          <textarea placeholder="分享你的想法"></textarea>
          <button>发表评论</button>
        </form>
      </section>
      <section>
        <h2>头像</h2>
        <input type="file" accept="image/*">
        <button>上传头像</button>
        <img src="https://demo.supabase.co/storage/v1/object/public/avatars/demo.png" alt="公开头像">
      </section>
      <section>
        <h2>AI 对话</h2>
        <input placeholder="询问 AI 助手">
      </section>
      <section>
        <h2>登录</h2>
        <input placeholder="手机号">
        <button>发送验证码</button>
      </section>
    </main>
  </body>
</html>`;
}

function createDemoTargetScript() {
  return `window.SUPABASE_URL = "https://demo.supabase.co";
window.SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.demo";
fetch("/api/comments/create");
fetch("/api/chat");
console.log("openai chat completions");
//# sourceMappingURL=demo-target-app.js.map`;
}

module.exports = async function handler(request, response) {
  if (request.method !== "POST" && request.method !== "GET") {
    response.setHeader("allow", "GET, POST");
    response.status(405).json({ error: "只支持 GET 或 POST /api/scans" });
    return;
  }

  const headers = request.headers || {};
  const requestUrl = new URL(request.url || "/api/scans", `https://${headers.host || "localhost"}`);
  const protocol = headers["x-forwarded-proto"] || "https";
  const defaultTargetUrl = `${protocol}://${headers.host || "localhost"}/demo-target`;
  const body = typeof request.body === "string" ? JSON.parse(request.body || "{}") : request.body || {};
  const targetUrl = request.method === "GET"
    ? requestUrl.searchParams.get("targetUrl") || defaultTargetUrl
    : body.targetUrl;

  if (!isSafeHttpUrl(targetUrl)) {
    response.status(400).json({ error: "targetUrl 必须是 http 或 https URL" });
    return;
  }

  try {
    const useBuiltInFixture = request.method === "GET" && !requestUrl.searchParams.has("targetUrl");
    const report = await scanTarget(targetUrl, { useBuiltInFixture });
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
