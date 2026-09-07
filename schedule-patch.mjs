import fs from "node:fs";

const clone = (value) => JSON.parse(JSON.stringify(value));
const assert = (condition, message) => { if (!condition) throw new Error(`Horario base inesperado: ${message}`); };
const unique = (values) => [...new Set(values)];
const addShared = (lesson, teacher) => { lesson.shared = unique([...(lesson.shared || []), teacher]); };
const removeShared = (lesson, teacher) => { lesson.shared = (lesson.shared || []).filter((name) => name !== teacher); };

function findLesson(data, group, day, time) {
  const item = data.lessons.find((lesson) => lesson.group === group && lesson.day === day && lesson.time === time);
  assert(item, `${group} · ${day} · ${time}`);
  return item;
}

function findMatrix(data, day, time) {
  const item = data.teacherMatrix.find((slot) => slot.day === day && slot.time === time);
  assert(item, `matriz ${day} · ${time}`);
  return item;
}

function setStatus(data, day, time, teacher, status) {
  const slot = findMatrix(data, day, time);
  assert(Object.prototype.hasOwnProperty.call(slot.teachers, teacher), `${teacher} no existe en matriz ${day} ${time}`);
  slot.teachers[teacher] = status;
}

function setEvent(data, teacher, concept, schedule, minutes, notes = "") {
  const event = data.complementaryEvents.find((item) => item.teacher === teacher && item.concept === concept);
  assert(event, `evento ${teacher} · ${concept}`);
  Object.assign(event, { schedule, minutes, notes });
}

function clearSegments(lesson) {
  delete lesson.primaryMinutes;
  delete lesson.primarySegment;
  delete lesson.sharedMinutes;
  delete lesson.sharedSegments;
  delete lesson.supportLabel;
}

function setPartialShared(lesson, teacher, minutes, segment, display, supportLabel = "Apoyo") {
  addShared(lesson, teacher);
  lesson.sharedMinutes = { ...(lesson.sharedMinutes || {}), [teacher]: minutes };
  lesson.sharedSegments = { ...(lesson.sharedSegments || {}), [teacher]: segment };
  lesson.sharedDisplay = { ...(lesson.sharedDisplay || {}), [teacher]: display };
  lesson.supportLabel = supportLabel;
}

function stripSharedMetadata(lesson, teacher) {
  if (lesson.sharedMinutes) delete lesson.sharedMinutes[teacher];
  if (lesson.sharedSegments) delete lesson.sharedSegments[teacher];
  if (lesson.sharedDisplay) delete lesson.sharedDisplay[teacher];
  if (lesson.sharedMinutes && !Object.keys(lesson.sharedMinutes).length) delete lesson.sharedMinutes;
  if (lesson.sharedSegments && !Object.keys(lesson.sharedSegments).length) delete lesson.sharedSegments;
  if (lesson.sharedDisplay && !Object.keys(lesson.sharedDisplay).length) delete lesson.sharedDisplay;
}

