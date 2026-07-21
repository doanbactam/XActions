# XActions — SaaS Backend Agent (chuẩn 2027)

> **Trạng thái:** Design approved (hướng Full SaaS backend)  
> **Scope v1:** Trợ lý AI **100% backend tập trung**, **nuôi 1 user** (single primary operator) trước  
> **Không phải v1:** multi-tenant scale, multi-region, proxy pool lớn, Web Store mass-engagement, deprecate code CLI/extension local

---

## 1. Quyết định & ngữ cảnh

### 1.1 Đã chốt

| Quyết định | Nội dung |
|---|---|
| Runtime AI | **100% server** — LLM tool-calling, automation, session X, job queue chạy backend |
| Client | Extension / Dashboard / MCP (sau) chỉ **UI + auth + xem progress** |
| Default path | User **không** cần Node/CLI để dùng trợ lý AI |
| CLI / browser-paste / extension DOM agent | **Advanced / optional / legacy** — không phải source of truth |
| Scale v1 | **1 app user + ≥1 X session** end-to-end trước multi-tenant |

### 1.2 Vấn đề hiện trạng (tiến hóa, không viết lại từ zero)

| Hiện có | Hạn chế so với target |
|---|---|
| `User.sessionCookie` (Prisma) | Lưu cookie dạng field user, **chưa** encrypt-at-rest / multi-session model |
| `Operation` + `queueJob` + Bull (`api/services/jobQueue.js`) | Đã là đúng hướng job; agent chat **chưa** là entrypoint chính tạo Operation |
| `api/services/browserAutomation.js` | Puppeteer + stealth — worker runtime thật |
| `api/routes/operations.js` | Enqueue unfollow/like/… với `sessionCookie` từ `req.user` |
| `api/routes/agent.js` | Thought Leader **in-process** (start/stop agent process) — **không** phải chat assistant SaaS |
| Extension `extension/agent/*` | Grok OAuth + tool loop **local** (SW) — logic **port** lên server sau, không dual source of truth lâu dài |

Design này **tiến hóa** stack hiện có: encrypt session, tách `XSession`, agent chat tools → `Operation`/queue, client mỏng.

---

## 2. Kiến trúc (client → API → agent → worker → X)

```
┌────────────────┐  ┌────────────────┐  ┌─────────────────┐
│ Extension      │  │ Dashboard      │  │ MCP Remote      │
│ (thin UI)      │  │ (web)          │  │ (phase sau)     │
└───────┬────────┘  └───────┬────────┘  └────────┬────────┘
        │ JWT               │ JWT                │ API key/JWT
        └───────────────────┼────────────────────┘
                            ▼
                 ┌──────────────────────┐
                 │ Express API :3001    │
                 │ auth · rate limit    │
                 │ /api/sessions        │
                 │ /api/operations      │
                 │ /api/agent/chat      │
                 │ Socket.IO progress   │
                 └──────────┬───────────┘
                            │
           ┌────────────────┼────────────────┐
           ▼                ▼                ▼
    Agent service     Operations CRUD    (Billing later)
    chat + tools      enqueue only
           │                │
           │    tool: start_operation
           └────────► Operation row
                            │
                            ▼
                     Bull queue (Redis)
                     api/services/jobQueue.js
                            │
                            ▼
                     Worker / processors
                     browserAutomation.js
                     + operations/puppeteer/*
                            │
                            ▼
                     X session (decrypt in memory)
                     → x.com via Puppeteer
```

### 2.1 Nguyên tắc ranh giới

| Thành phần | Được làm | Không được làm (default path) |
|---|---|---|
| **Client** | Login app, gắn X session, chat, list/cancel job, xem Socket progress | Chạy unfollow/like logic; LLM tool loop làm SoT; giữ cookie plaintext lâu dài trên client làm nguồn chính |
| **API** | Validate JWT, encrypt/decrypt boundary, tạo Operation, agent chat | Block request hàng giờ trong HTTP handler (job dài → queue) |
| **Agent service** | LLM + tools; tool side-effect = Operation/queue hoặc draft-only | Gọi DOM extension; side-effect “êm” không audit |
| **Worker** | Puppeteer actions, update Operation status/result | Expose cookie ra log/response |

### 2.2 Luồng trợ lý AI 100% (happy path — 1 user)

