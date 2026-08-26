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
let selectedCalendarDate = new Date().toISOString().slice(0, 10);
let agendaOpenState = false;
let calendarMonth = new Date();
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
    .on("postgres_changes", { event:"*", schema:"public", table:"agenda_mecanicos" }, () => loadMechanicsAgenda({silent:true}))
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
let mechanicAgendaRows = [];
let selectedMechanicName = MECHANICS[0];
let mechanicCalendarMonth = new Date();
let selectedMechanicDate = localDateISO();

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
  // Só descontamos o intervalo do almoço quando os dois horários existem.
  // Assim, um lançamento parcial (por exemplo, apenas a saída para almoço)
  // permanece válido e pode ser completado depois sem inventar a duração do intervalo.
  if (point.saida_almoco && point.retorno_almoco) {
    total -= Math.max(0,(make(point.retorno_almoco)-make(point.saida_almoco))/60000);
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
    if(!$('employeeManagerModal')?.classList.contains('hidden')) renderEmployeeManager();
    await loadMechanicsAgenda({silent:true});
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

  // Saldo mensal: somente dias concluídos entram no cálculo.
  // O dia de hoje só entra depois que a SAÍDA for lançada.
  const today = localDateISO();
  const d0 = new Date();
  d0.setDate(1);
  const firstDay = localDateISO(d0);
  const days = dateRangeDays(firstDay, today);
  let total = 0;

  for (const date of days) {
    const isToday = date === today;
    const agenda = getAgenda(employeeId, date);
    const point = getPoint(employeeId, date);
    const type = agenda?.tipo || point?.tipo_dia || 'trabalho';

    // Nunca contabiliza o dia corrente antes da saída.
    if (isToday && !point?.saida) continue;

    if (type === 'folga' || type === 'ferias' || type === 'folga_ferias') continue;

    const expected = expectedMinutes(employee, date, type);

    if (type === 'nao_veio') {
      total -= expected;
      continue;
    }

    // Trabalho/feriado só entra quando há saída registrada.
    if (!point?.saida) continue;

    const worked = workedMinutes(point, employee, new Date());
    total += type === 'feriado_trabalhado' ? worked : (worked - expected);
  }

  return Math.round(total);
}

