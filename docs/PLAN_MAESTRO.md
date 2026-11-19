> **Copia del plan maestro entregado por Jesus el 19/11/2026.** Es el plan funcional: no describe lo ya implementado.
> El avance real está en [`ESTADO_ACTUAL.md`](ESTADO_ACTUAL.md) y en [`seguimiento/`](seguimiento/).

# Michikembo y consola de tres videojuegos

**Plan maestro de desarrollo, integración y continuidad**  
**Fecha:** 19 de noviembre de 2026  
**Estado:** planificación funcional detallada. No equivale a implementación terminada.  
**Repositorio principal:** <https://github.com/SofiOyola/Michikembo.git>  
**Repositorio de Cosmic Drift:** <https://github.com/SofiOyola/Cosmic-Drift.git>  
**Referencia adicional de navegación tipo consola:** <https://sadok.mx/>

> **Instrucción principal para la IA que continúe el proyecto:** voy a adjuntar este documento, la imagen de referencia de la consola, el cuaderno de Google Colab con los experimentos, `GatoBase.ase` y los archivos del proyecto que tenga disponibles. Antes de modificar código, inspecciona los materiales reales, explica qué existe y qué falta, y trabaja por fases verificables. No asumas que una característica ya está implementada por aparecer en este plan.

---

## 1. Qué quiero construir

Desarrollar una **consola virtual interactiva**, de estética retro y colores pastel, en la que puedan elegirse y jugarse tres videojuegos:

1. **Michikembo**, un piedra, papel o tijera contra un gato animado llamado Michi. El jugador muestra su gesto frente a la webcam y un modelo YOLO lo reconoce.
2. **Cosmic Drift**, mi videojuego espacial con control mediante gestos, cuyo código existente debe reutilizarse e integrarse sin perder sus funciones.
3. **Dinosaurio**, un juego de desplazamiento lateral inspirado en el concepto de superar obstáculos del conocido juego sin conexión del navegador. Debemos crear una implementación original, con gráficos y recursos propios, sin copiar ni redistribuir los recursos del juego de Google.

La persona verá los tres juegos **dentro de la pantalla de la consola**, navegará por sus vistas previas y, al pulsar el botón para jugar, **la experiencia se expandirá para mostrar únicamente el videojuego**, con una opción clara para regresar a la consola.

La consola no debe ser solo una imagen decorativa. Los controles visibles deben funcionar con clic, teclado y, cuando corresponda, pantalla táctil.

### Criterios generales

- Interfaz bonita, coherente, responsiva y con apariencia retro.
- Texto de los videojuegos y menús en **tipografía de estilo pixel**.
- Juego fluido, cámara con permiso explícito y sistema de sonido configurable.
- Integración modular. Cada videojuego debe poder mantenerse y probarse por separado.
- Código claro, documentado y listo para publicar en el repositorio.
- Modelo de IA **reemplazable** sin reescribir el resto de Michikembo.
- Avance incremental con pruebas, bitácoras Markdown y respaldos frecuentes.

---

## 2. Materiales de entrada que adjuntaré

La IA debe utilizar los archivos **realmente adjuntados** y no inventar su contenido:

| Material | Para qué se utilizará | Qué debe comprobarse |
|---|---|---|
| Imagen de consola adjunta | Referencia visual principal | Paleta, forma general, controles, pantalla y proporciones |
| `GatoBase.ase` | Base de las futuras animaciones de Michi | Resolución, capas, fotogramas y exportaciones disponibles |
| Notebook de Colab de Michikembo | Historial de entrenamiento y modelos | Rutas, pesos, configuraciones, resultados y persistencia |
| Modelo `best.pt` de E3c | Prototipo local y respaldo de entrenamiento | Existencia, tamaño y carga correcta |
| Exportación `.onnx` de E3c | Candidato para inferencia en navegador | Forma de entrada/salida, procesamiento y equivalencia con PyTorch |
| Código del repositorio Michikembo | Estado real de la aplicación | Rama, estructura y archivos existentes |
| Código del repositorio Cosmic Drift | Integración del segundo juego | Versión web, recursos y controles actuales |

**Imagen visual obligatoria:** adjuntaré una imagen de una consola portátil ilustrada, con **fondo azul pastel, carcasa blanca de bordes violetas, pantalla morada, cruceta púrpura, botones redondos rosados/rojos, pequeños controles inclinados y rejilla diagonal de altavoz**. Es una **referencia estética**, no una instrucción para copiar logotipos, personajes o la ilustración idénticamente. Quiero una versión original, cuidada y adaptada a mostrar videojuegos.

**Animaciones:** yo me encargaré de dibujar las animaciones del gato a partir de `GatoBase.ase`. La IA debe crear los sistemas y rutas de carga, e **indicarme exactamente en qué carpeta pegar cada animación cuando llegue el momento**. No debe decir que mis animaciones están terminadas si no las he entregado.

---

## 3. Estado conocido del modelo de IA

### 3.1 Dataset y experimentos

- Dataset inicial derivado de Roboflow Rock Paper Scissors SXSW v14.
- La primera separación tenía similitudes visuales entre train, validación y prueba.
- Se reconstruyeron familias de imágenes, se separaron fuentes sospechosas y se preparó la versión **v2.1**, con una cuarentena preventiva de **68 imágenes de 23 familias**.
- Distribución activa de v2.1: **3.446 train, 341 valid y 341 test**, **4.128 imágenes** en total. Las **3.207 excluidas** permanecen documentadas en el manifiesto, fuera del entrenamiento activo.
- Ya se ejecutaron los experimentos **B1, E3a, E3b, E3c y E3d**.
- El modelo provisional seleccionado es **E3c, YOLOv8n con aumentación**.

| Métrica de E3c | Validación v2.1 |
|---|---:|
| Precision | 0,812 |
| Recall | 0,510 |
| mAP@50 | 0,629 |
| mAP@50–95 | 0,364 |
| mAP@50 sobre train | 0,993 |

