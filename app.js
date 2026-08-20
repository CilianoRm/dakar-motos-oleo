const MECHANICS = ["GIL", "AMAURI", "SAMUEL", "TIAGUINHO", "TIAGO"];
const COUNT_COL = { GIL:"gil_count", AMAURI:"amauri_count", SAMUEL:"samuel_count", TIAGUINHO:"tiaguinho_count", TIAGO:"tiago_count" };
const AVAIL_COL = { GIL:"gil_available", AMAURI:"amauri_available", SAMUEL:"samuel_available", TIAGUINHO:"tiaguinho_available", TIAGO:"tiago_available" };

// IMPORTANTE: use somente a URL base do projeto, sem /rest/v1.
const SUPABASE_URL = "https://faujgnzagnktsmxbnmmx.supabase.co";
const SUPABASE_KEY = "sb_publishable_BQVeY4ChsN9Vr1JzwXpcOw_RWALGfvj";

let db = null;
let channel = null;
let pollingTimer = null;
let loading = false;
let state = {
  current: 0,
  counts: { GIL:0, AMAURI:0, SAMUEL:0, TIAGUINHO:0, TIAGO:0 },
  available: { GIL:true, AMAURI:true, SAMUEL:true, TIAGUINHO:true, TIAGO:true },
  history: []
};

const $ = id => document.getElementById(id);

function configured() {
  return /^https:\/\/[^\s]+\.supabase\.co\/?$/.test(SUPABASE_URL) &&
         SUPABASE_KEY && !SUPABASE_KEY.includes("COLE_AQUI");
}

function priorityIndex() {
  const candidates = MECHANICS
    .map((name, index) => ({ name, index, count: Number(state.counts[name] || 0) }))
    .filter(x => state.available[x.name]);

  if (!candidates.length) return state.current;

  const min = Math.min(...candidates.map(x => x.count));
  return candidates.find(x => x.count === min).index;
}

