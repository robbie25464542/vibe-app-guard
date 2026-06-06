# Vibe App Guard 样例扫描报告

扫描日期：2026-06-06  
目标应用：`https://demo-vibebook.example`  
应用类型：AI 社区 / UGC / 图片上传 / AI chat  
扫描模式：Standard，低风险授权扫描  

> 这是一个样例报告，用于展示 MVP 第一版的报告形态。目标应用为虚构示例。

## 1. 上线建议

**建议：暂不公开发布。**

本次扫描发现 3 个高优先级问题，均属于真实用户上线后容易被滥用的风险：

- 用户评论疑似提交后直接公开展示，缺少先审后发机制。
- 图片上传疑似返回永久公开 URL，存在被当作公共图床和违规图片托管的风险。
- AI chat 未观察到输入脱敏和输出审核链路，可能泄露敏感信息或生成不适合公开展示的内容。

建议先修复 Top 3 问题，再进行复扫。

## 2. 风险概览

| 等级 | 数量 |
|---|---:|
| Critical | 0 |
| High | 3 |
| Medium | 5 |
| Low | 4 |

综合风险分：72 / 100  
上线状态：High Risk

## 3. 必须优先修复的问题

### 3.1 评论内容可能未经审核直接公开

严重程度：High  
置信度：Likely  
类别：UGC

#### 证据

- 在 `/post/ai-travel-planner` 页面观察到评论输入框。
- 页面文案包含 `Post comment`、`Share your thoughts`。
- 前端 bundle 中发现接口路径 `/api/comments/create`。
- 未观察到 `pending`、`review`、`moderation_status`、`approved` 等审核状态信号。
- 未观察到举报、删除、人工复核相关入口。

#### 为什么危险

如果评论提交后立即公开，攻击者可以批量发布广告、诈骗链接、引流账号、违规内容或仇恨言论。对一个刚上线的 AI-built app 来说，这类问题很容易在公开传播后迅速出现，并影响站点信誉。

#### 建议修复

评论创建后默认进入 `pending` 状态。只有 `approved` 评论可以出现在公开 feed 和详情页。后台或简单审核队列可以先人工处理，后续再接入自动审核 API。

#### 可复制给 Cursor / Codex 的修复 prompt

```text
Update the comment publishing flow so new user comments are not publicly visible immediately after submission.

Requirements:
- Add a moderation_status field to comments with values: pending, approved, rejected.
- New comments must default to pending.
- Public comment queries must only return approved comments.
- The comment owner can see their own pending comments with a "pending review" state.
- Add server-side validation so clients cannot set moderation_status directly.
- Add tests for public users, comment owners, and admins.
- Do not expose rejected comments through public API routes.
```

## 4. 图片上传风险

### 4.1 图片上传可能变成公共图床

严重程度：High  
置信度：Likely  
类别：Image Upload

#### 证据

- 在 `/settings/profile` 页面发现头像上传控件。
- 前端 bundle 中出现 `supabase.storage.from("avatars")`。
- 页面加载了公开图片 URL，格式类似 `https://*.supabase.co/storage/v1/object/public/avatars/...`。
- 未观察到 signed URL、过期参数、审核状态字段或隔离 bucket 信号。

#### 为什么危险

如果上传后的图片直接进入 public bucket 并返回永久 URL，攻击者可以把应用当作免费图床，外链到其他网站消耗带宽，也可能上传违规图片让平台承担托管风险。

#### 建议修复

把上传链路改为“隔离区 + 审核 + 受控发布”：

- 上传先进入 private bucket，例如 `avatar-submissions`。
- 限制文件大小、MIME type、图片尺寸。
- 图片通过审核后复制或移动到 public bucket，或用 signed URL 展示。
- 审核失败后删除原文件并给用户提示。
- 对公开图片 URL 增加防盗链或短期访问策略。

#### 可复制给 Cursor / Codex 的修复 prompt

```text
Refactor the avatar upload flow to prevent the app from becoming a public image host.

Requirements:
- Upload new avatar images to a private bucket named avatar-submissions.
- Validate file type, file size, and image dimensions on the server.
- Store avatar records with moderation_status: pending, approved, rejected.
- Do not show pending avatars publicly.
- Only approved avatars should be visible on public profile pages.
- Use signed URLs or a controlled public asset path for approved avatars.
- Add cleanup logic for rejected images.
- Add tests for upload validation and public profile visibility.
```

## 5. AI Chat 风险

