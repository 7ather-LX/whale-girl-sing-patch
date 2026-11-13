'use strict';

/**
 * 鲸鲸唱歌补丁入口：server.js 第一行 require('./whale-sing-patch').install();
 * 服务端拦截「唱首歌」并生成带伴奏的 WAV；桥接/启动器负责把它作为语音发出去。
 */
const path = require('node:path');
const versionInfo = require('./version');
const configModule = require('./config');
const { install: installHook } = require('./hook');

const KEY = '__WHALE_SING_PATCH__';
let installed = false;
let runtimeRef = null;
let rootRef = '';

function log(level, text) {
  try {
    const l = runtimeRef && runtimeRef.logger;
    if (l && typeof l[level] === 'function') l[level](text);
    else if (level === 'error' || level === 'warn') console.error(text);
    else console.log(text);
  } catch { /* ignore */ }
}

function registerRoutes(root) {
  const routes = require('../src/http/routes');
  if (routes.__whaleSingPatchWrapped) return;
  const original = routes.createRouter;
  routes.createRouter = function createRouterWithSingPatch(runtime) {
    const router = original(runtime);
    try { require('./routes').register(router, runtime, { root }); }
    catch (err) { log('warn', '唱歌补丁接口注册失败：' + (err && err.message || err)); }
    return router;
  };
  routes.__whaleSingPatchWrapped = true;
}

function patchRuntime(root) {
  const app = require('../src/app');
  if (app.__whaleSingPatchWrapped) return;
  const original = app.createRuntime;
  app.createRuntime = function createRuntimeWithSingPatch(opts = {}) {
    const runtime = original(opts);
    runtimeRef = runtime;
    if (!rootRef) rootRef = root || path.resolve(__dirname, '..');
    try {
      const state = configModule.load(rootRef);
      log('info', `🎤 唱歌补丁 ${versionInfo.version} 已加载：${state.config.enabled ? '开' : '关'} · 歌曲 ${state.config.song}`);
    } catch (err) {
      log('warn', '唱歌补丁初始化失败：' + (err && err.message || err));
    }
    return runtime;
  };
  app.__whaleSingPatchWrapped = true;
}

function install(opts = {}) {
  if (installed || global[KEY]) return global[KEY] || null;
  const root = path.resolve(opts.root || path.resolve(__dirname, '..'));
  rootRef = root;
  let state;
  try { state = configModule.ensure(root); } catch { state = configModule.load(root); }
  if (!state.config.enabled) {
    installed = true;
    global[KEY] = { installed: true, disabled: true, version: versionInfo.version, root };
    return global[KEY];
  }
  try {
    installHook();
    registerRoutes(root);
    patchRuntime(root);
  } catch (err) {
    log('warn', '唱歌补丁安装失败：' + (err && err.message || err));
  }
  installed = true;
  global[KEY] = { installed: true, version: versionInfo.version, root, configFile: state.file };
  return global[KEY];
}

module.exports = { install, versionInfo, config: configModule, STATE_KEY: KEY };
