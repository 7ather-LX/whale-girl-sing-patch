'use strict';

const fs = require('fs');
const path = require('path');

const FILE = 'whale-sing-patch.json';
const SONGS = {
  twinkle: { id: 'twinkle', name: '小星星', desc: '公版童谣，带钢琴/贝斯伴奏' },
};

function defaults() {
  return {
    version: 1,
    enabled: true,
    scope: { groups: true, privates: true, overrides: {} },
    song: 'twinkle',
    cooldownSec: 120,
    maxPerHour: 6,
  };
}

function bool(v, dflt) {
  if (v === undefined || v === null || v === '') return dflt;
  if (typeof v === 'boolean') return v;
  return /^(1|true|on|yes|开|是)$/i.test(String(v).trim());
}

function clamp(n, min, max, dflt) {
  const x = Number(n);
  if (!Number.isFinite(x)) return dflt;
  return Math.max(min, Math.min(max, Math.round(x)));
}

function normalize(raw) {
  const d = defaults();
  const src = raw && typeof raw === 'object' ? raw : {};
  const scope = src.scope && typeof src.scope === 'object' ? src.scope : {};
  const overrides = {};
  if (scope.overrides && typeof scope.overrides === 'object') {
    for (const [k, v] of Object.entries(scope.overrides)) {
      if (typeof k === 'string' && k.length <= 160) overrides[k] = bool(v, false);
    }
  }
  return {
    version: 1,
    enabled: bool(src.enabled, d.enabled),
    scope: {
      groups: bool(scope.groups, d.scope.groups),
      privates: bool(scope.privates, d.scope.privates),
      overrides,
    },
    song: SONGS[src.song] ? src.song : d.song,
    cooldownSec: clamp(src.cooldownSec, 0, 3600, d.cooldownSec),
    maxPerHour: clamp(src.maxPerHour, 1, 100, d.maxPerHour),
  };
}

function fileFor(root) {
  return path.join(path.resolve(root || process.cwd()), 'data', FILE);
}

function load(root) {
  const file = fileFor(root);
  let raw = null;
  try { raw = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { raw = null; }
  return { file, config: normalize(raw), created: !raw };
}

function save(root, cfg) {
  const file = fileFor(root);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const data = normalize(cfg);
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, file);
  return data;
}

function ensure(root) {
  const state = load(root);
  if (state.created) save(root, state.config);
  return state;
}

function isChatEnabled(cfg, chatId, chatType) {
  if (!cfg.enabled) return false;
  const id = String(chatId || '');
  if (Object.prototype.hasOwnProperty.call(cfg.scope.overrides, id)) return cfg.scope.overrides[id] === true;
  return chatType === 'group' ? cfg.scope.groups === true : cfg.scope.privates === true;
}

module.exports = { FILE, SONGS, defaults, normalize, load, save, ensure, isChatEnabled, fileFor };
