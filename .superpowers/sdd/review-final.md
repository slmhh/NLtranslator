# Final Code Review — NLtranslator QQ Bot

**Reviewing:** branch `nltr-bot` (commits `f09cdf7` through `09c21e6`)
**Date:** 2026-08-06

---

## Spec Compliance

| Requirement | Status | Notes |
|---|---|---|
| `bot/` directory with 4 files | PASS | `index.ts`, `handler.ts`, `onebot.ts`, `config.ts` |
| `.env.example` at repo root | PASS | All 6 config keys present |
| OneBot v11: WS events + HTTP API | PASS | WS connect + `send_group_msg` / `get_msg` HTTP |
| 奶龙语 detection: `哈` + ZWC | PASS | `isNailong()` checks both |
| Trigger: `@Bot` only | PASS | `isAtBot()` checks message segments |
| Translation sources: inline, reply, cache | PASS* | Inline broken (see Critical #1) |
| Reply format: quote + translation | PASS | Uses `reply` segment type |
| Error: decode fail, timeout, not found | PASS | All use `.env` REPLY_* config |
| Reconnect: max 10, 5s delay | PASS* | Stalls after first failed reconnect (see Important #2) |
| `auto_escape: false` | PASS | Set in `send_group_msg` body |
| `src/nailong.ts` not modified | PASS | Not in diff |
| No external bot frameworks | PASS | Only `ws` dependency |
| Reply text from `.env` | PASS | Fallback chain: .env file → process.env → defaults |
| Runs via `npm run bot` with `tsx` | PASS | Script added to `package.json` |
| `"type": "module"` (ESM) | PASS | Already set in `package.json` |

---

## Issues

### Critical

**1. Inline nailong detection fails — `extractNailong` passes raw_message with @mention/CQ codes to `decodeFromNailong`**

`handler.ts:207` — `extractNailong(event.raw_message)` returns the full raw_message, which in OneBot v11 includes CQ prefix text like `[CQ:at,qq=123456]`. `decodeFromNailong` at `src/nailong.ts:41` throws on any character that is not `哈` and not in the ZWC table. Since `[`, `C`, `Q`, `:`, etc. are not valid nailong characters, the decode always throws → the bot always replies with `REPLY_DECODE_FAIL` for inline nailong messages.

**This means @Bot + inline nailong text never works.** The same issue applies to spaces, punctuation, and any other non-nailong text in the message.

**Fix:** `extractNailong` (or a new helper) must strip the @mention prefix and any non-nailong content from `raw_message` before passing to `decodeFromNailong`. Alternatively, reconstruct the message text from the `message` segments excluding the `at` segment.

---

### Important

**2. Reconnect loop stalls after first failed reconnect attempt**

`onebot.ts:140-143` — When `tryReconnect` calls `this.connect()` and the WS connection fails:
- The `error` event fires → promise rejects (because `readyState !== OPEN`)
- The `.catch(() => {})` silently swallows the error
- **The `close` event does NOT fire** because the socket was never opened

Result: after one failed reconnect, the bot hangs forever. `tryReconnect` is never called again.

**Fix:** In the `.catch()` of `tryReconnect`, call `this.tryReconnect()` again (respecting max retries) so the loop continues on failure. Or handle the case where `connect()` is called from `tryReconnect` differently (e.g., by adding a flag).

**3. Handler promises are not awaited; unhandled rejections**

`onebot.ts:122-124` — The handler is called as:
```typescript
for (const fn of this.handlers) {
    fn(ge);  // returns Promise<void>, not awaited
}
```
If a handler throws (e.g., `sendGroupMessage` fails due to network error), the rejection is unhandled. In modern Node.js this produces warnings; in future versions it could crash the process.

**Fix:** Either `await fn(ge)` (sequential) or `fn(ge).catch(err => console.error(...))`. Sequential is safer for this use case.

---

### Minor

**4. Possible overlapping reconnect timeouts**

`onebot.ts:131-144` — If `close` fires twice within the 5s timeout window, two concurrent `tryReconnect` timeouts are scheduled. Both would call `connect()`, incrementing `reconnectCount` twice for one real disconnect. The second `connect()` overwrites `this.ws` from the first. While `maxReconnect` prevents runaway, the counter is inaccurate and the behavior is undefined.

**Fix:** Add a `reconnecting` boolean guard to prevent overlapping reconnect attempts.

**5. Unnecessary Number↔String roundtrip for reply message ID**

`handler.ts:91,97,142,153` — `findReplySegment` returns `{ id: string }`, which is parsed to `Number(replySeg.id)` (line 91), then converted back to `String(replyToId)` (line 142). The Number conversion is unnecessary since the OneBot API message_id is already a numeric string.

**Fix:** Keep as string throughout, or make `replyToId` accept `string | number` and convert at the send boundary.

**6. Hardcoded `"翻译结果："` prefix in reply**

`handler.ts:143` — The translation reply always prepends `翻译结果：` which is not configurable via `.env`. The spec doesn't require it to be configurable, but other reply texts are. This is a consistency issue for future enhancement.

---

## Code Quality Checklist

| Aspect | Result |
|---|---|
| Imports correct and consistent | PASS — ESM imports with `.ts` extensions, `node:` prefix |
| Error handling adequate | PASS* — See Important #3 |
| YAGNI — no unnecessary code | PASS — All code serves a purpose |
| Security — no shared state mutations | PASS — Config and cache are properly scoped |
| Type safety | PASS — All types defined, readonly interfaces |
| Message cache handles concurrent groups | PASS — `Map<number, ...>` per group, single-threaded JS |
| `src/nailong.ts` unmodified | PASS |

---

## Verdict

**Needs fixes before merge.**

The critical bug (inline nailong detection broken) means the primary use case — "@Bot + 奶龙语" — does not work. The reconnect stall (Important #2) means the bot silently dies after a connection hiccup. Both must be fixed before merge.

Important #3 (unhandled rejections) should also be addressed to prevent production noise and future Node.js compatibility issues.
