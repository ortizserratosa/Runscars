# Hoja de ruta

**Última revisión:** 2026-08-07

Cada fase tiene una puerta de salida verificable. Una fase no se considera
terminada por haber creado archivos o código, sino por cumplir esa puerta.

## Estado general

| Fase | Entregable principal                        | Estado            |
| ---- | ------------------------------------------- | ----------------- |
| 0    | Contrato y registros                        | Completada        |
| 1    | Discovery y dataset de fuentes              | Completada        |
| 2    | Prototipo visual navegable                  | Completada        |
| 3    | Base técnica y staging                      | Completada        |
| 4    | Catálogo TMDB                               | Completada        |
| 5    | Sistema de ingesta                          | Completada        |
| 6    | Agregación                                  | Completada        |
| 7    | Snapshots y evaluación                      | Completada        |
| 7.1  | Cobertura multcategoría, archivo y mercados | Completada        |
| 8    | Usuarios                                    | Completada        |
| 9    | Administración editorial                    | Pendiente         |
| 10   | QA y MVP desplegado                         | Pendiente         |

## Fase 0 · Contrato y registros

**Cerrada:** 2026-07-24. Las decisiones D-001 a D-011 están aceptadas.

### Entregables

- contrato de producto;
- metodología;
- registro de fuentes;
- registro de decisiones;
- hoja de ruta;
- instrucciones persistentes para agentes.

### Puerta de salida

- Todas las decisiones de fase 0 están aceptadas, descartadas o pospuestas de
  forma explícita.
- No existen contradicciones entre producto, metodología y decisiones.
- El alcance y lo que queda fuera del MVP están claros.
- Las fases posteriores tienen un resultado verificable.

## Fase 1 · Discovery de fuentes

**Cerrada:** 2026-07-24. La matriz contiene 31 candidatas y 28 seleccionadas por
calidad; el fixture contiene 20 películas y 69 observaciones trazables. La fase
2 no se ha iniciado.

### Entregables

- matriz de 25–40 fuentes;
- selección mediante una puerta de calidad explícita, sin máximo rígido;
- dos muestras por fuente seleccionable;
- dataset de unas 20 películas;
- observaciones de puntuaciones, predicciones y reseñas;
- propuesta concreta de conectores.

### Puerta de salida

- [x] Las tres señales profesionales tienen cobertura.
- [x] Cada fuente seleccionada tiene un método viable.
- [x] El dataset puede alimentar el prototipo sin depender de datos inventados.
- [x] Se han actualizado `DATA_SOURCES.md`, `METHODOLOGY.md` y las decisiones
      afectadas.

## Fase 2 · Prototipo visual

**Cerrada:** 2026-07-24. El prototipo aislado incluye cinco superficies
navegables, selector de cuatro cortes reproducibles, trazabilidad por fuente y
ranking simulado. No se ha iniciado la base técnica de la fase 3.

### Entregables

- portada;
- páginas de temporada, categoría, película y fuente;
- módulos separados de crítica, predicción y comunidad;
- selector de snapshots;
- ranking de usuario simulado;
- versión móvil y escritorio.

### Puerta de salida

Un usuario puede, sin explicación, encontrar líderes de una categoría, descubrir
qué fuentes sostienen una posición, ver puntuaciones originales, recorrer la
evolución temporal y ordenar un ranking simulado.

Cumplimiento detallado en [PROTOTYPE.md](PROTOTYPE.md).

## Fase 3 · Base técnica

**Cerrada:** 2026-07-24. La aplicación Next.js definitiva, la migración inicial,
el seed, los tipos derivados, la suite de pruebas y la CI son reproducibles. El
flujo oficial local pasó sobre Supabase en Colima y el staging web de Vercel
está conectado a un proyecto Supabase aislado, migrado y verificado.

### Entregables

- aplicación y base de datos;
- migraciones y datos de prueba;
- configuración local documentada;
- integración continua;
- staging;
- comandos canónicos de verificación en `AGENTS.md`.

