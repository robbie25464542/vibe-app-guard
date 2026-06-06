# Vibe App Guard MVP 技术方案与前置准备

日期：2026-06-06

## 1. 技术方案摘要

当前 MVP 建议做成：

> Vibe-coded App Security Scanner：用户提交自己准备公开发布的 app URL，系统用低风险、授权范围内的扫描方式识别上线前常见安全与业务滥用风险，并输出报告、证据、修复建议和可复制给 AI coding 工具的修复 prompt。

MVP 的技术目标不是做完整渗透测试平台，也不是做完整运行时风控 SaaS，而是快速验证三个问题：

1. 用户是否愿意提交 app URL 做上线前安全体检。
2. Scanner 是否能稳定发现高价值风险。
3. 报告里的修复建议是否能推动用户修复、复扫、付费或接入后续服务。

因此第一版架构应坚持：

- 以 URL 扫描为主，repo 扫描作为后续扩展。
- 被动扫描和低频主动探测为主，不做破坏性测试。
- 规则引擎负责确定性判断，LLM 负责语义理解、风险解释和修复 prompt 生成。
- 数据模型从第一天保留 app、scan、finding、evidence、recommendation、rescan 的边界。
- 报告结果可被后续模板、GitHub Action、MCP、运行时 Guard API 复用。

## 2. MVP 边界

### 2.1 MVP 必须做

- 用户提交 URL。
- 用户确认拥有扫描授权。
- 基础站点信息采集。
- 页面爬取。
- 表单、上传入口、AI 输入框、登录/注册入口识别。
- 常见技术栈 fingerprint。
- 安全 header、source map、公开 key、公开 storage pattern 检查。
- UGC、图片上传、AI chat、短信/成本接口风险推断。
- 风险报告生成。
- 每个风险给证据、影响、修复建议、AI coding prompt。
- 支持复扫。
- 保存扫描历史。

### 2.2 MVP 可以晚一点做

- GitHub repo 深度扫描。
- 自动创建修复 PR。
- 完整 DAST。
- 真实压力测试。
- 完整短信防刷引擎。
- 完整内容审核 API。
- 人工审核工作台。
- 团队权限系统。
- 多租户企业控制台。

### 2.3 明确不做

- 未授权扫描。
- 高频攻击、撞库、短信轰炸、支付测试。
- 绕过登录态读取用户私有数据。
- 上传违法内容做测试。
- 对目标站点做破坏性 fuzzing。
- 宣称替代专业渗透测试。

## 3. 总体架构

### 3.1 推荐架构

```text
Web App
  |
  | submit URL / view report
  v
API Server
  |
  | create scan job
  v
Job Queue
  |
  v
Scanner Worker
  |
  +--> Crawler
  +--> Fingerprint Engine
  +--> Surface Detector
  +--> Passive Security Checks
  +--> Low-risk Active Checks
  +--> Risk Rule Engine
  +--> LLM Reasoning Layer
  +--> Report Generator
  |
  v
Database + Object Storage
```

### 3.2 模块职责

#### Web App

面向用户的入口。

能力：

- 提交 URL。
- 展示授权确认。
- 展示扫描进度。
- 展示报告。
- 提供修复 prompt 复制。
- 触发复扫。
- 管理历史扫描。

MVP 页面：

- Landing page。
- New scan page。
- Scan progress page。
- Report page。
- Scan history page。

#### API Server

承接业务请求。

能力：

- 用户与项目管理。
- URL 校验。
- 创建 scan job。
- 查询 scan 状态。
- 查询 report。
- 触发 rescan。
- 权限校验。

#### Job Queue

把扫描任务异步化，避免 HTTP 请求阻塞。

候选：

- MVP 简化：Postgres job table + worker polling。
- 中期：BullMQ + Redis。
- 云上：Cloudflare Queues / AWS SQS / Google Cloud Tasks。

建议 MVP 先用 Postgres job table，减少基础设施复杂度。

#### Scanner Worker

扫描执行核心。

能力：

- 领取 scan job。
- 控制扫描频率。
- 执行 crawler。
- 执行检测器。
- 汇总 evidence。
- 调用规则引擎。
- 调用 LLM 生成解释和 prompt。
- 写入 finding。
- 生成 report。