Existe una brecha importante entre entrenamiento y validación. **No afirmar que el modelo es definitivo ni que se ha superado la meta del 90 %**.

### 3.2 Respaldos conocidos

- Pesos E3c en Drive: `/content/drive/MyDrive/Michikenbo/models/v21/E3c_yolov8n_aumentacion_v21/best.pt`.
- Experimentos y bitácoras en `/content/drive/MyDrive/Michikenbo/documentacion/notebook_v21/`.
- Se reportó exportación a ONNX y concordancia de decisión de 60/60 imágenes de referencia con PyTorch. **Comprobar el archivo exportado antes de usarlo**.
- Los resultados de test interno reportados para E3c fueron P 0,785, R 0,570, mAP@50 0,680 y mAP@50–95 0,419. Ese conjunto fue revisado durante auditorías, por lo que no reemplaza un test externo verdaderamente nuevo.

### 3.3 Prueba de webcam ya realizada

Una primera prueba real con umbral 0,10 registró:

- 3.886 fotogramas capturados, 2.719 fotogramas puntuados.
- 19,89 FPS efectivos.
- Mediana de inferencia de 38,87 ms.
- Exactitud estable solo en gestos de **35,55 %**.
- Falsas activaciones sin mano de **6,85 %**.
- Por gesto, acierto estable: papel 26,75 %, piedra 38,27 % y tijera 42,58 %.

**Interpretación:** es suficiente como **modelo provisional para integrar y depurar el videojuego**, pero no para afirmar que el reconocimiento ya es confiable. El filtro temporal debe impedir que se confirme una jugada ante una predicción aislada y debe tratar `Nada` como un estado real. El umbral 0,20 fue propuesto para una nueva prueba, **sin resultado confirmado en este documento**.

### 3.4 Regla de desarrollo

Usar E3c ahora, **separando el motor de reconocimiento del motor de juego**. Así podré reemplazarlo posteriormente por un modelo mejor. No entrenar más modelos al azar ni presentar métricas no verificadas.

---

## 4. Decisión arquitectónica recomendada

Para integrar una **consola única de tres juegos**, recomiendo una **aplicación web como experiencia final**, porque Cosmic Drift ya tiene una versión web y la consola puede funcionar como un mismo entorno visual.

**No intentar ejecutar directamente un archivo `.pt` en el navegador.** Mantener los pesos PyTorch para experimentación local. Evaluar la exportación `.onnx` con **ONNX Runtime Web** para la integración web y comprobar que su preprocesamiento, postprocesamiento, detecciones y velocidad correspondan a la versión Python. La documentación de ONNX Runtime Web confirma que existe una API de inferencia en JavaScript, pero **eso no garantiza rendimiento o compatibilidad de nuestro modelo concreto**.

Si el rendimiento web real no es aceptable, presentar una alternativa técnicamente justificada, por ejemplo un servicio local o backend Python, pero sin cambiar silenciosamente el objetivo de una consola integrada.

### Arquitectura lógica

```text
Consola virtual
│
├── Selector de juegos
│   ├── Vista previa de Michikembo
│   ├── Vista previa de Cosmic Drift
│   └── Vista previa de Dinosaurio
│
├── Michikembo
│   ├── Motor de juego y marcador
│   ├── Gestor de estados de ronda
│   ├── Gato y animaciones
│   ├── Cámara y permiso
│   ├── Adaptador de inferencia
│   ├── Filtro temporal de gestos
│   └── Música y efectos
│
├── Cosmic Drift
│   └── Integración de la versión web existente
│
├── Dinosaurio
│   └── Juego nuevo con gráficos originales
│
└── Servicios compartidos
    ├── Navegación y pantalla completa
    ├── Audio, volumen y preferencias
    ├── Gestión de recursos
    └── Pantallas de error y accesibilidad
```

Cada juego debe poder arrancar y detenerse sin dejar la cámara encendida, sonidos reproduciéndose, eventos duplicados o recursos sin liberar.

---

## 5. Dónde irá el modelo y cómo reemplazarlo

Este requisito es **obligatorio y prioritario**. No quiero editar muchas líneas cada vez que consiga un modelo mejor.

### 5.1 Estructura de carpetas propuesta

```text
Michikembo/
├── public/
│   └── assets/
│       ├── models/
│       │   └── michikembo/
│       │       └── current/
│       │           ├── model.onnx             ← MODELO WEB ACTIVO
│       │           └── manifest.json          ← METADATOS Y CONFIGURACIÓN
│       ├── games/
│       │   ├── michikembo/
│       │   │   ├── cat/
│       │   │   ├── backgrounds/
│       │   │   └── ui/
│       │   ├── cosmic-drift/
│       │   └── dinosaur/
│       └── audio/
│           ├── console/
│           ├── michikembo/
│           ├── cosmic-drift/
│           └── dinosaur/
├── src/
│   ├── console/
│   ├── games/
│   │   ├── michikembo/
│   │   │   ├── game/
│   │   │   ├── vision/
│   │   │   ├── animations/
│   │   │   └── ui/
│   │   ├── cosmic-drift/
│   │   └── dinosaur/
│   └── shared/
├── tests/
├── docs/
│   ├── COMO_CAMBIAR_MODELO.md
│   ├── ANIMACIONES_GATO.md
│   ├── AUDIO.md
│   ├── PLAN_MAESTRO.md
│   ├── ESTADO_ACTUAL.md
│   └── seguimiento/
└── README.md
```

> La estructura es **propuesta**, no inventario del repositorio actual. Inspeccionar el código existente antes de decidir la migración y conservar lo que funcione.

### 5.2 Archivo `manifest.json` de ejemplo

```json
{
  "modelName": "Michikembo E3c",
  "version": "E3c-v2.1",
  "file": "/assets/models/michikembo/current/model.onnx",
  "inputSize": 640,
  "classNames": ["Paper", "Rock", "Scissors"],
  "confidenceThreshold": 0.20,
  "iouThreshold": 0.45,
  "revision": 1,
  "status": "experimental"
}
```

