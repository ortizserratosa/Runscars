# Cortes profesionales comparables · 2026-09-15

## Motivo y corrección

La selección de Mejor película de The Ringer se publicó el 20/03/2026. Los
snapshots v2 de julio y agosto aún le atribuían cobertura, aunque ya había
superado los 30 días de frescura antes del primer corte público. La vista actual
proyecta cada corte v2 con la regla v3 en la **fecha de ese corte**. Recalcula
fuentes aplicables, cobertura, Borda, posiciones y movimientos desde la misma
serie; no impone una exclusión permanente a The Ringer. Las envolventes
bloqueadas, los hashes y las observaciones originales no se modificaron. La
política queda registrada en [D-061](../../DECISIONS.md).

La comprobación de solo lectura sobre la copia de ese día encontró 155 snapshots
periódicos (138 v2, 17 v3). Las 21 listas v2 de The Ringer estaban vencidas en
su propia fecha de corte. La misma regla detectó otras listas v2 vencidas: 48 de
Midnight Critics Circle, 8 de Awards Radar y 6 de AwardsWatch. Las fuentes v2
sin fecha de publicación referían 810 observaciones distintas; todas tenían
fecha de captura y eran legibles por la política pública de RLS. Esta evidencia
permitió comparar los cortes bloqueados v2 y v3 con la misma regla sin inventar
fechas. Una futura lectura incompleta conserva el voto y pausa los movimientos
afectados.

## Verificación y publicación

- `npm run format`, `npm run lint`, `npm run typecheck`: correctos.
- `npm test`: 178 pruebas unitarias correctas; `npm run test:db`: 22 pruebas
  correctas.
- `npm run build` con las claves públicas de Supabase vacías: correcto. La
  primera compilación local intentó acceder al Supabase de `.env.local`
  (`127.0.0.1:54321`), inaccesible en este sandbox; Vercel compiló con su
  configuración de producción y datos reales sin ese error.
- `npm run audit`: cero vulnerabilidades; `npm run test:e2e`: 124 pruebas
  correctas en Chrome de escritorio y móvil, Firefox y WebKit. La revisión con
  navegador local cargó Mejor película y portada sin overlay de Next.js.
- CI de GitHub del commit `2ee98068809f229a9cb820e4ac577f465b048720`: correcta.

El commit de código y metodología `2ee9806` se desplegó como
`dpl_63pyNtuiovsSkc6W5e1myXPJmyNK` en el
[artefacto verificado](https://runscars-jd8a7xbfb-nazzozzo-s-projects.vercel.app)
y se promovió a [runscars.app](https://runscars.app). No hubo migraciones,
funciones, importaciones ni cambios de datos en este release.

En el artefacto y luego en el dominio canónico, el corte real de Mejor película
del 25/07 muestra tres medios elegibles, la etiqueta de recálculo histórico y
ninguna contribución de The Ringer. Los cortes del 08/09 (v2 proyectado) y 09/09
(v3 bloqueado) muestran cuatro medios y movimientos frente al corte anterior; no
muestran un falso cambio de método. Health y base de datos, portada, categoría
ES/EN, película, acceso, Comunidad, quiniela, semana, festivales ES/EN, robots,
sitemap y tarjeta social respondieron HTTP 200 en el dominio canónico. La
consulta de logs de Vercel por nivel `error` del deployment no devolvió
entradas.

`npm run audit:production` recorrió 3.832 URLs públicas, incluidas 3.568 del
sitemap, con cero fallos de ruta, canonical o renderizado. Los seis extractores
profesionales respondieron correctamente, incluido el conector de The Ringer,
que sigue comprobando la fuente; Kalshi validó 91 contratos y Polymarket 132. La
única advertencia fue la ausencia de credencial de servidor en el proceso local
para consultar la frescura interna de cron. No se modificaron los cron,
funciones ni schedules en este release.
