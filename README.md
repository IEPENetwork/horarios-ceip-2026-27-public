# Horarios CEIP 2026–27

Visualización dinámica de los horarios escolares definitivos V2 por grupos, días, asignaturas y docentes, con cómputo de cargas y motor de sustituciones.

La interfaz conserva la carcasa visual y técnica de V1. Los datos publicados se generan exclusivamente desde las fuentes verificadas V2.

## Datos y comprobaciones

- `src/data/schedule-v2.json`: horarios, cargas, funciones, coordinaciones y excepciones normalizadas desde el Excel V2.
- `src/data/substitutions-v2.json`: estados y 302 escenarios del motor de sustituciones.
- `scripts/extract-v2-data.py`: generador reproducible desde las fuentes locales V2.
- `scripts/validate-v2.mjs`: matriz automática de 20 comprobaciones.

## Gestión dinámica de ausencias

El módulo **Sustituciones** permite:

- registrar faltas puntuales y bajas por periodo;
- asignar sustitutos respetando P1 → P6 y evitando duplicidades por franja;
- consultar los apoyos disponibles en una matriz semanal;
- proyectar coberturas por día o semana;
- revisar el dashboard y exportar el historial en CSV;
- señalar ausencias y sustituciones en las vistas de grupos, días, asignaturas, docentes y cargas.

GitHub Pages es un alojamiento estático. Por ello, el registro operativo se conserva en `localStorage`, dentro del navegador y dispositivo utilizados. No se sincroniza entre usuarios o equipos. Para un registro centralizado multiusuario será necesario incorporar un backend y control de acceso.

Comandos:

```bash
npm run data:v2
npm run build
npm test
```

## Publicación

El sitio se publica automáticamente mediante GitHub Pages cuando se actualiza la rama `main`.
