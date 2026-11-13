param([string]$AppRoot = "")
$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path

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
  return ""
}

if (-not $AppRoot) { $AppRoot = Find-AppRoot }
if (-not $AppRoot -or -not (Test-Path (Join-Path $AppRoot "server.js"))) {
  Write-Host "WhaleGirl folder not found. Pass -AppRoot `"D:\WhaleGirl`"." -ForegroundColor Red
  exit 1
}
$AppRoot = (Resolve-Path $AppRoot).Path
Write-Host "Removing singing patch from $AppRoot" -ForegroundColor Cyan

$server = Join-Path $AppRoot "server.js"
$serverBak = Join-Path $AppRoot "server.js.whale-sing.bak"
if (Test-Path $server) {
  $lines = [System.IO.File]::ReadAllLines($server) | Where-Object { $_ -notmatch "whale-sing-patch" }
  [System.IO.File]::WriteAllText($server, ($lines -join "`r`n"), (New-Object System.Text.UTF8Encoding($false)))
  Write-Host "  hook removed"
}
if (Test-Path $serverBak) {
  try { Copy-Item $serverBak $server -Force; Remove-Item $serverBak -Force; Write-Host "  server.js backup restored" } catch { }
}

$dest = Join-Path $AppRoot "whale-sing-patch"
if (Test-Path $dest) { Remove-Item $dest -Recurse -Force; Write-Host "  patch files removed" }

$bridge = Join-Path $AppRoot "bridge\voice_reply.py"
$bridgeBak = "$bridge.whale-sing.bak"
if (Test-Path $bridgeBak) {
  try { Copy-Item $bridgeBak $bridge -Force; Remove-Item $bridgeBak -Force; Write-Host "  bridge voice_reply.py restored" } catch { }
} elseif (Test-Path $bridge) {
  $text = [System.IO.File]::ReadAllText($bridge, [System.Text.Encoding]::UTF8)
  $text = [regex]::Replace($text, "(?s)\r?\n# >>> whale-sing-patch.*?# <<< whale-sing-patch\r?\n?", "`r`n")
  [System.IO.File]::WriteAllText($bridge, $text, (New-Object System.Text.UTF8Encoding($false)))
  Write-Host "  bridge block removed"
}

$launcher = Join-Path $AppRoot "WhaleLauncher.exe"
$launcherBak = "$launcher.whale-sing-patch.bak"
$marker = "$launcher.whale-sing-patch.installed"
if (Test-Path $launcherBak) {
  try { Copy-Item $launcherBak $launcher -Force; Remove-Item $launcherBak -Force; Write-Host "  launcher restored" } catch { Write-Host "  [WARN] could not restore launcher" -ForegroundColor Yellow }
}
if (Test-Path $marker) { Remove-Item $marker -Force -ErrorAction SilentlyContinue }

$desktop = [Environment]::GetFolderPath("Desktop")
foreach ($n in @("鲸鲸唱歌补丁-安装或更新.lnk", "鲸鲸唱歌补丁-管理页.url")) {
  $p = Join-Path $desktop $n
  if (Test-Path $p) { Remove-Item $p -Force -ErrorAction SilentlyContinue }
}

Write-Host "Uninstalled. data\sing-cache and data\whale-sing-patch.json are kept." -ForegroundColor Green
Write-Host "Fully exit and reopen WhaleGirl."
