"use client";

import { useMemo, useState } from "react";

type Tab = "groups" | "teachers" | "loads" | "issues";
type Lesson = { time: string; subject: string; teachers: string[]; minutes: number; issue?: boolean };
type DayPlan = Record<string, Lesson[]>;

const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];
const GROUPS = ["1", "2A", "2B", "3", "4", "5A", "5B", "6A", "6B"];
const TUTORS: Record<string, string> = {
  "1": "Belén", "2A": "Sandra", "2B": "Dámaris", "3": "David M",
  "4": "María Molina", "5A": "Antonio", "5B": "Ana G", "6A": "Ana B", "6B": "María Muñoz",
};

const LABELS: Record<string, string> = {
  LEN: "Lengua", MAT: "Matemáticas", CN: "C. Naturales", CS: "C. Sociales",
  ING: "Inglés", FRA: "Francés", EF: "Educación Física", PLA: "Plástica",
  MUS: "Música", PROF: "Profundización", RAE: "Religión / Atención educativa", VAL: "Valores",
};

const GROUP_DATA: Record<string, DayPlan> = {
  "1": {
    Lunes: [l("09:00–10:00","ING",["Iria"],60),l("10:00–10:45","LEN",["Belén","Malu"],45),l("10:45–11:30","LEN",["Belén","Malu"],45),l("12:00–13:00","EF",["Fede"],60),l("13:00–14:00","MAT",["Belén","Malu"],60)],
    Martes: [l("09:00–10:00","CN",["Belén"],60),l("10:00–10:45","LEN",["Belén","Malu"],45),l("10:45–11:30","LEN",["Belén","Malu"],45),l("12:00–13:00","EF",["Fede"],60),l("13:00–14:00","MAT",["Belén","Malu"],60)],
    Miércoles: [l("09:00–10:00","ING",["Iria"],60),l("10:00–10:45","MAT",["Belén","Malu"],45),l("10:45–11:30","MAT",["Belén","Malu"],45),l("12:00–13:00","PLA",["Belén"],60),l("13:00–14:00","LEN",["Belén","Malu"],60)],
    Jueves: [l("09:00–10:00","CN",["Belén"],60),l("10:00–10:45","MAT",["Belén"],45),l("10:45–11:30","LEN",["Belén"],45),l("12:00–13:00","MUS",["Mamen"],60),l("13:00–14:00","PROF",["Iria"],60)],
    Viernes: [l("09:00–10:30","CS",["Belén"],90),l("10:30–11:15","LEN",["Belén","Malu"],45),l("11:45–12:30","MAT",["Belén","Malu"],45),l("12:30–14:00","RAE",["Belén"],90)],
  },
  "2A": secondA(),
  "2B": secondB(),
  "3": {
    Lunes: [l("09:00–10:00","PLA",["David A"],60),l("10:00–10:45","CS",["David M"],45),l("10:45–11:30","ING",["Iria"],45),l("12:00–13:00","MAT",["David M","Mariló"],60),l("13:00–14:00","MUS",["Mamen"],60)],
    Martes: [l("09:00–10:00","EF",["Gabriel"],60),l("10:00–10:45","LEN",["David M","Mariló"],45),l("10:45–11:30","LEN",["David M","Mariló"],45),l("12:00–13:00","CN",["David M"],60),l("13:00–14:00","MAT",["David M","Mariló"],60)],
    Miércoles: [l("09:00–10:00","LEN",["David M","Mariló"],60),l("10:00–10:45","ING",["Iria"],45),l("10:45–11:30","MAT",["David M","Mariló"],45),l("12:00–13:00","CN",["David M"],60),l("13:00–14:00","EF",["Gabriel"],60)],
    Jueves: [l("09:00–10:00","MAT",["David M","Mariló"],60),l("10:00–10:45","ING",["Iria"],45),l("10:45–11:30","CS",["David M"],45),l("12:00–13:00","PROF",["Iria"],60),l("13:00–14:00","LEN",["David M","Mariló"],60)],
    Viernes: [l("09:00–10:30","LEN",["David M","Mariló"],90),l("10:30–11:15","ING",["Iria"],45),l("11:45–12:30","MAT",["David M","Mariló"],45),l("12:30–14:00","RAE",["David A"],90)],
  },
  "4": {
    Lunes: [l("09:00–10:00","EF",["Gabriel"],60),l("10:00–10:45","LEN",["María Molina","Cristina"],45),l("10:45–11:30","LEN",["María Molina","Cristina"],45),l("12:00–13:00","PROF",["Iria"],60),l("13:00–14:00","MAT",["María Molina","SUPÉRATE"],60)],
    Martes: [l("09:00–10:00","LEN",["María Molina","Cristina"],60),l("10:00–10:45","ING",["Iria"],45),l("10:45–11:30","ING",["Iria"],45),l("12:00–13:00","CN",["María Molina"],60),l("13:00–14:00","MAT",["María Molina","SUPÉRATE"],60)],
    Miércoles: [l("09:00–10:00","LEN",["María Molina","Cristina"],60),l("10:00–10:45","MAT",["Docente pendiente"],45,true),l("10:45–11:30","MAT",["SUPÉRATE"],45),l("12:00–13:00","PLA",["David A"],60),l("13:00–14:00","CN",["María Molina"],60)],
    Jueves: [l("09:00–10:00","MAT",["María Molina","SUPÉRATE"],60),l("10:00–10:45","LEN",["María Molina","Cristina"],45),l("10:45–11:30","LEN",["María Molina","Cristina","Gabriel"],45),l("12:00–13:00","EF",["Gabriel"],60),l("13:00–14:00","MUS",["Mamen"],60)],
    Viernes: [l("09:00–10:30","RAE",["David A"],90),l("10:30–11:15","CS",["David A"],45),l("11:45–12:30","CS",["David A"],45),l("12:30–14:00","ING",["Iria"],90)],
  },
  "5A": {
    Lunes: [l("09:00–10:00","ING",["María Muñoz"],60),l("10:00–10:45","CN",["Antonio"],45),l("10:45–11:30","CN",["Antonio"],45),l("12:00–13:00","MUS",["Mamen"],60),l("13:00–14:00","MAT",["Antonio","David A"],60)],
    Martes: [l("09:00–10:00","LEN",["Antonio","Ana G"],60),l("10:00–10:45","MAT",["Antonio","David A"],45),l("10:45–11:30","MAT",["Antonio","David A"],45),l("12:00–13:00","PLA",["Antonio"],60),l("13:00–14:00","EF",["Gabriel"],60)],
    Miércoles: [l("09:00–10:00","ING",["María Muñoz"],60),l("10:00–10:45","MAT",["Antonio","David A"],45),l("10:45–11:30","CS",["Antonio"],45),l("12:00–13:00","LEN",["Antonio","Ana G"],60),l("13:00–14:00","PROF",["Iria"],60)],
    Jueves: [l("09:00–10:00","ING",["María Muñoz"],60),l("10:00–10:45","MAT",["Antonio","David A"],45),l("10:45–11:30","CS",["Antonio"],45),l("12:00–13:00","LEN",["Antonio","Ana G"],60),l("13:00–14:00","EF",["Gabriel"],60)],
    Viernes: [l("09:00–10:30","RAE",["Antonio"],90),l("10:30–11:15","FRA",["María Molina"],45),l("11:45–12:30","FRA",["María Molina"],45),l("12:30–14:00","LEN",["Antonio","Ana G"],90)],
  },
  "5B": {
    Lunes: [l("09:00–10:00","PLA",["Antonio"],60),l("10:00–10:45","MAT",["Ana G","David A"],45),l("10:45–11:30","MAT",["Ana G","David A"],45),l("12:00–13:00","LEN",["Ana G","Antonio"],60),l("13:00–14:00","EF",["Gabriel"],60)],
    Martes: [l("09:00–10:00","ING",["María Muñoz"],60),l("10:00–10:45","CS",["Ana G"],45),l("10:45–11:30","CS",["Ana G"],45),l("12:00–13:00","MAT",["Ana G","David A"],60),l("13:00–14:00","LEN",["Ana G","Antonio"],60)],
    Miércoles: [l("09:00–10:00","LEN",["Ana G","Antonio"],60),l("10:00–10:45","CN",["Ana G"],45),l("10:45–11:30","MAT",["Ana G","David A"],45),l("12:00–13:00","EF",["Gabriel"],60),l("13:00–14:00","ING",["María Muñoz"],60)],
    Jueves: [l("09:00–10:00","MUS",["Mamen"],60),l("10:00–10:45","CN",["Ana G"],45),l("10:45–11:30","MAT",["Ana G","David A"],45),l("12:00–13:00","ING",["María Muñoz"],60),l("13:00–14:00","LEN",["Ana G","Antonio"],60)],
    Viernes: [l("09:00–10:30","RAE",["Ana G"],90),l("10:30–11:15","LEN",["Ana G","Antonio"],45),l("11:45–12:30","PROF",["Iria"],45),l("12:30–14:00","FRA",["María Molina"],90)],
  },
  "6A": sixthA(),
  "6B": sixthB(),
};

