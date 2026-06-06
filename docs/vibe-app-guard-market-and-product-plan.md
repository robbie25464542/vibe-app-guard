# Vibe App Guard 行业市场分析与产品方案

日期：2026-06-06

## 1. 一句话结论

AI coding / vibe coding 正在让大量非安全背景的个人开发者、OPC、小团队快速发布可公开访问的应用，但这些应用通常缺少短信防刷、UGC 审核、图片上传治理、AI 输入输出安全、权限与存储配置检查等基础护栏。

市场上已经有单点能力：代码安全扫描、内容审核 API、AI guardrails、短信反欺诈、WAF/限频。但目前还没有一个明显占位的产品，把这些能力包装成“面向 AI 生成应用的上线前体检 + 上线后运行时风控护栏”。

建议 MVP 先做成：

> Vibe-coded App Security Scanner：在用户把 AI 做出来的 App 发给真实用户前，让 Agent 当一次坏人，检查高风险功能，并给出可复制给 AI coding 工具的修复建议。

长期演进为：

> Vibe App Guard：面向 AI 生成应用的 Trust & Safety Layer，覆盖上线前扫描、修复模板、运行时审核 API、策略控制台和持续监控。

## 2. 行业背景

### 2.1 Vibe coding 的供给侧变化

AI coding 工具让“做出一个能跑的 app”的门槛快速下降。Lovable、Bolt、Cursor、Replit、v0、Codex、Claude Code 等工具已经把产品原型、内部工具、小型 SaaS、AI chat app 的开发周期压缩到小时或天。

这带来一个结构性变化：

- 过去，能把应用公开上线的人，通常至少懂一些后端、权限、部署、安全配置。
- 现在，很多人能通过自然语言和模板发布一个看起来完整的应用，但并不了解安全边界。
- 应用数量增加、上线速度增加、开发者安全经验下降，三者叠加，会放大低级安全与滥用问题。

公开资料已经显示这个趋势在加速。Sonar 2026 年开发者调查称，尝试过 AI 的开发者中，72% 每天使用 AI，AI 生成代码占已提交代码的 42%，且开发者预计到 2027 年会升至 65%。Axios 2026 年 5 月报道，研究人员发现大量由 Lovable、Base44、Replit、Netlify 等工具构建的公开资产，其中部分包含敏感公司数据和个人信息。

### 2.2 风险从“代码漏洞”扩展到“业务滥用”

传统 AppSec 更关注：

- 依赖漏洞
- Secret 泄露
- SQL injection / XSS
- Auth bypass
- SSRF / RCE
- 安全 header
- IaC / container / cloud 配置

但 vibe-coded app 面临的风险还包括更贴近业务运行的“上线滥用问题”：

- 短信验证码被刷，造成成本损失或短信通道封禁。
- 头像、昵称、评论、帖子、bio、商品描述等公开 UGC 未经审核，出现广告、诈骗、引流、色情、政治敏感、仇恨、违法内容。
- 图片上传接口被当成公共图床，造成带宽成本、违规图片托管、外链盗流量、平台背锅。
- AI chat 把用户隐私、系统提示词、内部规则、业务敏感信息暴露给模型或返回给用户。
- Supabase/Firebase/R2/S3 bucket 公开策略错误，导致用户数据、上传文件、业务资产可被枚举。
- 免费额度、邀请奖励、试用权益、优惠券、积分被批量薅取。
- AI coding 后续改动把之前修好的权限、审核、限频逻辑重新破坏。

这些问题不完全是传统漏洞扫描能解决的。它们需要理解 app 的业务功能、公开面、用户生成内容链路、成本型接口和 AI 调用链路。

## 3. 市场空间与趋势

### 3.1 AppSec 是大市场，但现有产品偏企业开发团队

Grand View Research 估算，全球 application security 市场 2025 年规模约 106.5 亿美元，2033 年预计达到 420.9 亿美元，2026-2033 年 CAGR 约 18.8%。这说明应用安全投入是明确增长趋势。

但传统 AppSec 平台主要面向企业安全团队和专业开发团队。它们强调 SAST、DAST、SCA、secret scanning、CNAPP、DevSecOps workflow。对 OPC 或 vibe coder 来说，很多产品认知门槛高、接入重、语言偏安全工程。