**Importante:** los umbrales 0,20 y 0,45 son **valores iniciales configurables**, no valores finales validados. Revisar el esquema real de entrada y salida ONNX, NMS, normalización, inversión horizontal, letterbox y conversión de coordenadas antes de implementar la inferencia.

### 5.3 Procedimiento de reemplazo para mí

1. Entrenar y evaluar el nuevo modelo en Colab sin borrar el E3c anterior.
2. Exportar el nuevo `best.pt` a ONNX y verificar equivalencia con PyTorch.
3. Respaldar el modelo anterior en Google Drive o en una carpeta local fuera de la versión publicada.
4. Sustituir **solo** `public/assets/models/michikembo/current/model.onnx`.
5. Actualizar `manifest.json` con la versión, tamaño, umbrales validados y el número `revision`. Documentar también el SHA-256 real.
6. Ejecutar automáticamente pruebas de carga, nombres de clases, preprocesamiento, latencia y detección de `Nada`.
7. Comprobar el modelo con la webcam y confirmar que no presenta una regresión importante.
8. Si falla, restaurar los archivos anteriores. Si pasa, confirmar el cambio y publicarlo en GitHub.

**Criterio de aceptación:** un cambio de modelo no obliga a cambiar las reglas del juego, el marcador, las animaciones ni la consola. Debe existir un documento `docs/COMO_CAMBIAR_MODELO.md` con las rutas exactas y comandos para Windows, y una indicación visible de la versión activa en el modo de diagnóstico. Si el sitio usa caché del navegador, invalidarla mediante la revisión o la URL versionada.

**Alternativa local:** para el prototipo Python/Pygame se puede conservar `models/current/best.pt`, siempre que el adaptador local use la misma interfaz de predicción. No confundirlo con `model.onnx` del navegador.

---

## 6. Flujo exacto de Michikembo

### 6.1 Inicio

1. Dentro de la consola, seleccionar **Michikembo**.
2. Pulsar **JUGAR**. Si es la primera vez, explicar brevemente cómo usar la cámara y solicitar permiso con una acción consciente del jugador.
3. Mostrar una pantalla retro en pixel art: **«¿Estás listo?»**, con los botones **SÍ** y **NO**.
4. Si elige **NO**, regresar al menú de Michikembo o a la consola sin comenzar la partida.
5. Si elige **SÍ**, mostrar la selección de duración o meta: **«¿Cuántas victorias quieres jugar?»** o, mejor, **«Primero en ganar…»** con opciones **1, 3, 5 y 7**. Se puede añadir un selector personalizado validado.
6. Mostrar instrucciones breves sobre encuadrar una mano y mantener el gesto visible. Preparar la cámara y confirmar que está lista antes de arrancar el conteo.

### 6.2 Aclaración de reglas necesaria

El ejemplo solicitado de **«3 partidas» y resultado «3-1»** tiene cuatro rondas decisivas, así que no puede representar «exactamente tres rondas en total».

**Interpretación propuesta para implementar sin contradicción:** la cantidad seleccionada representa el **número de victorias necesarias para ganar la partida general**. Por ejemplo, **«Primero en ganar 3»** permite terminar 3–0, 3–1 o 3–2, y no obliga a detenerse después de tres rondas decisivas. El primer participante que alcanza tres victorias gana.

Si finalmente se prefiere **«al mejor de 3»**, deberá cambiarse de manera explícita la interfaz y la condición de finalización. No mezclar ambas reglas.

### 6.3 Una ronda de piedra, papel o tijera

1. Reiniciar el estado de ronda anterior, sin borrar el marcador general.
2. **Antes de observar el gesto definitivo del jugador**, seleccionar aleatoriamente una jugada del gato entre **Rock, Paper y Scissors**, y bloquearla para esa ronda. No volver a elegirla en función de la webcam.
3. Reproducir música o efectos de cuenta regresiva y mostrar en tipografía pixel **3 → 2 → 1**.
4. Cuando aparezca **1**, Michi muestra la animación correspondiente a su jugada ya bloqueada.
5. Simultáneamente, el detector recopila el gesto del jugador durante una ventana breve y limitada **después del 1**, aproximadamente **1–2 segundos** como punto de partida. El objetivo es confirmar **el último gesto suficientemente estable** al cierre de la ventana, no aceptar la última detección aislada ni usar una predicción anterior.
6. Mostrar ambas elecciones en sus casillas y determinar el resultado según las reglas de piedra, papel o tijera.
7. Reproducir una reacción visual y musical sin iniciar otra comparación accidental.
8. Esperar la acción para continuar o pasar automáticamente a la siguiente ronda después de una pausa configurable, con opción accesible de omitirla.

**Reglas:** Rock vence a Scissors, Scissors vence a Paper y Paper vence a Rock.

### 6.4 Marcador y casillas

```text
               MICHI                        JUGADOR
         ┌─────────────────┐          ┌─────────────────┐
         │  VICTORIAS: 2   │          │  VICTORIAS: 1   │
         └─────────────────┘          └─────────────────┘
         ┌─────────────────┐          ┌─────────────────┐
         │   GATO ANIMADO  │          │ CÁMARA / GESTO  │
         └─────────────────┘          └─────────────────┘

                  PRIMERO EN GANAR 3
```

- Marcador **encima de la casilla del gato** y **encima de la casilla del jugador**.
- Aumentar el marcador solo del ganador de la ronda.
- **Si hay empate, no sumar victoria a nadie y no acercarse a la meta.** Mostrar `DRAW` o `EMPATE` y repetir otra ronda.
- Si hay **Nada**, gesto ambiguo, cámara desconectada o detección insuficiente, **no adjudicar una derrota automática**. Mostrar `NO DETECTÉ TU GESTO` y permitir reintentar sin alterar el marcador.
- No permitir doble puntuación. Una ronda solo puede resolverse una vez.

### 6.5 Final de la partida

