# Fix Report

**Date:** 2026-08-06
**Review:** .superpowers/sdd/review-final.md

## Status: All fixes applied and verified

---

## Fix 1 (Critical): Inline nailong detection broken
**File:** ot/handler.ts
**Applied:** Added stripCQCodes() function that strips OneBot CQ codes from messages. Applied to all three extractNailong call sites (direct message, replied message, previous message).

## Fix 2 (Important): Reconnect loop stalls after failed connect
**File:** ot/onebot.ts
**Applied:** When connect() fails in 	ryReconnect, now calls 	ryReconnect() recursively instead of silently catching.

## Fix 3 (Important): Overlapping reconnect timeouts guard
**File:** ot/onebot.ts
**Applied:** Added econnecting = false field with guard at top of 	ryReconnect. Cleared on timeout fire and on connect failure before recursive call.

## Fix 4 (Important): Handler promises not awaited
**File:** ot/onebot.ts
**Applied:** Made handleMessage async, added individual try/catch per handler with wait, preventing unhandled rejections from bubbling.

## Fix 5 (Minor): Skipped
Number↔String roundtrip was deemed non-critical per instructions.

---

## Verification

- 
px tsc --noEmit → zero errors
- 
px tsx bot/index.ts → expected output (missing .env), no syntax/import errors

## Concerns
None.
