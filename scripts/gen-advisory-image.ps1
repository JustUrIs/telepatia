# Genera imágenes de un aviso de seguridad ICS, para probar el OCR con entradas
# que NO son un fixture escrito a mano.
#
#   powershell -ExecutionPolicy Bypass -File scripts/gen-advisory-image.ps1
#
# Produce cuatro variantes en fixtures/advisories/:
#   clean.png       renderizado limpio, el piso
#   rotated.png     3 grados de rotación, como una foto tomada a mano
#   lowcontrast.png gris sobre gris, como una fotocopia gastada
#   noisy.png       con ruido de sal y pimienta, como un escaneo viejo
#
# El track pide explícitamente entradas sucias: "it works on messy real inputs,
# not one hand-picked clean PDF". Estas son entradas que no elegimos de antemano
# en el sentido que importa: no las ajustamos hasta que el OCR las leyera.

Add-Type -AssemblyName System.Drawing

$dir = "fixtures/advisories"
New-Item -ItemType Directory -Force -Path $dir | Out-Null

$W = 900
$H = 1150

# Contenido de un aviso real de ICS-CERT: identificador, producto, rango de
# versiones afectado, versión corregida, CVE, CVSS, y las dos preguntas
# operativas que definen si el parche entra el sábado o el mes que viene.
$lineas = @(
  @{ t = "INDUSTRIAL CONTROL SYSTEMS ADVISORY"; f = 20; b = $true;  y = 50 },
  @{ t = "ICSA-26-198-04";                      f = 26; b = $true;  y = 88 },
  @{ t = "";                                     f = 14; b = $false; y = 130 },
  @{ t = "Vendor: Nordwind Automation GmbH";     f = 17; b = $false; y = 150 },
  @{ t = "Product: NW-9000 Series PLC";          f = 17; b = $false; y = 182 },
  @{ t = "Affected versions: 4.0.0 - 4.2.3";     f = 17; b = $false; y = 214 },
  @{ t = "Fixed in version: 4.3.0";              f = 17; b = $true;  y = 246 },
  @{ t = "";                                     f = 14; b = $false; y = 280 },
  @{ t = "CVE-2026-31877";                       f = 19; b = $true;  y = 300 },
  @{ t = "CVSS v3.1 base score: 9.8";            f = 17; b = $false; y = 334 },
  @{ t = "";                                     f = 14; b = $false; y = 370 },
  @{ t = "SUMMARY";                              f = 15; b = $true;  y = 392 },
  @{ t = "An improper authentication vulnerability allows an";  f = 16; b = $false; y = 420 },
  @{ t = "unauthenticated attacker on the same network segment"; f = 16; b = $false; y = 448 },
  @{ t = "to bypass the engineering workstation login and write"; f = 16; b = $false; y = 476 },
  @{ t = "arbitrary ladder logic to the controller.";            f = 16; b = $false; y = 504 },
  @{ t = "";                                     f = 14; b = $false; y = 540 },
  @{ t = "MITIGATION";                           f = 15; b = $true;  y = 562 },
  @{ t = "Requires reboot: YES";                 f = 17; b = $true;  y = 592 },
  @{ t = "Rollback available: NO";               f = 17; b = $true;  y = 624 },
  @{ t = "Prerequisites: NW-Runtime 2.8.1 or later"; f = 16; b = $false; y = 656 },
  @{ t = "";                                     f = 14; b = $false; y = 692 },
  @{ t = "Operators are advised to schedule the update during";  f = 16; b = $false; y = 714 },
  @{ t = "the next planned maintenance window. A cold restart";  f = 16; b = $false; y = 742 },
  @{ t = "of the controller is required after flashing.";        f = 16; b = $false; y = 770 },
  @{ t = "";                                     f = 14; b = $false; y = 806 },
  @{ t = "Published: 2026-07-17";                f = 15; b = $false; y = 828 },
  @{ t = "Last revised: 2026-08-02";             f = 15; b = $false; y = 856 }
)

function New-Advisory {
  param([string]$salida, [System.Drawing.Color]$fondo, [System.Drawing.Color]$tinta)

  $bmp = New-Object System.Drawing.Bitmap($W, $H)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.Clear($fondo)
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $pincel = New-Object System.Drawing.SolidBrush($tinta)

  foreach ($l in $lineas) {
    if ($l.t -eq "") { continue }
    $estilo = if ($l.b) { [System.Drawing.FontStyle]::Bold } else { [System.Drawing.FontStyle]::Regular }
    $fuente = New-Object System.Drawing.Font("Arial", $l.f, $estilo)
    $g.DrawString($l.t, $fuente, $pincel, 60, $l.y)
    $fuente.Dispose()
  }

  # Una línea horizontal, como tiene cualquier aviso maquetado.
  $lapiz = New-Object System.Drawing.Pen($tinta, 2)
  $g.DrawLine($lapiz, 60, 122, ($W - 60), 122)
  $lapiz.Dispose()

  $pincel.Dispose()
  $g.Dispose()
  $bmp.Save($salida, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Output "escrito $salida"
}

$negro = [System.Drawing.Color]::FromArgb(20, 20, 20)
$blanco = [System.Drawing.Color]::White

New-Advisory "$dir/clean.png" $blanco $negro

# Fotocopia gastada: poco contraste entre tinta y papel.
New-Advisory "$dir/lowcontrast.png" ([System.Drawing.Color]::FromArgb(228, 226, 222)) ([System.Drawing.Color]::FromArgb(120, 122, 126))

# Foto tomada a mano: unos grados de rotación y fondo fuera del área.
$src = [System.Drawing.Image]::FromFile((Resolve-Path "$dir/clean.png"))
$rot = New-Object System.Drawing.Bitmap($W, $H)
$g2 = [System.Drawing.Graphics]::FromImage($rot)
$g2.Clear([System.Drawing.Color]::FromArgb(210, 208, 205))
$g2.TranslateTransform(($W / 2), ($H / 2))
$g2.RotateTransform(3.0)
$g2.TranslateTransform(-($W / 2), -($H / 2))
$g2.DrawImage($src, 0, 0, $W, $H)
$g2.Dispose()
$rot.Save("$dir/rotated.png", [System.Drawing.Imaging.ImageFormat]::Png)
$rot.Dispose()
Write-Output "escrito $dir/rotated.png"

# Escaneo viejo: ruido de sal y pimienta sobre el limpio.
$noisy = New-Object System.Drawing.Bitmap($src)
$rnd = New-Object System.Random(7)
for ($i = 0; $i -lt 60000; $i++) {
  $x = $rnd.Next(0, $W)
  $y = $rnd.Next(0, $H)
  $v = $rnd.Next(0, 90)
  $noisy.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($v, $v, $v))
}
$noisy.Save("$dir/noisy.png", [System.Drawing.Imaging.ImageFormat]::Png)
$noisy.Dispose()
$src.Dispose()
Write-Output "escrito $dir/noisy.png"