- Cuando Michi alcance primero la meta, mostrar en gran tamaño, **rojo**, con tipografía pixel: **`YOU LOSE`**.
- Cuando el jugador alcance primero la meta, mostrar en gran tamaño y color de celebración: **`YOU WIN`**.
- Mostrar el marcador definitivo, animación de victoria o derrota del gato, música de final y botones **VOLVER A JUGAR**, **CAMBIAR META** y **SALIR A LA CONSOLA**.
- Ejemplo con meta de 3: **gato 3 – jugador 1 → YOU LOSE**. Un empate intermedio no modifica ese 3–1.
- El marcador no debe depender de la calidad instantánea de la cámara después de que la ronda ya se resolvió.

### 6.6 Estados que deben estar modelados explícitamente

```text
GAME_MENU
ASK_READY
SELECT_TARGET_WINS
CAMERA_PERMISSION
ROUND_PREPARE
COUNTDOWN_3
COUNTDOWN_2
COUNTDOWN_1_REVEAL_CAT
CAPTURE_PLAYER_GESTURE
EVALUATE_ROUND
ROUND_WIN_PLAYER
ROUND_WIN_CAT
ROUND_TIE
ROUND_INVALID_GESTURE
WAIT_NEXT_ROUND
GAME_OVER_WIN
GAME_OVER_LOSE
CAMERA_ERROR
PAUSED
RETURN_TO_CONSOLE
```

El estado debe determinar qué botones funcionan, qué música suena, cuándo se escucha la cámara y cuándo se congela el resultado.

---

## 7. Seguridad funcional del reconocimiento de gestos

El prototipo actual **no puede tratar todas las detecciones como jugadas correctas**. La cámara real ha mostrado falsas activaciones y pérdidas de estabilidad.

### Requisitos de captura

- Solicitar permiso de cámara de forma explícita y avisar si se deniega.
- Activar cámara solo al entrar en Michikembo, no en la vista previa de la consola.
- Ofrecer una vista previa pequeña y, si conviene, la opción de espejo, manteniendo consistencia en el procesamiento de coordenadas.
- Considerar `Nada` un estado verdadero del filtro temporal. No descartarlo al calcular mayorías.
- Confirmar un gesto únicamente si persiste durante suficientes fotogramas y alcanza un umbral de confianza y estabilidad **comprobados**.
- Un solo salto de `Nada` a `Scissors` no debe ganar una ronda.
- Si aparecen múltiples manos o gestos incompatibles, mostrar **AMBIGUO** y no confirmar una jugada.
- Establecer un límite temporal de captura por ronda y comportamiento claro para ausencia de gesto.
- Bloquear el reconocimiento una vez aceptada la jugada de la ronda para evitar cambios posteriores.
- No almacenar video ni fotografías sin autorización. Guardar métricas de diagnóstico solo si se indica expresamente.
- Mostrar mensajes para carga fallida de modelo, webcam ocupada, falta de permiso o dispositivo incompatible.

### Dos modos separados

**Modo desarrollo:** muestra la versión del modelo, predicción instantánea, decisión estable, confianza, FPS, latencia, número de cajas y estado `Nada` o `Ambiguo`.

**Modo jugador:** oculta detalles técnicos, muestra instrucciones cortas y nunca puntúa una detección dudosa.

### Pruebas mínimas antes de declarar el reconocimiento estable

1. Mano ausente durante un periodo largo, con varias iluminaciones y fondos.
2. Cada gesto sostenido durante al menos 15–20 segundos.
3. Transiciones frecuentes entre los tres gestos.
4. Mano parcialmente fuera de cuadro, distancias distintas y fondos variables.
5. Dos manos, varias personas o múltiples gestos simultáneos.
6. Cámaras distintas, si están disponibles.
7. Fallos y desconexiones de webcam.
8. Comparación entre salida Python/PyTorch y salida ONNX del navegador.

**Metas de calidad:** aspirar a superar 90 % de métricas relevantes con datos independientes, pero **no prometerlo sin evidencia**. Para el juego, definir por separado tasas aceptables de falsas activaciones, acierto por gesto y tiempo de respuesta en el hardware objetivo. Registrar también casos donde se abstiene de decidir.

---

## 8. Animaciones del gato basadas en `GatoBase.ase`

El gato Michi será el personaje principal. La animación debe conservar una identidad visual coherente basada en mi archivo **`GatoBase.ase`**.

### Distribución propuesta de recursos

```text
public/assets/games/michikembo/cat/
├── original/
│   └── GatoBase.ase          ← ARCHIVO FUENTE, si es apropiado versionarlo
├── idle/
│   └── [animación exportada por mí]
├── rock/
│   └── [animación exportada por mí]
├── paper/
│   └── [animación exportada por mí]
├── scissors/
│   └── [animación exportada por mí]
├── happy/
│   └── [animación exportada por mí]
├── sad/
│   └── [animación exportada por mí]
├── victory/
│   └── [animación exportada por mí]
├── defeat/
│   └── [animación exportada por mí]
├── confused/
│   └── [animación exportada por mí]
└── animations.json           ← Rutas, tamaños y FPS de cada secuencia
```

**La IA debe indicarme literalmente:** «Para la animación de tijera, exporta tus fotogramas a `public/assets/games/michikembo/cat/scissors/`» y explicar el nombre, formato, transparencia, tamaño y orden requeridos. Lo mismo con cada estado. Si se prefieren spritesheets, documentar sus columnas, filas, duración por fotograma y origen del sistema de coordenadas.

### Requisitos de animación

- Animaciones temporales y reutilizables por estado.
- Pixel art con escala **nearest-neighbor**, sin suavizado borroso.
- Evitar que cambie de tamaño o posición la silueta del gato durante la reproducción.
- Mantener `idle` como estado de reposo.
- Mostrar la jugada del gato exactamente en la revelación de `1`.
- Reproducir alegría, tristeza, victoria, derrota y confusión según el resultado.
- Usar recursos temporales explícitos si aún no he entregado animaciones, **sin inventar que ya están completas**.
- No modificar por cuenta propia `GatoBase.ase` ni reemplazar mi arte final sin pedirme los archivos correspondientes.

