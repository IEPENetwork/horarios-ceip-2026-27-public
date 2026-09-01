#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const schedulePath = path.join(root, "src/data/schedule-v2.json");
const substitutionsPath = path.join(root, "src/data/substitutions-v2.json");
const schedule = JSON.parse(fs.readFileSync(schedulePath, "utf8"));
const previousSubstitutions = JSON.parse(fs.readFileSync(substitutionsPath, "utf8"));

const RENAMES = { Iria: "Ana", Antonio: "Noelia", "SUPÉRATE": "María" };
const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];
const CONCEPTS = ["Atención a familias", "Coordinación docente", "Reducción por tutoría"];

function renameString(value) {
  let result = value;
  for (const [before, after] of Object.entries(RENAMES)) result = result.replaceAll(before, after);
  return result;
}

function renameDeep(value) {
  if (typeof value === "string") return renameString(value);
  if (Array.isArray(value)) return value.map(renameDeep);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [RENAMES[key] || key, renameDeep(item)]));
}

const baselineSubjectMinutes = schedule.validationBaseline?.subjectMinutes || Object.fromEntries(
  schedule.groups.map((group) => [group, Object.fromEntries(
    Object.entries(schedule.lessons.filter((lesson) => lesson.group === group).reduce((totals, lesson) => {
      totals[lesson.subject] = (totals[lesson.subject] || 0) + lesson.minutes;
      return totals;
    }, {})).sort(([a], [b]) => a.localeCompare(b, "es")),
  )]),
);

const renamed = renameDeep(schedule);
Object.assign(schedule, renamed);
schedule.validationBaseline = { subjectMinutes: baselineSubjectMinutes };
schedule.version = "V2 · changeset final verificado";
schedule.changeSet = {
  id: "final-values-6a-6b-corrective-patch-2026-09-01",
  basis: "V1 validada",
  correctiveException: "5.ºB · Jueves 12:00–13:00 · Lengua con Ana G sin docencia compartida",
};

function lesson(group, day, time) {
  const row = schedule.lessons.find((item) => item.group === group && item.day === day && item.time === time);
  if (!row) throw new Error(`No existe la sesión ${group} · ${day} · ${time}`);
  return row;
}

function assign(group, day, time, values) {
  Object.assign(lesson(group, day, time), values);
}

// 3.º: todas las Ciencias Naturales pasan a María.
for (const row of schedule.lessons.filter((item) => item.group === "3.º" && item.subject === "C. Naturales")) {
  row.primary = "María";
  row.shared = row.shared.filter((name) => name !== "María");
  row.notes = "Reasignación final autorizada: Ciencias Naturales de 3.º impartidas por María.";
}
// María queda liberada de su participación no obligatoria en Matemáticas de 2.ºA el lunes a primera hora.
lesson("2.ºA", "Lunes", "09:00–10:00").shared = lesson("2.ºA", "Lunes", "09:00–10:00").shared.filter((name) => name !== "María");

// 5.ºA: permuta exclusiva entre Naturales y Sociales.
assign("5.ºA", "Lunes", "10:00–10:45", { subject: "C. Naturales", primary: "Noelia", shared: [], notes: "" });
assign("5.ºA", "Martes", "10:00–10:45", { subject: "C. Sociales", primary: "Noelia", shared: [], notes: "" });
assign("5.ºA", "Jueves", "10:00–10:45", { subject: "C. Naturales", primary: "Noelia", shared: [], notes: "" });
assign("5.ºA", "Jueves", "10:45–11:30", { subject: "C. Sociales", primary: "Noelia", shared: [], notes: "" });

// 5.ºB: se conserva la permuta de materias; excepción mínima de DC el jueves a las 12.
assign("5.ºB", "Jueves", "09:00–10:00", { subject: "C. Naturales", primary: "Ana G", shared: [], notes: "" });
assign("5.ºB", "Jueves", "12:00–13:00", {
  subject: "Lengua",
  primary: "Ana G",
  shared: [],
  notes: "Excepción autorizada: sesión válida con Ana G como docente principal y sin docencia compartida de Noelia.",
});