我们的机会不在于正面替代 AppSec 平台，而在于把安全能力产品化给一个新客群：

- 非安全背景 builder
- 独立开发者
- 小团队
- AI coding heavy 用户
- 内部工具创建者
- 早期 startup

### 3.2 内容审核 API 成熟，但缺少业务链路封装

OpenAI Moderation API 支持文本和图片审核；AWS Rekognition Content Moderation 支持图片和视频审核；Hive、PicPurify、ImageGuard、Pixel Patrol 等也提供文本、图片、视频审核 API。

这些服务能回答“这段文本/这张图片是否违规”，但通常不解决：

- 评论应该先发后审还是先审后发？
- 头像和昵称如何在展示前审核？
- 图片上传到对象存储后，如何先进入隔离区？
- public bucket 和 signed URL 如何设计？
- 图片审核失败后如何删除、替换、通知用户？
- AI 输入输出审核失败时如何降级？
- 审核日志、人工复核、封禁、策略版本如何管理？

OPC 缺的往往不是一个 classifier，而是一套默认正确的产品安全链路。

### 3.3 AI guardrails 增长，但多聚焦模型安全

Pangea AI Guardrails、OpenAI Guardrails 等产品聚焦 PII、prompt injection、moderation、hallucination、DLP 等 AI 应用安全问题。

这类能力对 AI chat app 很重要，但它们通常不覆盖普通 Web app 中的：

- 图片上传
- 用户资料公开展示
- 评论/帖子 UGC
- 短信/注册防刷
- 对象存储防盗链
- 上线前业务滥用测试

我们的机会是把 AI guardrails 放入更完整的 app trust & safety 语境中。

### 3.4 Vibe app 安全扫描已经出现，说明需求被验证

市场上已经出现 VibeScan、Pantra、vchk、SecurePilot、AquilaX Vibe Scanner 等产品，面向 Lovable、Bolt、Cursor、Replit、v0 等 AI-built apps 做安全扫描。

它们验证了两个事实：

- 用户开始意识到 AI-built app 可能不安全。
- “输入 URL / repo，扫描上线风险”是一个低门槛入口。

但这些产品多偏代码/配置安全，常见扫描点包括：

- Supabase RLS
- 暴露 API key
- 缺少 auth
- 安全 header
- 依赖漏洞
- XSS / SQL injection
- hardcoded secrets
- storage bucket 配置

我们的差异化应放在“业务风控 + 内容安全 + 运行时护栏”：

- 不只告诉用户代码哪里不安全。
- 还告诉用户：这个 app 会如何被垃圾内容、违规图片、短信攻击、AI prompt abuse、免费额度薅羊毛攻击。
- 并提供后续可接入的运行时服务。

## 4. 竞品地图

### 4.1 Vibe coding 安全扫描

代表产品：

- VibeScan
- Pantra
- vchk
- SecurePilot
- AquilaX Vibe Code Scanner
- VybeSafe
- LintVibe

主要价值：

- 低门槛扫描 AI-built apps。
- 发现常见代码与配置风险。
- 生成修复建议或适合 AI coding 工具的 prompt。

优势：

- 用户认知直接：上线前扫一下。
- 获客容易：免费 URL 扫描、分享报告、复扫。
- 与 Cursor/Lovable/Bolt 等用户场景匹配。

不足：

- 多数偏静态或半静态安全扫描。
- 对 UGC、图片、AI chat、短信成本接口的业务风险覆盖不足。
- 多数缺少运行时防护能力。
- 报告可能是一次性价值，留存和商业化需要后续承接。

### 4.2 传统 AppSec 平台

代表产品：

- Aikido
- Snyk
- Semgrep
- GitHub CodeQL
- Veracode
- ProjectDiscovery
- GitGuardian / TruffleHog

主要价值：

- 企业级代码、依赖、secret、IaC、容器、漏洞扫描。
- 接入 CI/CD、IDE、PR workflow。

优势：

- 安全能力成熟。
- 企业采购预算明确。
- 规则库和工作流强。

不足：