#### Database

保存用户、项目、扫描、证据、风险项、报告。

建议：

- Postgres。
- JSONB 保存原始扫描结果和 evidence。
- 结构化字段保存 finding 类型、严重程度、状态、置信度。

#### Object Storage

保存：

- 页面 HTML 快照。
- 截图。
- response header 快照。
- 生成后的 report artifact。

MVP 如果数据量不大，也可以先只用数据库保存文本证据，截图后置。

## 4. 技术栈建议

### 4.1 推荐第一版

- Frontend：Next.js
- API：Next.js Route Handlers 或独立 Node.js service
- Worker：Node.js + Playwright
- DB：Postgres
- ORM：Prisma 或 Drizzle
- Queue：Postgres jobs
- Auth：Clerk / Auth.js / Supabase Auth
- Hosting：Vercel + managed Postgres，或 Fly.io/Render + Postgres
- LLM：OpenAI / Anthropic，封装为 provider interface

### 4.2 为什么这样选

Next.js 适合快速做面向开发者的 SaaS MVP，和目标用户常用栈一致。Worker 需要 Playwright 做页面访问、表单识别、截图和动态渲染，因此建议和 Web App 解耦成独立 worker，避免被 serverless timeout 限制。

Postgres job table 对 MVP 足够，后续如果扫描并发上来，再替换成 Redis/BullMQ 或云队列。

### 4.3 Worker 部署建议

不要把 Playwright worker 放在 Vercel serverless 里跑。原因：

- 浏览器运行依赖重。
- 扫描时间可能超过 serverless timeout。
- 并发控制和资源隔离更难。

更适合：

- Fly.io machine。
- Render background worker。
- Railway worker。
- AWS ECS/Fargate。
- Cloud Run。

MVP 可以先用一个常驻 worker 实例，限制并发为 1-3。

## 5. 核心数据模型

### 5.1 App

```text
apps
- id
- owner_user_id
- name
- base_url
- verified_status
- created_at
- updated_at
```

说明：

- 一个用户可以有多个 app。
- base_url 是扫描目标。
- verified_status 表示用户是否完成所有权确认。

### 5.2 Scan

```text
scans
- id
- app_id
- requested_by_user_id
- status: queued | running | completed | failed | canceled
- scan_mode: passive | standard | authenticated
- started_at
- completed_at
- risk_score
- launch_recommendation
- error_message
- created_at
```

说明：

- MVP 默认 scan_mode 为 passive 或 standard。
- authenticated 模式后续支持测试账号。

### 5.3 Scan Artifact

```text
scan_artifacts
- id
- scan_id
- artifact_type: html | headers | screenshot | js_bundle | robots | sitemap | api_observation
- url
- storage_key
- content_hash
- metadata_json
- created_at
```

说明：

- 保存证据原始材料。
- MVP 可以先只保存 headers/html 摘要，后续加截图。

### 5.4 Finding

```text
findings
- id
- scan_id
- category: ugc | image_upload | ai_chat | otp_abuse | auth | storage | api | headers | secrets
- severity: critical | high | medium | low | info
- confidence: confirmed | likely | suspected
- title
- summary
- impact
- evidence_json
- recommendation
- ai_fix_prompt
- status: open | fixed | accepted_risk | false_positive
- created_at
```

### 5.5 Report

```text
reports
- id
- scan_id
- overall_summary
- risk_score
- launch_recommendation
- top_fixes_json
- markdown_body
- public_share_token
- created_at
```

### 5.6 Job

```text
scan_jobs
- id
- scan_id
- status: queued | running | completed | failed
- priority
- attempts
- locked_by
- locked_until
- error_message
- created_at
- updated_at
```

## 6. 扫描流程

### 6.1 标准流程

```text
1. Validate URL
2. Check authorization confirmation
3. Create app if needed
4. Create scan
5. Enqueue scan job
6. Worker claims job
7. Fetch base page
8. Crawl same-origin pages within budget
9. Capture headers, forms, scripts, links
10. Detect surfaces
11. Run passive checks
12. Run low-risk active checks if allowed
13. Generate findings through rule engine
14. Use LLM to enrich explanations and fix prompts
15. Generate report
16. Mark scan completed
17. Notify user
```

### 6.2 Crawl budget