function l(time:string, subject:string, teachers:string[], minutes:number, issue=false): Lesson { return {time,subject,teachers,minutes,issue}; }

function secondA(): DayPlan { return {
  Lunes:[l("09:00–10:00","MAT",["Sandra","Dámaris","SUPÉRATE"],60),l("10:00–10:45","LEN",["Sandra","Dámaris","SUPÉRATE"],45),l("10:45–11:30","LEN",["Sandra","Dámaris","SUPÉRATE"],45),l("12:00–13:00","CN",["Sandra","Dámaris"],60),l("13:00–14:00","EF",["Fede"],60)],
  Martes:[l("09:00–10:00","ING",["Iria"],60),l("10:00–10:45","LEN",["Sandra","Dámaris","SUPÉRATE"],45),l("10:45–11:30","MAT",["Sandra","Dámaris","SUPÉRATE"],45),l("12:00–13:00","MUS",["Mamen"],60),l("13:00–14:00","PROF",["Iria"],60)],
  Miércoles:[l("09:00–10:00","PLA",["Sandra","Dámaris"],60),l("10:00–10:45","LEN",["Sandra","Dámaris","SUPÉRATE"],45),l("10:45–11:30","CS",["Sandra","Dámaris"],45),l("12:00–13:00","EF",["Fede"],60),l("13:00–14:00","MAT",["Sandra","Dámaris","SUPÉRATE"],60)],
  Jueves:[l("09:00–10:00","ING",["Iria"],60),l("10:00–10:45","MAT",["Sandra","Dámaris","SUPÉRATE"],45),l("10:45–11:30","MAT",["Sandra","Dámaris","SUPÉRATE"],45),l("12:00–13:00","LEN",["Sandra","Dámaris","SUPÉRATE"],60),l("13:00–14:00","CN",["Sandra","Dámaris"],60)],
  Viernes:[l("09:00–10:30","LEN",["Sandra","Dámaris","SUPÉRATE"],90),l("10:30–11:15","MAT",["Sandra","Dámaris","SUPÉRATE"],45),l("11:45–12:30","CS",["Sandra","Dámaris"],45),l("12:30–14:00","RAE",["Sandra","Dámaris"],90)],
}; }
function secondB(): DayPlan { const d=secondA(); return {...d,
  Lunes:[...d.Lunes.slice(0,4),l("13:00–14:00","ING",["Iria"],60)],
  Martes:[l("09:00–10:00","EF",["Fede"],60),...d.Martes.slice(1,3),l("12:00–13:00","PROF",["Iria"],60),l("13:00–14:00","MUS",["Mamen"],60)],
  Miércoles:[...d.Miércoles.slice(0,3),l("12:00–13:00","ING",["Iria"],60),d.Miércoles[4]],
  Jueves:[l("09:00–10:00","EF",["Fede"],60),...d.Jueves.slice(1)],
}; }
function sixthA(): DayPlan { return {
  Lunes:[l("09:00–10:00","MAT",["Ana B","Fede"],60),l("10:00–10:45","CS",["Ana B"],45),l("10:45–11:30","ING",["David M"],45),l("12:00–13:00","EF",["Gabriel"],60),l("13:00–14:00","LEN",["Ana B"],60)],
  Martes:[l("09:00–10:00","LEN",["Ana B","Mamen"],60),l("10:00–10:45","FRA",["María Molina"],45),l("10:45–11:30","FRA",["María Molina"],45),l("12:00–13:00","EF",["Gabriel"],60),l("13:00–14:00","MAT",["Ana B","Fede"],60)],
  Miércoles:[l("09:00–10:00","MAT",["Ana B","Fede"],60),l("10:00–10:45","ING",["David M"],45),l("10:45–11:30","CN",["Ana B"],45),l("12:00–13:00","MUS",["Mamen"],60),l("13:00–14:00","LEN",["Ana B","Mamen"],60)],
  Jueves:[l("09:00–10:00","LEN",["Ana B"],60),l("10:00–10:45","ING",["David M"],45),l("10:45–11:30","CN",["Ana B"],45),l("12:00–13:00","MAT",["Ana B","Fede"],60),l("13:00–14:00","PLA",["Fede"],60)],
  Viernes:[l("09:00–10:30","RAE",["Ana B"],90),l("10:30–11:15","ING",["David M"],45),l("11:45–12:30","CS",["Ana B"],45),l("12:30–14:00","VAL",["Mamen"],90)],
}; }
function sixthB(): DayPlan { return {
  Lunes:[l("09:00–10:00","MUS",["Mamen"],60),l("10:00–10:45","CS",["María Muñoz"],45),l("10:45–11:30","VAL",["Mamen"],45),l("12:00–13:00","MAT",["María Muñoz","Ana B"],60),l("13:00–14:00","ING",["David M"],60)],
  Martes:[l("09:00–10:00","ING",["David M"],60),l("10:00–10:45","CN",["María Muñoz"],45),l("10:45–11:30","CN",["María Muñoz"],45),l("12:00–13:00","MAT",["María Muñoz","Ana B"],60),l("13:00–14:00","LEN",["María Muñoz"],60)],
  Miércoles:[l("09:00–10:00","EF",["Gabriel"],60),l("10:00–10:45","FRA",["María Molina"],45),l("10:45–11:30","FRA",["María Molina"],45),l("12:00–13:00","MAT",["María Muñoz","Ana B"],60),l("13:00–14:00","PLA",["Fede"],60)],
  Jueves:[l("09:00–10:00","EF",["Gabriel"],60),l("10:00–10:45","LEN",["María Muñoz","Mamen"],45),l("10:45–11:30","LEN",["María Muñoz","Mamen"],45),l("12:00–13:00","ING",["David M"],60),l("13:00–14:00","MAT",["María Muñoz","Ana B"],60)],
  Viernes:[l("09:00–10:30","RAE",["Fede"],90),l("10:30–11:15","VAL",["Mamen"],45),l("11:45–12:30","CS",["María Muñoz"],45),l("12:30–14:00","LEN",["María Muñoz"],90)],
}; }

