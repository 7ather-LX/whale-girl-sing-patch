'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { json, readBody } = require('../src/http/util');
const { isLoopbackRequest } = require('../src/http/security');
const configModule = require('./config');

const STATIC = {
  'index.html': 'text/html; charset=utf-8',
  'app.js': 'text/javascript; charset=utf-8',
  'style.css': 'text/css; charset=utf-8',
};

function loopbackOnly(req, res) {
  if (isLoopbackRequest(req)) return false;
  json(res, 403, { ok: false, error: '唱歌补丁页面只允许在本机打开' });
  return true;
}

function chatList(runtime) {
  const chats = [];
  const map = runtime && runtime.store && runtime.store.chatStore && runtime.store.chatStore.chats;
  if (!map) return chats;
  for (const chat of map.values()) {
    if (!chat || chat.chatId === 'filehelper') continue;
    const title = String(chat.title || '').trim();
    if (!title || String(chat.platform || 'wechat') !== 'wechat') continue;
    chats.push({
      id: String(chat.chatId || ''),
      title,
      type: chat.chatType === 'group' ? 'group' : 'private',
      messages: Array.isArray(chat.messages) ? chat.messages.length : 0,
      lastActiveAt: Number(chat.lastActiveAt) || 0,
    });
  }
  chats.sort((a, b) => b.lastActiveAt - a.lastActiveAt);
  return chats.slice(0, 200);
}

function service(runtime) {
  const { serviceFor } = require('./hook');
  const svc = serviceFor(runtime.bot);
  if (!svc) throw new Error('唱歌服务未初始化');
  return svc;
}

function register(router, runtime, ctx) {
  const root = (ctx && ctx.root) || runtime.config.root || path.resolve(__dirname, '..');

  router.get('/sing-patch', (rt, req, res) => {
    res.writeHead(302, { Location: '/sing-patch/' });
    res.end();
  });

  router.get('/sing-patch/', (rt, req, res) => {
    if (loopbackOnly(req, res)) return;
    try {
      res.writeHead(200, { 'Content-Type': STATIC['index.html'], 'Cache-Control': 'no-store' });
      res.end(fs.readFileSync(path.join(__dirname, 'web', 'index.html'), 'utf8'));
    } catch {
      json(res, 500, { ok: false, error: '唱歌页面文件缺失，请重新安装' });
    }
  });

  for (const name of ['app.js', 'style.css']) {
    router.get(`/sing-patch/${name}`, (rt, req, res) => {
      if (loopbackOnly(req, res)) return;
      try {
        res.writeHead(200, { 'Content-Type': STATIC[name], 'Cache-Control': 'no-store' });
        res.end(fs.readFileSync(path.join(__dirname, 'web', name)));
      } catch {
        json(res, 404, { ok: false, error: 'not found' });
      }
    });
  }

  router.get('/api/sing-patch/status', (rt, req, res) => {
    if (loopbackOnly(req, res)) return;
    const state = configModule.load(root);
    let svc = null;
    try { svc = service(rt); } catch { /* ignore */ }
    let bridge = false;
    try {
      const gw = rt.gateways && rt.gateways.get && rt.gateways.get('wechat');
      bridge = Boolean(gw && gw.status().bridge.online);
    } catch { /* ignore */ }
    return json(res, 200, {
      ok: true,
      patch: { version: require('./version').version, base: require('./version').base, file: state.file },
      config: state.config,
      chats: chatList(rt),
      songs: configModule.SONGS,
      diagnostics: {
        voiceEnabled: svc ? svc.status().voiceEnabled : false,
        bridge,
        last: svc ? svc.last : null,
        lastError: svc ? svc.lastError : '',
        cache: svc ? svc.status().cache : null,
      },
    });
  });

  router.post('/api/sing-patch/config', async (rt, req, res) => {
    if (loopbackOnly(req, res)) return;
    const body = await readBody(req);
    try {
      if (!body || typeof body !== 'object') return json(res, 400, { ok: false, error: '无效配置' });
      const cfg = configModule.save(root, body);
      try { service(rt).reload(); } catch { /* ignore */ }
      return json(res, 200, { ok: true, config: cfg });
    } catch (err) {
      return json(res, 400, { ok: false, error: String(err && err.message || err) });
    }
  });

  router.post('/api/sing-patch/test', async (rt, req, res) => {
    if (loopbackOnly(req, res)) return;
    try {
      const svc = service(rt);
      svc.reload();
      const file = await svc.generate(svc.config.song);
      const name = path.basename(file);
      return json(res, 200, {
        ok: true,
        song: svc.config.song,
        file: name,
        bytes: fs.statSync(file).size,
        url: `/sing-patch/preview/${encodeURIComponent(name)}`,
      });
    } catch (err) {
      return json(res, 502, { ok: false, error: String(err && err.message || err) });
    }
  });

  router.pattern(/^\/sing-patch\/preview\/([^/]+)$/, (rt, req, res, info) => {
    if (loopbackOnly(req, res)) return;
    const name = path.basename(String((info && info.params && info.params[0]) || ''));
    if (!/^[a-z0-9_-]+\.wav$/i.test(name)) return json(res, 400, { ok: false, error: 'bad name' });
    const file = path.join(root, 'data', 'sing-cache', name);
    try {
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return json(res, 404, { ok: false, error: 'not found' });
      res.writeHead(200, { 'Content-Type': 'audio/wav', 'Cache-Control': 'no-store', 'Accept-Ranges': 'none' });
      res.end(fs.readFileSync(file));
    } catch {
      json(res, 404, { ok: false, error: 'not found' });
    }
  });
}

module.exports = { register, chatList };