function render() {
  const cur = MECHANICS[state.current] || MECHANICS[0];

  if ($("currentName")) $("currentName").textContent = cur;
  if ($("tvName")) $("tvName").textContent = cur;

  if ($("sequence")) {
    $("sequence").innerHTML = MECHANICS.map((m, i) => {
      const available = state.available[m];
      const count = Number(state.counts[m] || 0);
      return `<button type="button" class="sequence-item ${i === state.current ? "active" : ""} ${available ? "" : "disabled"}" onclick="selectMechanic('${m}')" ${available ? "" : "disabled"}>
        <span class="number">${i + 1}</span>
        <span class="sequence-name">${m}</span>
        <span class="sequence-count">${count} ${count === 1 ? "troca" : "trocas"}</span>
        <span class="sequence-status">${available ? "DISPONÍVEL" : "OCUPADO"}</span>
      </button>`;
    }).join("");
  }

  if ($("mechanics")) {
    $("mechanics").innerHTML = MECHANICS.map(m => {
      const c = Number(state.counts[m] || 0);
      const a = !!state.available[m];
      return `<div class="mechanic">
        <span class="mechanic-name">${m}<span class="status ${a ? "available" : "unavailable"}">${a ? "● DISPONÍVEL" : "● OCUPADO"}</span></span>
        <span class="mechanic-actions">
          <button class="secondary" type="button" onclick="toggleAvailability('${m}')">${a ? "OCUPAR" : "LIBERAR"}</button>
          <span class="count ${c < 0 ? "pending" : ""}">${c}<small>${c < 0 ? "pendente" : "trocas"}</small></span>
        </span>
      </div>`;
    }).join("");
  }

  if ($("tvList")) {
    $("tvList").innerHTML = MECHANICS.map((m, i) =>
      `<div class="tv-person ${i === state.current ? "active" : ""} ${state.available[m] ? "" : "unavailable-tv"}">
        <strong>${m}</strong><span>${state.counts[m]} trocas ${state.available[m] ? "" : "• ocupado"}</span>
      </div>`
    ).join("");
  }

  if ($("history")) {
    $("history").innerHTML = state.history.length
      ? state.history.slice(0, 12).map(x => `<div class="history-row">${escapeHtml(x)}</div>`).join("")
      : "<div class='history-row'>Nenhuma ação registrada.</div>";
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
}

async function load({ silent = false } = {}) {
  if (!db || loading) return;
  loading = true;
  try {
    const control = await db.from("controle").select("*").eq("id", 1).maybeSingle();
    if (control.error) throw control.error;

    if (control.data) {
      state.counts = {
        GIL: Number(control.data.gil_count || 0),
        AMAURI: Number(control.data.amauri_count || 0),
        SAMUEL: Number(control.data.samuel_count || 0),
        TIAGUINHO: Number(control.data.tiaguinho_count || 0),
        TIAGO: Number(control.data.tiago_count || 0)
      };
      state.available = {
        GIL: control.data.gil_available !== false,
        AMAURI: control.data.amauri_available !== false,
        SAMUEL: control.data.samuel_available !== false,
        TIAGUINHO: control.data.tiaguinho_available !== false,
        TIAGO: control.data.tiago_available !== false
      };
      const stored = Number(control.data.current_index);
      state.current = Number.isInteger(stored) && stored >= 0 && stored < MECHANICS.length ? stored : priorityIndex();
    }

    const hist = await db.from("historico").select("*").order("created_at", { ascending:false }).limit(30);
    if (hist.error) throw hist.error;
    state.history = (hist.data || []).map(x => `${fmt(x.created_at)} — ${x.mecanico} — ${x.acao}${x.delta ? ` (${x.delta > 0 ? "+" : ""}${x.delta})` : ""}`);
    render();
  } catch (error) {
    console.error("Dakar Motos — erro ao carregar dados:", error);
    if (!silent) showError(error);
  } finally {
    loading = false;
  }
}

async function saveControl(update) {
  const result = await db.from("controle").update({ ...update, updated_at:new Date().toISOString() }).eq("id", 1);
  if (result.error) throw result.error;
  return result;
}

async function selectMechanic(name) {
  if (!db) return toast("Supabase não conectado.");
  if (!state.available[name]) return toast(`${name} está ocupado.`);
  try {
    await saveControl({ current_index: MECHANICS.indexOf(name) });
    state.current = MECHANICS.indexOf(name);
    render();
    toast(`${name} agora é a vez`);
  } catch (error) {
    console.error("Erro ao selecionar mecânico:", error);
    showError(error);
  }
}
window.selectMechanic = selectMechanic;

async function actOil() {
  if (!db) return toast("Supabase não conectado.");
  const mechanic = MECHANICS[state.current];
  if (!state.available[mechanic]) return toast(`${mechanic} está ocupado.`);

  try {
    const counts = { ...state.counts, [mechanic]:Number(state.counts[mechanic] || 0) + 1 };
    const next = priorityIndexWithCounts(counts, state.available);
    await saveControl({
      [COUNT_COL[mechanic]]: counts[mechanic],
      current_index: next
    });
    await insertHistory(mechanic, "TROCOU ÓLEO", 1);
    state.counts = counts;
    state.current = next;
    render();
    toast(`${mechanic}: troca registrada`);
  } catch (error) {
    console.error("Erro ao registrar troca:", error);
    showError(error);
  }
}

function priorityIndexWithCounts(counts, available) {
  const candidates = MECHANICS.map((name,index) => ({ name,index,count:Number(counts[name] || 0) }))
    .filter(x => available[x.name]);
  if (!candidates.length) return state.current;
  const min = Math.min(...candidates.map(x => x.count));
  return candidates.find(x => x.count === min).index;
}

async function insertHistory(mechanic, action, delta) {
  const result = await db.from("historico").insert({ mecanico:mechanic, acao:action, delta });
  if (result.error) throw result.error;
}

function openCorrectionModal() {
  if (!db) return toast("Supabase não conectado.");
  const modal = $("correctionModal");
  const options = $("correctionOptions");
  if (!modal || !options) return;
  options.innerHTML = MECHANICS.map(m => {
    const c = Number(state.counts[m] || 0);
    return `<button class="correction-option" type="button" data-mechanic="${m}"><span>${m}</span><small>${c} ${Math.abs(c) === 1 ? "troca" : "trocas"}</small></button>`;
  }).join("");
  options.querySelectorAll(".correction-option").forEach(btn => btn.addEventListener("click", () => correctMinusOne(btn.dataset.mechanic)));
  modal.classList.remove("hidden");
}

function closeCorrectionModal() {
  $("correctionModal")?.classList.add("hidden");
}

async function correctMinusOne(mechanic) {
  closeCorrectionModal();
  const newCount = Number(state.counts[mechanic] || 0) - 1;
  const counts = { ...state.counts, [mechanic]:newCount };
  const next = priorityIndexWithCounts(counts, state.available);

  try {
    await saveControl({ [COUNT_COL[mechanic]]:newCount, current_index:next });
    await insertHistory(mechanic, "CORREÇÃO -1", -1);
    state.counts = counts;
    state.current = next;
    render();
    toast(`${mechanic}: -1 troca corrigida`);
  } catch (error) {
    console.error("Erro ao corrigir troca:", error);
    showError(error);
  }
}

async function toggleAvailability(name) {
  if (!db) return toast("Supabase não conectado.");
  const next = !state.available[name];
  try {
    const available = { ...state.available, [name]:next };
    let current = state.current;
    if (!available[MECHANICS[current]]) current = priorityIndexWithCounts(state.counts, available);
    await saveControl({ [AVAIL_COL[name]]:next, current_index:current });
    await insertHistory(name, next ? "LIBERADO" : "OCUPADO", 0);
    state.available = available;
    state.current = current;
    render();
    toast(`${name}: ${next ? "disponível" : "ocupado"}`);
  } catch (error) {
    console.error("Erro ao alterar disponibilidade:", error);
    showError(error);
  }
}
window.toggleAvailability = toggleAvailability;

async function resetTurn() {
  if (!db) return toast("Supabase não conectado.");
  try {
    const next = priorityIndex();
    await saveControl({ current_index:next });
    state.current = next;
    render();
    toast(`Prioridade: ${MECHANICS[next]}`);
  } catch (error) {
    console.error("Erro ao recalcular prioridade:", error);
    showError(error);
  }
}

async function clearData() {
  if (!db) return toast("Supabase não conectado.");
  if (!confirm("Zerar todos os contadores e histórico?")) return;
  try {
    await saveControl({ current_index:0, gil_count:0, amauri_count:0, samuel_count:0, tiaguinho_count:0, tiago_count:0 });
    const result = await db.from("historico").delete().neq("id", 0);
    if (result.error) throw result.error;
    state.current = 0;
    state.counts = { GIL:0, AMAURI:0, SAMUEL:0, TIAGUINHO:0, TIAGO:0 };
    state.history = [];
    render();
    toast("Dados zerados");
  } catch (error) {
    console.error("Erro ao zerar dados:", error);
    showError(error);
  }
}

function subscribe() {
  if (!db) return;
  if (channel) db.removeChannel(channel);
  channel = db.channel("dakar-motos-oleo-v8")
    .on("postgres_changes", { event:"*", schema:"public", table:"controle" }, () => load({ silent:true }))
    .on("postgres_changes", { event:"*", schema:"public", table:"historico" }, () => load({ silent:true }))
    .on("postgres_changes", { event:"*", schema:"public", table:"funcionarios" }, () => loadEmployees({silent:true}))
    .on("postgres_changes", { event:"*", schema:"public", table:"pontos_funcionarios" }, () => loadEmployees({silent:true}))
    .on("postgres_changes", { event:"*", schema:"public", table:"agenda_funcionarios" }, () => loadEmployees({silent:true}))
    .subscribe(status => {
      console.log("Dakar Motos Realtime:", status);
    });

  clearInterval(pollingTimer);
  // Realtime é o principal. Este polling é uma proteção caso algum navegador/roteador bloqueie WebSocket.
  pollingTimer = setInterval(() => { load({ silent:true }); if(!$('employeesView')?.classList.contains('hidden')) loadEmployees({silent:true}); }, 5000);
}

function fmt(value) {
  return new Date(value).toLocaleString("pt-BR", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" });
}

function toast(message) {
  const t = $("toast");
  if (!t) return;
  t.textContent = message;
  t.style.display = "block";
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => t.style.display = "none", 2200);
}

function showError(error) {
  const message = error?.message || error?.details || String(error);
  console.error("Dakar Motos — detalhe:", message);
  toast("Erro ao acessar o banco. Veja o Console (F12) para detalhes.");
}

function clock() {
  const el = $("clock");
  if (el) el.textContent = new Date().toLocaleTimeString("pt-BR", { hour:"2-digit", minute:"2-digit" });
}

function openPanel() {
  const u = new URL(location.href);
  u.searchParams.set("painel", "1");
  window.open(u.toString(), "_blank");
}

async function copyPanel() {
  const u = new URL(location.href);
  u.searchParams.set("painel", "1");
  try {
    await navigator.clipboard.writeText(u.toString());
    toast("Link do painel copiado");
  } catch (_) {
    prompt("Copie o link:", u.toString());
  }
}

function setupUI() {
  $("oilBtn")?.addEventListener("click", actOil);
  $("busyBtn")?.addEventListener("click", openCorrectionModal);
  $("correctionCancel")?.addEventListener("click", closeCorrectionModal);
  $("correctionModal")?.addEventListener("click", e => { if (e.target.id === "correctionModal") closeCorrectionModal(); });
  $("resetTurn")?.addEventListener("click", resetTurn);
  $("clearData")?.addEventListener("click", clearData);
  $("openPanel")?.addEventListener("click", openPanel);
  $("copyPanel")?.addEventListener("click", copyPanel);
}

async function init() {
  render();
  setupUI();
  clock();
  setInterval(clock, 1000);

  if (!configured()) {
    warn("Configure SUPABASE_URL e SUPABASE_KEY no app.js.");
    return;
  }

  try {
    db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      realtime: { params: { eventsPerSecond: 10 } },
      auth: { persistSession:false, autoRefreshToken:false, detectSessionInUrl:false }
    });
    await load();
    subscribe();
  } catch (error) {
    console.error("Dakar Motos — falha na inicialização:", error);
    showError(error);
  }
}