// Intercambio de docencia compartida de Matemáticas entre Fede y David Almagro.
for (const row of schedule.lessons.filter((item) => item.group === "6.ºA" && item.subject === "Matemáticas")) {
  row.shared = row.shared.map((name) => name === "Fede" ? "David Almagro" : name);
}
for (const row of schedule.lessons.filter((item) => item.group === "5.ºB" && item.subject === "Matemáticas")) {
  row.shared = row.shared.map((name) => name === "David Almagro" ? "Fede" : name);
}

// Permutaciones aprobadas para liberar a Fede y asignarle Plástica de 6.º.
assign("1.º", "Martes", "09:00–10:00", { subject: "Educación Física", primary: "Fede", shared: [], notes: "" });
assign("1.º", "Miércoles", "13:00–14:00", { subject: "C. Naturales", primary: "Belén", shared: [], notes: "" });

assign("2.ºA", "Martes", "13:00–14:00", { subject: "Plástica", primary: "Sandra", shared: [], notes: "" });
assign("2.ºA", "Miércoles", "13:00–14:00", { subject: "Educación Física", primary: "Fede", shared: [], notes: "" });

assign("2.ºB", "Lunes", "09:00–10:00", { subject: "Educación Física", primary: "Fede", shared: [], notes: "" });
assign("2.ºB", "Lunes", "13:00–14:00", { subject: "Matemáticas", primary: "Dámaris", shared: ["María"], notes: "" });
assign("2.ºB", "Martes", "12:00–13:00", { subject: "C. Naturales", primary: "Dámaris", shared: [], notes: "" });

// Las dos anomalías normalizadas de EF siguen a sus sesiones tras la permuta autorizada.
for (const anomaly of schedule.sourceAnomalies) {
  if (anomaly.group === "2.ºA" && anomaly.subject === "Educación Física" && anomaly.teacher === "Fede") Object.assign(anomaly, { day: "Miércoles", time: "13:00–14:00", resolution: "Se representa una sola vez como docente principal en su franja final; no se altera la sesión." });
  if (anomaly.group === "2.ºB" && anomaly.subject === "Educación Física" && anomaly.teacher === "Fede" && anomaly.day === "Martes") Object.assign(anomaly, { day: "Lunes", time: "09:00–10:00", resolution: "Se representa una sola vez como docente principal en su franja final; no se altera la sesión." });
}

assign("6.ºA", "Martes", "12:00–13:00", { primary: "Fede", shared: [], notes: "Plástica de 6.ºA reasignada a Fede." });
assign("6.ºB", "Martes", "13:00–14:00", { primary: "Fede", shared: [], notes: "Plástica de 6.ºB reasignada a Fede." });

// 4.º: permutación final exacta. Los docentes viajan con su materia.
assign("4.º", "Lunes", "09:00–10:00", { subject: "Música", primary: "Mamen", shared: [], notes: "" });
assign("4.º", "Lunes", "12:00–13:00", { subject: "Lengua", primary: "María Molina", shared: ["Cristina"], notes: "" });
assign("4.º", "Miércoles", "09:00–10:00", { subject: "Matemáticas", primary: "María Molina", shared: ["David Almagro"], notes: "" });
assign("4.º", "Miércoles", "12:00–13:00", { subject: "Lengua", primary: "María Molina", shared: ["Cristina"], notes: "" });

// Mamen pasa a Música de 4.º; Cristina cubre la DC de Lengua de 6.ºB con la menor alteración.
assign("6.ºB", "Lunes", "09:00–10:00", {
  primary: "María Muñoz",
  shared: ["Cristina"],
  notes: "Cristina sustituye la docencia compartida de Mamen; María Muñoz mantiene la docencia principal.",
});

