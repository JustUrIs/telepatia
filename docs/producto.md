# telepatía — el puerto de entrada que le falta al air gap

Documento de producto. A quién le hablamos, qué le duele exactamente, qué hace
hoy, por qué lo que hace no alcanza, y qué parte de eso resolvemos.

---

## 1. A quién le hablamos

No es "una empresa". Es una persona con un cargo, un presupuesto y una auditoría
encima.

### El comprador y el usuario

| Rol | Qué hace | Qué le importa |
|---|---|---|
| **Ingeniero de ciberseguridad OT / ICS** | mantiene la segmentación entre la red industrial y todo lo demás | que nada entre sin que él sepa qué era |
| **Ingeniero de sistemas de control** | opera PLCs, HMIs, SCADA | que la planta no pare |
| **Responsable de cumplimiento (NERC CIP / IEC 62443)** | prueba ante el auditor que cada cambio fue evaluado y aprobado | tener el papel firmado |
| **Integrador (Dragos, Claroty, Nozomi, ingenierías locales)** | instala y mantiene la infraestructura del cliente | sumar producto sin competir con lo que ya vende |

El que firma el cheque suele ser el tercero. El que sufre el problema es el
primero. El que lo va a instalar es el cuarto.

### Dónde vive el problema, en el modelo Purdue

```
Nivel 5  Internet / corporativo
Nivel 4  IT de la empresa
─────────  DMZ industrial (nivel 3.5)  ← acá termina lo que la mayoría protege
Nivel 3  Operaciones de sitio: historiadores, servidores de ingeniería
Nivel 2  HMI, SCADA
Nivel 1  PLCs, RTUs, controladores de seguridad
Nivel 0  Sensores, válvulas, bombas, actuadores
```

**El air gap real está entre el 3 y el 3.5.** Todo lo que está por debajo tiene
que seguir actualizándose, y no hay cable que cruce.

### Sectores, en orden de dolor

1. **Agua y saneamiento** — presupuesto chico, plantas remotas sin personal fijo,
   y objetivo político declarado. Es el sector más atacado y el peor defendido.
2. **Energía** — regulado por NERC CIP en Norteamérica, con multas reales.
3. **Manufactura discreta y de proceso** — la que más plata pierde por hora de
   parada.
4. **Petróleo y gas** — plataformas y ductos, conectividad satelital pésima o
   nula.
5. **Nuclear** — el air gap más estricto que existe, y el precedente histórico.
6. **Defensa e inteligencia** — SCIFs, cross-domain solutions, presupuesto y
   proceso propios.

---

## 2. El problema, en detalle

### Lo que pasa un martes cualquiera

Sale un aviso: el fabricante del PLC publica un parche para una vulnerabilidad
crítica. El ingeniero de ciberseguridad OT tiene que meterlo a 40 controladores
que están en una red sin salida a internet, a propósito.

Su día:

1. Baja el parche y el aviso desde la red corporativa.
2. Lee el aviso: qué versiones afecta, qué CVE cierra, si obliga a reiniciar el
   equipo, si hay procedimiento de vuelta atrás.
3. Cruza eso **a mano** contra el inventario: ¿cuáles de mis 40 PLCs son de esa
   versión? ¿Cuáles están en la zona crítica?
4. Llena el formulario de gestión del cambio. Lo firma su jefe.
5. Escanea el archivo contra malware en un kiosco.
6. Copia el archivo a un pendrive.
7. **Camina hasta la planta con el pendrive en el bolsillo.**
8. Lo inserta en el servidor de ingeniería del nivel 3.
9. Lo distribuye a los controladores.
10. Guarda el pendrive bajo llave y anota en una planilla que lo hizo.

Los pasos 1 a 4 son **horas de leer documentos y tomar decisiones**. El paso 7 es
**el agujero de seguridad más grande de toda la instalación**.

### Por qué el paso 7 es el agujero

