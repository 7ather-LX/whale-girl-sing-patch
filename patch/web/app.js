'use strict';

const $ = (s) => document.querySelector(s);
const state = { config: null, chats: [], songs: {}, tab: 'group', query: '' };

function toast(msg, bad = false) {
  const el = $('#toast');
  el.textContent = msg;
  el.className = 'toast show' + (bad ? ' bad' : '');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { el.className = 'toast'; }, 3200);
}

async function api(path, opts = {}) {
  const r = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || data.ok === false) throw new Error(data.error || ('HTTP ' + r.status));
  return data;
}

function setPill(text, kind) {
  const el = $('#pill');
  el.textContent = text;
  el.className = 'pill' + (kind ? ' ' + kind : '');
}

function isBaseOn(type) {
  return type === 'group' ? !!state.config.scope.groups : !!state.config.scope.privates;
}
function isOn(chat) {
  const ov = state.config.scope.overrides || {};
  if (Object.prototype.hasOwnProperty.call(ov, chat.id)) return ov[chat.id] === true;
  return isBaseOn(chat.type);
}
function setOn(chat, on) {
  const ov = state.config.scope.overrides || (state.config.scope.overrides = {});
  if (on === isBaseOn(chat.type)) delete ov[chat.id]; else ov[chat.id] = on;
  renderChats();
}

function renderChats() {
  const list = $('#chatList');
  list.textContent = '';
  const rows = state.chats.filter((c) => c.type === state.tab && (!state.query || c.title.includes(state.query)));
  if (!rows.length) {
    const p = document.createElement('p');
    p.className = 'muted';
    p.textContent = state.query ? '没有匹配的聊天' : '还没有记录到聊天；先在微信里说几句话，再刷新。';
    list.append(p);
    return;
  }
  for (const chat of rows) {
    const row = document.createElement('div');
    row.className = 'chat-row';
    const lab = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = isOn(chat);
    cb.addEventListener('change', () => setOn(chat, cb.checked));
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = chat.title;
    lab.append(cb, name);
    const type = document.createElement('span');
    type.className = 'type';
    type.textContent = chat.type === 'group' ? '群' : '私聊';
    row.append(lab, type);
    list.append(row);
  }
}

function renderSongs() {
  const sel = $('#song');
  sel.textContent = '';
  for (const [id, s] of Object.entries(state.songs || {})) {
    const o = document.createElement('option');
    o.value = id;
    o.textContent = s.name;
    if (id === state.config.song) o.selected = true;
    sel.append(o);
  }
}

function fillForm() {
  $('#enabled').checked = !!state.config.enabled;
  $('#groups').checked = !!state.config.scope.groups;
  $('#privates').checked = !!state.config.scope.privates;
  $('#cooldown').value = state.config.cooldownSec;
  $('#maxPerHour').value = state.config.maxPerHour;
  renderSongs();
  renderChats();
}

async function load() {
  try {
    const data = await api('/api/sing-patch/status');
    state.config = data.config;
    state.chats = data.chats || [];
    state.songs = data.songs || {};
    fillForm();
    const d = data.diagnostics || {};
    const parts = [];
    parts.push(d.voiceEnabled ? '基础软件自动语音：已开启' : '基础软件自动语音：未开启（去「语音发送」打开）');
    parts.push(d.bridge ? '微信桥接：在线' : '微信桥接：离线或未启动');
    if (d.cache) parts.push(`缓存：${d.cache.file}`);
    if (d.last) parts.push(`上一首：${d.last.song} · ${d.last.chat}`);
    if (d.lastError) parts.push(`上次错误：${d.lastError}`);
    $('#diag').textContent = parts.join('　|　');
    setPill('已连接', 'ok');
  } catch (err) {
    setPill('未连接', 'bad');
    $('#diag').textContent = String(err.message || err);
  }
}

async function save() {
  if (!state.config) return;
  state.config.enabled = $('#enabled').checked;
  state.config.scope.groups = $('#groups').checked;
  state.config.scope.privates = $('#privates').checked;
  state.config.song = $('#song').value;
  state.config.cooldownSec = Number($('#cooldown').value) || 0;
  state.config.maxPerHour = Number($('#maxPerHour').value) || 6;
  try {
    const data = await api('/api/sing-patch/config', { method: 'POST', body: JSON.stringify(state.config) });
    state.config = data.config;
    fillForm();
    toast('已保存，下一轮聊天生效');
  } catch (err) {
    toast('保存失败：' + (err.message || err), true);
  }
}

async function test() {
  const btn = $('#testBtn');
  btn.disabled = true;
  btn.textContent = '生成中…（第一次约几十秒）';
  try {
    const data = await api('/api/sing-patch/test', { method: 'POST', body: '{}' });
    $('#preview').src = data.url + '?t=' + Date.now();
    $('#previewMeta').textContent = `${data.file} · ${Math.round(data.bytes / 1024)} KB`;
    $('#previewWrap').classList.remove('hidden');
    $('#preview').play().catch(() => {});
    toast('生成好了，点播放试听');
  } catch (err) {
    toast('生成失败：' + (err.message || err), true);
  } finally {
    btn.disabled = false;
    btn.textContent = '生成 / 试听';
  }
}

function bind() {
  $('#save').addEventListener('click', save);
  $('#enabled').addEventListener('change', () => { if (state.config) state.config.enabled = $('#enabled').checked; });
  $('#groups').addEventListener('change', () => { if (state.config) { state.config.scope.groups = $('#groups').checked; renderChats(); } });
  $('#privates').addEventListener('change', () => { if (state.config) { state.config.scope.privates = $('#privates').checked; renderChats(); } });
  document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => {
    state.tab = b.dataset.tab;
    document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === b));
    renderChats();
  }));
  $('#chatSearch').addEventListener('input', (e) => { state.query = e.target.value.trim(); renderChats(); });
  $('#testBtn').addEventListener('click', test);
}

bind();
load();
