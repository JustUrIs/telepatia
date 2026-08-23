# Guion de rodaje — 3 minutos

**Versión actuada.** Cada plano dice qué se ve, qué decís, quién lo filma y cómo
conseguirlo. Nada de jerga.

Regla de oro: **filmás 4 planos tuyos, generás 4 con IA, grabás 3 pantallas.**
Once piezas. El resto es pegarlas.

---

## 0. Lo que necesitás antes de empezar

### Físico

| Cosa | Para qué |
|---|---|
| Tu notebook | es "la computadora del técnico" |
| Un celular o una segunda notebook | es "la máquina aislada" |
| 4 hojas impresas | la orden de trabajo, la hoja de preparación. Están en `fixtures/shop/*.png` — imprimilas |
| Un pendrive cualquiera | aparece 4 segundos y es el villano |
| Una mesa, luz lateral | no filmes contra una ventana |

### En la computadora

```bash
node scripts/pull-models.mjs --preset standard   # una vez, tarda ~5 min
node --test "test/*.test.js"                     # tiene que dar todo verde
node scripts/serve.mjs                           # dejalo abierto
```

Y probá los dos comandos del Acto 2 **antes** de grabar. Que no sea la primera
vez en cámara.

### Ajustes para que se vea bien

- Terminal: fondo negro, letra grande (18-20 pt). Ventana a pantalla completa.
- Navegador: modo pantalla completa (F11), sin barras, sin pestañas.
- Celular: brillo al máximo, notificaciones apagadas, modo avión listo para
  activar.
- Grabá a 1080p. Audio: **grabá la voz aparte con el celular pegado a la boca** y
  después la pegás. El micrófono de la notebook suena a lata.

---

## 1. El guion, plano por plano

**Leyenda de columnas:**
· **VOS** = te filmás
· **IA** = lo genera un modelo de video (prompts en la sección 2)
· **PANTALLA** = captura de pantalla

---

### ACTO 1 — El problema (0:00 – 0:40)

| # | Tiempo | Tipo | Qué se ve | Qué decís |
|---|---|---|---|---|
| 1 | 0:00–0:06 | **IA** | Un taller metalúrgico al amanecer. Máquinas grandes, luz azulada entrando por ventanales altos. Nadie todavía. | *(silencio, solo ambiente)* |
| 2 | 0:06–0:14 | **IA** | Primer plano de una máquina cortando metal. Chispas, refrigerante. Movimiento preciso y violento. | "Esta máquina vale medio millón de dólares." |
| 3 | 0:14–0:26 | **VOS** | **Plano medio.** Sentado a la mesa. Cuatro papeles desplegados adelante. Los mirás, mirás la pantalla, volvés a los papeles. | "Y no tiene internet. A propósito. Porque si alguien de afuera pudiera darle órdenes, no te roba una contraseña: te rompe la máquina." |
| 4 | 0:26–0:40 | **VOS** | **Plano cerrado de tus manos** pasando de un papel a otro, rápido, sin leerlos del todo. Tu dedo señala un número, dudás, seguís. | "Antes de arrancar tengo que revisar cuatro papeles. Que sea la pieza correcta, la versión correcta, las herramientas correctas. Tengo cuarenta segundos y treinta piezas esperando." |

> **Cómo actuar el plano 4:** no actúes "confundido". Actuá **apurado**. La
> tensión no es que Diego no sepa: es que no tiene tiempo. Mirá el reloj una vez.

---

### ACTO 2 — Lo que sale mal (0:40 – 1:00)

| # | Tiempo | Tipo | Qué se ve | Qué decís |
|---|---|---|---|---|
| 5 | 0:40–0:52 | **IA** | La misma máquina, pero algo sale mal: la herramienta baja y golpea el metal en seco. Chispazo. Todo se detiene. | "Si el archivo es de la versión vieja, tiro veinticuatro piezas a la basura." |
| 6 | 0:52–1:00 | **VOS** | **Plano cerrado.** Sacás un pendrive del bolsillo y lo dejás sobre la mesa. Lo mirás. | "Si pide una herramienta que no está montada, la máquina baja al vacío y se parte sola. Y adiviná cómo entra el archivo a una máquina sin internet." |

> **El pendrive es el villano y hay que tratarlo como tal.** Dejalo caer sobre la
> mesa con un golpe seco. Ese sonido tiene que quedar en el audio.

---

### ACTO 3 — El control (1:00 – 1:55) ← **el corazón**