function patchPrimarySchedule(source) {
  const data = clone(source);
  data.changeSet = "Ajustes aprobados 2026-09-07 · Fede/Mamen/Ana B";

  const p6bMon = findLesson(data, "6.ºB", "Lunes", "13:00–14:00");
  assert(p6bMon.subject === "Plástica" && p6bMon.primary === "Fede", "6.ºB lunes 13:00 debe ser Plástica de Fede");
  p6bMon.primary = "Mamen";

  const p6aWed = findLesson(data, "6.ºA", "Miércoles", "09:00–10:00");
  assert(p6aWed.subject === "Lengua" && p6aWed.primary === "Ana B", "6.ºA miércoles 09:00 debe ser Lengua de Ana B");
  Object.assign(p6aWed, { subject: "Plástica", primary: "Mamen", shared: [], notes: "Plástica reasignada a Mamen según ajuste aprobado." });

  const p6aThu = findLesson(data, "6.ºA", "Jueves", "13:00–14:00");
  assert(p6aThu.subject === "Plástica" && p6aThu.primary === "Fede", "6.ºA jueves 13:00 debe ser Plástica de Fede");
  Object.assign(p6aThu, { subject: "Lengua", primary: "Ana B", shared: ["Fede"], notes: "Lengua trasladada desde el miércoles 09:00; Fede en docencia compartida." });

  const p6bWed = findLesson(data, "6.ºB", "Miércoles", "10:45–11:30");
  assert(p6bWed.subject === "Lengua" && p6bWed.primary === "María Muñoz", "6.ºB miércoles 10:45 debe ser Lengua");
  addShared(p6bWed, "Fede");

  const p6aFri = findLesson(data, "6.ºA", "Viernes", "11:45–12:30");
  assert(p6aFri.subject === "Lengua" && p6aFri.primary === "Ana B", "6.ºA viernes 11:45 debe ser Lengua");
  addShared(p6aFri, "Fede");

  data.subjects.Plástica = unique([...(data.subjects.Plástica || []).filter((name) => name !== "Fede"), "Mamen"]);

  setStatus(data, "Lunes", "13:00–14:00", "Mamen", "Plástica · 6.ºB");
  setStatus(data, "Lunes", "13:00–14:00", "Fede", "Apoyo · 60 min");
  setStatus(data, "Miércoles", "09:00–10:00", "Ana B", "Atención a familias · 60 min");
  setStatus(data, "Miércoles", "09:00–10:00", "Mamen", "Plástica · 6.ºA");
  setStatus(data, "Miércoles", "10:45–11:30", "Fede", "DC Lengua · 6.ºB · 45 min");
  setStatus(data, "Jueves", "13:00–14:00", "Ana B", "Lengua · 6.ºA");
  setStatus(data, "Jueves", "13:00–14:00", "Fede", "DC Lengua · 6.ºA");
  setStatus(data, "Viernes", "11:45–12:30", "Fede", "DC Lengua · 6.ºA · 45 min");
  setStatus(data, "Viernes", "12:30–14:00", "Mamen", "Coordinación docente · 12:30–13:30\nApoyo · 13:30–14:00");

  setEvent(data, "Ana B", "Atención a familias", "Miércoles 09:00–10:00", 60, "Reubicada tras el traslado de Lengua de 6.ºA.");
  setEvent(data, "Mamen", "Coordinación docente", "Viernes 12:30–14:00", 60, "Coordinación 12:30–13:30 dentro de la franja oficial; única franja completa libre sin alterar docencias.");

  Object.assign(data.teacherLoads["Ana B"], { direct: 840, shared: 240, recess: 150, family: 60, coordination: 60, tutorial: 60, computed: 1410, support: 90, total: 1500 });
  Object.assign(data.teacherLoads.Mamen, { direct: 660, shared: 510, recess: 150, family: 60, coordination: 60, tutorial: 0, computed: 1440, support: 60, total: 1500 });
  Object.assign(data.teacherLoads.Fede, { direct: 450, shared: 390, recess: 150, family: 60, coordination: 60, tutorial: 0, computed: 1110, support: 390, total: 1500 });

  return data;
}