### 5.1 AI 输入输出缺少安全护栏信号

严重程度：High  
置信度：Likely  
类别：AI Chat

#### 证据

- 在 `/chat` 页面发现 AI chat 输入框。
- 前端 bundle 中出现 `openai`、`chat.completions`、`/api/chat` 等信号。
- 未观察到 `moderation`、`redact`、`pii`、`guardrail`、`safety_check` 等输入输出安全处理信号。
- 未观察到对用户上传上下文或历史消息的权限说明。

#### 为什么危险

用户可能把手机号、邮箱、客户资料、内部信息、API key 等敏感内容输入 AI chat。如果没有输入脱敏和输出审核，敏感信息可能进入模型调用链路，或者在输出中被重新暴露。不安全输出也可能直接展示给终端用户。

#### 建议修复

在模型调用前增加输入检查，在模型返回后增加输出审核：

- 输入前识别并脱敏手机号、邮箱、身份证号、API key 等敏感信息。
- 对用户 prompt 做安全分类。
- 对模型输出做 moderation。
- 高风险输入或输出进入拒绝、降级或人工复核流程。
- 不把系统 prompt、内部策略、隐私数据传入用户可控上下文。

#### 可复制给 Cursor / Codex 的修复 prompt

```text
Add safety guardrails around the AI chat endpoint.

Requirements:
- Before calling the model, detect and redact common sensitive data such as phone numbers, emails, API keys, and personal identifiers.
- Run a moderation check on user input.
- Do not send raw sensitive values to the model when redaction is possible.
- After receiving the model response, run an output moderation check before returning it to the user.
- If input or output is unsafe, return a safe fallback response.
- Add tests for PII redaction, unsafe input, unsafe output, and normal chat behavior.
```

## 6. 其他发现

### 6.1 验证码发送入口缺少明显防刷信号

严重程度：Medium  
置信度：Suspected  
类别：OTP / Cost Abuse

证据：

- 登录页存在手机号输入和 `Send code` 按钮。
- 未观察到 Turnstile、reCAPTCHA、hCaptcha 或前端节流信号。
- 未确认服务端是否有 per-phone、per-IP 或 per-device 限频。

建议：

- 服务端配置手机号、IP、session 三层限频。
- 对同一手机号短时间重复请求增加冷却时间。
- 对高风险请求增加验证码或 Turnstile。
- 记录发送成功率、失败率、国家区号、IP ASN 等风险信号。

### 6.2 Source map 可能公开

严重程度：Medium  
置信度：Confirmed  
类别：Basic Security

证据：

- 发现可访问资源 `/assets/index-abc123.js.map`。

建议：

- 生产环境关闭 public source map。
- 确认 source map 中没有私有路径、注释、内部 API 或敏感信息。

### 6.3 缺少 Content-Security-Policy

严重程度：Medium  
置信度：Confirmed  
类别：Headers

证据：

- 根页面响应 header 未包含 `Content-Security-Policy`。

建议：

- 添加适合当前资源加载模式的 CSP。
- 至少限制 `script-src`、`object-src`、`frame-ancestors`。

### 6.4 Supabase anon key 出现在前端

严重程度：Low  
置信度：Confirmed  
类别：Supabase

说明：

Supabase anon key 出现在前端本身不一定是漏洞，但如果 RLS 或 storage policy 配置过宽，会放大数据泄露风险。

建议：

- 检查所有公开表是否开启 RLS。
- 检查 storage bucket 是否符合 public/private 预期。
- 确认前端不可直接写入敏感表。

## 7. 修复优先级

建议按这个顺序修：

1. 评论先审后发。
2. 图片上传隔离区和审核状态。
3. AI chat 输入脱敏和输出审核。
4. OTP 服务端限频。
5. 关闭 public source map。
6. 增加 CSP。
7. 检查 Supabase RLS 和 storage policy。

## 8. 复扫检查清单

修复后请重新扫描，并确认：

- 新评论不再直接公开展示。
- 未审核头像不会出现在公开 profile。
- 上传图片不再直接返回永久 public bucket URL。
- AI chat endpoint 有输入和输出安全处理。
- OTP 接口有服务端限频。
- source map 不再公开。
- CSP header 已生效。

## 9. 扫描限制

本次扫描未执行：

- 高频压测。
- 短信真实轰炸测试。
- 登录后深度测试。
- 权限绕过尝试。
- 破坏性 payload。

如需更高置信度，可以提供测试账号并开启 authenticated scan。
