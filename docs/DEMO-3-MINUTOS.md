# telepatía — plan de demo de 3 minutos

## La experiencia que tiene que quedar

El jurado debe recordar una secuencia, no una arquitectura:

> **La IA entiende el trabajo. El código frena el error. La luz cruza el air
> gap.**

Hay un solo momento de «magia»: dos equipos sin Wi-Fi y un archivo apareciendo
por una secuencia de QR dinámicos. Todo lo anterior existe para que esa magia no
sea un truco visual, sino el último paso de una decisión segura.

## Timeline cerrado

| Tiempo | Imagen | Acción / idea hablada |
|---|---|---|
| 0:00–0:12 | Primer plano de la orden, el setup gastado y `Rev B` en el programa | «An AI agent should never control…» Abrir con el error físico, no con el logo |
| 0:12–0:32 | Operario alternando entre tres documentos; breve corte a un USB | Reconciliación manual, Revision B/C, T7 y la lección de Stuxnet |
| 0:32–0:46 | Texto enorme: `$2.3M / hour` y `82% disruptive` con fuente pequeña | Stakes económicos y de seguridad; una cifra por plano |
| 0:46–1:08 | Grabación real: QVAC leyendo `setup-sheet-worn.png`; overlay `LOCAL · OCR_LATIN · QWEN3 4B Q4` | Explicar extracción local, grounding y fallo cerrado |
| 1:08–1:25 | Diagrama de tres líneas: `messy docs → LOCAL AI`, `.nc → CODE`, `verdict → CODE` | La decisión de arquitectura que hace creíble el producto |
| 1:25–1:37 | Terminal grande: Rev C, `LISTO PARA ENVIAR` | El caso control tiene que pasar; si nada pasa, no hay producto |
| 1:37–1:55 | Terminal grande: Rev B, `NO APRIETES CYCLE START`; aparecen cinco fallos | Clímax racional: revisión, T7, G55, RPM y feed |
| 1:55–2:07 | Montaje de limpio, rotado, bajo contraste y ruido severo | Tres recuperan 6/6; ruido 3/6 y va a revisión. Honestidad visible |
| 2:07–2:12 | Plano físico de los dos equipos; Wi-Fi se apaga en cámara | No usar un icono agregado en edición: mostrar el estado real |
| 2:12–2:35 | QR cambiando en A; cámara y progreso en B; termina en `SHA-256 verificado` | No hablar durante los primeros dos segundos. Dejar que el jurado descubra la magia |
| 2:35–2:48 | Gráfico mínimo: `telemetry OUT` / `understood artifacts IN` | Competencia: diodos/guards/USB kiosks y nuestra capa semántica |
| 2:48–3:00 | Archivo reconstruido + plano de ambos equipos todavía offline | Frase final: `AI reads it. Code decides. Light carries it across.` |

## Material que hay que grabar

### Clip A — inferencia QVAC real

Grabar una corrida verdadera antes de editar:

```powershell
node scripts/try-preflight.mjs
```

No esconder los 30–40 s de OCR/modelo ni hacer pasar una extracción precargada
por inferencia. En el video final usar un timelapse de 6–8 s con un rótulo
honesto, por ejemplo:

```text
REAL LOCAL RUN · 34.6 s total · 4.1 s structured extraction
OCR_LATIN 98 MB · QWEN3 4B Q4_K_M 2.50 GB · RTX 4060 Laptop
```

Antes de congelar esos números, copiar el tiempo total exacto de la corrida que
se grabe. No mezclar latencias de corridas distintas.

Mostrar durante un segundo el JSON de `docs/preflight-extract.json`: `schemaOk`,
los campos anclados y `ungrounded: []`. El jurado del track necesita ver que no
es un JSON escrito a mano.

### Clip B — control bueno y ataque malo

Usar extracciones precargadas para que la comparación sea instantánea, pero
rotularlas como replay del resultado QVAC ya mostrado:

```powershell
node bin/preflight.mjs fixtures/programs/part-1837-revC.nc `
  --job fixtures/shop/job-extracted.json

node bin/preflight.mjs fixtures/programs/part-1837-revB.nc `
  --job fixtures/shop/job-extracted.json
```

Configuración visual:

- terminal a 28–32 px, 1080p, sin paneles laterales;
- no filmar el tipeo: los comandos ya están pegados;
- para Rev C, encuadrar `LISTO PARA ENVIAR` y tres checks;
- para Rev B, encuadrar el título rojo y los cinco pares esperado/real;
- no scrollear mientras se habla: usar cortes o zoom digital;
- el cursor del mouse queda quieto fuera del texto.

### Clip C — el QR que parece ciencia ficción

Usar tres dispositivos si es posible:

