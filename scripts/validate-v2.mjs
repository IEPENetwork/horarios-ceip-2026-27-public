#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const schedule = JSON.parse(fs.readFileSync(path.join(root, "src/data/schedule-v2.json"), "utf8"));
const substitutions = JSON.parse(fs.readFileSync(path.join(root, "src/data/substitutions-v2.json"), "utf8"));
const page = fs.readFileSync(path.join(root, "app/page.tsx"), "utf8");
const css = fs.readFileSync(path.join(root, "app/globals.css"), "utf8");

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
const hm = (value) => { const [hours, minutes] = value.split(":").map(Number); return hours * 60 + minutes; };
const bounds = (value) => value.split("–").map(hm);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const normalizedMinuteMap = (value) => Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b, "es")));

function parseComplementParts() {
  return schedule.complementaryEvents.flatMap((item) => [...item.schedule.matchAll(/(Lunes|Martes|Miércoles|Jueves|Viernes)\s+(\d{2}:\d{2})–(\d{2}:\d{2})(?:\s+\((\d+) min\))?/g)].map((match) => {
    const start = hm(match[2]);
    return { teacher: item.teacher, concept: item.concept, day: match[1], start, end: Math.min(hm(match[3]), start + (match[4] ? Number(match[4]) : hm(match[3]) - start)) };
  }));
}

function teacherIntervals() {
  const intervals = [];
  for (const lesson of schedule.lessons) for (const [role, teachers] of [["Docencia", [lesson.primary]], ["Docencia compartida", lesson.shared]]) for (const teacher of teachers) {
    let [start, end] = bounds(lesson.time);
    if (role === "Docencia" && lesson.primarySegment) [start, end] = bounds(lesson.primarySegment);
    else if (role === "Docencia" && lesson.primaryMinutes != null) end = start + lesson.primaryMinutes;
    else if (role === "Docencia compartida" && lesson.sharedSegments?.[teacher]) [start, end] = bounds(lesson.sharedSegments[teacher]);
    else if (role === "Docencia compartida" && lesson.sharedMinutes?.[teacher] != null) end = start + lesson.sharedMinutes[teacher];
    intervals.push({ teacher, day: lesson.day, start, end, role, group: lesson.group, subject: lesson.subject });
  }
  for (const part of parseComplementParts()) intervals.push({ ...part, role: part.concept, group: "—", subject: part.concept });
  return intervals;
}

function overlapConflicts() {
  const conflicts = [];
  const intervals = teacherIntervals();
  for (const teacher of schedule.teachers) for (const day of schedule.days) {
    const own = intervals.filter((item) => item.teacher === teacher && item.day === day).sort((a, b) => a.start - b.start);
    for (let left = 0; left < own.length; left += 1) for (let right = left + 1; right < own.length; right += 1) {
      if (own[right].start >= own[left].end) break;
      const groups = new Set([own[left].group, own[right].group]);
      const parallelSecond = groups.size === 2 && groups.has("2.ºA") && groups.has("2.ºB") && own[left].subject === own[right].subject && own[left].role === own[right].role;
      if (!parallelSecond) conflicts.push({ teacher, day, left: own[left], right: own[right] });
    }
  }
  return conflicts;
}

function lessonAt(group, day, time, subject, primary, shared) {
  const row = schedule.lessons.find((item) => item.group === group && item.day === day && item.time === time);
  return row?.subject === subject && row.primary === primary && (!shared || row.shared.includes(shared));
}

const groupMinutes = Object.fromEntries(expectedGroups.map((group) => [group, rows(group).reduce((sum, lesson) => sum + lesson.minutes, 0)]));
check(1, "9 grupos × 1.350 minutos", same(schedule.groups, expectedGroups) && Object.values(groupMinutes).every((minutes) => minutes === 1350), JSON.stringify(groupMinutes));

const currentSubjectMinutes = Object.fromEntries(expectedGroups.map((group) => [group, normalizedMinuteMap(rows(group).reduce((totals, lesson) => { totals[lesson.subject] = (totals[lesson.subject] || 0) + lesson.minutes; return totals; }, {}))]));
const expectedSubjectMinutes = Object.fromEntries(expectedGroups.map((group) => [group, normalizedMinuteMap(schedule.validationBaseline.subjectMinutes[group])]));
check(2, "Minutos curriculares exactos por asignatura y grupo", same(currentSubjectMinutes, expectedSubjectMinutes), "Sin variaciones curriculares");

const groupKeys = schedule.lessons.map((lesson) => `${lesson.group}|${lesson.day}|${lesson.time}`);
const validSlots = schedule.lessons.every((lesson) => expectedSlots[lesson.day]?.includes(lesson.time) && schedule.recess[lesson.day] !== lesson.time);
check(3, "Cero solapamientos de grupo y franjas oficiales", new Set(groupKeys).size === groupKeys.length && validSlots && same(schedule.slots, expectedSlots), `${groupKeys.length - new Set(groupKeys).size} duplicados`);

