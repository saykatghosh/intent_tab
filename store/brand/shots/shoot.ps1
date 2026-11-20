# Store screenshots (1280x800) of the real page with sample data.
# 1) node store/brand/shots/server.mjs . 8765     (serves the extension with a fake chrome.* API)
# 2) .\store\brand\shots\shoot.ps1 -Scenes question,idle,palette,project,focus
# PNGs land next to this script; copy them to docs/assets/shots/.
param([string[]]$Scenes)
$S = $PSScriptRoot
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$urls = @{
  question = "http://localhost:8765/newtab.html?scene=question"
  idle     = "http://localhost:8765/newtab.html?scene=idle"
  palette  = "http://localhost:8765/newtab.html?scene=palette"
  project  = "http://localhost:8765/newtab.html?scene=project"
  focus    = "http://localhost:8765/blocked.html?u=https://www.youtube.com/watch?v=abc"
}
foreach ($sc in $Scenes) {
  & $chrome --headless=new --hide-scrollbars --force-prefers-reduced-motion --force-device-scale-factor=1 --virtual-time-budget=6000 "--window-size=1280,800" "--user-data-dir=$env:TEMP\intent-shot-$sc" "--screenshot=$S\$sc.png" $urls[$sc] 2>$null | Out-Null
  Start-Sleep -Milliseconds 300
  "$sc -> $((Get-Item "$S\$sc.png").Length) bytes"
}
