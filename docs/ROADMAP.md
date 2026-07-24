# Hoja de ruta

**Última revisión:** 2026-07-24

Cada fase tiene una puerta de salida verificable. Una fase no se considera
terminada por haber creado archivos o código, sino por cumplir esa puerta.

## Estado general

| Fase | Entregable principal | Estado |
|---|---|---|
| 0 | Contrato y registros | Completada |
| 1 | Discovery y dataset de fuentes | Completada |
| 2 | Prototipo visual navegable | Completada |
| 3 | Base técnica y staging | En curso |
| 4 | Catálogo TMDB | Pendiente |
| 5 | Sistema de ingesta | Pendiente |
| 6 | Agregación | Pendiente |
| 7 | Snapshots y evaluación | Pendiente |
| 8 | Usuarios | Pendiente |
| 9 | Administración editorial | Pendiente |
| 10 | QA y MVP desplegado | Pendiente |

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

**En curso:** la aplicación Next.js definitiva, la migración inicial, el seed,
los tipos derivados del esquema, la suite de pruebas y la definición de CI
están implementados. La instalación limpia y el staging web en Vercel están
verificados, y la CI se ha ejecutado correctamente desde el remoto público.
Falta ejecutar el flujo oficial de Supabase con un runtime de contenedores y
migrar su proyecto de staging antes de cerrar la fase.

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

Seguimiento detallado en
[TECHNICAL_FOUNDATION.md](TECHNICAL_FOUNDATION.md).

## Fase 4 · Catálogo TMDB

### Entregables

- búsqueda e importación desde TMDB;
- caché local;
- fichas de película y persona;
- imágenes;
- corrección manual de matching;
- atribución preparada.

### Puerta de salida

- Importar dos veces no duplica.
- Una coincidencia incorrecta puede corregirse.
- La web funciona con la API temporalmente caída usando datos ya guardados.
- El token no aparece en cliente, logs ni repositorio.

## Fase 5 · Sistema de ingesta

### Entregables

- adaptador común;
- importación manual;
- primeros 2–3 conectores;
- almacenamiento de observaciones originales;
- cola de revisión;
- tareas programadas y logs.

### Puerta de salida

- Repetir una importación no duplica.
- El fallo de una fuente no bloquea las demás.
- Una observación puede rastrearse hasta su URL.
- Los conectores se prueban con fixtures sin acceder a internet.

## Fase 6 · Agregación

### Entregables

- normalización de puntuaciones;
- métricas de consenso;
- variación temporal;
- explicación visible de cálculos;
- pruebas con resultados esperados calculados a mano.

### Puerta de salida

Todos los ejemplos de referencia coinciden y cualquier cifra agregada puede
reproducirse desde sus observaciones.

## Fase 7 · Snapshots y evaluación

### Entregables

- snapshots periódicos;
- cierres de nominaciones y ganadores;
- bloqueo e historial de correcciones;
- resultados oficiales;
- métricas de acierto.

### Puerta de salida

Un snapshot bloqueado permanece idéntico tras nuevas importaciones y las métricas
de acierto coinciden con ejemplos manuales.

## Fase 8 · Usuarios

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
