# Demo — guion, comandos y qué mirar

Todo lo que hace falta para grabar los 3 minutos. Los comandos están probados;
copiá y pegá.

---

## Antes de grabar (una vez)

```bash
git clone https://github.com/JustUrIs/telepatia
cd telepatia
npm install
```

Los modelos bajan solos la primera vez (~2,6 GB). Para no esperar en cámara:

```bash
node scripts/pull-models.mjs --preset standard
```

Si la máquina tiene poca RAM: `--preset lowMemory` (1,5 GB en vez de 2,6).

Verificá que todo esté verde antes de empezar:

```bash
node --test "test/*.test.js"      # 357 tests
```

---

## Los archivos del demo, y qué representa cada uno

| Archivo | Qué es en la vida real |
|---|---|
| `fixtures/shop/work-order.png` | la orden de trabajo que sale del ERP. **Es la fuente de verdad**: el programador de CAM no la escribe |
| `fixtures/shop/setup-sheet.png` | el setup sheet que el programador imprime junto con el programa |
| `fixtures/shop/setup-sheet-worn.png` | la fotocopia gastada que de verdad está pegada al lado de la máquina |
| `fixtures/shop/work-order-photo.png` | la orden fotografiada con el celular, apoyada torcida |
| `fixtures/programs/part-1837-revC.nc` | el programa correcto |
| `fixtures/programs/part-1837-revB.nc` | el programa que hay que frenar |
| `fixtures/programs/part-1837-revC.preflight.json` | el informe APROBADO del revC |
| `fixtures/programs/part-1837-revB.preflight.json` | el informe BLOQUEADO del revB |

El `revB` tiene **cinco errores independientes**, y son los cinco que un
operario apurado no ve:

```
revisión B      la orden pide C          → 24 piezas al tacho
T7              no está en el carrusel   → choque de herramienta
G55             el setup dice G54        → la pieza entera corrida
S11500          el límite es 10000 RPM
F2800           el límite es 2500 mm/min
```

---

## Acto 1 — El problema (0:00 – 0:35)

**Lo que se dice, no lo que se tipea.**

> Una planta con máquinas aisladas a propósito. Sin red, porque si alguien les
> toca los controles no se roba una contraseña: se rompe una turbina.
>
> Pero esas máquinas igual necesitan que les entren archivos. Y la forma real,
> en 2026, sigue siendo un tipo caminando con un pendrive.
>
> El 82% del malware que Honeywell encontró en pendrives de plantas
> industriales puede parar la operación. No robar datos: **parar la planta**.

Mostrar en pantalla, si querés, `docs/producto.md` §6 con los números y sus
fuentes.

---

## Acto 2 — El pre-flight, que es donde vive la IA (0:35 – 1:50)

**Terminal, grande.** Primero el programa bueno:

```bash
node bin/preflight.mjs fixtures/programs/part-1837-revC.nc
```

Esto corre los modelos de verdad: OCR sobre la orden y el setup sheet, y
QWEN3-4B extrayendo los campos. Tarda ~40 s, así que **grabalo aparte y cortá**,
o usá la extracción ya hecha para que sea instantáneo:

```bash
node bin/preflight.mjs fixtures/programs/part-1837-revC.nc \
  --job fixtures/shop/job-extracted.json
```

Sale:

```
  ✓  LISTO PARA ENVIAR
  ok    La revisión del programa es la que pide la orden
  ok    Todas las herramientas están en el carrusel
  ...
```

**Ahora el que hay que frenar.** Este es el momento del video:

```bash
node bin/preflight.mjs fixtures/programs/part-1837-revB.nc \
  --job fixtures/shop/job-extracted.json
```

```
  ✗  NO APRIETES CYCLE START

  FALL  La revisión del programa es la que pide la orden
        esperado: C          real: B
  FALL  Todas las herramientas están en el carrusel
        esperado: T1, T2, T3  real: no están en el setup: T7
  FALL  El offset de trabajo es el del setup
        esperado: G54         real: G54, G55
  FALL  Las RPM están dentro del límite
        esperado: <= 10000    real: 11500 RPM
  FALL  El avance está dentro del límite
        esperado: <= 2500     real: 2800 mm/min
```

**Lo que hay que decir mientras se ve eso:**