function warn(message) {
  const e = document.createElement("div");
  e.style.cssText = "position:fixed;bottom:20px;left:20px;right:20px;background:#171717;border:1px solid #f5252d;padding:14px;border-radius:9px;z-index:9999";
  e.textContent = message;
  document.body.appendChild(e);
}

// Exibe o painel antes de conectar ao banco, sem deixar a tela de controle quebrada.
if (new URLSearchParams(location.search).get("painel") === "1") {
  $("controlView")?.classList.add("hidden");
  $("tvView")?.classList.remove("hidden");
  document.querySelector("header")?.classList.add("hidden");
  document.body.style.padding = "0";
  document.querySelector(".app")?.style.setProperty("padding", "0");
  document.querySelector(".tv-view")?.style.setProperty("border-radius", "0");
}

document.addEventListener("DOMContentLoaded", init);

/* =========================
   MÓDULO FUNCIONÁRIOS V5
   ========================= */
const EMPLOYEE_PASSWORD = "Marcos8904";
let employeeRows = [];
let employeePoints = [];
let selectedEmployeeId = "CILIANO";
let employeeChannel = null;

function localDateISO(date = new Date()) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}

function localDateTime(date = new Date()) {
  const d = new Date(date);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off*60000).toISOString().slice(0,19);
}

function timeToMinutes(v) {
  if (!v) return null;
  const [h,m] = String(v).slice(0,5).split(":").map(Number);
  return h*60+m;
}

function minutesToHuman(mins) {
  const sign = mins < 0 ? "-" : "+";
  let n = Math.abs(Math.round(mins));
  const h = Math.floor(n/60);
  const m = n%60;
  return `${sign}${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
}

function durationHuman(mins) {
  const n = Math.max(0, Math.round(mins || 0));
  return `${String(Math.floor(n/60)).padStart(2,"0")}:${String(n%60).padStart(2,"0")}`;
}

function fmtTime(v) {
  if (!v) return "—";
  return new Date(v).toLocaleTimeString("pt-BR", {hour:"2-digit", minute:"2-digit"});
}

function weekdayForDate(dateStr) {
  const [y,m,d] = dateStr.split("-").map(Number);
  return new Date(y,m-1,d).getDay();
}

function scheduleFor(employee, dateStr = localDateISO()) {
  const day = weekdayForDate(dateStr);
  if (day === 0) return null;
  if (day === 6) {
    if (!employee.sab_entrada || !employee.sab_saida) return null;
    return { start:employee.sab_entrada, end:employee.sab_saida, lunchStart:employee.almoco_inicio, lunchEnd:employee.almoco_fim };
  }
  if (!employee.seg_sex_entrada || !employee.seg_sex_saida) return null;
  return { start:employee.seg_sex_entrada, end:employee.seg_sex_saida, lunchStart:employee.almoco_inicio, lunchEnd:employee.almoco_fim };
}

function expectedMinutes(employee, dateStr = localDateISO(), tipoDia = 'trabalho') {
  if (tipoDia === 'feriado_trabalhado') return 0;
  if (tipoDia === 'folga_ferias') return 0;
  const s = scheduleFor(employee,dateStr);
  if (!s) return 0;
  let total = timeToMinutes(s.end) - timeToMinutes(s.start);
  if (s.lunchStart && s.lunchEnd) total -= timeToMinutes(s.lunchEnd)-timeToMinutes(s.lunchStart);
  return Math.max(0,total);
}

function workedMinutes(point, employee, now = new Date()) {
  if (!point) return 0;
  const date = point.data;
  const make = (t) => t ? new Date(t).getTime() : null;
  let total = 0;
  if (point.chegada) {
    const start = make(point.chegada);
    const end = point.saida ? make(point.saida) : (date === localDateISO() ? now.getTime() : null);
    if (end && end >= start) total += (end-start)/60000;
  }
  if (point.saida_almoco && point.retorno_almoco) {
    total -= Math.max(0,(make(point.retorno_almoco)-make(point.saida_almoco))/60000);
  } else if (point.saida_almoco && !point.retorno_almoco && point.saida) {
    total -= Math.max(0,(make(point.saida)-make(point.saida_almoco))/60000);
  }
  return Math.max(0,total);
}

function getPoint(id, date = localDateISO()) {
  return employeePoints.find(p => p.funcionario_id === id && p.data === date) || null;
}
function getAgenda(id, date = localDateISO()) {
  return employeeAgenda.find(a => a.funcionario_id === id && a.data === date) || null;
}
function effectiveDayType(id, date = localDateISO()) {
  const a = getAgenda(id,date);
  if (a?.tipo) return a.tipo;
  const p = getPoint(id,date);
  return p?.tipo_dia || 'trabalho';
}
function agendaLabel(type){ return {trabalho:'TRABALHO',folga:'FOLGA',ferias:'FÉRIAS',feriado_trabalhado:'FERIADO TRABALHADO',nao_veio:'NÃO VEIO'}[type] || 'TRABALHO'; }

function isCreditType(type){ return type === 'feriado_trabalhado' || type === 'folga_ferias' || type === 'folga' || type === 'ferias'; }
function pointCreditDays(point, employee){
  if (!point) return 0;
  if (point.tipo_dia === 'feriado_trabalhado') return 1;
  return 0;
}

async function loadEmployees({silent=false}={}) {
  if (!db) return;
  try {
    const [emps, points, agenda] = await Promise.all([
      db.from("funcionarios").select("*").eq("ativo",true).order("nome"),
      db.from("pontos_funcionarios").select("*").order("data",{ascending:false}),
      db.from("agenda_funcionarios").select("*").order("data",{ascending:true})
    ]);
    if (emps.error) throw emps.error;
    if (points.error) throw points.error;
    if (agenda.error) throw agenda.error;
    employeeRows = emps.data || [];
    employeePoints = points.data || [];
    employeeAgenda = agenda.data || [];
    if (!employeeRows.some(e=>e.id===selectedEmployeeId)) selectedEmployeeId = employeeRows[0]?.id || "";
    renderEmployees();
  } catch(error) {
    console.error("Funcionários — erro ao carregar:",error);
    if (!silent) toast("Não foi possível carregar Funcionários. Execute employee_schema.sql no Supabase.");
  }
}

function monthStartISO() {
  const d = new Date();
  d.setDate(1);
  return localDateISO(d);
}

function employeePeriodBalance(employeeId) {
  const employee = employeeRows.find(e=>e.id===employeeId);
  if (!employee) return 0;
  const today = new Date();
  const ym = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}`;
  return employeePoints.filter(p=>p.funcionario_id===employeeId && p.data.startsWith(ym)).reduce((sum,p)=>{
    const type = effectiveDayType(employeeId,p.data);
    if (type === 'nao_veio' || type === 'folga_ferias' || type === 'folga' || type === 'ferias') return sum;
    const expected = expectedMinutes(employee,p.data,type);
    return sum + (workedMinutes(p,employee,new Date()) - expected);
  },0);
}

