# Contrato de producto

**Estado:** contrato aceptado para el MVP
**Última revisión:** 2026-08-25

## 1. Visión

Runscars permite entender cómo evoluciona la carrera a los Oscar y comparar esa
evolución con el resultado final. Reúne señales dispersas sin ocultar de dónde
proceden ni convertirlas en una nota única difícil de interpretar.

La superficie principal del MVP es el seguimiento transparente de predicciones
profesionales: quién lidera, qué fuentes sostienen cada posición y qué cambio
efectivo originó cada corte. Crítica, mercados y comunidad son lentes
complementarias y nunca alteran ese consenso.

## 2. Preguntas que debe responder

- ¿Qué películas y candidaturas están siendo mejor recibidas por la crítica?
- ¿Qué películas y personas aparecen con mayor frecuencia en las predicciones?
- ¿Cómo ha cambiado el consenso durante la temporada?
- ¿Qué películas ha visto cada usuario y cuál es su ranking?
- ¿Cuánto acertó el consenso antes de las nominaciones y de la ceremonia?

## 3. Usuarios

### Visitante

Consulta temporadas, películas, categorías, puntuaciones, predicciones, reseñas,
metodología y resultados oficiales sin necesidad de una cuenta.

### Usuario registrado

- Marca películas como vistas o no vistas.
- Crea rankings por categoría.
- Elige si sus rankings son públicos o privados.
- Modifica o elimina sus propios datos.

### Administrador editorial

- Incorpora y corrige películas, personas y candidaturas.
- Revisa coincidencias dudosas.
- Gestiona fuentes e importaciones.
- Excluye observaciones erróneas sin borrar su historial.
- Crea y bloquea snapshots.
- Registra nominaciones y ganadores oficiales.

## 4. Modelo temporal

Una temporada conserva al menos:

- `ceremony_year`: año de la ceremonia;
- `eligibility_year` o periodo de elegibilidad;
- fechas de apertura y cierre;
- fecha del anuncio de nominaciones;
- fecha de la ceremonia;
- estado: preparación, activa, nominaciones publicadas o cerrada.

La interfaz usará una etiqueta inequívoca como
**“Oscar 2027 · películas de 2026”**.

## 5. Señales del producto

### Recepción crítica

Puntuaciones publicadas por críticos o medios y normalizadas a una escala de
cero a cinco estrellas. Los agregadores aprobados pueden descubrir esas piezas,
pero cada crítica conserva su medio, autor y URL originales y se deduplica por
publicación canónica. Siempre se muestra también la escala original. Solo se
promociona como agregado cuando existen al menos tres puntuaciones individuales
independientes; con menos cobertura aparece únicamente en la ficha relacionada
y rotulada como insuficiente. Tomatometer y Metascore aparecen en una capa de
contexto separada y no se mezclan con esta media.

### Predicciones

Rankings o selecciones de expertos sobre posibles nominados y posibles
ganadores. Cada predicción tiene categoría, fecha, fuente e intención.

### Mercados

Contratos y precios de mercados de predicción. Se muestran por proveedor y con
su valor original; no se promedian entre sí ni participan en el consenso
profesional Borda.

### Comunidad

Rankings realizados por usuarios y su estado de visionado. Los datos de la
comunidad no alteran los agregados profesionales.

### Reseñas

Extractos breves o resúmenes editoriales con atribución y enlace a la reseña
original. En el prototipo se priorizará la incorporación manual.

## 6. Alcance del MVP

### Temporadas

- Temporada activa completa.
- Cinco ceremonias anteriores con nominados y ganadores confirmados.
- No reconstruir especulación histórica que Runscars no hubiera capturado.

### Categorías

1. Mejor película.
2. Dirección.
3. Actor protagonista.
4. Actriz protagonista.
5. Actor de reparto.
6. Actriz de reparto.
7. Guion original.
8. Guion adaptado.

Las categorías se modelarán como datos configurables, no como columnas fijas.
Una candidatura puede representar una película, una obra y un conjunto ordenado
de personas. Las categorías adicionales detectadas se conservan, pero solo se
publican cuando alcanzan la cobertura aprobada.

### Fuentes

- Catálogo abierto de fuentes que superen la puerta de calidad de
  `DATA_SOURCES.md`; no existe un máximo numérico.
- Al menos ocho fuentes profesionales activas al cierre del MVP. Las fuentes
  oficiales, de metadatos y de festivales no cuentan para este mínimo.
- Al menos una fuente por cada señal profesional.
- Al menos tres conectores automáticos al cierre del MVP.
- Importación manual disponible para el resto.
- Una fuente seleccionada puede activarse gradualmente; solo sus observaciones
  elegibles participan en el agregado correspondiente.
- En el corte 7.1, cada categoría pública requiere cuatro rankings ordenados
  automáticos independientes; Mejor película incorpora además The Ringer como
  selección y alcanza seis medios automáticos.

### Actualización y snapshots

