# NLtranslator QQ Bot — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a QQ group-chat bot to the existing NLtranslator repo that detects 奶龙语 (cipher text with 哈 + zero-width chars), decodes it, and replies with the original text when @mentioned.

**Architecture:** A standalone Node.js process in `bot/` connects to NapCat via WebSocket for events and HTTP API for sending messages. It directly imports `src/nailong.ts` for translation and uses a simple in-memory cache for "previous message" lookback.

**Tech Stack:** TypeScript (executed via `tsx`), `ws` for WebSocket, Node.js built-in `fetch` for HTTP API calls. Zero bot frameworks.

## Global Constraints

- `src/nailong.ts` must not be modified
- No external bot frameworks (no icqq, oicq, koishi, yunzai)
- All reply text comes from `.env` config
- NapCat connection URLs come from `.env` config
- Runs via `npm run bot`, TypeScript executed directly with `tsx`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `package.json` | Modify | Add `ws` dependency, `tsx` devDependency, `bot` script |
| `tsconfig.json` | Modify | Add `bot/` to `include` |
| `.env.example` | Create | Configuration template for users |
| `bot/config.ts` | Create | Read `.env`, export typed config object |
| `bot/onebot.ts` | Create | OneBot v11 WS client + HTTP API wrapper |
| `bot/handler.ts` | Create | Message processing: detect @Bot, extract 奶龙语, decode, format reply |
| `bot/index.ts` | Create | Entry point: wire config → client → handler, start & handle reconnect |

---

### Task 1: Install dependencies & update package.json

**Files:**
- Modify: `package.json`

**Interfaces:**
- Produces: `npm run bot` script, `ws` importable, `tsx` executable

- [ ] **Step 1: Add `ws` dependency and `tsx` devDependency, add `bot` script**

Read the current `package.json`, then replace it with:

```json
{
  "name": "nl-tranlates",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "bot": "tsx bot/index.ts"
  },
  "dependencies": {
    "ws": "^8.18.0"
  },
  "devDependencies": {
    "tsx": "^4.19.0",
    "typescript": "~5.6.2",
    "vite": "^6.0.7"
  }
}
```

- [ ] **Step 2: Install**

```bash
npm install
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add ws, tsx, and bot script"
```

---

### Task 2: Create config module

**Files:**
- Create: `bot/config.ts`
- Create: `.env.example`

**Interfaces:**
- Produces: `Config` interface, `loadConfig(): Config`

`Config` type:
```typescript
interface Config {
  readonly wsUrl: string;
  readonly httpUrl: string;
  readonly botQQ: string;
  readonly replies: {
    readonly decodeFail: string;
    readonly notFound: string;
    readonly timeout: string;
  };
}
```

- [ ] **Step 1: Create `.env.example`**

```env
# NapCat WebSocket 地址 (事件接收)
NAPCT_WS_URL=ws://127.0.0.1:3001

# NapCat HTTP API 地址 (发送消息)
NAPCT_HTTP_URL=http://127.0.0.1:3000

# Bot 自己的 QQ 号 (用于判断是否被@)
BOT_QQ=123456789

# 回复文案
REPLY_DECODE_FAIL=翻译失败，奶龙语的语法有误哦
REPLY_NOT_FOUND=没有检测到奶龙语，请 @我 + 奶龙语 或引用一条奶龙语消息
REPLY_TIMEOUT=Bot 暂时无法响应，请稍后再试
```

- [ ] **Step 2: Write `bot/config.ts`**

```typescript
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
  let env: Record<string, string>;
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
```

- [ ] **Step 3: Commit**

```bash
git add bot/config.ts .env.example
git commit -m "feat: add config module and .env.example"
```

---

### Task 3: Create OneBot v11 client

**Files:**
- Create: `bot/onebot.ts`

**Interfaces:**
- Consumes: `Config` (from Task 2)
- Produces:
  - `MessageSegment` type: `{ type: string; data: Record<string, string> }`
  - `GroupMessageEvent` type (see code below)
  - `GetMsgResponse` type (see code below)
  - `OneBotClient` class:
    - `constructor(config: Config)`
    - `connect(): Promise<void>` — establish WebSocket, reconnect on close
    - `onGroupMessage(fn: (e: GroupMessageEvent) => void): void`
    - `sendGroupMessage(groupId: number, message: MessageSegment[]): Promise<void>`
    - `getMessage(messageId: number): Promise<GetMsgResponse["data"]>`

- [ ] **Step 1: Write `bot/onebot.ts`**

