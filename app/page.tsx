"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import scheduleSource from "../src/data/schedule-v2.json";
import substitutionSource from "../src/data/substitutions-v2.json";

type Tab = "groups" | "days" | "subjects" | "teachers" | "loads" | "substitutions" | "print";
type TeacherType = "all" | "tutors" | "specialists" | "shared" | "support";
type SubjectType = "all" | "tutoring" | "core" | "lang" | "spec";
type SubstitutionView = "resolver" | "availability" | "support" | "dashboard";
type AbsenceKind = "day" | "period";
type Lesson = { group: string; day: string; time: string; minutes: number; subject: string; primary: string; shared: string[]; notes: string };
type Load = { direct: number; shared: number; recess: number; family: number; coordination: number; tutorial: number; computed: number; support: number; total: number };
type TeacherState = { status: string; kind: string };
type SlotState = { day: string; slot: string; teachers: Record<string, TeacherState> };
type Scenario = Record<string, string>;
type SavedAssignment = { date: string; day: string; time: string; group: string; subject: string; absent: string; substitute: string; role: string };
type AbsenceRecord = { id: string; teacher: string; kind: AbsenceKind; startDate: string; endDate: string; createdAt: string; sessions: SavedAssignment[] };
type AbsenceContextValue = { records: AbsenceRecord[]; setRecords: React.Dispatch<React.SetStateAction<AbsenceRecord[]>>; referenceDate: string; setReferenceDate: (date: string) => void };

const schedule = scheduleSource as typeof scheduleSource & { lessons: Lesson[]; teacherLoads: Record<string, Load>; teacherRoles: Record<string, string[]> };
const substitutions = substitutionSource as typeof substitutionSource & { slots: SlotState[]; scenarios: Scenario[] };
const DAYS = schedule.days;
const GROUPS = schedule.groups;
const TEACHERS = schedule.teachers;
const CORE = ["Lengua", "Matemáticas", "C. Naturales", "C. Sociales"];
const LANGUAGES = ["Inglés", "Francés"];
const PRIORITIES = [
  ["P1 Misma docencia compartida", "P1 · Misma docencia compartida"],
  ["P2 Apoyo", "P2 · Apoyo"],
  ["P3 DC otro grupo", "P3 · Docencia compartida en otro grupo"],
  ["P4 Atención familias", "P4 · Atención a familias"],
  ["P5 Coordinación/tutoría", "P5 · Coordinación / reducción tutorial"],
] as const;
const ABSENCE_STORAGE_KEY = "horarios-ceip-v2-absence-records";
const REFERENCE_DATE_KEY = "horarios-ceip-v2-reference-date";
const AbsenceContext = createContext<AbsenceContextValue | null>(null);