---

## 9. Consola virtual inspirada en la imagen adjunta

### Objetivo visual

Crear una **consola portátil ilustrada, bonita y original**, inspirada en el aspecto de la imagen que adjuntaré:

- Fondo general **azul claro / lavanda pastel**.
- Carcasa **blanca** con contorno **morado intenso** y bordes redondeados.
- Pantalla interior **violeta oscuro** y cristal con reflejos suaves.
- Cruceta púrpura grande a la izquierda.
- Dos botones circulares **fucsia/rojo** a la derecha.
- Botones secundarios pequeños, inclinados, en la parte inferior.
- Rejilla de altavoz y detalles retro en la carcasa.
- Luces discretas, sombras suaves y microanimaciones de encendido.
- Controles con una sensación táctil: al pulsar, se hunden o iluminan brevemente.

**La imagen adjunta es la fuente de inspiración visual. La pantalla que aparece apagada en esa imagen debe mostrar la interfaz real de los videojuegos.**

### Selector de videojuegos

En la pantalla de la consola aparece una tarjeta por juego, con título pixelado y una vista previa visual:

```text
┌──────────────────────────────┐
│         GAME SELECT          │
│                              │
│      [PREVIEW DEL JUEGO]     │
│                              │
│         MICHIKEMBO           │
│        ◀    1 / 3    ▶       │
│                              │
│         [A] JUGAR            │
└──────────────────────────────┘
```

- Juegos: **Michikembo**, **Cosmic Drift** y **Dinosaurio**.
- A izquierda/derecha, la cruceta cambia de videojuego.
- El botón **A** o **ENTER** abre el juego seleccionado.
- El botón **B** o **ESC** vuelve atrás o cierra el juego.
- Añadir soporte equivalente con mouse, teclado y táctil.
- La vista previa puede ser una ilustración, captura propia o una animación corta. **Nunca debe activar la webcam en segundo plano**.
- Transiciones de selección agradables y sonidos breves.
- Al pulsar JUGAR, la pantalla se expande mediante transición a un área de juego inmersiva, con tamaño adaptable y relación de aspecto preservada.
- Ofrecer **VOLVER A CONSOLA** y, cuando sea posible, salida de pantalla completa con `Esc`.
- Al regresar, detener correctamente cámara, bucles de animación y audio del videojuego anterior.

### Referencia de interacción

El sitio <https://sadok.mx/> sirve como referencia para **navegación mediante cruceta, botones A/B y selección de contenido desde una consola**. No replicar su código, su marca, sus proyectos ni sus recursos visuales sin permiso.

---

## 10. Música y efectos de sonido

Quiero que **Michikembo ya pueda reproducir música** y, al mismo tiempo, que yo pueda **poner o cambiar archivos musicales** dentro de carpetas fáciles de encontrar.

### Biblioteca inicial de escenas sonoras

| Momento | Audio deseado | Conducta |
|---|---|---|
| Consola encendida | Tema retro de bienvenida | Bucle suave, volumen moderado |
| Menú de Michikembo y «¿Estás listo?» | Música 8-bit cálida y juguetona | Bucle suave |
| Elección de victorias | Continuación del tema de menú | Sin reinicios bruscos |
| Cuenta regresiva 3, 2, 1 | Secuencia rítmica breve | Sincronizada con cada número |
| Revelación de la jugada del gato | Efecto corto de acción | Coincide con la animación |
| Victoria de una ronda | Melodía corta alegre | No tapa el resultado |
| Derrota de una ronda | Melodía corta descendente o divertida | Sin resultar molesta |
| Empate | Efecto neutro de empate | Sin alterar marcador |
| Gesto no detectado | Efecto suave de aviso | Evitar tono de castigo |
| `YOU WIN` final | Fanfarria retro de victoria | Más expresiva |
| `YOU LOSE` final | Tema breve de derrota | Coherente con la escena |
| Botones y navegación | Efectos discretos tipo consola | Volumen independiente |

### Archivos y opciones

```text
public/assets/audio/
├── console/
│   ├── startup.ogg
│   ├── select.wav
│   └── open_game.wav
└── michikembo/
    ├── menu_theme.ogg
    ├── countdown.wav
    ├── reveal.wav
    ├── round_win.wav
    ├── round_lose.wav
    ├── round_tie.wav
    ├── no_gesture.wav
    ├── final_win.ogg
    └── final_lose.ogg
```

La IA debe diseñar un **gestor de audio modular** con volumen maestro, volumen de música, volumen de efectos, botón de silencio, fundidos, precarga y liberación de recursos.

**¿Puede la IA generar música?** Se pueden crear **melodías y efectos originales programáticamente**, por ejemplo con Web Audio API, o integrar archivos originales que yo suministre. La IA debe indicar qué puede producir realmente, sin afirmar que ha generado música si solo preparó las rutas. Evitar utilizar piezas comerciales o protegidas sin licencia. Documentar los créditos y licencias de cada audio.

**Importante para navegador:** la reproducción de audio debe iniciar después de una interacción del usuario cuando las políticas de reproducción automática lo requieran. No reproducir música inesperadamente antes de pulsar un botón.

---

## 11. Cosmic Drift y Dinosaurio

### 11.1 Cosmic Drift

Repositorio: <https://github.com/SofiOyola/Cosmic-Drift.git>.

Se dispone de una versión web documentada en el proyecto, con Canvas, cámara y control por gestos. **Inspeccionarla antes de copiar, adaptar o incrustar código**. La integración debe conservar:

- Movimiento de nave mediante gestos.
- Disparo, escudo y habilidades especiales.
- Enemigos, orbes, puntuación y niveles.
- Audio y pantalla de fin de partida.
- Permisos de cámara, controles y liberación de recursos.
- Diseño y activos propios del juego.

