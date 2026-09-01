# Horarios CEIP 2026–27

Visualización dinámica del horario final por grupos, días, asignaturas y docentes, con cómputo de cargas y motor de sustituciones.

La V1 validada es la base operativa. El changeset final se aplica de forma incremental y reproducible, sin reconstruir la interfaz ni reoptimizar horarios no afectados.

## Datos y comprobaciones

- `src/data/schedule-v2.json`: horarios, cargas, funciones, coordinaciones, excepciones y línea base curricular.
- `src/data/substitutions-v2.json`: estados y 297 escenarios finales del motor de sustituciones.
- `scripts/apply-final-validated-changeset.mjs`: transformación reproducible del changeset aprobado.
- `scripts/validate-v2.mjs`: matriz automática de 20 comprobaciones de integridad.
- `scripts/final-functional-qa.mjs`: 40 comprobaciones funcionales y de interfaz.

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
npm run data:final
npm run build
npm run validate:v2
npm run qa:final
```

## Publicación

El sitio se publica automáticamente mediante GitHub Pages cuando se actualiza la rama `main`.