1. Operator đăng nhập app (`/api/auth/*`).
2. Gắn **một** X session (`POST /api/sessions`) — cookie encrypt at rest.
3. Chat: `POST /api/agent/chat` `{ threadId?, message }`.
4. Agent service: system persona + history → LLM (tool-calling).
5. Tool `start_operation` → `prisma.operation.create` + `queueJob({ type, operationId, userId, config })`.
6. Worker lấy job, decrypt session **in-memory**, chạy `browserAutomation` / puppeteer processors.
7. Cập nhật `Operation.status|result`; Socket.IO push `operation:progress` / `operation:done`.
8. Agent (cùng turn hoặc follow-up) đọc status tool / list operations → trả lời user.

**Source of truth cho action thật:** hàng `Operation` + queue — **không** phải content script extension.

---

## 3. Trợ lý AI 100% — agent loop, tools, audit

### 3.1 Agent loop (server)

```
messages = [system, ...thread, user]
for round in 1..MAX_TOOL_ROUNDS (e.g. 6):
  completion = LLM(messages, tools)
  if no tool_calls:
    persist assistant message; return
  for each tool_call:
    result = executeTool(name, args, ctx)  // ctx: userId, sessionId, safety
    audit_log(tool, args_redacted, result_summary, operationId?)
    messages += tool result
```

- **LLM provider v1 (1 user):** xAI OAuth token của operator **hoặc** `XAI_API_KEY` / OpenRouter env trên server (chọn một primary trong config; document rõ billing).
- Model gợi ý: `grok-4.5` (alias `grok-4-5-medium` → canonical id).
- Port logic từ `extension/agent/{llm,tools,agent-core,xai-oauth}.js` → `api/services/agent/*` (implement phase sau).

### 3.2 Server-side tools tối thiểu (v1)

| Tool | Side effect | Ghi chú |
|---|---|---|
| `list_sessions` | read | X accounts đã gắn |
| `get_session_health` | read | active / expired / challenged |
| `list_operations` | read | filter status/type |
| `get_operation` | read | progress + result summary |
| `start_operation` | **write** → Operation + queue | type ∈ whitelist (xem dưới) |
| `cancel_operation` | **write** | map cancelledJobs / status cancelled |
| `scrape_profile` | write (short job) hoặc sync limited | Prefer queue nếu > few seconds |
| `scrape_timeline_sample` | read/job | Sample N tweets — không spam |
| `draft_tweet` | **LLM only** | `posted: false` luôn |
| `draft_reply` | **LLM only** | `posted: false` luôn |
| `get_agent_persona` / `update_agent_persona` | config | Persona 1 operator |
| `get_safety_limits` | read | maxActions, dryRun default |

**Whitelist `start_operation` types (v1, map jobQueue hiện có):**

- `unfollowNonFollowers`, `unfollowEveryone`, `detectUnfollowers`
- `autoLike`, `followEngagers`, `keywordFollow`, `autoComment`

(Mở rộng sau khi processor ổn định.)

### 3.3 Draft vs action thật

| Hạng | Hành vi |
|---|---|
| **Draft** (`draft_tweet`, `draft_reply`) | Chỉ text; agent **không** được claim đã đăng |
| **Action** (`start_operation`) | Tạo job; response gồm `operationId`, `status: queued` |
| **High-risk** (unfollow everyone, mass follow) | Default `dryRun: true` trừ user/config explicit; cap `maxActions` từ safety |
| **Post thật** (`post_tweet`) | **Không** v1 default — phase sau + confirm/opt-in |

### 3.4 Audit

Mỗi tool call ghi (DB hoặc structured log):

- `userId`, `threadId`, `tool`, `args` (redact secrets), `resultSummary`, `operationId?`, `ts`
- Không bao giờ log full cookie / access_token / refresh_token

---

## 4. Nuôi 1 user trước (single-operator constraints)

### 4.1 Must ship (v1)

| Mục | Outcome |
|---|---|
| 1 app `User` | Primary operator (env seed hoặc register một lần) |
| ≥1 `XSession` | Cookie X gắn user, encrypt at rest |
| Chat agent | `POST /api/agent/chat` end-to-end |
| ≥3 operation types | Enqueue + worker complete/fail thật (e.g. detectUnfollowers, autoLike, unfollowNonFollowers dryRun) |
| Progress | GET operation + Socket event |
| Revoke session | Wipe encrypted cookie |

### 4.2 Explicitly NOT v1

| Hoãn | Lý do |
|---|---|
| Multi-tenant isolation / org seats | Sau khi 1 user ổn định |
| Proxy pool per tenant / multi-region workers | Cost + complexity |
| Web Store public mass-engagement extension | Policy risk |
| Full MCP remote production | Sau agent API ổn |
| SOC2 formal | Process sau product-market |
| Deprecate/xóa CLI & local extension code | Docs-only de-emphasize trước |

