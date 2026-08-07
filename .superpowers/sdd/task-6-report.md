## Task 6 Report — Update tsconfig to include bot/

**Status:** Complete

**Change:**
- `tsconfig.json`: changed `"include": ["src"]` → `"include": ["src", "bot"]` (1 line)

**Commit:**
- `8f3d75b` — `chore: add bot/ to tsconfig include`

**Verification:**
- Ran `npx tsx bot/index.ts` — bot booted and immediately errored with `找不到 .env 文件，请从 .env.example 复制并填写配置` (missing `.env` config file). This confirms TypeScript parsed successfully with no syntax errors. The runtime error is expected because no `.env` is configured.

**Concerns:** None.
