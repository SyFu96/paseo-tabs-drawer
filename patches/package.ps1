param(
    [string]$OutDir = (Join-Path (Split-Path $PSScriptRoot -Parent) "dist")
)

$ErrorActionPreference = "Stop"
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$version = (Get-Content (Join-Path $PSScriptRoot "VERSION") -Raw).Trim()
$name = "agent-drawer-tabs-$version"
$stage = Join-Path $OutDir $name
$zip = Join-Path $OutDir "$name.zip"

if (Test-Path $stage) { Remove-Item -Recurse -Force $stage }
New-Item -ItemType Directory -Path $stage -Force | Out-Null

foreach ($file in @("apply.ps1", "revert.ps1", "reapply.cmd", "README.md", "LICENSE", "VERSION")) {
    Copy-Item (Join-Path $PSScriptRoot $file) $stage
}
Copy-Item -Recurse (Join-Path $PSScriptRoot "agent-drawer-tabs") (Join-Path $stage "agent-drawer-tabs")

if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path $stage -DestinationPath $zip

Write-Host "打包完成：$zip"