type Entry = Lesson & { day:string; group:string };
function allEntries(): Entry[] {
  const rows: Entry[]=[];
  for(const group of GROUPS) for(const day of DAYS) for(const lesson of GROUP_DATA[group][day]) {
    if(group==="2B") {
      const twin=GROUP_DATA["2A"][day].find(x=>x.time===lesson.time && x.subject===lesson.subject && x.teachers.join("|")===lesson.teachers.join("|"));
      if(twin) continue;
    }
    rows.push({...lesson,day,group: group==="2A" && GROUP_DATA["2B"][day].some(x=>x.time===lesson.time&&x.subject===lesson.subject&&x.teachers.join("|")===lesson.teachers.join("|")) ? "2A · 2B" : group});
  }
  return rows;
}

function complementaryFor(teacher:string, tutor:boolean, entries:Entry[]) {
  const occupied=new Set(entries.filter(e=>e.teachers.includes(teacher)).map(e=>`${e.day}|${e.time}`));
  const usedDays=new Set<string>();
  const patterns=[
    {label:"Atención a familias", times:["09:00–10:00","13:00–14:00","12:00–13:00"]},
    {label:"Coordinación docente", times:["12:00–13:00","13:00–14:00","09:00–10:00"]},
    ...(tutor?[{label:"Reducción por tutoría",times:["13:00–14:00","09:00–10:00","12:00–13:00"]}]:[]),
  ];
  const out:{day:string;time:string;label:string}[]=[];
  for(const p of patterns){
    let found:{day:string;time:string}|undefined;
    for(const time of p.times) for(const day of DAYS.slice(0,4)){
      if(teacher==="Malu" && (day==="Jueves" || time==="09:00–10:00")) continue;
      if(!usedDays.has(day)&&!occupied.has(`${day}|${time}`)){found={day,time};break;}
    }
    if(found){usedDays.add(found.day);out.push({...found,label:p.label});}
  }
  return out;
}

