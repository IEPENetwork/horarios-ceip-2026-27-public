# Horarios CEIP 2026–27

Visualización dinámica de los horarios de Educación Infantil y Educación Primaria por grupos, días, asignaturas y docentes, con cómputo de cargas y motor de sustituciones independiente por etapa.

La V1 validada es la base operativa. El changeset final se aplica de forma incremental y reproducible, sin reconstruir la interfaz ni reoptimizar horarios no afectados.

## Datos y comprobaciones

- `src/data/schedule-v2.json`: horarios, cargas, funciones, coordinaciones, excepciones y línea base curricular.
- `src/data/substitutions-v2.json`: estados y 299 escenarios finales del motor de sustituciones.
- `src/data/schedule-infantil.json`: horario consolidado de 3, 4 y 5 años, cargas y funciones docentes.
- `src/data/substitutions-infantil.json`: estados y escenarios de cobertura específicos de Infantil.
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

GitHub Pages es un alojamiento estático. Por ello, el registro operativo se conserva en `localStorage`, dentro del navegador y dispositivo utilizados, con historiales separados para Infantil y Primaria. No se sincroniza entre usuarios o equipos. Para un registro centralizado multiusuario será necesario incorporar un backend y control de acceso.

Comandos:

```bash
npm run build
```

La portada permite elegir etapa. También se puede enlazar directamente mediante `?etapa=infantil` o `?etapa=primaria`.

## Publicación

El sitio se publica automáticamente mediante GitHub Pages cuando se actualiza la rama `main`.