// Parche final autorizado: Valores simultáneos en 6.ºA y 6.ºB.
assign("6.ºA", "Lunes", "10:00–10:45", {
  subject: "Valores", primary: "Ana B", shared: ["Mamen"], notes: "Mamen realiza docencia compartida en Valores de 6.ºA.",
});
assign("6.ºA", "Miércoles", "10:00–10:45", {
  subject: "Valores", primary: "Ana B", shared: [], notes: "Valores de 6.ºA impartidos por Ana B.",
});
assign("6.ºB", "Lunes", "10:00–10:45", {
  subject: "Valores", primary: "María Muñoz", shared: [], notes: "Valores de 6.ºB impartidos por María Muñoz.",
});
assign("6.ºB", "Miércoles", "10:00–10:45", {
  subject: "Valores", primary: "María Muñoz", shared: ["Mamen"], notes: "Mamen realiza docencia compartida en Valores de 6.ºB.",
});

// Permuta mínima autorizada para recolocar el Francés desplazado de 6.ºA.
assign("6.ºA", "Miércoles", "10:45–11:30", {
  subject: "Francés", primary: "María Molina", shared: [], notes: "Recolocación final autorizada del Francés de 6.ºA.",
});
assign("5.ºA", "Lunes", "10:00–10:45", {
  subject: "Francés", primary: "María Molina", shared: [], notes: "Permuta mínima autorizada con Ciencias Naturales.",
});
assign("5.ºA", "Miércoles", "10:45–11:30", {
  subject: "C. Naturales", primary: "Noelia", shared: [], notes: "Permuta mínima autorizada con Francés.",
});

// El bloque oficial del viernes 09:00–10:30 de 6.ºA contiene dos sesiones consecutivas de 45 minutos.
const fridaySixAFirst = schedule.lessons.find((item) => item.group === "6.ºA" && item.day === "Viernes" && ["09:00–10:30", "09:00–09:45"].includes(item.time));
if (!fridaySixAFirst) throw new Error("No existe el primer tramo del viernes de 6.ºA");
Object.assign(fridaySixAFirst, {
  time: "09:00–09:45", minutes: 45, subject: "C. Naturales", primary: "Ana B", shared: [], notes: "Primera mitad del bloque oficial 09:00–10:30.",
});
const fridaySixALanguage = schedule.lessons.find((item) => item.group === "6.ºA" && item.day === "Viernes" && item.time === "09:45–10:30");
const languageValues = {
  group: "6.ºA", day: "Viernes", time: "09:45–10:30", minutes: 45, subject: "Lengua", primary: "Ana B", shared: ["Mamen"], notes: "Segunda mitad del bloque oficial 09:00–10:30; traslado autorizado desde el miércoles.",
};
if (fridaySixALanguage) Object.assign(fridaySixALanguage, languageValues);
else schedule.lessons.push(languageValues);

// Excepción mínima autorizada: Ana G mantiene íntegramente Lengua de 5.ºB sin Noelia.
const fifthBWednesdayLanguage = lesson("5.ºB", "Miércoles", "10:45–11:30");
fifthBWednesdayLanguage.shared = fifthBWednesdayLanguage.shared.filter((name) => name !== "Noelia");
fifthBWednesdayLanguage.notes = "Excepción autorizada: Ana G mantiene la docencia principal sin docencia compartida de Noelia en esta única sesión.";

// Participaciones parciales expresamente autorizadas dentro de bloques lectivos completos.
assign("6.ºB", "Jueves", "10:00–10:45", {
  primaryMinutes: 30,
  primarySegment: "10:15–10:45",
  primaryDisplay: "María Muñoz (desde 10:15)",
  sharedDisplay: { Mamen: "Mamen (10:00–10:45)" },
  notes: "Mamen mantiene la sesión completa; María Muñoz se incorpora a las 10:15 tras coordinación.",
});
assign("4.º", "Jueves", "10:45–11:30", {
  sharedMinutes: { Cristina: 45, Gabriel: 30 },
  sharedSegments: { Cristina: "10:45–11:30", Gabriel: "11:00–11:30" },
  sharedDisplay: { Cristina: "Cristina", Gabriel: "Gabriel (11:00–11:30)" },
  notes: "Gabriel se incorpora a la docencia compartida a las 11:00 tras coordinación; la sesión de Lengua permanece completa.",
});