| # | Tiempo | Tipo | Qué se ve | Qué decís |
|---|---|---|---|---|
| 7 | 1:00–1:08 | **VOS** | Sacás el pendrive de cuadro con la mano, decidido. Girás la notebook hacia cámara. | "Nosotros no lo enchufamos. Primero lo revisamos." |
| 8 | 1:08–1:30 | **PANTALLA** | Terminal. Corrés el comando del archivo **correcto**. Aparece **✓ LISTO PARA ENVIAR** y la lista de controles en verde. | "Una inteligencia artificial que corre acá, en mi máquina, sin internet, lee la foto de los papeles. Y un programa común compara lo que leyó contra el archivo." |
| 9 | 1:30–1:50 | **PANTALLA** | Corrés el comando del archivo **incorrecto**. Aparece **✗ NO APRIETES CYCLE START** y **cinco líneas en rojo**. Dejá el cursor quieto ahí 4 segundos. | "Este es el archivo equivocado. Versión vieja. Herramienta que no tengo. Punto de referencia distinto. Gira más rápido de lo que aguanta. Cinco cosas, y ninguna se ve mirando el archivo por arriba." |
| 10 | 1:50–1:55 | **VOS** | Mirás a cámara. Pausa. | "La inteligencia no decidió nada. Solo leyó los papeles. La decisión la tomó una resta." |

> **El plano 9 es EL plano del video.** Que las cinco líneas rojas se lean.
> Terminal a pantalla completa, letra grande. Si hace falta, hacé zoom en la
> edición.

**Comandos exactos:**

```bash
node bin/preflight.mjs fixtures/programs/part-1837-revC.nc \
  --job fixtures/shop/job-extracted.json

node bin/preflight.mjs fixtures/programs/part-1837-revB.nc \
  --job fixtures/shop/job-extracted.json
```

---

### ACTO 4 — La luz (1:55 – 2:40)

| # | Tiempo | Tipo | Qué se ve | Qué decís |
|---|---|---|---|---|
| 11 | 1:55–2:05 | **PANTALLA** | Navegador. Cargás el archivo y su comprobante. Aparece el recibo **en verde**. Se enciende el botón. | "Aprobado. Ahora sí lo paso. Pero no por un cable, ni por un pendrive." |
| 12 | 2:05–2:12 | **PANTALLA** | Cambiás el archivo por el equivocado **sin tocar el comprobante**. El botón **se apaga solo**. | "Y no puedo aprobar uno y mandar otro. Si cambio el archivo, el permiso se cae." |
| 13 | 2:12–2:30 | **VOS + PANTALLA** | **Plano abierto de la mesa.** Notebook parpadeando códigos. Celular apoyado en un soporte, mirándola. La barra del celular se llena. | "La pantalla se convierte en el cable. Y la luz va para un solo lado: no hay camino de vuelta." |
| 14 | 2:30–2:40 | **VOS** | **Primer plano de tus manos** apagando el WiFi en las dos pantallas. Volvés atrás. **Sigue funcionando.** | "Y esto es lo que más me gusta." *(pausa de 2 segundos mientras se ve que sigue andando)* "Sin internet. Nunca lo usó." |

> **El plano 14 es el que se acuerdan.** Filmalo en un solo movimiento, sin
> cortes: mano al WiFi de la notebook, mano al WiFi del celular, y la cámara
> baja hasta la barra que sigue avanzando. **No cortes.** Un solo plano vale más
> que tres bien editados.

---

### ACTO 5 — El cierre (2:40 – 3:00)

| # | Tiempo | Tipo | Qué se ve | Qué decís |
|---|---|---|---|---|
| 15 | 2:40–2:52 | **IA** | El taller otra vez, ahora con gente trabajando. Cálido. La máquina funcionando bien. | "Cortaron el cable para que nadie entre. Y después metieron todo por la puerta de atrás, en el bolsillo de alguien." |
| 16 | 2:52–3:00 | **VOS** | **Primer plano.** A cámara, tranquilo. Fondo negro o pared lisa. | "Nosotros convertimos la pantalla en la única puerta. Entra luz, no un aparato." |

---

## 2. Los cuatro planos que genera la IA

**Herramienta recomendada: Google Veo 3.1** (dentro de Google Flow). Es la mejor
hoy para cine y **genera el audio ambiente sincronizado**, así que los planos de
taller vienen con sonido.

Alternativas: **Runway Gen-4.5** si querés editar todo en el mismo lugar,
**Kling 3.0** si querés gastar poco (~US$0,84 por clip de 10 segundos).

