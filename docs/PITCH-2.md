# El último que mira

**Pitch de telepatía, versión para humanos.**
Sin una sola palabra técnica. Si aparece una, está explicada en la misma línea.

---

## La idea en una frase

> Hay computadoras que fabrican cosas físicas y están desconectadas de internet
> a propósito. Para meterles un archivo, alguien camina con un pendrive.
> Nosotros lo pasamos **por la luz de una pantalla**, y antes de pasarlo, una
> inteligencia artificial que corre en tu propia notebook revisa que sea el
> archivo correcto.

---

## Parte 1 — La escena

Son las siete de la mañana en un taller.

Hay una máquina del tamaño de un auto que fabrica piezas de metal. Vale medio
millón de dólares. No tiene internet, y eso no es un descuido: está desconectada
a propósito, porque si alguien de afuera pudiera darle órdenes, no te robaría
una contraseña — te rompería la máquina, o algo peor.

Un tipo — llamémoslo Diego — tiene que cargarle un archivo. El archivo es una
lista de instrucciones: bajá esta herramienta, cortá acá, girá a tantas vueltas
por minuto.

Antes de apretar el botón de arranque, Diego tiene cuatro papeles sobre la mesa:

- **la orden de trabajo**, que dice qué pieza hay que fabricar hoy y en qué
  versión;
- **la hoja de preparación**, que dice qué herramientas tiene que haber montadas
  en la máquina;
- **el plano** de la pieza;
- y **el archivo** que está por cargar.

Y hace, en la cabeza, esta pregunta:

> ¿Este archivo es el correcto? ¿Es la versión de hoy o la del mes pasado? ¿Usa
> las herramientas que tengo puestas? ¿Es para esta máquina?

Tiene cuarenta segundos. Tiene treinta piezas esperando. Y esa revisión, un
martes cualquiera, se hace **en diagonal**.

---

## Parte 2 — Lo que pasa cuando no mira bien

No es un error de oficina. Es físico, es caro y es inmediato.

| Lo que se pasó por alto | Lo que pasa |
|---|---|
| El archivo es de la **versión vieja** de la pieza | las 24 piezas del lote salen mal y van a la basura |
| Pide la **herramienta número 7** y en la máquina hay del 1 al 3 | la máquina baja el portaherramientas **vacío** contra el metal. Se parte el eje. Días de parada |
| El archivo mide **desde otro punto de referencia** | corta la pieza entera desplazada |
| Pide **girar más rápido** de lo que la herramienta aguanta | la herramienta se parte y sale disparada |

Ninguna de esas cuatro cosas se nota mirando el archivo por encima. Las cuatro
se notan **comparando papeles**, que es exactamente lo que nadie tiene tiempo de
hacer.

---

## Parte 3 — Y encima, ¿cómo entra el archivo?

Acá está la parte absurda.

La máquina no tiene internet **a propósito**. Entonces el archivo llega
caminando: alguien lo copia a un pendrive, cruza el taller y lo enchufa.

**Un pendrive no es un archivo. Es una computadora chiquita.** Tiene su propio
chip y su propio programa adentro, y puede presentarse ante la máquina como algo
distinto de lo que es. El antivirus revisa los archivos que hay adentro del
pendrive; no puede revisar el pendrive en sí.

Y no es teoría. En 2010 una planta nuclear en Irán, que estaba desconectada de
internet a propósito, terminó con sus máquinas destruidas por un virus. La
desconexión no falló. Falló **el momento en que una persona tuvo que cruzarla
con las manos**.

> La empresa cortó el cable. Nunca resolvió cómo meter un archivo sin volver a
> abrir la puerta que cerró.

Hay una industria entera de aparatos carísimos para **sacar** información de
estos lugares de forma segura. Casi nadie se ocupó del camino de vuelta.

---

## Parte 4 — Qué hicimos

Dos cosas, y las dos pasan **antes** de que Diego apriete el botón.

### Primero: alguien lee los papeles por él

Una inteligencia artificial que corre **en la notebook de Diego** — no en
internet, no en la nube, no en un servidor de nadie — mira la foto de la orden
de trabajo y de la hoja de preparación, y saca los datos.

Después **compara** esos datos contra el archivo, y le dice en cinco segundos:

> **Todo coincide.**

o

> **No arranques. Estas cinco cosas no cierran.**

**Lo importante, y es lo que nos diferencia:** la inteligencia artificial
**no decide nada**. Solamente lee los papeles, que es lo que las máquinas leen
mal y las personas leen lento. La decisión la toma un programa común y
corriente, comparando números. Una inteligencia artificial puede equivocarse o
inventar; una resta, no.

Y hay una regla más: **cada dato que la inteligencia dice haber leído tiene que
poder señalarlo con el dedo en la foto.** Si dice "versión C" pero no puede
mostrar dónde lo leyó, no es un dato — es un invento, y va a revisión humana.

### Segundo: el archivo cruza por la luz

Cuando el control da verde, la pantalla de la notebook empieza a mostrar códigos
que cambian varias veces por segundo. La computadora del otro lado los mira con
una cámara y arma el archivo de nuevo.