export default function Home() {
  const entries=useMemo(()=>allEntries(),[]);
  const teachers=useMemo(()=>Array.from(new Set(entries.flatMap(e=>e.teachers))).filter(x=>x!=="Docente pendiente").sort((a,b)=>a.localeCompare(b,"es")),[entries]);
  const [tab,setTab]=useState<Tab>("groups");
  const [group,setGroup]=useState("4");
  const [teacher,setTeacher]=useState("María Molina");
  const [query,setQuery]=useState("");

  const exportCsv=()=>{
    const rows=[["Grupo","Día","Hora","Área","Docentes"],...DAYS.flatMap(day=>GROUP_DATA[group][day].map(x=>[group,day,x.time,LABELS[x.subject],x.teachers.join(" + ")]))];
    const blob=new Blob([rows.map(r=>r.map(v=>`"${v.replaceAll('"','""')}"`).join(",")).join("\n")],{type:"text/csv;charset=utf-8"});
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`horario-${group}.csv`;a.click();URL.revokeObjectURL(a.href);
  };

  return <main className="app theme-compact">
    <aside className="sidebar" aria-label="Navegación principal">
      <div className="mark"><img src="./logo-srl.png" alt="Colegio Público Santa Rosa de Lima"/><div><b>Horarios</b><small>CEIP · 26–27</small></div></div>
      <nav>{navButton("groups","Grupos","▦",tab,setTab)}{navButton("teachers","Docentes","♙",tab,setTab)}{navButton("loads","Cargas","▥",tab,setTab)}{navButton("issues","Incidencias","△",tab,setTab)}</nav>
      <div className="sidebar-note"><span className="status-dot"/>Borrador operativo<small>Actualizado 17 jul 2026</small></div>
    </aside>
    <section className="shell">
      <header className="topbar">
        <div className="topbar-brand"><img className="mobile-school-logo" src="./logo-srl.png" alt="Colegio Público Santa Rosa de Lima"/><div><p className="eyebrow">Organización escolar</p><h1>Horarios CEIP <span>· Curso 2026–27</span></h1></div></div>
      </header>

      <div className="mobile-nav">{navButton("groups","Grupos","▦",tab,setTab)}{navButton("teachers","Docentes","♙",tab,setTab)}{navButton("loads","Cargas","▥",tab,setTab)}{navButton("issues","Incidencias","△",tab,setTab)}</div>

      <div className="metrics">
        <div><span className="metric-icon">◷</span><strong>25 h</strong><small>por grupo y semana</small></div>
        <div><span className="metric-icon">✓</span><strong>9 grupos</strong><small>cuadrantes completos</small></div>
        <button className="issue-metric" onClick={()=>setTab("issues")}><span>!</span><strong>1 incidencia</strong><small>requiere asignación</small></button>
      </div>

      {tab==="groups" && <>
        <Toolbar query={query} setQuery={setQuery}>
          <label>Grupo<select value={group} onChange={e=>setGroup(e.target.value)}>{GROUPS.map(g=><option key={g} value={g}>{groupName(g)}</option>)}</select></label>
          <button className="secondary" onClick={exportCsv}>↓ Exportar CSV</button><button className="primary" onClick={()=>window.print()}>Imprimir horario</button>
        </Toolbar>
        <section className="panel schedule-panel">
          <div className="panel-title"><div><p className="eyebrow">Vista semanal</p><h2>{groupName(group)}</h2></div><div className="legend"><span className="dot core"/>Troncales <span className="dot lang"/>Idiomas <span className="dot spec"/>Especialidades</div></div>
          <WeekGrid plan={GROUP_DATA[group]} query={query}/>
        </section>
      </>}

      {tab==="teachers" && <TeacherView teacher={teacher} setTeacher={setTeacher} teachers={teachers} entries={entries} query={query} setQuery={setQuery}/>} 
      {tab==="loads" && <LoadsView teachers={teachers} entries={entries}/>} 
      {tab==="issues" && <IssuesView setTab={setTab} setGroup={setGroup}/>} 
      <footer>Horario generado mediante restricciones · Máximo 90 min por área y día · Compensaciones máximas de 15 min</footer>
    </section>
  </main>;
}