- 不专门面向 OPC 和 vibe-coded app。
- 语言和工作流偏专业开发者。
- 不处理内容安全、图片治理、短信防刷等运行时业务风控。

### 4.3 内容审核与 Trust & Safety API

代表产品：

- OpenAI Moderation API
- AWS Rekognition Content Moderation
- Hive Moderation
- PicPurify
- ImageGuard
- Pixel Patrol
- Musubi

主要价值：

- 文本、图片、视频、音频审核。
- 色情、暴力、仇恨、自伤、违法、广告、欺诈等分类。

优势：

- 模型能力成熟。
- API 标准化。
- 对平台型 UGC 产品有明确价值。

不足：

- 对 OPC 来说接入仍然需要理解业务链路。
- 不直接解决对象存储、公开展示、人工复核、封禁、审核状态管理。
- 通常不是“上线前体检”入口。

### 4.4 AI 应用 Guardrails

代表产品：

- Pangea AI Guardrails
- OpenAI Guardrails
- Lasso Security
- Lakera
- Protect AI

主要价值：

- Prompt injection 防护。
- PII redaction。
- 输入输出审核。
- 模型调用策略。
- 企业 AI 使用治理。

优势：

- AI app 场景强相关。
- 和 LLM 应用增长方向一致。
- 企业安全与合规价值明确。

不足：

- 主要围绕 AI 调用链路。
- 不覆盖普通 UGC、图片上传、短信成本、对象存储等完整 app 风险。
- 对 indie / OPC 的产品包装还不够轻。

### 4.5 限频、反滥用、短信防刷

代表产品：

- Twilio Verify Fraud Guard
- Cloudflare Rate Limiting / Bot Management / Turnstile
- Arcjet
- Fingerprint
- hCaptcha / reCAPTCHA

主要价值：

- 登录、注册、短信验证码、API 成本接口防刷。
- Bot 检测、设备识别、IP 限频。

优势：

- 基础设施能力强。
- 可以在边缘层和 API 层防护。
- 对短信成本攻击价值明确。

不足：

- 配置策略需要经验。
- 不覆盖内容安全、图片审核、AI 输入输出。
- 对 OPC 来说仍然是“工具箱”，不是完整解决方案。

## 5. 机会判断

### 5.1 明确存在需求

需求来自五个变化：

1. AI coding 降低上线门槛。
2. 非专业开发者公开发布 app 的数量增加。
3. 公开 UGC、图片上传、AI chat、短信登录成为 demo app 常见功能。
4. 这些功能天然容易被滥用。
5. 现有安全产品要么太工程化，要么太点状。

### 5.2 最值得占位的品类

建议占位：

> Trust & Safety Layer for Vibe-coded Apps

中文：

> AI 生成应用的上线安全体检与运行时风控护栏

不要只定位为：

- 内容审核 API：竞品太多，差异弱。
- 安全扫描器：容易一次性，容易被 AppSec 平台覆盖。
- 短信限频工具：场景窄，基础设施竞品强。
- AI guardrails：只覆盖 AI app，不覆盖完整 app。

更好的定位是组合型：

- 上线前：坏人视角扫描。
- 修复时：AI coding 工具可执行的修复 prompt / patch / template。
- 上线后：UGC、图片、AI、短信、成本接口的运行时防护。

### 5.3 我们的核心差异

1. 面向 OPC，而不是安全工程师。
2. 面向 AI-generated app，而不是泛代码库。
3. 面向业务滥用链路，而不是只扫漏洞。
4. 把“发现问题”和“修复/防护”连接起来。
5. 以常见 vibe stack 为默认对象：Next.js、Supabase、Firebase、Vercel、Cloudflare、S3/R2、OpenAI。

## 6. 目标用户

### 6.1 第一批用户

优先级最高：

- 用 Lovable / Bolt / Cursor / Replit / v0 / Codex 做 app 的独立开发者。
- 准备把 demo 发到社媒、Product Hunt、Hacker News、微信群、飞书群、客户试用的人。
- 产品包含 UGC、图片上传、AI chat、短信登录、免费额度、邀请奖励等功能。

典型画像：

