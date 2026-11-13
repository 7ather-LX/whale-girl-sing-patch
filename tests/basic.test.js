'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const config = require('../patch/config');
const { isSingCommand } = require('../patch/service');

test('唱首歌 / 来首小星星 / 唱歌 都能触发', () => {
  for (const s of ['唱首歌', '来首小星星', '唱歌', '@鲸鲸 唱首歌']) {
    assert.equal(isSingCommand(s), true, s);
  }
});

test('普通聊天不触发', () => {
  for (const s of ['今天吃什么', '你好', '唱歌好听吗']) {
    assert.equal(isSingCommand(s), false, s);
  }
});

test('默认群聊/私聊都开，可逐个覆盖', () => {
  const c = config.normalize(config.defaults());
  assert.equal(config.isChatEnabled(c, 'g1', 'group'), true);
  assert.equal(config.isChatEnabled(c, 'u1', 'private'), true);
  const x = config.normalize({ ...c, scope: { ...c.scope, overrides: { g1: false } } });
  assert.equal(config.isChatEnabled(x, 'g1', 'group'), false);
});

test('冷却和每小时上限会被限制', () => {
  const c = config.normalize({ cooldownSec: -1, maxPerHour: 999 });
  assert.equal(c.cooldownSec, 0);
  assert.equal(c.maxPerHour, 100);
});
