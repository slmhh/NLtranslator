export const HA = "\u54C8"; // 哈

// 4 种零宽字符，每字符编码 2 位二进制
// 均为纯不可见格式字符，不含 bidi 控制符，不改变排版
const TABLE: string[] = [
  "\u200B", // 00
  "\u200C", // 01
  "\u200D", // 10
  "\u2060", // 11
];

const REVERSE = new Map<string, number>(TABLE.map((ch, i) => [ch, i]));

export function encodeToNailong(text: string, haCount?: number): string {
  const zwc = bytesToZwc(new TextEncoder().encode(text));
  if (zwc.length === 0) return "";
  if (haCount !== undefined) {
    return spreadHa(zwc, haCount);
  }
  const n = [...text].length;
  if (n === 1) return HA + zwc + HA;
  return HA + zwc + HA.repeat(n - 1);
}

function spreadHa(zwc: string, haCount: number): string {
  const parts = haCount - 1;
  const base = Math.floor(zwc.length / parts);
  const rem = zwc.length % parts;
  let idx = 0;
  let result = HA;
  for (let i = 0; i < parts; i++) {
    const len = base + (i < rem ? 1 : 0);
    result += zwc.slice(idx, idx + len) + HA;
    idx += len;
  }
  return result;
}

function bytesToZwc(bytes: Uint8Array): string {
  let zwc = "";
  for (const byte of bytes) {
    const groups: number[] = [];
    for (let i = 6; i >= 0; i -= 2) {
      groups.push((byte >> i) & 0b11);
    }
    for (const value of groups) {
      zwc += TABLE[value];
    }
  }
  return zwc;
}

export function decodeFromNailong(input: string): string {
  let zwc = "";
  for (const ch of input) {
    if (ch === HA) continue;
    if (!REVERSE.has(ch)) {
      throw new Error("包含非奶龙语字符，无法解析");
    }
    zwc += ch;
  }
  if (zwc.length === 0) {
    throw new Error("没有可解析的内容");
  }
  if (zwc.length % 4 !== 0) {
    throw new Error("零宽字符数量不是 4 的倍数，内容不完整");
  }
  const bytes = new Uint8Array(zwc.length / 4);
  for (let i = 0; i < bytes.length; i++) {
    const g0 = REVERSE.get(zwc[i * 4]) ?? 0;
    const g1 = REVERSE.get(zwc[i * 4 + 1]) ?? 0;
    const g2 = REVERSE.get(zwc[i * 4 + 2]) ?? 0;
    const g3 = REVERSE.get(zwc[i * 4 + 3]) ?? 0;
    bytes[i] = (g0 << 6) | (g1 << 4) | (g2 << 2) | g3;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}