function employeeDailyBaseMinutes(employee){
  const d=new Date();
  d.setDate(1);
  for(let i=0;i<31;i++){
    const iso=localDateISO(d);
    const mins=expectedMinutes(employee,iso,'trabalho');
    if(mins>0) return mins;
    d.setDate(d.getDate()+1);
  }
  return 540;
}
function signedDaysAndMinutes(days, baseMinutes){
  const sign=days<0?'−':days>0?'+':'';
  const abs=Math.abs(days);
  const whole=Math.floor(abs+1e-9);
  const mins=Math.round((abs-whole)*baseMinutes);
  if(mins>=baseMinutes){ return `${sign}${whole+1} dia 00:00`; }
  return `${sign}${whole} dia ${String(Math.floor(mins/60)).padStart(2,'0')}:${String(mins%60).padStart(2,'0')}`;
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
    else if(p.saida) {
      const bal=workedMinutes(p,employee,new Date())-dailyExpected;
      if(bal>0) workedExtra += bal;
    }
  }
  const manualDays = Math.max(0, Number(employee.dias_folga_ferias || 0));
  const manualDebtDays = Math.max(0, Number(employee.dias_devidos || 0));
  const dailyBase = employeeDailyBaseMinutes(employee);
  const absenceDays = absenceMinutes / dailyBase;
  const hourCreditsDays = workedExtra / dailyBase;
  const periodBalance = employeePeriodBalance(employee.id);
  const monthlyCreditDays = Math.max(0, periodBalance) / dailyBase;
  const monthlyDebtDays = Math.abs(Math.min(0, periodBalance)) / dailyBase;
  const totalCreditDays = manualDays + holidayCredits + hourCreditsDays + monthlyCreditDays;
  const grossDebtDays = manualDebtDays + monthlyDebtDays;
  const remainingCredits = Math.max(0, totalCreditDays - usedLeave);
  const netAvailableDays = remainingCredits - grossDebtDays;
  const totalDebtDays = Math.max(0, grossDebtDays - remainingCredits);
  const daysMissing = totalDebtDays;
  return {absenceMinutes,absenceDays,holidayCredits,usedLeave,manualDays,manualDebtDays,workedExtra,hourCreditsDays,periodBalance,monthlyCreditDays,monthlyDebtDays,totalCreditDays,remainingCredits,grossDebtDays,netAvailableDays,totalDebtDays,daysMissing,dailyBase};
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
  try{
    const previous = getAgenda(employee.id,date)?.tipo || null;
    const wasAbsence = previous === 'nao_veio';
    const willBeAbsence = type === 'nao_veio';

    const r=await db.from('agenda_funcionarios').upsert({funcionario_id:employee.id,data:date,tipo:type,observacao:null,updated_at:new Date().toISOString()},{onConflict:'funcionario_id,data'}).select().single();
    if(r.error)throw r.error;

    // Cada dia marcado como NÃO VEIO entra no saldo acumulado de dias devidos.
    // Se o mesmo dia já era falta, não soma novamente. Se a falta for alterada
    // para outro tipo, devolve 1 dia ao saldo anterior.
    if(willBeAbsence !== wasAbsence){
      const currentDebt = Math.max(0, Number(employee.dias_devidos || 0));
      const nextDebt = Math.max(0, currentDebt + (willBeAbsence ? 1 : -1));
      const u = await db.from('funcionarios').update({dias_devidos:nextDebt,updated_at:new Date().toISOString()}).eq('id',employee.id);
      if(u.error) throw u.error;
      employee.dias_devidos = nextDebt;
    }

    const i=employeeAgenda.findIndex(a=>a.funcionario_id===employee.id&&a.data===date);
    if(i>=0)employeeAgenda[i]=r.data;else employeeAgenda.push(r.data);
    renderEmployees();
    toast(`${employee.nome}: ${agendaLabel(type)} em ${formatDateBR(date)}${willBeAbsence && !wasAbsence ? ' • +1 dia devido' : (!willBeAbsence && wasAbsence ? ' • -1 dia devido' : '')}`);
  }catch(e){console.error(e);toast('Erro ao salvar a agenda: ' + (e?.message || 'verifique o Supabase.'));}
}
async function clearAgendaDay(employee,date){
  if(!db)return toast('Supabase não conectado.');
  try{
    const previous = getAgenda(employee.id,date)?.tipo || null;
    const r=await db.from('agenda_funcionarios').delete().eq('funcionario_id',employee.id).eq('data',date);
    if(r.error)throw r.error;
    if(previous === 'nao_veio'){
      const currentDebt = Math.max(0, Number(employee.dias_devidos || 0));
      const nextDebt = Math.max(0, currentDebt - 1);
      const u = await db.from('funcionarios').update({dias_devidos:nextDebt,updated_at:new Date().toISOString()}).eq('id',employee.id);
      if(u.error)throw u.error;
      employee.dias_devidos = nextDebt;
    }
    employeeAgenda=employeeAgenda.filter(a=>!(a.funcionario_id===employee.id&&a.data===date));
    renderEmployees();
    toast(`Definição do dia removida.${previous === 'nao_veio' ? ' • -1 dia devido' : ''}`);
  }catch(e){console.error(e);toast('Erro ao limpar o dia da agenda.');}
}
function renderAgendaControls(employee){
  const host=$("agendaControls");if(!host)return;
  const date=selectedCalendarDate,type=effectiveDayType(employee.id,date),a=getAgenda(employee.id,date),p=getPoint(employee.id,date),credit=Number(employee.dias_folga_ferias||0),debt=Number(employee.dias_devidos||0);
  host.innerHTML=`<div class="agenda-selected"><div><small>DIA SELECIONADO</small><strong>${formatDateBR(date)}</strong></div><div><small>SITUAÇÃO</small><strong>${agendaLabel(type)}</strong></div><div><small>LANÇAMENTO</small><strong>${p?'PONTO REGISTRADO':'SEM PONTO'}</strong></div></div><div class="agenda-buttons"><button class="secondary" data-agenda="trabalho">TRABALHO</button><button class="secondary" data-agenda="folga">FOLGA</button><button class="secondary" data-agenda="ferias">FÉRIAS</button><button class="secondary" data-agenda="feriado_trabalhado">FERIADO TRABALHADO</button><button class="secondary" data-agenda="nao_veio">NÃO VEIO</button>${a?'<button class="danger-secondary" id="clearAgenda">LIMPAR DIA</button>':''}</div><div class="credit-editor"><label>DIAS DE FOLGA/FÉRIAS DISPONÍVEIS<input id="creditDaysScreen" type="number" min="0" step="0.5" value="${credit}"></label><label>DIAS QUE JÁ DEVE / FALTAS ANTERIORES<input id="debtDaysScreen" type="number" min="0" step="0.5" value="${debt}"></label><button class="secondary" id="saveCreditsAndDebt">SALVAR SALDOS</button></div><p class="agenda-help">Defina dias anteriores ou futuros pelo calendário. O saldo inicial de dias devidos pode ser informado aqui e será compensado por folgas/férias disponíveis, feriados trabalhados e créditos de horas.</p>`;
  host.querySelectorAll('[data-agenda]').forEach(btn=>btn.addEventListener('click',()=>setAgendaDay(employee,date,btn.dataset.agenda)));
  $("clearAgenda")?.addEventListener('click',()=>clearAgendaDay(employee,date));
  $("saveCreditsAndDebt")?.addEventListener('click',async()=>{const val=Math.max(0,Number($("creditDaysScreen").value||0)),debtVal=Math.max(0,Number($("debtDaysScreen").value||0));try{const r=await db.from('funcionarios').update({dias_folga_ferias:val,dias_devidos:debtVal,updated_at:new Date().toISOString()}).eq('id',employee.id);if(r.error)throw r.error;employee.dias_folga_ferias=val;employee.dias_devidos=debtVal;renderEmployees();toast('Saldos de dias atualizados.');}catch(e){console.error(e);toast('Erro ao salvar saldos. Execute o SQL da V11 no Supabase.');}});
}

