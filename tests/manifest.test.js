// @ts-check
//! 网页那一份清单（web/manifest.json）的版本和包的版本（package.toml，装包、设置页显示的就是它）写同一个，发版时两处一起改。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (/** @type {string} */ path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('web/manifest.json 的版本同 package.toml 的', () => {
  const toml = read('../package.toml').match(/^\s*version\s*=\s*"([^"]+)"/m)?.[1];
  assert.ok(toml, 'package.toml 里有 version');
  assert.equal(JSON.parse(read('../web/manifest.json')).version, toml);
});
