const scanSteps = [
  "校验 URL 和授权范围",
  "在预算内抓取公开页面",
  "采集响应头、表单和脚本",
  "识别 UGC、上传、AI 和验证码入口",
  "运行 MVP 风险规则",
  "生成上线报告和修复 Prompt"
];

let findings = [
  {
    id: "comments-publish-without-review",
    category: "ugc",
    severity: "high",
    confidence: "likely",
    title: "评论内容可能未经审核直接公开",
    summary: "应用暴露了公开评论入口，但扫描没有观察到审核状态、待复核流程或举报处理信号。",
    impact: "攻击者可以在应用上线后把垃圾广告、诈骗链接、引流信息或违规内容塞进公开页面。",
    evidence: [
      "公开帖子页面发现评论表单",
      "发现疑似接口信号：/api/comments/create",
      "未观察到 pending/review/approved 审核字段信号",
      "未观察到举报或滥用处理流程"
    ],
    recommendation: "新评论默认进入待审核状态，公开列表只展示已通过审核的评论。",
    prompt: `请改造评论发布流程，确保用户新提交的评论不会立即公开展示。

要求：
- 给 comments 增加 moderation_status 字段，取值为 pending、approved、rejected。
- 新评论默认写入 pending。
- 公开评论查询只能返回 approved 评论。
- 评论作者可以看到自己的 pending 评论，并展示“待审核”状态。
- 服务端必须校验，客户端不能直接设置 moderation_status。
- 为公开用户、评论作者和管理员分别补测试。`
  },
  {
    id: "image-upload-public-url",
    category: "image_upload",
    severity: "high",
    confidence: "likely",
    title: "图片上传可能生成永久公开 URL",
    summary: "扫描器发现头像上传和公开存储 URL 信号，但没有观察到审核或 signed URL 控制。",
    impact: "应用可能被当成公共图床，带来带宽成本、外链盗用和违规图片托管风险。",
    evidence: [
      "个人资料设置页发现头像上传控件",
      "发现公开存储 URL 模式",
      "未观察到 signed URL 过期信号",
      "未观察到图片审核状态信号"
    ],
    recommendation: "用户图片先上传到私有隔离区，审核通过后再通过受控 URL 公开展示。",
    prompt: `请改造头像上传流程，避免应用变成公共图床。

要求：
- 新头像先上传到名为 avatar-submissions 的私有 bucket。
- 服务端校验文件类型、文件大小和图片尺寸。
- 头像记录增加 moderation_status：pending、approved、rejected。
- pending 头像不能在公开资料页展示。
- 只有 approved 头像可以公开展示。
- 对已通过头像使用 signed URL 或受控公开资源路径。`
  },
  {
    id: "ai-chat-without-guardrails",
    category: "ai_chat",
    severity: "high",
    confidence: "likely",
    title: "AI 对话缺少可见的输入输出护栏",
    summary: "应用存在 AI 对话信号，但未观察到内容审核、PII 脱敏或安全兜底信号。",
    impact: "用户可能把敏感信息发送给模型，不安全的模型输出也可能被直接展示给用户。",
    evidence: [
      "发现 AI 对话输入框",
      "发现模型接口信号：/api/chat",
      "发现 OpenAI 相关字符串",
      "未观察到 moderation/redact/PII/guardrail 信号"
    ],
    recommendation: "模型调用前做输入审核和 PII 脱敏，模型返回后再做输出审核。",
    prompt: `请为 AI 对话接口增加安全护栏。

要求：
- 调用模型前识别并脱敏手机号、邮箱、API key、个人身份标识等常见敏感信息。
- 对用户输入执行内容安全审核。
- 可以脱敏时，不要把原始敏感值发送给模型。
- 收到模型响应后，返回给用户前执行输出审核。
- 如果输入或输出不安全，返回安全兜底文案。`
  },
  {
    id: "otp-no-visible-rate-limit",
    category: "otp_abuse",
    severity: "medium",
    confidence: "suspected",
    title: "验证码接口缺少可见的防滥用信号",
    summary: "扫描发现手机号验证码流程，但未观察到冷却时间、验证码挑战或限频响应信号。",
    impact: "攻击者可能重复请求验证码，造成短信成本损失或通道送达率问题。",
    evidence: [
      "发现手机号输入框和发送验证码按钮",
      "未观察到 Turnstile/reCAPTCHA/hCaptcha 信号",
      "未观察到 Retry-After 或冷却时间信号"
    ],
    recommendation: "在服务端增加手机号、IP、会话维度的限频，并对高风险请求增加挑战。",
    prompt: `请为验证码发送接口增加服务端防滥用保护。

要求：
- 按手机号、IP、会话限制验证码发送次数。
- 重复请求后返回安全的冷却提示。
- 对可疑 IP 或连续失败请求增加高风险挑战。
- 记录手机号国家区号、IP ASN、发送结果和请求速度。
- 为正常发送、冷却、重复请求拦截补测试。`
  },
  {
    id: "public-source-map",
    category: "secrets",
    severity: "medium",
    confidence: "confirmed",
    title: "生产环境 Source Map 可能公开",
    summary: "扫描发现公开 JavaScript source map 引用。",
    impact: "公开 source map 可能暴露内部路径、注释、接口名称和实现细节。",
    evidence: [
      "发现 sourceMappingURL 引用",
      "Source map URL 可访问"
    ],
    recommendation: "生产构建关闭公开 source map，或只把 source map 上传到私有错误追踪存储。",
    prompt: `请关闭生产环境公开 source map。

要求：
- 更新生产构建配置，避免生成浏览器可直接访问的 source map。
- 如需保留 source map，仅放在私有错误追踪存储中。
- 验证生产环境 .map URL 返回 404 或需要权限访问。`
  },
  {
    id: "missing-csp",
    category: "headers",
    severity: "medium",
    confidence: "confirmed",
    title: "缺少 Content-Security-Policy 响应头",
    summary: "根页面响应中没有包含 Content-Security-Policy 响应头。",
    impact: "缺少 CSP 会削弱对 XSS、异常脚本执行和非预期嵌入的纵深防御。",
    evidence: [
      "已采集根页面响应头",
      "未发现 Content-Security-Policy"
    ],
    recommendation: "添加符合应用资源加载方式的 CSP，并阻断不安全默认行为。",
    prompt: `请增加生产环境 Content-Security-Policy 响应头。

要求：
- 定义 default-src、script-src、object-src、img-src、connect-src、frame-ancestors。
- 使用 frame-ancestors 限制页面被嵌入。
- 除非有明确理由，避免 unsafe-inline。
- 启用 CSP 后测试登录、上传和 AI 对话流程。`
  },
  {
    id: "supabase-anon-key",
    category: "storage",
    severity: "low",
    confidence: "confirmed",
    title: "前端 Bundle 中发现 Supabase anon key",
    summary: "扫描发现 Supabase anon key。这本身很常见，但会放大 RLS 和存储策略配置错误的影响。",
    impact: "如果 RLS 或 storage policy 过宽，公开客户端可能读取或写入本不该访问的数据。",
    evidence: [
      "发现 Supabase 项目 URL",
      "JS bundle 中发现疑似 anon key 的 token"
    ],
    recommendation: "确认所有用户数据表开启 RLS，并检查存储策略是否符合公开/私有预期。",
    prompt: `请审计 Supabase RLS 和 storage policy。

要求：
- 确认所有包含用户数据的表都开启 RLS。
- 为私有记录增加基于 owner 的访问策略。
- 确保 anon 用户不能写入敏感表。
- 检查 storage bucket，用户提交的资源默认私有，除非明确审核通过可公开展示。`
  }
];

