### Task 5: Create bot entry point

**Files:**
- Create: `bot/index.ts`

**Interfaces:**
- Consumes:
  - `loadConfig` from `./config.ts` (Task 2)
  - `OneBotClient` from `./onebot.ts` (Task 3)
  - `createHandler` from `./handler.ts` (Task 4)
- Produces: runnable process

**Code to write verbatim:**

```typescript
import { loadConfig } from "./config.ts";
import { OneBotClient } from "./onebot.ts";
import { createHandler } from "./handler.ts";

const config = loadConfig();
const client = new OneBotClient(config);
client.onGroupMessage(createHandler(client, config));

client
  .connect()
  .then(() => {
    console.log(`[bot] NLtranslator Bot 已启动 (QQ: ${config.botQQ})`);
  })
  .catch((err) => {
    console.error("[bot] 启动失败:", err.message);
    process.exit(1);
  });
```

- [ ] **Commit:**

```bash
git add bot/index.ts
git commit -m "feat: add bot entry point"
```