- 不一定懂安全。
- 愿意用 AI coding 工具修复问题。
- 需要低门槛、明确、快速的建议。
- 对“上线后被攻击、被刷成本、被塞违规内容”有焦虑，但不知道怎么处理。

### 6.2 第二批用户

- 早期 startup。
- 小型 SaaS 团队。
- 业务部门自建内部工具。
- AI 应用工作室。
- Agency / 外包团队，给客户交付 AI-built app。

这些用户更可能付费订阅持续扫描和运行时风控。

## 7. MVP 产品定义

### 7.1 MVP 名称

英文：

- Vibe App Guard
- Vibe App Security Scanner
- Launch Guard for AI-built Apps

中文：

- AI App 上线安全体检
- Vibe App 上线安全 Agent
- AI 生成应用安全护栏

建议 MVP 对外名称：

> Vibe App Guard：Security Scanner for AI-built Apps

这样既保留长期品牌，又让 MVP 能清楚表达“scanner”。

### 7.2 MVP 使用阶段

核心使用时机：

> 用户把 AI 做出来的 app 发给真实用户之前。

延伸使用时机：

- 每次新增高风险功能后。
- 每次部署前。
- 每周定期复扫。
- 产品被公开推广前。
- 准备接入真实用户数据前。

### 7.3 MVP 不做什么

MVP 不做：

- 完整风控 SaaS 控制台。
- 完整人工审核工作台。
- 完整短信反欺诈引擎。
- 企业级 SAST/DAST 替代品。
- 全框架 SDK。
- 全自动修复 PR。
- 对用户 app 进行未经授权攻击。

MVP 必须避免承诺过大。第一版承诺是：

> 帮你发现上线前最容易被滥用的风险，并给出 AI coding 工具可执行的修复建议。

### 7.4 MVP 核心流程

1. 用户输入线上 app URL。
2. 用户确认自己拥有该 app 或有测试授权。
3. 用户选择 app 类型：
   - 普通 SaaS
   - UGC 社区
   - AI chat app
   - Marketplace
   - Internal tool
   - 其他
4. 用户可选填写技术栈：
   - Lovable
   - Bolt
   - Cursor
   - Replit
   - v0
   - Next.js
   - Supabase
   - Firebase
   - Vercel
   - Cloudflare
5. Agent 执行被动和低风险主动扫描。
6. 生成风险报告。
7. 每个风险包含：
   - 风险名称
   - 严重程度
   - 证据
   - 坏人如何利用
   - 可能损失
   - 修复建议
   - 可复制给 AI coding 工具的 prompt
   - 复扫按钮

### 7.5 MVP 第一版扫描能力

#### A. 公开面发现

目标：知道这个 app 暴露了哪些入口。

检查项：

- 登录/注册入口。
- 短信/邮箱验证码入口。
- 用户资料编辑入口。
- 头像/图片上传入口。
- 评论/帖子/留言/反馈入口。
- AI chat / prompt 输入框。
- 文件上传入口。
- pricing / invite / coupon / credit / trial 相关入口。
- admin / dashboard / api route 暴露迹象。

方法：

- 页面爬取。
- 表单识别。
- JS bundle 关键词分析。
- API route pattern 识别。
- 常见技术栈 fingerprint。
- robots/sitemap/header 检查。

#### B. UGC 风险检查

目标：判断公开展示内容是否存在审核缺口。

检查项：

- 昵称、bio、头像是否可被直接展示。
- 评论/帖子是否提交后立刻公开。
- 是否存在明显广告/链接/联系方式绕过风险。
- 是否有审核状态字段或 pending 流程迹象。
- 是否有举报、删除、封禁入口。

MVP 方式：

- 不做恶意大规模发帖。
- 通过页面和接口行为判断。
- 如果用户提供测试账号，可以做低频测试提交。

输出示例：

> 评论提交后直接公开展示，未观察到审核或延迟发布机制。攻击者可以批量发布广告、引流、违法内容。建议改为 pending 状态，审核通过后进入 public feed。

#### C. 图片上传风险检查

目标：识别公共图床、违规图片托管、盗链风险。

检查项：

