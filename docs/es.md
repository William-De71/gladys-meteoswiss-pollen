# MeteoSwiss Pollen

## Presentación

Esta integración trae a Gladys el **polen medido cada hora por MeteoSuiza**, la Oficina Federal de Meteorología y Climatología de Suiza. Sigue de una a tres estaciones de su red nacional de medición de polen. Para **avellano**, **aliso**, **fresno**, **abedul**, **haya**, **roble** y **gramíneas**, obtiene el recuento de la última hora (pólenes por m³ de aire) y un nivel de nulo a muy alto. Cada estación se convierte en un dispositivo para mostrar en un panel y usar en escenas.

Las 15 estaciones con valores en tiempo real: Basel, Bern, Buchs SG, Davos, Genève, La Chaux-de-Fonds, Lausanne, Locarno, Lugano, Luzern, Münsterlingen, Neuchâtel, Payerne, Sion y Zürich. Son **mediciones, no una previsión**. MeteoSuiza no publica la ambrosía, la artemisa ni el llantén en tiempo real, así que no están disponibles.

Los datos son **datos públicos abiertos** de MeteoSuiza: no hace falta cuenta ni clave. Fuente: MeteoSuiza. Esta integración comunitaria no está afiliada a MeteoSuiza.

Es una integración **en la nube**: lee los archivos de cada estación en `data.geo.admin.ch` cada 20 minutos. Envía peticiones condicionales, así que un archivo sin cambios casi no cuesta nada. Guarda las últimas 48 horas en `/data`, de modo que un reinicio no pierde nada.

## Requisitos previos

- Gladys Assistant 5.3.0 o posterior.
- Acceso a Internet desde Gladys.

## Configuración

| Campo                  | Qué elegir                                                                             |
| ---------------------- | -------------------------------------------------------------------------------------- |
| Estación 1             | La estación de polen más cercana a su casa, entre las 15. Obligatorio.                 |
| Estación 2, Estación 3 | Otras estaciones (una segunda residencia, el trabajo). Opcional.                       |
| Idioma de los textos   | Nombres de dispositivos, polen principal y resúmenes de escenas. Automático: su panel. |

Guarde: el estado en la parte superior de la página muestra cada estación, su nivel actual y la hora de la próxima lectura. **Leer ahora** vuelve a leer en el acto (no de nuevo en dos minutos si los datos son recientes). **Diagnóstico** escribe el estado de la integración en la pestaña Registros.

## Uso

### Dispositivos

En la pestaña **Descubrir**, cree el dispositivo «Polen …» de cada estación. Tiene 16 funcionalidades:

- el **nivel de polen** actual, de 0 a 4: el más alto de los siete pólenes;
- para cada polen, el **recuento de la última hora**, en pólenes por m³;
- para cada polen, su **nivel**, a partir de la media de las últimas 24 horas;
- el **polen principal** como texto, por ejemplo «Abedul: alto (120/m³)».

Los niveles siguen las clases de carga polínica de MeteoSuiza: 0 nulo, 1 bajo, 2 moderado, 3 alto, 4 muy alto. MeteoSuiza los define para la media de un día. La integración los aplica a la media de las últimas 24 horas (hacen falta al menos 18 horas medidas), así que el nivel sigue las mediciones a lo largo del día.

| Polen (pólenes/m³) | Bajo | Moderado | Alto    | Muy alto |
| ------------------ | ---- | -------- | ------- | -------- |
| Avellano, aliso    | 1–10 | 11–69    | 70–249  | ≥ 250    |
| Fresno             | 1–10 | 11–99    | 100–349 | ≥ 350    |
| Abedul             | 1–10 | 11–69    | 70–299  | ≥ 300    |
| Haya, roble        | 1–49 | 50–129   | 130–399 | ≥ 400    |
| Gramíneas          | 1–19 | 20–49    | 50–149  | ≥ 150    |

Gladys no tiene unidad para el polen: los recuentos y los niveles se muestran sin unidad. Las horas de MeteoSuiza están en UTC y marcan el final de la hora medida.

### Widgets del panel

![El widget Estación de polen con los siete pólenes de una estación, y el gráfico Polen, últimas 48 h (ilustración generada, no una captura de pantalla)](https://raw.githubusercontent.com/William-De71/gladys-meteoswiss-pollen/main/docs/assets/widgets.es.png)

- **Estación de polen**: los siete pólenes, cada uno con su nivel como insignia y su recuento en la última hora y en 24 horas. Debajo están el nivel global, el polen principal, la hora de la medición y la fuente.
- **Polen, últimas 48 h**: un gráfico de los recuentos horarios de las últimas 48 horas, para los cuatro pólenes con el pico más alto. Fuera de temporada, un texto indica que no se midió polen.

Elija la estación en los ajustes del widget (vacío: la primera).

### Escenas

El disparador **MeteoSuiza: alerta de polen** se activa cuando un polen alcanza «Moderado» o más en una estación, o vuelve a subir el mismo día. Se activa como mucho una vez por nivel, estación, polen y día. La primera lectura de una estación sirve de referencia y no activa nada. Puede filtrar por estación, polen y nivel («Alto» y «Muy alto» para la mayoría de los alérgicos). Ofrece una frase lista, `{{triggerEvent.data.summary}}`, y sus valores: polen, nivel, media de 24 horas, última hora y hora de la medición.

La acción **MeteoSuiza: leer el polen** devuelve el nivel, el polen principal, un resumen, y el recuento y el nivel de cada polen de una estación. Úselos en un mensaje o compruébelos en una condición.

Ejemplos:

- Cuando el abedul está alto en Bern → enviar `{{triggerEvent.data.summary}}` y apagar la ventilación de los dormitorios.
- Cada mañana a las 7:00 → leer el polen y enviar el resumen con el tiempo.
- Cuando las gramíneas están muy altas → recordar cerrar las ventanas antes de salir.

### Transporte

Solo en la nube: los datos proceden de `data.geo.admin.ch`, la plataforma de datos abiertos de la Confederación Suiza. Solo las peticiones de los archivos de las estaciones salen de su red. No se envía nada sobre su casa.

## Solución de problemas

- **«sin medición nueva»**: la estación no publicó nada durante seis horas (mantenimiento, avería del aparato). Sus valores no se actualizan hasta que vuelve.
- **La hora de la medición lleva una o dos horas de retraso**: el servidor de la Confederación puede guardar los archivos en caché hasta dos horas. Es normal.
- **Todos los niveles se quedan en 0**: fuera de la temporada de polen (más o menos de octubre a enero) es normal.
- **«No se puede acceder a MeteoSuiza»** o **«rechaza las peticiones»**: la integración lo intenta de nuevo tras 5, 10, 20 y 40 minutos, y luego vuelve a su ritmo habitual.
- **Para informar de un problema**: pulse **Diagnóstico** y copie las líneas que empiezan por «Pollen diagnostic» de la pestaña Registros. Péguelas en una issue de GitHub o una respuesta en el foro, con las versiones de Gladys y de la integración.