> El modelo leyó la orden de trabajo y el setup sheet, que son papeles. El
> programa no lo tocó: un `.nc` es un lenguaje regular y lo parsea código, exacto
> y demostrable.
>
> Y cada dato que el modelo extrajo **tiene que poder señalarse en los píxeles
> del documento**. Si no puede, no es un dato: es una alucinación o una
> inyección, y va a revisión humana.
>
> El modelo nunca decide. El veredicto lo calcula código comparando los dos
> conjuntos.

---

## Acto 3 — Por qué corre local, y el air gap (1:50 – 2:35)

```bash
node scripts/serve.mjs
```

Abrí el emisor en la compu y el receptor en el celular (las URLs las imprime el
comando).

**En el emisor cargá DOS archivos:**

| Campo | Archivo |
|---|---|
| Programa | `fixtures/programs/part-1837-revC.nc` |
| Informe de pre-flight | `fixtures/programs/part-1837-revC.preflight.json` |

Aparece el recibo en verde: **APROBADO · bytes exactos verificados**, y recién
ahí se habilita **Emitir**.

**El momento que vale la pena mostrar:** cambiá el programa por
`part-1837-revB.nc` sin tocar el informe. El botón se apaga solo y el recibo
dice **el archivo elegido NO es el que se aprobó: los bytes no coinciden**.

> No podés aprobar uno y mandar otro. Y esto **no es una firma** — el informe es
> un JSON sin firmar. Cierra el error humano y el cambio accidental, que es el
> caso que pasa de verdad en un taller. Decir más que eso sería mentir.

Volvé al `revC` y emitilo por luz.

**Y el momento que cierra todo: apagá el wifi en cámara.** La página sigue
andando — service worker — y la transferencia también, porque nunca usó la red.

**Lo que se dice:**

> Esto corre en la laptop del técnico, no en el CNC. Un control de 2003 no puede
> correr un modelo de 4B, y nadie quiere un modelo de lenguaje adentro de la
> base de cómputo confiable de una máquina que mueve acero.
>
> Y corre local **por obligación, no por elegancia**: el inventario de una
> planta es el mapa de sus vulnerabilidades. Mandarlo a una API en la nube es
> exactamente lo que el air gap existe para impedir.
>
> Un pendrive es una computadora escondida, con firmware propio. Esto es luz. No
> hay controlador que explotar del otro lado.

---

## Acto 4 — Cierre (2:35 – 3:00)

> NERC CIP-010 obliga a verificar, antes de cada cambio a un sistema crítico, la
> identidad y la integridad del software que se instala. Eso es una norma
> auditable, con multas.
>
> Nuestro informe es exactamente eso, y sale solo, por cada transferencia.
>
> No simulamos el mecanizado. No calculamos colisiones. Verificamos que **el
> papeleo y el programa digan lo mismo** — que es lo que hoy hace una persona
> apurada, a las siete de la mañana, con treinta piezas en cola.

---

## Si querés mostrar la robustez (opcional, 20 s)

Con los documentos sucios: la foto torcida y la fotocopia gastada.

```bash
node scripts/try-preflight.mjs --worn
```

Y el resultado honesto del OCR sobre entrada degradada:

```bash
cat docs/ocr-bench.json
```

```
limpio           6/6 datos clave   conf. media 0.90
rotado 3°        6/6               0.90
bajo contraste   6/6               0.88
con ruido        3/6               0.33   ← falla, y falla RUIDOSAMENTE
```

**Decir esto, no esconderlo:**

> Con ruido fuerte el OCR se equivoca. Leyó `4.0.0` como `4.0,8`. Pero lo leyó
> con confianza 0.32, y por eso el sistema no aprueba sobre ese dato.
>
> `Rev B` contra `Rev C` es **un carácter**. Un dato mal leído con confianza baja
> es un problema que el sistema puede ver venir — y entonces tiene que verlo.

---

## Códigos de salida, por si lo querés en un pipeline

```
0   listo para enviar
1   revisar antes de enviar
2   bloqueado
```

---

## Qué NO prometer en cámara

- No simulamos el mecanizado ni detectamos colisiones.
- El transporte óptico mueve kilobytes por segundo, no un firmware de 200 MB.
- El software receptor tiene que llegar al CNC una primera vez por los medios
  que ya usan. Después se actualiza por luz.
- "Nadie resuelve la entrada" es falso: Waterfall vende el WF FLIP y Nexor el
  GuarDiode. La diferencia defendible es que el FLIP abre una ventana de tiempo
  con un botón, **sin aprobación por artefacto ni registro de qué cruzó**.
