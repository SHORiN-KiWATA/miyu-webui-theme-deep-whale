// @ts-check
//! web/sprite.js（播放器）和 web/body.js（身子）在两个外观包里各放一份，内容必须一样：改一处要两边同改。
//! 这条测试拿另一个包的同名文件逐字节对比。另一个包的位置默认是本仓库旁边的 `miyu-webui-theme-claude-style` 目录，
//! 也可以用环境变量 `MIYU_THEME_PEER` 指定（例如在工作树里测试）；找不到时跳过并说明原因，单独克隆一个仓库的人测试不会红。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const PEER = 'miyu-webui-theme-claude-style';
const peerDir = process.env.MIYU_THEME_PEER || fileURLToPath(new URL(`../../${PEER}/`, import.meta.url));
const found = existsSync(join(peerDir, 'web', 'sprite.js'));
const skip = found ? false : `没有找到另一个外观包 ${PEER}（找的是 ${peerDir}），跳过对比`;
if (skip) console.log(skip);

for (const file of ['web/sprite.js', 'web/body.js']) {
  test(`${file} 和 ${PEER} 里的同名文件逐字节一样`, { skip }, () => {
    const mine = readFileSync(new URL(`../${file}`, import.meta.url));
    const theirs = readFileSync(join(peerDir, file));
    assert.ok(mine.equals(theirs), `${file} 和 ${join(peerDir, file)} 不一样，改一处要两边同改`);
  });
}
