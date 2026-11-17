// @ts-check
//! 像素吉祥物的身子（sprite.js 用，Claude 风格的螃蟹、大肥鱼的 Deepy 共用这一份，各包里各放一份）：照网页那只 Deniro 的手感
//! （网页仓库 packages/mascot/body.js）做一份精简的，只管脚底在哪，不碰页面。
//! - 站在网页交的那条边上（输入框，或者框里弹出来的命令列表），平常站在离右头 `right` 的那一格。
//! - 边升上来（打开命令列表）：一路被推上去，差的那一截照半衰期缓、最快每秒 RISE_PX_S；往下挪一点（SNAP_PX 以内）也慢慢跟下去。
//! - 边往下挪多了（命令列表收起）、没了：照重力掉下去，落到下面的边上或整页底边上。
//! - 输入框自己挪了、变了大小（开关左栏、首页换成对话、改窗口）：当场跟着，同 Deniro 站在输入框上。
//! - 左键（手指）按住拖：跟着指针走，出不了窗口；松手照拖的速度扔出去往下掉，拖到地方停住再松手的轻轻放下。
//! - 不在平常那一格（掉在地上、放在边上别处）的，待一阵自己跳回去。
//! - 少动效的：被推、掉、跳都当场到位。
//! 坐标都是屏幕像素；`x` 是脚底中点，`y` 是脚底。

/** 重力（像素每平方秒）、被推上去最快多快、往下挪多少以内跟着挪、被推的半衰期（毫秒），同 Deniro 的出厂设置 */
export const GRAVITY = 2600;
export const RISE_PX_S = 900;
export const SNAP_PX = 40;
const HALF_LIFE_MS = 45;
/** 挪多远算拖、松手最快扔多快、跳回去比高的那头再高多少 */
export const DRAG_PX = 4;
const MAX_THROW = 1400;
const LEAP_EXTRA = 28;
/** 不在平常那一格时待多久跳回去（毫秒，在这之间随机） */
export const STAY_MS = [8000, 20000];

/** @typedef {{top: number, left: number, right: number}} Edge 站的那条边 */

/** 被推着、还没跟上的那一截缓到 0：照半衰期缓，一帧最多走 RISE_PX_S 那么快，不到 0.3 像素的算到了 @param {number} lag @param {number} dt 毫秒 */
export function settle(lag, dt) {
  if (Math.abs(lag) <= 0.3) return 0;
  const next = lag * 0.5 ** (dt / HALF_LIFE_MS);
  return Math.sign(lag) * Math.max(Math.abs(next), Math.abs(lag) - (RISE_PX_S * dt) / 1000);
}

/** 从 (x, y) 跳到 (tx, ty)：比高的那头再高 LEAP_EXTRA，交回起跳的速度和要多久（秒） */
export function leap(/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ tx, /** @type {number} */ ty) {
  const top = Math.min(y, ty) - LEAP_EXTRA;
  const up = Math.sqrt(2 * GRAVITY * (y - top));
  const t = up / GRAVITY + Math.sqrt((2 * (ty - top)) / GRAVITY);
  return { vx: (tx - x) / t, vy: -up, t };
}

export class Body {
  /**
   * @param {{width: number, right: number, view: () => {w: number, h: number}, reduced: () => boolean}} room
   *   身子多宽、平常离边的右头多远、窗口多大、少动效
   */
  constructor(room) {
    this.room = room;
    /** 站在哪：`edge` 那条边（`dx` 离右头多远，`lag` 画的时候还差多少没跟上）、`floor` 整页底边、`air` 在空中、`drag` 被拖着 */
    this.mode = /** @type {'edge'|'floor'|'air'|'drag'} */ ('edge');
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.dx = room.right + room.width / 2;
    this.lag = 0;
    /** 这一回的边（没有的是 null：输入框被整页的东西盖住了）、它是不是输入框本身 @type {Edge|null} */
    this.edge = null;
    this.onBox = false;
    /** 拖：抓的地方离脚多远、上一次指针在哪、什么时候、速度、挪够了没有 */
    this.drag = /** @type {{ox: number, oy: number, px: number, py: number, t: number, vx: number, vy: number, moved: boolean}|null} */ (null);
    /** 什么时候跳回平常那一格（不在那一格时才有）；在往回跳（落到边上就站回那一格，帧和帧之间差的那一点不算） @type {number|null} */
    this.backAt = null;
    this.homing = false;
  }

