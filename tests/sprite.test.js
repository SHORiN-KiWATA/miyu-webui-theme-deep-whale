// @ts-check
//! 吉祥物的播放器（web/sprite.js）：切到一段新动画时先把帧图读下来，读完了才换上，这样换的那一下不会闪一下空白。
//! 读失败的照旧换上，不会卡在上一段；换得很快时只认最后一次；读过的帧图再切过去直接换。
//! 这份测试和 sprite.js 一样，两个外观包里各放一份、内容相同。

import { test } from 'node:test';
import assert from 'node:assert/strict';

/** 假的元素：只有播放器用得到的样式、孩子、事件 */
class El {
  constructor() {
    /** @type {Record<string, string>} */
    this.style = {};
    /** @type {Record<string, string>} */
    this.dataset = {};
    /** @type {El[]} */
    this.children = [];
  }
  /** @param {...El} kids */
  append(...kids) { this.children.push(...kids); }
  addEventListener() {}
}

/** 假的图片：记下每一张要读的，读完、读失败由测试来定 */
class FakeImage {
  /** @type {FakeImage[]} */
  static made = [];
  constructor() {
    this.src = '';
    /** @type {() => void} */
    this.ok = () => {};
    /** @type {() => void} */
    this.fail = () => {};
    FakeImage.made.push(this);
  }
  decode() {
    return new Promise((/** @type {(v?: any) => void} */ ok, fail) => { this.ok = ok; this.fail = () => fail(new Error('decode failed')); });
  }
}

const g = /** @type {any} */ (globalThis);
g.document = { createElement: () => new El(), hidden: false };
g.window = { setInterval: () => 0, setTimeout: () => 0 };
g.addEventListener = () => {};
g.removeEventListener = () => {};
g.requestAnimationFrame = () => 0;
g.cancelAnimationFrame = () => {};
g.innerWidth = 1280;
g.innerHeight = 800;
g.Image = FakeImage;

const { character } = await import('../web/sprite.js');

const BASE = 'https://pkg.invalid/mascot/';
const SPEC = {
  id: 'test', grid: [52, 36], cell: 2, ms: 80, ink: true, base: BASE,
  sheets: {
    idle: { frames: 4, box: [24, 20, 24, 16], still: 0 },
    thinking: { frames: 4, box: [14, 4, 34, 32], still: 0 },
    typing: { frames: 4, box: [15, 22, 28, 14], still: 0 },
  },
  map: { idle: 'idle', thinking: 'thinking', writing: 'typing' },
};

/** 装一只：交回它的帧图那一层、换状态的口子 */
function mount() {
  FakeImage.made = [];
  /** @type {(st: {now: string}) => void} */
  let setState = () => {};
  const host = {
    reduced: () => false,
    onState: (/** @type {any} */ fn) => { setState = fn; return () => {}; },
    onActivity: () => () => {},
    onSurface: () => () => {},
    box: () => null,
  };
  const { el, dispose } = character(SPEC)(host);
  const sprite = /** @type {El} */ (/** @type {unknown} */ (el)).children[0];
  const strip = sprite.children[0];
  const ink = strip.children[0];
  return { strip, ink, sprite, state: (/** @type {string} */ now) => setState({ now }), dispose };
}

/** 读某一张帧图（主图和字色那一层都算），交回它们 @param {string} name */
const images = (name) => FakeImage.made.filter((i) => i.src === `${BASE}${name}.png` || i.src === `${BASE}${name}-ink.png`);
/** 让某一段的帧图读完 @param {string} name */
const loaded = async (name) => { for (const i of images(name)) i.ok(); await new Promise((done) => setImmediate(done)); };
/** 让某一段的帧图读失败 @param {string} name */
const failed = async (name) => { for (const i of images(name)) i.fail(); await new Promise((done) => setImmediate(done)); };
/** 帧图那一层现在挂的是哪一段 @param {El} strip */
const showing = (strip) => strip.style.backgroundImage?.match(/\/(\w[\w-]*)\.png/)?.[1] ?? '';

test('一装上先读 idle 的帧图（主图和字色层），读完了才挂上', async () => {
  const m = mount();
  assert.deepEqual(images('idle').map((i) => i.src).sort(), [`${BASE}idle-ink.png`, `${BASE}idle.png`]);
  assert.equal(showing(m.strip), '', '还没读完，不挂帧图');
  await loaded('idle');
  assert.equal(showing(m.strip), 'idle');
  assert.match(m.ink.style.maskImage, /idle-ink\.png/);
  m.dispose();
});

test('切到新的一段：读完以前照旧放上一段，读完了才换上，裁切框也一起换', async () => {
  const m = mount();
  await loaded('idle');
  const idleBox = m.sprite.style.width;
  m.state('thinking');
  assert.equal(showing(m.strip), 'idle', '还没读完，接着放上一段');
  assert.equal(m.sprite.style.width, idleBox, '裁切框也还是上一段的');
  await loaded('thinking');
  assert.equal(showing(m.strip), 'thinking');
  assert.equal(m.sprite.style.width, `${34 * 2}px`);
  m.dispose();
});

test('换得很快时只认最后一次：先切的那段晚读完，也不会盖掉后切的', async () => {
  const m = mount();
  await loaded('idle');
  m.state('thinking');
  m.state('writing');
  await loaded('thinking');
  assert.equal(showing(m.strip), 'idle', '最后要的是 typing，thinking 读完了也不挂');
  await loaded('typing');
  assert.equal(showing(m.strip), 'typing');
  m.dispose();
});

test('读失败的照旧换上，不卡在上一段', async () => {
  const m = mount();
  await loaded('idle');
  m.state('thinking');
  await failed('thinking');
  assert.equal(showing(m.strip), 'thinking');
  m.dispose();
});

test('读过的帧图再切过去直接换，不再读一遍', async () => {
  const m = mount();
  await loaded('idle');
  m.state('thinking');
  await loaded('thinking');
  const before = FakeImage.made.length;
  m.state('idle');
  assert.equal(showing(m.strip), 'idle');
  assert.equal(FakeImage.made.length, before);
  m.dispose();
});