function event(teacher, concept, scheduleText, minutes, notes = "Dentro de franja oficial; la plantilla no se subdivide en filas de 15 min.") {
  return { teacher, concept, schedule: scheduleText, minutes, notes };
}

const replacementEvents = {
  Ana: [
    event("Ana", "Coordinación docente", "Miércoles 10:45–11:30 (45 min); Jueves 10:45–11:00 (15 min)", 60, "Distribución complementaria autorizada 45 + 15 minutos."),
    event("Ana", "Atención a familias", "Viernes 12:30–13:30 (60 min)", 60),
  ],
  Noelia: [
    event("Noelia", "Coordinación docente", "Martes 13:00–14:00 (60 min)", 60),
    event("Noelia", "Reducción por tutoría", "Miércoles 13:00–14:00 (60 min)", 60),
    event("Noelia", "Atención a familias", "Jueves 09:00–10:00 (60 min)", 60),
  ],
  "María Muñoz": [
    event("María Muñoz", "Atención a familias", "Lunes 13:00–14:00 (60 min)", 60),
    event("María Muñoz", "Coordinación docente", "Martes 10:00–10:45 (45 min); Jueves 10:00–10:15 (15 min)", 60, "Distribución complementaria autorizada 45 + 15 minutos; Mamen mantiene 6.ºB durante el tramo inicial del jueves."),
    event("María Muñoz", "Reducción por tutoría", "Viernes 12:30–13:30 (60 min)", 60),
  ],
  Gabriel: [
    event("Gabriel", "Atención a familias", "Viernes 12:30–13:30 (60 min)", 60),
    event("Gabriel", "Coordinación docente", "Jueves 10:00–10:45 (45 min); Jueves 10:45–11:00 (15 min)", 60, "Distribución complementaria autorizada 45 + 15 minutos; se incorpora a Lengua de 4.º a las 11:00."),
  ],
  "David Miñaro": [
    event("David Miñaro", "Reducción por tutoría", "Lunes 09:00–10:00 (60 min)", 60),
    event("David Miñaro", "Coordinación docente", "Jueves 09:00–10:00 (60 min)", 60),
    event("David Miñaro", "Atención a familias", "Viernes 09:00–10:00 (60 min)", 60),
  ],
  "María Molina": [
    event("María Molina", "Coordinación docente", "Lunes 13:00–14:00 (60 min)", 60),
    event("María Molina", "Reducción por tutoría", "Miércoles 13:00–14:00 (60 min)", 60),
    event("María Molina", "Atención a familias", "Jueves 12:00–13:00 (60 min)", 60),
  ],
};
schedule.complementaryEvents = [
  ...schedule.complementaryEvents.filter((item) => !replacementEvents[item.teacher]),
  ...Object.values(replacementEvents).flat(),
].sort((a, b) => schedule.teachers.indexOf(a.teacher) - schedule.teachers.indexOf(b.teacher) || CONCEPTS.indexOf(a.concept) - CONCEPTS.indexOf(b.concept));

// Coordinaciones afectadas; las restantes se conservan.
for (const row of schedule.coordinations) {
  if (row.group === "5.ºB" && row.sharedTeacher === "David Almagro") Object.assign(row, {
    sharedTeacher: "Fede", time: "Jueves 13:00–14:00", tutorType: "Apoyo 60’", sharedType: "Apoyo 60’",
    notes: "Coincidencia no lectiva compatible autorizada entre Ana G y Fede.",
  });
  if (row.group === "6.ºA" && row.sharedTeacher === "Fede") Object.assign(row, {
    sharedTeacher: "David Almagro", time: "Lunes 13:00–14:00", tutorType: "Atención a familias 60’", sharedType: "Coordinación docente 60’",
    notes: "Coincidencia no lectiva compatible autorizada entre Ana B y David Almagro.",
  });
  if (row.group === "3.º" && row.sharedTeacher === "Gabriel") Object.assign(row, {
    time: "Viernes 09:00–10:00", tutorType: "Atención a familias 60’", sharedType: "Apoyo 60’",
    notes: "Coincidencia no lectiva compatible: atención a familias de David Miñaro y apoyo disponible de Gabriel.",
  });
  if (row.group === "6.ºB" && row.sharedTeacher === "Mamen") Object.assign(row, {
    time: "Viernes 12:30–13:30", tutorType: "Reducción por tutoría 60’", sharedType: "Atención a familias 60’",
    notes: "Coincidencia no lectiva compatible autorizada entre María Muñoz y Mamen.",
  });
}