- 是否允许任意图片上传。
- 上传后是否直接返回公开 URL。
- URL 是否可长期公开访问。
- 是否使用 public bucket。
- 是否限制 MIME type、文件大小、扩展名。
- 是否做图片内容审核。
- 是否有 signed URL、过期时间、防盗链。
- 是否能枚举文件路径。

输出示例：

> 上传后的图片直接落到公开 bucket，并返回永久 URL。该链路可能被滥用为免费图床，也会让平台承担违规图片托管风险。建议使用 private bucket + 审核隔离区 + 审核通过后生成受控访问 URL。

#### D. AI chat 风险检查

目标：检查模型输入输出安全与敏感信息处理。

检查项：

- 是否有 AI chat / agent 功能。
- 用户输入是否可能包含 PII、密钥、业务敏感信息。
- 是否存在 prompt injection 风险提示。
- 输出是否经过 moderation。
- 系统提示词是否可能泄露。
- 是否有 RAG / 文件上传 / 知识库，是否存在越权读取风险。

输出示例：

> AI chat 输入未观察到 PII redaction 或 moderation。用户可能将手机号、邮箱、身份证、客户数据输入模型。建议在模型调用前做敏感信息识别和脱敏，输出后做安全审核。

#### E. 短信/成本型接口风险检查

目标：发现可能被刷成本的接口。

检查项：

- OTP 发送接口是否有前端 captcha。
- 是否有明显 rate limit。
- 是否按 IP、手机号、设备、国家区号限制。
- 是否存在错误信息枚举。
- 是否有注册/邀请/免费额度接口。
- 是否有 AI token 消耗型接口。

MVP 方式：

- 只做极低频测试，不进行真实压力攻击。
- 更偏配置和行为推断。
- 报告给出策略建议。

输出示例：

> 验证码发送入口未观察到明显限频或二次验证。建议至少配置 per-phone、per-IP、per-session 三层限制，并对高风险国家区号、异常失败率、短时间重复请求做拦截。

#### F. 常见 vibe stack 配置风险

目标：覆盖已经被市场验证的高频安全坑。

检查项：

- Supabase RLS 是否可能缺失。
- Supabase anon key 是否暴露在错误位置。
- Storage bucket 是否 public。
- Firebase rules 是否过宽。
- Vercel/Next.js API route 是否缺 auth。
- CORS 是否过宽。
- 安全 header 是否缺失。
- JS bundle 中是否有 secret。
- Source map 是否公开。

这些能力可以借鉴现有 vibe security scanner 的成熟方向，但输出语言要更 OPC 友好。

## 8. 报告设计

### 8.1 报告结构

报告应分为五层：

1. 总体上线风险评分。
2. 关键高危问题。
3. 按功能分类的问题。
4. 修复优先级。
5. AI coding 修复 prompt。

示例结构：

- Overall risk: High
- Launch recommendation: Do not publicly launch before fixing 3 critical issues.
- Critical issues:
  - Public user uploads can be used as image hosting.
  - Comments appear publicly without moderation.
  - OTP endpoint appears unprotected from abuse.
- Fix first:
  - Make storage bucket private.
  - Add moderation status to comments.
  - Add rate limits to OTP endpoint.
- Paste into Cursor:
  - Prompt 1
  - Prompt 2
  - Prompt 3

### 8.2 严重程度分级

Critical：

- 可导致用户数据泄露。
- 可导致公开违规内容传播。
- 可造成明显成本损失。
- 可被匿名用户直接利用。

High：

- 需要登录但容易滥用。
- 可导致垃圾内容、盗链、滥用 AI token。
- 权限边界可疑但未确认泄露。

Medium：

- 缺少安全 header。
- 错误信息过多。
- 上传限制不完整。
- 缺少举报/复核流程。

Low：

- 最佳实践缺失。
- 文案和流程风险。
- 需要后续优化。

### 8.3 修复建议格式

每个风险都给三类建议：

1. 非技术解释：
   - 为什么危险。
   - 坏人怎么用。
   - 会造成什么损失。

2. 工程修复：
   - 应该改哪个链路。
   - 应该新增哪些字段/中间件/策略。
   - 默认推荐方案。