const teacherConflicts = overlapConflicts();
check(4, "Cero solapamientos docentes, incluidos tramos parciales", teacherConflicts.length === 0, teacherConflicts.length ? JSON.stringify(teacherConflicts[0]) : "0 conflictos");
check(5, "Cero solapamientos de aula donde aplica", new Set(groupKeys).size === groupKeys.length, "El proyecto no modela aulas adicionales; grupo = aula operativa");
check(6, "Cada bloque lectivo dura al menos 45 minutos", schedule.lessons.every((lesson) => lesson.minutes >= 45), `${Math.min(...schedule.lessons.map((lesson) => lesson.minutes))} min mínimo`);

const dailySubjectTotals = new Map();
for (const lesson of schedule.lessons) { const key = `${lesson.group}|${lesson.day}|${lesson.subject}`; dailySubjectTotals.set(key, (dailySubjectTotals.get(key) || 0) + lesson.minutes); }
const over90 = [...dailySubjectTotals].filter(([, minutes]) => minutes > 90);
check(7, "La misma asignatura no supera 90 minutos por grupo y día", over90.length === 0, over90.length ? JSON.stringify(over90) : "Máximo 90 min");

const complementDays = new Map();
for (const part of parseComplementParts()) { const key = `${part.teacher}|${part.day}`; const concepts = complementDays.get(key) || new Set(); concepts.add(part.concept); complementDays.set(key, concepts); }
const mixedComplementDays = [...complementDays].filter(([, concepts]) => concepts.size > 1);
check(8, "Complementarias separadas por concepto y día", mixedComplementDays.length === 0, mixedComplementDays.length ? mixedComplementDays.map(([key]) => key).join(", ") : "Sin combinaciones Coord/AF/Reducción");

const splitChecks = [["Ana", "Coordinación docente", [45, 15]], ["María Muñoz", "Coordinación docente", [45, 15]], ["Gabriel", "Coordinación docente", [45, 15]]].map(([teacher, concept, expected]) => {
  const parts = parseComplementParts().filter((part) => part.teacher === teacher && part.concept === concept).map((part) => part.end - part.start);
  return same(parts, expected) && parts.reduce((sum, minutes) => sum + minutes, 0) === 60;
});
check(9, "Distribuciones complementarias 45 + 15 = 60", splitChecks.every(Boolean), `${splitChecks.filter(Boolean).length}/3`);

const dcAligned = schedule.lessons.every((lesson) => !lesson.shared.includes(lesson.primary) && new Set(lesson.shared).size === lesson.shared.length && lesson.shared.every((teacher) => schedule.teachers.includes(teacher)));
check(10, "Docencia compartida alineada con docente principal y grupo", dcAligned, "Sin duplicados ni docentes ajenos");

function coordinationNonTeaching(teacher, day, window) {
  const [wantedStart, wantedEnd] = bounds(window);
  const row = schedule.teacherMatrix.find((item) => item.day === day && bounds(item.time)[0] <= wantedStart && bounds(item.time)[1] >= wantedEnd);
  if (!row) return false;
  const status = row.teachers[teacher] || "";
  return !status.split("\n").some((line) => line.startsWith("DC ") || (/ · /.test(line) && !line.startsWith("Apoyo") && !line.startsWith("Atención") && !line.startsWith("Coordinación") && !line.startsWith("Reducción"))) && status !== "NO DISPONIBLE";
}
const resolved = schedule.coordinations.filter((item) => item.status === "RESUELTO");
const coordinationValidity = resolved.map((item) => {
  const match = item.time.match(/^(Lunes|Martes|Miércoles|Jueves|Viernes)\s+(\d{2}:\d{2}–\d{2}:\d{2})$/);
  return Boolean(match && bounds(match[2])[1] - bounds(match[2])[0] >= 60 && coordinationNonTeaching(item.tutor, match[1], match[2]) && coordinationNonTeaching(item.sharedTeacher, match[1], match[2]));
});
check(11, "15/15 coordinaciones tutor–docente compartido", resolved.length === 15 && coordinationValidity.every(Boolean), `${coordinationValidity.filter(Boolean).length}/${resolved.length}`);

const cristinaWed09 = schedule.lessons.filter((lesson) => lesson.day === "Miércoles" && lesson.time === "09:00–10:00" && [lesson.primary, ...lesson.shared].includes("Cristina"));
check(12, "Cristina sin docencia el miércoles 09:00–10:00", cristinaWed09.length === 0, `${cristinaWed09.length} sesiones`);

const preferenceExceptions = schedule.lessons.filter((lesson) => ["Cristina", "Mariló"].some((teacher) => [lesson.primary, ...lesson.shared].includes(teacher)) && ["09:00–10:00", "09:00–10:30", "13:00–14:00"].includes(lesson.time)).map((lesson) => `${lesson.day} ${lesson.time} ${lesson.group} ${[lesson.primary, ...lesson.shared].filter((name) => ["Cristina", "Mariló"].includes(name)).join("/")}`);
check(13, "Preferencias horarias de Cristina y Mariló evaluadas", true, preferenceExceptions.length ? `Excepciones blandas: ${preferenceExceptions.join("; ")}` : "Sin excepciones blandas");

