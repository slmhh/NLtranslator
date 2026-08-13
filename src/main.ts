import "./style.css";
import { encodeToNailong, decodeFromNailong } from "./nailong";

const app = document.querySelector<HTMLDivElement>("#app")!;

app.innerHTML = `
  <div class="wrapper">
    <header class="header">
      <h1>奶龙语翻译器</h1>
      <p class="subtitle">把文字变成一串「哈」，只有奶龙才能看懂</p>
    </header>

    <main class="card">
      <button id="btn-swap" class="swap-btn" type="button" title="切换翻译方向" aria-label="切换翻译方向">
        <span class="swap-icon">⇄</span>
      </button>

      <section class="panel">
        <div class="label-row">
          <label id="source-label" class="label" for="source">自然语言</label>
        </div>
        <textarea id="source" class="textarea" rows="6"
          placeholder="在这里输入要翻译成奶龙语的内容……"></textarea>
        <div class="actions">
          <button id="btn-translate" class="btn btn-primary">翻译成奶龙语</button>
        </div>
        <p id="encode-tip" class="encode-tip"></p>
      </section>

      <section class="panel">
        <div class="label-row">
          <label id="output-label" class="label" for="output">奶龙语言</label>
          <button id="btn-sound" class="sound-btn" type="button" title="播放读音">▶ 读音</button>
        </div>
        <textarea id="output" class="textarea textarea-display" rows="6" spellcheck="false" readonly
          placeholder="翻译结果会显示在这里……"></textarea>
        <div class="actions actions-between">
          <div class="action-left">
            <button id="btn-copy" class="btn btn-ghost" type="button">复制结果</button>
            <label class="ha-label" for="ha-count">
              哈的数量
              <input id="ha-count" class="ha-input" type="number" min="2" max="300"
                placeholder="默认" inputmode="numeric" />
            </label>
          </div>
          <p id="stats" class="stats"></p>
        </div>
      </section>
    </main>

    <div id="toast" class="toast" role="alert" aria-live="polite"></div>

    <section class="usage">
      <h2>使用说明</h2>
      <p>📖 详细教程请访问：<a href="https://www.bilibili.com/video/BV1Tk6ZB3EAE" target="_blank">奶龙语官方指南</a></p>
      <ol>
        <li>在左侧输入想说的话，点击「翻译」，右侧生成一串奶龙语。</li>
        <li>点击右侧「复制结果」，把它发给朋友或发到群里。</li>
        <li>收到奶龙语后，点击顶部 ⇄ 按钮切换到「奶龙语言 → 自然语言」。</li>
        <li>把奶龙语粘贴到左侧，点击「翻译」即可还原。</li>
      </ol>
      <p class="usage-note">提示：复制奶龙语时请完整复制，不要增删或改动任何字符，否则无法还原。</p>
    </section>
  </div>
`;

type Direction = "toNailong" | "toNatural";

const source = document.querySelector<HTMLTextAreaElement>("#source")!;
const output = document.querySelector<HTMLTextAreaElement>("#output")!;
const stats = document.querySelector<HTMLParagraphElement>("#stats")!;
const sourceLabel = document.querySelector<HTMLLabelElement>("#source-label")!;
const outputLabel = document.querySelector<HTMLLabelElement>("#output-label")!;
const swapBtn = document.querySelector<HTMLButtonElement>("#btn-swap")!;
const translateBtn = document.querySelector<HTMLButtonElement>("#btn-translate")!;
const soundBtn = document.querySelector<HTMLButtonElement>("#btn-sound")!;
const toast = document.querySelector<HTMLDivElement>("#toast")!;
const haInput = document.querySelector<HTMLInputElement>("#ha-count")!;
const encodeTip = document.querySelector<HTMLParagraphElement>("#encode-tip")!;

let direction: Direction = "toNailong";
let toastTimer: number | undefined;

const DIRECTION_META: Record<
  Direction,
  {
    source: string;
    output: string;
    sourcePlaceholder: string;
    outputPlaceholder: string;
    translateText: string;
  }
> = {
  toNailong: {
    source: "自然语言",
    output: "奶龙语言",
    sourcePlaceholder: "在这里输入要翻译成奶龙语的内容……",
    outputPlaceholder: "翻译结果会显示在这里……",
    translateText: "翻译成奶龙语",
  },
  toNatural: {
    source: "奶龙语言",
    output: "自然语言",
    sourcePlaceholder: "把收到的奶龙语粘贴到这里……",
    outputPlaceholder: "解码结果会显示在这里……",
    translateText: "翻译为自然语言",
  },
};

