// @ts-check
//! 私密路径（照核心仓库 `xtask/src/privacy.rs` 的同名门禁）：仓库是公开的，被 git 跟踪的文本里不许出现开发机上真实用户的痕迹：
//! `/home/<名字>`、`/tmp/claude-<数字>`、`-home-<名字>-Documents`（后者是按工作目录起的会话存档目录名）。
//! 样例里要用家目录时，写 FICTIONAL 里的虚构名字。这里不写任何具体的人名、机器名、地址：规则只认形状，具体的名字清单属于本机，不进仓库。
//! 不在 git 仓库里（例如下载的压缩包）时照目录走一遍，跳过 `.git/`、`node_modules/`。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

/** 允许出现在 `/home/<名字>` 里的虚构名字，和核心的一样。名字里 `.`、`-`、`_` 之前的那一段在表里也算。 */
const FICTIONAL = new Set([
  'a', 'u', 'w', 'me', 'ai', 'aim', 'alice', 'alicex', 'bob', 'admin', 'builder', 'someone',
  'user', 'example', 'test',
]);

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** `line` 里每个 `marker` 后面紧跟着的一串名字字符。 */
function namesAfter(line, marker) {
  const names = [];
  for (let at = line.indexOf(marker); at !== -1; at = line.indexOf(marker, at + 1)) {
    names.push(/^[A-Za-z0-9_.-]*/.exec(line.slice(at + marker.length))?.[0] ?? '');
  }
  return names;
}

/** 名字空的（后面是 `$`、`<` 这类占位）、点开头的和虚构名字都放过。 */
function allowed(name) {
  return name === '' || name.startsWith('.') || FICTIONAL.has(name) || FICTIONAL.has(name.split(/[._-]/)[0]);
}

/** 一段文本里每一处违例，说明带行号。 */
export function scan(label, text) {
  const found = [];
  text.split('\n').forEach((line, index) => {
    const at = index + 1;
    for (const name of namesAfter(line, '/home/')) {
      if (!allowed(name)) found.push(`${label}:${at}：\`/home/${name}\` 像真实用户的家目录，换成虚构的名字（见 tests/privacy.test.js）`);
    }
    if (/\/tmp\/claude-\d/.test(line)) found.push(`${label}:${at}：出现了开发机上会话的临时目录 \`/tmp/claude-<数字>\`，删掉或换成占位`);
    for (const name of namesAfter(line, '-home-')) {
      if (name.endsWith('-Documents') && name.length > '-Documents'.length) {
        found.push(`${label}:${at}：出现了按工作目录起的会话存档目录名 \`-home-…-Documents\`，删掉或换成占位`);
      }
    }
  });
  return found;
}

/** 被 git 跟踪的文件；不在 git 仓库里时照目录走。 */
function files() {
  try {
    return execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' }).split('\0').filter(Boolean);
  } catch {
    const names = [];
    const walk = (rest) => {
      for (const entry of readdirSync(join(ROOT, rest), { withFileTypes: true })) {
        const path = rest ? `${rest}/${entry.name}` : entry.name;
        if (entry.isDirectory() && entry.name !== '.git' && entry.name !== 'node_modules') walk(path);
        else if (entry.isFile()) names.push(path);
      }
    };
    walk('');
    return names;
  }
}

/** 违例的样子在测试里拼出来：这份文件自己也被扫，不能整句写在源码里。 */
const home = (name) => ['/ho', 'me/', name].join('');

test('像真实用户的家目录报出来，带行号', () => {
  const found = scan('a.js', `fine\nconst p = '${home('zhangsan')}/x';\n`);
  assert.equal(found.length, 1);
  assert.ok(found[0].startsWith('a.js:2：'), found[0]);
});

test('虚构名字和占位放过', () => {
  const text = [home('alice'), home('ai.old'), home('ai_2/x'), home('$USER'), home('<name>'), home('.local'), home('')].join('\n');
  assert.deepEqual(scan('a.js', text), []);
});

test('会话的临时目录和存档目录名报出来', () => {
  assert.equal(scan('a.md', ['/tmp/', 'claude-', '1000/x'].join('')).length, 1);
  assert.equal(scan('a.md', ['-ho', 'me-zhangsan-', 'Documents'].join('')).length, 1);
  assert.deepEqual(scan('a.md', '/tmp/claude-code/x and -home-x'), []);
});

test('被跟踪的文本里没有带真实用户名的路径', () => {
  const problems = [];
  for (const name of files()) {
    let bytes;
    try {
      bytes = readFileSync(join(ROOT, name));
    } catch {
      continue; // 已删未提交的、链接：不算文本。
    }
    let text;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      continue; // 图片、字体这类二进制。
    }
    problems.push(...scan(name, text));
  }
  assert.deepEqual(problems, []);
});