const MECHANIC_CALENDAR_NAMES = ["AMAURI","SAMUEL","GIL","TIAGO","TIAGUINHO"];
function mechanicAgendaFor(name,date=selectedMechanicDate){ return mechanicAgendaRows.find(r=>r.mecanico===name&&r.data===date)||null; }
async function loadMechanicsAgenda({silent=false}={}){ if(!db)return; try{const r=await db.from('agenda_mecanicos').select('*').order('data',{ascending:true}); if(r.error)throw r.error; mechanicAgendaRows=r.data||[]; if(!$('mechanicsView')?.classList.contains('hidden'))renderMechanics();}catch(e){console.error('Mecânicos — erro ao carregar:',e);if(!silent)toast('Não foi possível carregar a agenda dos mecânicos. Execute mechanics_agenda_v12.sql no Supabase.');} }
function renderMechanicCalendar(name){const host=$('mechanicCalendar');if(!host)return;const y=mechanicCalendarMonth.getFullYear(),m=mechanicCalendarMonth.getMonth(),first=new Date(y,m,1),start=(first.getDay()+6)%7,daysIn=new Date(y,m+1,0).getDate(),cells=[];for(let i=0;i<start;i++)cells.push('<div class="calendar-day empty"></div>');for(let day=1;day<=daysIn;day++){const date=`${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`,a=mechanicAgendaFor(name,date),badge=a?.nao_veio?'<span class="calendar-badge absence">NÃO VEM</span>':'';cells.push(`<button type="button" class="calendar-day ${date===selectedMechanicDate?'selected':''} ${date===localDateISO()?'today':''}" data-mech-date="${date}"><b>${day}</b>${badge}</button>`);}host.innerHTML=`<div class="calendar-head"><button class="icon-btn" id="mechCalPrev">‹</button><strong>${calendarTitle(mechanicCalendarMonth)}</strong><button class="icon-btn" id="mechCalNext">›</button></div><div class="calendar-week"><span>SEG</span><span>TER</span><span>QUA</span><span>QUI</span><span>SEX</span><span>SÁB</span><span>DOM</span></div><div class="calendar-grid">${cells.join('')}</div>`;host.querySelectorAll('.calendar-day:not(.empty)').forEach(btn=>btn.addEventListener('click',()=>{selectedMechanicDate=btn.dataset.mechDate;renderMechanics();}));$('mechCalPrev')?.addEventListener('click',()=>{mechanicCalendarMonth.setMonth(mechanicCalendarMonth.getMonth()-1);renderMechanicCalendar(name);});$('mechCalNext')?.addEventListener('click',()=>{mechanicCalendarMonth.setMonth(mechanicCalendarMonth.getMonth()+1);renderMechanicCalendar(name);});}
async function setMechanicAbsence(name,date){if(!db)return toast('Supabase não conectado.');try{const existing=mechanicAgendaFor(name,date);if(existing?.nao_veio)return toast(`${name} já está marcado como NÃO VEM em ${formatDateBR(date)}.`);const r=await db.from('agenda_mecanicos').upsert({mecanico:name,data:date,nao_veio:true,updated_at:new Date().toISOString()},{onConflict:'mecanico,data'}).select().single();if(r.error)throw r.error;const i=mechanicAgendaRows.findIndex(x=>x.mecanico===name&&x.data===date);if(i>=0)mechanicAgendaRows[i]=r.data;else mechanicAgendaRows.push(r.data);renderMechanics();toast(`${name}: NÃO VEM em ${formatDateBR(date)}.`);}catch(e){console.error(e);toast('Erro ao salvar a ausência: '+(e?.message||'verifique o Supabase.'));}}
async function clearMechanicAbsence(name,date){if(!db)return toast('Supabase não conectado.');try{const r=await db.from('agenda_mecanicos').delete().eq('mecanico',name).eq('data',date);if(r.error)throw r.error;mechanicAgendaRows=mechanicAgendaRows.filter(x=>!(x.mecanico===name&&x.data===date));renderMechanics();toast(`Ausência de ${name} removida de ${formatDateBR(date)}.`);}catch(e){console.error(e);toast('Erro ao limpar a ausência.');}}
function renderMechanics(){const list=$('mechanicList'),detail=$('mechanicDetail');if(!list||!detail)return;if($('mechanicDate'))$('mechanicDate').textContent=new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'});list.innerHTML=MECHANIC_CALENDAR_NAMES.map(name=>{const total=mechanicAgendaRows.filter(x=>x.mecanico===name&&x.nao_veio).length;return `<button class="employee-list-item ${name===selectedMechanicName?'active':''}" type="button" data-mech-name="${name}"><span>${name}</span><small>${total} ${total===1?'ausência':'ausências'}</small></button>`;}).join('');list.querySelectorAll('[data-mech-name]').forEach(b=>b.addEventListener('click',()=>{selectedMechanicName=b.dataset.mechName;mechanicCalendarMonth=new Date();selectedMechanicDate=localDateISO();renderMechanics();}));const name=selectedMechanicName,a=mechanicAgendaFor(name,selectedMechanicDate);detail.innerHTML=`<div class="employee-detail-head"><div><span class="employee-tag">MECÂNICO</span><h1>${name}</h1></div><div class="employee-head-actions"><button class="secondary" id="mechanicMarkAbsence">NÃO VEM NESTE DIA</button></div></div><div class="schedule-summary mechanic-summary"><div><b>DIA SELECIONADO</b><span>${formatDateBR(selectedMechanicDate)}</span></div><div><b>SITUAÇÃO</b><span>${a?.nao_veio?'NÃO VEM':'DISPONÍVEL / SEM MARCAÇÃO'}</span></div><div><b>OBJETIVO</b><span>Somente agenda de ausência</span></div></div><div class="agenda-card mechanic-agenda-card"><div class="agenda-card-title">AGENDA DO MECÂNICO</div><div id="mechanicCalendar" class="employee-calendar"></div><div class="agenda-buttons mechanic-agenda-buttons"><button class="secondary" id="mechanicMarkAbsence2">NÃO VEM</button>${a?'<button class="danger-secondary" id="mechanicClearAbsence">LIMPAR DIA</button>':''}</div><p class="agenda-help">Selecione qualquer data, inclusive futura ou passada, para anotar quando o mecânico avisar que não virá. Não há cálculo de carga horária.</p></div>`;renderMechanicCalendar(name);$('mechanicMarkAbsence')?.addEventListener('click',()=>setMechanicAbsence(name,selectedMechanicDate));$('mechanicMarkAbsence2')?.addEventListener('click',()=>setMechanicAbsence(name,selectedMechanicDate));$('mechanicClearAbsence')?.addEventListener('click',()=>clearMechanicAbsence(name,selectedMechanicDate));}

function makeEmployeeId(name) {
  const base = String(name).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,'_').replace(/^_+|_+$/g,'') || 'FUNCIONARIO';
  return `${base}_${Date.now()}_${Math.floor(Math.random()*1000)}`;
}