3. AI coding prompt：
   - 可以直接复制给 Cursor/Lovable/Bolt/Codex。
   - 明确要求改动和验收标准。

示例：

```text
Please update the comment publishing flow so user comments are not publicly visible immediately after submission.
Add a moderation_status field with values pending, approved, rejected.
New comments should default to pending.
Only approved comments should appear in public feeds.
Add server-side validation and tests for anonymous, owner, and non-owner access.
Do not expose rejected comments through public API routes.
```

## 9. 第二阶段产品：修复模板 / 开源中间件

当扫描报告验证需求后，第二阶段应降低修复成本。

### 9.1 目标

把“知道有风险”变成“十分钟修掉一类风险”。

### 9.2 交付形态

- Next.js middleware。
- Supabase SQL migration。
- Supabase RLS policy template。
- Storage private bucket template。
- Cloudflare Worker rate limit template。
- Vercel config template。
- AI moderation wrapper。
- UGC moderation schema。
- Cursor / Codex / Lovable prompt pack。

### 9.3 推荐优先模板

1. UGC 先审后发模板。
2. 图片上传隔离区模板。
3. AI input/output moderation wrapper。
4. OTP 限频 middleware。
5. Supabase RLS/storage baseline。

## 10. 第三阶段产品：运行时风控 SaaS

当用户开始有真实流量后，扫描报告和模板无法持续保护应用，需要运行时服务。

### 10.1 核心 API

```text
POST /v1/moderate/text
POST /v1/moderate/image
POST /v1/moderate/ai-input
POST /v1/moderate/ai-output
POST /v1/risk/rate-limit
POST /v1/risk/event
GET  /v1/reviews
POST /v1/reviews/{id}/approve
POST /v1/reviews/{id}/reject
```

### 10.2 统一决策格式

```json
{
  "decision": "allow",
  "reason": "clean",
  "confidence": 0.97,
  "risk_labels": [],
  "action_hint": "publish"
}
```

可能 decision：

- allow
- block
- review
- throttle
- shadow_hold

### 10.3 控制台

最小控制台：

- 应用列表。
- 风险事件列表。
- 审核队列。
- 策略配置。
- API key。
- 扫描历史。
- 复扫结果。

成熟控制台：

- 人工复核工作台。
- 用户风险画像。
- 内容命中规则。
- 审核员操作日志。
- Webhook。
- 多环境配置。
- 团队权限。

## 11. 技术架构建议

### 11.1 MVP 扫描架构

组件：

- URL intake service。
- Passive crawler。
- Form/API detector。
- Tech stack fingerprint。
- Risk rule engine。
- LLM reasoning layer。
- Report generator。
- Re-scan runner。

数据流：

1. 用户提交 URL。
2. crawler 获取页面、脚本、header、可访问路径。
3. detector 提取表单、上传入口、AI 输入框、登录入口、API pattern。
4. rule engine 做确定性检查。
5. LLM reasoning layer 结合页面语义生成风险解释。
6. report generator 输出报告和修复 prompt。

关键原则：

- 确定性规则优先，LLM 用于解释、归纳、生成修复建议。
- 不做破坏性攻击。
- 默认低频、只读、可授权。
- 主动测试必须有用户确认。

### 11.2 后续运行时架构

组件：

- Decision API。
- Policy engine。
- Content classifiers。
- Image processing pipeline。
- PII redaction。
- Rate limit engine。
- Event store。
- Review queue。
- Webhook dispatcher。

可复用第三方能力：

- OpenAI / Hive / AWS Rekognition 做内容分类。
- Cloudflare / Upstash / Redis 做限频。
- S3/R2/Supabase Storage 做文件链路模板。
- Postgres 做审核与事件存储。

我们自建的核心价值：

- 面向 vibe app 的默认策略。
- 统一 risk decision。
- 业务链路模板。
- 扫描到修复到运行时防护的闭环。

## 12. 商业模式

### 12.1 MVP 定价

免费：

- 输入 URL，获得基础风险摘要。
- 限制扫描次数。
- 展示 1-3 个高危问题。

一次性付费：

- $9-$29 获取完整报告。
- 包含可复制修复 prompt。
- 包含一次复扫。

订阅：

