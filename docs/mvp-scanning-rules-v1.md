# Vibe App Guard MVP 扫描规则 v1

日期：2026-06-06

## 1. 规则设计原则

MVP 第一批规则以“高频、可解释、低误伤、适合上线前报告”为目标。

规则分为三种置信度：

- `confirmed`：扫描器观察到明确证据。
- `likely`：多个信号共同指向风险，但未完成登录态或状态变更验证。
- `suspected`：观察到风险入口，但无法确认服务端是否已有防护。

规则输出不应夸大。对无法确认的服务端逻辑，报告必须使用“可能”“未观察到”“建议确认”等表达。

## 2. Finding 字段

每条规则应能生成：

```json
{
  "id": "string",
  "category": "ugc | image_upload | ai_chat | otp_abuse | storage | auth | headers | secrets | api",
  "severity": "critical | high | medium | low | info",
  "confidence": "confirmed | likely | suspected",
  "title": "string",
  "signals": ["string"],
  "evidence": {},
  "recommendation_template": "string",
  "ai_fix_prompt_template": "string"
}
```

## 3. 基础安全规则

### R-001 missing_csp

类别：headers  
严重程度：Medium  
置信度：Confirmed

触发条件：

- 根页面或主要页面响应 header 缺少 `Content-Security-Policy`。

证据：

- URL。
- response headers。

建议：

- 添加 CSP。
- 优先限制 `script-src`、`object-src`、`frame-ancestors`。

### R-002 missing_hsts

类别：headers  
严重程度：Low  
置信度：Confirmed

触发条件：

- HTTPS 站点响应 header 缺少 `Strict-Transport-Security`。

建议：

- 为生产域名添加 HSTS。

### R-003 missing_frame_protection

类别：headers  
严重程度：Medium  
置信度：Confirmed

触发条件：

- 缺少 `X-Frame-Options`。
- 同时 CSP 中也没有 `frame-ancestors`。

建议：

- 添加 `frame-ancestors 'none'` 或限定可信域名。

### R-004 public_source_map

类别：secrets  
严重程度：Medium  
置信度：Confirmed

触发条件：

- JS 文件包含 `sourceMappingURL`。
- 对应 `.map` 文件可公开访问。

建议：

- 生产环境关闭公开 source map。
- 检查 source map 是否包含内部路径、注释、API endpoint 或敏感信息。

### R-005 suspicious_secret_in_js

类别：secrets  
严重程度：High  
置信度：Likely

触发条件：

- JS bundle 中出现疑似私钥、服务端 token、OpenAI key、Stripe secret key、JWT secret 等模式。

注意：

- 公开 publishable key、Supabase anon key、Firebase config 不应直接判为 secret 泄露。

建议：

- 将服务端密钥移到 server-side environment。
- 前端只保留 publishable 或 anon key。

### R-006 overly_permissive_cors

类别：api  
严重程度：Medium  
置信度：Likely

触发条件：

- API 响应包含 `Access-Control-Allow-Origin: *`。
- 同时观察到 credentials、auth、write endpoint 或 sensitive endpoint 信号。

建议：

- 对需要认证或写入的 API 限制可信 origin。

## 4. 技术栈与存储规则

### R-101 supabase_public_storage_pattern

类别：storage  
严重程度：High  
置信度：Likely

触发条件：

- 页面或 JS 中出现 `supabase.co/storage/v1/object/public`。
- 同时观察到头像、图片上传、文件上传或用户内容展示信号。

建议：

- 检查 bucket 是否应为 public。
- 对用户上传内容使用 private bucket + 审核状态 + signed URL。

### R-102 supabase_anon_key_frontend

类别：storage  
严重程度：Low  
置信度：Confirmed

触发条件：

- JS 中出现 Supabase anon key。

说明：

- anon key 出现在前端不一定是漏洞。

建议：

- 检查 RLS 是否开启。
- 检查 storage policy 是否最小授权。

### R-103 supabase_rls_risk_signal

类别：auth  
严重程度：High  
置信度：Suspected

触发条件：

- 检测到 Supabase。
- 前端直接访问用户数据表相关名称。
- 未观察到 RLS/policy/owner check 相关服务端信号。

建议：

- 确认所有用户数据表开启 RLS。
- 添加 owner-based policy。
- 禁止 anon 角色读取非公开数据。

### R-104 firebase_rules_risk_signal

类别：auth  
严重程度：High  
置信度：Suspected

触发条件：

- 检测到 Firebase。
- 存在 Firestore/Storage 读写路径。
- 未观察到登录态或权限校验信号。

建议：

- 检查 Firestore 和 Storage rules。
- 禁止全局 read/write。

### R-105 public_bucket_without_signed_url

类别：storage  
严重程度：High  
置信度：Likely

触发条件：

- 观察到公开 bucket URL。
- URL 未包含过期签名参数。
- 页面存在用户上传内容。

建议：

- 对用户上传内容使用 signed URL 或受控代理访问。

