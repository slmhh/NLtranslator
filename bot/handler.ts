import { decodeFromNailong, HA } from "../src/nailong.ts";
import type { Config } from "./config.ts";
import type {
  OneBotClient,
  GroupMessageEvent,
  MessageSegment,
} from "./onebot.ts";

const ZWC_RE = /[\u200B-\u200D\u2060]/;

function stripCQCodes(rawMessage: string): string {
  return rawMessage.replace(/\[CQ:[^\]]+\]/g, "").trim();
}

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

// 🔧 修改：增加 rawMessage 参数，用于兜底检测
function isAtBot(
  message: MessageSegment[],
  botQQ: string,
  rawMessage: string
): boolean {
  // 1. 检查 message 段中是否有 at 类型
  for (const seg of message) {
    if (seg.type === "at" && seg.data.qq === botQQ) {
      return true;
    }
  }
  // 2. 兜底：检查原始消息文本是否包含 @+QQ号 或 CQ码格式
  if (rawMessage.includes(`@${botQQ}`) || rawMessage.includes(`[CQ:at,qq=${botQQ}]`)) {
    return true;
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
    console.log("[handler] 进入处理器, raw_message:", event.raw_message);
    cache.add(event);

    // 🔧 传入 raw_message 以进行文本匹配
    const isAt = isAtBot(event.message, config.botQQ, event.raw_message);
    console.log("[handler] 是否@我:", isAt);
    if (!isAt) return;

    const cleaned = stripCQCodes(event.raw_message);
    console.log("[handler] 清理后消息:", cleaned);

    const nailong = extractNailong(cleaned);
    console.log("[handler] 是否检测到奶龙语:", !!nailong);
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
    console.log("[handler] 是否引用消息:", !!replySeg);
    if (replySeg) {
      try {
        const replied = await client.getMessage(Number(replySeg.id));
        const rn = extractNailong(stripCQCodes(replied.raw_message));
        console.log("[handler] 引用消息中是否有奶龙语:", !!rn);
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
      } catch (err) {
        console.error("[handler] 获取引用消息失败:", err);
        await replyText(client, event, config.replies.timeout);
        return;
      }
    }

    const prev = cache.getPrevious(event.group_id);
    console.log("[handler] 是否有上一条消息:", !!prev);
    if (prev) {
      const pn = extractNailong(stripCQCodes(prev.raw_message));
      console.log("[handler] 上一条消息是否有奶龙语:", !!pn);
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

    console.log("[handler] 未找到奶龙语，回复 NOT_FOUND");
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
    console.log("[handler] 翻译成功:", result);
  } catch {
    result = decodeFailText;
    console.log("[handler] 翻译失败，使用默认文案");
  }
  try {
    await client.sendGroupMessage(groupId, [
      { type: "reply", data: { id: String(replyToId) } },
      { type: "text", data: { text: `翻译结果：${result}` } },
    ]);
    console.log("[handler] 翻译回复发送成功");
  } catch (err) {
    console.error("[handler] 发送翻译回复失败:", err);
  }
}

async function replyText(
  client: OneBotClient,
  event: GroupMessageEvent,
  text: string
): Promise<void> {
  console.log("[handler] 回复文本:", text);
  try {
    await client.sendGroupMessage(event.group_id, [
      { type: "reply", data: { id: String(event.message_id) } },
      { type: "text", data: { text } },
    ]);
    console.log("[handler] 文本回复发送成功");
  } catch (err) {
    console.error("[handler] 发送文本回复失败:", err);
  }
};