Un pendrive **es una computadora**. Tiene un microcontrolador, firmware
reprogramable, y puede presentarse ante el sistema operativo como algo distinto
de lo que es. Eso no es teoría: es la familia de ataques BadUSB. El antivirus
escanea los *archivos* del pendrive; no puede escanear el *firmware* del
pendrive.

Y el precedente es el caso más famoso de la historia de la ciberseguridad
industrial: **Natanz estaba aislada de internet a propósito, y cayó igual**,
porque el air gap no falló — falló el momento en que un humano tuvo que cruzarlo
con las manos.

> **La empresa aisló la red. Nunca resolvió cómo mover software hacia adentro
> sin volver a abrir la puerta que cerró.**

### Por qué nadie lo arregló

Porque no hay alternativa. Abrir una conexión de red "solo para actualizar" es
exactamente lo que el air gap existe para impedir. El USB quedó como la única
puerta entreabierta — **por descarte, no por elección**.

---

## 3. Qué existe hoy, y por qué no cubre esto

### Data diodes

Hardware que fuerza el flujo en una sola dirección a nivel físico. Owl Cyber
Defense, Waterfall Security, Fend, Everfox (ex Forcepoint), Nexor, Advenica.

**Resuelven sacar datos**: telemetría, históricos, alarmas, de la zona segura
hacia afuera, sin cable de vuelta. Es un negocio grande y bien resuelto.

**No resuelven meter software.** Están construidos para lo contrario. Es la misma
puerta, vigilada de un solo lado.

### Kioscos de escaneo de medios removibles

OPSWAT MetaDefender y similares: una estación donde enchufás el pendrive y lo
escanea con varios motores de antivirus antes de dejarte pasar.

Mejoran el problema, no lo eliminan: **siguen dependiendo de que un pendrive
físico cruce**, y escanean archivos, no firmware.

### Cross-domain solutions (defensa)

Certificadas, caras, con proceso de acreditación de meses. Existen y funcionan.
Fuera del alcance presupuestario y temporal de una potabilizadora municipal.

### El gap, en una línea

> Hay una industria dedicada a **sacar** datos de forma segura de sistemas
> aislados. Nadie vende **meterlos**.

---

## 4. Qué hacemos nosotros

**Convertimos la pantalla en el puerto de entrada.**

```
   LADO CONECTADO                          LADO AISLADO
   (laptop del ingeniero)                  (nivel 3, sin red)

   archivo + manifiesto firmado
        ↓
   [ revisión ]  ← acá vive el modelo, y es opcional
        ↓
   pantalla emitiendo códigos ópticos  →→→  cámara
                                              ↓
                                       verificación de firma + SHA-256
                                              ↓
                                       archivo, con registro de auditoría
```

### Las tres propiedades que esto da y el pendrive no

**1. No hay firmware que infectar.** Una pantalla mostrando luz no es un
dispositivo que el sistema operativo del otro lado enumere, monte y confíe. No
hay controlador USB, no hay descriptor que falsificar, no hay BadUSB. Eliminás
la superficie de ataque en vez de intentar vigilarla.

**2. El canal es físicamente unidireccional.** La luz va del emisor a la cámara y
no hay retorno por ese mismo medio. No es una política de firewall que alguien
puede desconfigurar: es óptica.

**3. Queda registro de cada byte.** Cada transferencia lleva su manifiesto
firmado, su hash, su marca de tiempo y quién la aprobó. El pendrive deja una
planilla escrita a mano, si es que la deja.

### Lo que NO hacemos, dicho de frente

- **No reemplazamos un data diode.** Somos la mitad que falta, no la competencia.
- **No es rápido.** El canal mueve del orden de kilobytes por segundo. Un
  firmware de 200 MB no cruza por acá. Un parche de configuración, un manifiesto
  firmado, una clave, un script: sí.
- **No resuelve el arranque en frío.** El software receptor tiene que llegar a la
  máquina aislada una primera vez por los medios que ya usan. A partir de ahí,
  las actualizaciones del propio receptor cruzan por luz.