## 5. UGC 规则

### R-201 profile_fields_public_without_review

类别：ugc  
严重程度：High  
置信度：Likely

触发条件：

- 发现 profile edit 页面。
- 字段包含 nickname、display name、bio、avatar、website 等。
- 发现 public profile 页面。
- 未观察到 pending/review/approved 等审核信号。

建议：

- 公开展示字段先进入审核状态。
- 审核通过后再更新公开 profile。

### R-202 comments_publish_without_review

类别：ugc  
严重程度：High  
置信度：Likely

触发条件：

- 发现评论输入入口。
- 发现评论公开展示区域。
- 未观察到 moderation status。
- 未观察到举报/删除/复核入口。

建议：

- 评论默认 pending。
- 只有 approved 评论公开展示。

### R-203 posts_publish_without_review

类别：ugc  
严重程度：High  
置信度：Likely

触发条件：

- 发现 create post / publish / submit story 入口。
- 存在公开 feed。
- 未观察到审核状态或草稿/复核流程。

建议：

- 用户发布内容先进入 pending 或 limited visibility。
- 高风险内容进入人工复核。

### R-204 ugc_allows_external_links

类别：ugc  
严重程度：Medium  
置信度：Likely

触发条件：

- UGC 输入区域允许富文本、markdown、URL 或 website 字段。
- 未观察到 link policy、nofollow、domain allowlist 或 spam filter。

建议：

- 对外链做风险检测。
- 添加 `rel="nofollow ugc"`。
- 对新用户外链发布做限制。

### R-205 no_report_abuse_flow_detected

类别：ugc  
严重程度：Low  
置信度：Suspected

触发条件：

- 存在公开 UGC。
- 未观察到 report、flag、block、hide 等入口。

建议：

- 为公开 UGC 增加举报入口。
- 为站点所有者提供最小处理后台。

## 6. 图片上传规则

### R-301 file_input_without_visible_constraints

类别：image_upload  
严重程度：Medium  
置信度：Suspected

触发条件：

- 发现 `input[type=file]`。
- 未观察到 accept、size limit、file type validation 文案或服务端信号。

建议：

- 服务端校验 MIME type、扩展名、大小和尺寸。

### R-302 image_upload_public_url_pattern

类别：image_upload  
严重程度：High  
置信度：Likely

触发条件：

- 发现图片上传入口。
- 发现用户图片以 public storage URL 展示。

建议：

- 上传先进入 private staging。
- 审核通过后再公开展示。

### R-303 no_image_moderation_signal

类别：image_upload  
严重程度：High  
置信度：Likely

触发条件：

- 存在头像、封面、帖子图片、商品图等公开图片上传。
- 未观察到 image moderation、review、approved、rejected 等信号。

建议：

- 接入图片审核。
- 对头像和公开图片先审后展。

### R-304 upload_endpoint_may_allow_hotlinking

类别：image_upload  
严重程度：Medium  
置信度：Likely

触发条件：

- 上传图片返回长期公开 URL。
- URL 不带过期签名。
- 未观察到防盗链或代理访问机制。

建议：

- 使用 signed URL、referer/origin 策略、CDN 防盗链或受控 image proxy。

### R-305 executable_file_upload_risk

类别：image_upload  
严重程度：High  
置信度：Suspected

触发条件：

- 文件上传入口未限制 accept。
- 文案显示支持 arbitrary file upload。
- 未观察到服务端类型校验信号。

建议：

- 禁止可执行文件。
- 服务端基于 magic bytes 校验。
- 上传文件隔离存储。

## 7. AI Chat 规则

### R-401 ai_chat_without_input_guardrail_signal

类别：ai_chat  
严重程度：High  
置信度：Likely

触发条件：

- 发现 AI chat 输入入口。
- JS/API 中出现 OpenAI、Anthropic、model、chat、completion 等信号。
- 未观察到 moderation、redact、pii、guardrail 等信号。

建议：

- 模型调用前增加 PII redaction 和 input moderation。

### R-402 ai_output_without_moderation_signal

类别：ai_chat  
严重程度：High  
置信度：Likely

触发条件：

- 发现 AI 输出直接显示给用户。
- 未观察到 output moderation 或 safe fallback 信号。

建议：

- 模型输出返回前做审核。
- unsafe 输出降级为安全回复。

### R-403 prompt_injection_surface_detected

类别：ai_chat  
严重程度：Medium  
置信度：Likely

触发条件：

- AI chat 支持用户自由输入。
- 发现 agent/tool/RAG/browser/search 等能力信号。

建议：

- 对用户输入和外部内容做 prompt injection 防护。
- 明确工具调用权限边界。

### R-404 rag_file_upload_auth_boundary_unclear

类别：ai_chat  
严重程度：High  
置信度：Suspected

触发条件：

- AI 功能支持文件上传或知识库。
- 存在 team/project/document 概念。
- 未观察到 owner/team permission filtering 信号。

建议：