1. **A — emisor conectado:** laptop con el `.nc` aprobado.
2. **B — receptor aislado:** otra laptop con cámara integrada y la PWA ya
   cacheada. Este representa la estación de ingeniería, no un teléfono.
3. **C — cámara del video:** teléfono en trípode que muestra A y B en el mismo
   plano; así se prueba que no son dos grabaciones pegadas.

Preparación:

```powershell
node scripts/serve.mjs
```

1. Abrir emisor y receptor una vez con red.
2. Esperar en ambos `offline listo · funciona sin red`.
3. Dar permiso de cámara y probar la transferencia completa.
4. Seleccionar `part-1837-revC.nc`.
5. Para cámara real, empezar con 300 bytes/frame y 2 fps. El fixture aprobado se
   comprime a 431 bytes: son dos frames de datos, uno de paridad y el manifest,
   aproximadamente 2 s por vuelta. Es más lento que el máximo, pero legible y
   fotogénico. Subir a 3 fps solamente si el ensayo lo necesita.
6. Subir el brillo del emisor; desactivar brillo automático, ahorro de energía y
   notificaciones en ambos equipos.
7. Fijar foco/exposición si la cámara lo permite; evitar reflejos y luces a 50 Hz
   que produzcan bandas.
8. Recién entonces apagar Wi-Fi en ambos equipos, en el mismo plano físico.
9. Emitir. Mantener el plano hasta `documento completo · SHA-256 verificado` y
   el enlace `Guardar`.

Si la recuperación por paridad fue ensayada diez veces sin fallar, se puede
tapar brevemente un frame y mostrar `Recuperados por paridad: 1`. Si no es
perfectamente repetible, no hacer esa acrobacia durante la toma principal: la
paridad se nombra y está cubierta por tests, pero el clímax es la transferencia.

## El único gráfico de competencia

No usar logos ni una matriz de doce features. Un gráfico de cinco segundos:

```text
               AIR-GAPPED MACHINE

telemetry  ───────────────→ OUT     data diodes
files      ←─────────────── IN      guards / USB workflows
                     ↑
        understand + approve each artifact
                 TELEPATÍA
```

Voz:

> Data diodes are excellent at moving telemetry out. High-assurance guards can
> import too, with dedicated infrastructure. USB kiosks still manage USB. We add
> the missing semantic layer: does this exact file agree with this exact job?

## Dirección y edición

- Formato 16:9, 1080p, 30 fps, audio a -14 LUFS aproximadamente.
- La marca aparece después del primer error, no antes. Nada de intro animada.
- Máximo dos tipografías y tres colores: negro, blanco, verde/rojo de estado.
- Subtítulos ingleses quemados aun cuando el audio sea inglés; muchos jurados
  miran sin sonido.
- Cada subtítulo, como máximo dos líneas y 42 caracteres por línea.
- Música muy baja o ninguna. El sonido de teclado, el clic de apagar Wi-Fi y dos
  segundos de silencio frente al QR valen más que una pista épica.
- Ningún plano de código fuente. Mostrar código prueba que programamos; mostrar
  una máquina frenada y un archivo cruzando prueba que resolvimos algo.
- No usar stock footage de una central nuclear como si fuera cliente. Para el
  contexto bélico, una sola frase verbal sobre Natanz/Ukraine alcanza; el demo
  debe permanecer anclado en el CNC que realmente funciona.

## Plan de contingencia

| Falla | Respuesta preparada |
|---|---|
| QVAC tarda demasiado | Usar timelapse de la corrida real y conservar el log completo como evidencia |
| QR no toma foco | Bajar a 300 bytes/frame y 2 fps, acercar la cámara, subir brillo |
| El offline no queda cacheado | No grabar: corregir certificado/service worker y repetir el ensayo |
| La toma física falla durante edición | Usar una toma física completa anterior, nunca simular progreso |
| No entra todo en 3:00 | Cortar primero benchmark sucio a 4 s y competencia a 7 s; no cortar el workflow end-to-end |
| El audio supera 3:00 | Quitar adjetivos, no acelerar la voz por encima de 140 palabras/minuto |

## Ensayo mínimo antes de exportar

Hacer cinco tomas completas y anotar:

- duración total y palabras/minuto;
- tiempo real hasta `SHA-256 verificado`;
- si los cinco fallos de Rev B pueden leerse en un teléfono;
- si QVAC aparece antes que el QR;
- si se ve Wi-Fi apagado en ambos equipos;
- si alguien sin contexto puede responder al terminar: problema, producto,
  diferencia, comprador y limitación.

La exportación final se acepta solamente si dura **2:55–3:00**. Un video de
3:01 corre riesgo de corte automático; uno de 2:35 comunica que faltó producto.