### Puerta de salida

Desde una copia limpia se puede instalar, migrar, cargar datos, probar, compilar
y desplegar siguiendo la documentación.

Seguimiento detallado en [TECHNICAL_FOUNDATION.md](TECHNICAL_FOUNDATION.md).

## Fase 4 · Catálogo TMDB

**Cerrada:** 2026-07-24. Las 20 películas del fixture tienen match revisado,
snapshot persistido, créditos y fichas enlazadas. El catálogo está desplegado en
staging y no hace llamadas a TMDB durante una visita.

### Entregables

- búsqueda e importación desde TMDB;
- caché local;
- fichas de película y persona;
- imágenes;
- corrección manual de matching;
- atribución preparada.

### Puerta de salida

- [x] Importar dos veces no duplica.
- [x] Una coincidencia incorrecta puede corregirse.
- [x] La web funciona con la API temporalmente caída usando datos ya guardados.
- [x] El token no aparece en cliente, logs ni repositorio.

Seguimiento detallado en [TMDB_CATALOG.md](TMDB_CATALOG.md).

## Fase 5 · Sistema de ingesta

**Cerrada:** 2026-07-24. El sistema incorpora importación manual y conectores
Guardian JSON, RogerEbert RSS y AwardsWatch HTML; persiste originales y
procedencia, aísla ejecuciones, deriva dudas a una cola privada y se programa
diariamente con Supabase Edge Functions y Cron.

### Entregables

- [x] adaptador común;
- [x] importación manual;
- [x] primeros 2–3 conectores;
- [x] almacenamiento de observaciones originales;
- [x] cola de revisión;
- [x] tareas programadas y logs.

### Puerta de salida

- [x] Repetir una importación no duplica.
- [x] El fallo de una fuente no bloquea las demás.
- [x] Una observación puede rastrearse hasta su URL.
- [x] Los conectores se prueban con fixtures sin acceder a internet.

Seguimiento detallado en [INGESTION.md](INGESTION.md).

## Fase 6 · Agregación

**Cerrada:** 2026-07-24. La versión `runscars-aggregation-v1` reproduce el
fixture de fase 1, calcula por separado recepción y predicciones, explica cada
término y deriva cuatro cortes temporales sin convertirlos todavía en snapshots.

### Entregables

- [x] normalización de puntuaciones;
- [x] métricas de consenso;
- [x] variación temporal;
- [x] explicación visible de cálculos;
- [x] pruebas con resultados esperados calculados a mano.

### Puerta de salida

Todos los ejemplos de referencia coinciden y cualquier cifra agregada puede
reproducirse desde sus observaciones.

Cumplimiento detallado en [AGGREGATION.md](AGGREGATION.md).

## Fase 7 · Snapshots y evaluación

**Cerrada:** 2026-07-25. Los snapshots y resultados son append-only, las
correcciones generan versiones enlazadas, el proceso semanal está programado y
`runscars-evaluation-v1` coincide con los ejemplos manuales.

### Entregables

- [x] snapshots periódicos;
- [x] cierres de nominaciones y ganadores;
- [x] bloqueo e historial de correcciones;
- [x] resultados oficiales;
- [x] métricas de acierto.

### Puerta de salida

Un snapshot bloqueado permanece idéntico tras nuevas importaciones y las
métricas de acierto coinciden con ejemplos manuales.

Cumplimiento detallado en [SNAPSHOTS.md](SNAPSHOTS.md).

## Fase 7.1 · Cobertura multcategoría, archivo y mercados

**Cerrada:** 2026-07-25. Código, datos reales, automatizaciones y web están
integrados en staging. La CI de la rama publicada reprodujo la verificación
completa en verde.

### Entregables