function family(subject: string) { return CORE.includes(subject) ? "core" : LANGUAGES.includes(subject) ? "lang" : "spec"; }
function normalized(value: string) { return value.toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
function matches(query: string, ...values: string[]) { return !query || normalized(values.join(" ")).includes(normalized(query)); }
function formatMinutes(minutes: number) { if (!minutes) return "—"; const hours = Math.floor(minutes / 60); const remainder = minutes % 60; return `${hours ? `${hours} h` : ""}${hours && remainder ? " " : ""}${remainder ? `${remainder} min` : ""}`; }
function lessonsFor(group: string, day: string) { return schedule.lessons.filter((lesson) => lesson.group === group && lesson.day === day); }
function isRecess(day: string, time: string) { return schedule.recess[day as keyof typeof schedule.recess] === time; }
function todayIso() { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`; }
function parseIso(value: string) { return new Date(`${value}T12:00:00`); }
function toIso(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function dayFromDate(value: string) { const names = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]; return names[parseIso(value).getDay()]; }
function dateForDay(referenceDate: string, day: string) { const reference = parseIso(referenceDate); const monday = new Date(reference); const weekday = reference.getDay() || 7; monday.setDate(reference.getDate() - weekday + 1); const index = DAYS.indexOf(day); monday.setDate(monday.getDate() + Math.max(index, 0)); return toIso(monday); }
function datesBetween(start: string, end: string) { const dates: string[] = []; const cursor = parseIso(start); const limit = parseIso(end); for (let guard = 0; cursor <= limit && guard < 370; guard += 1) { dates.push(toIso(cursor)); cursor.setDate(cursor.getDate() + 1); } return dates; }
function isActive(record: AbsenceRecord, date: string) { return record.startDate <= date && date <= record.endDate; }
function activeTeacherNames(records: AbsenceRecord[], date: string) { return Array.from(new Set(records.filter((record) => isActive(record, date)).map((record) => record.teacher))); }
function savedSubstitution(records: AbsenceRecord[], date: string, lesson: Lesson, teacher: string) { return records.flatMap((record) => record.sessions).find((item) => item.date === date && item.time === lesson.time && item.group === lesson.group && item.subject === lesson.subject && item.absent === teacher)?.substitute || ""; }
function scenarioAssignmentKey(date: string, scenario: Scenario) { return `${date}|${scenario["Franja"]}|${scenario["Grupo"]}|${scenario["Docente ausente"]}`; }
function useAbsenceContext() { const value = useContext(AbsenceContext); if (!value) throw new Error("AbsenceContext no disponible"); return value; }
function useAbsenceStore() {
  const [records, setRecords] = useState<AbsenceRecord[]>(() => { try { return JSON.parse(localStorage.getItem(ABSENCE_STORAGE_KEY) || "[]") as AbsenceRecord[]; } catch { return []; } });
  const [referenceDate, setReferenceDate] = useState(() => localStorage.getItem(REFERENCE_DATE_KEY) || todayIso());
  useEffect(() => { localStorage.setItem(ABSENCE_STORAGE_KEY, JSON.stringify(records)); }, [records]);
  useEffect(() => { localStorage.setItem(REFERENCE_DATE_KEY, referenceDate); }, [referenceDate]);
  return { records, setRecords, referenceDate, setReferenceDate };
}

export default function Home() {
  const absenceStore = useAbsenceStore();
  const [tab, setTab] = useState<Tab>("groups");
  const [group, setGroup] = useState("4.º");
  const [day, setDay] = useState("Lunes");
  const [teacher, setTeacher] = useState("María Molina");
  const [teacherType, setTeacherType] = useState<TeacherType>("all");
  const [subjectType, setSubjectType] = useState<SubjectType>("all");
  const [subject, setSubject] = useState("all");
  const [query, setQuery] = useState("");
  const nav = <>{navButton("groups", "Grupos", "▦", tab, setTab)}{navButton("days", "Por días", "◫", tab, setTab)}{navButton("subjects", "Asignaturas", "▤", tab, setTab)}{navButton("teachers", "Docentes", "♙", tab, setTab)}{navButton("loads", "Cargas", "▥", tab, setTab)}{navButton("substitutions", "Sustituciones", "⇄", tab, setTab)}{navButton("print", "Imprimir", "⎙", tab, setTab)}</>;
  return <AbsenceContext.Provider value={absenceStore}><main className="app theme-compact">
    <aside className="sidebar" aria-label="Navegación principal"><div className="mark"><img src="./logo-srl-v4.webp" alt="Colegio Público Santa Rosa de Lima"/><div><b>Horarios</b><small>Sta. Rosa de Lima</small><em>Curso 26–27</em></div></div><nav>{nav}</nav></aside>
    <section className="shell"><header className="topbar"><div className="topbar-brand"><img className="mobile-school-logo" src="./logo-srl-v4.webp" alt="Colegio Público Santa Rosa de Lima"/><div><h1>Horarios CEIP <span>· Curso 2026–27</span></h1></div></div></header><div className="mobile-nav">{nav}</div>
      {tab === "groups" && <><Toolbar query={query} setQuery={setQuery}><label>Grupo<select value={group} onChange={(event) => setGroup(event.target.value)}>{GROUPS.map((name) => <option key={name}>{name}</option>)}</select></label><button className="primary" onClick={() => window.print()}>Imprimir horario</button></Toolbar><section className="panel schedule-panel"><PanelTitle eyebrow="Vista semanal" title={`${group} Primaria`}/><WeekGrid group={group} query={query}/></section></>}
      {tab === "days" && <DayView day={day} setDay={setDay} query={query} setQuery={setQuery}/>}
      {tab === "subjects" && <SubjectsView subjectType={subjectType} setSubjectType={setSubjectType} subject={subject} setSubject={setSubject} query={query} setQuery={setQuery}/>}
      {tab === "teachers" && <TeacherView teacher={teacher} setTeacher={setTeacher} teacherType={teacherType} setTeacherType={setTeacherType} query={query} setQuery={setQuery}/>}
      {tab === "loads" && <LoadsView/>}{tab === "substitutions" && <SubstitutionsView/>}{tab === "print" && <PrintCenter/>}
    </section>
  </main></AbsenceContext.Provider>;
}

function navButton(id: Tab, label: string, icon: string, tab: Tab, setTab: (tab: Tab) => void) { return <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}><span>{icon}</span>{label}</button>; }
function Toolbar({ children, query, setQuery, placeholder = "Buscar asignatura o docente…" }: { children: React.ReactNode; query: string; setQuery: (value: string) => void; placeholder?: string }) { return <div className="toolbar">{children}<label className="search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={placeholder}/></label></div>; }
function Legend() { return <div className="legend"><span className="legend-item core"><i/>Troncales</span><span className="legend-item lang"><i/>Idiomas</span><span className="legend-item spec"><i/>Especialidades</span></div>; }
function PanelTitle({ eyebrow, title, aside = <Legend/> }: { eyebrow: string; title: string; aside?: React.ReactNode }) { return <div className="panel-title"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div>{aside}</div>; }

function LessonCard({ lesson, query, compact = false, date }: { lesson: Lesson; query: string; compact?: boolean; date?: string }) {
  const { records } = useAbsenceContext();
  const visible = matches(query, lesson.subject, lesson.primary, ...lesson.shared);
  const absent = date ? [lesson.primary, ...lesson.shared].filter((teacher) => activeTeacherNames(records, date).includes(teacher)) : [];
  return <article className={`${compact ? "matrix-card" : "lesson"} family-${family(lesson.subject)} ${visible ? "" : "muted"} ${absent.length ? "has-absence" : ""}`}><span className="lesson-time">{lesson.time}</span><strong>{lesson.subject}</strong><small><b>Docente:</b> {lesson.primary}</small>{lesson.shared.length > 0 && <small><b>Docencia compartida:</b> {lesson.shared.join(", ")}</small>}{absent.length > 0 && <div className="absence-stack">{absent.map((teacher) => { const substitute = savedSubstitution(records, date!, lesson, teacher); return <span className="absence-badge" key={teacher}>Ausente: {teacher}{substitute ? ` · Sustituye: ${substitute}` : " · Pendiente"}</span>; })}</div>}</article>;
}

function WeekGrid({ group, query }: { group: string; query: string }) {
  const { referenceDate } = useAbsenceContext();
  return <div className="week-grid">{DAYS.map((day) => <div className="day" key={day}><h3>{day}</h3><div className="day-cards">{schedule.slots[day as keyof typeof schedule.slots].map((time) => { if (isRecess(day, time)) return <div className="break" key={time}><span>☕</span> Recreo · 30 min</div>; const lesson = lessonsFor(group, day).find((item) => item.time === time); return lesson ? <LessonCard key={time} lesson={lesson} query={query} date={dateForDay(referenceDate, day)}/> : null; })}</div></div>)}</div>;
}

function DayView({ day, setDay, query, setQuery }: { day: string; setDay: (day: string) => void; query: string; setQuery: (value: string) => void }) {
  const { referenceDate } = useAbsenceContext();
  const slots = schedule.slots[day as keyof typeof schedule.slots];
  const gridStyle = { "--slot-count": slots.length, gridTemplateColumns: `120px repeat(${slots.length}, minmax(205px, 1fr))` } as React.CSSProperties;
  return <><Toolbar query={query} setQuery={setQuery}><label>Día<select value={day} onChange={(event) => setDay(event.target.value)}>{DAYS.map((name) => <option key={name}>{name}</option>)}</select></label><button className="primary" onClick={() => window.print()}>Imprimir día</button></Toolbar><section className="panel day-overview"><PanelTitle eyebrow="Organización diaria" title={day}/><div className="matrix-wrap"><div className="day-matrix" style={gridStyle}><div className="matrix-heading">Grupo</div>{slots.map((time) => <div className="matrix-heading" key={time}>{time}</div>)}{GROUPS.map((group) => <div className="matrix-row" key={group}><div className="matrix-group">{group}</div>{slots.map((time) => { if (isRecess(day, time)) return <div className="matrix-recess" key={time}>☕ Recreo</div>; const lesson = lessonsFor(group, day).find((item) => item.time === time); return <div className="matrix-cell" key={time}>{lesson ? <LessonCard lesson={lesson} query={query} compact date={dateForDay(referenceDate, day)}/> : <span>—</span>}</div>; })}</div>)}</div></div></section></>;
}

function SubjectsView({ subjectType, setSubjectType, subject, setSubject, query, setQuery }: { subjectType: SubjectType; setSubjectType: (type: SubjectType) => void; subject: string; setSubject: (value: string) => void; query: string; setQuery: (value: string) => void }) {
  const { referenceDate } = useAbsenceContext();
  const allSubjects = useMemo(() => Array.from(new Set(schedule.lessons.map((lesson) => lesson.subject))).sort((a, b) => a.localeCompare(b, "es")), []);
  const allowed = (lesson: Lesson) => { if (subject !== "all" && lesson.subject !== subject) return false; if (subjectType === "tutoring" && lesson.primary !== schedule.tutors[lesson.group as keyof typeof schedule.tutors]) return false; if (["core", "lang", "spec"].includes(subjectType) && family(lesson.subject) !== subjectType) return false; return matches(query, lesson.subject, lesson.primary, ...lesson.shared, lesson.group, lesson.day); };
  return <><Toolbar query={query} setQuery={setQuery}><label>Tipo<select value={subjectType} onChange={(event) => setSubjectType(event.target.value as SubjectType)}><option value="all">Todas</option><option value="tutoring">Tutoría</option><option value="core">Troncales</option><option value="lang">Idiomas</option><option value="spec">Especialidades</option></select></label><label>Asignatura<select value={subject} onChange={(event) => setSubject(event.target.value)}><option value="all">Todas las asignaturas</option>{allSubjects.map((name) => <option key={name}>{name}</option>)}</select></label><button className="primary" onClick={() => window.print()}>Imprimir asignaturas</button></Toolbar><section className="panel subject-overview"><PanelTitle eyebrow="Distribución por asignatura" title={subject === "all" ? "Todas las asignaturas" : subject}/><div className="matrix-wrap"><div className="subject-matrix"><div className="matrix-heading">Grupo</div>{DAYS.map((day) => <div className="matrix-heading" key={day}>{day}</div>)}{GROUPS.map((group) => <div className="matrix-row" key={group}><div className="matrix-group">{group}</div>{DAYS.map((day) => { const dayLessons = lessonsFor(group, day).filter(allowed); return <div className="subject-cell" key={day}>{dayLessons.length ? dayLessons.map((lesson) => <LessonCard key={lesson.time} lesson={lesson} query="" compact date={dateForDay(referenceDate, day)}/>) : <span className="empty">—</span>}</div>; })}</div>)}</div></div></section></>;
}

function TeacherView({ teacher, setTeacher, teacherType, setTeacherType, query, setQuery }: { teacher: string; setTeacher: (name: string) => void; teacherType: TeacherType; setTeacherType: (type: TeacherType) => void; query: string; setQuery: (value: string) => void }) {
  const { records, referenceDate } = useAbsenceContext();
  const roleName: Record<TeacherType, string> = { all: "", tutors: "Tutor/a", specialists: "Especialista", shared: "Docencia compartida", support: "Apoyo disponible" };
  const filteredTeachers = TEACHERS.filter((name) => !roleName[teacherType] || schedule.teacherRoles[name]?.includes(roleName[teacherType]));
  useEffect(() => { if (!filteredTeachers.includes(teacher)) setTeacher(filteredTeachers[0] ?? TEACHERS[0]); }, [teacherType]);
  const load = schedule.teacherLoads[teacher];
  const extra = schedule.complementaryEvents.filter((event) => event.teacher === teacher && event.schedule.includes("14:00–15:00"));
  const absentDates = DAYS.map((name) => dateForDay(referenceDate, name)).filter((date) => activeTeacherNames(records, date).includes(teacher));
  return <><Toolbar query={query} setQuery={setQuery}><label>Docente<select value={teacher} onChange={(event) => setTeacher(event.target.value)}>{filteredTeachers.map((name) => <option key={name}>{name}</option>)}</select></label><label>Tipo de docente<select value={teacherType} onChange={(event) => setTeacherType(event.target.value as TeacherType)}><option value="all">Todos</option><option value="tutors">Tutores</option><option value="specialists">Especialistas</option><option value="shared">Docencia compartida</option><option value="support">Apoyo disponible</option></select></label><button className="primary" onClick={() => window.print()}>Imprimir horario</button></Toolbar><section className={`panel teacher-summary ${absentDates.length ? "has-absence" : ""}`}><div><p className="eyebrow">Horario individual</p><h2>{teacher}</h2><p>{schedule.teacherRoles[teacher]?.join(" · ") || "Funciones no lectivas"}</p>{absentDates.length > 0 && <span className="absence-badge">Ausente durante {absentDates.length} día{absentDates.length === 1 ? "" : "s"} de la semana seleccionada</span>}</div>{load && <div className="summary-stats">{summaryStat("Total semanal", load.total, true)}{summaryStat("Docencia", load.direct)}{summaryStat("Docencia compartida", load.shared)}{summaryStat("Recreo", load.recess)}{summaryStat("Complementarias", load.family + load.coordination)}{summaryStat("Reducción tutorial", load.tutorial)}{summaryStat("Apoyo disponible", load.support)}</div>}</section>{extra.map((event) => <div className="notice" key={event.schedule}><b>Excepción autorizada:</b> {event.concept} · {event.schedule}. No constituye incidencia.</div>)}<section className="panel teacher-days">{DAYS.map((day) => <TeacherDay key={day} teacher={teacher} day={day} query={query}/>)}</section></>;
}
function summaryStat(label: string, value: number, primary = false) { return <div className={`summary-stat ${primary ? "total" : ""}`}><strong>{formatMinutes(value)}</strong><span>{label}</span></div>; }
function TeacherDay({ teacher, day, query }: { teacher: string; day: string; query: string }) { const { records, referenceDate } = useAbsenceContext(); const date = dateForDay(referenceDate, day); const teacherAbsent = activeTeacherNames(records, date).includes(teacher); const rows = schedule.teacherMatrix.filter((row) => row.day === day); return <div className="teacher-day"><h3>{day}</h3>{rows.map((row) => { const state = row.teachers[teacher as keyof typeof row.teachers] || ""; const displayState = state.replace(/^Apoyo\b/, "Apoyo disponible"); const muted = !matches(query, displayState, teacher); const session = records.flatMap((record) => record.sessions).find((item) => item.date === date && item.time === row.time && item.absent === teacher); return <article className={`teacher-entry ${statusClass(state)} ${muted ? "muted" : ""} ${teacherAbsent ? "has-absence" : ""}`} key={row.time}><span>{row.time}</span><strong>{displayState || "—"}</strong>{teacherAbsent && state !== "RECREO" && <small className="absence-badge">Ausente{session?.substitute ? ` · Sustituye: ${session.substitute}` : " · Pendiente"}</small>}</article>; })}</div>; }
function statusClass(status: string) { if (status.startsWith("DC ")) return "state-shared"; if (status.startsWith("Apoyo")) return "state-support"; if (status === "RECREO") return "state-recess"; if (status.includes("Atención a familias") || status.includes("Coordinación") || status.includes("Reducción")) return "state-complementary"; if (status === "NO DISPONIBLE") return "state-unavailable"; return "state-direct"; }

function LoadsView() { return <><div className="toolbar standalone-print"><button className="primary" onClick={() => window.print()}>Imprimir cargas</button></div><LoadsTable/></>; }
function LoadsTable() { const { records, referenceDate } = useAbsenceContext(); const absent = activeTeacherNames(records, referenceDate); return <section className="panel loads"><PanelTitle eyebrow="Cómputo docente V2" title="Cargas semanales" aside={<span className="validation">Fuente: Excel V2</span>}/><div className="load-table"><div className="load-row head"><span>Docente</span><span>Docencia</span><span>Docencia compartida</span><span>Recreo</span><span>At. familias</span><span>Coordinación</span><span>Reducción tutorial</span><span>Horas computadas</span><span>Apoyo</span><span>Total semanal</span></div>{TEACHERS.map((teacher) => { const load = schedule.teacherLoads[teacher]; return <div className={`load-row ${absent.includes(teacher) ? "has-absence" : ""}`} key={teacher}><strong>{teacher}{absent.includes(teacher) && <small className="absence-badge">Ausente</small>}</strong><span>{formatMinutes(load.direct)}</span><span>{formatMinutes(load.shared)}</span><span>{formatMinutes(load.recess)}</span><span>{formatMinutes(load.family)}</span><span>{formatMinutes(load.coordination)}</span><span>{formatMinutes(load.tutorial)}</span><strong>{formatMinutes(load.computed)}</strong><span>{formatMinutes(load.support)}</span><strong className="load-total">{formatMinutes(load.total)}</strong></div>; })}</div><p className="table-note">“Apoyo” identifica únicamente los huecos residuales disponibles. La segunda persona dentro del aula se computa como docencia compartida.</p></section>; }

function SubstitutionsView() {
  const { records, setRecords, referenceDate, setReferenceDate } = useAbsenceContext();
  const [view, setView] = useState<SubstitutionView>("resolver");
  const [date, setDate] = useState(referenceDate);
  const [kind, setKind] = useState<AbsenceKind>("day");
  const [endDate, setEndDate] = useState(referenceDate);
  const [absent, setAbsent] = useState<string[]>([]);
  const [slot, setSlot] = useState(schedule.slots.Lunes[0]);
  const [query, setQuery] = useState("");
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState("");
  const day = dayFromDate(date);
  const registered = activeTeacherNames(records, date);
  const effectiveAbsent = Array.from(new Set([...registered, ...absent]));

  useEffect(() => {
    setReferenceDate(date);
    setEndDate((current) => current < date ? date : current);
    setAbsent([]);
    setFeedback("");
    const saved: Record<string, string> = {};
    records.filter((record) => isActive(record, date)).flatMap((record) => record.sessions).filter((session) => session.date === date && session.substitute).forEach((session) => { saved[`${session.date}|${session.time}|${session.group}|${session.absent}`] = session.substitute; });
    setAssignments(saved);
    if (DAYS.includes(day)) { const daySlots = schedule.slots[day as keyof typeof schedule.slots]; if (!daySlots.includes(slot)) setSlot(daySlots[0]); }
  }, [date, records]);

  const scenarios = substitutions.scenarios.filter((scenario) => scenario["Día"] === day && effectiveAbsent.includes(scenario["Docente ausente"]) && matches(query, scenario["Docente ausente"], scenario["Actividad"], scenario["Grupo"], scenario["Franja"]));
  const competition = candidateCompetition(scenarios, effectiveAbsent);
  const toggleAbsent = (teacher: string) => setAbsent((current) => current.includes(teacher) ? current.filter((name) => name !== teacher) : [...current, teacher]);
  const savePlan = () => {
    if (!DAYS.includes(day)) { setFeedback("Selecciona una fecha lectiva de lunes a viernes."); return; }
    if (!effectiveAbsent.length) { setFeedback("Selecciona al menos un docente ausente."); return; }
    const finalEnd = kind === "day" ? date : endDate;
    if (finalEnd < date) { setFeedback("La fecha final no puede ser anterior a la fecha inicial."); return; }
    setRecords((current) => {
      let next = [...current];
      effectiveAbsent.forEach((teacher, index) => {
        const active = next.find((record) => record.teacher === teacher && isActive(record, date));
        if (active) {
          const sessions = active.sessions.map((session) => session.date === date ? { ...session, substitute: assignments[`${session.date}|${session.time}|${session.group}|${session.absent}`] || "" } : session);
          next = next.map((record) => record.id === active.id ? { ...record, sessions } : record);
          return;
        }
        const existing = next.find((record) => record.teacher === teacher && record.startDate === date && record.endDate === finalEnd);
        const saved = Object.fromEntries((existing?.sessions || []).map((session) => [`${session.date}|${session.time}|${session.group}|${session.absent}`, session.substitute]));
        const sessions = projectedSessions(teacher, date, finalEnd, { ...saved, ...assignments });
        const record: AbsenceRecord = { id: existing?.id || `${teacher}-${Date.now()}-${index}`, teacher, kind, startDate: date, endDate: finalEnd, createdAt: existing?.createdAt || new Date().toISOString(), sessions };
        next = existing ? next.map((item) => item.id === existing.id ? record : item) : [...next, record];
      });
      return next;
    });
    setAbsent([]);
    setFeedback(`Planificación guardada para ${effectiveAbsent.length} docente${effectiveAbsent.length === 1 ? "" : "s"}.`);
  };

  return <><div className="sub-tabs"><button className={view === "resolver" ? "active" : ""} onClick={() => setView("resolver")}>Resolver faltas</button><button className={view === "availability" ? "active" : ""} onClick={() => setView("availability")}>Disponibilidad por franja</button><button className={view === "support" ? "active" : ""} onClick={() => setView("support")}>Apoyos disponibles</button><button className={view === "dashboard" ? "active" : ""} onClick={() => setView("dashboard")}>Dashboard e historial</button></div>{view !== "dashboard" && <div className="toolbar standalone-print"><button className="primary" onClick={() => window.print()}>Imprimir vista de sustituciones</button></div>}
    {view === "resolver" && <><Toolbar query={query} setQuery={setQuery} placeholder="Buscar falta, grupo o asignatura…"><label>Fecha a resolver<input type="date" value={date} onChange={(event) => setDate(event.target.value)}/></label><label>Tipo de ausencia<select value={kind} onChange={(event) => setKind(event.target.value as AbsenceKind)}><option value="day">Falta puntual del día</option><option value="period">Baja por periodo</option></select></label>{kind === "period" && <label>Hasta<input type="date" min={date} value={endDate} onChange={(event) => setEndDate(event.target.value)}/></label>}<button className="primary" onClick={savePlan}>Guardar planificación</button></Toolbar><div className="storage-note"><b>{day}</b> · Registro guardado en este navegador. La fecha seleccionada también define la semana operativa del resto del site.</div>{feedback && <div className={feedback.startsWith("Planificación") ? "success" : "warning"}>{feedback}</div>}<section className="sub-layout"><aside className="panel absence-picker"><p className="eyebrow">Docentes ausentes</p><h2>Selecciona uno o varios</h2><div>{TEACHERS.map((teacher) => { const stored = registered.includes(teacher); return <label className={stored ? "registered" : ""} key={teacher}><input type="checkbox" checked={stored || absent.includes(teacher)} disabled={stored} onChange={() => toggleAbsent(teacher)}/><span>{teacher}</span>{stored && <small>Registrada</small>}</label>; })}</div></aside><section className="sub-results">{effectiveAbsent.length === 0 && <div className="panel empty-state"><b>Selecciona la fecha y el personal ausente.</b><span>Se mostrarán todas sus sesiones y candidatos P1 → P6.</span></div>}{effectiveAbsent.length > 0 && scenarios.length === 0 && <div className="panel empty-state"><b>No hay sesiones lectivas coincidentes.</b><span>Comprueba los filtros o selecciona otra fecha.</span></div>}{Object.keys(competition).length > 0 && <div className="warning"><b>Competencia detectada:</b> {Object.entries(competition).map(([key, names]) => `${key}: ${names.join(", ")}`).join(" · ")}. El sistema impide asignar una persona dos veces en la misma franja.</div>}{scenarios.map((scenario) => <ScenarioCard key={scenarioAssignmentKey(date, scenario)} date={date} scenario={scenario} absent={effectiveAbsent} assignments={assignments} setAssignments={setAssignments}/>)}</section></section></>}
    {view === "availability" && <AvailabilityView date={date} setDate={setDate} slot={slot} setSlot={setSlot} query={query} setQuery={setQuery}/>}
    {view === "support" && <SupportAvailabilityView referenceDate={date} setReferenceDate={setDate} query={query} setQuery={setQuery}/>}
    {view === "dashboard" && <DashboardView referenceDate={date} setReferenceDate={setDate}/>}</>;
}
function scenarioKey(scenario: Scenario) { return `${scenario["Día"]}|${scenario["Franja"]}|${scenario["Docente ausente"]}`; }
function scenarioCandidates(scenario: Scenario, absent: string[]) { return PRIORITIES.map(([field, label], index) => ({ priority: index + 1, label, teachers: (scenario[field] || "").split(",").map((name) => name.trim()).filter((name) => name && name !== "—" && !absent.includes(name)) })); }
function candidateCompetition(scenarios: Scenario[], absent: string[]) { const occurrences = new Map<string, string[]>(); for (const scenario of scenarios) { const optional = scenario["Rol ausente"].toLocaleLowerCase("es").includes("compartida") && scenario["Cobertura obligatoria"] !== "Sí"; const groups = scenarioCandidates(scenario, absent).filter((group) => !optional || group.priority > 1); const first = groups.find((group) => group.teachers.length); if (!first) continue; for (const teacher of first.teachers) { const key = `${scenario["Franja"]}|${teacher}`; occurrences.set(key, [...(occurrences.get(key) || []), scenario["Grupo"]]); } } return Object.fromEntries([...occurrences].filter(([, groups]) => groups.length > 1).map(([key, groups]) => [key.replace("|", " · "), groups])); }
function projectedSessions(teacher: string, startDate: string, endDate: string, assignmentMap: Record<string, string>) { return datesBetween(startDate, endDate).flatMap((date) => { const day = dayFromDate(date); if (!DAYS.includes(day)) return []; return substitutions.scenarios.filter((scenario) => scenario["Día"] === day && scenario["Docente ausente"] === teacher).map((scenario) => ({ date, day, time: scenario["Franja"], group: scenario["Grupo"], subject: scenario["Actividad"], absent: teacher, substitute: assignmentMap[scenarioAssignmentKey(date, scenario)] || "", role: scenario["Rol ausente"] })); }); }
function ScenarioCard({ date, scenario, absent, assignments, setAssignments }: { date: string; scenario: Scenario; absent: string[]; assignments: Record<string, string>; setAssignments: React.Dispatch<React.SetStateAction<Record<string, string>>> }) {
  const key = scenarioAssignmentKey(date, scenario); const allGroups = scenarioCandidates(scenario, absent); const optional = scenario["Rol ausente"].toLocaleLowerCase("es").includes("compartida") && scenario["Cobertura obligatoria"] !== "Sí"; const groups = allGroups.filter((group) => !optional || group.priority > 1); const principalPresent = allGroups[0]?.teachers.join(", "); const reserved = new Set(Object.entries(assignments).filter(([otherKey, teacher]) => otherKey !== key && otherKey.startsWith(`${date}|${scenario["Franja"]}|`) && teacher).map(([, teacher]) => teacher));
  return <article className="panel scenario-card"><div className="scenario-head"><div><span>{scenario["Franja"]} · {scenario["Grupo"]}</span><h3>{scenario["Actividad"]}</h3></div><span className={`role-badge ${optional ? "optional" : ""}`}>{scenario["Rol ausente"]}</span></div><p><b>Ausente:</b> {scenario["Docente ausente"]}</p>{optional && <div className="dc-note">Grupo atendido por docente principal — reposición de docencia compartida opcional{principalPresent ? ` · Presente: ${principalPresent}` : ""}</div>}<div className="priority-list">{groups.map((group) => <div className="priority-row" key={group.priority}><b>{group.label}</b><span>{group.teachers.length ? group.teachers.map((teacher) => <i key={teacher}>{teacher}{reserved.has(teacher) ? " · ya asignado" : ""}</i>) : <em>Sin candidatos</em>}</span></div>)}<div className="priority-row"><b>P6 · Equipo directivo</b><span><i>Equipo directivo — consultar disponibilidad</i></span></div></div><label className="assignment">Asignación manual<select value={assignments[key] || ""} onChange={(event) => setAssignments((current) => ({ ...current, [key]: event.target.value }))}><option value="">Sin asignar</option>{groups.map((group) => <optgroup key={group.priority} label={group.label}>{group.teachers.map((teacher) => <option key={teacher} value={teacher} disabled={reserved.has(teacher)}>{teacher}{reserved.has(teacher) ? " — ocupado en esta franja" : ""}</option>)}</optgroup>)}</select></label>{scenario["Observaciones"] && <small className="scenario-note">{scenario["Observaciones"]}</small>}</article>;
}
function AvailabilityView({ date, setDate, slot, setSlot, query, setQuery }: { date: string; setDate: (date: string) => void; slot: string; setSlot: (slot: string) => void; query: string; setQuery: (value: string) => void }) {
  const { records } = useAbsenceContext(); const day = dayFromDate(date); const daySlots = DAYS.includes(day) ? schedule.slots[day as keyof typeof schedule.slots] : []; const current = substitutions.slots.find((item) => item.day === day && item.slot === slot); const absent = activeTeacherNames(records, date); const categories = [["p2", "P2 · Apoyo"], ["p3", "P3 · Docencia compartida disponible para movilización"], ["p4", "P4 · Atención a familias"], ["p5", "P5 · Coordinación / reducción tutorial"]];
  if (!DAYS.includes(day)) return <><Toolbar query={query} setQuery={setQuery}><label>Fecha<input type="date" value={date} onChange={(event) => setDate(event.target.value)}/></label></Toolbar><div className="panel recess-warning"><b>Fecha no lectiva</b><span>Selecciona una fecha de lunes a viernes.</span></div></>;
  if (isRecess(day, slot)) return <><Toolbar query={query} setQuery={setQuery}><label>Fecha<input type="date" value={date} onChange={(event) => setDate(event.target.value)}/></label><label>Franja<select value={slot} onChange={(event) => setSlot(event.target.value)}>{daySlots.map((time) => <option key={time}>{time}</option>)}</select></label></Toolbar><div className="panel recess-warning"><b>Vigilancia de recreo pendiente de cuadrante específico</b><span>No se infiere disponibilidad durante el recreo.</span></div></>;
  return <><Toolbar query={query} setQuery={setQuery} placeholder="Buscar docente o actividad…"><label>Fecha<input type="date" value={date} onChange={(event) => setDate(event.target.value)}/></label><label>Franja<select value={slot} onChange={(event) => setSlot(event.target.value)}>{daySlots.map((time) => <option key={time}>{time}</option>)}</select></label></Toolbar><section className="availability-grid">{categories.map(([kind, title]) => { const people = Object.entries(current?.teachers || {}).filter(([teacher, state]) => state.kind === kind && !absent.includes(teacher) && matches(query, teacher, state.status)); return <article className="panel availability-card" key={kind}><h3>{title}</h3>{people.length ? people.map(([teacher, state]) => <div key={teacher}><b>{teacher}</b><span>{state.status}</span></div>) : <p>Sin disponibilidad en esta prioridad.</p>}</article>; })}<article className="panel availability-card unavailable-list"><h3>No disponibles · docencia directa o ausencia</h3>{Object.entries(current?.teachers || {}).filter(([teacher, state]) => ((state.kind === "docencia" || state.kind === "no_disponible") || absent.includes(teacher)) && matches(query, teacher, state.status)).map(([teacher, state]) => <div className={absent.includes(teacher) ? "has-absence" : ""} key={teacher}><b>{teacher}</b><span>{absent.includes(teacher) ? "AUSENTE" : state.status}</span></div>)}</article><article className="panel availability-card directivo-card"><h3>P6 · Equipo directivo</h3><p>Equipo directivo — consultar disponibilidad</p></article></section></>;
}

function SupportAvailabilityView({ referenceDate, setReferenceDate, query, setQuery }: { referenceDate: string; setReferenceDate: (date: string) => void; query: string; setQuery: (value: string) => void }) {
  const { records } = useAbsenceContext();
  const slots = useMemo(() => Array.from(new Set(DAYS.flatMap((day) => schedule.slots[day as keyof typeof schedule.slots]))).sort((a, b) => { const [aStart, aEnd] = a.split("–"); const [bStart, bEnd] = b.split("–"); return aStart.localeCompare(bStart) || aEnd.localeCompare(bEnd); }), []);
  return <><Toolbar query={query} setQuery={setQuery} placeholder="Buscar docente con apoyo disponible…"><label>Semana de referencia<input type="date" value={referenceDate} onChange={(event) => setReferenceDate(event.target.value)}/></label></Toolbar><section className="panel support-board"><PanelTitle eyebrow="Cobertura P2" title="Apoyos disponibles por día y franja" aside={<span className="support-key">Solo huecos residuales</span>}/><div className="matrix-wrap"><div className="support-matrix"><div className="matrix-heading">Franja</div>{DAYS.map((day) => <div className="matrix-heading" key={day}>{day}</div>)}{slots.map((slot) => <div className="matrix-row" key={slot}><div className="matrix-group">{slot}</div>{DAYS.map((day) => { const valid = schedule.slots[day as keyof typeof schedule.slots].includes(slot); if (!valid) return <div className="support-cell no-slot" key={day}>—</div>; if (isRecess(day, slot)) return <div className="support-cell recess-cell" key={day}>☕ Recreo</div>; const date = dateForDay(referenceDate, day); const absent = activeTeacherNames(records, date); const state = substitutions.slots.find((item) => item.day === day && item.slot === slot); const people = Object.entries(state?.teachers || {}).filter(([teacher, item]) => item.kind === "p2" && matches(query, teacher, item.status)); return <div className="support-cell" key={day}>{people.length ? people.map(([teacher]) => <span className={`support-chip ${absent.includes(teacher) ? "absent" : ""}`} key={teacher}>{teacher}{absent.includes(teacher) ? " · ausente" : ""}</span>) : <span className="empty">Sin apoyos</span>}</div>; })}</div>)}</div></div></section></>;
}

function DashboardView({ referenceDate, setReferenceDate }: { referenceDate: string; setReferenceDate: (date: string) => void }) {
  const { records, setRecords } = useAbsenceContext(); const [scope, setScope] = useState<"day" | "week">("week"); const dates = scope === "day" ? [referenceDate] : DAYS.map((day) => dateForDay(referenceDate, day)); const sessions = records.flatMap((record) => record.sessions).filter((session) => dates.includes(session.date)).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time) || a.group.localeCompare(b.group)); const inScope = records.filter((record) => dates.some((date) => isActive(record, date))); const assigned = sessions.filter((session) => session.substitute).length; const pending = sessions.length - assigned; const absenceDays = new Set(inScope.flatMap((record) => dates.filter((date) => isActive(record, date)).map((date) => `${record.teacher}|${date}`))).size; const counts = Object.entries(inScope.reduce<Record<string, number>>((acc, record) => { acc[record.teacher] = (acc[record.teacher] || 0) + datesBetween(record.startDate, record.endDate).filter((date) => dates.includes(date)).length; return acc; }, {})).sort((a, b) => b[1] - a[1]); const max = Math.max(...counts.map(([, value]) => value), 1);
  const exportHistory = () => { const rows = [["Docente ausente", "Desde", "Hasta", "Fecha", "Día", "Franja", "Grupo", "Asignatura", "Sustituto"], ...records.flatMap((record) => record.sessions.map((session) => [record.teacher, record.startDate, record.endDate, session.date, session.day, session.time, session.group, session.subject, session.substitute || "Pendiente"]))]; const csv = rows.map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(",")).join("\n"); const blob = new Blob([csv], { type: "text/csv;charset=utf-8" }); const anchor = document.createElement("a"); anchor.href = URL.createObjectURL(blob); anchor.download = "historial-sustituciones.csv"; anchor.click(); URL.revokeObjectURL(anchor.href); };
  const removeRecord = (id: string) => { if (window.confirm("¿Eliminar este registro de ausencia y sus sustituciones?")) setRecords((current) => current.filter((record) => record.id !== id)); };
  return <><div className="toolbar dashboard-toolbar"><label>Fecha de referencia<input type="date" value={referenceDate} onChange={(event) => setReferenceDate(event.target.value)}/></label><label>Planificación<select value={scope} onChange={(event) => setScope(event.target.value as "day" | "week")}><option value="day">Día seleccionado</option><option value="week">Semana completa</option></select></label><button className="primary" disabled={!sessions.length} title={sessions.length ? "Imprimir planificación" : "No hay ausencias registradas en el periodo"} onClick={() => window.print()}>Imprimir planificación</button><button className="secondary" onClick={exportHistory}>↓ Exportar historial CSV</button></div><section className="dashboard-stats"><article className="panel"><strong>{inScope.length}</strong><span>Ausencias registradas</span></article><article className="panel"><strong>{absenceDays}</strong><span>Días-persona</span></article><article className="panel"><strong>{assigned}</strong><span>Sesiones cubiertas</span></article><article className={`panel ${pending ? "pending" : ""}`}><strong>{pending}</strong><span>Sesiones pendientes</span></article></section><section className="dashboard-grid"><article className="panel dashboard-chart"><p className="eyebrow">Distribución</p><h2>Ausencias por docente</h2>{counts.length ? counts.map(([teacher, value]) => <div className="bar-row" key={teacher}><span>{teacher}</span><i><b style={{ width: `${Math.max(8, value / max * 100)}%` }}/></i><strong>{value}</strong></div>) : <p className="empty-copy">No hay ausencias en el periodo seleccionado.</p>}</article><article className="panel coverage-chart"><p className="eyebrow">Cobertura</p><h2>Estado de la planificación</h2><div className="coverage-ring" style={{ "--coverage": `${sessions.length ? assigned / sessions.length * 100 : 0}%` } as React.CSSProperties}><strong>{sessions.length ? Math.round(assigned / sessions.length * 100) : 0}%</strong><span>asignado</span></div><div className="coverage-legend"><span><i className="done"/>Cubiertas · {assigned}</span><span><i/>Pendientes · {pending}</span></div></article></section><section className="panel planning-table"><PanelTitle eyebrow="Programación dinámica" title={`Sustituciones proyectadas · ${scope === "day" ? "día" : "semana"}`} aside={<span className="validation">{sessions.length} sesiones</span>}/><div className="planning-scroll"><div className="planning-row head"><span>Fecha</span><span>Franja</span><span>Grupo / materia</span><span>Ausente</span><span>Sustituto</span><span>Estado</span></div>{sessions.map((session, index) => <div className="planning-row" key={`${session.date}-${session.time}-${session.absent}-${index}`}><span><b>{session.date}</b><small>{session.day}</small></span><span>{session.time}</span><span><b>{session.group}</b><small>{session.subject}</small></span><span className="absence-badge">{session.absent}</span><span>{session.substitute || "—"}</span><span className={`plan-status ${session.substitute ? "done" : "pending"}`}>{session.substitute ? "Asignada" : "Pendiente"}</span></div>)}{!sessions.length && <div className="empty-state">No hay sustituciones proyectadas para este periodo.</div>}</div></section><section className="panel history"><PanelTitle eyebrow="Registro persistente" title="Historial de ausencias" aside={<span className="storage-pill">Este navegador</span>}/>{records.length ? records.slice().sort((a, b) => b.startDate.localeCompare(a.startDate)).map((record) => <article key={record.id}><div><strong>{record.teacher}</strong><span>{record.kind === "day" ? "Falta puntual" : "Baja por periodo"} · {record.startDate}{record.endDate !== record.startDate ? ` → ${record.endDate}` : ""}</span></div><div><b>{record.sessions.filter((session) => session.substitute).length}/{record.sessions.length}</b><span>sesiones asignadas</span></div><button className="danger-link" onClick={() => removeRecord(record.id)}>Eliminar</button></article>) : <p className="empty-copy">Todavía no hay registros guardados.</p>}</section></>;
}

type PrintSectionKey = "groups" | "days" | "subjects" | "teachers" | "loads" | "substitutions";
type PrintSections = Record<PrintSectionKey, boolean>;

function PrintCenter() {
  const { records, referenceDate, setReferenceDate } = useAbsenceContext();
  const allSubjects = useMemo(() => Array.from(new Set(schedule.lessons.map((lesson) => lesson.subject))).sort((a, b) => a.localeCompare(b, "es")), []);
  const [sections, setSections] = useState<PrintSections>({ groups: true, days: false, subjects: false, teachers: false, loads: false, substitutions: false });
  const [selectedGroups, setSelectedGroups] = useState<string[]>([...GROUPS]);
  const [selectedDays, setSelectedDays] = useState<string[]>([...DAYS]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([...allSubjects]);
  const [selectedTeachers, setSelectedTeachers] = useState<string[]>([...TEACHERS]);
  const [teacherType, setTeacherType] = useState<TeacherType>("all");
  const [subjectType, setSubjectType] = useState<SubjectType>("all");
  const [substitutionScope, setSubstitutionScope] = useState<"day" | "week">("week");
  const [paper, setPaper] = useState<"A4" | "A3">("A4");
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("landscape");
  const [fitMode, setFitMode] = useState<"fit" | "manual">("fit");
  const [scale, setScale] = useState("90");
  const roleName: Record<TeacherType, string> = { all: "", tutors: "Tutor/a", specialists: "Especialista", shared: "Docencia compartida", support: "Apoyo disponible" };
  const filteredTeachers = TEACHERS.filter((teacher) => !roleName[teacherType] || schedule.teacherRoles[teacher]?.includes(roleName[teacherType]));
  const filteredSubjects = allSubjects.filter((subject) => subjectType === "all" || subjectType === "tutoring" || family(subject) === subjectType);
  const dates = substitutionScope === "day" ? [referenceDate] : DAYS.map((day) => dateForDay(referenceDate, day));
  const planningSessions = records.flatMap((record) => record.sessions).filter((session) => dates.includes(session.date)).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time) || a.group.localeCompare(b.group));
  const enabledSections = Object.values(sections).filter(Boolean).length;
  const reportParts = (sections.groups ? selectedGroups.length : 0) + (sections.days ? selectedDays.length : 0) + (sections.subjects ? selectedSubjects.filter((name) => filteredSubjects.includes(name)).length : 0) + (sections.teachers ? selectedTeachers.filter((name) => filteredTeachers.includes(name)).length : 0) + Number(sections.loads) + Number(sections.substitutions);

  useEffect(() => {
    let style = document.querySelector<HTMLStyleElement>("#print-page-settings");
    if (!style) { style = document.createElement("style"); style.id = "print-page-settings"; document.head.appendChild(style); }
    style.textContent = `@page { size: ${paper} ${orientation}; margin: 10mm; }`;
    return () => style?.remove();
  }, [paper, orientation]);

  const setAllSections = (value: boolean) => setSections({ groups: value, days: value, subjects: value, teachers: value, loads: value, substitutions: value });
  const printReport = () => { if (reportParts > 0) window.print(); };
  const automaticScale = paper === "A4" ? (orientation === "landscape" ? .9 : .78) : 1;
  const effectiveScale = fitMode === "fit" ? automaticScale : Number(scale) / 100;
  const reportStyle = { "--print-scale": effectiveScale } as React.CSSProperties;

  return <div className="print-center" style={reportStyle}>
    <section className="panel print-config">
      <PanelTitle eyebrow="Centro de impresión" title="Generar informe único" aside={<span className="validation">{reportParts} bloques seleccionados</span>}/>
      <p className="print-help">Combina varios horarios en un único documento. El botón final abre la impresión del navegador, donde también puedes elegir «Guardar como PDF».</p>
      <div className="print-settings">
        <label>Formato<select value={paper} onChange={(event) => setPaper(event.target.value as "A4" | "A3")}><option>A4</option><option>A3</option></select></label>
        <label>Orientación<select value={orientation} onChange={(event) => setOrientation(event.target.value as "portrait" | "landscape")}><option value="portrait">Vertical</option><option value="landscape">Horizontal</option></select></label>
        <label>Ajuste<select value={fitMode} onChange={(event) => setFitMode(event.target.value as "fit" | "manual")}><option value="fit">Ajustar a página</option><option value="manual">Escala manual</option></select></label>
        <label>Escala<select value={scale} disabled={fitMode === "fit"} onChange={(event) => setScale(event.target.value)}>{[60, 70, 80, 90, 100].map((value) => <option value={value} key={value}>{value}%</option>)}</select></label>
        <label>Fecha de referencia<input type="date" value={referenceDate} onChange={(event) => setReferenceDate(event.target.value)}/></label>
      </div>
      <div className="print-section-head"><h3>Páginas incluidas</h3><span><button onClick={() => setAllSections(true)}>Seleccionar todas</button><button onClick={() => setAllSections(false)}>Ninguna</button></span></div>
      <div className="print-section-grid">
        {([['groups', 'Grupos'], ['days', 'Por días'], ['subjects', 'Asignaturas'], ['teachers', 'Docentes'], ['loads', 'Cargas'], ['substitutions', 'Sustituciones']] as [PrintSectionKey, string][]).map(([key, label]) => <label className={sections[key] ? "active" : ""} key={key}><input type="checkbox" checked={sections[key]} onChange={() => setSections((current) => ({ ...current, [key]: !current[key] }))}/><b>{label}</b></label>)}
      </div>
      <div className="print-option-grid">
        {sections.groups && <PrintOptionList title="Grupos" options={GROUPS} selected={selectedGroups} setSelected={setSelectedGroups}/>}
        {sections.days && <PrintOptionList title="Días" options={DAYS} selected={selectedDays} setSelected={setSelectedDays}/>}
        {sections.subjects && <div className="panel print-option-card"><label className="print-filter">Tipo de asignatura<select value={subjectType} onChange={(event) => setSubjectType(event.target.value as SubjectType)}><option value="all">Todas</option><option value="tutoring">Tutoría</option><option value="core">Troncales</option><option value="lang">Idiomas</option><option value="spec">Especialidades</option></select></label><PrintOptionList title="Asignaturas" options={filteredSubjects} selected={selectedSubjects} setSelected={setSelectedSubjects} embedded/></div>}
        {sections.teachers && <div className="panel print-option-card"><label className="print-filter">Tipo de docente<select value={teacherType} onChange={(event) => setTeacherType(event.target.value as TeacherType)}><option value="all">Todos</option><option value="tutors">Tutores</option><option value="specialists">Especialistas</option><option value="shared">Docencia compartida</option><option value="support">Apoyo disponible</option></select></label><PrintOptionList title="Docentes" options={filteredTeachers} selected={selectedTeachers} setSelected={setSelectedTeachers} embedded/></div>}
        {sections.loads && <div className="panel print-option-card print-fixed-option"><b>Cargas semanales</b><span>Se incluirá la tabla completa.</span></div>}
        {sections.substitutions && <div className="panel print-option-card"><label className="print-filter">Planificación<select value={substitutionScope} onChange={(event) => setSubstitutionScope(event.target.value as "day" | "week")}><option value="day">Día seleccionado</option><option value="week">Semana completa</option></select></label><span className="print-count">{planningSessions.length} sesiones registradas</span></div>}
      </div>
      <div className="print-actions"><button className="primary" disabled={!enabledSections || !reportParts} onClick={printReport}>Imprimir / Guardar un único PDF</button><span>{paper} · {orientation === "portrait" ? "vertical" : "horizontal"} · {fitMode === "fit" ? `ajuste automático (${Math.round(effectiveScale * 100)}%)` : `escala ${scale}%`}</span></div>
    </section>

    <section className="print-report" aria-label="Vista previa del informe">
      {!reportParts && <div className="panel empty-state"><b>Selecciona al menos una página y una opción.</b><span>La vista previa del informe aparecerá aquí.</span></div>}
      {sections.groups && selectedGroups.map((group) => <PrintGroupReport group={group} key={`group-${group}`}/>)}
      {sections.days && selectedDays.map((day) => <PrintDayReport day={day} key={`day-${day}`}/>)}
      {sections.subjects && selectedSubjects.filter((name) => filteredSubjects.includes(name)).map((subject) => <PrintSubjectReport subject={subject} subjectType={subjectType} key={`subject-${subject}`}/>)}
      {sections.teachers && selectedTeachers.filter((name) => filteredTeachers.includes(name)).map((teacher) => <PrintTeacherReport teacher={teacher} key={`teacher-${teacher}`}/>)}
      {sections.loads && <section className="print-sheet"><PrintSheetHeader eyebrow="Cómputo docente V2" title="Cargas semanales"/><LoadsTable/></section>}
      {sections.substitutions && <PrintPlanningReport scope={substitutionScope} dates={dates} sessions={planningSessions}/>}
    </section>
  </div>;
}

function PrintOptionList({ title, options, selected, setSelected, embedded = false }: { title: string; options: readonly string[]; selected: string[]; setSelected: React.Dispatch<React.SetStateAction<string[]>>; embedded?: boolean }) {
  const toggle = (option: string) => setSelected((current) => current.includes(option) ? current.filter((item) => item !== option) : [...current, option]);
  const content = <><div className="print-section-head"><h3>{title}</h3><span><button onClick={() => setSelected((current) => Array.from(new Set([...current, ...options])))}>Todos</button><button onClick={() => setSelected((current) => current.filter((item) => !options.includes(item)))}>Ninguno</button></span></div><div className="print-check-list">{options.map((option) => <label key={option}><input type="checkbox" checked={selected.includes(option)} onChange={() => toggle(option)}/><span>{option}</span></label>)}</div></>;
  return embedded ? <div className="print-option-embedded">{content}</div> : <div className="panel print-option-card">{content}</div>;
}

function PrintSheetHeader({ eyebrow, title }: { eyebrow: string; title: string }) { return <header className="print-sheet-head"><img src="./logo-srl-v4.webp" alt="Colegio Público Santa Rosa de Lima"/><div><span>{eyebrow}</span><h2>{title}</h2><small>CEIP Santa Rosa de Lima · Curso 2026–27</small></div></header>; }

function PrintGroupReport({ group }: { group: string }) { return <section className="print-sheet"><PrintSheetHeader eyebrow="Horario de grupo" title={`${group} Primaria`}/><WeekGrid group={group} query=""/></section>; }

function PrintDayReport({ day }: { day: string }) {
  const { referenceDate } = useAbsenceContext(); const slots = schedule.slots[day as keyof typeof schedule.slots];
  return <section className="print-sheet"><PrintSheetHeader eyebrow="Organización diaria" title={day}/><div className="day-matrix print-day-matrix" style={{ gridTemplateColumns: `90px repeat(${slots.length}, minmax(0, 1fr))` }}><div className="matrix-heading">Grupo</div>{slots.map((time) => <div className="matrix-heading" key={time}>{time}</div>)}{GROUPS.map((group) => <div className="matrix-row" key={group}><div className="matrix-group">{group}</div>{slots.map((time) => { if (isRecess(day, time)) return <div className="matrix-recess" key={time}>☕ Recreo</div>; const lesson = lessonsFor(group, day).find((item) => item.time === time); return <div className="matrix-cell" key={time}>{lesson ? <LessonCard lesson={lesson} query="" compact date={dateForDay(referenceDate, day)}/> : <span>—</span>}</div>; })}</div>)}</div></section>;
}

function PrintSubjectReport({ subject, subjectType }: { subject: string; subjectType: SubjectType }) {
  const { referenceDate } = useAbsenceContext();
  const allowed = (lesson: Lesson) => lesson.subject === subject && (subjectType !== "tutoring" || lesson.primary === schedule.tutors[lesson.group as keyof typeof schedule.tutors]);
  return <section className="print-sheet"><PrintSheetHeader eyebrow="Distribución por asignatura" title={subject}/><div className="subject-matrix print-subject-matrix"><div className="matrix-heading">Grupo</div>{DAYS.map((day) => <div className="matrix-heading" key={day}>{day}</div>)}{GROUPS.map((group) => <div className="matrix-row" key={group}><div className="matrix-group">{group}</div>{DAYS.map((day) => { const lessons = lessonsFor(group, day).filter(allowed); return <div className="subject-cell" key={day}>{lessons.length ? lessons.map((lesson) => <LessonCard lesson={lesson} query="" compact date={dateForDay(referenceDate, day)} key={lesson.time}/>) : <span className="empty">—</span>}</div>; })}</div>)}</div></section>;
}

function PrintTeacherReport({ teacher }: { teacher: string }) {
  const load = schedule.teacherLoads[teacher];
  const extra = schedule.complementaryEvents.filter((event) => event.teacher === teacher && event.schedule.includes("14:00–15:00"));
  return <section className="print-sheet"><PrintSheetHeader eyebrow="Horario individual" title={teacher}/><p className="print-role">{schedule.teacherRoles[teacher]?.join(" · ") || "Funciones no lectivas"}</p><div className="summary-stats print-summary">{summaryStat("Total semanal", load.total, true)}{summaryStat("Docencia", load.direct)}{summaryStat("Docencia compartida", load.shared)}{summaryStat("Recreo", load.recess)}{summaryStat("Complementarias", load.family + load.coordination)}{summaryStat("Reducción tutorial", load.tutorial)}{summaryStat("Apoyo disponible", load.support)}</div>{extra.map((event) => <div className="notice" key={event.schedule}><b>Excepción autorizada:</b> {event.concept} · {event.schedule}.</div>)}<div className="teacher-days print-teacher-days">{DAYS.map((day) => <TeacherDay key={day} teacher={teacher} day={day} query=""/>)}</div></section>;
}

function PrintPlanningReport({ scope, dates, sessions }: { scope: "day" | "week"; dates: string[]; sessions: SavedAssignment[] }) {
  return <section className="print-sheet"><PrintSheetHeader eyebrow="Cobertura de ausencias" title={`Planificación de sustituciones · ${scope === "day" ? "día" : "semana"}`}/><p className="print-role">Periodo: {dates[0]}{dates.length > 1 ? ` → ${dates[dates.length - 1]}` : ""}</p><div className="planning-scroll"><div className="planning-row head"><span>Fecha</span><span>Franja</span><span>Grupo / materia</span><span>Ausente</span><span>Sustituto</span><span>Estado</span></div>{sessions.map((session, index) => <div className="planning-row" key={`${session.date}-${session.time}-${session.absent}-${index}`}><span><b>{session.date}</b><small>{session.day}</small></span><span>{session.time}</span><span><b>{session.group}</b><small>{session.subject}</small></span><span>{session.absent}</span><span>{session.substitute || "—"}</span><span className={`plan-status ${session.substitute ? "done" : "pending"}`}>{session.substitute ? "Asignada" : "Pendiente"}</span></div>)}{!sessions.length && <div className="empty-state">No hay ausencias o sustituciones registradas en el periodo seleccionado.</div>}</div></section>;
}