- $19-$49/月。
- 每周自动复扫。
- 多项目。
- 变更提醒。
- 扫描历史。

### 12.2 SaaS 阶段定价

Indie：

- $19-$49/月。
- 适合小 app。
- 每月一定审核量。

Pro：

- $99-$299/月。
- 多应用、更多审核量、Webhook、策略配置。

Team：

- $499+/月。
- 团队权限、人工审核、SLA、私有策略。

Usage-based：

- 文本审核按请求量。
- 图片审核按张数。
- AI guardrail 按调用量。
- rate limit/event 按事件量。

### 12.3 付费转化逻辑

扫描是获客入口。

报告暴露风险后，转化路径是：

- “复制 prompt 自己修”免费或低价。
- “安装模板”中低价。
- “接入运行时 API”订阅。
- “持续复扫”订阅。

## 13. Go-to-market

### 13.1 第一阶段获客

渠道：

- Product Hunt。
- Hacker News。
- Reddit r/SideProject、r/vibecoding、r/SaaS。
- X/Twitter indie hacker 社群。
- Lovable/Bolt/Cursor/Replit 用户社区。
- Supabase / Vercel / Next.js 社群。
- 安全事故复盘文章。

内容策略：

- “我扫描了 50 个 AI-built apps，发现了哪些问题。”
- “不要把你的 Lovable app 发出去前，先检查这 10 件事。”
- “Supabase RLS 是 vibe-coded app 最常见的数据泄露点。”
- “图片上传如何把你的 app 变成免费图床。”
- “AI chat app 上线前必须加的 5 个 guardrails。”

### 13.2 产品增长机制

- 免费 URL scan。
- 报告可分享，但隐藏敏感细节。
- 修复后复扫 badge。
- “Launch-safe” checklist。
- Cursor/Codex prompt pack。
- GitHub Action / Vercel integration。
- MCP integration，允许 AI coding agent 读取扫描结果并修复。

## 14. 成功指标

### 14.1 MVP 验证指标

获客：

- URL scan 提交量。
- 完整报告查看率。
- 报告分享率。

痛点：

- 扫描出高危问题的比例。
- 用户点击“修复 prompt”的比例。
- 用户复扫比例。

商业：

- 完整报告付费率。
- 订阅转化率。
- 每个用户平均项目数。

留存：

- 7 日内复扫率。
- 新部署后复扫率。
- 周度自动扫描开启率。

### 14.2 SaaS 阶段指标

- API 接入应用数。
- 日审核请求量。
- block/review/allow 分布。
- 人工复核处理量。
- 用户误杀反馈率。
- 高危事件拦截数。
- MRR / NRR / churn。

## 15. 风险与应对

### 15.1 扫描能力被认为不够准

风险：

- 用户期望扫描器像专业渗透测试。
- 误报/漏报影响信任。

应对：

- 明确定位为 pre-launch safety scan，不替代专业 pentest。
- 区分 confirmed、suspected、best-practice。
- 提供证据和复现步骤。
- 先做少量高置信规则。

### 15.2 产品变成一次性工具

风险：

- 用户扫一次，看完就走。

应对：

- 提供复扫。
- 提供持续监控。
- 提供部署前 GitHub Action。
- 报告连接修复模板和运行时 API。

### 15.3 被传统 AppSec 平台覆盖

风险：

- Aikido、Snyk、Semgrep 等增加 vibe app scanner。

应对：

- 深耕 OPC 语言和工作流。
- 聚焦 UGC、图片、AI chat、短信等业务滥用。
- 做扫描到运行时防护闭环。

### 15.4 内容审核能力没有壁垒

风险：

- OpenAI/AWS/Hive 已经很强。

应对：

- 不把 classifier 当核心壁垒。
- 核心壁垒是策略、链路、模板、控制台、垂直场景。
- 允许底层模型可插拔。

### 15.5 法律与授权风险

风险：

- 扫描他人网站可能引发争议。

应对：

- 用户必须确认拥有授权。
- 默认被动扫描。
- 主动测试需要验证站点所有权。
- 不做高频压测、不绕过权限、不提交违法内容。
- 提供 robots/scan policy。

## 16. 推荐路线图