- [x] candidatura genérica y agregación, snapshot y evaluación v2;
- [x] cinco rankings automáticos en seis categorías y cuatro en los dos guiones;
- [x] seis fuentes automáticas aplicables a Mejor película;
- [x] ocho rutas públicas leídas desde Supabase;
- [x] categorías adicionales ingeribles y ocultas por configuración;
- [x] Kalshi y Polymarket append-only, separados de Borda;
- [x] archivo oficial Oscar 2026 de ocho categorías;
- [x] ejecución programada real satisfactoria por conector;
- [x] entorno desplegado y comprobado en verde;
- [x] CI en verde.

### Puerta de salida

La lista completa y su evidencia se mantienen en [PHASE_7_1.md](PHASE_7_1.md).
La fase 8 queda desbloqueada, pero no se ha iniciado.

El mantenimiento 7.1.1 del 2026-08-07 corrige el parser de Awards Daily,
recupera runs abandonados, compacta la cola editorial activa y amplía el
catálogo verificado antes de avanzar. No reabre la puerta de salida ni inicia
la fase siguiente. El segundo snapshot de control restauró y verificó la
cobertura objetivo; el primero se conserva como versión inmutable.

El mantenimiento 7.1.2 elimina de la portada el corte estático heredado del
prototipo y presenta, en cada categoría, la variación frente al snapshot
periódico inmediatamente anterior. Es una implementación del recorrido R1 y de
la metodología ya aceptada; no cambia la puerta de 7.1 ni inicia la fase 8.

El mantenimiento 7.1.3 acota los mercados a la ceremonia vigente, descubre las
series Oscar de Kalshi sin depender del orden global y separa nominación de
ganador por proveedor en cada categoría. Corrige la integración ya incluida en
7.1 y tampoco inicia la fase 8.

## Fase 8 · Usuarios

**Cerrada:** 2026-08-07. Supabase Auth, sesión SSR, perfiles, rankings
parciales, visionados, visibilidad, exportación y borrado están integrados en
staging. La puerta se comprobó con dos identidades reales y RLS.

### Entregables

- autenticación;
- perfil mínimo;
- rankings;
- visto/no visto;
- visibilidad;
- eliminación de datos.

### Puerta de salida

Dos usuarios no pueden leer datos privados ni modificar datos ajenos; un usuario
puede exportar o eliminar sus datos previstos.

El diseño, la implementación y la evidencia de la puerta se mantienen en
[PHASE_8.md](PHASE_8.md). D-014 permanece como `Propuesta`: la fase guarda y
muestra rankings individuales, pero no publica un consenso comunitario.

## Fase 9 · Administración editorial

### Entregables

- matching y correcciones;
- gestión de fuentes e importaciones;
- exclusiones;
- control de snapshots;
- resultados oficiales;
- historial de acciones.

### Puerta de salida

Un administrador puede resolver los errores habituales sin editar directamente
la base de datos y un usuario normal no accede a esas funciones.

## Fase 10 · QA y MVP

### Entregables

- pruebas end-to-end;
- revisión móvil, accesibilidad y rendimiento;
- página de metodología y créditos;
- backup y restauración;
- revisión de publicación de fuentes;
- despliegue final.

### Puerta de salida

- Los recorridos esenciales pasan en producción.
- Los checks automáticos están en verde.
- Se ha probado una restauración.
- No quedan fuentes activas marcadas `replace-before-publish`.
- Existe una URL estable del MVP.

## Definition of Done del MVP

- Temporada activa y archivo histórico acordado.
- Ocho categorías o alcance sustituto aceptado.
- Al menos ocho fuentes profesionales activas, sin máximo rígido, y tres
  conectores automáticos.
- Catálogo TMDB.
- Recepción, predicciones y comunidad separadas.
- Actualización automática diaria.
- Snapshots periódicos y finales.
- Cuentas y rankings.
- Panel editorial.
- Trazabilidad de datos.
- Aplicación móvil y escritorio.
- Metodología, créditos y recuperación documentados.