if (!schedule.exceptions.some((item) => item.ID === "E-11")) schedule.exceptions.push({
  ID: "E-11",
  Tipo: "Excepción de docencia compartida autorizada",
  Afectado: "5.ºB / Lengua / Noelia",
  "Franja / carga": "Jueves 12:00–13:00",
  Descripción: "Ana G mantiene íntegramente la docencia principal; Noelia no participa como docente compartida únicamente en esta sesión.",
  Minutos: 60,
  Estado: "Autorizada",
});
if (!schedule.exceptions.some((item) => item.ID === "E-12")) schedule.exceptions.push({
  ID: "E-12",
  Tipo: "Excepción de docencia compartida autorizada",
  Afectado: "5.ºB / Lengua / Noelia",
  "Franja / carga": "Miércoles 10:45–11:30",
  Descripción: "Ana G mantiene íntegramente la docencia principal; Noelia no participa como docente compartida únicamente en esta sesión.",
  Minutos: 45,
  Estado: "Autorizada",
});

// Catálogos derivados.
schedule.teachers = [...new Set(schedule.teachers.map((name) => RENAMES[name] || name))];
schedule.tutors = Object.fromEntries(Object.entries(schedule.tutors).map(([group, name]) => [group, RENAMES[name] || name]));
schedule.subjects = Object.fromEntries([...new Set(schedule.lessons.map((row) => row.subject))].sort((a, b) => a.localeCompare(b, "es")).map((subject) => [
  subject,
  [...new Set(schedule.lessons.filter((row) => row.subject === subject).flatMap((row) => [row.primary, ...row.shared]))].sort((a, b) => a.localeCompare(b, "es")),
]));

function hm(value) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}
function bounds(value) {
  const [start, end] = value.split("–");
  return [hm(start), hm(end)];
}
function duration(value) { const [start, end] = bounds(value); return end - start; }
function overlap(aStart, aEnd, bStart, bEnd) { return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart)); }
function parseEvents(item) {
  const matches = [...item.schedule.matchAll(/(Lunes|Martes|Miércoles|Jueves|Viernes)\s+(\d{2}:\d{2})–(\d{2}:\d{2})(?:\s+\((\d+) min\))?/g)];
  return matches.map((match) => {
    const start = hm(match[2]);
    const declared = match[4] ? Number(match[4]) : hm(match[3]) - start;
    return { teacher: item.teacher, concept: item.concept, day: match[1], start, end: Math.min(hm(match[3]), start + declared), minutes: declared };
  });
}
const complementParts = schedule.complementaryEvents.flatMap(parseEvents);

// Conservamos exclusivamente la docencia externa y la indisponibilidad que no están en las lecciones de Primaria.
const preservedMatrix = new Map();
for (const row of schedule.teacherMatrix) for (const [oldTeacher, oldStatus] of Object.entries(row.teachers)) {
  const teacher = RENAMES[oldTeacher] || oldTeacher;
  const status = renameString(oldStatus);
  const removedInfantEnglish = teacher === "María Muñoz" && ["Lunes", "Miércoles"].includes(row.day) && row.time === "10:00–10:45" && /Infantil 5/.test(status);
  if (!removedInfantEnglish && /Infantil|grupo mixto|NO DISPONIBLE/.test(status)) preservedMatrix.set(`${teacher}|${row.day}|${row.time}`, status);
}