MVP 默认限制：

- 最多访问 50 个页面。
- 最多下载 20 个 JS/CSS 资源。
- 单页面超时 10 秒。
- 总扫描超时 5 分钟。
- 同域扫描，不跨域深爬。
- 不自动提交表单，除非进入授权 active mode。

### 6.3 URL 安全校验

必须防止 SSRF 和滥用。

校验规则：

- 只允许 http/https。
- 禁止 localhost、127.0.0.1、0.0.0.0、169.254.169.254、私网 IP。
- 禁止 file://、ftp://、gopher://。
- DNS resolve 后检查 IP 是否为公网。
- 跟随 redirect 后再次检查。
- 限制最大 response size。
- 限制下载类型。

## 7. 检测器设计

### 7.1 Surface Detector

目标：识别 app 的风险入口。

输入：

- HTML DOM。
- 表单字段。
- button/link 文案。
- placeholder。
- route path。
- JS bundle 字符串。
- network observations。

输出：

```json
{
  "surfaces": [
    {
      "type": "image_upload",
      "url": "https://app.example.com/settings/profile",
      "confidence": 0.86,
      "signals": ["input[type=file]", "avatar", "upload"]
    }
  ]
}
```

第一版 surface 类型：

- login
- signup
- otp
- profile_edit
- ugc_post
- comment
- image_upload
- file_upload
- ai_chat
- invite
- credit_or_trial
- admin

### 7.2 Tech Fingerprint Engine

目标：识别技术栈和常见配置风险。

信号：

- response headers。
- HTML meta。
- script src。
- JS bundle 字符串。
- cookies。
- known path。
- error page。

识别：

- Next.js。
- Vercel。
- Supabase。
- Firebase。
- Cloudflare。
- S3/R2。
- Clerk。
- Auth0。
- OpenAI client references。

### 7.3 Passive Security Checks

第一版检查：

- 缺少 Content-Security-Policy。
- 缺少 X-Frame-Options / frame-ancestors。
- 缺少 Referrer-Policy。
- 缺少 HSTS。
- source map 公开。
- JS bundle 中疑似 secret。
- Supabase anon key 出现。
- Firebase config 暴露。
- Public bucket URL pattern。
- API route 暴露 pattern。
- CORS 过宽迹象。

注意：

- Supabase anon key 和 Firebase config 出现在前端不一定是漏洞，必须结合 RLS/storage policy 风险表达，避免误报。

### 7.4 UGC Risk Checks

输入：

- surface detector 发现的 profile/comment/post/bio 入口。
- 页面展示关系。
- 是否观察到 moderation、pending、review 等文案或 API 字段。

输出风险：

- Public UGC appears to publish without moderation。
- User profile fields may be publicly displayed before review。
- No visible report/delete/moderation workflow。
- UGC fields allow links/contact handles and may enable spam。

MVP 以 likely/suspected 为主，除非用户提供测试账号完成确认。

### 7.5 Image Upload Risk Checks

输入：

- file input。
- avatar/banner/upload 文案。
- storage URL pattern。
- upload API pattern。
- image URL response。

输出风险：

- Uploads may become public permanent URLs。
- Public bucket pattern detected。
- No evidence of content moderation before public display。
- No evidence of signed URL or expiration。
- File type/size constraints not visible。

### 7.6 AI Chat Risk Checks

输入：

- chat input。
- prompt/assistant/model/openai/anthropic 字符串。
- streaming endpoint pattern。
- system prompt leakage signals。
- file/RAG upload signals。

输出风险：

- AI input may be sent without PII redaction。
- AI output may be shown without moderation。
- Prompt injection risk on user-controlled context。
- RAG/file upload may expose private data if auth boundary is unclear。

### 7.7 OTP / Cost Abuse Checks

输入：

- send code / verify / otp / sms / phone 表单。
- pricing / invite / credit / token / trial 文案。
- API route pattern。
- captcha/turnstile/recaptcha signals。

输出风险：

- OTP endpoint may lack visible anti-abuse control。
- Cost-generating action lacks visible rate limit or captcha。
- Free credit/invite flow may be vulnerable to abuse。

MVP 不做压力测试，只做低风险推断。

## 8. 规则引擎

### 8.1 原则

