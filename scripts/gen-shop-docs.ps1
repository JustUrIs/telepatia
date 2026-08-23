# Genera los documentos de taller que el operario tiene abiertos antes de
# apretar Cycle Start, como imágenes con tipografía real.
#
#   powershell -ExecutionPolicy Bypass -File scripts/gen-shop-docs.ps1
#
# No son fixtures JSON escritos a mano: son documentos renderizados que hay que
# leer con OCR, que es el punto. El track pide entradas sucias y estas se
# generan también en variantes rotada y de bajo contraste.

Add-Type -AssemblyName System.Drawing

$dir = "fixtures/shop"
New-Item -ItemType Directory -Force -Path $dir | Out-Null

function New-Doc {
  param([string]$salida, [array]$lineas, [int]$W = 850, [int]$H = 1100,
        [System.Drawing.Color]$fondo, [System.Drawing.Color]$tinta)

  $bmp = New-Object System.Drawing.Bitmap($W, $H)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.Clear($fondo)
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $pincel = New-Object System.Drawing.SolidBrush($tinta)

  foreach ($l in $lineas) {
    if ($l.t -eq "") { continue }
    $estilo = if ($l.b) { [System.Drawing.FontStyle]::Bold } else { [System.Drawing.FontStyle]::Regular }
    $fuente = New-Object System.Drawing.Font("Arial", $l.f, $estilo)
    $x = if ($l.ContainsKey("x")) { $l.x } else { 55 }
    $g.DrawString($l.t, $fuente, $pincel, $x, $l.y)
    $fuente.Dispose()
  }

  $lapiz = New-Object System.Drawing.Pen($tinta, 2)
  $g.DrawLine($lapiz, 55, 108, ($W - 55), 108)
  $lapiz.Dispose()
  $pincel.Dispose()
  $g.Dispose()
  $bmp.Save($salida, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Output "escrito $salida"
}

# --- Orden de trabajo -------------------------------------------------------
# Viene del ERP. Es la fuente de verdad independiente: el programador de CAM
# escribe el .nc, pero NO escribe la orden.

$orden = @(
  @{ t="TALLER MECANICO SUR - ORDEN DE TRABAJO"; f=17; b=$true;  y=48 },
  @{ t="WO-2026-04471";                          f=24; b=$true;  y=76 },
  @{ t="Part number: 1837";                      f=18; b=$true;  y=140 },
  @{ t="Revision: C";                            f=22; b=$true;  y=178 },
  @{ t="Description: Bracket, spindle mount";    f=16; b=$false; y=218 },
  @{ t="Material: Aluminum 6061-T6";             f=18; b=$true;  y=252 },
  @{ t="Stock size: 120 x 80 x 30 mm";           f=16; b=$false; y=288 },
  @{ t="Quantity: 24 pieces";                    f=16; b=$false; y=322 },
  @{ t="";                                        f=14; b=$false; y=356 },
  @{ t="ASSIGNED MACHINE";                       f=15; b=$true;  y=378 },
  @{ t="Machine: HAAS VF-2";                     f=18; b=$true;  y=410 },
  @{ t="Control: Haas NGC";                      f=16; b=$false; y=444 },
  @{ t="Asset tag: CNC-004";                     f=16; b=$false; y=478 },
  @{ t="";                                        f=14; b=$false; y=512 },
  @{ t="SCHEDULE";                               f=15; b=$true;  y=534 },
  @{ t="Released: 2026-08-21";                   f=16; b=$false; y=566 },
  @{ t="Due: 2026-08-26";                        f=16; b=$false; y=600 },
  @{ t="Planner: M. Roldan";                     f=16; b=$false; y=634 },
  @{ t="";                                        f=14; b=$false; y=668 },
  @{ t="NOTE: Revision B is obsolete. Do not run"; f=16; b=$true; y=690 },
  @{ t="programs marked Rev B on this order.";    f=16; b=$true; y=720 }
)

# --- Setup sheet ------------------------------------------------------------
# Lo escribe el programador de CAM junto con el .nc. Dice qué herramientas
# tiene que haber en el carrusel.

$setup = @(
  @{ t="SETUP SHEET";                            f=17; b=$true;  y=48 },
  @{ t="Part 1837  Rev C";                       f=24; b=$true;  y=76 },
  @{ t="Machine: HAAS VF-2";                     f=17; b=$true;  y=140 },
  @{ t="Work offset: G54";                       f=17; b=$true;  y=176 },
  @{ t="Fixture: Kurt vise, jaw 6 in";           f=16; b=$false; y=212 },
  @{ t="Program: O1837";                         f=16; b=$false; y=246 },
  @{ t="";                                        f=14; b=$false; y=280 },
  @{ t="TOOL LIST";                              f=15; b=$true;  y=302 },
  @{ t="T1   12 mm end mill    3 flute carbide"; f=16; b=$false; y=336 },
  @{ t="T2   6 mm drill        HSS";             f=16; b=$false; y=370 },
  @{ t="T3   8 mm end mill     3 flute carbide"; f=16; b=$false; y=404 },
  @{ t="";                                        f=14; b=$false; y=438 },
  @{ t="LIMITS";                                 f=15; b=$true;  y=460 },
  @{ t="Max spindle: 10000 RPM";                 f=16; b=$false; y=494 },
  @{ t="Max feed: 2500 mm/min";                  f=16; b=$false; y=528 },
  @{ t="Z clearance: 25 mm";                     f=16; b=$false; y=562 },
  @{ t="";                                        f=14; b=$false; y=596 },
  @{ t="Prepared by: J. Aguirre";                f=16; b=$false; y=618 },
  @{ t="Date: 2026-08-21";                       f=16; b=$false; y=652 }
)

$blanco = [System.Drawing.Color]::White
$negro = [System.Drawing.Color]::FromArgb(20, 20, 20)
$papelGastado = [System.Drawing.Color]::FromArgb(226, 224, 218)
$tintaGastada = [System.Drawing.Color]::FromArgb(118, 120, 124)

New-Doc "$dir/work-order.png" $orden 850 1100 $blanco $negro
New-Doc "$dir/setup-sheet.png" $setup 850 1100 $blanco $negro

# Variante de taller: fotocopia gastada del setup sheet, que es lo que de verdad
# hay pegado al lado de la máquina.
New-Doc "$dir/setup-sheet-worn.png" $setup 850 1100 $papelGastado $tintaGastada

# Variante foto: la orden de trabajo sacada con el celular, apoyada torcida.
$src = [System.Drawing.Image]::FromFile((Resolve-Path "$dir/work-order.png"))
$rot = New-Object System.Drawing.Bitmap(850, 1100)
$g2 = [System.Drawing.Graphics]::FromImage($rot)
$g2.Clear([System.Drawing.Color]::FromArgb(205, 203, 200))
$g2.TranslateTransform(425, 550)
$g2.RotateTransform(-2.5)
$g2.TranslateTransform(-425, -550)
$g2.DrawImage($src, 0, 0, 850, 1100)
$g2.Dispose()
$rot.Save("$dir/work-order-photo.png", [System.Drawing.Imaging.ImageFormat]::Png)
$rot.Dispose()
$src.Dispose()
Write-Output "escrito $dir/work-order-photo.png"
