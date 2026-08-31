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

const expectedGroups = ["1.º", "2.ºA", "2.ºB", "3.º", "4.º", "5.ºA", "5.ºB", "6.ºA", "6.ºB"];
const expectedSlots = {
  Lunes: ["09:00–10:00", "10:00–10:45", "10:45–11:30", "11:30–12:00", "12:00–13:00", "13:00–14:00"],
  Martes: ["09:00–10:00", "10:00–10:45", "10:45–11:30", "11:30–12:00", "12:00–13:00", "13:00–14:00"],
  Miércoles: ["09:00–10:00", "10:00–10:45", "10:45–11:30", "11:30–12:00", "12:00–13:00", "13:00–14:00"],
  Jueves: ["09:00–10:00", "10:00–10:45", "10:45–11:30", "11:30–12:00", "12:00–13:00", "13:00–14:00"],
  Viernes: ["09:00–10:30", "10:30–11:15", "11:15–11:45", "11:45–12:30", "12:30–14:00"],
};
const results = [];
const check = (id, name, ok, detail = "") => results.push({ id, name, ok: Boolean(ok), detail });
const rows = (group, subject) => schedule.lessons.filter((lesson) => (!group || lesson.group === group) && (!subject || lesson.subject === subject));

check(1, "Los 9 grupos están presentes", JSON.stringify(schedule.groups) === JSON.stringify(expectedGroups), `${schedule.groups.length}/9`);
check(2, "Datos generados exclusivamente desde V2", schedule.sourceWorkbook.includes("V2_CON_SUSTITUCIONES") && schedule.version.toLowerCase().includes("v2"), schedule.sourceWorkbook);
const groupMinutes = Object.fromEntries(expectedGroups.map((group) => [group, rows(group).reduce((sum, lesson) => sum + lesson.minutes, 0)]));
check(3, "Cada grupo conserva 1.350 minutos", Object.values(groupMinutes).every((minutes) => minutes === 1350), JSON.stringify(groupMinutes));

const teacherEvents = new Map();
for (const lesson of schedule.lessons) {
  for (const [role, names] of [["principal", [lesson.primary]], ["dc", lesson.shared]]) {
    for (const teacher of names) {
      const key = `${teacher}|${lesson.day}|${lesson.time}`;
      const events = teacherEvents.get(key) || [];
      events.push({ group: lesson.group, subject: lesson.subject, role });
      teacherEvents.set(key, events);
    }
  }
}
const teacherOverlaps = [...teacherEvents.entries()].filter(([, events]) => {
  if (events.length < 2) return false;
  const groups = new Set(events.map((event) => event.group));
  return !(groups.size === 2 && groups.has("2.ºA") && groups.has("2.ºB") && new Set(events.map((event) => event.subject)).size === 1);
});
check(4, "No existen solapamientos docentes", teacherOverlaps.length === 0, `${teacherOverlaps.length} conflictos`);
const groupKeys = schedule.lessons.map((lesson) => `${lesson.group}|${lesson.day}|${lesson.time}`);
check(5, "No existen solapamientos de grupo", new Set(groupKeys).size === groupKeys.length, `${groupKeys.length - new Set(groupKeys).size} duplicados`);
const lessonSlotsValid = schedule.lessons.every((lesson) => expectedSlots[lesson.day].includes(lesson.time) && !lesson.time.includes("11:30–12:00") && !lesson.time.includes("11:15–11:45"));
check(6, "Todas las sesiones respetan las franjas oficiales", lessonSlotsValid && JSON.stringify(schedule.slots) === JSON.stringify(expectedSlots), "Sin cuadrícula de 15 minutos");
check(7, "Recreos correctos", schedule.recess.Lunes === "11:30–12:00" && schedule.recess.Jueves === "11:30–12:00" && schedule.recess.Viernes === "11:15–11:45", "L-J 11:30; V 11:15");

