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

function baseScanInput(html, scripts = []) {
  return {
    targetUrl: "https://example.com/app",
    headers: { "content-security-policy": "default-src 'self'" },
    html,
    scripts
  };
}

function testUnrelatedTextDoesNotSuppressFindings() {
  const commentResult = analyzeTarget(
    baseScanInput('<textarea placeholder="Share your thoughts"></textarea><button>Post comment</button><footer>Products pending review</footer>')
  );
  assert(commentResult.findings.some((finding) => finding.id === "comments-publish-without-review"));

  const aiResult = analyzeTarget(
    baseScanInput('<input placeholder="Ask the AI assistant"><section>Comment moderation policy</section>')
  );
  assert(aiResult.findings.some((finding) => finding.id === "ai-chat-without-guardrails"));

  const otpResult = analyzeTarget(
    baseScanInput('<input placeholder="Phone number"><button>Send code</button><p>API rate limit: 10 searches/minute</p>')
  );
  assert(otpResult.findings.some((finding) => finding.id === "otp-no-visible-rate-limit"));
}

function testFeatureModerationStillSuppressesItsOwnFinding() {
  const result = analyzeTarget(
    baseScanInput('<textarea placeholder="Share your thoughts"></textarea><button>Post comment</button><p>moderation_status: pending</p>')
  );
  assert(!result.findings.some((finding) => finding.id === "comments-publish-without-review"));
}

function testSourceMapRequiresDirectiveAndIsNotConfirmed() {
  const mentionResult = analyzeTarget(
    baseScanInput("", [{ url: "https://example.com/app.js", body: "const docs = 'Upload files ending in .js.map';" }])
  );
  assert(!mentionResult.findings.some((finding) => finding.id === "public-source-map"));

  const directiveResult = analyzeTarget(
    baseScanInput("", [{ url: "https://example.com/app.js", body: "//# sourceMappingURL=app.js.map" }])
  );
  const finding = directiveResult.findings.find((item) => item.id === "public-source-map");
  assert(finding);
  assert.equal(finding.confidence, "likely");
}

function testJwtAloneIsNotSupabaseSignal() {
  const jwtOnly = analyzeTarget(baseScanInput('<script>const authToken = "eyJhbGciOiJIUzI1NiJ9.not-supabase";</script>'));
  assert(!jwtOnly.findings.some((finding) => finding.id === "supabase-anon-key"));

  const supabase = analyzeTarget(baseScanInput('<script>window.SUPABASE_URL = "https://demo.supabase.co";</script>'));
  assert(supabase.findings.some((finding) => finding.id === "supabase-anon-key"));
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
testUnrelatedTextDoesNotSuppressFindings();
testFeatureModerationStillSuppressesItsOwnFinding();
testSourceMapRequiresDirectiveAndIsNotConfirmed();
testJwtAloneIsNotSupabaseSignal();
testSingleHighFindingBlocksRelease();
testRiskScoreCapsAt100();
console.log("All tests passed");