function patchInfantSchedule(source) {
  const data = clone(source);
  data.changeSet = "Ajustes aprobados 2026-09-07 · AE, Psicomotricidad y reequilibrio Dori/Mónica";
  data.subjects.Psicomotricidad = unique([...(data.subjects.Psicomotricidad || []), "Dori"]);

  const psych3 = findLesson(data, "3 años", "Lunes", "12:00–13:00");
  assert(psych3.subject === "Psicomotricidad" && (psych3.shared || []).includes("Mónica"), "Psicomotricidad 3 años lunes 12:00");
  removeShared(psych3, "Mónica");
  stripSharedMetadata(psych3, "Mónica");
  addShared(psych3, "Dori");
  psych3.notes = "Dori asume la Psicomotricidad de 3 años según ajuste aprobado.";

  const mon5 = findLesson(data, "5 años", "Lunes", "12:00–13:00");
  addShared(mon5, "Mónica");

  const doriMoves = [
    ["4 años", "Martes", "10:45–11:30", "3 años", "Martes", "10:45–11:30"],
    ["4 años", "Miércoles", "10:45–11:30", "5 años", "Miércoles", "10:45–11:30"],
    ["4 años", "Jueves", "10:45–11:30", "3 años", "Jueves", "10:45–11:30"],
  ];
  for (const [fromGroup, fromDay, fromTime, toGroup, toDay, toTime] of doriMoves) {
    const from = findLesson(data, fromGroup, fromDay, fromTime);
    assert((from.shared || []).includes("Dori"), `Dori debe figurar en ${fromGroup} ${fromDay} ${fromTime}`);
    removeShared(from, "Dori");
    stripSharedMetadata(from, "Dori");
    addShared(findLesson(data, toGroup, toDay, toTime), "Dori");
  }

  const monicaWed5 = findLesson(data, "5 años", "Miércoles", "10:45–11:30");
  assert((monicaWed5.shared || []).includes("Mónica"), "Mónica debe figurar en 5 años miércoles 10:45");
  removeShared(monicaWed5, "Mónica");
  stripSharedMetadata(monicaWed5, "Mónica");
  addShared(findLesson(data, "3 años", "Miércoles", "10:45–11:30"), "Mónica");

  const tue5 = findLesson(data, "5 años", "Martes", "12:00–13:00");
  assert(tue5.primary === "María" && (tue5.shared || []).includes("Dori"), "5 años martes 12:00 debe tener María + Dori");
  tue5.primary = "Dori";
  removeShared(tue5, "Dori");
  tue5.notes = "Dori cubre la tutoría durante la reducción tutorial de María.";
  tue5.primaryDisplay = "Dori (cobertura de tutoría)";

  const fri3early = findLesson(data, "3 años", "Viernes", "09:00–10:30");
  removeShared(fri3early, "Dori");
  stripSharedMetadata(fri3early, "Dori");
  setPartialShared(fri3early, "Mónica", 30, "10:00–10:30", "Mónica (apoyo 10:00–10:30)");

  const fri5early = findLesson(data, "5 años", "Viernes", "09:00–10:30");
  setPartialShared(fri5early, "Dori", 30, "10:00–10:30", "Dori (apoyo 10:00–10:30)");

  addShared(findLesson(data, "3 años", "Viernes", "10:30–11:15"), "Dori");
  addShared(findLesson(data, "4 años", "Viernes", "10:30–11:15"), "Mónica");
  addShared(findLesson(data, "3 años", "Viernes", "11:45–12:30"), "Dori");

  const ae5 = findLesson(data, "5 años", "Viernes", "11:45–12:30");
  assert(ae5.subject === "Religión / Atención Educativa" && ae5.primary === "María", "AE 5 años viernes 11:45");
  clearSegments(ae5);
  ae5.primary = "María";
  ae5.shared = ["Mónica"];
  ae5.primaryDisplay = "María (Atención Educativa) · Carmen María (Religión mixta)";
  ae5.sharedDisplay = { Mónica: "Mónica (Atención Educativa / apoyo)" };
  ae5.notes = "María imparte íntegramente Atención Educativa 11:45–12:30; Mónica apoya la sesión.";

  const fri5late = findLesson(data, "5 años", "Viernes", "12:30–14:00");
  clearSegments(fri5late);
  fri5late.primary = "María";
  fri5late.shared = [];
  fri5late.primaryDisplay = "María";
  setPartialShared(fri5late, "Mónica", 30, "12:30–13:00", "Mónica (apoyo 12:30–13:00)");
  fri5late.notes = "María imparte el bloque completo; Mónica apoya de 12:30 a 13:00.";

  const fri3late = findLesson(data, "3 años", "Viernes", "12:30–14:00");
  assert((fri3late.shared || []).includes("Dori"), "Dori debe figurar en 3 años viernes 12:30");

  setStatus(data, "Lunes", "10:45–11:30", "Dori", "DC Crecimiento en armonía · 4 años · 45 min");
  setStatus(data, "Lunes", "12:00–13:00", "Dori", "DC Psicomotricidad · 3 años");
  setStatus(data, "Lunes", "12:00–13:00", "Mónica", "DC Descubrimiento y exploración del entorno · 5 años");
  setStatus(data, "Martes", "10:45–11:30", "Dori", "DC Crecimiento en armonía · 3 años · 45 min");
  setStatus(data, "Martes", "12:00–13:00", "María", "Reducción por tutoría · 60 min");
  setStatus(data, "Martes", "12:00–13:00", "Dori", "Cobertura Descubrimiento y exploración del entorno · 5 años");
  setStatus(data, "Miércoles", "10:00–10:45", "Dori", "DC Descubrimiento y exploración del entorno · 5 años · 45 min");
  setStatus(data, "Miércoles", "10:45–11:30", "Dori", "DC Crecimiento en armonía · 5 años · 45 min");
  setStatus(data, "Miércoles", "10:45–11:30", "Mónica", "DC Crecimiento en armonía · 3 años · 45 min");
  setStatus(data, "Miércoles", "13:00–14:00", "Dori", "DC Comunicación y representación de la realidad · 5 años");
  setStatus(data, "Jueves", "10:45–11:30", "Dori", "DC Descubrimiento y exploración del entorno · 3 años · 45 min");
  setStatus(data, "Viernes", "09:00–10:30", "Dori", "Gestión de biblioteca · 09:00–10:00; DC 5 años · 10:00–10:30");
  setStatus(data, "Viernes", "09:00–10:30", "Mónica", "NO DISPONIBLE 09:00–10:00; DC 3 años · 10:00–10:30");
  setStatus(data, "Viernes", "10:30–11:15", "Dori", "DC Religión / Atención Educativa · 3 años · 45 min");
  setStatus(data, "Viernes", "10:30–11:15", "Mónica", "DC Religión / Atención Educativa · 4 años · 45 min");
  setStatus(data, "Viernes", "11:45–12:30", "María", "Religión / Atención Educativa · 5 años · 45 min");
  setStatus(data, "Viernes", "11:45–12:30", "Dori", "DC Religión / Atención Educativa · 3 años · 45 min");
  setStatus(data, "Viernes", "11:45–12:30", "Mónica", "DC Religión / Atención Educativa · 5 años · 45 min");
  setStatus(data, "Viernes", "12:30–14:00", "María", "Comunicación y representación de la realidad · 5 años · 90 min");
  setStatus(data, "Viernes", "12:30–14:00", "Dori", "DC 3 años · 12:30–13:00; Atención a familias · 13:00–14:00");
  setStatus(data, "Viernes", "12:30–14:00", "Mónica", "DC 5 años · 12:30–13:00; Atención a familias · 13:00–14:00");

  setEvent(data, "María", "Reducción por tutoría", "Martes 12:00–13:00 (60 min)", 60, "Reubicada para mantener completa la sesión de Atención Educativa del viernes.");
  const library = data.complementaryEvents.find((item) => item.teacher === "Dori" && item.concept === "Gestión de biblioteca" && item.schedule.startsWith("Lunes 12:00"));
  assert(library, "bloque de biblioteca de Dori lunes 12:00");
  Object.assign(library, { schedule: "Viernes 09:00–10:00 (60 min)", minutes: 60, notes: "Reubicada para permitir a Dori asumir Psicomotricidad de 3 años." });

  Object.assign(data.teacherLoads.María, { direct: 1080, shared: 0, recess: 150, family: 60, coordination: 60, tutorial: 60, computed: 1410, support: 90, total: 1500 });
  Object.assign(data.teacherLoads.Dori, { direct: 570, shared: 540, recess: 150, family: 60, coordination: 180, tutorial: 0, computed: 1500, support: 0, total: 1500 });
  Object.assign(data.teacherLoads.Mónica, { direct: 150, shared: 420, recess: 90, family: 60, coordination: 0, tutorial: 0, computed: 720, support: 0, total: 720 });

  return data;
}

