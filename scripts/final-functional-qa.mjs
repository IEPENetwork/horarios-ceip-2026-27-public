#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const schedule = JSON.parse(fs.readFileSync(path.join(root, "src/data/schedule-v2.json"), "utf8"));
const substitutions = JSON.parse(fs.readFileSync(path.join(root, "src/data/substitutions-v2.json"), "utf8"));
const page = fs.readFileSync(path.join(root, "app/page.tsx"), "utf8");
const css = fs.readFileSync(path.join(root, "app/globals.css"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

const priorityFields = [
  "P1 Misma docencia compartida",
  "P2 Apoyo",
  "P3 DC otro grupo",
  "P4 Atención familias",
  "P5 Coordinación/tutoría",
];
const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: Boolean(ok), detail });
const split = (value, absent = []) => String(value || "").split(",").map((name) => name.trim()).filter((name) => name && name !== "—" && !absent.includes(name));
const candidates = (scenario, absent = []) => priorityFields.map((field, index) => ({ priority: index + 1, teachers: split(scenario[field], absent) }));
const scenario = (day, slot, teacher) => substitutions.scenarios.find((row) => row["Día"] === day && row["Franja"] === slot && row["Docente ausente"] === teacher);

check("Navegación con siete vistas", ["groups", "days", "subjects", "teachers", "loads", "substitutions", "print"].every((tab) => page.includes(`tab === \"${tab}\"`)));
check("Sin referencias visibles V1", ![page, css, html].some((source) => ["Borrador operativo", "Organización escolar", "Horario generado mediante restricciones", "Dentro del margen", "· V1"].some((text) => source.includes(text))));
check("Responsive escritorio/tablet/móvil", css.includes("grid-template-columns:240px 1fr") && css.includes("@media(max-width:1100px)") && css.includes("@media(max-width:720px)") && css.includes(".sidebar{display:none}") && css.includes(".mobile-nav{display:flex"));
check("Tablas y matrices desplazables", css.includes(".matrix-wrap{overflow:auto") && css.includes(".load-table") && css.includes("overflow-x:auto"));
check("Impresión sin navegación ni controles", css.includes("@media print") && css.includes(".sidebar,.mobile-nav,.toolbar,.sub-tabs,.print-config,") && css.includes("display:none!important"));
check("Tarjetas sin alturas máximas ni overflow oculto", !/\.(lesson|matrix-card)[^{]*\{[^}]*max-height/.test(css) && !/\.(lesson|matrix-card)[^{]*\{[^}]*overflow:hidden/.test(css));
check("Grupos sin exportación CSV", !page.includes("exportCsv") && !page.includes(">↓ Exportar CSV</button>"));
check("Centro de impresión multipágina", page.includes('navButton("print", "Imprimir"') && page.includes("Generar informe único") && page.includes("PrintGroupReport") && page.includes("PrintTeacherReport") && page.includes("PrintPlanningReport"));
check("Formatos A4/A3, orientación y escala", page.includes('<option>A4</option><option>A3</option>') && page.includes("Vertical") && page.includes("Horizontal") && page.includes("--print-scale") && page.includes("@page { size:"));
check("Ajuste automático sin tarjetas cortadas", page.includes("Ajustar a página") && page.includes("automaticScale") && !page.includes("--print-content-width") && css.includes("width:100%!important") && css.includes("repeat(5,minmax(0,1fr))!important") && css.includes("break-inside:avoid-page") && css.includes("page-break-inside:avoid"));
check("Encabezado integrado en cada informe", !page.includes('className="print-report-cover"') && page.includes('className="print-sheet-head"><img'));
check("Uso optimizado del área imprimible", page.includes('orientation === "landscape" ? .98') && css.includes("min-height:76px!important") && css.includes("--individual-print-scale"));
check("Centro de impresión aprovecha la hoja en horarios de grupo", page.includes('className="print-sheet print-sheet-group"') && css.includes(".print-sheet-group .lesson{height:104px!important;min-height:104px!important") && css.includes(".print-sheet-group .print-sheet-head img{width:48px"));
check("Opciones individuales ocultas hasta imprimir", page.includes("const [expanded, setExpanded]") && page.includes("if (!expanded) return") && page.includes("Imprimir ahora") && page.includes(">Cerrar</button>"));
check("Tarjetas de grupos alineadas", css.includes(".schedule-panel .lesson{height:104px;min-height:104px}") && css.includes(".schedule-panel .lesson.has-absence{height:auto}"));
check("Selección múltiple de informes", page.includes("PrintOptionList") && page.includes("Seleccionar todas") && page.includes("Imprimir / Guardar un único PDF"));
check("Impresión independiente ampliada", ["Imprimir día", "Imprimir asignaturas", "Imprimir cargas", "Imprimir vista de sustituciones", "Imprimir planificación"].every((label) => page.includes(label)) && (page.match(/<PrintOptions/g) || []).length >= 7 && page.includes("individual-print-settings") && css.includes("individual-print-mode"));
check("Planificación imprimible por día o semana", page.includes("Imprimir planificación") && page.includes("Día seleccionado") && page.includes("Semana completa") && page.includes("disabled={!sessions.length}"));
check("Por días sin texto auxiliar de franjas", !page.includes("9 grupos · franjas oficiales"));
check("Docentes usa Apoyo disponible", page.includes('summaryStat("Apoyo disponible", load.support)') && page.includes('replace(/^Apoyo\\b/, "Apoyo disponible")'));
check("Matriz semanal de apoyos disponible", page.includes(">Apoyos disponibles</button>") && page.includes("support-matrix") && css.includes(".support-matrix"));
check("Ausencias puntuales y por periodo", page.includes("Falta puntual del día") && page.includes("Baja por periodo") && page.includes('type="date"'));
check("Historial persistente y exportable", page.includes("ABSENCE_STORAGE_KEY") && page.includes("Historial de ausencias") && page.includes("Exportar historial CSV"));
check("Dashboard y planificación proyectada", page.includes("Dashboard e historial") && page.includes("Sustituciones proyectadas") && page.includes("projectedSessions"));
check("Ausencias visibles en las vistas operativas", page.includes("absence-badge") && page.includes("savedSubstitution") && css.includes(".has-absence"));

const tutorCase = scenario("Lunes", "09:00–10:00", "María Molina");
check("Caso 1: tutor ausente con DC presente", candidates(tutorCase)[0].teachers.includes("Cristina"), "María Molina → P1 Cristina");
const p2Case = scenario("Lunes", "09:00–10:00", "David Miñaro");
check("Caso 2: candidato P2 Apoyo", candidates(p2Case)[0].teachers.length === 0 && candidates(p2Case)[1].teachers.includes("David Almagro"), "David Miñaro → P2 David Almagro");
const escalated = candidates(p2Case, ["David Miñaro", "David Almagro"]);
check("Casos 3 y 7: escalado a P3", escalated[0].teachers.length === 0 && escalated[1].teachers.length === 0 && escalated[2].teachers.length > 0, escalated[2].teachers.join(", "));
const sandra = scenario("Lunes", "09:00–10:00", "Sandra");
const damaris = scenario("Lunes", "09:00–10:00", "Dámaris");
const simultaneous = [sandra, damaris];
check("Caso 4: dos ausencias simultáneas", simultaneous.every(Boolean) && simultaneous.length === 2, "Sandra + Dámaris");
const absentPair = ["Sandra", "Dámaris"];
const topSandra = candidates(sandra, absentPair).find((group) => group.teachers.length)?.teachers || [];
const topDamaris = candidates(damaris, absentPair).find((group) => group.teachers.length)?.teachers || [];
const competition = topSandra.filter((teacher) => topDamaris.includes(teacher));
check("Caso 5: competencia por sustituto detectada", competition.includes("SUPÉRATE"), competition.join(", "));
const assigned = new Set();
let unique = true;
const allSandra = candidates(sandra, absentPair).flatMap((group) => group.teachers);
const allDamaris = candidates(damaris, absentPair).flatMap((group) => group.teachers);
for (const group of [allSandra, allDamaris]) {
  const selected = group.find((teacher) => !assigned.has(teacher));
  if (!selected) unique = false;
  else assigned.add(selected);
}
check("Una persona no cubre dos grupos simultáneamente", unique && assigned.size === 2 && page.includes("disabled={reserved.has(teacher)}"), [...assigned].join(", "));
const dcOnly = scenario("Lunes", "09:00–10:00", "Cristina");
check("Caso 6: ausencia exclusiva de DC", dcOnly["Cobertura obligatoria"] === "No" && page.includes("Grupo atendido por docente principal — reposición de docencia compartida opcional"), dcOnly["Primera respuesta según criterio"]);
const availability = substitutions.slots.find((row) => row.day === "Lunes" && row.slot === "09:00–10:00");
check("Caso 8: disponibilidad por franja P2–P5", ["p2", "p3", "p4", "p5"].every((kind) => Object.values(availability.teachers).some((state) => state.kind === kind)));
check("Recreo sin disponibilidad inventada", substitutions.rules.recess.includes("cuadrante") && page.includes("Vigilancia de recreo pendiente de cuadrante específico"));
check("P6 sin nombres inventados", substitutions.rules.directivo.includes("no presentes") && page.includes("Equipo directivo — consultar disponibilidad"));
check("Orden inalterado P1 → P6", substitutions.priority_policy.map((item) => item.priority).join(",") === "1,2,3,4,5,6");
check("El símbolo — nunca es candidato", substitutions.scenarios.every((row) => candidates(row).every((group) => !group.teachers.includes("—"))) && page.includes('name !== "—"'));

const anomalyDetails = [];
for (const anomaly of schedule.sourceAnomalies) {
  const lesson = schedule.lessons.find((row) => row.group === anomaly.group && row.day === anomaly.day && row.time === anomaly.time && row.subject === anomaly.subject);
  const correct = lesson && lesson.primary === anomaly.teacher && !lesson.shared.includes(anomaly.teacher);
  anomalyDetails.push({ ...anomaly, correct });
}
check("Doce anomalías de 2.º normalizadas", anomalyDetails.length === 12 && anomalyDetails.every((row) => row.correct), `${anomalyDetails.filter((row) => row.correct).length}/12`);

const importantTeachers = ["María Molina", "David Almagro", "Gabriel", "Malu", "SUPÉRATE"];
check("Cargas de docentes clave presentes", importantTeachers.every((teacher) => schedule.teacherLoads[teacher] && Number.isFinite(schedule.teacherLoads[teacher].total)), importantTeachers.map((teacher) => `${teacher}: ${schedule.teacherLoads[teacher].total} min`).join(" · "));
check("Malu conserva su excepción", schedule.complementaryEvents.some((event) => event.teacher === "Malu" && event.schedule.includes("14:00–15:00")) && page.includes("No constituye incidencia"));

const report = {
  generatedAt: new Date().toISOString(),
  passed: results.filter((row) => row.ok).length,
  total: results.length,
  failures: results.filter((row) => !row.ok),
  anomalyDetails,
  results,
};
fs.writeFileSync(path.join(root, "artifacts", "final-functional-qa.json"), `${JSON.stringify(report, null, 2)}\n`);
for (const row of results) console.log(`${row.ok ? "PASS" : "FAIL"} · ${row.name}${row.detail ? ` — ${row.detail}` : ""}`);
console.log(`\n${report.passed}/${report.total} comprobaciones funcionales finales superadas.`);
if (report.failures.length) process.exit(1);