function lessonSegmentsFor(teacher, day, time) {
  const [slotStart, slotEnd] = bounds(time);
  const segments = [];
  for (const row of schedule.lessons.filter((item) => {
    if (item.day !== day) return false;
    const [lessonStart, lessonEnd] = bounds(item.time);
    return overlap(lessonStart, lessonEnd, slotStart, slotEnd) > 0;
  })) {
    if (row.primary === teacher) {
      const [lessonStart] = bounds(row.time);
      const [start, end] = row.primarySegment ? bounds(row.primarySegment) : [lessonStart, lessonStart + (row.primaryMinutes ?? row.minutes)];
      segments.push({ start: Math.max(start, slotStart), end: Math.min(end, slotEnd), role: "direct", label: row.subject, group: row.group });
    }
    if (row.shared.includes(teacher)) {
      const explicit = row.sharedSegments?.[teacher];
      const [lessonStart] = bounds(row.time);
      const [start, end] = explicit ? bounds(explicit) : [lessonStart, lessonStart + (row.sharedMinutes?.[teacher] ?? row.minutes)];
      segments.push({ start: Math.max(start, slotStart), end: Math.min(end, slotEnd), role: "shared", label: row.subject, group: row.group });
    }
  }
  return segments.filter((segment) => segment.end > segment.start);
}

function mergeLessonLabels(segments) {
  const groups = new Map();
  for (const segment of segments) {
    const key = `${segment.role}|${segment.label}|${segment.start}|${segment.end}`;
    const entry = groups.get(key) || { ...segment, groups: [] };
    entry.groups.push(segment.group);
    groups.set(key, entry);
  }
  return [...groups.values()].map((entry) => `${entry.role === "shared" ? "DC " : ""}${entry.label} · ${entry.groups.join(" + ")}${entry.end - entry.start < 45 ? ` · ${entry.end - entry.start} min` : entry.end - entry.start < duration(`${String(Math.floor(entry.start / 60)).padStart(2, "0")}:${String(entry.start % 60).padStart(2, "0")}–${String(Math.floor((entry.start + 60) / 60)).padStart(2, "0")}:${String((entry.start + 60) % 60).padStart(2, "0")}`) ? ` · ${entry.end - entry.start} min` : ""}`);
}

schedule.teacherMatrix = DAYS.flatMap((day) => schedule.slots[day].map((time) => {
  if (schedule.recess[day] === time) return { day, time, teachers: Object.fromEntries(schedule.teachers.map((teacher) => [teacher, "RECREO"])) };
  const [slotStart, slotEnd] = bounds(time);
  const slotMinutes = slotEnd - slotStart;
  const teachers = {};
  for (const teacher of schedule.teachers) {
    const preserved = preservedMatrix.get(`${teacher}|${day}|${time}`);
    if (preserved === "NO DISPONIBLE") { teachers[teacher] = preserved; continue; }
    const lessonSegments = lessonSegmentsFor(teacher, day, time);
    const eventSegments = complementParts.filter((part) => part.teacher === teacher && part.day === day && overlap(part.start, part.end, slotStart, slotEnd));
    const labels = [];
    if (preserved) labels.push(preserved);
    labels.push(...eventSegments.map((part) => `${part.concept} · ${overlap(part.start, part.end, slotStart, slotEnd)} min`));
    labels.push(...mergeLessonLabels(lessonSegments));
    const occupiedIntervals = [
      ...(preserved ? [{ start: slotStart, end: slotEnd }] : []),
      ...lessonSegments,
      ...eventSegments.map((part) => ({ start: Math.max(part.start, slotStart), end: Math.min(part.end, slotEnd) })),
    ].sort((a, b) => a.start - b.start);
    let occupied = 0;
    let cursor = -Infinity;
    for (const interval of occupiedIntervals) {
      if (interval.end <= cursor) continue;
      occupied += interval.end - Math.max(interval.start, cursor);
      cursor = interval.end;
    }
    const free = Math.max(0, slotMinutes - occupied);
    if (free) labels.push(`Apoyo · ${free} min`);
    teachers[teacher] = labels.join("\n");
  }
  return { day, time, teachers };
}));

function unionMinutes(intervals) {
  const sorted = intervals.filter((item) => item.end > item.start).sort((a, b) => a.start - b.start);
  let total = 0;
  let start = null;
  let end = null;
  for (const item of sorted) {
    if (start === null || item.start > end) { if (start !== null) total += end - start; start = item.start; end = item.end; }
    else end = Math.max(end, item.end);
  }
  return total + (start === null ? 0 : end - start);
}