> Escribí los prompts **en inglés**: todos los modelos rinden bastante mejor.

### Plano 1 — El taller vacío al amanecer

```
Empty industrial machine shop at dawn, cold blue light entering through tall
factory windows, rows of large CNC milling machines idle and silent, dust
particles floating in the light beams, slow dolly forward down the aisle,
anamorphic lens, shallow depth of field, cinematic, muted teal and steel color
grade, no people, 35mm film grain
```

### Plano 2 — La máquina cortando

```
Extreme close-up of a CNC end mill cutting into aluminum, bright sparks and
coolant spray, precise violent mechanical motion, metal chips flying in slow
motion, dramatic side lighting, macro lens, shallow focus, industrial, high
contrast, cinematic
```

### Plano 5 — El choque

```
Close-up of a CNC machine tool holder descending and striking solid metal stock
with no cutting tool mounted, sudden violent impact, single bright spark burst,
machine abruptly stops, coolant dripping, red warning light reflecting on wet
metal, dramatic lighting, slow motion, cinematic, tense
```

### Plano 15 — El taller trabajando

```
Wide shot of a working machine shop in the morning, warm sunlight through
windows, two machinists in blue work clothes moving between machines, a CNC
machine running smoothly behind them, steam and coolant mist in the air, warm
golden color grade, hopeful, cinematic, 35mm
```

**Consejo:** generá **3 variantes de cada uno** y quedate con la mejor. Cuestan
centavos y la primera casi nunca es la buena.

**Qué NO le pidas a la IA:** manos en primer plano, texto en pantalla, o caras
que tengan que ser la misma persona en dos planos. Ahí todavía falla feo. Todo
eso filmalo vos.

---

## 3. Cómo lo armás sin pelearte

**Orden de trabajo sugerido:**

1. **Grabá las pantallas primero** (planos 8, 9, 11, 12). Son los que más
   intentos necesitan y los que no dependen de la luz del día.
2. **Generá los 4 clips de IA** mientras tanto — tardan unos minutos cada uno.
3. **Filmá tus planos** de una sentada, con la misma ropa y la misma luz.
4. **Grabá la voz completa** de un tirón, leyendo el guion. Después la cortás.
5. **Pegá todo** siguiendo la tabla.

**Para grabar pantalla:** OBS Studio (gratis) o la grabadora que trae Windows
(`Win + Alt + R`).

**Para editar:** CapCut (gratis, y tiene subtítulos automáticos), o DaVinci
Resolve si querés algo serio.

**Ponele subtítulos.** Los jurados miran muchos videos, varios sin sonido.

---

## 4. Si algo sale mal

| Problema | Qué hacés |
|---|---|
| El celular no lee los códigos | Bajá "Datos por imagen" a **300** y las imágenes por segundo a **2**. Acercá el celular hasta que el código llene el recuadro |
| La cámara del celular no abre | Tiene que entrar por `https://` y con el certificado instalado. Si falla, **filmá con dos notebooks**: el receptor en `localhost` funciona siempre |
| El modelo tarda demasiado en cámara | Usá `--job` (es lo que ya está en los comandos). Es una lectura ya hecha, y **decilo**: "esto lo leyó hace un rato" |
| Se te cae todo | Tenés `docs/ocr-bench.json` y las capturas. Un video que muestra resultados reales con una explicación honesta gana a uno perfecto que nadie cree |

---

## 5. Lista de control antes de subir

- [ ] Dura **menos de 3 minutos**
- [ ] Se leen las **cinco líneas rojas** sin pausar el video
- [ ] Se ve **apagar el WiFi** y que sigue funcionando, en un solo plano
- [ ] Se escucha claro, o tiene subtítulos
- [ ] En algún momento decís que **la IA no decide, solo lee**
- [ ] En algún momento decís algo que el producto **no** hace
- [ ] No aparece la palabra "firmado" ni "garantizado" ni "imposible"
- [ ] El repositorio está en **público** (si no, no cuenta)

---

## 6. Las tres frases que no pueden faltar

Si tenés que cortar por tiempo, cortá lo demás. Estas tres son el video:

> **1.** "Esta máquina no tiene internet a propósito. Y el archivo llega en el
> bolsillo de alguien."

> **2.** "La inteligencia no decidió nada. Solo leyó los papeles. La decisión la
> tomó una resta."

> **3.** *(apagando el WiFi)* "Sin internet. Nunca lo usó."