function navButton(id:Tab,label:string,icon:string,tab:Tab,setTab:(t:Tab)=>void){return <button key={id} className={tab===id?"active":""} onClick={()=>setTab(id)}><span>{icon}</span>{label}{id==="issues"&&<i>1</i>}</button>}
function groupName(g:string){return `${g.replace("A",".º A").replace("B",".º B")}${/[AB]/.test(g)?"": ".º"} Primaria`;}
function Toolbar({children,query,setQuery}:{children:React.ReactNode;query:string;setQuery:(s:string)=>void}){return <div className="toolbar">{children}<label className="search"><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar área o docente…"/></label></div>}

function WeekGrid({plan,query}:{plan:DayPlan;query:string}){
  return <div className="week-grid">{DAYS.map(day=><div className="day" key={day}><h3>{day}</h3><div className="day-cards">{plan[day].map((x,i)=><div key={`${x.time}-${i}`} className={`lesson sub-${x.subject.toLowerCase()} ${x.issue?"pending":""} ${query&&!`${LABELS[x.subject]} ${x.teachers.join(" ")}`.toLowerCase().includes(query.toLowerCase())?"muted":""}`} style={{"--duration":x.minutes} as React.CSSProperties}><span className="lesson-time">{x.time}</span><strong>{x.issue?"⚠ ":""}{LABELS[x.subject]}</strong><small>{x.teachers.join(" · ")}</small></div>)}<div className="break"><span>☕</span> Recreo · 30 min</div></div></div>)}</div>
}

function TeacherView({teacher,setTeacher,teachers,entries,query,setQuery}:{teacher:string;setTeacher:(s:string)=>void;teachers:string[];entries:Entry[];query:string;setQuery:(s:string)=>void}){
  const own=entries.filter(e=>e.teachers.includes(teacher));
  const tutor=Object.values(TUTORS).includes(teacher);
  const complementaries=complementaryFor(teacher,tutor,entries);
  const minutes=own.reduce((s,e)=>s+e.minutes,0);
  return <><Toolbar query={query} setQuery={setQuery}><label>Docente<select value={teacher} onChange={e=>setTeacher(e.target.value)}>{teachers.map(t=><option key={t}>{t}</option>)}</select></label><button className="primary" onClick={()=>window.print()}>Imprimir horario</button></Toolbar>
    <section className="teacher-summary panel"><div><p className="eyebrow">Horario individual</p><h2>{teacher}</h2><p>{tutor?`Tutoría: ${Object.entries(TUTORS).find(([,v])=>v===teacher)?.[0]}.º Primaria`:"Especialista / apoyo docente"}</p></div><div className="load-ring"><strong>{formatMinutes(minutes)}</strong><span>lectivas asignadas</span></div><div className="comp-count"><strong>{complementaries.length} h</strong><span>{tutor?"2 complementarias + tutoría":"complementarias"}</span></div></section>
    <section className="panel teacher-days">{DAYS.map(day=><div className="teacher-day" key={day}><h3>{day}</h3>{own.filter(e=>e.day===day).filter(e=>!query||`${LABELS[e.subject]} ${e.group}`.toLowerCase().includes(query.toLowerCase())).map((e,i)=><div className={`teacher-entry sub-${e.subject.toLowerCase()}`} key={i}><span>{e.time}</span><strong>{LABELS[e.subject]}</strong><small>{e.group==="2A · 2B"?"2.º A + B":groupName(e.group).replace(" Primaria","")}</small></div>)}{complementaries.filter(c=>c.day===day).map(c=><div className="teacher-entry complementary" key={c.label}><span>{c.time}</span><strong>{c.label}</strong><small>{c.label==="Reducción por tutoría"?"Reducción lectiva":"Hora complementaria"}</small></div>)}</div>)}</section>
  </>;
}

function LoadsView({teachers,entries}:{teachers:string[];entries:Entry[]}){
  return <section className="panel loads"><div className="panel-title"><div><p className="eyebrow">Control semanal</p><h2>Cargas docentes</h2></div><span className="validation">✓ Huecos restantes sin asignar</span></div><div className="load-table"><div className="load-row head"><span>Docente</span><span>Lectivas</span><span>Complementarias</span><span>Tutoría</span><span>Estado</span></div>{teachers.map(t=>{const m=entries.filter(e=>e.teachers.includes(t)).reduce((s,e)=>s+e.minutes,0);const tutor=Object.values(TUTORS).includes(t);const comp=complementaryFor(t,tutor,entries).filter(x=>x.label!=="Reducción por tutoría").length;return <div className="load-row" key={t}><strong>{t}</strong><span>{formatMinutes(m)}</span><span>{comp} h</span><span>{tutor?"1 h":"—"}</span><span className={m>1380?"over":"ok"}>{m>1380?"Revisar":"Dentro de margen"}</span></div>})}</div><p className="table-note">Las cargas reflejan las sesiones actualmente asignadas. Los huecos no utilizados permanecen vacíos por indicación de Jefatura de Estudios.</p></section>
}

function IssuesView({setTab,setGroup}:{setTab:(t:Tab)=>void;setGroup:(g:string)=>void}){
  const open=()=>{setGroup("4");setTab("groups")};
  return <section className="issues-layout"><article className="issue-card"><div className="issue-symbol">!</div><div><span className="issue-status">Pendiente de asignación</span><h2>Matemáticas de 4.º · 45 minutos</h2><p><b>Miércoles, 10:00–10:45.</b> La franja libera a María Molina para Francés y SUPÉRATE conserva la prioridad de 2.º. Falta asignar el docente que atenderá esta única sesión.</p><div className="tags"><span>1 único error de DC</span><span>Sin solape de Francés</span><span>Prioridad 2.º conservada</span></div><button className="primary" onClick={open}>Ver en el horario de 4.º</button></div></article>
    <aside className="checks panel"><h3>Controles superados</h3><ul><li><span>✓</span>25 horas semanales por grupo, incluidos recreos.</li><li><span>✓</span>Ningún área supera 90 minutos diarios.</li><li><span>✓</span>Francés: 90 minutos en 5.º A, 5.º B, 6.º A y 6.º B.</li><li><span>✓</span>Francés no coincide con Religión.</li><li><span>✓</span>Naturales y Sociales se distribuyen en días distintos.</li><li><span>✓</span>Malu no tiene sesiones los jueves.</li></ul></aside></section>
}

function formatMinutes(m:number){return `${Math.floor(m/60)} h${m%60?` ${m%60} min`:""}`}