function kindFromStatus(status) {
  if (status === "RECREO") return "recreo";
  if (status.includes("NO DISPONIBLE") || status.includes("\n") || status.includes(";")) return "no_disponible";
  if (status.startsWith("Apoyo")) return "p2";
  if (status.startsWith("DC ")) return "p3";
  if (status.startsWith("Atención a familias")) return "p4";
  if (status.startsWith("Coordinación") || status.startsWith("Reducción") || status.startsWith("Gestión de biblioteca")) return "p5";
  if (status.startsWith("Equipo directivo")) return "p6";
  return "docencia";
}

function fullLessonTeacher(lesson, teacher) {
  if (teacher === lesson.primary) return !lesson.primaryMinutes || lesson.primaryMinutes >= lesson.minutes;
  const minutes = lesson.sharedMinutes?.[teacher];
  return !minutes || minutes >= lesson.minutes;
}

function candidatesForSlot(slot, absent, excluded, kind) {
  return Object.entries(slot.teachers)
    .filter(([teacher, state]) => teacher !== absent && !excluded.has(teacher) && state.kind === kind)
    .map(([teacher]) => teacher);
}

function joinCandidates(values) { return values.length ? values.join(", ") : "—"; }

function rebuildScenarios(schedule, slots) {
  const slotMap = new Map(slots.map((slot) => [`${slot.day}|${slot.slot}`, slot]));
  const scenarios = [];
  for (const lesson of schedule.lessons) {
    const slot = slotMap.get(`${lesson.day}|${lesson.time}`);
    if (!slot) continue;
    const assigned = unique([lesson.primary, ...(lesson.shared || [])]);
    for (const absent of assigned) {
      const isPrimary = absent === lesson.primary;
      const p1 = assigned.filter((teacher) => teacher !== absent && fullLessonTeacher(lesson, teacher));
      const excluded = new Set(p1);
      const p2 = candidatesForSlot(slot, absent, excluded, "p2");
      p2.forEach((teacher) => excluded.add(teacher));
      const p3 = candidatesForSlot(slot, absent, excluded, "p3");
      p3.forEach((teacher) => excluded.add(teacher));
      const p4 = candidatesForSlot(slot, absent, excluded, "p4");
      p4.forEach((teacher) => excluded.add(teacher));
      const p5 = candidatesForSlot(slot, absent, excluded, "p5");
      scenarios.push({
        "Día": lesson.day,
        "Franja": lesson.time,
        "Docente ausente": absent,
        "Actividad": lesson.subject,
        "Grupo": lesson.group,
        "Rol ausente": isPrimary ? "Docencia principal/directa" : "Docencia compartida",
        "Cobertura obligatoria": isPrimary ? "Sí" : "No",
        "P1 Misma docencia compartida": joinCandidates(p1),
        "P2 Apoyo": joinCandidates(p2),
        "P3 DC otro grupo": joinCandidates(p3),
        "P4 Atención familias": joinCandidates(p4),
        "P5 Coordinación/tutoría": joinCandidates(p5),
        "P6 Equipo directivo": "Selección manual",
        "Primera respuesta según criterio": "Consultar candidatos P1 → P6",
        "Observaciones": isPrimary
          ? "Aplicar el orden P1 → P6; en empate se muestran todas las alternativas."
          : "El grupo conserva docente principal; reposición de docencia compartida opcional."
      });
    }
  }
  return scenarios;
}

