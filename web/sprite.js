// @ts-check
//! 像素吉祥物的播放器（Miyu、Claude 风格的螃蟹、大肥鱼的 Deepy 共用这一份，各包里各放一份）：挂进网页的 `mascot.characters`，
//! 照 host 交的状态播动画、照 host 交的那条边站（蓝图 web.md「选吉祥物」第 3 条）。自己不碰网页的类名。
//!
//! 一个角色交：`grid` 一帧多少格（[宽, 高]）、`cell` 一格画几 px、`ms` 默认每帧多长、`base` 帧图的目录（URL）、
//! `sheets` 动画表（名字 → `{frames, ms?, loop?, box?, still?}`；一张图一行 8 帧，帧大小是 box 的宽高、没写 box 的是整个 grid），
//! `map` 状态到动画（`now` 的那几种、`ended` 的那几种）、`extras` 闲着时隔一阵播的小动作、`react` 点一下、连点播哪段、`right` 离那条边右头多远。
//! 少动效的停在 `still` 那一帧；页面藏起来不走；一分钟没人动睡着，有人动醒（`sleeping`、`waking` 有的才用）。

/** 闲着隔多久来一个小动作（20～40 秒）、多久没人动睡着 */
const EXTRA_MS = 20000;
const SLEEP_MS = 60000;
/** 连着点两下在这么近以内算挠痒痒 */
const TICKLE_MS = 450;

/**
 * @param {any} spec 角色的描述（见上）
 * @returns {(host: any) => {el: HTMLElement, dispose: () => void}}
 */
export function character(spec) {
  return (host) => {
    const [gw, gh] = spec.grid;
    const cell = spec.cell ?? 1;
    const el = document.createElement('div');
    el.className = `px-mascot px-mascot-${spec.id}`;
    Object.assign(el.style, { position: 'absolute', left: '0', top: '0', width: `${gw * cell}px`, height: `${gh * cell}px`, visibility: 'hidden' });
    const sprite = document.createElement('div');
    Object.assign(sprite.style, { position: 'absolute', overflow: 'hidden', pointerEvents: 'auto', cursor: 'pointer' });
    const strip = document.createElement('div');
    Object.assign(strip.style, { position: 'absolute', inset: '0', backgroundRepeat: 'no-repeat', imageRendering: 'pixelated' });
    sprite.append(strip);
    el.append(sprite);
    const ink = spec.ink ? document.createElement('div') : null;
    if (ink) {
      Object.assign(ink.style, { position: 'absolute', inset: '0', background: 'var(--text-faint)' });
      strip.append(ink);
    }

    /** 每张帧图先读一下，读到了才换上（不闪一下空的） */
    const url = (/** @type {string} */ name, /** @type {string} */ tail = '') => new URL(`${name}${tail}.png`, spec.base).href;
    let anim = '';
    let frame = 0;
    let base = 'idle';
    let quietSince = Date.now();
    let extraAt = Date.now() + EXTRA_MS + Math.random() * EXTRA_MS;
    let timer = 0;
    let clicked = 0;

    const sheet = (/** @type {string} */ name) => spec.sheets[name];
    const boxOf = (/** @type {string} */ name) => sheet(name).box ?? [0, 0, gw, gh];
    const paint = () => {
      const [, , w, h] = boxOf(anim);
      const pos = `${-(frame % 8) * w * cell}px ${-Math.floor(frame / 8) * h * cell}px`;
      strip.style.backgroundPosition = pos;
      if (ink) { ink.style.maskPosition = pos; ink.style.webkitMaskPosition = pos; }
    };
    const show = (/** @type {string} */ name) => {
      if (!sheet(name)) name = 'idle';
      anim = name;
      const s = sheet(name);
      frame = host.reduced() ? (s.still ?? 0) : 0;
      const [x, y, w, h] = boxOf(name);
      Object.assign(sprite.style, { left: `${x * cell}px`, top: `${y * cell}px`, width: `${w * cell}px`, height: `${h * cell}px` });
      const size = `${8 * w * cell}px auto`;
      strip.style.backgroundImage = `url("${url(name)}")`;
      strip.style.backgroundSize = size;
      if (ink) {
        const m = `url("${url(name, '-ink')}")`;
        Object.assign(ink.style, { maskImage: m, webkitMaskImage: m, maskSize: size, webkitMaskSize: size, maskRepeat: 'no-repeat', webkitMaskRepeat: 'no-repeat' });
      }
      paint();
      restart();
    };
    const restart = () => {
      clearInterval(timer);
      timer = window.setInterval(tick, sheet(anim).ms ?? spec.ms);
    };
    const tick = () => {
      if (document.hidden || host.reduced()) return;
      const s = sheet(anim);
      if (frame + 1 < s.frames) { frame += 1; paint(); return; }
      if (s.loop === false) { show(base); return; }
      frame = 0;
      paint();
      if (base !== 'idle' || anim !== 'idle') return;
      const now = Date.now();
      if (sheet('sleeping') && now - quietSince > SLEEP_MS) { base = 'sleeping'; show('sleeping'); return; }
      if (spec.extras?.length && now > extraAt) {
        extraAt = now + EXTRA_MS + Math.random() * EXTRA_MS;
        show(spec.extras[Math.floor(Math.random() * spec.extras.length)]);
      }
    };

    // 状态：now 定循环播的那一段，ended 只在一轮刚收尾时来一次，播完回到 now 的那一段
    const offState = host.onState((/** @type {{now: string, ended?: string}} */ st) => {
      const next = spec.map[st.now] ?? 'idle';
      quietSince = Date.now();
      if (st.ended && spec.map[st.ended]) { base = next; show(spec.map[st.ended]); return; }
      if (base === 'sleeping' && sheet('waking')) { base = next; show('waking'); return; }
      if (next === base && sheet(anim)?.loop !== false) return;
      base = next;
      if (sheet(anim)?.loop === false && anim !== base) return;   // 一次性的那段放完自己会回来
      show(next);
    });
    // 有人动：睡着的醒过来
    const offActivity = host.onActivity(() => {
      quietSince = Date.now();
      if (base === 'sleeping') { base = 'idle'; show(sheet('waking') ? 'waking' : 'idle'); }
    });
    // 站位：脚踩在那条边上，靠右
    const offSurface = host.onSurface((/** @type {{top: number, left: number, right: number}|null} */ s) => {
      if (!s) { el.style.visibility = 'hidden'; return; }
      const x = Math.round(s.right - (spec.right ?? 24) - gw * cell);
      const y = Math.round(s.top - gh * cell);
      el.style.transform = `translate(${x}px, ${y}px)`;
      el.style.visibility = '';
    });
    // 点一下：往被点的那边躲，连着点是挠痒痒
    sprite.addEventListener('click', (e) => {
      const now = Date.now();
      quietSince = now;
      if (base === 'sleeping') { base = 'idle'; show(sheet('waking') ? 'waking' : 'idle'); clicked = now; return; }
      const r = sprite.getBoundingClientRect();
      const pick = now - clicked < TICKLE_MS ? spec.react?.tickle : e.clientX < r.left + r.width / 2 ? spec.react?.left : spec.react?.right;
      clicked = now;
      if (pick && sheet(pick)) show(pick);
    });

    show(base);
    return {
      el,
      dispose: () => { clearInterval(timer); offState(); offActivity(); offSurface(); },
    };
  };
}