```typescript
import WebSocket from "ws";
import type { Config } from "./config.ts";

export interface MessageSegment {
  type: string;
  data: Record<string, string>;
}

export interface OneBotEvent {
  post_type: string;
  message_type?: string;
  sub_type?: string;
  message_id: number;
  group_id?: number;
  user_id?: number;
  message: MessageSegment[];
  raw_message: string;
}

export type GroupMessageEvent = OneBotEvent & {
  post_type: "message";
  message_type: "group";
  group_id: number;
};

export interface GetMsgResponse {
  status: string;
  retcode: number;
  data: {
    message_id: number;
    message: MessageSegment[];
    raw_message: string;
  };
}

export class OneBotClient {
  private ws: WebSocket | null = null;
  private handlers: ((e: GroupMessageEvent) => void)[] = [];
  private reconnectCount = 0;
  private maxReconnect = 10;
  private reconnectDelay = 5000;
  private readonly wsUrl: string;
  private readonly httpUrl: string;

  constructor(config: Config) {
    this.wsUrl = config.wsUrl;
    this.httpUrl = config.httpUrl;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.on("open", () => {
        console.log("[onebot] 已连接 NapCat:", this.wsUrl);
        this.reconnectCount = 0;
        resolve();
      });
      this.ws.on("message", (data) => this.handleMessage(data));
      this.ws.on("close", () => {
        console.log("[onebot] 连接断开");
        this.tryReconnect();
      });
      this.ws.on("error", (err) => {
        if (this.ws?.readyState !== WebSocket.OPEN) {
          reject(err);
        } else {
          console.error("[onebot] WebSocket 错误:", err.message);
        }
      });
    });
  }

  onGroupMessage(fn: (e: GroupMessageEvent) => void): void {
    this.handlers.push(fn);
  }

  async sendGroupMessage(
    groupId: number,
    message: MessageSegment[]
  ): Promise<void> {
    const url = `${this.httpUrl}/send_group_msg`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ group_id: groupId, message, auto_escape: false }),
    });
    if (!res.ok) {
      throw new Error(`send_group_msg 失败: HTTP ${res.status}`);
    }
    const body = (await res.json()) as { status: string; retcode: number };
    if (body.status !== "ok" || body.retcode !== 0) {
      throw new Error(`send_group_msg 失败: ${JSON.stringify(body)}`);
    }
  }

  async getMessage(messageId: number): Promise<GetMsgResponse["data"]> {
    const url = `${this.httpUrl}/get_msg`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message_id: messageId }),
    });
    if (!res.ok) {
      throw new Error(`get_msg 失败: HTTP ${res.status}`);
    }
    const body = (await res.json()) as GetMsgResponse;
    if (body.status !== "ok" || body.retcode !== 0) {
      throw new Error(`get_msg 失败: ${JSON.stringify(body)}`);
    }
    return body.data;
  }

  private handleMessage(data: WebSocket.RawData): void {
    try {
      const event = JSON.parse(data.toString()) as OneBotEvent;
      if (
        event.post_type === "message" &&
        event.message_type === "group" &&
        event.sub_type === "normal"
      ) {
        const ge = event as GroupMessageEvent;
        for (const fn of this.handlers) {
          fn(ge);
        }
      }
    } catch {
      // 忽略解析失败的消息
    }
  }

  private tryReconnect(): void {
    if (this.reconnectCount >= this.maxReconnect) {
      console.error("[onebot] 重连次数已达上限，退出");
      process.exit(1);
    }
    this.reconnectCount++;
    console.log(
      `[onebot] ${this.reconnectDelay / 1000}s 后进行第 ${this.reconnectCount} 次重连...`
    );
    setTimeout(() => {
      this.connect().catch(() => {
        // 重连失败由 close 事件再次触发
      });
    }, this.reconnectDelay);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add bot/onebot.ts
git commit -m "feat: add OneBot v11 client with WS and HTTP API"
```

---

### Task 4: Create message handler

**Files:**
- Create: `bot/handler.ts`

**Interfaces:**
- Consumes:
  - `decodeFromNailong` from `../src/nailong.ts`
  - `HA` from `../src/nailong.ts`
  - `OneBotClient` from `./onebot.ts`
  - `GroupMessageEvent`, `MessageSegment` from `./onebot.ts`
  - `Config` from `./config.ts`
- Produces:
  - `MessageCache` class: `add(event: GroupMessageEvent): void`, `getPrevious(groupId: number): GroupMessageEvent | undefined`
  - `createHandler(client: OneBotClient, config: Config): (event: GroupMessageEvent) => Promise<void>`

- [ ] **Step 1: Write `bot/handler.ts`**