Puede integrarse como módulo web aislado o como experiencia contenida, según el código realmente disponible. Evitar colisiones de estilos, controles, nombres globales y audio. Definir qué ocurre cuando Cosmic Drift y Michikembo quieren acceder a la misma cámara. Nunca mantener los dos activos al mismo tiempo.

### 11.2 Dinosaurio

Crear un videojuego original con las siguientes mecánicas:

1. Pantalla de inicio sencilla y pixelada.
2. Dinosaurio original que corre y salta.
3. Obstáculos que aparecen progresivamente.
4. Colisiones, puntuación y aumento gradual de dificultad.
5. Pantalla de derrota, reinicio y récord local.
6. Controles por teclado y botón táctil.
7. Música opcional y efectos de salto/colisión.
8. Regreso a la consola sin recargar toda la aplicación.

Inspirarse en el **tipo de mecánica** de un juego de corredor infinito, pero diseñar personajes, objetos y escenarios propios. No depender de copiar assets, sonidos ni código del juego original de Google.

---

## 12. Plan de implementación por fases

### Fase 0. Inspección y protección del trabajo actual

**Objetivo:** evitar perder código, modelos y resultados.

- [ ] Examinar repositorio principal, rama actual y cambios locales.
- [ ] Examinar Cosmic Drift y su versión web real.
- [ ] Inspeccionar notebook, modelos `.pt` y `.onnx`, archivos de animación y la imagen de referencia.
- [ ] Elaborar un inventario de elementos existentes y pendientes.
- [ ] Crear una rama de trabajo o respaldo verificable antes de migrar archivos.
- [ ] Crear `docs/PLAN_MAESTRO.md`, `docs/ESTADO_ACTUAL.md` y una bitácora de Fase 0.

**Aceptación:** inventario real y respaldo disponible, sin archivos destruidos.

### Fase 1. Base del proyecto y arquitectura web

- [ ] Elegir la solución de frontend tras revisar la existente. Mantenerla consistente para los tres videojuegos.
- [ ] Implementar rutas o módulos aislados para consola y juegos.
- [ ] Crear interfaz de carga, errores y recursos compartidos.
- [ ] Habilitar pruebas automatizadas, lint y README inicial.
- [ ] Asegurar funcionamiento con servidor local y rutas relativas correctas.

**Aceptación:** los tres módulos aparecen como opciones navegables, aunque los juegos aún usen pantallas temporales.

### Fase 2. Sustitución fácil del modelo

- [ ] Verificar exportación ONNX del E3c seleccionado.
- [ ] Implementar `model.onnx` y `manifest.json` en la carpeta fija.
- [ ] Desarrollar adaptador de inferencia desacoplado del juego.
- [ ] Comprobar equivalencia Python/ONNX, clases, formato de cajas y NMS.
- [ ] Implementar prueba de reemplazo de modelo y reversión.
- [ ] Escribir `docs/COMO_CAMBIAR_MODELO.md` con instrucciones para mí.

**Aceptación:** al reemplazar el archivo y actualizar el manifiesto, la aplicación carga la nueva versión sin alterar la lógica de rondas.

### Fase 3. Webcam, estabilidad y control de falsas jugadas

- [ ] Permiso de cámara y diagnóstico visible.
- [ ] Filtro temporal que incluya `Nada` y gestos ambiguos.
- [ ] Captura limitada de 1–2 segundos después del `1`.
- [ ] Confirmación única de gesto y reintento si no se detecta.
- [ ] Pruebas con mano ausente, tres gestos, transiciones y problemas de iluminación.
- [ ] Comparar umbrales con evidencia. No declarar definitivo 0,20 sin medirlo.
- [ ] Registrar latencia total, acierto y falsas activaciones.

**Aceptación:** el juego no suma puntos por predicciones de un solo fotograma y existe un informe de resultados en cámara real.

### Fase 4. Mecánicas completas de Michikembo

- [ ] Pantallas «¿Estás listo?», SÍ/NO y meta de victorias.
- [ ] Conteo 3 → 2 → 1 y jugada del gato bloqueada antes de observar el gesto final.
- [ ] Captura y resolución de resultado solo una vez por ronda.
- [ ] Marcador arriba de las dos casillas.
- [ ] Empates y gestos inválidos sin sumar.
- [ ] Condición primero en conseguir N victorias.
- [ ] Final `YOU WIN` / `YOU LOSE`, reiniciar y volver a consola.
- [ ] Tests unitarios de todas las combinaciones de gestos, empates y finales 3–1.

**Aceptación:** se puede completar una partida de principio a fin en modo de prueba sin webcam, con decisiones simuladas, y luego con el modelo real.

### Fase 5. Integrar animaciones de Michi

- [ ] Crear carpetas y configuración de sprites.
- [ ] Implementar reproductor de animación con escala pixelada.
- [ ] Señalar las animaciones faltantes.
- [ ] Entregarme una tabla exacta de exportación desde `GatoBase.ase`.
- [ ] Integrar progresivamente mis archivos cuando los proporcione.
- [ ] Comprobar que cada animación corresponde al estado y que no tiene saltos visuales.

**Aceptación:** cada animación puede añadirse cambiando solo recursos y metadatos, no la lógica del juego.

### Fase 6. Música, efectos y ambientación

- [ ] Crear reproductor y mezclador de audio.
- [ ] Preparar música original o integrar mis archivos con licencia comprobada.
- [ ] Sincronizar cuenta regresiva, revelación y resultados.
- [ ] Agregar controles de volumen, mute y preferencias.
- [ ] Documentar rutas, formatos y cómo reemplazar canciones.

**Aceptación:** los cambios de pantalla tienen sonidos adecuados, no hay música superpuesta y el jugador puede silenciarla.

### Fase 7. Consola visual y previews

