# NLtranslator QQ Bot — Design Spec

> 基于现有奶龙语翻译器，创建一个 QQ 群聊机器人，自动翻译奶龙语。

## Overview

在 NLtranslator 仓库中新增一个 QQ Bot 进程，通过 NapCat（OneBot v11 协议）接入 QQ 群聊。群成员 @机器人 即可触发翻译，支持三种翻译来源。

## Architecture

```
 ┌─────────┐    WS (事件)    ┌──────────┐   HTTP API    ┌─────────┐
 │  NapCat │ ←────────────── │   Bot    │ ────────────→ │  NapCat  │
 │  (QQ)   │ ──────────────→ │ (Node.js)│ ←──────────── │  (QQ)    │
 └─────────┘   群消息 push    └────┬─────┘  发送消息      └─────────┘
                                  │
                                  │ import
                           ┌──────▼──────┐
                           │  nailong.ts │
                           │ (translater)│
                           └─────────────┘
```

- **NapCat**: 接在用户 QQ 号上，实现 OneBot v11 协议，提供 WebSocket 事件推送和 HTTP API
- **Bot**: 独立 Node.js 进程，通过 `ws` 连接 NapCat 接收事件，通过 HTTP 发送消息
- **nailong.ts**: 复用现有翻译核心，零改动

## Project Structure

```
NLtranslator/                    (现有仓库)
├── bot/                          (新增目录)
│   ├── index.ts                  Bot 入口，启动 & 连接
│   ├── handler.ts                消息处理 & 翻译调度
│   ├── onebot.ts                 OneBot v11 客户端封装
│   └── config.ts                 从 .env 读取配置
├── src/
│   └── nailong.ts                翻译核心 (现有文件，不动)
├── .env.example                  新增，配置模板
├── package.json                  修改，加依赖和脚本
└── tsconfig.json                 修改，include bot/
```

## Communication Protocol

### 接收事件（WebSocket）

Bot 作为 WS 客户端连接 NapCat（`ws://127.0.0.1:3001`），收到 `message.group` 事件时触发处理。

关键字段：
- `message_id`: 用于引用回复
- `group_id`: 发送回复的目标群
- `user_id`: 发送者 QQ
- `message`: CQ 码消息段数组，从中解析 @mention 和文本
- `raw_message`: 纯文本，用于奶龙语检测

### 发送消息（HTTP API）

- `POST /send_group_msg` — 发送群消息（带 `[CQ:reply]` 引用）
- `POST /get_msg` — 获取任意消息详情（用于获取被引用消息内容）

### 奶龙语检测

消息满足以下条件即判定为奶龙语：
1. 包含 `哈` (`\u54C8`)
2. 包含零宽字符 (`[\u200B-\u200D\u2060]`)

## Trigger & Translation Flow

```
群消息事件
  │
  ├─ 消息未被 @Bot → 忽略（但仍缓存该消息）
  │
  └─ 消息被 @Bot →
        │
        ├─ 消息体含奶龙语 → decodeFromNailong() → 引用回复翻译
        │
        ├─ 不含奶龙语，但有 reply 引用 → getMsg() 获取被引用消息
        │     └─ 含奶龙语 → 解码 → 引用回复被引用消息 + 翻译
        │
        ├─ 不含奶龙语，无引用 → 查缓存中的上一条消息
        │     └─ 含奶龙语 → 解码 → 引用回复上一条消息 + 翻译
        │
        └─ 都不含 → 引用回复提示"没有检测到奶龙语"
```

## Reply Format

所有翻译回复均引用原消息：

```
[CQ:reply,id=<原消息ID>]
翻译结果：<解码后文本>
```

错误回复同理，引用告知失败原因。

## Configuration

`.env` 文件（不提交，`.env.example` 作模板）：

```env
NAPCT_WS_URL=ws://127.0.0.1:3001
NAPCT_HTTP_URL=http://127.0.0.1:3000
BOT_QQ=<你的QQ号>
REPLY_DECODE_FAIL=翻译失败，奶龙语的语法有误哦
REPLY_NOT_FOUND=没有检测到奶龙语，请 @我 + 奶龙语 或引用一条奶龙语消息
REPLY_TIMEOUT=Bot 暂时无法响应，请稍后再试
```

## Dependencies

| 包 | 类型 | 用途 |
|------|------|------|
| `ws` | runtime | WebSocket 客户端 |
| `tsx` | dev | 直接执行 TypeScript |

## Error Handling

| 场景 | 行为 |
|------|------|
| NapCat 断连 | 自动重连（5s 间隔），最多 10 次 |
| 解码失败 | 引用回复 `REPLY_DECODE_FAIL` |
| HTTP 请求超时 | 引用回复 `REPLY_TIMEOUT` |
| 无翻译目标 | 引用回复 `REPLY_NOT_FOUND` |
| 未知错误 | console.error 日志，不回复（避免刷屏） |

## Non-Goals

- 不实现私聊翻译
- 不实现编码功能（bot 不解码→编码）
- 不支持多 Bot 实例
- 不做消息持久化

---

## Constraints

- 不改动 `src/nailong.ts`，纯 import 复用
- 不使用任何 Bot Framework（K佬/Yunzai 等），最小依赖原则
- 回复文案从 `.env` 读取，支持自定义
- NapCat 配置（WS/HTTP 地址）从 `.env` 读取
