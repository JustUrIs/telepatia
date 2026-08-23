# Cómo probar Telepatía sin saber de máquinas

## Qué es el “informe de pre-flight”

En lenguaje llano: es un **comprobante de control previo**.

Telepatía mira la orden de trabajo y el programa que se quiere mandar. Después crea un
comprobante que responde dos preguntas:

1. ¿Las instrucciones coinciden con lo que pidió la orden?
2. ¿El archivo que se está por enviar es exactamente el que fue revisado?

Por eso no sirve subir cualquier JSON. Tampoco sirve mezclar el comprobante de un programa
con otro. La pantalla ahora lo llama **informe de control** y explica el error sin jerga.

Importante: una foto JPG no va en “Programa”. La foto es el papel que la IA lee antes. El
programa es el archivo de instrucciones de la máquina, normalmente `.nc` o `.gcode`.

## Prueba más fácil: dos botones

1. Preparar la app con `npm install` si todavía no se hizo.
2. Ejecutar `npm run demo`.
3. Abrir <http://localhost:8777> en la computadora.
4. Entrar en **Quiero enviar**.
5. Pulsar **Caso aprobado**.

Resultado esperado: aparece `APROBADO · ES EL ARCHIVO CORRECTO` y se habilita **Emitir por
luz**.

Después pulsar **Caso bloqueado**.

Resultado esperado: aparece `BLOQUEADO`, se muestran errores concretos y el botón de emitir
queda deshabilitado. Así se demuestra que Telepatía no es solamente un QR: decide qué puede
cruzar y qué no.

## Las dos parejas, por si se quieren elegir a mano

| Prueba | Poner en “Programa” | Poner en “Informe de control” | Resultado |
|---|---|---|---|
| Positiva | `fixtures/programs/part-1837-revC.nc` | `fixtures/programs/part-1837-revC.preflight.json` | Aprobado; deja emitir |
| Negativa | `fixtures/programs/part-1837-revB.nc` | `fixtures/programs/part-1837-revB.preflight.json` | Bloqueado; no deja emitir |

También hay una tercera prueba útil: programa B + informe C. Debe decir que **no es el
archivo que fue aprobado**, aunque alguien haya elegido el comprobante “verde”.

## Cómo probar la cámara y el envío real

### En una sola computadora

1. Abrir una ventana en **Enviar** y otra en **Recibir**.
2. En Recibir, pulsar **Abrir cámara** y aceptar el permiso.
3. Cargar el caso aprobado y pulsar **Emitir por luz**.
4. Apuntar la webcam a la pantalla emisora.

`localhost` puede usar la cámara aunque la dirección empiece con `http`.

### Con computadora + celular

Los teléfonos bloquean la cámara en una dirección de red sin HTTPS. No es un bug que una
web pueda saltear: es una regla de seguridad del navegador. La preparación se hace una vez:

```powershell
npm run demo:setup
npm run demo
```

El segundo comando muestra la IP de la computadora. En el celular:

1. Abrir primero `http://IP-DE-LA-COMPU:8777/certs/telepatia-ca.crt`.
2. Instalar ese certificado de desarrollo y marcarlo como confiable en los ajustes del
   teléfono.
3. Abrir `https://IP-DE-LA-COMPU:8443` en ambos equipos.
4. En uno elegir Enviar; en el otro, Recibir.
5. Permitir Cámara cuando el navegador pregunte.

Si dice que otra aplicación usa la cámara, cerrar Cámara, Meet o Zoom y reintentar. Si dice
que está bloqueada, tocar el candado de la barra de direcciones y permitir Cámara.

## Cómo probar que funciona sin internet

1. Entrar una vez por `https://...:8443` o por `http://localhost:8777`.
2. Esperar a que diga **Disponible sin conexión**.
3. Abrir una vez Enviar y Recibir.
4. Apagar Wi-Fi o desconectar internet.
5. Refrescar la página que ya estaba abierta.

La portada, las dos pantallas y los dos casos de prueba quedan guardados en el dispositivo.
Una IP de red por `http` no puede instalar ese modo offline; hay que usar el enlace HTTPS.

## Las imágenes mock para mostrar la IA de verdad

Estas imágenes ya existen y son sintéticas; no hay que sacar una foto nueva:

- `fixtures/shop/work-order-photo.png`: foto torcida de una orden de trabajo.
- `fixtures/shop/setup-sheet-worn.png`: hoja de preparación gastada.

Para hacer la lectura real con QVAC:

```powershell
node scripts/try-preflight.mjs --worn
```

La corrida tarda porque carga el modelo local. El resultado real ya grabado está en
`docs/preflight-extract-worn.json`: leyó los papeles, dudó de un dato crítico y lo mandó a
revisión. Eso es una buena demostración de seguridad: cuando la IA no está segura, no
inventa ni aprueba.

`docs/preflight-extract-worn.json` **no se sube al campo Informe de control**. Es el registro
de la lectura de la IA. Para probar el emisor se usan los dos archivos `.preflight.json` de
la tabla anterior, o directamente los botones de prueba rápida.

## Antes de grabar el video

- Probar cámara y permiso en los dos dispositivos.
- Esperar “Disponible sin conexión” antes de cortar internet.
- Usar el caso aprobado para la transferencia completa.
- Mostrar el caso bloqueado antes, durante dos o tres segundos.
- No actualizar certificados, dependencias ni navegador el día de la grabación.