function roleMinutes(teacher, role) {
  let total = 0;
  for (const day of DAYS) {
    const intervals = [];
    for (const row of schedule.teacherMatrix.filter((item) => item.day === day && item.time !== schedule.recess[day])) {
      const [start, end] = bounds(row.time);
      if (role === "direct" && /Infantil|grupo mixto/.test(row.teachers[teacher] || "")) intervals.push({ start, end });
    }
    for (const row of schedule.lessons.filter((item) => item.day === day)) {
      const [slotStart] = bounds(row.time);
      if (role === "direct" && row.primary === teacher) {
        const [start, end] = row.primarySegment ? bounds(row.primarySegment) : [slotStart, slotStart + (row.primaryMinutes ?? row.minutes)];
        intervals.push({ start, end });
      }
      if (role === "shared" && row.shared.includes(teacher)) {
        const explicit = row.sharedSegments?.[teacher];
        const [start, end] = explicit ? bounds(explicit) : [slotStart, slotStart + (row.sharedMinutes?.[teacher] ?? row.minutes)];
        intervals.push({ start, end });
      }
    }
    total += unionMinutes(intervals);
  }
  return total;
}

schedule.teacherLoads = Object.fromEntries(schedule.teachers.map((teacher) => {
  const direct = roleMinutes(teacher, "direct");
  const shared = roleMinutes(teacher, "shared");
  const family = schedule.complementaryEvents.filter((item) => item.teacher === teacher && item.concept === "Atención a familias").reduce((sum, item) => sum + item.minutes, 0);
  const coordination = schedule.complementaryEvents.filter((item) => item.teacher === teacher && item.concept === "Coordinación docente").reduce((sum, item) => sum + item.minutes, 0);
  const tutorial = schedule.complementaryEvents.filter((item) => item.teacher === teacher && item.concept === "Reducción por tutoría").reduce((sum, item) => sum + item.minutes, 0);
  const recess = 150;
  const support = schedule.teacherMatrix.reduce((sum, row) => sum + [...(row.teachers[teacher] || "").matchAll(/Apoyo · (\d+) min/g)].reduce((subtotal, match) => subtotal + Number(match[1]), 0), 0);
  const computed = direct + shared + recess + family + coordination + tutorial;
  return [teacher, { direct, shared, recess, family, coordination, tutorial, computed, support, total: computed + support }];
}));

function kindFor(status, slotMinutes) {
  if (status === "RECREO") return "recreo";
  if (status === "NO DISPONIBLE") return "no_disponible";
  const lines = status.split("\n");
  if (lines.length === 1 && lines[0] === `Apoyo · ${slotMinutes} min`) return "p2";
  if (lines.some((line) => !line.startsWith("DC ") && !line.startsWith("Apoyo") && !CONCEPTS.some((concept) => line.startsWith(concept)))) return "docencia";
  if (lines.some((line) => line.startsWith("DC ")) && lines.every((line) => line.startsWith("DC "))) return "p3";
  if (lines.some((line) => line.startsWith("Atención a familias")) && !lines.some((line) => line.startsWith("DC "))) return "p4";
  if (lines.some((line) => line.startsWith("Coordinación") || line.startsWith("Reducción")) && !lines.some((line) => line.startsWith("DC "))) return "p5";
  return "mixed";
}

const substitutionSlots = schedule.teacherMatrix.map((row) => ({
  day: row.day,
  slot: row.time,
  teachers: Object.fromEntries(schedule.teachers.map((teacher) => [teacher, { status: row.teachers[teacher], kind: kindFor(row.teachers[teacher], duration(row.time)) }])),
}));