- Actualización automática diaria de conectores activos.
- Corte público tras la actualización diaria únicamente cuando cambia la
  superficie efectiva de al menos un proveedor profesional.
- Las ejecuciones de una misma fecha UTC se consolidan en su último estado; no
  producen comparaciones intradía ni dos cortes públicos con la misma fecha.
- Selector de cortes reales por categoría; cada corte reproduce su ranking y se
  compara con el corte real inmediatamente anterior.
- La interfaz distingue la fecha de publicación del proveedor, la fecha del
  último cambio efectivo y la última comprobación correcta del conector.
- Snapshot final de predicción de nominaciones.
- Snapshot final de predicción de ganadores.
- Comparación posterior con resultados oficiales.

### Cuenta

- Acceso mediante correo.
- Perfil público mínimo.
- Ranking por categoría.
- Estado vista/no vista.
- Visibilidad pública o privada.
- Eliminación de cuenta y contenido propio.

## 7. Recorridos esenciales

### R1. Explorar una categoría

1. El visitante elige temporada y categoría.
2. Ve el consenso de predicciones y su variación.
3. Abre una candidatura.
4. Comprueba las fuentes que sostienen la posición.

### R2. Explorar una película

1. El visitante abre la ficha.
2. Ve metadatos y material gráfico obtenido mediante TMDB.
3. Consulta puntuaciones originales y normalizadas cuando existen observaciones
   reales; sin el umbral mínimo no se publica una media.
4. Consulta categorías, predicciones y reseñas relacionadas.

### R3. Crear un ranking

1. El usuario inicia sesión.
2. Elige temporada y categoría.
3. Ordena candidaturas.
4. Guarda el ranking como público o privado.
5. Puede modificarlo o eliminarlo.

### R4. Consultar la evolución

1. El visitante abre una categoría.
2. Elige un corte real anterior.
3. Ve la clasificación tal como estaba entonces.
4. Compara sus cambios con el corte real inmediatamente anterior.

### R5. Medir el acierto

1. Tras un anuncio oficial, el administrador registra resultados.
2. Runscars compara los resultados con el snapshot final correspondiente.
3. La web muestra métricas por categoría y globales.

## 8. Requisitos funcionales

| ID | Requisito |
|---|---|
| RF-01 | Navegar por temporada y categoría sin cuenta |
| RF-02 | Mantener recepción crítica separada, deduplicar críticas descubiertas por agregadores y promocionarla solo con cobertura suficiente |
| RF-03 | Mostrar procedencia y fecha de cada dato profesional |
| RF-04 | Mantener fichas canónicas de película y persona |
| RF-05 | Importar metadatos de TMDB con corrección manual |
| RF-06 | Importar observaciones manual y automáticamente |
| RF-07 | Evitar duplicados al repetir una importación |
| RF-08 | Crear y consultar snapshots inmutables |
| RF-09 | Registrar nominados y ganadores oficiales |
| RF-10 | Crear cuenta, ranking y estado de visionado |
| RF-11 | Impedir que un usuario modifique datos de otro |
| RF-12 | Administrar matching, exclusiones, importaciones y snapshots |
| RF-13 | Mostrar frescura y estado de las fuentes |
| RF-14 | Funcionar correctamente en móvil y escritorio |
| RF-15 | Mostrar mercados separados por proveedor y fuera del agregado profesional |
| RF-16 | Publicar las ocho categorías desde datos persistidos y archivar Oscar 2022–2026 |
| RF-17 | Publicar metodología y evaluación por categoría y global desde versiones bloqueadas |

## 9. Fuera del MVP

- Comentarios de usuarios en reseñas.
- Aplicación móvil nativa.
- Todas las categorías de los Oscar.
- Ponderación secreta o automática del prestigio de una fuente.
- Recomendaciones personalizadas y notificaciones.
- Reconstrucción de predicciones de temporadas pasadas.
- Publicación de reseñas completas.
- Monetización.

## 10. Criterios de éxito del MVP

- Un visitante puede explicar de dónde sale cualquier agregado.
- Una actualización fallida no corrompe datos publicados.
- Dos ejecuciones de una misma importación producen el mismo estado.
- Una película mal emparejada puede corregirse desde administración.
- Un snapshot bloqueado conserva exactamente su estado.
- Los rankings privados no son accesibles por otros usuarios.
- El recorrido principal funciona en un viewport móvil.
- La aplicación puede desplegarse desde una instalación limpia siguiendo su
  documentación.

## 11. Glosario

- **Candidatura:** identidad canónica de temporada, categoría, película u obra y
  conjunto de personas consideradas.
- **Observación:** dato individual capturado de una fuente.
- **Predicción de nominación:** selección sobre quién recibirá nominación.
- **Predicción de ganador:** selección sobre quién ganará entre candidatos.
- **Snapshot:** estado versionado del agregado en un instante.
- **Corte real:** snapshot periódico creado porque cambió la lista o selección
  efectiva de al menos un proveedor profesional de ese alcance.
- **Temporada activa:** temporada sobre la que todavía se publican predicciones.
