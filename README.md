> [!WARNING]
> **本项目已作废（2026-11-13）。**
> 鲸鲸基础软件的语音功能已经自带唱歌内容，不再需要这个补丁。
> 请勿新装；已经安装的请卸载，并恢复 `server.js`、`bridge\voice_reply.py` 和启动器。
> 仓库仅作留档，不再维护。

# 鲸鲸唱歌补丁 · WhaleGirl Sing Patch

让鲸鲸在微信里用 AI 声音唱一段歌，**带伴奏**，并作为语音发回当前聊天。

> [!IMPORTANT]
> **这是补丁，不是独立软件，单独下载不能运行。**
> 必须先安装 **鲸鲸 / Whale Girl**：<https://github.com/Banan1cee/whale_girl>
> 当前适配：**4.1.0**。

## 功能

- 微信里说 **「唱首歌」「来首小星星」「唱歌」**，她会唱一段；
- 人声来自基础软件的 **Breeze Blue** 音色，不是外部成品歌曲；
- 伴奏由程序生成（钢琴分解和弦 + 贝斯 + 轻底鼓），没有版权音乐；
- 第一首生成约 20–60 秒，之后走缓存；
- 启动器左侧新增 **「唱歌」** 栏，可开关、选歌、试听；
- 「在哪里生效」可以按群聊/私聊、逐个聊天勾选；
- 同一聊天冷却 120 秒、每小时最多 6 首，可改。

## 基础软件与语音前提

1. 安装鲸鲸 **4.1.0**：<https://github.com/Banan1cee/whale_girl/releases/latest>
2. 打开启动器 → **语音发送**：
   - 打开自动语音；
   - 选择虚拟声卡（VoiceSendEngine 会通过它播放，让微信录进去）；
   - 确认 Breeze Blue Key/音色可用。
3. 再安装本补丁，**完全退出启动器再打开**（桥接也要重启，补丁才会改到语音判定）。

> 没有虚拟声卡 / 自动语音没开时，点歌只会回一句提示，不会发语音。

## 安装 / 更新（3 步）

1. 下载 `whale-girl-sing-patch-vX.Y.Z.zip`，解压；
2. 双击 `install.cmd`：
   - 自动找鲸鲸目录；找不到会让你选包含 `server.js` 的文件夹；
   - 会备份 `server.js`、`bridge\voice_reply.py`、启动器；
   - 最后询问是否创建桌面快捷方式；
3. **完全退出启动器**（托盘右键退出）再打开 → 点「启动」→ 左侧 **「唱歌」**。

### 桌面快捷方式（安装时可选）

安装程序会问：

```text
Create desktop shortcuts (install/update + management page)? [Y/n]
```

- `Y`：创建「鲸鲸唱歌补丁-安装或更新」「鲸鲸唱歌补丁-管理页」；
- `n`：不创建，按下面手动更新。

### 没有快捷方式怎么更新

1. 打开 <https://github.com/7ather-LX/whale-girl-sing-patch/releases/latest>；
2. 下载最新 ZIP；
3. 解压到固定目录；
4. 双击 `install.cmd`；
5. 完全退出启动器再打开。

### 命令行安装

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1 -AppRoot "D:\WhaleGirl"
```

可选：`-SkipLauncher`、`-CreateShortcuts`、`-NoShortcuts`。

## 使用

在已勾选的聊天里：

```text
@鲸鲸 唱首歌
@鲸鲸 来首小星星
@鲸鲸 唱歌
```

- 她只会发语音，不会先发歌词；
- 第一首生成时请等一会儿，之后缓存直接发；
- 管理页：<http://127.0.0.1:8787/sing-patch/> 或启动器「唱歌」；
- 「试听」只生成 WAV，不发微信。

## 它是怎么唱的

1. 服务端识别点歌指令；
2. `patch/sing.py` 用 Breeze Blue 逐句合成《小星星》歌词；
3. ffmpeg 把每句变调到旋律音高，拟合节拍；
4. numpy 生成钢琴/贝斯/底鼓伴奏并混音；
5. 把 `[[SING:文件名]]` 交给桥接的语音发送；
6. 启动器 `AutoVoiceWorker` 识别这个标记，直接播放缓存 WAV，微信录进去后成为语音消息。

歌词和旋律是公版童谣《小星星》；人声由基础软件配置的 TTS 音色生成，不包含第三方歌曲录音。

## 已知限制

- 依赖基础软件的「语音发送」和虚拟声卡；没有配置好就只能回文字提示。
- 只适配鲸鲸 **4.1.0**；基础软件更新后重跑 `install.cmd`（可能会覆盖桥接补丁）。
- 只内置《小星星》一首；可在 `patch/sing.py` 里改歌词/旋律，或在管理页选择（后续版本）。
- 变调后的 TTS 是“AI 唱歌”效果，不是真人歌手；音质取决于 Breeze Blue 音色和虚拟声卡。
- 生成需要网络（Breeze TTS）；失败会回一句“没唱出来”，不会发假音频。

## 卸载

双击 `uninstall.cmd`：删除挂钩、补丁目录，恢复 `server.js`、`bridge\voice_reply.py` 和启动器。
`data\sing-cache` 和 `data\whale-sing-patch.json` 会保留。

## 作者与许可

- 基础软件：**鲸鲸 / Whale Girl**，作者 **Banan1ce_up**（GitHub [@Banan1cee](https://github.com/Banan1cee)）。
- 本补丁：**7ather-LX**，<https://github.com/7ather-LX/whale-girl-sing-patch>。
- **AGPL-3.0-only**；分发请保留 `LICENSE`、`NOTICE.md` 和完整源码。

> 完全免费、为爱发电，没有收费版、没有广告。