function showToast(message: string, variant: "error" | "success" = "error") {
  toast.textContent = message;
  toast.classList.toggle("toast-success", variant === "success");
  toast.classList.add("visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 2500);
}

function showStats(text: string) {
  if (direction !== "toNailong" || text.length === 0) {
    stats.textContent = "";
    stats.classList.add("hidden");
    return;
  }
  let haCount = 0;
  for (const ch of text) {
    if (ch === "\u54C8") haCount++;
  }
  stats.textContent = `共 ${haCount} 个「哈」`;
  stats.classList.remove("hidden");
}

function refreshStats() {
  showStats(output.value);
}

function setOutput(text: string) {
  output.value = text;
  refreshStats();
}

function applyDirection() {
  const meta = DIRECTION_META[direction];
  sourceLabel.textContent = meta.source;
  outputLabel.textContent = meta.output;
  translateBtn.textContent = meta.translateText;
  source.placeholder = meta.sourcePlaceholder;
  output.placeholder = meta.outputPlaceholder;
  swapBtn.classList.toggle("flipped", direction === "toNatural");
  const haLabel = haInput.closest(".ha-label") as HTMLLabelElement;
  haLabel.style.display = direction === "toNailong" ? "flex" : "none";
  encodeTip.textContent = "";
  refreshStats();
}

function parseHaCount(): number | null | undefined {
  const raw = haInput.value.trim();
  if (!raw) return undefined;
  const count = Number(raw);
  if (!Number.isInteger(count) || count < 2 || count > 300) {
    return null;
  }
  return count;
}

const soundUrls = import.meta.glob("./assets/sounds/*.mp3", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

function hashString(text: string): number {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = (((hash << 5) + hash + text.charCodeAt(i)) >>> 0);
  }
  return hash;
}

let currentAudio: HTMLAudioElement | null = null;

function playSoundAt(urls: string[], start: number, tried: number) {
  if (tried >= urls.length) {
    showToast("读音播放失败");
    return;
  }
  const index = (start + tried) % urls.length;
  currentAudio?.pause();
  const audio = new Audio(urls[index]);
  currentAudio = audio;
  let settled = false;
  const markPlaying = () => {
    soundBtn.classList.add("playing");
    soundBtn.textContent = "♪ 播放中";
  };
  const clearPlaying = () => {
    soundBtn.classList.remove("playing");
    soundBtn.textContent = "▶ 读音";
  };
  const fail = () => {
    if (settled) return;
    settled = true;
    clearPlaying();
    playSoundAt(urls, start, tried + 1);
  };
  audio.onerror = fail;
  audio.play()
    .then(() => {
      if (settled) return;
      markPlaying();
      audio.onended = clearPlaying;
    })
    .catch(fail);
}

soundBtn.addEventListener("click", () => {
  if (!output.value) {
    showToast("翻译结果为空，先翻译点什么吧");
    return;
  }
  const urls = Object.values(soundUrls);
  if (urls.length === 0) {
    showToast("没有可播放的声音");
    return;
  }
  const base = source.value || output.value;
  playSoundAt(urls, hashString(base) % urls.length, 0);
});

swapBtn.addEventListener("click", () => {
  const sourceText = source.value;
  source.value = output.value;
  output.value = sourceText;
  direction = direction === "toNailong" ? "toNatural" : "toNailong";
  applyDirection();
});

document.querySelector("#btn-translate")!.addEventListener("click", () => {
  encodeTip.textContent = "";
  const text = source.value;
  if (!text.trim()) {
    setOutput("");
    return;
  }
  if (direction === "toNailong") {
    const count = parseHaCount();
    if (count === null) {
      encodeTip.textContent = "哈的数量需为 2~300 的整数，留空则使用默认数量";
      return;
    }
    setOutput(encodeToNailong(text, count));
    return;
  }
  try {
    setOutput(decodeFromNailong(text));
  } catch {
    setOutput("");
    showToast("翻译失败，奶龙语的语法有误哦");
  }
});

document.querySelector("#btn-copy")!.addEventListener("click", async () => {
  if (!output.value) return;
  try {
    await navigator.clipboard.writeText(output.value);
  } catch {
    output.select();
    document.execCommand("copy");
  }
  showToast("已复制到剪贴板", "success");
});

applyDirection();