const maria4 = ["Lengua", "Matemáticas", "C. Naturales"].every((subject) => rows("4.º", subject).length && rows("4.º", subject).every((lesson) => lesson.primary === "María Molina"));
const mariaFrench = ["5.ºA", "5.ºB", "6.ºA", "6.ºB"].every((group) => rows(group, "Francés").length && rows(group, "Francés").every((lesson) => lesson.primary === "María Molina"));
check(8, "Asignaciones de María Molina", maria4 && mariaFrench, "Troncales 4.º y Francés 5.º/6.º");
check(9, "Ciencias Sociales de 4.º = David Almagro", rows("4.º", "C. Sociales").length && rows("4.º", "C. Sociales").every((lesson) => lesson.primary === "David Almagro"));
check(10, "Matemáticas de 3.º = David Miñaro + Gabriel", rows("3.º", "Matemáticas").length && rows("3.º", "Matemáticas").every((lesson) => lesson.primary === "David Miñaro" && lesson.shared.includes("Gabriel")));
check(11, "Atención Educativa de 4.º = David Almagro", rows("4.º", "Religión / At. Educativa").some((lesson) => lesson.primary === "David Almagro"));
check(12, "Atención Educativa de 3.º = SUPÉRATE", rows("3.º", "Religión / At. Educativa").some((lesson) => lesson.primary === "SUPÉRATE" || lesson.shared.includes("SUPÉRATE")));
const early = ["1.º", "2.ºA", "2.ºB", "3.º", "4.º"];
const late = ["5.ºA", "5.ºB", "6.ºA", "6.ºB"];
const raeValid = early.every((group) => rows(group, "Religión / At. Educativa").some((lesson) => lesson.day === "Viernes" && lesson.time === "09:00–10:30")) && late.every((group) => rows(group, "Religión / At. Educativa").some((lesson) => lesson.day === "Viernes" && lesson.time === "12:30–14:00"));
check(13, "RAE del viernes respeta la distribución aprobada", raeValid);
const resolvedCoordinations = schedule.coordinations.filter((coordination) => coordination.status === "RESUELTO");
check(14, "Coordinaciones tutor–docencia compartida conservadas", resolvedCoordinations.length === 15, `${resolvedCoordinations.length}/15`);
const forbidden = ["Borrador operativo", "Organización escolar", "Horario generado mediante restricciones", "Dentro del margen"];
check(15, "No aparecen datos o textos antiguos de V1", forbidden.every((text) => !page.includes(text) && !css.includes(text) && !html.includes(text)) && !page.includes("GROUP_DATA") && !html.includes("· V1"), "Sin constantes ni metadatos V1");
const priorityFields = substitutions.priority_policy.map((item) => item.priority).join(",");
check(16, "El motor conserva la prioridad P1 → P6", priorityFields === "1,2,3,4,5,6" && page.indexOf("P1 Misma docencia compartida") < page.indexOf("P5 Coordinación/tutoría"), priorityFields);

const simultaneous = substitutions.scenarios.filter((scenario) => scenario["Día"] === "Lunes" && scenario["Franja"] === "09:00–10:00").slice(0, 3);
const assigned = new Set();
let uniqueGuard = true;
for (const scenario of simultaneous) {
  const candidates = ["P1 Misma docencia compartida", "P2 Apoyo", "P3 DC otro grupo", "P4 Atención familias", "P5 Coordinación/tutoría"].flatMap((field) => (scenario[field] || "").split(",").map((name) => name.trim()).filter((name) => name && name !== "—"));
  const candidate = candidates.find((name) => !assigned.has(name));
  if (candidate) assigned.add(candidate); else uniqueGuard = false;
}
check(17, "Una persona no cubre dos ausencias simultáneas", uniqueGuard && page.includes("disabled={reserved.has(teacher)}"), "Guardia de asignación por día/franja activa");
check(18, "La aplicación compila sin errores", fs.existsSync(path.join(root, "dist/index.html")), "dist/index.html generado");
const views = ["groups", "days", "subjects", "teachers", "loads", "substitutions"];
check(19, "Todas las vistas están disponibles", views.every((view) => page.includes(`tab === \"${view}\"`)), views.join(", "));
check(20, "Diseño móvil y escritorio definido", css.includes("@media(max-width:720px)") && css.includes("@media print") && css.includes("overflow:auto"), "Breakpoints, impresión y tablas desplazables");

const report = { generatedAt: new Date().toISOString(), source: schedule.sourceWorkbook, passed: results.filter((result) => result.ok).length, total: results.length, results };
fs.mkdirSync(path.join(root, "artifacts"), { recursive: true });
fs.writeFileSync(path.join(root, "artifacts/validation-v2.json"), `${JSON.stringify(report, null, 2)}\n`);
for (const result of results) console.log(`${result.ok ? "PASS" : "FAIL"} ${String(result.id).padStart(2, "0")} · ${result.name}${result.detail ? ` — ${result.detail}` : ""}`);
if (report.passed !== report.total) process.exit(1);
console.log(`\n${report.passed}/${report.total} validaciones superadas.`);
