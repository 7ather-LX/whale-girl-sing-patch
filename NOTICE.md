# NOTICE

本仓库是 **鲸鲸 / Whale Girl** 的外挂补丁，不是独立软件。

- 基础软件：**鲸鲸 / Whale Girl**，作者 **Banan1ce_up**（GitHub [@Banan1cee](https://github.com/Banan1cee)），
  仓库 <https://github.com/Banan1cee/whale_girl>，许可 **AGPL-3.0-only**。
- 本补丁：**7ather-LX**，仓库 <https://github.com/7ather-LX/whale-girl-sing-patch>。

补丁通过安装器在 `server.js` 第一行加一句 `require('./whale-sing-patch').install();`，
并在 `bridge/voice_reply.py` 末尾追加一小段「唱」触发判定；卸载会恢复这两个文件。
人声由基础软件配置的 Breeze Blue TTS 生成，伴奏由程序合成；《小星星》为公版童谣。

本项目遵循 **AGPL-3.0-only**。分发或通过网络提供修改版时，请保留 `LICENSE`、本文件，
并提供完整对应源码。