### 4.3 Single-operator runtime assumptions

- **1 browser singleton** (`browserAutomation.js` pattern) chấp nhận được cho 1 user.
- **1 Redis queue** `operations` prefix `xactions`.
- **1 primary X handle** documented trong config/persona.
- Concurrency: serialize jobs cùng session (tránh 2 unfollow song song một cookie).

---

## 5. Bảo mật cookie X (tối thiểu)

| Yêu cầu | Outcome |
|---|---|
| **Encrypt at rest** | AES-256-GCM (hoặc tương đương); key từ env `SESSION_ENCRYPTION_KEY` (32 bytes); ciphertext + iv + tag trong DB |
| **Decrypt scope** | Chỉ worker / agent service trong process memory khi chạy job |
| **No plaintext log** | Middleware/logger redact `sessionCookie`, `cookieEnc`, `Authorization` |
| **API responses** | Không trả raw cookie; list session chỉ metadata (username, status, lastUsed) |
| **Revoke / wipe** | `DELETE /api/sessions/:id` xóa row + optional browser context clear |
| **Transport** | HTTPS production; JWT short-lived |
| **Access control** | Mọi session/operation scoped `userId === req.user.id` (dù v1 chỉ 1 user — code path đúng) |

**Tiến hóa từ hiện tại:** field `User.sessionCookie` plaintext-ish → model `XSession.cookieEnc` (hoặc encrypt in-place + migration). Design **không** giả hệ đã clean.

---

## 6. Data model gợi ý (outcome-level)

Không freeze tên file implement; fields mang tính contract:

### 6.1 Giữ / dùng tiếp (đã có)

- `User` — app identity, credits, JWT subject (`prisma/schema.prisma`)
- `Operation` — type, status, config, result, creditsUsed, retryCount
- `JobQueue` — persistence hỗ trợ queue (nếu dùng song song Bull)
- `Subscription` — later billing; v1 có thể ignore

### 6.2 Thêm (implement phase)

**XSession**

- `id`, `userId`, `label`, `username?`, `cookieEnc`, `status` (`active|expired|challenged`), `lastUsedAt`, timestamps

**AgentThread / AgentMessage**

- Thread per operator; messages role `user|assistant|tool`; optional `toolTrace` JSON

**AgentAudit** (hoặc log table)

- tool calls as above

**Persona / Safety config**

- JSON file hoặc bảng `AgentConfig` 1 row per user (map extension defaults: maxActionsPerTurn, dryRunDefault)

---

## 7. API surface v1 (tối thiểu)

| Method | Path | Việc |
|---|---|---|
| `POST` | `/api/auth/register` · `/login` · `/refresh` | App user (đã có mầm `api/routes/auth.js`) |
| `POST` | `/api/sessions` | Body: cookie material → encrypt store |
| `GET` | `/api/sessions` | List metadata |
| `DELETE` | `/api/sessions/:id` | Revoke/wipe |
| `POST` | `/api/operations` | Generic enqueue **hoặc** giữ routes typed hiện có + unify |
| `GET` | `/api/operations` · `/:id` | List / detail |
| `POST` | `/api/operations/:id/cancel` | Cancel |
| `POST` | `/api/agent/chat` | `{ threadId?, message }` → assistant + toolTrace + operationIds |
| `GET` | `/api/agent/threads` · `/:id` | History |
| `GET` | `/api/agent/tools` | Catalog tools (discovery cho UI/MCP sau) |
| Socket | `operation:progress` · `operation:done` · `agent:event` | Realtime (`api/realtime/`) |

**Tương thích:** routes `api/routes/operations.js` typed (`/unfollow-non-followers`, …) có thể wrap cùng `queueJob`; agent tools gọi cùng service layer — không fork hai pipeline.

**Không** lấy `api/routes/agent.js` thought-leader start/stop làm chat path. Có thể:

- Giữ thought-leader dưới `/api/agent/growth/*` (rename dần), **hoặc**
- Document clearly: “legacy growth agent” vs “assistant chat” `/api/agent/chat`.

---

## 8. Map sang code hiện có