function employeeDayLedger(employee){
  const today = new Date();
  const ym = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}`;
  const rows = employeePoints.filter(p=>p.funcionario_id===employee.id && p.data.startsWith(ym));
  let absenceMinutes=0, holidayCredits=0, usedLeave=0, workedExtra=0;
  for(const p of rows){
    const type = effectiveDayType(employee.id,p.data);
    const dailyExpected = expectedMinutes(employee,p.data,'trabalho');
    if(type==='nao_veio') absenceMinutes += dailyExpected;
    else if(type==='feriado_trabalhado') holidayCredits += 1;
    else if(type==='folga' || type==='ferias' || type==='folga_ferias') usedLeave += 1;
    else { const bal=workedMinutes(p,employee,new Date())-dailyExpected; if(bal>0) workedExtra += bal; }
  }
  const manualDays = Math.max(0, Number(employee.dias_folga_ferias || 0));
  const dailyBase = Math.max(1, expectedMinutes(employee, localDateISO(),'trabalho'));
  const hourCreditsDays = workedExtra / dailyBase;
  const totalCreditDays = manualDays + holidayCredits + hourCreditsDays;
  const remainingCredits = Math.max(0, totalCreditDays - usedLeave);
  const absenceDays = absenceMinutes / dailyBase;
  const daysMissing = Math.max(0, absenceDays - totalCreditDays);
  return {absenceMinutes,absenceDays,holidayCredits,usedLeave,manualDays,workedExtra,hourCreditsDays,totalCreditDays,remainingCredits,daysMissing};
}

function calendarTitle(d){ return d.toLocaleDateString('pt-BR',{month:'long',year:'numeric'}).replace(/^./,c=>c.toUpperCase()); }
function renderEmployeeCalendar(employee){
  const host=$("employeeCalendar"); if(!host)return;
  const y=calendarMonth.getFullYear(),m=calendarMonth.getMonth(),first=new Date(y,m,1),start=(first.getDay()+6)%7,daysIn=new Date(y,m+1,0).getDate(),cells=[];
  for(let i=0;i<start;i++)cells.push('<div class="calendar-day empty"></div>');
  for(let day=1;day<=daysIn;day++){
    const date=`${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`,p=getPoint(employee.id,date),a=getAgenda(employee.id,date),type=a?.tipo||p?.tipo_dia||null;
    const expected=expectedMinutes(employee,date,'trabalho'),worked=(type==='trabalho'||type==='feriado_trabalhado')?workedMinutes(p,employee):0,bal=type==='trabalho'?worked-expected:(type==='feriado_trabalhado'?worked:0);
    let badge='';
    if(type==='folga')badge='<span class="calendar-badge off">FOLGA</span>';
    else if(type==='ferias')badge='<span class="calendar-badge vacation">FÉRIAS</span>';
    else if(type==='feriado_trabalhado')badge='<span class="calendar-badge holiday">FERIADO</span>';
    else if(type==='nao_veio')badge='<span class="calendar-badge absence">FALTOU</span>';
    else if(p&&(p.chegada||p.saida))badge=`<span class="calendar-badge ${bal<0?'less':'more'}">${minutesToHuman(bal)}</span>`;
    else if(weekdayForDate(date)===0)badge='<span class="calendar-badge weekend">DOM</span>';
    else if(weekdayForDate(date)===6&&!scheduleFor(employee,date))badge='<span class="calendar-badge weekend">SÁB</span>';
    cells.push(`<button type="button" class="calendar-day ${date===selectedCalendarDate?'selected':''} ${date===localDateISO()?'today':''}" data-date="${date}"><b>${day}</b>${badge}</button>`);
  }
  host.innerHTML=`<div class="calendar-head"><button class="icon-btn" id="calPrev">‹</button><strong>${calendarTitle(calendarMonth)}</strong><button class="icon-btn" id="calNext">›</button></div><div class="calendar-week"><span>SEG</span><span>TER</span><span>QUA</span><span>QUI</span><span>SEX</span><span>SÁB</span><span>DOM</span></div><div class="calendar-grid">${cells.join('')}</div>`;
  host.querySelectorAll('.calendar-day:not(.empty)').forEach(btn=>btn.addEventListener('click',()=>{selectedCalendarDate=btn.dataset.date;renderEmployees();}));
  $("calPrev")?.addEventListener('click',()=>{calendarMonth.setMonth(calendarMonth.getMonth()-1);renderEmployeeCalendar(employee);});
  $("calNext")?.addEventListener('click',()=>{calendarMonth.setMonth(calendarMonth.getMonth()+1);renderEmployeeCalendar(employee);});
}
async function setAgendaDay(employee,date,type){
  if(!db)return toast('Supabase não conectado.');
  try{const r=await db.from('agenda_funcionarios').upsert({funcionario_id:employee.id,data,tipo,observacao:null,updated_at:new Date().toISOString()},{onConflict:'funcionario_id,data'}).select().single();if(r.error)throw r.error;const i=employeeAgenda.findIndex(a=>a.funcionario_id===employee.id&&a.data===date);if(i>=0)employeeAgenda[i]=r.data;else employeeAgenda.push(r.data);renderEmployees();toast(`${employee.nome}: ${agendaLabel(type)} em ${formatDateBR(date)}`);}catch(e){console.error(e);toast('Erro ao salvar a agenda. Execute o SQL da V10 no Supabase.');}
}
async function clearAgendaDay(employee,date){
  if(!db)return toast('Supabase não conectado.');
  try{const r=await db.from('agenda_funcionarios').delete().eq('funcionario_id',employee.id).eq('data',date);if(r.error)throw r.error;employeeAgenda=employeeAgenda.filter(a=>!(a.funcionario_id===employee.id&&a.data===date));renderEmployees();toast('Definição do dia removida.');}catch(e){console.error(e);toast('Erro ao limpar o dia da agenda.');}
}
function renderAgendaControls(employee){
  const host=$("agendaControls");if(!host)return;
  const date=selectedCalendarDate,type=effectiveDayType(employee.id,date),a=getAgenda(employee.id,date),p=getPoint(employee.id,date),credit=Number(employee.dias_folga_ferias||0);
  host.innerHTML=`<div class="agenda-selected"><div><small>DIA SELECIONADO</small><strong>${formatDateBR(date)}</strong></div><div><small>SITUAÇÃO</small><strong>${agendaLabel(type)}</strong></div><div><small>LANÇAMENTO</small><strong>${p?'PONTO REGISTRADO':'SEM PONTO'}</strong></div></div><div class="agenda-buttons"><button class="secondary" data-agenda="trabalho">TRABALHO</button><button class="secondary" data-agenda="folga">FOLGA</button><button class="secondary" data-agenda="ferias">FÉRIAS</button><button class="secondary" data-agenda="feriado_trabalhado">FERIADO TRABALHADO</button><button class="secondary" data-agenda="nao_veio">NÃO VEIO</button>${a?'<button class="danger-secondary" id="clearAgenda">LIMPAR DIA</button>':''}</div><div class="credit-editor"><label>DIAS DE FOLGA/FÉRIAS DISPONÍVEIS<input id="creditDaysScreen" type="number" min="0" step="0.5" value="${credit}"></label><button class="secondary" id="saveCreditDays">SALVAR CRÉDITOS</button></div><p class="agenda-help">Você pode definir dias anteriores ou futuros. O calendário mostra folgas, férias, faltas e o saldo de cada dia trabalhado.</p>`;
  host.querySelectorAll('[data-agenda]').forEach(btn=>btn.addEventListener('click',()=>setAgendaDay(employee,date,btn.dataset.agenda)));
  $("clearAgenda")?.addEventListener('click',()=>clearAgendaDay(employee,date));
  $("saveCreditDays")?.addEventListener('click',async()=>{const val=Math.max(0,Number($("creditDaysScreen").value||0));try{const r=await db.from('funcionarios').update({dias_folga_ferias:val,updated_at:new Date().toISOString()}).eq('id',employee.id);if(r.error)throw r.error;employee.dias_folga_ferias=val;renderEmployees();toast('Dias disponíveis atualizados.');}catch(e){console.error(e);toast('Erro ao salvar dias disponíveis.');}});
}

function renderEmployees() {
  const list=$("employeeList"),detail=$("employeeDetail");if(!list||!detail)return;
  const today=localDateISO();if($("employeeDate"))$("employeeDate").textContent=new Date().toLocaleDateString("pt-BR",{weekday:"long",day:"2-digit",month:"2-digit",year:"numeric"});
  list.innerHTML=employeeRows.map(e=>{const type=effectiveDayType(e.id,today),p=getPoint(e.id,today),bal=type==='trabalho'?workedMinutes(p,e)-expectedMinutes(e,today,'trabalho'):(type==='feriado_trabalhado'?workedMinutes(p,e):0);return `<button class="employee-list-item ${e.id===selectedEmployeeId?'active':''}" type="button" data-id="${e.id}"><span>${escapeHtml(e.nome)}</span><small class="${bal<0?'negative':'positive'}">${type==='trabalho'&&p?minutesToHuman(bal):agendaLabel(type)}</small></button>`;}).join('')||'<div class="empty-employees">Nenhum funcionário encontrado.</div>';
  list.querySelectorAll('.employee-list-item').forEach(b=>b.addEventListener('click',()=>{selectedEmployeeId=b.dataset.id;calendarMonth=new Date();selectedCalendarDate=localDateISO();renderEmployees();}));
  const e=employeeRows.find(x=>x.id===selectedEmployeeId);if(!e){detail.innerHTML='<p>Nenhum funcionário selecionado.</p>';return;}
  const viewDate=selectedCalendarDate||today, type=effectiveDayType(e.id,viewDate),p=getPoint(e.id,viewDate),expected=expectedMinutes(e,viewDate,'trabalho'),worked=(type==='trabalho'||type==='feriado_trabalhado')?workedMinutes(p,e):0,daily=type==='folga'||type==='ferias'?0:(type==='nao_veio'?-expected:(type==='feriado_trabalhado'?worked:worked-expected)),period=employeePeriodBalance(e.id),ledger=employeeDayLedger(e);
  detail.innerHTML=`<div class="employee-detail-head"><div><span class="employee-tag">ATIVO</span><h1>${escapeHtml(e.nome)}</h1></div><div class="employee-head-actions"><button class="secondary" id="historyBtn">HISTÓRICO</button><button class="secondary" id="editScheduleBtn">ALTERAR HORÁRIOS</button></div></div><div class="schedule-summary"><div><b>HORÁRIO DE TRABALHO</b><span>Seg a Sex: ${e.seg_sex_entrada||'—'} às ${e.seg_sex_saida||'—'}</span><span>Sábado: ${e.sab_entrada&&e.sab_saida?`${e.sab_entrada} às ${e.sab_saida}`:'Não trabalha'}</span></div><div><b>ALMOÇO</b><span>${e.almoco_inicio&&e.almoco_fim?`${e.almoco_inicio} às ${e.almoco_fim}`:'Sem horário de almoço'}</span></div><div><b>CARGA ESPERADA HOJE</b><span>${durationHuman(expected)}</span></div></div><div class="agenda-card"><div class="section-title">AGENDA DO FUNCIONÁRIO</div><div id="employeeCalendar" class="employee-calendar"></div><div id="agendaControls"></div></div><div class="attendance-card"><div class="section-title">REGISTRO DE HORÁRIOS <span>${formatDateBR(viewDate)}</span></div><div class="attendance-status-line">STATUS DO DIA: <strong>${agendaLabel(type)}</strong></div><div class="attendance-grid"><div><small>CHEGADA</small><strong>${fmtTime(p?.chegada)}</strong></div><div><small>SAÍDA ALMOÇO</small><strong>${fmtTime(p?.saida_almoco)}</strong></div><div><small>RETORNO</small><strong>${fmtTime(p?.retorno_almoco)}</strong></div><div><small>SAÍDA</small><strong>${fmtTime(p?.saida)}</strong></div></div><button class="employee-primary" id="attendanceBtn">LANÇAR HORÁRIOS</button><button class="secondary" id="clearAttendanceBtn">LIMPAR LANÇAMENTO DO DIA</button></div><div class="balance-grid"><div><small>HORAS TRABALHADAS</small><strong>${durationHuman(worked)}</strong></div><div><small>HORAS ESPERADAS</small><strong>${durationHuman(expected)}</strong></div><div><small>SALDO DO DIA</small><strong class="${daily<0?'negative':'positive'}">${minutesToHuman(daily)}</strong></div><div><small>SALDO NO MÊS</small><strong class="${period<0?'negative':'positive'}">${minutesToHuman(period)}</strong></div></div><div class="credit-summary"><div><small>DIAS DISPONÍVEIS</small><strong>${ledger.remainingCredits.toFixed(2)}</strong></div><div><small>FERIADOS TRABALHADOS</small><strong>${ledger.holidayCredits}</strong></div><div><small>HORAS EM CRÉDITO</small><strong>${ledger.hourCreditsDays.toFixed(2)} dia</strong></div><div><small>DIAS A COMPENSAR</small><strong class="${ledger.daysMissing>0?'negative':'positive'}">${ledger.daysMissing.toFixed(2)}</strong></div></div><div class="schedule-note-display">${escapeHtml(e.observacao||'')}</div>`;
  renderEmployeeCalendar(e);renderAgendaControls(e);$("attendanceBtn")?.addEventListener('click',()=>openAttendanceModal(e));$("clearAttendanceBtn")?.addEventListener('click',()=>clearAttendance(e,viewDate));$("historyBtn")?.addEventListener('click',()=>openEmployeeHistory(e));$("editScheduleBtn")?.addEventListener('click',()=>openScheduleModal(e));
}

function historyStatusLabel(type){
  return {trabalho:"TRABALHO",feriado_trabalhado:"FERIADO",nao_veio:"FALTA",folga_ferias:"FOLGA / FÉRIAS"}[type] || "TRABALHO";
}
function formatDateBR(dateStr){
  if(!dateStr) return "—";
  const [y,m,d]=dateStr.split("-");
  return `${d}/${m}/${y}`;
}
function dateRangeDays(start,end){
  const out=[]; let d=new Date(`${start}T12:00:00`); const last=new Date(`${end}T12:00:00`);
  while(d<=last){ out.push(localDateISO(d)); d.setDate(d.getDate()+1); }
  return out;
}
function openEmployeeHistory(employee){
  const end=localDateISO();
  const d=new Date(); d.setDate(1);
  const start=localDateISO(d);
  $("historyEmployeeName").textContent=employee.nome;
  $("historyStart").value=start;
  $("historyEnd").value=end;
  $("employeeHistoryModal").classList.remove("hidden");
  renderEmployeeHistory(employee,start,end);
}
function closeEmployeeHistory(){ $("employeeHistoryModal")?.classList.add("hidden"); }
function renderEmployeeHistory(employee,start,end){
  if(!start || !end || start>end){ toast("Informe um período válido."); return; }
  const pointsByDate=new Map(employeePoints.filter(p=>p.funcionario_id===employee.id).map(p=>[p.data,p]));
  const days=dateRangeDays(start,end);
  let workedDays=0, absenceDays=0, leaveDays=0, holidayDays=0, lessDays=0, totalWorked=0, totalExpected=0, totalBalance=0;
  const rows=[];
  for(const date of days){
    const p=pointsByDate.get(date);
    const type=p?.tipo_dia || null;
    const expectedNormal=expectedMinutes(employee,date,'trabalho');
    let expected=expectedNormal, worked=0, balance=0, situation='SEM LANÇAMENTO', cls='';
    if(type==='nao_veio'){ absenceDays++; balance=-expectedNormal; situation='NÃO VEIO'; cls='row-absence'; }
    else if(type==='folga_ferias'){ leaveDays++; expected=0; situation='FOLGA / FÉRIAS'; cls='row-leave'; }
    else if(type==='feriado_trabalhado'){ holidayDays++; expected=0; worked=workedMinutes(p,employee); balance=worked; situation='FERIADO TRABALHADO'; cls='row-holiday'; if(worked>0) workedDays++; }
    else if(type==='trabalho' || p){ expected=expectedNormal; worked=workedMinutes(p,employee); balance=worked-expected; situation=p?'TRABALHO':'SEM LANÇAMENTO'; if(p) workedDays++; if(p && worked<expected && (p.saida || date<localDateISO())) { lessDays++; cls='row-less'; } }
    if(p){ totalWorked+=worked; totalExpected+=expected; totalBalance+=balance; }
    const lunch=(p?.saida_almoco||p?.retorno_almoco) ? `${fmtTime(p?.saida_almoco)} / ${fmtTime(p?.retorno_almoco)}` : '—';
    rows.push(`<tr class="${cls}"><td>${formatDateBR(date)}</td><td><strong>${situation}</strong></td><td>${fmtTime(p?.chegada)}</td><td>${lunch}</td><td>${fmtTime(p?.retorno_almoco)}</td><td>${fmtTime(p?.saida)}</td><td>${durationHuman(worked)}</td><td class="${balance<0?'negative':'positive'}">${minutesToHuman(balance)}</td></tr>`);
  }
  const daysWithExpected=days.filter(d=>expectedMinutes(employee,d,'trabalho')>0).length;
  $("historySummary").innerHTML=`
    <div><small>DIAS TRABALHADOS</small><strong>${workedDays}</strong></div>
    <div><small>FALTAS</small><strong class="${absenceDays?'negative':''}">${absenceDays}</strong></div>
    <div><small>FOLGAS / FÉRIAS</small><strong>${leaveDays}</strong></div>
    <div><small>FERIADOS TRABALHADOS</small><strong>${holidayDays}</strong></div>
    <div><small>DIAS COM MENOS HORAS</small><strong class="${lessDays?'negative':''}">${lessDays}</strong></div>
    <div><small>HORAS TRABALHADAS</small><strong>${durationHuman(totalWorked)}</strong></div>
    <div><small>HORAS PREVISTAS</small><strong>${durationHuman(totalExpected)}</strong></div>
    <div><small>SALDO DO PERÍODO</small><strong class="${totalBalance<0?'negative':'positive'}">${minutesToHuman(totalBalance)}</strong></div>`;
  $("employeeHistoryBody").innerHTML=rows.join("") || '<tr><td colspan="8">Nenhum dia no período.</td></tr>';
}

function openAttendanceModal(employee) {
  const date = selectedCalendarDate || localDateISO();
  const p = getPoint(employee.id, date);
  $("attendanceEmployeeId").value = employee.id;
  $("attendanceEmployeeName").textContent = employee.nome;
  $("attendanceDate").value = date;
  $("attendanceArrival").value = fmtInputTime(p?.chegada);
  $("attendanceLunchOut").value = fmtInputTime(p?.saida_almoco);
  $("attendanceLunchIn").value = fmtInputTime(p?.retorno_almoco);
  $("attendanceDeparture").value = fmtInputTime(p?.saida);
  const hasLunch = !!(employee.almoco_inicio && employee.almoco_fim);
  $("attendanceLunchFields").classList.toggle("hidden", !hasLunch);
  $("attendanceModalHelp").textContent = "Digite somente os horários que você tiver anotado. O tipo do dia é definido na Agenda, fora deste lançamento.";
  $("attendanceModal").classList.remove("hidden");
  setTimeout(() => $("attendanceDate")?.focus(), 50);
}

function closeAttendanceModal() { $("attendanceModal")?.classList.add("hidden"); }

function fmtInputTime(value) {
  if (!value) return "";
  const text = String(value);
  // Horário salvo pelo sistema: converte corretamente para o horário de Brasília.
  if (text.includes("T") && (text.includes("Z") || /[+-]\d{2}:?\d{2}$/.test(text))) {
    const d = new Date(text);
    if (!Number.isNaN(d.getTime())) {
      return new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Fortaleza",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      }).format(d);
    }
  }
  const m = text.match(/(?:T|\s)(\d{2}:\d{2})/);
  return m ? m[1] : text.slice(0,5);
}

async function saveAttendanceManual() {
  const id = $("attendanceEmployeeId").value;
  const employee = employeeRows.find(x => String(x.id) === String(id));
  if (!employee) return toast("Funcionário não encontrado.");
  const date = $("attendanceDate").value;
  const arrival = $("attendanceArrival").value;
  const lunchOut = $("attendanceLunchOut").value;
  const lunchIn = $("attendanceLunchIn").value;
  const departure = $("attendanceDeparture").value;
  const tipo = effectiveDayType(employee.id,date);
  const hasLunch = !!(employee.almoco_inicio && employee.almoco_fim);
  if (!date) return toast("Escolha a data.");
  if (tipo === 'trabalho' || tipo === 'feriado_trabalhado') {
    if (hasLunch && ((lunchOut && !lunchIn) || (!lunchOut && lunchIn))) return toast("Informe os dois horários do almoço ou deixe os dois vazios.");
  }
  // Os horários digitados são horários locais da loja (Brasil/Fortaleza).
  // O -03:00 evita que o Supabase/browser interprete 07:28 como UTC e mostre 04:28.
  const makeDateTime = (time) => time ? `${date}T${time}:00-03:00` : null;
  const payload = {
    funcionario_id: employee.id,
    data: date,
    chegada: makeDateTime(arrival),
    saida_almoco: hasLunch && lunchOut ? makeDateTime(lunchOut) : null,
    retorno_almoco: hasLunch && lunchIn ? makeDateTime(lunchIn) : null,
    saida: makeDateTime(departure),
    tipo_dia: tipo,
    updated_at: localDateTime()
  };
  // Para folga/férias ou ausência, não carregamos horários antigos sem querer.
  if (tipo === 'nao_veio' || tipo === 'folga_ferias') {
    payload.chegada = null; payload.saida_almoco = null; payload.retorno_almoco = null; payload.saida = null;
  }
  try {
    const result = await db.from("pontos_funcionarios").upsert(payload, { onConflict: "funcionario_id,data" }).select().single();
    if (result.error) throw result.error;
    closeAttendanceModal();
    await loadEmployees({silent:true});
    toast(`${employee.nome}: lançamento salvo.`);
  } catch(error) {
    console.error(error);
    toast("Erro ao salvar o lançamento. Confira o Console.");
  }
}

async function clearAttendance(employee, date=selectedCalendarDate||localDateISO()) {
  if(!confirm(`Limpar o ponto de ${formatDateBR(date)} de ${employee.nome}?`)) return;
  try {
    const r=await db.from("pontos_funcionarios").delete().eq("funcionario_id",employee.id).eq("data",date);
    if(r.error) throw r.error;
    await loadEmployees({silent:true});
    toast("Ponto de hoje apagado.");
  } catch(error){console.error(error);toast("Erro ao limpar o ponto.");}
}

function openScheduleModal(employee) {
  $("scheduleEmployeeId").value=employee.id;
  $("segEntrada").value=(employee.seg_sex_entrada||"").slice(0,5);
  $("segSaida").value=(employee.seg_sex_saida||"").slice(0,5);
  $("sabEntrada").value=(employee.sab_entrada||"").slice(0,5);
  $("sabSaida").value=(employee.sab_saida||"").slice(0,5);
  $("almocoInicio").value=(employee.almoco_inicio||"").slice(0,5);
  $("almocoFim").value=(employee.almoco_fim||"").slice(0,5);
  $("scheduleObservation").value=employee.observacao||"";
  $("scheduleModal").classList.remove("hidden");
}

function closeScheduleModal() { $("scheduleModal")?.classList.add("hidden"); }

async function saveSchedule() {
  const id=$("scheduleEmployeeId").value;
  const payload={
    seg_sex_entrada:$("segEntrada").value||null,
    seg_sex_saida:$("segSaida").value||null,
    sab_entrada:$("sabEntrada").value||null,
    sab_saida:$("sabSaida").value||null,
    almoco_inicio:$("almocoInicio").value||null,
    almoco_fim:$("almocoFim").value||null,
    observacao:$("scheduleObservation").value.trim()||null,
    updated_at:new Date().toISOString()
  };
  if((payload.seg_sex_entrada && !payload.seg_sex_saida) || (!payload.seg_sex_entrada && payload.seg_sex_saida)) return toast("Preencha entrada e saída de segunda a sexta.");
  if((payload.sab_entrada && !payload.sab_saida) || (!payload.sab_entrada && payload.sab_saida)) return toast("Preencha entrada e saída do sábado, ou deixe os dois vazios.");
  if((payload.almoco_inicio && !payload.almoco_fim) || (!payload.almoco_inicio && payload.almoco_fim)) return toast("Preencha início e retorno do almoço, ou deixe os dois vazios.");
  try {
    const r=await db.from("funcionarios").update(payload).eq("id",id);
    if(r.error) throw r.error;
    closeScheduleModal();
    await loadEmployees({silent:true});
    toast("Horários salvos com sucesso.");
  } catch(error){console.error(error);toast("Erro ao salvar os horários.");}
}

function openMenu(){ $("menuOverlay")?.classList.remove("hidden"); }
function closeMenu(){ $("menuOverlay")?.classList.add("hidden"); }
function openEmployeeLogin(){
  closeMenu();
  $("employeePassword").value="";
  $("employeeLogin")?.classList.remove("hidden");
  setTimeout(()=>$("employeePassword")?.focus(),50);
}
function closeEmployeeLogin(){ $("employeeLogin")?.classList.add("hidden"); }
function employeeLogin(){
  if($("employeePassword").value===EMPLOYEE_PASSWORD){
    closeEmployeeLogin();
    $("controlView")?.classList.add("hidden");
    $("tvView")?.classList.add("hidden");
    $("employeesView")?.classList.remove("hidden");
    loadEmployees();
  } else toast("Senha incorreta.");
}
function closeEmployees(){
  $("employeesView")?.classList.add("hidden");
  $("controlView")?.classList.remove("hidden");
}

function setupEmployeeUI(){
  $("menuBtn")?.addEventListener("click",openMenu);
  $("menuClose")?.addEventListener("click",closeMenu);
  $("menuOverlay")?.addEventListener("click",e=>{if(e.target.id==="menuOverlay")closeMenu();});
  $("employeesMenu")?.addEventListener("click",openEmployeeLogin);
  $("employeeLoginBtn")?.addEventListener("click",employeeLogin);
  $("employeeLoginCancel")?.addEventListener("click",closeEmployeeLogin);
  $("employeePassword")?.addEventListener("keydown",e=>{if(e.key==="Enter")employeeLogin();});
  $("employeesBack")?.addEventListener("click",closeEmployees);
  $("scheduleClose")?.addEventListener("click",closeScheduleModal);
  $("scheduleCancel")?.addEventListener("click",closeScheduleModal);
  $("scheduleSave")?.addEventListener("click",saveSchedule);
  $("scheduleModal")?.addEventListener("click",e=>{if(e.target.id==="scheduleModal")closeScheduleModal();});
  $("attendanceClose")?.addEventListener("click",closeAttendanceModal);
  $("attendanceCancel")?.addEventListener("click",closeAttendanceModal);
  $("attendanceSave")?.addEventListener("click",saveAttendanceManual);
  $("attendanceModal")?.addEventListener("click",e=>{if(e.target.id==="attendanceModal")closeAttendanceModal();});
  $("employeeHistoryClose")?.addEventListener("click",closeEmployeeHistory);
  $("historyApply")?.addEventListener("click",()=>{const e=employeeRows.find(x=>x.id===selectedEmployeeId); if(e) renderEmployeeHistory(e,$("historyStart").value,$("historyEnd").value);});
  $("employeeHistoryModal")?.addEventListener("click",e=>{if(e.target.id==="employeeHistoryModal")closeEmployeeHistory();});
}

const originalInit = init;
// Complementa a inicialização original sem substituir a lógica do controle de óleo.
document.addEventListener("DOMContentLoaded", () => {
  setupEmployeeUI();
  const oldSubscribe = subscribe;
});