```
   NOTEBOOK                              MÁQUINA AISLADA
   (con internet)                        (sin internet, y sigue sin tenerlo)

   [ control de los papeles ]
             ↓
      pantalla parpadeando   ···luz···→   cámara
                                              ↓
                                        archivo reconstruido
```

Tres cosas que un pendrive no puede dar:

**1. No hay nada que infectar.** Una pantalla que muestra luz no es un aparato
que la otra computadora enchufe y le crea. No hay chip, no hay programa
escondido.

**2. La luz va para un solo lado.** No es una regla de seguridad que alguien
puede desconfigurar. Es física: la pantalla muestra, la cámara mira, y no hay
camino de vuelta.

**3. Queda registro.** Cada archivo que cruza deja anotado cuál era, cuándo
cruzó y con qué control aprobado.

---

## Parte 5 — Y esto es lo que más nos gusta

En el video se ve así: **se apaga el WiFi de las dos computadoras, y sigue
funcionando.**

No es un truco de demostración. Es la prueba de que todo lo que dijimos es
cierto: si funcionara con internet, no serviría para el único lugar donde hace
falta.

Y la inteligencia artificial **tiene** que correr ahí, en la máquina de Diego.
No por elegancia — por obligación. La lista de qué máquinas tiene una fábrica y
qué versión de software usa cada una es, literalmente, el mapa de por dónde
atacarla. Mandar eso a internet es exactamente lo que la desconexión existe para
impedir.

---

## Parte 6 — Los números

Son de fuentes reales y verificadas, no de un blog.

| Dato | De dónde sale |
|---|---|
| **El 82%** de los virus encontrados en pendrives dentro de fábricas puede **parar la planta** — no robar datos: parar la producción | Honeywell, 2024 |
| Enchufar un pendrive fue **el incidente más frecuente** que atendió el equipo de respuesta de Honeywell: 84 casos | Honeywell, 2025 |
| **Uno de cada cinco** incidentes de seguridad en plantas industriales empieza por un dispositivo removible | SANS, 2024 |
| **El 26%** de los avisos de seguridad para estas máquinas salen **sin arreglo disponible** | Dragos, 2026 |
| **Menos del 10%** de estas redes tienen alguien mirando lo que pasa adentro | Dragos, 2026 |
| Mover datos a mano cuesta **US$2.190 por año, por máquina**, solo en horas de gente | Departamento de Defensa de EE.UU., 2022 |

Y el gancho que le importa al que firma el cheque: en Estados Unidos, una norma
con multas obliga a las empresas de energía a **demostrar, antes de cada cambio
a una máquina crítica, de dónde salió el archivo y que nadie lo tocó**.

Eso es exactamente el papel que nuestro control emite solo, cada vez.

---

## Parte 7 — Qué NO decimos

Esto va acá a propósito. Un pitch de seguridad que promete de más se cae con la
primera pregunta.

- **No revisamos si el archivo tiene un virus.** Verificamos que sea el archivo
  correcto para el trabajo correcto. Son dos problemas distintos.
- **No es una firma digital.** El comprobante de aprobación es un archivo común;
  alguien con acceso a esa computadora podría editarlo. Lo que sí hace es evitar
  el error humano y el cambio accidental, que es lo que pasa de verdad.
- **La cámara también es un aparato con programa adentro.** Lo que eliminamos es
  el pendrive que entra y sale cien veces por semana, no toda superficie
  posible.
- **No adivinamos si la pieza va a salir bien.** Verificamos que los papeles y
  el archivo digan lo mismo. Es un reclamo más chico y mucho más difícil de
  romper.
- **No somos los únicos que mueven datos hacia adentro.** Hay dos empresas que
  lo hacen con hardware dedicado. La diferencia es que ellas abren una ventana
  de tiempo con un botón; nosotros aprobamos y registramos **archivo por
  archivo**.

---

## La frase con la que cerramos

> Cortaron el cable para que nadie entre.
> Y después metieron todo por la puerta de atrás, en el bolsillo de alguien.
>
> Nosotros convertimos la pantalla en la única puerta.
> Entra luz, no un aparato.
> Y antes de abrirla, algo que corre en tu propia máquina te dice, en castellano,
> qué estás por dejar pasar.

---

## Anexo: cómo explicarlo en distintos tiempos

**En 10 segundos, a cualquiera:**
> Hay máquinas industriales sin internet a propósito. Para pasarles un archivo
> hoy se usa un pendrive, que es un agujero de seguridad. Nosotros lo pasamos por
> la luz de la pantalla, y una IA local revisa antes que sea el archivo correcto.

**En 30 segundos, a alguien del rubro:**
> El último metro del aislamiento sigue siendo un humano con un pendrive. Nadie
> vende el camino de entrada. Nosotros hacemos dos cosas: un control previo que
> compara la orden de trabajo contra el archivo usando un modelo que corre local,
> y un canal óptico de una sola dirección para que el archivo aprobado cruce sin
> conectar nada.

**En 2 minutos, a un inversor:**
> Empezá por Diego a las siete de la mañana. Contá las cuatro formas de romper
> una máquina de medio millón. Contá que el archivo llega en un pendrive. Contá
> que existe una industria de mil millones para sacar datos y casi nadie para
> meterlos. Y terminá apagando el WiFi en cámara.