规则引擎应该先简单、可解释、可版本化。

每条规则包含：

- id
- category
- severity
- confidence logic
- input signals
- evidence builder
- recommendation template
- false positive notes

### 8.2 规则示例

```json
{
  "id": "image_public_bucket_no_review",
  "category": "image_upload",
  "severity": "high",
  "conditions": [
    "surface.image_upload.detected == true",
    "storage.public_url_pattern.detected == true",
    "moderation.review_signal.detected == false"
  ],
  "confidence": "likely",
  "title": "Image uploads may become public without review"
}
```

### 8.3 规则优先级

第一批规则建议 30-50 条，分为：

- 10 条配置/基础安全。
- 10 条 UGC。
- 10 条图片上传。
- 5 条 AI chat。
- 5 条 OTP/成本接口。
- 5 条 Supabase/Firebase/storage。

## 9. LLM 使用边界

### 9.1 LLM 适合做什么

- 根据页面文案理解功能语义。
- 把多个 signals 汇总成风险解释。
- 生成非技术用户能懂的说明。
- 生成 Cursor/Codex/Lovable 可执行的修复 prompt。
- 根据技术栈调整建议。

### 9.2 LLM 不应该做什么

- 直接决定严重程度。
- 直接替代规则引擎。
- 直接执行扫描动作。
- 生成未经审查的攻击 payload。
- 输出危险利用细节。

### 9.3 Prompt 输入控制

传给 LLM 的内容应做最小化：

- 只传页面标题、字段名、路径、headers 摘要、检测 signals。
- 不传用户 app 的敏感数据。
- 不传 cookies。
- 不传完整私有页面内容。
- 对疑似 secret 做 mask。

### 9.4 LLM 输出校验

LLM 输出必须经过 schema 校验：

```json
{
  "summary": "string",
  "impact": "string",
  "recommendation": "string",
  "ai_fix_prompt": "string"
}
```

禁止输出：

- 具体攻击脚本。
- 高频压测指令。
- 绕过认证步骤。
- 短信轰炸步骤。
- 非授权测试建议。

## 10. 报告生成

### 10.1 报告目标

报告应该让用户马上知道：

- 能不能公开发布。
- 先修哪几个问题。
- 每个问题为什么重要。
- 怎么让 AI coding 工具帮他修。
- 修完后如何复扫。

### 10.2 报告结构

```text
1. Overall Launch Recommendation
2. Top 3 Must Fix Before Launch
3. Findings by Category
4. Evidence
5. Fix Prompts
6. Re-scan Checklist
```

### 10.3 Launch Recommendation

可能值：

- Safe to share with limited users。
- Fix high-risk issues before public launch。
- Do not publicly launch yet。

### 10.4 风险评分

MVP 简化评分：

```text
critical: 40 points
high: 20 points
medium: 8 points
low: 2 points
```

封顶 100。

推荐：

- 0-20：Low
- 21-50：Medium
- 51-80：High
- 81-100：Critical

## 11. 安全与合规边界

### 11.1 授权确认

每次扫描前必须让用户确认：

- 我拥有该站点或已获得测试授权。
- 我理解扫描将访问公开页面和低风险资源。
- 我不会提交他人站点进行未授权扫描。

### 11.2 主动测试分级

Passive：

- 只访问公开页面。
- 不提交表单。
- 不登录。
- 不改变目标系统状态。

Standard：

- 低频访问公开 endpoint。
- 读取 headers、robots、sitemap、source map。
- 不提交破坏性 payload。

Authenticated：

- 用户提供测试账号。
- 可提交低风险测试内容。
- 不上传违法图片。
- 不做压力测试。

MVP 先做 Passive + Standard。

### 11.3 站点所有权验证

MVP 可先用声明式授权，但进入主动测试或付费深度扫描前，建议增加验证：

- DNS TXT。
- HTML meta tag。
- 上传验证文件。
- Vercel/Netlify/GitHub OAuth。

### 11.4 防滥用

我们自己的服务也要防滥用：

- 每个用户扫描频率限制。
- 每个域名扫描频率限制。
- 禁止扫描敏感域名和内网地址。
- 记录扫描请求和用户确认。
- 对异常扫描行为封禁。

## 12. 运行时 SaaS 的预留边界

