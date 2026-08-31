# Informe de migración · Horarios CEIP V2

## Diagnóstico V1

- Aplicación SPA React + TypeScript + Vite.
- Una sola superficie de navegación por estado, sin rutas de servidor.
- Horarios V1 codificados manualmente en `app/page.tsx`.
- Estilos y responsive concentrados en `app/globals.css`.
- GitHub Pages publica únicamente desde `main` mediante `.github/workflows/pages.yml`.
- La rama `main` no se ha modificado, fusionado ni publicado durante la migración.

## Mapa V1 → V2

| Elemento | V1 | V2 migrada |
|---|---|---|
| Horarios | Constantes manuales en `app/page.tsx` | `src/data/schedule-v2.json`, generado desde el Excel maestro |
| Docentes y cargas | Cálculo aproximado en cliente | Cómputo por función y franja oficial desde V2 |
| Segunda persona en aula | Etiqueta ambigua | `Docencia compartida` |
| Apoyo | Uso ambiguo | Solo hueco residual disponible |
| Sustituciones | No existía | `src/data/substitutions-v2.json` + interfaz P1 → P6 |
| Validación | Controles visuales antiguos | 20 comprobaciones automáticas reproducibles |

## Implementación

- Se conservan el stack, la navegación lateral, la cabecera, el sistema cromático, la impresión y la adaptación responsive.
- Se sustituyen por completo las constantes de horario V1.
- Grupos, días, asignaturas, docentes y cargas consumen exclusivamente los datos normalizados V2.
- Se añade selección múltiple de ausencias, prioridad P1 → P6, detección de competencia y bloqueo de doble asignación por franja.
- Se añade la vista de disponibilidad por franja y el tratamiento específico de recreos, equipo directivo y ausencia exclusiva de docencia compartida.
- Las fuentes originales quedan fuera del repositorio público; solo se versionan los datos necesarios para ejecutar el site.

## Anomalía de origen documentada

El Excel contiene 12 celdas de 2.º en las que un especialista aparece simultáneamente como docente principal y como segunda persona en la misma sesión. El JSON de sustituciones clasifica esas mismas sesiones como docencia directa. Para evitar un falso solapamiento y un doble cómputo, el extractor conserva la sesión y representa a la persona una sola vez como docente principal. Las 12 filas quedan enumeradas en `sourceAnomalies` dentro de `src/data/schedule-v2.json`.

No se ha cambiado ninguna asignatura, grupo, franja ni docente asignado.

## Resultado técnico

- Extracción: 216 sesiones, 19 docentes y 302 escenarios.
- Compilación TypeScript/Vite: correcta.
- Matriz automática: 20/20 comprobaciones superadas.
- Artefacto de detalle: `artifacts/validation-v2.json`.
- Batería funcional final: 21/21 comprobaciones superadas, incluidos los ocho casos de sustitución y las 12 anomalías de 2.º.
- Correcciones finales: el símbolo `—` ya no se interpreta como candidato y los metadatos HTML ya identifican la V2.
- Advertencia no bloqueante: el paquete JavaScript supera por poco el umbral informativo de 500 kB antes de gzip; el archivo comprimido ronda 81 kB.

## Estado de publicación

- Rama local: `codex/migracion-v2-final`.
- `main`: intacta.
- Commit final: no creado.
- Push: no realizado.
- Merge: no realizado.
- GitHub Pages: no modificado.

La revisión por píxeles no pudo producir capturas porque la previsualización aislada no fue accesible desde el navegador de revisión y el entorno local no dispone de un ejecutable de navegador. Se completaron en su lugar comprobaciones estructurales específicas de escritorio, tablet, móvil, desbordamientos, selectores, tarjetas e impresión, además de la batería funcional completa.

La rama queda lista para publicación cuando se reciba la orden expresa `PUBLICAR`.