---

## 5. Dónde entra el modelo local, y por qué es opcional

### El principio

> **El modelo nunca decide. Lee y le explica a la persona que decide.**

Y corre **del lado conectado, en la estación de revisión — nunca en la máquina
aislada.**

Eso no es una limitación: es la arquitectura correcta.

- La máquina del nivel 3 puede ser un servidor de ingeniería con Windows 7 y
  4 GB de RAM. **No puede correr un modelo de 4B, y no debe.**
- Lo que la máquina aislada hace al recibir es **matemática pura**: verificar una
  firma y un hash. Nadie quiere un modelo de lenguaje dentro de la base de
  cómputo confiable de un sistema de seguridad.
- La decisión humana —*¿dejo entrar esto?*— ocurre **antes** de emitir, del lado
  conectado, donde hay una laptop normal.

Por eso el modelo es **opcional de verdad**: sin él, la herramienta transfiere
archivos con firma, hash y registro de auditoría, con toda su función. Con él, el
que aprueba recibe un informe en castellano de lo que está por dejar entrar.

### Los tres trabajos del modelo

**Trabajo 1 — Decir qué es lo que va a cruzar.**

Entrada: el contenido que se va a transferir. Un diff de configuración, un script
de despliegue, un INI, un XML de proyecto, las release notes del fabricante.

Salida: un resumen en lenguaje llano de qué cambia.

*Por qué hace falta:* las release notes de un firmware son 40 páginas. Un diff de
configuración de un PLC son 800 líneas. El ingeniero tiene la ventana de
mantenimiento del sábado y treinta activos. Hoy lee en diagonal, o no lee.

**Trabajo 2 — Armar el expediente de cambio, anclado al documento.**

Entrada: el aviso de seguridad del fabricante (PDF, foto, texto).

Salida: el registro estructurado.

```
producto           Widget PLC
versiones afectadas 4.0.0 – 4.2.3
versión corregida   4.3.0
CVE                 CVE-2026-1234
CVSS                9.8
requiere reinicio   sí
rollback documentado no
```

**Y cada campo tiene que poder señalarse en el documento.** Un valor que el
modelo no puede anclar en los píxeles no es un dato: es una alucinación o una
inyección, y va a revisión humana.

*Por qué hace falta:* eso es exactamente lo que NERC CIP-010 y IEC 62443-2-3
obligan a documentar por cada cambio a un sistema crítico. Hoy lo tipea una
persona en un formulario.

**Trabajo 3 — Marcar lo que merece ojos humanos.**

El modelo no aprueba ni rechaza. Marca:

- texto dentro del documento dirigido a un lector automático — una inyección de
  prompt en un aviso de fabricante es un vector de cadena de suministro real;
- un cambio de configuración que toca un setpoint de un lazo de seguridad;
- una versión "corregida" que es **menor** que la instalada — un downgrade
  reintroduce una vulnerabilidad ya cerrada;
- afirmaciones del documento que no se sostienen en el propio documento.

### Y el veredicto lo calcula código, sin modelo

Contra el **inventario de activos**, que es la fuente de verdad que el atacante
no escribe:

| Check | Qué corta |
|---|---|
| `versions_coherent` | la versión corregida cae dentro del rango afectado → el aviso es falso o está mal leído |
| `no_downgrade` | la "corrección" baja la versión instalada |
| `affects_installed_assets` | el parche es para un producto que no tenemos |
| `cve_format_valid` | CVE inventado |
| `reboot_declared_for_critical` | activo crítico + reinicio obligatorio → nunca se aprueba solo |
| `patch_not_replayed` | el mismo aviso ya se aplicó — anti-replay |

**Esto ya está medido en el dominio gemelo (facturas contra extracto bancario):**
un documento falso pero completo y coherente atraviesa el esquema, ancla entero
en los píxeles y cierra la aritmética. **Lo único que lo frena es la fuente
independiente.** Ese hallazgo se traduce igual acá: el atacante escribe el aviso,
pero no escribe tu inventario.

