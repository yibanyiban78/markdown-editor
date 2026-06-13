# 构建脚本 - 将项目编译为可执行文件
# 使用方法: 右键 "使用 PowerShell 运行" 或在终端中执行

$root = Split-Path $MyInvocation.MyCommand.Path -Parent
$dist = Join-Path $root 'release'
$app = Join-Path $dist 'Markdown-editor-win32-x64'
$res = Join-Path $app 'resources'
$elec = Join-Path $root 'node_modules/electron/dist'
$tmp = Join-Path $dist '_tmp'

Write-Host "=== Clean ==="
if (Test-Path $dist) { Remove-Item -Recurse -Force $dist }

Write-Host "=== Create app.asar ==="
New-Item -ItemType Directory -Force -Path $res | Out-Null
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
Copy-Item -Recurse (Join-Path $root 'src') (Join-Path $tmp 'src')
Copy-Item (Join-Path $root 'main.js') $tmp
Copy-Item (Join-Path $root 'package.json') $tmp
npx -q asar pack $tmp (Join-Path $res 'app.asar') 2>$null
Remove-Item -Recurse -Force $tmp

Write-Host "=== Copy external assets ==="
New-Item -ItemType Directory -Force -Path (Join-Path $res 'assets') | Out-Null
Copy-Item (Join-Path $root 'assets\icon.png') (Join-Path $res 'assets\')
Copy-Item (Join-Path $root 'assets\icon.ico') (Join-Path $res 'assets\')
Copy-Item (Join-Path $root 'preload.js') (Join-Path $res 'preload.js')

Write-Host "=== Copy Electron runtime ==="
Get-ChildItem $elec | ForEach-Object {
    if ($_.Name -in @('LICENSE','LICENSES.chromium.html','version')) { return }
    Copy-Item $_.FullName $app -Recurse -Force
}

Write-Host "=== Rename & icon ==="
Rename-Item (Join-Path $app 'electron.exe') 'MarkdownEditor.exe'
$rcedit = Join-Path $root 'node_modules/rcedit/bin/rcedit-x64.exe'
& $rcedit (Join-Path $app 'MarkdownEditor.exe') --set-icon (Join-Path $root 'assets\icon.ico') 2>$null

$size = (Get-ChildItem -Recurse $app | Measure-Object -Property Length -Sum).Sum
Write-Host "`n===== Build Complete ====="
Write-Host "Output: $app"
Write-Host ("Size: {0:N2} MB" -f ($size / 1MB))
Write-Host "Exe: $(Join-Path $app 'MarkdownEditor.exe')"
