这个目录是给鲸鲸 4.1.0 启动器加「补丁 / 图片 / 唱歌」三栏的成品：

- `WhaleLauncher.exe`：编译好的启动器；
- `launcher.patch`：相对上游 4.1.0 的改动（三个 WebView2 页面 + 导航项 + AutoVoiceWorker 的 `[[SING:...]]` 缓存音频分支）；
- `version.txt`：对应本体版本。

> 上游：<https://github.com/Banan1cee/whale_girl>，`main` 4.1.0，
> commit `8d541f430622054f84b27c7b349f11a7afeb2a8e`。

重新构建：

```powershell
git clone --branch main https://github.com/Banan1cee/whale_girl.git whale_girl
cd whale_girl
git apply "C:\path\to\whale-girl-sing-patch\launcher\launcher.patch"
dotnet add launcher/WhaleLauncher.csproj package Microsoft.Web.WebView2 --version 1.0.4314.35
dotnet publish launcher/WhaleLauncher.csproj -c Release -o out `
  -p:PublishSingleFile=true -p:SelfContained=false -p:IncludeNativeLibrariesForSelfExtract=true
```

「唱歌」页打开 `/sing-patch/`；如果没装旧补丁/图片补丁，对应标签页只会显示未连接，不影响唱歌页。