| Artifact | Path / role | Design sử dụng |
|---|---|---|
| Schema User / Operation / JobQueue / **XSession** | `prisma/schema.prisma` | Phase A shipped: XSession + Operation.sessionId |
| sessionCrypto | `api/utils/sessionCrypto.js` | AES-256-GCM encrypt/decrypt + redact |
| xSessionService | `api/services/xSessionService.js` | create/list/resolve/revoke |
| operationService | `api/services/operationService.js` | unified enqueue → Operation + queueJob |
| Sessions API | `api/routes/sessions.js` → `/api/sessions` | CRUD metadata only |
| sessionCookie trên User | `User.sessionCookie` | Sync legacy + fallback resolve |
| HTTP server mount | `api/server.js` (`/api/operations`, `/api/agent`, `/api/session`, Socket) | Gateway |
| Auth JWT | `api/middleware/auth.js` | Client → API |
| Operations enqueue | `api/routes/operations.js` + `queueJob` | Action path |
| Job queue Bull | `api/services/jobQueue.js` | Workers, cancel set |
| Browser automation | `api/services/browserAutomation.js` | Puppeteer core |
| Puppeteer processors | `api/services/operations/puppeteer/*` | Job runners |
| Thought leader API | `api/routes/agent.js` | **Legacy growth** — không SoT chat |
| Thought leader impl | `src/agents/thoughtLeaderAgent.js` | Optional later; không block v1 chat |
| Session auth routes | `api/routes/session-auth.js` | Evolve / align with `/api/sessions` |
| Extension agent | `extension/agent/*`, popup Agent tab | Thin client → `/api/agent/chat` (phase port) |
| Architecture overview | `docs/architecture.md` | Bổ sung con trỏ sang doc này |
| AI modular API | `api/routes/ai/*` | Capability surface; agent tools có thể delegate |

### 8.1 Không bịa module

Mọi path trên **đã tồn tại** trong repo tại thời điểm design. Service mới (`api/services/agent/`, encrypt util) là **target implement**, không claim đã ship.

---

## 9. Phases implement (sau design)

| Phase | Outcome | Ghi chú |
|---|---|---|
| **A — Nền** ✅ | `XSession` encrypt + CRUD; mọi job dài qua Operation+queue; 1 user seed | Shipped: `api/utils/sessionCrypto.js`, `api/services/xSessionService.js`, `api/services/operationService.js`, `POST/GET/DELETE /api/sessions`, operations enqueue unified |
| **B — Agent backend** ✅ | `POST /api/agent/chat` + tools → Operation; thread store; audit | Shipped: `api/services/agent/*`, `api/routes/assistantChat.js`, Operator Console chat UI |
| **C — Client mỏng** | Extension/Dashboard chat remote; Socket progress | Local DOM agent optional |
| **D — Polish** | Persona UI, safety caps, basic credits optional | Chưa multi-tenant |
| **E — Later** | MCP remote, multi-session scale, proxy, multi-region | Ngoài v1 |

**CLI:** không xóa code; docs/default path = API + UI. Fat CLI logic không phát triển thêm trên path AI assistant.

---

## 10. Success criteria (1 user)

1. Operator chỉ cần browser (dashboard hoặc extension thin) + backend đang chạy.  
2. Gắn X session → chat “detect unfollowers dryRun” → thấy `operationId` queued → worker complete → đọc result.  
3. Cookie không plaintext trong DB/log/API response.  
4. Draft tools không post; action tools chỉ qua Operation.  
5. Thought-leader in-process **không** bắt buộc để chat assistant hoạt động.

---

## 11. Chuẩn 2027 (ngắn)

| Chủ đề | Áp dụng v1 (1 user) |
|---|---|
| Agent-native API | Chat + tool catalog + durable jobs |
| Durable work | Operation + Bull (attempts/backoff đã có) |
| Secret handling | Encrypt at rest, redact logs |
| Observability | Structured audit tool + operation status (OTel full = later) |
| Protocol openness | REST + Socket; MCP remote later cùng tools |
| Least privilege | Session scoped user; high-risk dryRun default |

---

## 12. Non-goals (nhắc lại)

- Implement Phase A/B trong goal design này.  
- Multi-region, proxy pool per tenant, SOC2.  
- Web Store shipping mass automation.  
- Full OpenAPI rewrite / billing redesign.  
- Xóa CLI hay extension local.

---

## 13. Tài liệu liên quan

- `docs/architecture.md` — high-level monorepo  
- `docs/agent-architecture.md` / `docs/agent-system.md` — thought leader (growth)  
- `extension/README.md` — extension agent local (port source)  
- `prisma/schema.prisma` — User / Operation / JobQueue  

---

*Design for single-operator, backend-only AI assistant. Implementers: follow phases; do not treat multi-tenant scale as v1 gate.*
