// @ts-check
//! 吉祥物的身子（web/body.js）：不在平常那一格的跳回去（`goHome`）时，照算好的抛物线落回那一格：宽屏、窄屏、矮的窗口、帧慢的时候
//! 都落在台面上，落地那一下不横着瞬移（最多是一帧本来就走的那一段）。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Body } from '../web/body.js';

/**
 * 摆好、叫它跳回去、一帧一帧推到停下：交回停在哪、落地那一帧横着挪了多少、一帧本来走多少
 * @param {{w: number, h: number, edge: {top: number, left: number, right: number}, start: (b: Body) => void, dt?: number}} o
 */
function jumpHome({ w, h, edge, start, dt = 16 }) {
  const body = new Body({ width: 104, right: 12, view: () => ({ w, h }), reduced: () => false });
  body.setEdge(edge, true);
  start(body);
  body.goHome(0);
  assert.equal(body.mode, 'air', '起跳了');
  const frame = (Math.abs(body.vx) * Math.min(dt, 50)) / 1000;
  let t = 0;
  let before = body.where();
  for (let i = 0; i < 1000 && body.mode === 'air'; i++) {
    t += dt;
    before = body.where();
    body.step(dt, t);
  }
  const after = body.where();
  return { mode: body.mode, home: body.home(), jump: Math.abs(after.x - before.x), frame };
}

/** 掉在整页底边上、离右边远的那一头 @param {number} x @param {number} h */
const onFloor = (x, h) => (/** @type {Body} */ b) => Object.assign(b, { mode: 'floor', x, y: h });

const CASES = [
  { name: '宽屏，从地上左边跳回输入框', w: 1280, h: 800, edge: { top: 690, left: 340, right: 1040 }, x: 400 },
  { name: '宽屏，命令列表开着、台面高', w: 1280, h: 800, edge: { top: 120, left: 340, right: 1040 }, x: 400 },
  { name: '手机竖屏，从地上左边跳回输入框', w: 375, h: 667, edge: { top: 557, left: 8, right: 367 }, x: 52 },
  { name: '手机横屏（矮），台面贴着顶上', w: 667, h: 300, edge: { top: 20, left: 8, right: 659 }, x: 52 },
];

for (const c of CASES) {
  test(`${c.name}：落回平常那一格，落地不瞬移`, () => {
    const r = jumpHome({ w: c.w, h: c.h, edge: c.edge, start: onFloor(c.x, c.h) });
    assert.equal(r.mode, 'edge');
    assert.ok(r.home);
    assert.ok(r.jump <= r.frame + 1, `落地那一下横着挪了 ${r.jump.toFixed(1)}px，一帧本来走 ${r.frame.toFixed(1)}px`);
  });
}

test('帧慢（一帧 50 毫秒）也落在台面上，不掉回地上', () => {
  for (const c of CASES) {
    const r = jumpHome({ w: c.w, h: c.h, edge: c.edge, start: onFloor(c.x, c.h), dt: 50 });
    assert.equal(r.mode, 'edge', c.name);
    assert.ok(r.home, c.name);
  }
});

test('窄屏：输入框变窄后站在左头、半个身子出了窗口，跳回去也是一路横着过去', () => {
  const edge = { top: 557, left: 8, right: 367 };
  // 站在离左边 30px 的地方（平常的一格离左边至少半个身子 52px）
  const r = jumpHome({ w: 375, h: 667, edge, start: (b) => Object.assign(b, { mode: 'edge', dx: edge.right - 30, lag: 0 }) });
  assert.equal(r.mode, 'edge');
  assert.ok(r.home);
  assert.ok(r.jump <= r.frame + 1, `落地那一下横着挪了 ${r.jump.toFixed(1)}px，一帧本来走 ${r.frame.toFixed(1)}px`);
});
