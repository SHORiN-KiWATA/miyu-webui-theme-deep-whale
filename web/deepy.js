// @ts-check
//! 输入框上的像素小鲸鱼 Deepy（照 dsh-claude-style 的 Deepy，帧图出自 calmly-eating-bugs @wp3171216237，收在 MIT 的 dsh-TUI 里）：
//! 站在输入框右上沿，照会话这一刻在做什么播一段动画（写法同 Claude 风格的螃蟹）。帧图在 mascot/：一张一个动画，一行 8 帧，
//! 每帧照 SHEETS 的 `box`（[x, y, 宽, 高]，单位是格，52×52 格）裁好，一格画 2px。少动效的照 `still` 停在一帧；页面藏起来时不走。
//! 挂进网页的 `mascot.characters`（设置页「主题」一组的「吉祥物」里选，和哪个主题都能搭），播放器是 sprite.js。

import { character } from './sprite.js';

/** 动画表（帧数、每帧的裁切框 box、少动效时停的 still） @type {Record<string, {frames: number, box: number[], still: number, loop?: boolean}>} */
const SHEETS = {
  'idle': { frames: 48, box: [12, 26, 36, 24], still: 0 },
  'idle-look': { frames: 68, box: [11, 11, 37, 39], still: 0 },
  'idle-spout': { frames: 64, box: [8, 17, 39, 33], still: 0 },
  'thinking': { frames: 48, box: [0, 6, 47, 44], still: 20 },
  'typing': { frames: 48, box: [0, 17, 52, 33], still: 16 },
  'music': { frames: 32, box: [2, 10, 48, 40], still: 0 },
  'conducting': { frames: 48, box: [1, 0, 51, 50], still: 6 },
  'building': { frames: 48, box: [2, 0, 50, 50], still: 0 },
  'error': { frames: 48, box: [4, 17, 45, 33], still: 24 },
  'happy': { frames: 52, box: [0, 5, 52, 45], still: 44 },
  'notification': { frames: 32, box: [3, 7, 47, 43], still: 12 },
  'compacting': { frames: 56, box: [2, 14, 46, 36], still: 20 },
  'sleeping': { frames: 64, box: [2, 2, 44, 48], still: 10 },
  'waking': { frames: 30, box: [8, 4, 44, 46], still: 29 },
  'poke-left': { frames: 40, box: [1, 16, 50, 34], still: 0 },
  'poke-right': { frames: 40, box: [8, 16, 44, 34], still: 0 },
  'tickle': { frames: 48, box: [9, 17, 43, 33], still: 0 },
};
/** 放一遍就回去的 */
for (const n of ['idle-look', 'idle-spout', 'music', 'happy', 'error', 'waking', 'poke-left', 'poke-right', 'tickle']) if (SHEETS[n]) SHEETS[n].loop = false;

/** @param {any} ctx */
export function mascot(ctx) {
  const render = character({
    id: 'deepy', grid: [52, 50], cell: 2, ms: 50, ink: false,
    base: new URL('mascot/', import.meta.url), sheets: SHEETS,
    map: { idle: 'idle', thinking: 'thinking', writing: 'typing', tool: 'building', subagent: 'conducting', waiting: 'notification', compacting: 'compacting', done: 'happy', error: 'error', interrupted: 'error' },
    extras: ['idle-look', 'idle-spout', 'music'],
    react: { left: 'poke-left', right: 'poke-right', tickle: 'tickle' },
    right: 40,
  });
  ctx.slots.mount('mascot.characters', { id: 'deepy', name: ctx.text('mascot'), render });
}