function syncSubstitutions(source, schedule) {
  const data = clone(source);
  data.source_workbook = schedule.sourceWorkbook || data.source_workbook;
  data.slots = schedule.teacherMatrix.map((matrix) => ({
    day: matrix.day,
    slot: matrix.time,
    teachers: Object.fromEntries(Object.entries(matrix.teachers).map(([teacher, status]) => [teacher, { status, kind: kindFromStatus(status) }]))
  }));
  data.scenarios = rebuildScenarios(schedule, data.slots);
  return data;
}

function readJson(id) { return JSON.parse(fs.readFileSync(id, "utf8")); }
function asJson(value) { return JSON.stringify(value); }

export default function schedulePatchPlugin() {
  return {
    name: "approved-schedule-delta-2026-09-07",
    enforce: "pre",
    load(id) {
      const clean = id.split("?")[0].replace(/\\/g, "/");
      if (clean.endsWith("/src/data/schedule-v2.json")) return asJson(patchPrimarySchedule(readJson(id.split("?")[0])));
      if (clean.endsWith("/src/data/schedule-infantil.json")) return asJson(patchInfantSchedule(readJson(id.split("?")[0])));
      if (clean.endsWith("/src/data/substitutions-v2.json")) {
        const source = readJson(id.split("?")[0]);
        const schedule = patchPrimarySchedule(readJson(id.split("?")[0].replace("substitutions-v2.json", "schedule-v2.json")));
        return asJson(syncSubstitutions(source, schedule));
      }
      if (clean.endsWith("/src/data/substitutions-infantil.json")) {
        const source = readJson(id.split("?")[0]);
        const schedule = patchInfantSchedule(readJson(id.split("?")[0].replace("substitutions-infantil.json", "schedule-infantil.json")));
        return asJson(syncSubstitutions(source, schedule));
      }
      return null;
    }
  };
}
