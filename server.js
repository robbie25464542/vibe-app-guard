const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { analyzeTarget } = require("./scanner");

const rootDir = __dirname;
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png"
};

function sendJson(response, status, body) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        request.destroy(new Error("Request body too large"));
      }
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function isSafeHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function createDemoTargetHtml(baseUrl) {
  return `<!doctype html>
<html>
  <head>
    <title>演示应用 VibeBook</title>
    <script src="/demo-target/app.js"></script>
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

function createDemoScript(baseUrl) {
  return `
window.SUPABASE_URL = "https://demo.supabase.co";
window.SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.demo";
fetch("/api/comments/create");
fetch("/api/chat");
console.log("openai chat completions");
//# sourceMappingURL=app.js.map
`;
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

function createAppServer({ port = 4173 } = {}) {
  const scans = new Map();
  let server;

  async function runScan(scanId) {
    const scan = scans.get(scanId);
    if (!scan) return;
    scan.status = "running";
    scan.progress = 25;
    scan.message = "正在抓取目标页面";

    try {
      scan.progress = 55;
      scan.message = "正在运行扫描规则";
      const report = await scanTarget(scan.targetUrl);
      scan.status = "completed";
      scan.progress = 100;
      scan.message = "报告已生成";
      scan.report = report;
      scan.completedAt = new Date().toISOString();
    } catch (error) {
      scan.status = "failed";
      scan.progress = 100;
      scan.message = error.message;
      scan.error = error.message;
    }
  }

  async function route(request, response) {
    const requestUrl = new URL(request.url, `http://${request.headers.host}`);

    if (request.method === "GET" && requestUrl.pathname === "/demo-target") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(createDemoTargetHtml(`http://${request.headers.host}`));
      return;
    }

    if (request.method === "GET" && requestUrl.pathname === "/demo-target/app.js") {
      response.writeHead(200, { "content-type": "application/javascript; charset=utf-8" });
      response.end(createDemoScript(`http://${request.headers.host}`));
      return;
    }

    if (request.method === "POST" && requestUrl.pathname === "/api/scans") {
      const body = JSON.parse((await readRequestBody(request)) || "{}");
      if (!isSafeHttpUrl(body.targetUrl)) {
        sendJson(response, 400, { error: "targetUrl 必须是 http 或 https URL" });
        return;
      }

      const scanId = `scan_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      scans.set(scanId, {
        scanId,
        targetUrl: body.targetUrl,
        status: "queued",
        progress: 0,
        message: "已排队",
        createdAt: new Date().toISOString()
      });
      setTimeout(() => runScan(scanId), 20);
      sendJson(response, 202, { scanId, status: "queued" });
      return;
    }

    const scanMatch = requestUrl.pathname.match(/^\/api\/scans\/([^/]+)$/);
    if (request.method === "GET" && scanMatch) {
      const scan = scans.get(scanMatch[1]);
      if (!scan) {
        sendJson(response, 404, { error: "未找到扫描任务" });
        return;
      }
      sendJson(response, 200, scan);
      return;
    }

    if (request.method === "GET") {
      const pathname = requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
      const filePath = path.normalize(path.join(rootDir, pathname));
      if (!filePath.startsWith(rootDir)) {
        response.writeHead(403);
        response.end("Forbidden");
        return;
      }
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        response.writeHead(200, { "content-type": contentTypes[path.extname(filePath)] || "application/octet-stream" });
        fs.createReadStream(filePath).pipe(response);
        return;
      }
    }

    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }

  server = http.createServer((request, response) => {
    route(request, response).catch((error) => sendJson(response, 500, { error: error.message }));
  });

  return {
    get url() {
      const address = server.address();
      return `http://127.0.0.1:${address.port}`;
    },
    start() {
      return new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
    },
    stop() {
      return new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    }
  };
}

if (require.main === module) {
  const port = Number(process.env.PORT || 4173);
  const app = createAppServer({ port });
  app.start().then(() => {
    console.log(`Vibe App Guard 演示服务运行中：${app.url}`);
    console.log(`内置被扫目标：${app.url}/demo-target`);
  });
}

module.exports = {
  createAppServer,
  scanTarget
};