const form = document.getElementById("scanForm");
const scanButton = document.getElementById("scanButton");
const progressPanel = document.getElementById("progressPanel");
const progressMessage = document.getElementById("progressMessage");
const progressPercent = document.getElementById("progressPercent");
const progressBar = document.getElementById("progressBar");
const scanStepsList = document.getElementById("scanSteps");
const reportPanel = document.getElementById("report");
const findingsList = document.getElementById("findingsList");
const riskScore = document.getElementById("riskScore");
const criticalCount = document.getElementById("criticalCount");
const highCount = document.getElementById("highCount");
const mediumCount = document.getElementById("mediumCount");
const lowCount = document.getElementById("lowCount");
const reportSummary = document.getElementById("reportSummary");
const demoStatus = document.getElementById("demoStatus");
const rescanButton = document.getElementById("rescanButton");
const toast = document.getElementById("toast");
const targetUrlInput = document.getElementById("targetUrl");

if (window.location.protocol.startsWith("http")) {
  targetUrlInput.value = `${window.location.origin}/demo-target`;
}

function severityCounts(items) {
  return items.reduce((counts, item) => {
    counts[item.severity] = (counts[item.severity] || 0) + 1;
    return counts;
  }, {});
}

function calculateRiskScore(items) {
  const weights = { critical: 40, high: 20, medium: 8, low: 2 };
  return Math.min(100, items.reduce((sum, item) => sum + (weights[item.severity] || 0), 0));
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 1800);
}

function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text);
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(textarea);
  return ok ? Promise.resolve() : Promise.reject(new Error("Copy failed"));
}

function renderSteps(doneIndex) {
  scanStepsList.innerHTML = scanSteps
    .map((step, index) => `<li class="${index <= doneIndex ? "done" : ""}">${step}</li>`)
    .join("");
}

function renderMetrics(items) {
  const counts = severityCounts(items);
  criticalCount.textContent = counts.critical || 0;
  highCount.textContent = counts.high || 0;
  mediumCount.textContent = counts.medium || 0;
  lowCount.textContent = counts.low || 0;
  riskScore.textContent = calculateRiskScore(items);
}

function findingMatchesFilter(item, filter) {
  return filter === "all" || item.severity === filter || item.category === filter;
}

function severityLabel(severity) {
  return {
    critical: "严重",
    high: "高危",
    medium: "中危",
    low: "低危",
    info: "提示"
  }[severity] || severity;
}

function confidenceLabel(confidence) {
  return {
    confirmed: "已确认",
    likely: "较可能",
    suspected: "待确认"
  }[confidence] || confidence;
}

