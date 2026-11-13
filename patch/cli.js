'use strict';

const fs = require('node:fs');
const path = require('node:path');
const version = require('./version');

function line(ok, s) { console.log((ok ? '  [OK]   ' : '  [WARN] ') + s); }

const root = path.resolve(process.argv[3] || path.resolve(__dirname, '..'));
console.log(`唱歌补丁 ${version.version} · 适配鲸鲸 ${version.base}`);
console.log('目录：' + root);
line(fs.existsSync(path.join(root, 'server.js')), 'server.js');
line(fs.existsSync(path.join(root, 'src', 'adapters', 'gateway.js')), 'src/adapters/gateway.js');
line(fs.existsSync(path.join(root, 'bridge', 'voice_reply.py')), 'bridge/voice_reply.py');
line(fs.existsSync(path.join(root, 'whale-sing-patch')), 'whale-sing-patch/');
let voice = false;
try { voice = JSON.parse(fs.readFileSync(path.join(root, 'data', 'voice-send.json'), 'utf8').replace(/^\uFEFF/, '')).Enabled === true; } catch { }
line(voice, '基础软件自动语音（voice-send.json Enabled）已开启');
try {
  const s = fs.readFileSync(path.join(root, 'bridge', 'voice_reply.py'), 'utf8');
  line(/whale-sing-patch/.test(s), '桥接语音判定已加入「唱」触发');
} catch { }
try {
  const s = fs.readFileSync(path.join(root, 'server.js'), 'utf8').split(/\r?\n/).slice(0, 6).join('\n');
  line(/whale-sing-patch/.test(s), 'server.js 已加载唱歌补丁');
} catch { }
console.log('\n管理页：http://127.0.0.1:8787/sing-patch/');
