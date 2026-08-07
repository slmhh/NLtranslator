import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface ReplyMessages {
  readonly decodeFail: string;
  readonly notFound: string;
  readonly timeout: string;
}

export interface Config {
  readonly wsUrl: string;
  readonly httpUrl: string;
  readonly botQQ: string;
  readonly replies: ReplyMessages;
}

function parseEnvFile(path: string): Record<string, string> {
  const content = readFileSync(path, "utf-8");
  const map: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    map[key] = value;
  }
  return map;
}

export function loadConfig(): Config {
  const envPath = resolve(process.cwd(), ".env");
  let env: Record<string, string> = {};
  try {
    env = parseEnvFile(envPath);
  } catch {
    console.error("找不到 .env 文件，请从 .env.example 复制并填写配置");
    process.exit(1);
  }

  const wsUrl = env["NAPCT_WS_URL"] ?? process.env["NAPCT_WS_URL"];
  const httpUrl = env["NAPCT_HTTP_URL"] ?? process.env["NAPCT_HTTP_URL"];
  const botQQ = env["BOT_QQ"] ?? process.env["BOT_QQ"];

  if (!wsUrl) {
    console.error("缺少 NAPCT_WS_URL 配置");
    process.exit(1);
  }
  if (!httpUrl) {
    console.error("缺少 NAPCT_HTTP_URL 配置");
    process.exit(1);
  }
  if (!botQQ) {
    console.error("缺少 BOT_QQ 配置");
    process.exit(1);
  }

  return {
    wsUrl,
    httpUrl,
    botQQ,
    replies: {
      decodeFail:
        env["REPLY_DECODE_FAIL"] ??
        process.env["REPLY_DECODE_FAIL"] ??
        "翻译失败，奶龙语的语法有误哦",
      notFound:
        env["REPLY_NOT_FOUND"] ??
        process.env["REPLY_NOT_FOUND"] ??
        "没有检测到奶龙语，请 @我 + 奶龙语 或引用一条奶龙语消息",
      timeout:
        env["REPLY_TIMEOUT"] ??
        process.env["REPLY_TIMEOUT"] ??
        "Bot 暂时无法响应，请稍后再试",
    },
  };
}
