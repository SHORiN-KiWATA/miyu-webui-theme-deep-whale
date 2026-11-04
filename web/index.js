// @ts-check
//! 「深海女仆工坊」（大肥鱼）：一套配色方案（挂进 `theme.palettes`）加一个主题（挂进 `skin.packs`），照 Small-tailqwq/dsh-deep-whale 的
//! maid-atelier 移植。对话区铺宫殿大厅（浅色白天、深色夜里），两边站两位鲸鱼娘女仆，进了对话缩小退到后面；左栏是深海蓝底、
//! 金线框、四角花饰、Q 版小人和蕾丝垂饰；回答是半透明的瓷白卡片。样子都在 style.css（只在根上 data-skin="maid" 时生效）。
//! 美术照 CC BY-NC-SA 4.0（包里的 NOTICE、LICENSE-ARTWORK），代码 MIT。

import { mascot } from './deepy.js';

const art = (/** @type {string} */ name) => `url("${new URL(`art/${name}`, import.meta.url).href}")`;

export const tokens = {
  // 对话区的底：宫殿大厅，上下压一层深海蓝（原版补丁的压暗层，浅深各一份）
  // 顶上一条帷幔（海军蓝布、金线）、正中一个蝴蝶结（原版 css:465-512）
  '--stage-bg': {
    light: `${art('bow.webp')} center top 4px / 80px 42px no-repeat, ${art('top-trim-tile.webp')} left top / auto 51px repeat-x, linear-gradient(rgba(9, 19, 51, 0.12), rgba(9, 19, 51, 0.2)), ${art('palace-day.webp')} center bottom / cover no-repeat`,
    dark: `${art('bow.webp')} center top 4px / 80px 42px no-repeat, ${art('top-trim-tile.webp')} left top / auto 51px repeat-x, linear-gradient(rgba(2, 6, 20, 0.32), rgba(2, 6, 20, 0.44)), ${art('palace-night.webp')} center bottom / cover no-repeat`,
  },
  '--stage-fade': 'none',
  '--stage-fade-top': 'none',
  '--page-bg': 'var(--surface)',
  '--side-edge': 'none',
  '--side-width': '272px',
  '--chat-w': '820px',
  '--brand-font': 'Georgia, "Times New Roman", var(--serif)',
  '--brand-size': '18px',
  '--divider': '1px solid color-mix(in srgb, var(--gold) 35%, transparent)',
  '--focus-ring': '1px solid color-mix(in srgb, var(--gold) 86%, white)',
  '--scrollbar-color': 'color-mix(in srgb, var(--gold) 58%, transparent) transparent',
  // 回答
  '--md-code-bg': 'color-mix(in srgb, var(--accent) 16%, var(--surface-1))',
  '--md-code-fg': 'var(--t-md-code)',
  '--md-link': 'var(--link)',
  '--md-quote-border': '3px solid color-mix(in srgb, var(--gold) 70%, transparent)',
  '--md-hr': 'color-mix(in srgb, var(--gold) 50%, transparent)',
  '--md-th-bg': 'color-mix(in srgb, var(--gold) 18%, var(--surface-1))',
  // 材质：浮起来的是瓷白、金边
  '--bubble-bg': 'color-mix(in srgb, var(--surface-2) 95%, transparent)',
  '--bubble-border': '1px solid color-mix(in srgb, var(--gold) 48%, transparent)',
  '--bubble-radius': '18px 18px 7px 18px',
  '--card-border': '1px solid color-mix(in srgb, var(--gold) 42%, transparent)',
  '--codeblock-bg': 'color-mix(in srgb, var(--surface-1) 97%, transparent)',
  '--codeblock-border': '1px solid color-mix(in srgb, var(--gold) 40%, transparent)',
  '--float-bg': 'color-mix(in srgb, var(--surface-1) 96%, transparent)',
  '--float-border': '1px solid color-mix(in srgb, var(--gold) 55%, transparent)',
  '--modal-border': '1px solid color-mix(in srgb, var(--gold) 55%, transparent)',
  '--send-bg': 'linear-gradient(145deg, #6079b5, #294587)',
  '--send-fg': '#ffffff',
  '--send-border': '1px solid #d8bd82',
  '--send-radius': '999px',
  '--btn-primary-bg': 'var(--accent)',
};