### Phase 0：手工验证，1-2 周

目标：

- 验证用户是否愿意提交 URL。
- 验证报告是否有价值。

动作：

- 做 landing page。
- 收集 20-50 个用户 app。
- 半自动扫描 + 人工分析。
- 输出报告样例。
- 观察用户是否愿意修复、复扫、付费。

### Phase 1：MVP Scanner，4-6 周

目标：

- 自动生成基础报告。

功能：

- URL scan。
- 页面爬取。
- 表单/API/上传/AI 输入识别。
- 安全 header、公开 key、source map、storage pattern 检查。
- UGC/图片/AI/OTP 风险推断。
- 报告生成。
- 修复 prompt。
- 复扫。

### Phase 2：Prompt Pack + Templates，4-8 周

目标：

- 提高修复转化。

功能：

- Next.js 修复模板。
- Supabase RLS/storage 模板。
- UGC moderation schema。
- AI guardrail wrapper。
- OTP rate limit middleware。
- GitHub Action。
- MCP integration。

### Phase 3：Runtime Guard API，8-12 周

目标：

- 从一次性扫描变成持续防护。

功能：

- Text moderation API。
- Image moderation API。
- AI input/output guardrail。
- Rate limit decision API。
- Event logging。
- Webhook。
- 审核队列。

### Phase 4：Trust & Safety Console

目标：

- 面向有真实用户和审核需求的小团队。

功能：

- 多应用管理。
- 策略配置。
- 人工复核。
- 风险用户。
- 审核日志。
- 报表。
- 团队权限。

## 17. 最终建议

MVP 不要一开始做完整风控 SaaS，也不要只做一个内容审核 API。

最优切口是：

> 上线前安全扫描 Agent。

原因：

- 用户认知最轻。
- 获客成本最低。
- 与 vibe coding 的“发布前焦虑”强绑定。
- 能自然发现 UGC、图片、AI、短信、权限等后续模块需求。
- 能用报告引导修复模板和运行时 SaaS。

第一版必须打透的体验是：

> 我输入 URL，几分钟后看到：如果这个 app 今天公开发布，坏人最可能从哪里下手；我应该先修哪三个问题；我可以把哪些 prompt 复制给 Cursor/Codex/Lovable 来修。

长期产品不是 scanner，而是：

> AI-built apps 的 Trust & Safety Layer。

scanner 是入口，template 是修复桥梁，runtime guard API 是长期价值和商业化。

## 18. 参考资料

- [Sonar: State of Code Developer Survey 2026](https://www.sonarsource.com/company/press-releases/sonar-data-reveals-critical-verification-gap-in-ai-coding/)
- [Axios: AI vibe-coding apps leak sensitive data](https://www.axios.com/2026/05/07/loveable-replit-vibe-coding-privacy)
- [Grand View Research: Application Security Market Size](https://www.grandviewresearch.com/industry-analysis/application-security-market)
- [VibeScan](https://vibe-scan.app/)
- [Pantra](https://pantra.io/)
- [vchk](https://www.vchk.dev/)
- [SecurePilot](https://www.securepilot.app/)
- [AquilaX Vibe Code Scanner](https://aquilax.ai/vibe)
- [Aikido Security](https://www.aikido.dev/)
- [Aikido MCP](https://help.aikido.dev/ide-plugins/aikido-mcp)
- [OpenAI Moderation API](https://platform.openai.com/docs/guides/moderation)
- [OpenAI Guardrails](https://guardrails.openai.com/)
- [AWS Rekognition Content Moderation](https://aws.amazon.com/rekognition/content-moderation/)
- [Hive Visual Content Moderation](https://docs.thehive.ai/docs/visual-content-moderation)
- [Hive Text Moderation](https://docs.thehive.ai/docs/classification-text)
- [Pangea AI Guardrails](https://pangea.cloud/products/ai-application-guardrails/)
- [Twilio Verify Fraud Prevention](https://www.twilio.com/docs/verify/preventing-toll-fraud)
- [Cloudflare Rate Limiting](https://www.cloudflare.com/products/rate-limiting/)
- [Arcjet JS SDK](https://github.com/arcjet/arcjet-js)
