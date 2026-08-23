# Cómo grabar el demo — hoja única

Todo lo que hay que hacer, en orden. Nada más.

---

## Paso 0 · Prender el servidor (10 segundos)

En una terminal, dentro de la carpeta del proyecto:

```
npm run demo
```

Dejala abierta. Si la cerrás, se apaga todo.

---

## Paso 1 · Abrir las dos pantallas

En el navegador, dos pestañas:

| Pestaña | Dirección |
|---|---|
| **Enviar** | `http://localhost:8777/src/ui/sender.html` |
| **Recibir** | `http://localhost:8777/src/ui/receiver.html` |

> Tiene que decir **`localhost`**. Si ponés la dirección con números
> (`192.168...`), el navegador no te deja usar la cámara.

---

## Paso 2 · Grabar la parte de la terminal (2 minutos)

Empezá a grabar la pantalla con **`Win + Alt + R`**.

Escribí este comando y apretá Enter:

```
node bin/preflight.mjs fixtures/programs/part-1837-revC.nc --job fixtures/shop/job-extracted.json
```

Sale una lista **toda en verde** y arriba dice **✓ LISTO PARA ENVIAR**.

Ahora este otro:

```
node bin/preflight.mjs fixtures/programs/part-1837-revB.nc --job fixtures/shop/job-extracted.json
```

Sale **✗ NO APRIETES CYCLE START** y **cinco líneas en rojo**.

**Quedate quieto 4 segundos mirando las cinco líneas rojas.** Ese es el momento
más importante del video entero.

Frená la grabación.

---

## Paso 3 · Grabar el envío por luz (2 minutos)

Empezá a grabar de nuevo.

### En la pestaña **Enviar**, cargá DOS archivos:

| Casillero | Archivo |
|---|---|
| El primero (programa) | `fixtures/programs/part-1837-revC.nc` |
| El segundo (informe) | `fixtures/programs/part-1837-revC.preflight.json` |

Aparece un cartel **verde** y se prende el botón **Emitir**.

### El truco que impresiona

Sin tocar el informe, **cambiá el primer archivo** por:

```
fixtures/programs/part-1837-revB.nc
```

**El botón se apaga solo** y el cartel se pone rojo.

> Eso muestra que no podés aprobar un archivo y mandar otro.

Volvé a poner el `revC` y apretá **Emitir**. La pantalla empieza a parpadear
códigos.

### En la pestaña **Recibir**

Apretá **Encender cámara** y aceptá el permiso. Apuntá la webcam a la otra
pantalla. La barra se llena y aparece el archivo.

---

## Paso 4 · El plano que se acuerdan (30 segundos)

Con todo funcionando: **apagá el WiFi de la computadora.**

Volvé a las pestañas. **Siguen funcionando.**

Grabá eso sin cortar. Es la prueba de que nunca usó internet.

---

## Paso 5 · Ponerle voz

Grabá el audio aparte con el celular pegado a la boca. Tres frases, nada más:

> **1.** "Esta máquina no tiene internet a propósito. Y el archivo llega en el
> bolsillo de alguien, en un pendrive."

> **2.** *(mientras se ven las cinco líneas rojas)* "La inteligencia artificial
> no decidió nada. Solo leyó los papeles. La decisión la tomó una resta."

> **3.** *(mientras apagás el WiFi)* "Sin internet. Nunca lo usó."

---

## Paso 6 · Armarlo

Abrí **CapCut** (gratis). Pegá en este orden:

1. La terminal en verde (5 segundos)
2. La terminal en rojo con las cinco líneas (10 segundos)
3. El cartel que se pone rojo cuando cambiás el archivo (5 segundos)
4. La pantalla parpadeando y la barra llenándose (15 segundos)
5. Apagando el WiFi y que sigue andando (10 segundos)

Poné la voz encima. **Activá los subtítulos automáticos** — muchos jurados miran
sin sonido.

---

## ⚠️ Lo único que puede fallar

| Si pasa esto | Hacé esto |
|---|---|
| La cámara no abre | Fijate que la dirección diga `localhost` y no números |
| La cámara no lee los códigos | En "Detalles técnicos" bajá los datos por imagen a **300** y las imágenes por segundo a **2** |
| El botón Emitir no se prende | Te falta cargar el segundo archivo, el `.preflight.json` |
| Se rompió todo | `npm run demo` de nuevo, y recargá las pestañas |

---

## ✅ Antes de subir

- [ ] Se leen las **cinco líneas rojas** sin pausar
- [ ] Se ve el botón **apagándose solo** al cambiar el archivo
- [ ] Se ve **apagar el WiFi** y que sigue andando
- [ ] Tiene subtítulos
- [ ] **El repositorio está en PÚBLICO** ← sin esto no cuenta

---

## Los 4 archivos del demo

Están todos en la carpeta del proyecto:

```
fixtures/programs/part-1837-revC.nc              ← el programa bueno
fixtures/programs/part-1837-revC.preflight.json  ← su comprobante APROBADO
fixtures/programs/part-1837-revB.nc              ← el programa malo
fixtures/programs/part-1837-revB.preflight.json  ← su comprobante BLOQUEADO
```
