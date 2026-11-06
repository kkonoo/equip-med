# Draws the app icons (icons/app-*.png): calendar with a crimson header, two rings and six slots
# (one booked = crimson, one pending = light crimson). Maskable = light crimson background.
# Run: powershell -NoProfile -ExecutionPolicy Bypass -File tools/make-icons.ps1
Add-Type -AssemblyName System.Drawing
$out = Join-Path $PSScriptRoot '..\icons'
if (-not (Test-Path $out)) { New-Item -ItemType Directory -Path $out | Out-Null }

function RoundRect([float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $p = New-Object Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $p.AddArc($x, $y, $d, $d, 180, 90)
  $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $p.CloseFigure()
  return $p
}
function Brush($hex) { return New-Object Drawing.SolidBrush ([Drawing.ColorTranslator]::FromHtml($hex)) }
function Pen($hex, [float]$w) { return New-Object Drawing.Pen ([Drawing.ColorTranslator]::FromHtml($hex)), $w }

function DrawIcon {
  $bmp = New-Object Drawing.Bitmap 512, 512
  $g = [Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.Clear([Drawing.Color]::Transparent)

  # shadow, calendar card, crimson header (clipped to the card), rings
  $g.FillPath((Brush '#E7D6DA'), (RoundRect 76 100 360 340 48))
  $card = RoundRect 76 84 360 340 48
  $g.FillPath((Brush '#FFFFFF'), $card)
  $g.DrawPath((Pen '#EBD3D9' 6), $card)
  $g.SetClip($card)
  $g.FillRectangle((Brush '#B4213F'), 76, 84, 360, 100)
  $g.ResetClip()
  $g.FillPath((Brush '#6E1227'), (RoundRect 162 54 34 70 17))
  $g.FillPath((Brush '#6E1227'), (RoundRect 316 54 34 70 17))

  # slots: 3 x 2, second = booked, fifth = pending
  $colors = '#F2E6E9', '#B4213F', '#F2E6E9', '#F2E6E9', '#ECB4C0', '#F2E6E9'
  for ($i = 0; $i -lt 6; $i++) {
    $x = 120 + ($i % 3) * 98
    $y = 214 + [Math]::Floor($i / 3) * 98
    $g.FillPath((Brush $colors[$i]), (RoundRect $x $y 76 76 16))
  }
  $g.Dispose()
  return $bmp
}

function Save($bmp, [int]$size, $name) {
  $dst = New-Object Drawing.Bitmap $size, $size
  $g = [Drawing.Graphics]::FromImage($dst)
  $g.InterpolationMode = 'HighQualityBicubic'
  $g.SmoothingMode = 'AntiAlias'
  $g.DrawImage($bmp, 0, 0, $size, $size)
  $g.Dispose()
  $dst.Save((Join-Path $out $name), [Drawing.Imaging.ImageFormat]::Png)
  $dst.Dispose()
}

$icon = DrawIcon
Save $icon 512 'app-512.png'
Save $icon 192 'app-192.png'

# maskable: keep the drawing inside the safe zone (center 80%)
$mask = New-Object Drawing.Bitmap 512, 512
$g = [Drawing.Graphics]::FromImage($mask)
$g.InterpolationMode = 'HighQualityBicubic'
$g.Clear([Drawing.ColorTranslator]::FromHtml('#FBE9ED'))
$g.DrawImage($icon, 64, 64, 384, 384)
$g.Dispose()
Save $mask 512 'app-maskable-512.png'
Save $mask 192 'app-maskable-192.png'
Write-Host 'icons written'
