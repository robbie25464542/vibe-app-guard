const assert = require("node:assert/strict");
const { analyzeTarget, calculateRiskScore } = require("../scanner");

function testAnalyzerFindsMvpRisks() {
  const result = analyzeTarget({
    targetUrl: "http://localhost:4173/demo-target",
    headers: {
      "content-type": "text/html",
      "x-frame-options": "DENY"
    },
    html: `
      <html>
        <head>
          <script src="/assets/app.js"></script>
          <script>
            window.SUPABASE_URL = "https://demo.supabase.co";
            window.SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.demo";
            fetch("/api/comments/create");
            fetch("/api/chat");
            console.log("openai chat completions");
          </script>
        </head>
        <body>
          <form><textarea placeholder="Share your thoughts"></textarea><button>Post comment</button></form>
          <form><input type="file" accept="image/*"><button>Upload avatar</button></form>
          <img src="https://demo.supabase.co/storage/v1/object/public/avatars/u1.png">
          <input placeholder="Ask the AI assistant">
          <input placeholder="Phone number"><button>Send code</button>
        </body>
      </html>
    `,
    scripts: [
      {
        url: "http://localhost:4173/assets/app.js",
        body: "sourceMappingURL=app.js.map"
      }
    ]
  });

  const ids = result.findings.map((finding) => finding.id);
  assert(ids.includes("comments-publish-without-review"));
  assert(ids.includes("image-upload-public-url"));
  assert(ids.includes("ai-chat-without-guardrails"));
  assert(ids.includes("otp-no-visible-rate-limit"));
  assert(ids.includes("public-source-map"));
  assert(ids.includes("missing-csp"));
  assert(ids.includes("supabase-anon-key"));
  assert.equal(result.counts.high, 3);
  assert.equal(result.launchRecommendation, "公开发布前请先修复高风险问题");
}

function testSingleHighFindingBlocksRelease() {
  const result = analyzeTarget({
    targetUrl: "https://example.com/comments",
    headers: { "content-security-policy": "default-src 'self'" },
    html: "<textarea>Share your thoughts</textarea><button>Post comment</button>",
    scripts: []
  });

  assert.equal(result.counts.high, 1);
  assert.equal(result.riskScore, 20);
  assert.equal(result.launchRecommendation, "公开发布前请先修复高风险问题");
}

function testRiskScoreCapsAt100() {
  const score = calculateRiskScore([
    { severity: "critical" },
    { severity: "critical" },
    { severity: "high" },
    { severity: "high" }
  ]);
  assert.equal(score, 100);
}

testAnalyzerFindsMvpRisks();
testSingleHighFindingBlocksRelease();
testRiskScoreCapsAt100();
console.log("All tests passed");
