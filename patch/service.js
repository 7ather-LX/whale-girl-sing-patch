'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const cfgmod = require('./config');

const CACHE_VERSION = 'v1';

function voiceEnabled(root) {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(root, 'data', 'voice-send.json'), 'utf8').replace(/^\uFEFF/, ''));
    return j && j.Enabled === true;
  } catch {
    return false;
  }
}

function isSingCommand(text) {
  const s = String(text || '').replace(/@[^\s@]+/g, '').trim();
  if (!s) return false;
  if (/^(?:唱|来|整|放|点)(?:一)?(?:首|个)?(?:歌|小星星)(?:吧|呗|呀|啊|哦|嘛|啦)?$/.test(s)) return true;
  if (/^(?:唱歌|唱首歌|来首歌|点首歌|来首小星星|唱小星星)$/.test(s)) return true;
  return false;
}

class SingService {
  constructor(runtime) {
    this.runtime = runtime;
    this.root = runtime && runtime.config && runtime.config.root ? runtime.config.root : process.cwd();
    this.bot = runtime && runtime.bot;
    this.logger = runtime.logger || console;
    this.state = cfgmod.ensure(this.root);
    this.config = this.state.config;
    this.cooldown = new Map();
    this.hourly = [];
    this.last = null;
    this.lastError = '';
    this.generating = null;
  }

  reload() {
    this.state = cfgmod.ensure(this.root);
    this.config = this.state.config;
    return this.config;
  }

  save(next) { this.config = cfgmod.save(this.root, next); return this.config; }

  cachePath(song) {
    return path.join(this.root, 'data', 'sing-cache', `${song}-${CACHE_VERSION}.wav`);
  }

  async generate(song) {
    const out = this.cachePath(song);
    if (fs.existsSync(out) && fs.statSync(out).size > 100 * 1024) return out;
    if (this.generating) return this.generating;
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const tmp = out + '.tmp-' + process.pid + '.wav';
    const python = path.join(this.root, 'runtime', 'python', 'python.exe');
    const script = path.join(this.root, 'whale-sing-patch', 'sing.py');
    this.generating = new Promise((resolve, reject) => {
      let done = false;
      const child = spawn(python, [script, '--root', this.root, '--output', tmp], {
        cwd: this.root,
        windowsHide: true,
      });
      let err = '';
      child.stderr.on('data', (d) => { err += d.toString(); });
      child.on('error', (e) => { if (!done) { done = true; reject(e); } });
      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        try { child.kill(); } catch { }
        reject(new Error('唱歌生成超时'));
      }, 180000);
      child.on('exit', (code) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        if (code !== 0 || !fs.existsSync(tmp)) return reject(new Error((err || 'sing.py failed').slice(-300)));
        try { fs.renameSync(tmp, out); } catch (e) { return reject(e); }
        resolve(out);
      });
    }).finally(() => { this.generating = null; try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch { } });
    return this.generating;
  }

  hourlyCount() {
    const cutoff = Date.now() - 3600 * 1000;
    this.hourly = this.hourly.filter((t) => t > cutoff);
    return this.hourly.length;
  }

  async handleMessage(msg) {
    if (!msg || msg.platform !== 'wechat' || !msg.chatId) return null;
    const cfg = this.reload();
    if (!cfg.enabled) return null;
    if (!cfgmod.isChatEnabled(cfg, msg.chatId, msg.chatType)) return null;
    const text = msg.cleanText || msg.text || '';
    if (!isSingCommand(text)) return null;
    if (!voiceEnabled(this.root)) {
      return { reply: '想听歌的话，先到启动器「语音发送」里把自动语音打开，再来点歌。' };
    }
    if (this.hourlyCount() >= cfg.maxPerHour) return { reply: '今天唱得有点多，先歇一会儿～' };
    const last = this.cooldown.get(msg.chatId) || 0;
    if (Date.now() - last < cfg.cooldownSec * 1000) {
      this.logger.info?.(`[sing-patch] cooldown chat=${msg.chatId}`);
      return null;
    }
    try {
      const file = await this.generate(cfg.song);
      const name = path.basename(file);
      this.cooldown.set(msg.chatId, Date.now());
      this.hourly.push(Date.now());
      this.last = { at: Date.now(), song: cfg.song, file: name, chat: msg.chatTitle || msg.chatId };
      this.logger.info?.(`[sing-patch] ready chat=${msg.chatId} file=${name}`);
      // bridge 把这段文字交给 AutoVoiceWorker；worker 识别 [[SING:...]] 后直接播放缓存 WAV。
      return { reply: `[[SING:${name}]]`, token: true, song: cfg.song };
    } catch (err) {
      this.lastError = String(err && err.message || err);
      this.logger.warn?.('[sing-patch] generate failed: ' + this.lastError);
      return { reply: '这次没唱出来，等会儿再点一首吧。' };
    }
  }

  status() {
    return {
      version: require('./version').version,
      enabled: this.config.enabled,
      scope: this.config.scope,
      song: this.config.song,
      cooldownSec: this.config.cooldownSec,
      maxPerHour: this.config.maxPerHour,
      voiceEnabled: voiceEnabled(this.root),
      last: this.last,
      lastError: this.lastError,
      cache: fs.existsSync(this.cachePath(this.config.song))
        ? { file: path.basename(this.cachePath(this.config.song)), bytes: fs.statSync(this.cachePath(this.config.song)).size }
        : null,
    };
  }
}

module.exports = { SingService, isSingCommand, voiceEnabled };
