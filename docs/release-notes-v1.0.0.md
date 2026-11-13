# v1.0.0 · 鲸鲸唱歌补丁（带伴奏）

> [!IMPORTANT]
> **这是补丁，不是独立软件，单独下载不能运行。**
> 必须先安装 **鲸鲸 / Whale Girl**：<https://github.com/Banan1cee/whale_girl>
> 当前适配：**4.1.0**。

## 功能

- 微信聊天里说 `唱首歌` / `来首小星星` / `唱歌`，她会用 Breeze Blue 的声音唱一段；
- 钢琴分解和弦 + 贝斯 + 轻底鼓的伴奏，程序生成，无版权音乐；
- 启动器新增 **「唱歌」** 栏：开关、按群聊/私聊勾选、试听、冷却设置；
- 第一首约 20–60 秒生成，之后缓存直接发；
- 默认 120 秒冷却、每小时 6 首，可改。

## 基础软件与语音前提

1. 安装鲸鲸 **4.1.0**：<https://github.com/Banan1cee/whale_girl/releases/latest>
2. 启动器 → **语音发送**：打开自动语音，选择虚拟声卡，确认 Breeze Blue 可用；
3. 安装本补丁，完全退出启动器再打开（桥接也要重启）。

> 自动语音没开 / 没选虚拟声卡时，只会回文字提示，不发语音。

## 安装 / 更新（3 步）

1. 下载 `whale-girl-sing-patch-v1.0.0.zip`，解压；
2. 双击 `install.cmd`：
   - 自动找鲸鲸目录；找不到会让你选包含 `server.js` 的文件夹；
   - 备份 `server.js`、`bridge\voice_reply.py`、启动器；
   - 最后询问是否创建桌面快捷方式；
3. **完全退出启动器**（托盘右键退出）再打开 → 点「启动」→ 左侧 **「唱歌」**。

## 没有快捷方式怎么更新

1. 打开 <https://github.com/7ather-LX/whale-girl-sing-patch/releases/latest>；
2. 下载最新 ZIP；
3. 解压到固定目录；
4. 双击 `install.cmd`；
5. 完全退出启动器再打开。

## 使用

```text
@鲸鲸 唱首歌
@鲸鲸 来首小星星
@鲸鲸 唱歌
```

- 只发语音，不先发歌词；
- 管理页：<http://127.0.0.1:8787/sing-patch/> 或启动器「唱歌」；
- 「试听」只生成 WAV，不发微信。

## 实现方式

`patch/sing.py` 用 Breeze Blue 逐句合成公版童谣《小星星》歌词，ffmpeg 变调到旋律，
numpy 生成伴奏并混音；服务端返回 `[[SING:文件名]]`，桥接语音发送，
启动器 `AutoVoiceWorker` 识别标记后直接播放缓存 WAV，微信录制成为语音消息。

## 已知限制

- 依赖基础软件「语音发送」和虚拟声卡。
- 只适配鲸鲸 **4.1.0**；基础软件更新后重跑 `install.cmd`。
- 只内置《小星星》一首；可改 `patch/sing.py` 的歌词/旋律。
- 变调 TTS 是 AI 唱歌效果，不是真人歌手；音质取决于音色和虚拟声卡。
- 生成需要网络；失败会回文字，不会发假音频。

## 作者与许可

- 基础软件：**鲸鲸 / Whale Girl**，作者 **Banan1ce_up**（GitHub [@Banan1cee](https://github.com/Banan1cee)）。
- 本补丁：**7ather-LX**，<https://github.com/7ather-LX/whale-girl-sing-patch>。
- **AGPL-3.0-only**；分发请保留 `LICENSE`、`NOTICE.md` 和完整源码。

> 完全免费、为爱发电。
