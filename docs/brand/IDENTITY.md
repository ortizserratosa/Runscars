# Identidad visual Runscars v1

**Estado:** implementación aplicada; tipografías y arquitectura de componentes
registradas como propuesta en D-053.

**Referencia vinculante:**
[`runscars-brand-board-v1.png`](runscars-brand-board-v1.png).

La web traduce el tablero a un sistema digital; no lo incrusta como imagen. La
identidad se construye con SVG, tipografía web, CSS y componentes accesibles.

## Idea central

Runscars combina dos registros: una cabecera editorial de cine y una capa
técnica que demuestra de dónde sale cada dato. El contraste entre serif de gran
escala, etiquetas monoespaciadas, órbitas, marcas de registro y recibos de
fuente expresa «la carrera, con pruebas» sin mezclar señales.

## Paleta

| Token    |     Valor | Uso principal                                   |
| -------- | --------: | ----------------------------------------------- |
| `Paper`  | `#F2EFE6` | fondo y soporte de recibos                      |
| `Ink`    | `#171A17` | texto, keylines y superficies oscuras           |
| `Acid`   | `#DFFF59` | estado vivo, foco, primera posición y acciones  |
| `Violet` | `#7569FF` | énfasis editorial, selección y sombra de acción |
| `Rust`   | `#F06C49` | subrayados y marcas de captura                  |
| `Blue`   | `#85ADFF` | procedencia, cobertura y tercera posición       |
| `Rose`   | `#F4A8BD` | comunidad y segunda posición                    |
| `Moss`   | `#7F9D63` | estado de temporada                             |

Los tonos auxiliares se calculan con `color-mix()` a partir de Paper e Ink; no
introducen otra paleta. Acid e Ink forman el par principal de alto contraste.
Violet no se usa como fondo de texto pequeño en Paper. Las señales mantienen su
semántica: predicciones, recepción atribuida y rankings personales nunca se
promedian ni se presentan como una sola nota. Los colores propios exigidos por
la atribución de Metacritic quedan limitados a su módulo, conforme a D-047.

## Tipografía

- **Bodoni Moda:** titulares, cifras editoriales y wordmark. Su contraste alto
  reproduce el tono de la referencia sin depender de una fuente propietaria.
- **Archivo:** interfaz, texto corrido y controles. Mantiene legibilidad en
  tamaños pequeños y convive con el carácter editorial de Bodoni.
- **IBM Plex Mono:** procedencia, fechas, microetiquetas y datos técnicos.

Las tres familias se cargan mediante `next/font`, quedan autocontenidas por la
compilación y tienen licencia SIL Open Font License. Si la propuesta D-053 no se
acepta, debe conservarse la jerarquía serif/sans/mono y sustituirse únicamente
la familia correspondiente.

## Marca

El monograma parte de una abertura circular de seis palas, la `R` editorial y un
punto Acid. El punto nunca se elimina: distingue la marca y conecta logo,
órbitas y estados vivos.

Variantes disponibles:

- bloqueo principal y compacto en
  [`BrandLogo.tsx`](../../web/src/app/components/BrandLogo.tsx);
- icono de aplicación en [`icon.svg`](../../web/src/app/icon.svg);
- avatar en [`runscars-avatar.svg`](../../web/public/runscars-avatar.svg);
- tarjeta social vectorial y PNG en
  [`runscars-social-v1.svg`](../../web/public/runscars-social-v1.svg) y
  [`runscars-social-v1.png`](../../web/public/runscars-social-v1.png);
- tarjeta social dinámica de quiniela en
  [`opengraph-image.tsx`](../../web/src/app/usuarios/[slug]/[categorySlug]/opengraph-image.tsx).

El bloqueo inverso se reserva para superficies Ink. El compacto se usa en la
cabecera. Ninguna variante debe reconstruirse con una `R` genérica, deformarse,
rotarse o perder el margen mínimo equivalente al diámetro del punto Acid.

## Patrones de interfaz

- **Cabecera y pie:** keylines finas, navegación mono y cierre Acid.
- **Héroes:** titular serif, microetiqueta técnica, órbita parcial y punto Acid.
- **Rankings:** posición, nombre, cobertura y consenso siguen siendo visibles en
  móvil; los tres primeros puestos usan Acid, Rose y Blue.
- **Recibos de fuente:** Paper, borde Ink, leve rotación y metadatos mono. La
  procedencia detallada se abre con `details/summary`.
- **Tarjetas de señal:** crítica atribuida, predicción y comunidad usan celdas
  independientes; no existe una «nota Runscars» combinada.
- **Administración:** formularios densos y tablas conservan la misma jerarquía,
  pero sin decoración que oculte estados, permisos o trazabilidad.

Los componentes y ajustes transversales viven en
[`brand-system.css`](../../web/src/app/brand-system.css), cargado después del
estilo heredado para que la migración sea incremental y verificable.

## Responsive y accesibilidad

- `1440 × 1000` y `390 × 844` son los viewports canónicos de evidencia.
- Los controles interactivos mantienen un área mínima práctica de 44 px en móvil
  y un foco visible Acid/Violet.
- Los medidores exponen `role="progressbar"`, nombre, mínimo, máximo y valor.
- La cobertura de fuentes nunca desaparece por falta de ancho.
- Las órbitas son decorativas; no contienen información necesaria.
- `prefers-reduced-motion` elimina la inclinación decorativa principal.
- La maquetación no genera scroll horizontal en las rutas auditadas.

## Usos incorrectos

- Incrustar el tablero de marca dentro de una página.
- Mezclar los colores de señales para sugerir un promedio inexistente.
- Usar Violet o Rust para párrafos pequeños sin contraste suficiente.
- Convertir las órbitas o marcas de registro en ruido detrás de controles.
- Ocultar cobertura, fecha o procedencia en la adaptación móvil.
- Usar el avatar como sustituto del bloqueo completo cuando hay espacio.

## Regeneración

`npm --workspace web run brand:assets` regenera el PNG social desde el SVG.
`RUNSCARS_CAPTURE_BASE_URL=<url> npm --workspace web run brand:audit` recorre
los estados visuales y actualiza la evidencia de implementación. La receta de
build reproducible y su bandera server-only están en
[`implementation/README.md`](implementation/README.md).