  /** 平常那一格离右头多远 */
  get homeDx() { return this.room.right + this.room.width / 2; }

  /** 站在平常那一格上（不在的话网页不照它给框上面那一行让位） */
  home() { return this.mode === 'edge' && Math.abs(this.dx - this.homeDx) < 1; }

  /** 这一帧画在哪（站在边上的照边算，加上还没跟上的那一截） */
  where() {
    if (this.mode === 'edge' && this.edge) return { x: this.edge.right - this.dx, y: this.edge.top + this.lag };
    return { x: this.x, y: this.y };
  }

  /** 还要不要接着推帧 */
  moving() { return this.mode === 'air' || this.mode === 'drag' || (this.mode === 'edge' && this.lag !== 0); }

  /**
   * 网页交了新的边：站在边上的，边升上来记下差的那一截慢慢缓上去；往下挪一点的慢慢跟；挪多了、没了的掉下去。前后都是输入框本身
   * （`box`：不是框里弹出来的列表）的当场跟着。
   * @param {Edge|null} next @param {boolean} [box]
   */
  setEdge(next, box = false) {
    const was = this.edge;
    const wasBox = this.onBox;
    this.edge = next;
    this.onBox = box;
    if (this.mode !== 'edge') return;
    if (!was || !next) {
      // 第一次、或者边回来了：直接站上去；边没了：原地掉下去（藏不藏由外面看 edge）
      if (!next && was) this.fall(was.right - this.dx, was.top + this.lag);
      this.lag = 0;
      return;
    }
    // 站的那一点出了边（边变窄了）：从边上掉下去
    if (next.right - this.dx < next.left) { this.fall(was.right - this.dx, was.top + this.lag); return; }
    const d = next.top - was.top;
    if (box && wasBox) return;
    if (this.room.reduced()) this.lag = 0;
    else if (d <= SNAP_PX) this.lag -= d;
    else this.fall(was.right - this.dx, was.top + this.lag);
  }

  /** 从 (x, y) 开始往下掉 */
  fall(/** @type {number} */ x, /** @type {number} */ y) {
    Object.assign(this, { mode: 'air', x, y, vx: 0, vy: 0, lag: 0 });
  }

  /** 按下：抓住（还不算拖，挪够 DRAG_PX 才算） @param {number} px @param {number} py @param {number} now */
  grab(px, py, now) {
    const { x, y } = this.where();
    this.drag = { ox: x - px, oy: y - py, px, py, t: now, vx: 0, vy: 0, moved: false };
    this.homing = false;
  }

  /** 拖着挪：交回是不是这一下才开始拖 @param {number} px @param {number} py @param {number} now */
  dragTo(px, py, now) {
    const d = this.drag;
    if (!d) return false;
    const dt = Math.max(1, now - d.t) / 1000;
    d.vx = 0.6 * d.vx + 0.4 * ((px - d.px) / dt);
    d.vy = 0.6 * d.vy + 0.4 * ((py - d.py) / dt);
    Object.assign(d, { px, py, t: now });
    const at = this.where();
    if (!d.moved && Math.hypot(at.x - d.ox - px, at.y - d.oy - py) < DRAG_PX) return false;
    const started = !d.moved;
    d.moved = true;
    const { w, h } = this.room.view();
    const half = this.room.width / 2;
    Object.assign(this, { mode: 'drag', x: clamp(px + d.ox, half, w - half), y: clamp(py + d.oy, 0, h), lag: 0, backAt: null });
    return started;
  }

