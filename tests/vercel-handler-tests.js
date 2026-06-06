const assert = require("node:assert/strict");
const handler = require("../api/scans");

function createMockResponse() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
}

async function testVercelHandlerReturnsReport() {
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    const text = String(url).endsWith(".js")
      ? `window.SUPABASE_URL = "https://demo.supabase.co";
         fetch("/api/chat");
         console.log("openai chat completions");
         //# sourceMappingURL=demo-target-app.js.map`
      : `<!doctype html>
         <html>
           <head><script src="/demo-target-app.js"></script></head>
           <body>
             <textarea placeholder="分享你的想法"></textarea>
             <button>发表评论</button>
             <input type="file" accept="image/*">
             <button>上传头像</button>
             <img src="https://demo.supabase.co/storage/v1/object/public/avatars/demo.png">
             <input placeholder="询问 AI 助手">
             <input placeholder="手机号"><button>发送验证码</button>
           </body>
         </html>`;

    return {
      url: String(url),
      status: 200,
      headers: new Map([["content-type", "text/html"]]),
      async text() {
        return text;
      }
    };
  };

  try {
    const response = createMockResponse();
    await handler(
      {
        method: "POST",
        body: { targetUrl: "https://example.com/demo-target" }
      },
      response
    );

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.status, "completed");
    assert.equal(response.body.report.findings.length, 7);
    assert.equal(response.body.report.findings[0].title, "评论内容可能未经审核直接公开");
  } finally {
    global.fetch = originalFetch;
  }
}

async function testVercelHandlerSupportsGetDefaultTarget() {
  const originalFetch = global.fetch;
  let fetchCalls = 0;
  global.fetch = async () => {
    fetchCalls += 1;
    throw new Error("Default target should use local fixture");
  };

  try {
    const response = createMockResponse();
    await handler(
      {
        method: "GET",
        url: "/api/scans",
        headers: { host: "vibe-app-guard-demo.vercel.app", "x-forwarded-proto": "https" }
      },
      response
    );

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.status, "completed");
    assert.equal(response.body.report.targetUrl, "https://vibe-app-guard-demo.vercel.app/demo-target");
    assert.equal(response.body.report.findings.length, 7);
    assert.equal(fetchCalls, 0);
  } finally {
    global.fetch = originalFetch;
  }
}

Promise.resolve()
  .then(testVercelHandlerReturnsReport)
  .then(testVercelHandlerSupportsGetDefaultTarget)
  .then(() => console.log("Vercel handler tests passed"))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
