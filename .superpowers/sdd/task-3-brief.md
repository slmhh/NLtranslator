### Task 3: Create OneBot v11 client

**Files:**
- Create: `bot/onebot.ts`

**Interfaces:**
- Consumes: `Config` from `./config.ts` (already created in Task 2)
- Produces:
  - `MessageSegment` type: `{ type: string; data: Record<string, string> }`
  - `GroupMessageEvent` type
  - `GetMsgResponse` type
  - `OneBotClient` class with: constructor, connect(), onGroupMessage(), sendGroupMessage(), getMessage()

**Code to write verbatim:**

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
      // ignore parse failures
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
        // reconnect failure will trigger close event again
      });
    }, this.reconnectDelay);
  }
}
```

- [ ] **Commit:**

```bash
git add bot/onebot.ts
git commit -m "feat: add OneBot v11 client with WS and HTTP API"
```
