# Vibe App Guard Alpha 验证 SOP

日期：2026-06-06

## 1. 目标

在完整 MVP 系统开发前，用半自动方式验证：

1. 用户是否愿意提交 app URL 做安全体检。
2. 我们是否能在真实 vibe-coded app 中发现高价值风险。
3. 用户是否愿意根据报告修复并复扫。
4. 哪些规则误报最多，哪些风险最能打动用户。
5. 报告是否能推动后续模板、SDK 或 SaaS 需求。

## 2. 验证周期

建议周期：1-2 周。

目标样本：

- 10-20 个真实 app。
- 至少 5 个包含 AI chat。
- 至少 5 个包含 UGC。
- 至少 5 个包含图片或文件上传。
- 至少 3 个包含短信、邮箱验证码、邀请、免费额度或 AI token 成本接口。

## 3. 参与者

每次验证建议至少有：

- 1 名产品/研究人员：负责用户沟通、访谈和报告解释。
- 1 名工程人员：负责半自动扫描和证据采集。
- 1 名安全/风控人员：负责风险判断和误报校验。

如果人手有限，可以由同一人兼任，但必须保留“证据采集”和“风险判断”的检查步骤。

## 4. 用户招募

### 4.1 目标用户

- 使用 Lovable / Bolt / Cursor / Replit / v0 / Codex 做 app 的开发者。
- 准备公开发布 demo。
- 应用包含 UGC、图片上传、AI chat、短信登录、免费额度、邀请奖励等功能。

### 4.2 招募话术

```text
我们正在做一个给 AI-built apps 用的上线前安全体检工具。

你可以提交一个你拥有或有授权测试的 app URL，我们会从坏人视角帮你检查：
- UGC 是否可能被广告/违规内容滥用
- 图片上传是否可能变成公共图床
- AI chat 是否缺少输入输出安全护栏
- 验证码/免费额度/API 是否可能被刷
- Supabase/Firebase/storage/auth 配置是否有明显风险

我们不会做压力测试、短信轰炸、绕过登录或破坏性测试。
你会收到一份报告，里面包含风险说明、证据、修复建议和可复制给 Cursor/Codex 的修复 prompt。
```

## 5. 授权确认

扫描前必须让用户确认：

```text
我确认：
1. 我拥有该应用，或已经获得应用所有者授权进行安全体检。
2. 我允许 Vibe App Guard 对该 URL 进行低风险扫描。
3. 我理解本次扫描不会进行高频压测、短信轰炸、绕过登录、破坏性 payload 或未授权访问。
4. 我不会提交不属于我或未授权的网站。
```

建议记录：

- 用户姓名/联系方式。
- app URL。
- 授权确认时间。
- 扫描模式。

## 6. 半自动扫描流程

### Step 1：基础信息收集

记录：

- App URL。
- App 类型。
- 技术栈。
- 是否使用 AI coding 工具。
- 是否有测试账号。
- 是否允许 authenticated scan。
- 用户最担心的风险。

### Step 2：公开页面采集

采集：

- 首页。
- 登录/注册页。
- 公开详情页。
- 用户 profile 页。
- UGC feed。
- AI chat 页。
- 上传相关页面。
- pricing / invite / credit 页。

工具：

- 浏览器手动访问。
- Playwright 简单爬取。
- `curl -I` 采集 headers。
- 下载公开 JS bundle。

### Step 3：Surface 识别

标记是否存在：

- login
- signup
- otp
- profile_edit
- comment
- post
- image_upload
- file_upload
- ai_chat
- invite
- credit_or_trial
- admin

### Step 4：规则初筛

使用 [mvp-scanning-rules-v1.md](/Users/bytedance/Desktop/ugc guard/docs/mvp-scanning-rules-v1.md) 中的规则人工或脚本化判断。

优先判断：

- R-001 missing_csp
- R-004 public_source_map
- R-005 suspicious_secret_in_js
- R-101 supabase_public_storage_pattern
- R-201 profile_fields_public_without_review
- R-202 comments_publish_without_review
- R-302 image_upload_public_url_pattern
- R-401 ai_chat_without_input_guardrail_signal
- R-502 otp_without_visible_rate_limit_signal
- R-602 api_route_without_auth_signal

### Step 5：风险确认