function candidatesAt(day, time, absentTeacher, p1) {
  let slot = substitutionSlots.find((row) => row.day === day && row.slot === time);
  if (!slot) {
    const [wantedStart, wantedEnd] = bounds(time);
    const parent = schedule.slots[day].find((candidate) => {
      const [start, end] = bounds(candidate);
      return start <= wantedStart && end >= wantedEnd;
    });
    const parentState = substitutionSlots.find((row) => row.day === day && row.slot === parent);
    slot = {
      day,
      slot: time,
      teachers: Object.fromEntries(schedule.teachers.map((teacher) => {
        const segments = lessonSegmentsFor(teacher, day, time);
        const direct = segments.some((segment) => segment.role === "direct");
        const shared = segments.length > 0 && segments.every((segment) => segment.role === "shared");
        const fallback = parentState?.teachers[teacher];
        const kind = direct ? "docencia" : shared ? "p3" : fallback?.kind === "no_disponible" ? "no_disponible" : "p2";
        return [teacher, { status: segments.length ? mergeLessonLabels(segments).join("\n") : `Apoyo · ${wantedEnd - wantedStart} min`, kind }];
      })),
    };
  }
  const list = (kind) => schedule.teachers.filter((teacher) => teacher !== absentTeacher && !p1.includes(teacher) && slot.teachers[teacher].kind === kind);
  return { p2: list("p2"), p3: list("p3"), p4: list("p4"), p5: list("p5") };
}

const activities = new Map();
for (const row of schedule.lessons) {
  for (const [role, names] of [["Docencia principal/directa", [row.primary]], ["Docencia compartida", row.shared]]) for (const teacher of names) {
    const key = `${row.day}|${row.time}|${teacher}|${row.subject}|${role}`;
    const entry = activities.get(key) || { day: row.day, time: row.time, teacher, subject: row.subject, role, groups: [], lessons: [] };
    entry.groups.push(row.group);
    entry.lessons.push(row);
    activities.set(key, entry);
  }
}
const scenarios = [...activities.values()].map((activity) => {
  const peers = [...new Set(activity.lessons.flatMap((row) => [row.primary, ...row.shared]).filter((teacher) => teacher !== activity.teacher))];
  const { p2, p3, p4, p5 } = candidatesAt(activity.day, activity.time, activity.teacher, peers);
  const prioritySets = [peers, p2, p3, p4, p5];
  const first = prioritySets.findIndex((values) => values.length);
  return {
    "Día": activity.day,
    "Franja": activity.time,
    "Docente ausente": activity.teacher,
    "Actividad": activity.subject,
    "Grupo": activity.groups.join(" + "),
    "Rol ausente": activity.role,
    "Cobertura obligatoria": activity.role === "Docencia compartida" ? "No" : "Sí",
    "P1 Misma docencia compartida": peers.join(", ") || "—",
    "P2 Apoyo": p2.join(", ") || "—",
    "P3 DC otro grupo": p3.join(", ") || "—",
    "P4 Atención familias": p4.join(", ") || "—",
    "P5 Coordinación/tutoría": p5.join(", ") || "—",
    "P6 Equipo directivo": "Selección manual",
    "Primera respuesta según criterio": first >= 0 ? `P${first + 1}: ${prioritySets[first].join(", ")}` : "P6: Equipo directivo — consultar disponibilidad",
    "Observaciones": activity.role === "Docencia compartida" ? "Grupo atendido por docente principal — reposición de docencia compartida opcional" : "Si hay empate dentro del mismo nivel, no se fuerza orden: seleccionar manualmente o aplicar un criterio de rotación previamente aprobado.",
  };
}).sort((a, b) => DAYS.indexOf(a["Día"]) - DAYS.indexOf(b["Día"]) || bounds(a["Franja"])[0] - bounds(b["Franja"])[0] || a["Docente ausente"].localeCompare(b["Docente ausente"], "es"));

const substitutions = {
  ...renameDeep(previousSubstitutions),
  source: schedule.changeSet.basis,
  teachers: schedule.teachers,
  slots: substitutionSlots,
  scenarios,
};

fs.writeFileSync(schedulePath, `${JSON.stringify(schedule, null, 2)}\n`);
fs.writeFileSync(substitutionsPath, `${JSON.stringify(substitutions, null, 2)}\n`);
console.log(`Changeset aplicado: ${schedule.lessons.length} sesiones, ${scenarios.length} escenarios de sustitución.`);
