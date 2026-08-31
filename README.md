# Horarios CEIP 2026–27

Visualización dinámica de los horarios escolares definitivos V2 por grupos, días, asignaturas y docentes, con cómputo de cargas y motor de sustituciones.

La interfaz conserva la carcasa visual y técnica de V1. Los datos publicados se generan exclusivamente desde las fuentes verificadas V2.

## Datos y comprobaciones

- `src/data/schedule-v2.json`: horarios, cargas, funciones, coordinaciones y excepciones normalizadas desde el Excel V2.
- `src/data/substitutions-v2.json`: estados y 302 escenarios del motor de sustituciones.
- `scripts/extract-v2-data.py`: generador reproducible desde las fuentes locales V2.
- `scripts/validate-v2.mjs`: matriz automática de 20 comprobaciones.

Comandos:

```bash
npm run data:v2
npm run build
npm test
```

## Publicación

El sitio se publica automáticamente mediante GitHub Pages cuando se actualiza la rama `main`.