/** @param {any} ctx */
export function apply(ctx) {
  // 配色跟着主题走（同 Claude 风格，2026-11-02 项目主人定）：选了这个主题才出现并顺带选上
  /** @type {any} */
  let palette = null;
  /** @type {(() => void)|null} */
  let unPalette = null;
  const syncPalette = () => {
    const on = ctx.skin?.current?.() === 'maid' && palette;
    if (!!unPalette === !!on) return;
    if (unPalette) { unPalette(); unPalette = null; return; }
    unPalette = ctx.slots.mount('theme.palettes', { id: 'maid', name: ctx.text('palette'), order: 30,
      render: (/** @type {'light'|'dark'} */ scheme) => palette[scheme] });
  };
  fetch(new URL('palette.json', import.meta.url)).then((r) => r.json()).then((got) => {
    palette = got;
    syncPalette();
  }).catch((err) => console.warn('深海女仆工坊：读不到配色', err));
  ctx.on('skin.changed', syncPalette);
  ctx.effect(() => () => unPalette?.());
  // 吉祥物的落脚点：输入框外面的蕾丝框、丝带比框高出约 20px，站在框上的照它往上挪（网页的 anchorOffsets，±40px 以内）
  const anchorOffsets = { composer: { dy: -20 } };
  ctx.slots.mount('skin.packs', { id: 'maid', name: ctx.text('name'), order: 30, tokens, palette: 'maid', character: 'deepy', anchorOffsets });

  // 小鲸鱼 Deepy 挂进网页的「吉祥物」（随便搭）；选这个主题时顺带选上它（skin.packs 的 character）
  mascot(ctx);

  // 首页标题「探索未至之境」配鲸鱼圆章，只在选了这个主题时挂（挂载位 stage.home，style.css 把它排到框上面）
  const title = document.createElement('div');
  title.className = 'maid-title';
  const emblem = document.createElement('span');
  emblem.className = 'maid-emblem';
  emblem.append(document.createElement('i'));
  const heading = document.createElement('div');
  heading.className = 'maid-heading';
  heading.textContent = ctx.text('title');
  const rule = document.createElement('span');
  rule.className = 'maid-rule';
  title.append(emblem, heading, rule);
  /** @type {(() => void)|null} */
  let unTitle = null;
  const syncTitle = () => {
    const on = ctx.skin?.current?.() === 'maid';
    if (on === !!unTitle) return;
    if (unTitle) { unTitle(); unTitle = null; return; }
    unTitle = ctx.slots.mount('stage.home', { id: 'maid-title', order: -10, render: () => title });
  };
  syncTitle();
  ctx.on('skin.changed', syncTitle);
  ctx.effect(() => () => unTitle?.());

  // 左栏的会话列表长到底下时 Q 版小人淡下去。列表晚于这个包画出来、会话会增减：每次对话区重画、窗口变了再量
  const busy = () => {
    const root = document.documentElement;
    const list = document.querySelector('.session-list');
    const side = list?.closest('.sidebar');
    const last = list?.lastElementChild?.getBoundingClientRect();
    // 列表最后一行伸进了小人站的那一块（左栏底往上 300px）
    const reach = !!(list && side && last && (list.scrollHeight > list.clientHeight || last.bottom > side.getBoundingClientRect().bottom - 300));
    if (reach) root.dataset.maidBusy = '';
    else delete root.dataset.maidBusy;
  };
  ctx.on('view.changed', () => requestAnimationFrame(busy));
  window.addEventListener('resize', busy);
  ctx.effect(() => () => { window.removeEventListener('resize', busy); delete document.documentElement.dataset.maidBusy; });

  // 左上角的名字（style.css 用它顶替人格的名字），照界面语言
  document.documentElement.style.setProperty('--maid-brand', JSON.stringify(ctx.text('brand')));
  ctx.effect(() => () => document.documentElement.style.removeProperty('--maid-brand'));

  // 两位女仆挤不下时只留右边那位（原版 character-fit.ts：两人之间空不到 32px 算挤，空出 96px 才算不挤，免得拖着来回闪）
  const crowd = new ResizeObserver(([entry]) => {
    const { width, height } = entry.contentRect;
    const empty = /** @type {Element} */ (entry.target).classList.contains('is-empty');
    const scale = empty ? [0.96, 0.92] : [0.64, 0.62];
    const gap = width - 48 - height * (scale[0] * 0.556 + scale[1] * 0.526);
    const root = document.documentElement;
    if (gap < 32) root.dataset.maidCrowd = '';
    else if (gap > 96) delete root.dataset.maidCrowd;
  });
  const stage = document.querySelector('.stage');
  if (stage) crowd.observe(stage);
  ctx.effect(() => () => { crowd.disconnect(); delete document.documentElement.dataset.maidCrowd; });
}
