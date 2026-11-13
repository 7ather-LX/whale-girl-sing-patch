param(
  [string]$AppRoot = "",
  [switch]$SkipLauncher,
  [switch]$CreateShortcuts,
  [switch]$NoShortcuts
)
$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$pkg = [System.IO.File]::ReadAllText((Join-Path $here "package.json"), [System.Text.Encoding]::UTF8) | ConvertFrom-Json

function Info([string]$t) { Write-Host ("  " + $t) }
function Step([string]$t) { Write-Host ("`n== " + $t) -ForegroundColor Cyan }
function Fail([string]$t) { Write-Host ("[ERROR] " + $t) -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "WhaleGirl singing patch installer" -ForegroundColor Cyan
Write-Host "  This is a PATCH, not a standalone app. Install WhaleGirl first:" -ForegroundColor Yellow
Write-Host "  https://github.com/Banan1cee/whale_girl"
Write-Host "  Compatible base: WhaleGirl 4.1.0"
Write-Host ""

function Find-AppRoot {
  foreach ($key in @(
      "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*",
      "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*",
      "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*")) {
    try {
      Get-ItemProperty $key -ErrorAction SilentlyContinue | ForEach-Object {
        if ($_.DisplayName -match "Whale|鲸鲸" -and $_.InstallLocation) {
          $p = [string]$_.InstallLocation
          if (Test-Path (Join-Path $p "server.js")) { return $p }
        }
      }
    } catch { }
  }
  try {
    Get-Process WhaleLauncher -ErrorAction SilentlyContinue | ForEach-Object {
      if ($_.Path) { $p = Split-Path -Parent $_.Path; if (Test-Path (Join-Path $p "server.js")) { return $p } }
    }
  } catch { }
  foreach ($p in @((Join-Path $env:LOCALAPPDATA "Programs\WhaleGirl"), (Join-Path $env:ProgramFiles "WhaleGirl"), "D:\WhaleGirl", "E:\WhaleGirl")) {
    if (Test-Path (Join-Path $p "server.js")) { return $p }
  }
  return ""
}

function Pick-AppRoot {
  try {
    Add-Type -AssemblyName System.Windows.Forms | Out-Null
    $d = New-Object System.Windows.Forms.FolderBrowserDialog
    $d.Description = "Select the WhaleGirl folder (contains server.js). Do NOT select this patch folder."
    $d.ShowNewFolderButton = $false
    if ($d.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) { return "" }
    return $d.SelectedPath
  } catch { return "" }
}

function New-Shortcuts([int]$Port) {
  $made = @()
  try {
    $desktop = [Environment]::GetFolderPath("Desktop")
    if (-not $desktop -or -not (Test-Path $desktop)) { return $made }
    $shell = New-Object -ComObject WScript.Shell
    $installer = Join-Path $here "install.cmd"
    if (Test-Path $installer) {
      $lp = Join-Path $desktop "鲸鲸唱歌补丁-安装或更新.lnk"
      $l = $shell.CreateShortcut($lp)
      $l.TargetPath = $installer; $l.WorkingDirectory = $here
      $l.Description = "安装/更新鲸鲸唱歌补丁（先装 WhaleGirl 本体）"; $l.Save(); $made += $lp
    }
    $up = Join-Path $desktop "鲸鲸唱歌补丁-管理页.url"
    $u = $shell.CreateShortcut($up); $u.TargetPath = "http://127.0.0.1:$Port/sing-patch/"; $u.Save(); $made += $up
  } catch { Info "could not create shortcuts: $($_.Exception.Message)" }
  return $made
}

function Patch-BridgeVoice([string]$root) {
  $bridge = Join-Path $root "bridge\voice_reply.py"
  if (-not (Test-Path $bridge)) { Info "bridge/voice_reply.py missing; skip bridge trigger"; return }
  $backup = "$bridge.whale-sing.bak"
  if (-not (Test-Path $backup)) { Copy-Item $bridge $backup -Force }
  $text = [System.IO.File]::ReadAllText($bridge, [System.Text.Encoding]::UTF8)
  if ($text -match "whale-sing-patch") { Info "bridge trigger already present"; return }
  $snippet = "`r`n`r`n# >>> whale-sing-patch`r`n" +
    "_whale_sing_original_requested = requested`r`n" +
    "def requested(text):`r`n" +
    "    return _whale_sing_original_requested(text) or bool(re.search(r'唱|sing', str(text or ''), re.I))`r`n" +
    "# <<< whale-sing-patch`r`n"
  [System.IO.File]::AppendAllText($bridge, $snippet, (New-Object System.Text.UTF8Encoding($false)))
  Info "bridge trigger added (backup: voice_reply.py.whale-sing.bak)"
}

if (-not $AppRoot) { $AppRoot = Find-AppRoot }
if (-not $AppRoot) {
  Write-Host "WhaleGirl was not found automatically." -ForegroundColor Yellow
  Write-Host "In the next dialog, choose the folder that contains server.js."
  $AppRoot = Pick-AppRoot
}
if (-not $AppRoot -or -not (Test-Path (Join-Path $AppRoot "server.js"))) {
  Fail "No WhaleGirl folder selected. Install WhaleGirl first, then run this installer again."
}
$AppRoot = (Resolve-Path $AppRoot).Path
Info "target: $AppRoot"
$version = ""
try { $version = ([System.IO.File]::ReadAllText((Join-Path $AppRoot "package.json"), [System.Text.Encoding]::UTF8) | ConvertFrom-Json).version } catch { }
Info "base version: $version"
if ($version -and $version -ne "4.1.0") { Write-Host "  [WARN] Tested with 4.1.0; continuing." -ForegroundColor Yellow }

Step "1/7 Check package"
foreach ($n in @("patch", "launcher", "install.ps1")) {
  if (-not (Test-Path (Join-Path $here $n))) { Fail "package incomplete: missing $n" }
}
Info "package OK"

Step "2/7 Copy patch"
$dest = Join-Path $AppRoot "whale-sing-patch"
if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
Copy-Item (Join-Path $here "patch") $dest -Recurse
Info "copied to $dest"

Step "3/7 Add server.js hook"
$serverPath = Join-Path $AppRoot "server.js"
$serverBackup = Join-Path $AppRoot "server.js.whale-sing.bak"
$server = [System.IO.File]::ReadAllText($serverPath)
if ($server -notmatch "whale-sing-patch") {
  if (-not (Test-Path $serverBackup)) { Copy-Item $serverPath $serverBackup -Force }
  $lines = $server -split "`r?`n"
  $new = @("require('./whale-sing-patch').install();") + $lines
  [System.IO.File]::WriteAllText($serverPath, ($new -join "`r`n"), (New-Object System.Text.UTF8Encoding($false)))
  Info "hook added (backup: server.js.whale-sing.bak)"
} else { Info "hook already present" }

Step "4/7 Patch bridge voice trigger"
Patch-BridgeVoice $AppRoot

Step "5/7 Syntax check"
$node = Join-Path $AppRoot "runtime\node.exe"
if (-not (Test-Path $node)) { $node = "node" }
Push-Location $AppRoot
try {
  & $node --check "server.js"; if ($LASTEXITCODE -ne 0) { Fail "server.js syntax failed" }
  & $node --check "whale-sing-patch\index.js"; if ($LASTEXITCODE -ne 0) { Fail "patch syntax failed" }
  Info "syntax OK"
} finally { Pop-Location }

Step "6/7 Check voice sending"
$voiceFile = Join-Path $AppRoot "data\voice-send.json"
$voiceOk = $false
if (Test-Path $voiceFile) {
  try { $voiceOk = (([System.IO.File]::ReadAllText($voiceFile, [System.Text.Encoding]::UTF8) | ConvertFrom-Json).Enabled -eq $true) } catch { }
}
if ($voiceOk) { Info "voice sending is enabled" }
else { Write-Host "  [WARN] 自动语音未开启：请到启动器「语音发送」打开，并选择虚拟声卡。" -ForegroundColor Yellow }

Step "7/7 Install launcher tab (optional)"
if (-not $SkipLauncher) {
  $src = Join-Path $here "launcher\WhaleLauncher.exe"
  $dst = Join-Path $AppRoot "WhaleLauncher.exe"
  $wanted = ""
  try { $wanted = (Get-Content (Join-Path $here "launcher\version.txt") -Raw).Trim() } catch { }
  if ((Test-Path $src) -and $wanted -eq $version) {
    $backup = "$dst.whale-sing-patch.bak"
    $marker = "$dst.whale-sing-patch.installed"
    $old = ""
    if (Test-Path $marker) { $old = (Get-Content $marker -Raw).Trim() }
    if (-not $old -or $old -ne $wanted) {
      try { Copy-Item $dst $backup -Force; Info "launcher backup: $backup" } catch { Info "launcher backup failed: $($_.Exception.Message)" }
    }
    $installed = $false
    try { Copy-Item $src $dst -Force; $installed = $true }
    catch {
      try {
        $oldPath = $dst + ".old-" + [DateTime]::Now.ToString("yyyyMMddHHmmss")
        Move-Item $dst $oldPath -Force
        Copy-Item $src $dst -Force
        $installed = $true
        Info "old launcher renamed to $oldPath"
      } catch { Info "launcher tab skipped: $($_.Exception.Message)" }
    }
    if ($installed) {
      try { Set-Content -Path $marker -Value $wanted -Encoding ASCII } catch { }
      Info "launcher tab installed (restart WhaleGirl to see it)"
    }
  } else { Info "launcher tab skipped: no build for base '$version' (wanted '$wanted')" }
} else { Info "launcher tab skipped (-SkipLauncher)" }

if (-not $NoShortcuts -and -not $CreateShortcuts) {
  $a = Read-Host "Create desktop shortcuts (install/update + management page)? [Y/n]"
  if ($a -notmatch '^\s*[nN]') { $CreateShortcuts = $true }
}
$port = "8787"
$pf = Join-Path $AppRoot "data\server-port.txt"
if (Test-Path $pf) { $raw = (Get-Content $pf -Raw).Trim(); if ($raw -match '^\d+$') { $port = $raw } }
if ($CreateShortcuts) {
  $made = New-Shortcuts -Port ([int]$port)
  if ($made.Count) { Info "desktop shortcuts:"; foreach ($m in $made) { Info "  $m" } }
} else {
  Info "desktop shortcuts skipped."
  Info "Update without a shortcut: download the latest ZIP from"
  Info "  https://github.com/7ather-LX/whale-girl-sing-patch/releases/latest"
  Info "extract it, then double-click install.cmd."
}

Write-Host ""
Write-Host "Installed successfully." -ForegroundColor Green
Write-Host ""
Write-Host "  Last step: FULLY EXIT the WhaleGirl launcher (tray -> Exit), then open it again."
Write-Host "  Click Start, then the '唱歌' tab (or open http://127.0.0.1:$port/sing-patch/)."
Write-Host "  Make sure 语音发送 is enabled and a virtual audio device is selected."
Write-Host "  In a selected chat, send: @鲸鲸 唱首歌"
Write-Host ""
Write-Host "  Self-check: `"$node`" `"$AppRoot\whale-sing-patch\cli.js`" doctor"
Write-Host "  Uninstall : double-click uninstall.cmd"
Write-Host ""