- [ ] Diseñar una carcasa original inspirada en **la imagen que adjuntaré**.
- [ ] Crear pantalla funcional con tres juegos seleccionables.
- [ ] Implementar cruceta, A/B, Start, sonido y efectos visuales.
- [ ] Diseñar preview individual de Michikembo, Cosmic Drift y Dinosaurio.
- [ ] Expandir el juego seleccionado a una vista inmersiva.
- [ ] Permitir volver a la consola mediante teclado, clic y botón visible.
- [ ] Validar diseño en pantallas grandes y móviles.

**Aceptación:** todas las interacciones visuales tienen comportamiento real, no botones de adorno.

### Fase 8. Integración de Cosmic Drift

- [ ] Reutilizar su versión web sin romper mecánicas ni recursos.
- [ ] Implementar el adaptador de entrada/salida de consola.
- [ ] Evitar conflictos de cámara, CSS, audio y teclado.
- [ ] Probar el juego independiente e integrado.

**Aceptación:** Cosmic Drift se puede seleccionar, jugar y cerrar correctamente desde la consola.

### Fase 9. Desarrollo de Dinosaurio

- [ ] Crear sprites y fondos originales.
- [ ] Implementar carrera, salto, obstáculos, colisiones, puntuación y récord.
- [ ] Añadir transiciones, sonidos y reinicio.
- [ ] Integrar controles y salida a la consola.

**Aceptación:** el tercer juego es completamente funcional y no depende de recursos copiados de Google.

### Fase 10. Pruebas integrales y rendimiento

- [ ] Probar todas las reglas y flujos completos de Michikembo.
- [ ] Probar los tres juegos dentro de la misma sesión.
- [ ] Repetir pruebas de webcam con condiciones reales.
- [ ] Medir FPS, tiempo de carga, consumo de memoria e inferencia.
- [ ] Probar permisos, audio, teclas y navegación táctil.
- [ ] Revisar accesibilidad, contraste de tipografía pixel y estados de error.
- [ ] Corregir errores encontrados y repetir pruebas de regresión.

**Aceptación:** ninguna partida ni transición deja procesos activos o una cámara abierta indebidamente. Los resultados están documentados.

### Fase 11. GitHub, documentación y entrega

- [ ] Organizar carpetas, código, recursos y dependencias.
- [ ] Preparar `.gitignore` para venv, cachés, credenciales, capturas privadas y artefactos temporales.
- [ ] Verificar qué modelos y assets se pueden publicar por tamaño y licencia.
- [ ] No subir el dataset Roboflow ni fotos de usuarios sin permiso de redistribución.
- [ ] Documentar instalación, ejecución, licencias y cambio del modelo.
- [ ] Hacer commits pequeños por fase y publicar en <https://github.com/SofiOyola/Michikembo.git>.
- [ ] Conservar vínculos y atribuciones a <https://github.com/SofiOyola/Cosmic-Drift.git>.
- [ ] Preparar una versión de demostración y verificar la cámara en `localhost` o HTTPS.

**Aceptación:** el repositorio permite reproducir la instalación, ejecutar la consola con tres juegos y seguir el proceso de sustitución del modelo.

---

## 13. Pruebas funcionales que no pueden faltar

| Caso | Resultado exigido |
|---|---|
| Clic en «NO» de «¿Estás listo?» | Regresa sin iniciar ronda |
| Clic en «SÍ» | Abre selección de meta de victorias |
| Meta de 3, marcador 2–1 y gana Michi | Termina en 3–1, aparece `YOU LOSE` rojo |
| Meta de 3, marcador 2–2 y gana jugador | Termina en 2–3, aparece `YOU WIN` |
| Rock contra Scissors | Gana Rock |
| Paper contra Rock | Gana Paper |
| Scissors contra Paper | Gana Scissors |
| Mismo gesto | Empate, ningún marcador cambia |
| Sin mano | No suma victoria ni derrota |
| Gesto ambiguo | No suma y ofrece reintentar |
| Detección incorrecta aislada | No confirma una jugada automáticamente |
| Cambio de gesto después de confirmar | No modifica la ronda ya resuelta |
| Salir de Michikembo | Detiene la webcam, audio y temporizadores |
| Abrir Cosmic Drift después de Michikembo | No hay dos cámaras activas ni listeners duplicados |
| Cambiar `model.onnx` | Cambia solo el adaptador de inferencia, no la mecánica |
| Modelo ausente o corrupto | Mensaje legible y regreso al menú, sin cerrar toda la consola |
| Controles A/B físicos dibujados | Responden a clic y teclado |
| Silenciar audio | Detiene o atenúa música y efectos según la preferencia |

---

## 14. Documentación, persistencia y ahorro de tokens

### 14.1 Archivos Markdown obligatorios

La IA deberá crear y actualizar:

```text
docs/
├── PLAN_MAESTRO.md
├── ESTADO_ACTUAL.md
├── DECISIONES_TECNICAS.md
├── COMO_CAMBIAR_MODELO.md
├── ANIMACIONES_GATO.md
├── AUDIO.md
├── PRUEBAS_Y_EVIDENCIAS.md
└── seguimiento/
    ├── PASO_00_INVENTARIO.md
    ├── PASO_01_ARQUITECTURA.md
    ├── PASO_02_MODELO_REEMPLAZABLE.md
    ├── PASO_03_CAMARA.md
    └── ...
```

**Después de finalizar cada fase o paso implementado**, crear o actualizar su `.md` e incluir: objetivo, archivos cambiados, comandos ejecutados, pruebas y resultados, decisiones, problemas, pendientes y el siguiente paso. No declarar completado lo que no se verificó.

### 14.2 Control de créditos/tokens

