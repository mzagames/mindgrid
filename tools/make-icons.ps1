# Draws MindGrid's PNG icons and Play Store feature graphic with System.Drawing (no extra tools needed).
# Usage: powershell -ExecutionPolicy Bypass -File tools/make-icons.ps1
Add-Type -AssemblyName System.Drawing
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
New-Item -ItemType Directory -Force (Join-Path $root 'store') | Out-Null

function Col($hex) { [System.Drawing.ColorTranslator]::FromHtml($hex) }
function RoundRect($x, $y, $w, $h, $r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = [Math]::Min(2 * $r, [Math]::Min($w, $h))
  if ($d -le 0) { $p.AddRectangle((New-Object System.Drawing.RectangleF($x, $y, $w, $h))); return $p }
  $p.AddArc($x, $y, $d, $d, 180, 90); $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90); $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $p.CloseFigure(); return $p
}
function Fill($g, $path, $hex) { $b = New-Object System.Drawing.SolidBrush (Col $hex); $g.FillPath($b, $path); $b.Dispose() }

# Draws the 4-tile logo mark inside a box (ox, oy, size) using the 64-unit design grid.
function DrawMark($g, $ox, $oy, $size, $scale) {
  $u = $size / 64.0
  $c = 32.0
  $tiles = @(@(13, 13, '#df9628', 4), @(34, 13, '#17998a', 4), @(13, 34, '#7b5ce0', 4), @(34, 34, '#e0573b', 8.5))
  foreach ($t in $tiles) {
    $x = $c + ($t[0] - $c) * $scale; $y = $c + ($t[1] - $c) * $scale
    Fill $g (RoundRect ($ox + $x * $u) ($oy + $y * $u) (17 * $scale * $u) (17 * $scale * $u) ($t[3] * $scale * $u)) $t[2]
  }
}
function NewCanvas($w, $h) {
  $bmp = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'; $g.InterpolationMode = 'HighQualityBicubic'; $g.TextRenderingHint = 'AntiAliasGridFit'
  return @($bmp, $g)
}
function Save($bmp, $g, $path) { $g.Dispose(); $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose(); Write-Host "wrote $path" }

# 1) "any" icons: rounded dark tile, transparent corners
foreach ($s in 192, 512) {
  $cv = NewCanvas $s $s; $g = $cv[1]
  Fill $g (RoundRect 0 0 $s $s ($s * 0.25)) '#1e1c19'
  DrawMark $g 0 0 $s 1.0
  Save $cv[0] $g (Join-Path $root "assets/icon-$s.png")
}
# 2) maskable icon + Play Store icon: full-bleed background, mark inside the safe zone
foreach ($item in @(@('assets/icon-maskable-512.png', 0.82), @('store/play-icon-512.png', 0.9))) {
  $cv = NewCanvas 512 512; $g = $cv[1]
  $g.Clear((Col '#1e1c19'))
  DrawMark $g 0 0 512 $item[1]
  Save $cv[0] $g (Join-Path $root $item[0])
}
# 3) Feature graphic 1024x500 (no transparency)
$cv = NewCanvas 1024 500; $g = $cv[1]
$g.Clear((Col '#f6f3ec'))
Fill $g (RoundRect 70 110 280 280 70) '#1e1c19'
DrawMark $g 70 110 280 1.0
$title = New-Object System.Drawing.Font('Segoe UI', 74, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$sub = New-Object System.Drawing.Font('Segoe UI', 32, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$ink = New-Object System.Drawing.SolidBrush (Col '#1e1c19'); $muted = New-Object System.Drawing.SolidBrush (Col '#6e695f')
$g.DrawString('MindGrid', $title, $ink, 395, 120)
$g.DrawString('Six calm daily logic puzzles', $sub, $muted, 400, 222)
$colors = '#df9628', '#17998a', '#e0573b', '#7b5ce0', '#2f80c9', '#c99a0e'
for ($i = 0; $i -lt 6; $i++) { Fill $g (RoundRect (400 + $i * 72) 300 56 56 14) $colors[$i] }
Save $cv[0] $g (Join-Path $root 'store/feature-graphic-1024x500.png')