```typescript
import { decodeFromNailong, HA } from "../src/nailong.ts";
import type { Config } from "./config.ts";
import type {
  OneBotClient,
  GroupMessageEvent,
  MessageSegment,
} from "./onebot.ts";

const ZWC_RE = /[\u200B-\u200D\u2060]/;

function isNailong(text: string): boolean {
  return text.includes(HA) && ZWC_RE.test(text);
}

function extractNailong(rawMessage: string): string | null {
  if (isNailong(rawMessage)) {
    return rawMessage;
  }
  return null;
}

function findReplySegment(
  message: MessageSegment[]
): { id: string } | null {
  for (const seg of message) {
    if (seg.type === "reply") {
      return seg.data as { id: string };
    }
  }
  return null;
}

function isAtBot(
  message: MessageSegment[],
  botQQ: string
): boolean {
  for (const seg of message) {
    if (seg.type === "at" && seg.data.qq === botQQ) {
      return true;
    }
  }
  return false;
}

export class MessageCache {
  private groups = new Map<number, GroupMessageEvent[]>();
  private maxSize = 10;

  add(event: GroupMessageEvent): void {
    const list = this.groups.get(event.group_id) ?? [];
    list.push(event);
    if (list.length > this.maxSize) {
      list.shift();
    }
    this.groups.set(event.group_id, list);
  }

  getPrevious(groupId: number): GroupMessageEvent | undefined {
    const list = this.groups.get(groupId);
    if (!list || list.length < 2) return undefined;
    return list[list.length - 2];
  }
}

export function createHandler(
  client: OneBotClient,
  config: Config
): (event: GroupMessageEvent) => Promise<void> {
  const cache = new MessageCache();

  return async (event: GroupMessageEvent) => {
    cache.add(event);

    if (!isAtBot(event.message, config.botQQ)) return;

    const nailong = extractNailong(event.raw_message);
    if (nailong) {
      await replyWithTranslation(
        client,
        event.group_id,
        event.message_id,
        nailong,
        config.replies.decodeFail
      );
      return;
    }

    const replySeg = findReplySegment(event.message);
    if (replySeg) {
      try {
        const replied = await client.getMessage(Number(replySeg.id));
        const rn = extractNailong(replied.raw_message);
        if (rn) {
          await replyWithTranslation(
            client,
            event.group_id,
            Number(replySeg.id),
            rn,
            config.replies.decodeFail
          );
          return;
        }
      } catch {
        await replyText(client, event, config.replies.timeout);
        return;
      }
    }

    const prev = cache.getPrevious(event.group_id);
    if (prev) {
      const pn = extractNailong(prev.raw_message);
      if (pn) {
        await replyWithTranslation(
          client,
          event.group_id,
          prev.message_id,
          pn,
          config.replies.decodeFail
        );
        return;
      }
    }

    await replyText(client, event, config.replies.notFound);
  };
}

async function replyWithTranslation(
  client: OneBotClient,
  groupId: number,
  replyToId: number,
  nailongRaw: string,
  decodeFailText: string
): Promise<void> {
  let result: string;
  try {
    result = decodeFromNailong(nailongRaw);
  } catch {
    result = decodeFailText;
  }
  await client.sendGroupMessage(groupId, [
    { type: "reply", data: { id: String(replyToId) } },
    { type: "text", data: { text: `翻译结果：${result}` } },
  ]);
}

async function replyText(
  client: OneBotClient,
  event: GroupMessageEvent,
  text: string
): Promise<void> {
  await client.sendGroupMessage(event.group_id, [
    { type: "reply", data: { id: String(event.message_id) } },
    { type: "text", data: { text } },
  ]);
}
```

- [ ] **Step 2: Commit**

```bash
git add bot/handler.ts
git commit -m "feat: add message handler with translation logic"
```

---

### Task 5: Create bot entry point

**Files:**
- Create: `bot/index.ts`

**Interfaces:**
- Consumes:
  - `loadConfig` from `./config.ts`
  - `OneBotClient` from `./onebot.ts`
  - `createHandler` from `./handler.ts`
- Produces: (runnable process)

- [ ] **Step 1: Write `bot/index.ts`**

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

- [ ] **Step 2: Commit**

```bash
git add bot/index.ts
git commit -m "feat: add bot entry point"
```

---

### Task 6: Update tsconfig to include bot/

**Files:**
- Modify: `tsconfig.json`

- [ ] **Step 1: Update `tsconfig.json` include**

Change `"include": ["src"]` to `"include": ["src", "bot"]`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src", "bot"]
}
```

- [ ] **Step 2: Verify `tsx` can run the bot**

```bash
npx tsx bot/index.ts
```

Expected: Either an error about missing `.env` (meaning code is parsed) or a connection error (if NapCat isn't running).

- [ ] **Step 3: Commit**

```bash
git add tsconfig.json
git commit -m "chore: add bot/ to tsconfig include"
```

---

### Task 7: Manual integration test

**Files:**
- No code changes — verification only

- [ ] **Step 1: Create `.env` from `.env.example`**

```bash
copy .env.example .env
```

Edit `.env` to fill in your QQ number for `BOT_QQ`, keep default WS/HTTP URLs.

- [ ] **Step 2: Start NapCat and verify connection**

Start NapCat on the same machine. Run:

```bash
npm run bot
```

Expected output:
```
[onebot] 已连接 NapCat: ws://127.0.0.1:3001
[bot] NLtranslator Bot 已启动 (QQ: <你的QQ号>)
```

- [ ] **Step 3: Test translation flow**

1. In a QQ group where the bot is present, have someone send: `哈[zero-width chars]...` (use the web app to generate a 奶龙语 string and paste it)
2. Another member @bots the original message
3. Bot should reply with translation

- [ ] **Step 4: Test fail cases**

- @bot with no 奶龙语 → should reply with `REPLY_NOT_FOUND`
- @bot with malformed 奶龙语 → should reply with `REPLY_DECODE_FAIL`

- [ ] **Step 5: Commit** (if .env.example was updated)

```bash
git add .env.example
git commit -m "docs: finalize .env.example"
```