function openEmployeeManager(){
  renderEmployeeManager();
  $('employeeManagerModal')?.classList.remove('hidden');
}
function closeEmployeeManager(){ $('employeeManagerModal')?.classList.add('hidden'); }

function renderEmployeeManager(){
  const host=$('employeeManagerList');
  if(!host) return;
  host.innerHTML = employeeRows.map(e=>`<div class="employee-manager-row"><div><strong>${escapeHtml(e.nome)}</strong><small>ATIVO</small></div><button class="danger-secondary" type="button" data-remove-employee="${escapeHtml(e.id)}">REMOVER</button></div>`).join('') || '<p class="empty-employees">Nenhum funcionário ativo.</p>';
  host.querySelectorAll('[data-remove-employee]').forEach(btn=>btn.addEventListener('click',()=>removeEmployee(btn.dataset.removeEmployee)));
}

async function addEmployee(){
  const input=$('newEmployeeName');
  const name=input?.value.trim().replace(/\s+/g,' ');
  if(!name) return toast('Digite o nome do funcionário.');
  if(!db) return toast('Supabase não conectado.');
  try{
    const existing=await db.from('funcionarios').select('id,nome,ativo').ilike('nome',name);
    if(existing.error) throw existing.error;
    const same=(existing.data||[])[0];
    if(same?.ativo) return toast('Esse funcionário já está cadastrado.');
    if(same){
      const r=await db.from('funcionarios').update({ativo:true,updated_at:new Date().toISOString()}).eq('id',same.id);
      if(r.error) throw r.error;
    }else{
      const r=await db.from('funcionarios').insert({id:makeEmployeeId(name),nome:name,ativo:true});
      if(r.error) throw r.error;
    }
    input.value='';
    await loadEmployees({silent:true});
    renderEmployeeManager();
    toast(`${name} adicionado à equipe.`);
  }catch(e){
    console.error('Erro ao adicionar funcionário:',e);
    toast('Erro ao adicionar funcionário: '+(e?.message||'verifique o Supabase.'));
  }
}