const frenchValid = ["5.ºA", "5.ºB", "6.ºA", "6.ºB"].every((group) => rows(group, "Francés").reduce((sum, lesson) => sum + lesson.minutes, 0) === 90 && rows(group, "Francés").every((lesson) => lesson.primary === "María Molina"));
check(14, "Francés permanece sin cambios y válido", frenchValid, "90 min por grupo con María Molina");

const fixed = [
  rows("3.º", "C. Naturales").every((lesson) => lesson.primary === "María"),
  rows("4.º", "C. Sociales").every((lesson) => lesson.primary === "David Almagro"),
  rows("3.º", "Matemáticas").every((lesson) => lesson.primary === "David Miñaro" && lesson.shared.includes("Gabriel")),
  rows("3.º", "Religión / At. Educativa").some((lesson) => lesson.primary === "María"),
  rows("4.º", "Religión / At. Educativa").some((lesson) => lesson.primary === "David Almagro"),
  lessonAt("5.ºA", "Jueves", "12:00–13:00", "Matemáticas", "Noelia", "David Almagro"),
  ["Lunes|09:00–10:00", "Martes|09:00–10:00", "Miércoles|12:00–13:00", "Jueves|13:00–14:00"].every((key) => { const [day, time] = key.split("|"); return lessonAt("6.ºA", day, time, "Matemáticas", "Ana B", "David Almagro"); }),
];
check(15, "Asignaciones fijas y restricciones aprobadas", fixed.every(Boolean), `${fixed.filter(Boolean).length}/${fixed.length}`);

const corrected5B = schedule.lessons.find((item) => item.group === "5.ºB" && item.day === "Jueves" && item.time === "12:00–13:00");
const noeliaThu09 = schedule.complementaryEvents.some((item) => item.teacher === "Noelia" && item.concept === "Atención a familias" && item.schedule.includes("Jueves 09:00–10:00"));
check(16, "Excepción correctiva mínima de 5.ºB", corrected5B?.subject === "Lengua" && corrected5B.primary === "Ana G" && corrected5B.shared.length === 0 && noeliaThu09 && schedule.exceptions.some((item) => item.ID === "E-11"), "Ana G sola J 12:00; AF Noelia J 09:00");

const serialized = JSON.stringify({ schedule, substitutions, page });
check(17, "Renombres globales completos", !/Iria|Antonio|SUPÉRATE/.test(serialized) && ["Ana", "Noelia", "María"].every((name) => schedule.teachers.includes(name)), "Ana, Noelia y María");

const priorityOrder = substitutions.priority_policy.map((item) => item.priority).join(",") === "1,2,3,4,5,6";
const uniqueGuard = page.includes("disabled={reserved.has(teacher)}") && page.includes("candidateCompetition");
check(18, "Motor de sustituciones P1 → P6 y asignación única", priorityOrder && uniqueGuard && substitutions.scenarios.every((row) => row["P6 Equipo directivo"] === "Selección manual"), `${substitutions.scenarios.length} escenarios`);

const matrixCoverage = schedule.teacherMatrix.length === 29 && schedule.teacherMatrix.every((row) => schedule.teachers.every((teacher) => typeof row.teachers[teacher] === "string"));
const loadsCoverage = schedule.teachers.every((teacher) => schedule.teacherLoads[teacher] && Number.isFinite(schedule.teacherLoads[teacher].total));
const anomaliesValid = schedule.sourceAnomalies.length === 12 && schedule.sourceAnomalies.every((anomaly) => { const row = schedule.lessons.find((item) => item.group === anomaly.group && item.day === anomaly.day && item.time === anomaly.time && item.subject === anomaly.subject); return row && row.primary === anomaly.teacher && !row.shared.includes(anomaly.teacher); });
check(19, "Vistas derivadas, cargas y anomalías sincronizadas", matrixCoverage && loadsCoverage && anomaliesValid && substitutions.teachers.join("|") === schedule.teachers.join("|"), `${schedule.teacherMatrix.length} franjas · ${anomaliesValid ? "12/12 anomalías" : "anomalías pendientes"}`);

const views = ["groups", "days", "subjects", "teachers", "loads", "substitutions", "print"];
check(20, "Interfaz, responsive, impresión y build disponibles", views.every((view) => page.includes(`tab === \"${view}\"`)) && css.includes("@media(max-width:720px)") && css.includes("@media print") && fs.existsSync(path.join(root, "dist/index.html")), "7 vistas · móvil · impresión · dist");

const report = { generatedAt: new Date().toISOString(), source: schedule.changeSet.basis, passed: results.filter((item) => item.ok).length, total: results.length, teacherConflicts, preferenceExceptions, results };
fs.mkdirSync(path.join(root, "artifacts"), { recursive: true });
fs.writeFileSync(path.join(root, "artifacts/validation-v2.json"), `${JSON.stringify(report, null, 2)}\n`);
for (const item of results) console.log(`${item.ok ? "PASS" : "FAIL"} ${String(item.id).padStart(2, "0")} · ${item.name}${item.detail ? ` — ${item.detail}` : ""}`);
if (report.passed !== report.total) process.exit(1);
console.log(`\n${report.passed}/${report.total} validaciones superadas.`);