- Leer primero `ESTADO_ACTUAL.md`, el archivo del paso en curso y solo los archivos necesarios.
- Evitar volver a describir todo el proyecto en cada respuesta.
- No repetir experimentos costosos que ya tienen pesos y resultados guardados.
- Guardar checkpoints de entrenamiento y evidencia duradera en Drive.
- Preferir pruebas pequeñas y verificables antes de introducir cambios grandes.
- Informar qué archivos se modificaron, sin copiar grandes cantidades de código en el chat cuando ya están almacenadas.
- Cuando la plataforma **muestre efectivamente que se consumió alrededor del 50 % de los créditos/tokens diarios**, generar un archivo `docs/seguimiento/CORTE_50_POR_CIENTO.md` con estado y próximos pasos.
- **Si la IA no puede consultar el contador real de créditos, no debe inventar porcentajes ni afirmar que detectó el 50 %.** Debe pedir el dato visible al usuario o generar cortes preventivos por hitos de trabajo.
- Antes de cerrar una sesión, guardar `ESTADO_ACTUAL.md` con el próximo comando exacto y las dependencias pendientes.

### 14.3 Formato de cada bitácora

```markdown
# Paso XX. Nombre de la actividad

## Objetivo
## Estado inicial
## Trabajo realizado
## Archivos creados o modificados
## Pruebas ejecutadas y resultados
## Riesgos y limitaciones
## Evidencias y rutas
## Estado final
## Siguiente paso exacto
```

---

## 15. Orden de prioridades

**Prioridad 1 — Ejecutable y mantenible:** obtener un proyecto funcional, un modelo intercambiable y una ronda completa de Michikembo.

**Prioridad 2 — Reconocimiento confiable:** reducir falsas activaciones, mejorar estabilidad y validar con webcam, sin retrasar la construcción visual del prototipo.

**Prioridad 3 — Arte y sonido:** añadir las animaciones que yo entregaré y generar o integrar audio original.

**Prioridad 4 — Consola y tres juegos:** materializar la carcasa visual, previews, transiciones, integrar Cosmic Drift y desarrollar Dinosaurio.

**Prioridad 5 — Publicación y calidad:** pruebas integrales, documentación, licencias, rendimiento y GitHub.

Se pueden trabajar algunos componentes visuales mientras mejora el modelo, **siempre manteniendo la interfaz de inferencia desacoplada**. No bloquear toda la aplicación por no haber alcanzado todavía el 90 %.

---

## 16. Instrucción final para la IA que reciba este documento

> Quiero que uses este Markdown como plan funcional y de continuidad de **Michikembo**, una consola retro con tres juegos. Voy a adjuntar también la **imagen de referencia de la consola**, `GatoBase.ase`, mi **Colab actual**, el modelo disponible y cualquier otro material que haga falta.
>
> 1. Inspecciona primero los archivos adjuntos y los repositorios. No inventes contenido ni sobreescribas trabajo existente.
> 2. Contrasta lo que este plan describe con el código que realmente existe y crea un inventario de estado.
> 3. Implementa la solución por fases siguiendo los criterios de aceptación, empezando por **hacer que el modelo E3c sea fácil de sustituir** y por una **ronda completa de Michikembo**.
> 4. Utiliza la imagen adjunta para una consola original de carcasa blanca y violeta, pantalla con previews, cruceta y botones funcionales. Al jugar, expande el videojuego y permite regresar.
> 5. Respeta «¿Estás listo?», selección de meta, cuenta regresiva 3–2–1, revelación de la jugada aleatoria de Michi en el 1, ventana limitada de reconocimiento del último gesto estable, marcador superior, empate sin puntos y finales `YOU WIN`/`YOU LOSE`.
> 6. Define exactamente dónde ubicar cada animación que yo elaboraré desde `GatoBase.ase`. No hagas suposiciones sobre animaciones que aún no te haya entregado.
> 7. Crea un sistema para música original, efectos de cuenta regresiva, selección, resultados y finales, con carpetas donde yo pueda reemplazar los archivos.
> 8. Integra Cosmic Drift desde su repositorio y desarrolla un Dinosaurio original como tercer juego.
> 9. Mantén las pruebas automatizadas y la documentación `.md` después de cada fase. Guarda checkpoints y avances duraderos.
> 10. Evita gastar tokens de forma innecesaria. Si tienes acceso real al consumo de créditos, avisa y guarda un corte cuando llegue al 50 %. Si no, no inventes el dato.
> 11. Actualiza GitHub mediante cambios controlados, sin sobrescribir archivos, sin publicar datos privados y respetando las licencias.
> 12. No declares terminado el entrenamiento final del modelo. E3c es **provisional**. Se debe poder usar en el prototipo ahora y cambiarlo después cuando las pruebas justifiquen una mejora.
>
> Al terminar cada fase, entrega el resultado verificable, la ruta de sus archivos, sus pruebas y el nombre de la siguiente fase. Si faltan mis animaciones o música, deja preparada la integración, señala las rutas exactas y continúa con los componentes que sí puedas completar.

---

## 17. Definición de éxito del proyecto completo

El proyecto se considerará terminado cuando:

1. Se abra una consola visual original inspirada en la imagen adjunta.
2. Dentro de la pantalla se puedan previsualizar y elegir **Michikembo, Cosmic Drift y Dinosaurio**.
3. Cada uno se expanda al jugar y permita volver a la consola.
4. Michikembo tenga flujo completo de preparación, meta de victorias, cuenta regresiva, cámara, animaciones, marcador, empates y resultados finales.
5. El reconocimiento use un modelo reemplazable desde una carpeta claramente documentada.
6. La ausencia de mano o detecciones ambiguas no produzcan victorias o derrotas arbitrarias.
7. Pueda colocar mis animaciones de `GatoBase.ase` en rutas definidas, sin reprogramar el juego.
8. Exista música ambiental y efectos por escena, con controles y archivos reemplazables.
9. Cosmic Drift conserve sus funciones principales y Dinosaurio esté implementado con recursos propios.
10. Existan pruebas, bitácoras por fase, instrucciones de instalación, documentación y código organizado en GitHub.
11. El modelo definitivo se determine con resultados comprobables en cámara real y datos externos independientes, sin asegurar métricas que aún no se han alcanzado.

**Estado al redactar este documento:** objetivos definidos y plan preparado. La aplicación consolidada, las animaciones finales, la consola completa y el reconocimiento definitivo **siguen pendientes de implementación y validación**.