虽然 MVP 不做完整运行时 SaaS，但需要预留概念边界，避免后续重构。

### 12.1 Finding 到 Guard API 的映射

```text
UGC risk       -> text moderation API
Image risk     -> image moderation API + storage workflow
AI chat risk   -> ai input/output guardrail
OTP risk       -> rate limit decision API
Storage risk   -> storage template / signed URL workflow
```

### 12.2 SDK 预留

报告中的修复建议可以提前设计成未来 SDK 的形态：

```ts
const decision = await guard.moderateText({
  appId,
  userId,
  surface: "comment",
  text: commentBody
});

if (decision.decision === "allow") publish();
if (decision.decision === "review") holdForReview();
if (decision.decision === "block") reject();
```

MVP 不需要实现这个 SDK，但报告 prompt 可以朝这个接口方向组织。

## 13. 前置准备清单

### 13.1 产品准备

- 明确 MVP 名称和一句话定位。
- 写清楚扫描授权与免责声明。
- 定义第一版扫描范围。
- 定义不支持的扫描范围。
- 设计报告样例。
- 准备 3-5 个典型 demo app 作为内部测试对象。
- 准备 10 个高频风险故事：
  - 评论先发后审缺失。
  - 头像昵称广告引流。
  - 图片 public bucket。
  - AI chat 无输入输出审核。
  - OTP 无限制。
  - Supabase RLS 缺失。
  - Firebase rule 过宽。
  - Source map 公开。
  - API route 无 auth。
  - 免费额度可刷。

### 13.2 法务与安全准备

- 扫描授权确认文案。
- Terms of Service。
- Acceptable Use Policy。
- Privacy Policy。
- Vulnerability disclosure policy。
- 禁止扫描目标列表。
- 主动测试分级说明。
- 日志保留策略。
- 敏感数据最小化策略。

### 13.3 技术准备

- 选择部署平台。
- 准备 Postgres。
- 准备 worker 运行环境。
- 准备 Playwright 浏览器依赖。
- 设计 scan job schema。
- 设计 finding schema。
- 设计规则 DSL 或规则 JSON。
- 选择 LLM provider。
- 准备 LLM 输出 schema 校验。
- 准备 SSRF 防护 URL validator。
- 准备扫描频率限制。
- 准备错误重试和超时策略。

### 13.4 数据准备

- 收集公开安全 checklist。
- 收集 Supabase/Firebase/Next.js/Vercel 常见风险模式。
- 收集 UGC/图片/AI/OTP 风险案例。
- 整理第一批 30-50 条规则。
- 为每条规则写：
  - 触发条件。
  - 证据格式。
  - 严重程度。
  - 修复建议。
  - AI fix prompt 模板。

### 13.5 设计准备

- 报告页信息架构。
- finding card 组件。
- 风险严重程度视觉语言。
- 扫描进度状态。
- 修复 prompt 复制交互。
- 复扫对比视图。
- Landing page 的样例报告。

### 13.6 GTM 准备

- Landing page。
- Waitlist。
- 免费扫描额度。
- 公开样例报告。
- “上线前 10 个风险”文章。
- “扫描一个 Lovable/Supabase app”案例。
- Product Hunt / HN / Reddit 发布素材。
- 早期用户访谈问题。

## 14. 4-6 周实施拆解

### Week 1：基础骨架

目标：

- Web app、DB、job、worker 跑通。

交付：

- URL 提交流程。
- scan job 创建。
- worker 领取任务。
- base page fetch。
- scan 状态展示。

### Week 2：Crawler 与基础检测

目标：

- 能采集页面和基础证据。

交付：

- Playwright crawler。
- crawl budget。
- header capture。
- form detector。
- link/script collector。
- URL validator 和 SSRF 防护。

### Week 3：第一批规则

目标：

- 生成结构化 findings。

交付：

- tech fingerprint。
- passive security checks。
- surface detector。
- UGC/image/AI/OTP 初版规则。
- severity/confidence 计算。

### Week 4：报告与 LLM

目标：

- 生成用户可读报告。

交付：

- report generator。
- LLM explanation。
- AI fix prompt。
- report page。
- top fixes。
- markdown export。

### Week 5：复扫与打磨

目标：

- 支持修复后复扫和报告对比。

