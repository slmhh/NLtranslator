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
