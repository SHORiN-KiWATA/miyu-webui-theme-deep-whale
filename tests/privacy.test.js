// @ts-check
//! 私密路径（照核心仓库 `xtask/src/privacy.rs` 的同名门禁，核心施工 SCRUB-1、SCRUB-2）：仓库是公开的，被 git 跟踪的文本里不许出现
//! 开发机上真实用户的痕迹：`/home/<名字>`、macOS 的 `/Users/<名字>`、Windows 的 `C:\Users\<名字>`（`/`、`\\` 的写法和 WSL 的
//! `/mnt/c` 也算）、`/tmp/claude-<数字>`、`-home-<名字>-Documents`（后者是按工作目录起的会话存档目录名）。
//! 样例里要用家目录时，写 FICTIONAL 里的虚构名字。这里不写任何具体的人名、机器名、地址：规则只认形状，具体的名字清单属于本机，不进仓库。
//! 不在 git 仓库里（例如下载的压缩包）时照目录走一遍，跳过 `.git/`、`node_modules/`。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

/**
 * 允许出现在用户目录里的名字（测试夹具、文档样例、系统自带的目录名），和核心的一样。不分大小写，整段名字相等才放过：
 * `a-zhangsan` 这类只是开头像的不算。
 */
const FICTIONAL = [
  'a', 'u', 'w', 'me', 'ai', 'ai.old', 'ai_2', 'ai-2', 'aim', 'alice', 'alicex', 'bob', 'admin', 'builder',
  'someone', 'user', 'example', 'test', 'runneradmin', 'public', 'default', 'shared',
];

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** 名字里能出现的字符开头的一串。 */
const nameAt = (rest) => /^[A-Za-z0-9_.-]*/.exec(rest)?.[0] ?? '';

/** `line` 里每个 `marker` 后面紧跟着的一串名字字符。 */
function namesAfter(line, marker) {
  const names = [];
  for (let at = line.indexOf(marker); at !== -1; at = line.indexOf(marker, at + 1)) {
    names.push(nameAt(line.slice(at + marker.length)));
  }
  return names;
}

/**
 * 一行里每个用户目录的 [写法, 名字]：`/home/`、`/Users/` 和 Windows 的 `X:\Users\`，`\` 和 `\\` 都当 `/`。
 * 前面紧挨着名字字符或 `.` 的是路径中间的一段（`pages/home/`、`foo/Users/`、`/api/users/42`），不算；
 * 盘符和 `/mnt/c` 这类 WSL 的挂载点除外。
 */
function userDirs(line) {
  // `/home/` 只认正斜杠：`/home\134x` 这类转义（挂载表里的空格写法）不是路径分隔。Windows 的写法才把反斜杠当 `/`。
  const flat = line.replaceAll('\\\\', '/').replaceAll('\\', '/');
  const found = [];
  for (const [shown, marker, text] of [['/home/', '/home/', line], ['/Users/', '/users/', flat]]) {
    // 只把 ASCII 字母变小写，下标和原文一一对上。
    const lower = text.replace(/[A-Z]/g, (c) => c.toLowerCase());
    for (let at = lower.indexOf(marker); at !== -1; at = lower.indexOf(marker, at + 1)) {
      const before = text.slice(0, at);
      const mnt = before.lastIndexOf('/mnt/');
      const mount = before.endsWith(':') || (mnt !== -1 && before.length - mnt - '/mnt/'.length === 1);
      if (mount || !/[A-Za-z0-9_.-]$/.test(before)) found.push([shown, nameAt(text.slice(at + marker.length))]);
    }
  }
  return found;
}

/** 名字空的（后面是 `$`、`<` 这类占位）、点开头的和虚构名字（整段相等）都放过。句末的 `.`、`-` 不算名字的一部分。 */
function allowed(name) {
  const bare = name.replace(/[.-]+$/, '').toLowerCase();
  return bare === '' || bare.startsWith('.') || FICTIONAL.includes(bare);
}

/** 一段文本里每一处违例，说明带行号。 */
export function scan(label, text) {
  const found = [];
  text.split('\n').forEach((line, index) => {
    const at = index + 1;
    for (const [shown, name] of userDirs(line)) {
      if (!allowed(name)) found.push(`${label}:${at}：\`${shown}${name}\` 像真实用户的家目录，换成虚构的名字（见 tests/privacy.test.js）`);
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

test('只是开头像虚构名字的照样报', () => {
  for (const name of ['a-zhangsan', 'u_zhangsan', 'alice.zhangsan', 'me-zhangsan']) {
    assert.equal(scan('a.js', home(name)).length, 1, name);
  }
});

test('macOS、Windows 的用户目录每种写法都报', () => {
  const texts = [
    ['/Us', 'ers/zhangsan/x'].join(''),
    ['C:', '\\Us', 'ers\\zhangsan'].join(''),
    ['c:/us', 'ers/zhangsan'].join(''),
    ['C:', '\\\\Us', 'ers\\\\zhangsan'].join(''),
    ['/mnt/c/Us', 'ers/zhangsan'].join(''),
  ];
  for (const text of texts) assert.equal(scan('a.js', text).length, 1, text);
});

test('macOS、Windows 的虚构名字和网址路由放过', () => {
  const text = [
    ['/Us', 'ers/me/x'].join(''),
    ['C:', '\\Us', 'ers\\ALICE'].join(''),
    ['c:/us', 'ers/runneradmin'].join(''),
    ['C:', '\\\\Us', 'ers\\\\a'].join(''),
    'GET /api/users/zhangsan and /users/{id}',
  ].join('\n');
  assert.deepEqual(scan('a.js', text), []);
});

test('路径中间的 home、Users 不算用户目录', () => {
  const text = [
    ['pages', '/ho', 'me/zhangsan'].join(''),
    ['/srv/backup', '/ho', 'me/zhangsan'].join(''),
    ['foo', '/Us', 'ers/zhangsan'].join(''),
    ['./Us', 'ers/zhangsan'].join(''),
  ].join('\n');
  assert.deepEqual(scan('a.js', text), []);
});

test('home 后面的反斜杠转义不当分隔符', () => {
  assert.deepEqual(scan('a.js', ['"/ho', 'me\\\\134x"'].join('')), []);
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