function categoryLabel(category) {
  return {
    ugc: "UGC",
    image_upload: "图片上传",
    ai_chat: "AI 对话",
    otp_abuse: "验证码滥用",
    secrets: "敏感信息",
    headers: "响应头",
    storage: "存储策略",
    auth: "权限",
    api: "API"
  }[category] || category;
}

function renderFindings(filter = "all") {
  const visible = findings.filter((item) => findingMatchesFilter(item, filter));
  findingsList.innerHTML = visible.map(renderFinding).join("");

  findingsList.querySelectorAll("[data-copy-prompt]").forEach((button) => {
    button.addEventListener("click", () => {
      const item = findings.find((finding) => finding.id === button.dataset.copyPrompt);
      copyText(item.prompt).then(
        () => showToast("修复 Prompt 已复制"),
        () => showToast("复制失败")
      );
    });
  });
}

function renderFinding(item) {
  const evidence = item.evidence.map((entry) => `<li>${entry}</li>`).join("");
  return `
    <article class="finding" data-category="${item.category}" data-severity="${item.severity}">
      <div class="finding-head">
        <div>
          <h3 class="finding-title">${item.title}</h3>
          <div class="tag-row">
            <span class="tag severity ${item.severity}">${severityLabel(item.severity)}</span>
            <span class="tag">${confidenceLabel(item.confidence)}</span>
            <span class="tag">${categoryLabel(item.category)}</span>
          </div>
        </div>
        <button class="secondary" type="button" data-copy-prompt="${item.id}">复制 Prompt</button>
      </div>
      <p>${item.summary}</p>
      <div class="finding-grid">
        <div class="evidence">
          <h4>证据</h4>
          <ul>${evidence}</ul>
        </div>
        <div class="recommendation">
          <h4>建议修复</h4>
          <p>${item.recommendation}</p>
        </div>
      </div>
      <div class="prompt-box">
        <h4>AI Coding 修复 Prompt</h4>
        <pre>${item.prompt}</pre>
      </div>
    </article>
  `;
}

function setFilters() {
  document.querySelectorAll(".filter").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".filter").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      renderFindings(button.dataset.filter);
    });
  });
}

function completeReport(report) {
  findings = report.findings;
  renderMetrics(findings);
  reportSummary.textContent = `${report.targetUrl} 本次真实本地扫描发现 ${findings.length} 个风险项。${report.launchRecommendation}。`;
  renderFindings();
  reportPanel.classList.remove("hidden");
  demoStatus.textContent = "报告已生成";
  reportPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function createScan(targetUrl) {
  const response = await fetch("/api/scans", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ targetUrl })
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || "创建扫描失败");
  }
  return body;
}

async function pollScan(scanId) {
  for (;;) {
    const response = await fetch(`/api/scans/${scanId}`);
    const body = await response.json();
    if (!response.ok) {
      throw new Error(body.error || "加载扫描失败");
    }
    if (body.status === "completed" || body.status === "failed") {
      return body;
    }
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
}

function setProgress(progress, message, doneIndex) {
  progressMessage.textContent = message;
  progressPercent.textContent = `${progress}%`;
  progressBar.style.width = `${progress}%`;
  renderSteps(doneIndex);
}

async function runApiScan(targetUrl) {
  const created = await createScan(targetUrl);
  if (created.status === "completed" && created.report) {
    setProgress(100, "报告已生成", scanSteps.length - 1);
    completeReport(created.report);
    return;
  }

  setProgress(20, "扫描任务已排队", 0);
  const completed = await pollScan(created.scanId);
  if (completed.status === "failed") {
    throw new Error(completed.error || completed.message || "扫描失败");
  }
  setProgress(100, "报告已生成", scanSteps.length - 1);
  completeReport(completed.report);
}

async function startScan(targetUrl) {
  scanButton.disabled = true;
  reportPanel.classList.add("hidden");
  progressPanel.classList.remove("hidden");
  demoStatus.textContent = "扫描中";
  renderSteps(-1);
  setProgress(5, "正在准备扫描器...", -1);

  if (!window.location.protocol.startsWith("http")) {
    showToast("请运行 node server.js 体验真实 API Demo");
    scanButton.disabled = false;
    return;
  }

  try {
    let stepIndex = 0;
    var progressTimer = setInterval(() => {
      stepIndex = Math.min(stepIndex + 1, scanSteps.length - 2);
      const progress = Math.min(90, 20 + stepIndex * 12);
      setProgress(progress, scanSteps[stepIndex], stepIndex);
    }, 300);
    await runApiScan(targetUrl);
  } catch (error) {
    demoStatus.textContent = "扫描失败";
    showToast(error.message);
  } finally {
    if (progressTimer) clearInterval(progressTimer);
    scanButton.disabled = false;
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const targetUrl = new FormData(form).get("targetUrl");
  startScan(targetUrl);
});

rescanButton.addEventListener("click", () => {
  showToast("已重新发起扫描");
  const targetUrl = new FormData(form).get("targetUrl");
  startScan(targetUrl);
});

setFilters();
renderMetrics(findings);
renderFindings();