对每个 finding 标记：

- confirmed
- likely
- suspected
- false positive
- needs authenticated scan

必须记录证据：

- 页面 URL。
- 截图。
- header。
- DOM 片段。
- JS 字符串。
- API path。
- 用户访谈确认。

### Step 6：报告生成

使用 [sample-vibe-app-security-report.md](/Users/bytedance/Desktop/ugc guard/docs/sample-vibe-app-security-report.md) 的结构生成报告。

报告必须包含：

- 上线建议。
- Top 3 must-fix。
- 每个 finding 的证据。
- 为什么危险。
- 修复建议。
- AI coding fix prompt。
- 扫描限制。

### Step 7：用户回访

报告交付后 24-72 小时内访谈。

问题：

1. 哪个风险最让你意外？
2. 哪个风险你最愿意马上修？
3. 报告里的证据是否足够可信？
4. 修复 prompt 是否能直接复制给 AI coding 工具？
5. 你是否愿意修复后复扫？
6. 如果这个工具自动化，你愿意付费吗？
7. 你更愿意为完整报告、持续复扫，还是运行时防护付费？

## 7. 记录模板

每个 app 建议建立一份记录：

```text
App:
Owner:
URL:
Tech stack:
AI coding tool:
App type:
Scan mode:
Date:

Surfaces:
- login:
- otp:
- profile:
- ugc:
- image upload:
- ai chat:
- credits/invite:

Findings:
1. Title:
   Severity:
   Confidence:
   Evidence:
   Rule:
   User reaction:

Top user concern:
Most valuable recommendation:
False positives:
Missing checks:
Follow-up action:
```

## 8. 成功标准

Alpha 阶段如果达到以下信号，说明值得进入完整 MVP：

- 10 个 app 中至少 7 个能发现中高价值风险。
- 至少 50% 用户认为报告值得在上线前使用。
- 至少 30% 用户愿意修复后复扫。
- 至少 20% 用户愿意为完整报告或持续扫描付费。
- 修复 prompt 被用户复制或用于 AI coding 工具。
- 至少 3 个用户表达对运行时 UGC/图片/AI guard API 的兴趣。

## 9. 失败信号

需要调整方向的信号：

- 用户不愿意提交 URL。
- 报告被认为“太像普通安全 checklist”。
- 发现的问题用户不在乎。
- 大量 finding 无法提供证据。
- 误报导致用户不信任。
- 用户只想要免费报告，不愿复扫或接入。

## 10. Alpha 后的决策

根据验证结果选择下一步：

### 情况 A：扫描报告价值强

表现：

- 用户愿意修。
- 愿意复扫。
- 愿意分享报告。

动作：

- 开发完整 URL Scanner MVP。
- 强化报告页和复扫。
- 做 waitlist 和公开样例报告。

### 情况 B：报告价值一般，但修复 prompt 有价值

表现：

- 用户不在乎扫描过程。
- 但愿意复制 prompt 修问题。

动作：

- 强化 prompt pack。
- 做 Cursor/Codex 修复模板。
- 扫描器变成 prompt 推荐器。

### 情况 C：用户更关心运行时防护

表现：

- 用户已经知道风险。
- 更想要 API/SDK 直接接入。

动作：

- 提前做 UGC/image/AI guard API。
- Scanner 作为轻量获客入口。

### 情况 D：误报高、扫描不稳定

表现：

- 规则缺少证据。
- 用户不信任报告。

动作：

- 收缩扫描范围。
- 先做 Supabase/Next.js/Firebase 特定栈。
- 引入 GitHub repo scan 获取更高置信度。

## 11. 最小工具链

Alpha 可以不开发完整系统，先用：

- Browser / Playwright：页面访问和截图。
- `curl`：headers 和 endpoint 检查。
- 简单脚本：提取 JS bundle 字符串。
- 规则文档：人工判断。
- LLM：报告解释和修复 prompt 初稿。
- 人工审核：校验误报和危险输出。

## 12. Alpha 输出物

Alpha 结束后应产出：

- 10-20 份扫描记录。
- 3-5 份可脱敏公开样例报告。
- 规则命中统计。
- 误报/漏报清单。
- 用户访谈摘要。
- MVP 开发优先级调整建议。
- 定价测试反馈。
