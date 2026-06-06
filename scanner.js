const severityWeights = {
  critical: 40,
  high: 20,
  medium: 8,
  low: 2
};

function normalizeHeaders(headers = {}) {
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), String(value)])
  );
}

function includesAny(text, needles) {
  const lower = text.toLowerCase();
  return needles.some((needle) => lower.includes(needle.toLowerCase()));
}

function hasPublicSupabaseStorage(text) {
  return /supabase\.co\/storage\/v1\/object\/public/i.test(text);
}

function calculateRiskScore(findings) {
  const score = findings.reduce((total, finding) => total + (severityWeights[finding.severity] || 0), 0);
  return Math.min(100, score);
}

function countSeverities(findings) {
  return findings.reduce(
    (counts, finding) => {
      counts[finding.severity] = (counts[finding.severity] || 0) + 1;
      return counts;
    },
    { critical: 0, high: 0, medium: 0, low: 0 }
  );
}

function makeFinding({ id, category, severity, confidence, title, summary, impact, evidence, recommendation, prompt }) {
  return { id, category, severity, confidence, title, summary, impact, evidence, recommendation, prompt };
}

function analyzeTarget(scanInput) {
  const headers = normalizeHeaders(scanInput.headers);
  const html = scanInput.html || "";
  const scripts = scanInput.scripts || [];
  const scriptText = scripts.map((script) => `${script.url || ""}\n${script.body || ""}`).join("\n");
  const corpus = `${html}\n${scriptText}`;
  const findings = [];

  const hasCommentSurface = includesAny(corpus, ["post comment", "share your thoughts", "发表评论", "分享你的想法", "/api/comments/create", "textarea"]);
  const hasModerationSignal = includesAny(corpus, ["moderation_status", "pending", "approved", "rejected", "review", "待审核", "已通过", "已拒绝", "复核"]);
  if (hasCommentSurface && !hasModerationSignal) {
    findings.push(makeFinding({
      id: "comments-publish-without-review",
      category: "ugc",
      severity: "high",
      confidence: "likely",
      title: "评论内容可能未经审核直接公开",
      summary: "扫描发现公开评论入口，但没有观察到审核状态或复核流程信号。",
      impact: "攻击者可以在上线后向公开页面发布垃圾广告、诈骗链接、引流信息或违规内容。",
      evidence: ["发现评论输入框或评论创建接口信号", "未观察到 pending/review/approved 审核信号"],
      recommendation: "新评论默认进入 pending 状态，公开列表只展示 approved 评论。",
      prompt: "请为评论发布流程增加 moderation_status 字段。新评论默认 pending，公开查询只能返回 approved 评论，并禁止客户端直接设置审核状态。"
    }));
  }

  const hasImageUpload = includesAny(corpus, ['type="file"', "upload avatar", "avatar", "image upload", "上传头像", "头像", "图片上传"]);
  const hasPublicStorage = hasPublicSupabaseStorage(corpus);
  if (hasImageUpload && hasPublicStorage && !hasModerationSignal) {
    findings.push(makeFinding({
      id: "image-upload-public-url",
      category: "image_upload",
      severity: "high",
      confidence: "likely",
      title: "图片上传可能生成永久公开 URL",
      summary: "扫描发现图片上传和公开存储 URL 信号，但没有观察到审核或 signed URL 控制。",
      impact: "应用可能被当成公共图床，造成带宽成本、外链盗用和违规图片托管风险。",
      evidence: ["发现图片上传信号", "发现公开存储 URL 模式", "未观察到图片审核状态信号"],
      recommendation: "用户图片先上传到私有隔离区，审核通过后再公开展示。",
      prompt: "请改造头像上传流程：使用私有 staging bucket，服务端校验文件，记录 moderation_status，并且只公开 approved 图片。"
    }));
  }

  const hasAiSurface = includesAny(corpus, ["openai", "anthropic", "/api/chat", "chat completions", "ask the ai", "assistant", "询问 AI", "AI 助手", "AI 对话"]);
  const hasGuardrailSignal = includesAny(corpus, ["moderation", "redact", "pii", "guardrail", "safety_check", "脱敏", "审核", "安全护栏"]);
  if (hasAiSurface && !hasGuardrailSignal) {
    findings.push(makeFinding({
      id: "ai-chat-without-guardrails",
      category: "ai_chat",
      severity: "high",
      confidence: "likely",
      title: "AI 对话缺少可见的输入输出护栏",
      summary: "扫描发现 AI 对话信号，但没有观察到内容审核、PII 脱敏或安全兜底信号。",
      impact: "用户可能把敏感信息发送给模型，不安全的模型输出也可能被直接返回。",
      evidence: ["发现 AI 对话或模型调用信号", "未观察到 moderation/redaction/guardrail 信号"],
      recommendation: "模型调用前做输入审核和 PII 脱敏，模型返回后再做输出审核。",
      prompt: "请为 AI chat endpoint 增加安全护栏：输入敏感信息脱敏、输入审核、输出审核，并在不安全时返回安全兜底响应。"
    }));
  }

  const hasOtpSurface = includesAny(corpus, ["send code", "otp", "phone number", "verification code", "发送验证码", "手机号", "验证码"]);
  const hasRateLimitSignal = includesAny(corpus, ["rate limit", "retry-after", "cooldown", "too many requests", "turnstile", "recaptcha", "hcaptcha", "限频", "冷却"]);
  if (hasOtpSurface && !hasRateLimitSignal) {
    findings.push(makeFinding({
      id: "otp-no-visible-rate-limit",
      category: "otp_abuse",
      severity: "medium",
      confidence: "suspected",
      title: "验证码接口缺少可见的防滥用信号",
      summary: "扫描发现验证码流程，但没有观察到冷却时间、挑战或限频响应信号。",
      impact: "攻击者可能重复请求验证码，造成短信成本损失或通道送达率问题。",
      evidence: ["发现 OTP/手机号验证码信号", "未观察到冷却、验证码挑战或限频信号"],
      recommendation: "在服务端增加手机号、IP、会话维度限频，并设置冷却和高风险挑战。",
      prompt: "请为验证码发送接口增加服务端防滥用保护：按手机号、IP、会话限频，并在重复请求时返回冷却响应。"
    }));
  }

  if (includesAny(scriptText, ["sourcemappingurl", ".js.map"])) {
    findings.push(makeFinding({
      id: "public-source-map",
      category: "secrets",
      severity: "medium",
      confidence: "confirmed",
      title: "生产环境 Source Map 可能公开",
      summary: "公开脚本内容中发现 JavaScript source map 信号。",
      impact: "公开 source map 可能暴露内部路径、接口名称、注释和实现细节。",
      evidence: ["发现 sourceMappingURL 或 .map 信号"],
      recommendation: "生产环境关闭浏览器可访问的 source map，或仅存放在私有错误追踪系统中。",
      prompt: "请关闭生产环境公开 source map，并验证 .map URL 返回 404 或需要权限访问。"
    }));
  }

  if (!headers["content-security-policy"]) {
    findings.push(makeFinding({
      id: "missing-csp",
      category: "headers",
      severity: "medium",
      confidence: "confirmed",
      title: "缺少 Content-Security-Policy 响应头",
      summary: "目标响应中没有包含 Content-Security-Policy 响应头。",
      impact: "缺少 CSP 会削弱对 XSS、异常脚本执行和非预期嵌入的纵深防御。",
      evidence: ["未发现 Content-Security-Policy 响应头"],
      recommendation: "添加符合应用资源加载模型的生产环境 CSP。",
      prompt: "请增加生产环境 Content-Security-Policy 响应头，覆盖 default-src、script-src、object-src、img-src、connect-src 和 frame-ancestors。"
    }));
  }

  if (includesAny(corpus, ["supabase_anon_key", "eyJhbGciOi", "supabase.co"])) {
    findings.push(makeFinding({
      id: "supabase-anon-key",
      category: "storage",
      severity: "low",
      confidence: "confirmed",
      title: "发现 Supabase anon key 或项目信号",
      summary: "扫描发现 Supabase 前端信号。这本身很常见，但必须确保 RLS 和存储策略配置正确。",
      impact: "如果 RLS 或 storage policy 过宽，公开客户端可能读取或写入本不该访问的数据。",
      evidence: ["发现 Supabase 项目或 anon key 信号"],
      recommendation: "确认用户数据表开启 RLS，并检查 storage policy 是否符合公开/私有预期。",
      prompt: "请审计 Supabase RLS 和 storage policy，确保用户数据表开启 RLS，公开客户端不能写入敏感表。"
    }));
  }

  const riskScore = calculateRiskScore(findings);
  return {
    targetUrl: scanInput.targetUrl,
    findings,
    counts: countSeverities(findings),
    riskScore,
    launchRecommendation:
      riskScore >= 50
        ? "公开发布前请先修复高风险问题"
        : "复核风险项后，可以先小范围分享"
  };
}

module.exports = {
  analyzeTarget,
  calculateRiskScore
};