交付：

- rescan。
- finding status。
- scan history。
- basic diff。
- 错误处理。
- 速率限制。

### Week 6：Alpha 验证

目标：

- 交给早期用户试用。

交付：

- 5-10 个真实 app 测试。
- 误报/漏报修正。
- 报告文案优化。
- 样例报告。
- waitlist / invite flow。

## 15. 主要技术风险

### 15.1 动态网站识别不稳定

应对：

- 用 Playwright 而不是纯 HTTP。
- 保存截图和 DOM 摘要。
- 先限制扫描深度。

### 15.2 误报过多

应对：

- 使用 confidence 分级。
- 把推断类问题标为 likely/suspected。
- 提供“为什么这么判断”的 signals。

### 15.3 LLM 输出不稳定

应对：

- LLM 不决定规则命中。
- 输出 schema 校验。
- 关键建议使用模板。
- 对危险输出做过滤。

### 15.4 扫描被滥用

应对：

- URL validator。
- 授权确认。
- 站点所有权验证逐步引入。
- 用户与域名级限频。
- 主动测试默认关闭。

### 15.5 Worker 成本和稳定性

应对：

- 限制并发。
- 限制 crawl budget。
- 失败重试。
- 单 scan timeout。
- browser context 复用和回收。

## 16. 第一批规则建议

### 16.1 基础安全

- missing_csp
- missing_hsts
- missing_frame_protection
- public_source_map
- suspicious_secret_in_js
- overly_permissive_cors

### 16.2 技术栈

- supabase_public_storage_pattern
- supabase_rls_risk_signal
- firebase_rules_risk_signal
- exposed_admin_route
- api_route_without_auth_signal

### 16.3 UGC

- profile_fields_public_without_review
- comments_publish_without_review
- posts_publish_without_review
- ugc_allows_external_links
- no_report_abuse_flow_detected

### 16.4 图片上传

- file_input_without_visible_constraints
- image_upload_public_url_pattern
- public_bucket_without_signed_url
- no_image_moderation_signal
- upload_endpoint_may_allow_hotlinking

### 16.5 AI Chat

- ai_chat_without_input_guardrail_signal
- ai_output_without_moderation_signal
- prompt_injection_surface_detected
- rag_file_upload_auth_boundary_unclear
- system_prompt_leakage_signal

### 16.6 OTP / 成本接口

- otp_without_captcha_signal
- otp_without_visible_rate_limit_signal
- free_credit_abuse_surface
- invite_reward_abuse_surface
- ai_token_cost_endpoint_without_throttle_signal

## 17. 决策建议

### 17.1 MVP 第一版入口

建议只做：

- URL scan。
- 不先做 GitHub repo scan。

原因：

- 门槛最低。
- 最适合传播。
- 用户不需要授予代码权限。
- 更贴合“发给真实用户前扫一下”的心智。

GitHub repo scan 可以作为第二阶段，因为它适合做更深的 Supabase RLS、API route、secret、依赖检查。

### 17.2 技术优先级

第一优先级：

- URL validator。
- crawler。
- surface detector。
- rule engine。
- report generator。

第二优先级：

- LLM 修复 prompt。
- scan history。
- rescan。
- screenshot evidence。

第三优先级：

- authenticated scan。
- GitHub integration。
- GitHub Action。
- runtime guard API。

### 17.3 前置最重要的三件事

1. 设计一份非常强的样例报告。
   - 它决定用户是否觉得产品有价值。

2. 整理第一批 30-50 条高置信规则。
   - 它决定扫描结果是否稳定。

3. 找 10-20 个真实 vibe-coded app 做人工/半自动验证。
   - 它决定我们有没有打中真实痛点。

## 18. 下一步建议

建议接下来按这个顺序推进：

1. 先做一份样例报告。
2. 再定第一批扫描规则。
3. 然后画系统架构和数据模型。
4. 接着实现 URL scan 的技术 spike。
5. 最后做完整 MVP。

如果团队资源有限，甚至可以先不写完整系统，先用半自动方式跑：

- Playwright 抓页面。
- 手工/脚本提取 signals。
- LLM 生成报告。
- 人工校验。

这样 1-2 周内就能验证“用户是否愿意把报告拿去修复”。