  /** 松手：拖过的照拖的速度扔出去（停住过一会儿的速度消掉），交回 true；没拖动的交回 false（算点了一下） @param {number} now */
  release(now) {
    const d = this.drag;
    this.drag = null;
    if (!d?.moved) return false;
    const still = now - d.t;
    const k = still > 50 ? Math.exp(-(still - 50) / 60) : 1;
    Object.assign(this, { mode: 'air', vx: clamp(d.vx * k, -MAX_THROW, MAX_THROW), vy: clamp(d.vy * k, -MAX_THROW, MAX_THROW) });
    if (this.room.reduced()) this.land(now);
    return true;
  }

  /** 少动效的：一下算到落地 @param {number} now */
  land(now) {
    for (let i = 0; i < 600 && this.mode === 'air'; i++) this.step(16, now);
  }

  /** 跳回平常那一格（站着、有边的时候；这时没有边的过一阵再试） @param {number} now */
  goHome(now) {
    this.backAt = null;
    const e = this.edge;
    if (this.mode === 'air' || this.mode === 'drag' || this.home()) return;
    if (!e) { this.backAt = now + pick(STAY_MS); return; }
    const from = this.where();
    const to = { x: e.right - this.homeDx, y: e.top };
    if (this.room.reduced()) { Object.assign(this, { mode: 'edge', dx: this.homeDx, lag: 0 }); return; }
    const v = leap(from.x, from.y, to.x, to.y);
    Object.assign(this, { mode: 'air', x: from.x, y: from.y, vx: v.vx, vy: v.vy, lag: 0, homing: true });
  }

  /**
   * 推一帧（dt 毫秒）：缓被推的那一截；在空中的受重力，撞墙停，落到边上（脚从上面穿过边、横着在边上）或整页底边上。
   * 交回这一帧是不是刚落地。
   * @param {number} dt @param {number} now
   */
  step(dt, now) {
    if (this.mode === 'edge') { this.lag = this.room.reduced() ? 0 : settle(this.lag, dt); return false; }
    if (this.mode !== 'air') return false;
    const s = Math.min(dt, 50) / 1000;
    const { w, h } = this.room.view();
    const half = this.room.width / 2;
    const y0 = this.y;
    this.vy += GRAVITY * s;
    this.x += this.vx * s;
    this.y += this.vy * s;
    if (this.x < half || this.x > w - half) { this.x = clamp(this.x, half, w - half); this.vx = 0; }
    if (this.y < 0) { this.y = 0; this.vy = Math.max(0, this.vy); }
    const e = this.edge;
    if (e && this.vy > 0 && y0 <= e.top && this.y >= e.top && this.x >= e.left + half / 2 && this.x <= e.right - half / 2) {
      const dx = e.right - this.x;
      Object.assign(this, { mode: 'edge', dx: this.homing || Math.abs(dx - this.homeDx) < 3 ? this.homeDx : dx, lag: 0, vx: 0, vy: 0, homing: false });
      this.backAt = this.home() ? null : now + pick(STAY_MS);
      return true;
    }
    if (this.y >= h) {
      Object.assign(this, { mode: 'floor', y: h, vx: 0, vy: 0, homing: false });
      this.backAt = now + pick(STAY_MS);
      return true;
    }
    return false;
  }

  /** 窗口变了：站在底边上的跟着底边，横着夹回窗口里 */
  resized() {
    const { w, h } = this.room.view();
    const half = this.room.width / 2;
    if (this.mode === 'floor') this.y = h;
    this.x = clamp(this.x, half, w - half);
  }
}

const clamp = (/** @type {number} */ v, /** @type {number} */ lo, /** @type {number} */ hi) => Math.max(lo, Math.min(hi, v));
const pick = (/** @type {number[]} */ [a, b]) => a + Math.random() * (b - a);
