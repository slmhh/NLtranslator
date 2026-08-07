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
  private reconnecting = false;
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
        // ❌ 已移除协议标识发送，NapCat 不需要此握手
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
    console.log(`[onebot] 已注册一个处理器，当前共 ${this.handlers.length} 个`);
  }

  async sendGroupMessage(
    groupId: number,
    message: MessageSegment[]
  ): Promise<void> {
    const url = `${this.httpUrl}/send_group_msg`;
    console.log(`[onebot] 发送群消息到 ${groupId}:`, JSON.stringify(message));
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
    console.log("[onebot] 消息发送成功");
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

  private async handleMessage(data: WebSocket.RawData): Promise<void> {
    const raw = data.toString();
    console.log("[onebot] 收到原始数据:", raw);

    try {
      const event = JSON.parse(raw) as OneBotEvent;
      console.log("[onebot] 解析后事件类型:", event.post_type, event.message_type, event.sub_type);

      if (
        event.post_type === "message" &&
        event.message_type === "group" &&
        event.sub_type === "normal"
      ) {
        const ge = event as GroupMessageEvent;
        console.log(`[onebot] 匹配群消息，将分发给 ${this.handlers.length} 个处理器`);
        for (const fn of this.handlers) {
          try {
            await fn(ge);
          } catch (err) {
            console.error("[onebot] 处理器执行错误:", err);
          }
        }
      } else {
        console.log("[onebot] 事件不匹配群消息条件，忽略");
      }
    } catch (err) {
      console.error("[onebot] 解析消息失败:", err);
    }
  }

  private tryReconnect(): void {
    if (this.reconnecting) return;
    this.reconnecting = true;

    if (this.reconnectCount >= this.maxReconnect) {
      console.error("[onebot] 重连次数已达上限，退出");
      process.exit(1);
    }
    this.reconnectCount++;
    console.log(
      `[onebot] ${this.reconnectDelay / 1000}s 后进行第 ${this.reconnectCount} 次重连...`
    );
    setTimeout(() => {
      this.reconnecting = false;
      this.connect().catch(() => {
        this.reconnecting = false;
        this.tryReconnect();
      });
    }, this.reconnectDelay);
  }
};