async function removeEmployee(id){
  const employee=employeeRows.find(e=>e.id===id);
  if(!employee) return;
  if(!confirm(`Remover ${employee.nome} da equipe?\n\nOs históricos, pontos e agendas serão preservados.`)) return;
  try{
    const r=await db.from('funcionarios').update({ativo:false,updated_at:new Date().toISOString()}).eq('id',id);
    if(r.error) throw r.error;
    if(selectedEmployeeId===id) selectedEmployeeId='';
    await loadEmployees({silent:true});
    renderEmployeeManager();
    toast(`${employee.nome} foi removido da equipe.`);
  }catch(e){
    console.error('Erro ao remover funcionário:',e);
    toast('Erro ao remover funcionário: '+(e?.message||'verifique o Supabase.'));
  }
}

function renderEmployees() {
  const list=$("employeeList"),detail=$("employeeDetail");if(!list||!detail)return;
  const today=localDateISO();if($("employeeDate"))$("employeeDate").textContent=new Date().toLocaleDateString("pt-BR",{weekday:"long",day:"2-digit",month:"2-digit",year:"numeric"});
  list.innerHTML=employeeRows.map(e=>{const type=effectiveDayType(e.id,today),p=getPoint(e.id,today),completed=!!p?.saida,bal=type==='trabalho'&&completed?workedMinutes(p,e)-expectedMinutes(e,today,'trabalho'):(type==='feriado_trabalhado'&&completed?workedMinutes(p,e):0);return `<button class="employee-list-item ${e.id===selectedEmployeeId?'active':''}" type="button" data-id="${e.id}"><span>${escapeHtml(e.nome)}</span><small class="${bal<0?'negative':'positive'}">${completed?minutesToHuman(bal):agendaLabel(type)}</small></button>`;}).join('')||'<div class="empty-employees">Nenhum funcionário encontrado.</div>';
  list.querySelectorAll('.employee-list-item').forEach(b=>b.addEventListener('click',()=>{selectedEmployeeId=b.dataset.id;calendarMonth=new Date();selectedCalendarDate=localDateISO();renderEmployees();}));
  const e=employeeRows.find(x=>x.id===selectedEmployeeId);if(!e){detail.innerHTML='<p>Nenhum funcionário selecionado.</p>';return;}
  const viewDate=selectedCalendarDate||today, type=effectiveDayType(e.id,viewDate),p=getPoint(e.id,viewDate),expected=expectedMinutes(e,viewDate,'trabalho'),worked=(type==='trabalho'||type==='feriado_trabalhado')?workedMinutes(p,e):0,daily=type==='folga'||type==='ferias'?0:(type==='nao_veio'?-expected:(type==='feriado_trabalhado'?worked:worked-expected)),period=employeePeriodBalance(e.id),ledger=employeeDayLedger(e);
  detail.innerHTML=`<div class="employee-detail-head"><div><span class="employee-tag">ATIVO</span><h1>${escapeHtml(e.nome)}</h1></div><div class="employee-head-actions"><button class="secondary" id="historyBtn">HISTÓRICO</button><button class="secondary" id="editScheduleBtn">ALTERAR HORÁRIOS</button></div></div><div class="schedule-summary"><div><b>HORÁRIO DE TRABALHO</b><span>Seg a Sex: ${e.seg_sex_entrada||'—'} às ${e.seg_sex_saida||'—'}</span><span>Sábado: ${e.sab_entrada&&e.sab_saida?`${e.sab_entrada} às ${e.sab_saida}`:'Não trabalha'}</span></div><div><b>ALMOÇO</b><span>${e.almoco_inicio&&e.almoco_fim?`${e.almoco_inicio} às ${e.almoco_fim}`:'Sem horário de almoço'}</span></div><div><b>CARGA ESPERADA HOJE</b><span>${durationHuman(expected)}</span></div></div><div class="agenda-card"><button type="button" class="agenda-toggle" id="agendaToggle"><span>AGENDA DO FUNCIONÁRIO <small id="agendaSummaryText" class="agenda-summary-text"></small></span><span id="agendaToggleIcon">＋</span></button><div id="agendaBody" class="agenda-body collapsed"><div id="employeeCalendar" class="employee-calendar"></div><div id="agendaControls"></div></div></div><div class="attendance-card"><div class="section-title">REGISTRO DE HORÁRIOS <span>${formatDateBR(viewDate)}</span></div><div class="attendance-status-line">STATUS DO DIA: <strong>${agendaLabel(type)}</strong></div><div class="attendance-grid"><div><small>CHEGADA</small><strong>${fmtTime(p?.chegada)}</strong></div><div><small>SAÍDA ALMOÇO</small><strong>${fmtTime(p?.saida_almoco)}</strong></div><div><small>RETORNO</small><strong>${fmtTime(p?.retorno_almoco)}</strong></div><div><small>SAÍDA</small><strong>${fmtTime(p?.saida)}</strong></div></div><button class="employee-primary" id="attendanceBtn">LANÇAR HORÁRIOS</button><button class="secondary" id="clearAttendanceBtn">LIMPAR LANÇAMENTO DO DIA</button></div><div class="balance-grid"><div><small>HORAS TRABALHADAS</small><strong>${durationHuman(worked)}</strong></div><div><small>HORAS ESPERADAS</small><strong>${durationHuman(expected)}</strong></div><div><small>SALDO DO DIA</small><strong class="${daily<0?'negative':'positive'}">${minutesToHuman(daily)}</strong></div><div><small>SALDO NO MÊS</small><strong class="${period<0?'negative':'positive'}">${minutesToHuman(period)}</strong></div></div><div class="credit-summary"><div><small>DIAS DISPONÍVEIS</small><strong class="${ledger.remainingCredits>0?'positive':''}">${ledger.remainingCredits.toFixed(2)}</strong></div><div><small>FERIADOS TRABALHADOS</small><strong>${ledger.holidayCredits}</strong></div><div><small>HORAS EM CRÉDITO</small><strong>${ledger.hourCreditsDays.toFixed(2)} dia</strong></div><div><small>DIAS JÁ DEVIDOS</small><strong class="${ledger.manualDebtDays>0?'negative':'positive'}">${ledger.manualDebtDays.toFixed(2)}</strong></div><div><small>SALDO DISPONÍVEL</small><strong class="${ledger.netAvailableDays<0?'negative':'positive'}">${signedDaysAndMinutes(ledger.netAvailableDays,ledger.dailyBase)}</strong></div></div><div class="schedule-note-display">${escapeHtml(e.observacao||'')}</div>`;
  renderEmployeeCalendar(e);renderAgendaControls(e);
  const agendaBody=$("agendaBody");
  const agendaIcon=$("agendaToggleIcon");
  if(agendaBody){ agendaBody.classList.toggle("collapsed", !agendaOpenState); if(agendaIcon) agendaIcon.textContent=agendaOpenState?"−":"＋"; }
  $("agendaToggle")?.addEventListener("click",()=>{ agendaOpenState=!agendaOpenState; const body=$("agendaBody"); if(body) body.classList.toggle("collapsed", !agendaOpenState); if($("agendaToggleIcon")) $("agendaToggleIcon").textContent=agendaOpenState?"−":"＋"; });$("attendanceBtn")?.addEventListener('click',()=>openAttendanceModal(e));$("clearAttendanceBtn")?.addEventListener('click',()=>clearAttendance(e,viewDate));$("historyBtn")?.addEventListener('click',()=>openEmployeeHistory(e));$("editScheduleBtn")?.addEventListener('click',()=>openScheduleModal(e));
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
    // O almoço pode ser lançado parcialmente: saída agora e retorno depois, ou vice-versa.
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
function openMechanicsView(){ $("menuOverlay")?.classList.add("hidden"); $("controlView")?.classList.add("hidden"); $("tvView")?.classList.add("hidden"); $("employeesView")?.classList.add("hidden"); $("mechanicsView")?.classList.remove("hidden"); mechanicCalendarMonth=new Date(); selectedMechanicDate=localDateISO(); renderMechanics(); loadMechanicsAgenda({silent:true}); }
function closeMechanicsView(){ $("mechanicsView")?.classList.add("hidden"); $("controlView")?.classList.remove("hidden"); }

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

function toggleEmployeePassword(){
  const input = $("employeePassword");
  const btn = $("employeePasswordToggle");
  if(!input || !btn) return;
  const showing = input.type === "text";
  input.type = showing ? "password" : "text";
  btn.textContent = showing ? "👁" : "🙈";
  btn.setAttribute("aria-label", showing ? "Mostrar senha" : "Ocultar senha");
  btn.setAttribute("title", showing ? "Mostrar senha" : "Ocultar senha");
}

function setupEmployeeUI(){
  $("menuBtn")?.addEventListener("click",openMenu);
  $("menuClose")?.addEventListener("click",closeMenu);
  $("menuOverlay")?.addEventListener("click",e=>{if(e.target.id==="menuOverlay")closeMenu();});
  $("employeesMenu")?.addEventListener("click",openEmployeeLogin);
  $("mechanicsMenu")?.addEventListener("click",()=>{ closeMenu(); openMechanicsView(); });
  $("mechanicsBack")?.addEventListener("click",closeMechanicsView);
  $("employeeLoginBtn")?.addEventListener("click",employeeLogin);
  $("employeeLoginCancel")?.addEventListener("click",closeEmployeeLogin);
  $("employeePassword")?.addEventListener("keydown",e=>{if(e.key==="Enter")employeeLogin();});
  $("employeePasswordToggle")?.addEventListener("click",toggleEmployeePassword);
  $("employeesBack")?.addEventListener("click",closeEmployees);
  $("manageEmployeesBtn")?.addEventListener("click",openEmployeeManager);
  $("employeeManagerClose")?.addEventListener("click",closeEmployeeManager);
  $("employeeManagerCancel")?.addEventListener("click",closeEmployeeManager);
  $("employeeManagerAdd")?.addEventListener("click",addEmployee);
  $("newEmployeeName")?.addEventListener("keydown",e=>{if(e.key==="Enter")addEmployee();});
  $("employeeManagerModal")?.addEventListener("click",e=>{if(e.target.id==="employeeManagerModal")closeEmployeeManager();});
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