- RAG 检索前按用户权限过滤文档。
- 不把无权限内容送入模型上下文。

### R-405 system_prompt_leakage_signal

类别：ai_chat  
严重程度：Medium  
置信度：Suspected

触发条件：

- 前端 bundle 中出现 system prompt、developer prompt、internal policy 等长文本。

建议：

- 系统提示词应在服务端。
- 不在前端暴露内部策略或隐藏规则。

## 8. OTP 与成本滥用规则

### R-501 otp_without_captcha_signal

类别：otp_abuse  
严重程度：Medium  
置信度：Suspected

触发条件：

- 发现手机号验证码或邮箱验证码发送入口。
- 未观察到 Turnstile、reCAPTCHA、hCaptcha 等信号。

建议：

- 对异常请求增加挑战。
- 不要只依赖前端 captcha，服务端仍需限频。

### R-502 otp_without_visible_rate_limit_signal

类别：otp_abuse  
严重程度：High  
置信度：Suspected

触发条件：

- 存在 send OTP 接口。
- 未观察到 rate limit、cooldown、retry-after、too many requests 等信号。

建议：

- 服务端实现 per-phone、per-IP、per-session 限频。
- 对国家区号和异常失败率设置策略。

### R-503 free_credit_abuse_surface

类别：otp_abuse  
严重程度：Medium  
置信度：Likely

触发条件：

- 页面出现 free credits、trial credits、daily tokens、claim 等信号。
- 同时存在注册/邀请/AI token 消耗功能。

建议：

- 对领取、消耗和邀请奖励增加设备、账号、IP、支付方式或行为限制。

### R-504 invite_reward_abuse_surface

类别：otp_abuse  
严重程度：Medium  
置信度：Likely

触发条件：

- 页面出现 invite、referral、reward、bonus 等信号。

建议：

- 邀请奖励应在被邀请用户完成有效行为后发放。
- 防止自邀请和批量注册。

### R-505 ai_token_cost_endpoint_without_throttle_signal

类别：otp_abuse  
严重程度：High  
置信度：Likely

触发条件：

- 存在 AI chat 或生成接口。
- 未观察到 quota、limit、usage、billing、throttle 等信号。

建议：

- 对用户、IP、会话、项目维度设置 AI 调用额度。
- 对匿名用户限制模型调用。

## 9. Auth 与 API 规则

### R-601 exposed_admin_route

类别：auth  
严重程度：Medium  
置信度：Likely

触发条件：

- 发现 `/admin`、`/dashboard/admin`、`/internal` 等路径。
- 页面可访问或返回非 401/403。

建议：

- 管理后台必须服务端校验角色。
- 不应只靠前端隐藏入口。

### R-602 api_route_without_auth_signal

类别：api  
严重程度：High  
置信度：Suspected

触发条件：

- JS bundle 中发现写入型 API route。
- route 名称包含 create、update、delete、upload、send、generate。
- 未观察到 auth token、session、csrf、role check 信号。

建议：

- 所有写入型 API 做服务端认证和授权。

### R-603 csrf_risk_for_cookie_auth

类别：api  
严重程度：Medium  
置信度：Suspected

触发条件：

- 观察到 cookie-based auth。
- 存在写入型 form/API。
- 未观察到 CSRF token 或 SameSite=strict/lax 相关信号。

建议：

- 使用 SameSite cookie。
- 对敏感写操作增加 CSRF 防护。

### R-604 public_api_key_management_risk

类别：api  
严重程度：Medium  
置信度：Likely

触发条件：

- 应用提供 API key 或 webhook 功能。
- 未观察到 key rotation、scope、rate limit、last used 等信号。

建议：

- API key 应支持 scope、撤销、轮换、调用日志和限频。

## 10. 首批实现顺序

建议第一周实现这些规则：

1. R-001 missing_csp
2. R-004 public_source_map
3. R-005 suspicious_secret_in_js
4. R-101 supabase_public_storage_pattern
5. R-102 supabase_anon_key_frontend
6. R-201 profile_fields_public_without_review
7. R-202 comments_publish_without_review
8. R-302 image_upload_public_url_pattern
9. R-401 ai_chat_without_input_guardrail_signal
10. R-502 otp_without_visible_rate_limit_signal

原因：

- 覆盖面广。
- 容易从公开页面和 JS bundle 观察。
- 和 MVP 定位最相关。
- 能生成有业务价值的报告。

## 11. 规则验收标准

每条规则上线前必须满足：

- 有稳定触发条件。
- 有至少 2 个测试样例。
- 有误报说明。
- 有对应报告模板。
- 有对应修复 prompt。
- 能区分 confirmed/likely/suspected。

## 12. 后续规则增强

下一阶段可增加：

- GitHub repo 规则。
- Supabase SQL/RLS 静态检查。
- Firebase rules 静态检查。
- Next.js route handler auth 检查。
- Vercel env 与 build artifact 检查。
- Authenticated scan 规则。
- 运行时 API 接入建议自动生成。