### Qué modelo, concretamente

Nada entrenado por nosotros. Modelos pre-entrenados, corriendo local vía QVAC:

| Rol | Modelo | Tamaño | Cuándo |
|---|---|---|---|
| Lectura de píxeles | `OCR_LATIN` | chico | si el aviso entra como foto o escaneo |
| Extracción y resumen | `QWEN3_4B_INST_Q4_K_M` | ~4 GB en Q4 | estación de revisión normal |
| Plan B | `QWEN3_1_7B_INST_Q4` | ~1.5 GB | laptop con poca RAM |
| Sin modelo | — | 0 | la herramienta transfiere igual |

Cuatro modos de operación, degradando con gracia. **El que menos capacidad tiene
sigue funcionando.**

---

## 6. Qué ahorra, y dónde

### El proceso que acelera

Los pasos 2, 3 y 4 del día del ingeniero: leer el aviso, cruzarlo contra el
inventario, llenar el formulario de cambio. Eso hoy es trabajo manual de lectura
y transcripción, por cada aviso y por cada campaña de parches.

### El riesgo que elimina

El paso 7. El pendrive deja de existir en el proceso.

### El papel que produce solo

El expediente de cambio con la evidencia señalada, que es lo que el auditor pide
y hoy alguien redacta a mano.

> **Sección de números, fuentes y titulares: pendiente de verificación.**
> Un agente de investigación está buscando las cifras con fuente primaria.
> No se publica un número acá hasta que tenga origen citable — una estadística
> sin fuente en un pitch de seguridad es munición para el primer jurado que la
> googlee.

---

## 7. Qué tan fácil es ponerlo a andar

| Lado | Qué hace falta | Tiempo |
|---|---|---|
| **Conectado** (estación de revisión) | una laptop, un navegador. El modelo se baja una vez si se quiere usar | minutos |
| **Aislado** (nivel 3) | una máquina con cámara y navegador. Software instalado una vez por el medio que ya usan | minutos |
| **Infraestructura** | ninguna. Sin servidor, sin cuenta, sin apertura de puertos, sin cambio de topología de red | cero |

**Lo que no hay que pedirle al área de redes:** ninguna regla de firewall,
ninguna VLAN nueva, ningún cambio en el diagrama de la planta. Eso importa más de
lo que parece: cada cambio de topología en una red OT es su propio expediente de
gestión del cambio.

Y la propiedad que se ve en cámara: **se apaga el wifi de las dos máquinas y
sigue funcionando.**

---

## 8. Cómo llegamos a ellos

1. **Integradores antes que clientes finales.** Dragos, Claroty, Nozomi y las
   ingenierías de automatización locales ya venden a esta gente. Un producto
   complementario a los data diodes se suma a un portfolio existente sin pelear
   con nada.
2. **Open source primero.** Publicar el protocolo y dejar que la comunidad de
   seguridad lo audite. En un mercado donde el producto se compra por confianza,
   un protocolo cerrado es una desventaja.
3. **Cumplimiento como gancho.** El comprador que firma es el de compliance.
   "Registro inmutable y firmado de cada cambio a un sistema crítico" le resuelve
   una auditoría, no solo un riesgo.
4. **Comunidad OT/ICS.** S4x, ICS Cyber Security Conference, los foros donde esta
   gente discute. Es un mercado chico y muy conectado: la validación técnica de
   dos o tres nombres conocidos vale más que cualquier publicidad.

---

## 9. La frase

> Aislaron la red. Nunca resolvieron cómo meter software sin volver a abrir la
> puerta que cerraron.
>
> Nosotros convertimos la pantalla en esa puerta: entra luz, no un dispositivo.
> Y antes de abrirla, un modelo que corre en tu propia máquina te dice en
> castellano qué es lo que estás por dejar entrar.
