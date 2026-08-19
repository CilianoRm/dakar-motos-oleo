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
    .subscribe(status => {
      console.log("Dakar Motos Realtime:", status);
    });

  clearInterval(pollingTimer);
  // Realtime é o principal. Este polling é uma proteção caso algum navegador/roteador bloqueie WebSocket.
  pollingTimer = setInterval(() => load({ silent:true }), 5000);
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

function isCreditType(type){ return type === 'feriado_trabalhado' || type === 'folga_ferias'; }
function pointCreditDays(point, employee){
  if (!point) return 0;
  if (point.tipo_dia === 'feriado_trabalhado') return 1;
  return 0;
}

async function loadEmployees({silent=false}={}) {
  if (!db) return;
  try {
    const [emps, points] = await Promise.all([
      db.from("funcionarios").select("*").eq("ativo",true).order("nome"),
      db.from("pontos_funcionarios").select("*").gte("data", monthStartISO()).order("data",{ascending:false})
    ]);
    if (emps.error) throw emps.error;
    if (points.error) throw points.error;
    employeeRows = emps.data || [];
    employeePoints = points.data || [];
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
    if (p.tipo_dia === 'nao_veio' || p.tipo_dia === 'folga_ferias') return sum;
    const expected = expectedMinutes(employee,p.data,p.tipo_dia);
    return sum + (workedMinutes(p,employee,new Date()) - expected);
  },0);
}

function employeeDayLedger(employee){
  const today = new Date();
  const ym = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}`;
  const rows = employeePoints.filter(p=>p.funcionario_id===employee.id && p.data.startsWith(ym));
  let absenceMinutes=0, holidayCredits=0, usedLeave=0, workedExtra=0;
  for(const p of rows){
    const dailyExpected = expectedMinutes(employee,p.data,'trabalho');
    if(p.tipo_dia==='nao_veio') absenceMinutes += dailyExpected;
    else if(p.tipo_dia==='feriado_trabalhado') holidayCredits += 1;
    else if(p.tipo_dia==='folga_ferias') usedLeave += 1;
    else {
      const exp=expectedMinutes(employee,p.data,p.tipo_dia); const bal=workedMinutes(p,employee,new Date())-exp;
      if(bal>0) workedExtra += bal;
    }
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

function renderEmployees() {
  const list = $("employeeList");
  const detail = $("employeeDetail");
  if (!list || !detail) return;
  const today = localDateISO();
  const todayLabel = new Date().toLocaleDateString("pt-BR",{weekday:"long",day:"2-digit",month:"2-digit",year:"numeric"});
  if ($("employeeDate")) $("employeeDate").textContent = todayLabel;

  list.innerHTML = employeeRows.map(e=>{
    const p=getPoint(e.id,today);
    const bal=(p?.tipo_dia==='nao_veio'||p?.tipo_dia==='folga_ferias') ? 0 : workedMinutes(p,e)-expectedMinutes(e,today,p?.tipo_dia||'trabalho');
    return `<button class="employee-list-item ${e.id===selectedEmployeeId?"active":""}" type="button" data-id="${e.id}">
      <span>${escapeHtml(e.nome)}</span><small class="${bal<0?"negative":"positive"}">${minutesToHuman(bal)}</small>
    </button>`;
  }).join("") || `<div class="empty-employees">Nenhum funcionário encontrado.</div>`;
  list.querySelectorAll(".employee-list-item").forEach(b=>b.addEventListener("click",()=>{selectedEmployeeId=b.dataset.id;renderEmployees();}));

  const e=employeeRows.find(x=>x.id===selectedEmployeeId);
  if (!e) { detail.innerHTML="<p>Nenhum funcionário selecionado.</p>"; return; }
  const p=getPoint(e.id,today);
  const expected=expectedMinutes(e,today,p?.tipo_dia||'trabalho');
  const worked=(p?.tipo_dia==='nao_veio'||p?.tipo_dia==='folga_ferias') ? 0 : workedMinutes(p,e);
  const daily=(p?.tipo_dia==='folga_ferias') ? 0 : (p?.tipo_dia==='nao_veio' ? -expectedMinutes(e,today,'trabalho') : worked-expected);
  const period=employeePeriodBalance(e.id);
  const ledger=employeeDayLedger(e);
  const sch=scheduleFor(e,today);
  const statusLabel={trabalho:'DIA NORMAL',feriado_trabalhado:'FERIADO TRABALHADO',nao_veio:'NÃO VEIO',folga_ferias:'FOLGA / FÉRIAS'}[p?.tipo_dia||'trabalho'];

  detail.innerHTML=`
    <div class="employee-detail-head">
      <div><span class="employee-tag">ATIVO</span><h1>${escapeHtml(e.nome)}</h1></div>
      <button class="secondary" id="editScheduleBtn">ALTERAR HORÁRIOS</button>
    </div>
    <div class="schedule-summary">
      <div><b>HORÁRIO DE TRABALHO</b><span>Seg a Sex: ${e.seg_sex_entrada||"—"} às ${e.seg_sex_saida||"—"}</span><span>Sábado: ${e.sab_entrada&&e.sab_saida?`${e.sab_entrada} às ${e.sab_saida}`:"Não trabalha"}</span></div>
      <div><b>ALMOÇO</b><span>${e.almoco_inicio&&e.almoco_fim?`${e.almoco_inicio} às ${e.almoco_fim}`:"Sem horário de almoço"}</span></div>
      <div><b>CARGA ESPERADA HOJE</b><span>${durationHuman(expected)}</span></div>
    </div>
    <div class="attendance-card">
      <div class="section-title">REGISTRO DE HOJE <span>${today}</span></div>
      <div class="attendance-status-line">STATUS: <strong>${statusLabel}</strong></div>
      <div class="attendance-grid">
        <div><small>CHEGADA</small><strong>${fmtTime(p?.chegada)}</strong></div>
        <div><small>SAÍDA ALMOÇO</small><strong>${fmtTime(p?.saida_almoco)}</strong></div>
        <div><small>RETORNO</small><strong>${fmtTime(p?.retorno_almoco)}</strong></div>
        <div><small>SAÍDA</small><strong>${fmtTime(p?.saida)}</strong></div>
      </div>
      <button class="employee-primary" id="attendanceBtn">LANÇAR HORÁRIOS / STATUS</button>
      <button class="secondary" id="clearAttendanceBtn">LIMPAR LANÇAMENTO DE HOJE</button>
    </div>
    <div class="balance-grid">
      <div><small>HORAS TRABALHADAS</small><strong>${durationHuman(worked)}</strong></div>
      <div><small>HORAS ESPERADAS</small><strong>${durationHuman(expected)}</strong></div>
      <div><small>SALDO DO DIA</small><strong class="${daily<0?"negative":"positive"}">${minutesToHuman(daily)}</strong></div>
      <div><small>SALDO NO MÊS</small><strong class="${period<0?"negative":"positive"}">${minutesToHuman(period)}</strong></div>
    </div>
    <div class="credit-summary">
      <div><small>CRÉDITOS DE FOLGA/FÉRIAS DISPONÍVEIS</small><strong>${ledger.remainingCredits.toFixed(2)}</strong></div>
      <div><small>FERIADOS TRABALHADOS</small><strong>${ledger.holidayCredits}</strong></div>
      <div><small>CRÉDITOS DE HORAS CONVERTIDOS EM DIAS</small><strong>${ledger.hourCreditsDays.toFixed(2)}</strong></div>
      <div><small>DIAS FALTADOS A COMPENSAR</small><strong class="${ledger.daysMissing>0?"negative":"positive"}">${ledger.daysMissing}</strong></div>
    </div>
    <div class="schedule-note-display">${escapeHtml(e.observacao||"")}</div>
  `;
  $("attendanceBtn")?.addEventListener("click",()=>openAttendanceModal(e));
  $("clearAttendanceBtn")?.addEventListener("click",()=>clearAttendance(e));
  $("editScheduleBtn")?.addEventListener("click",()=>openScheduleModal(e));
}

function openAttendanceModal(employee) {
  const date = localDateISO();
  const p = getPoint(employee.id, date);
  $("attendanceEmployeeId").value = employee.id;
  $("attendanceEmployeeName").textContent = employee.nome;
  $("attendanceDate").value = date;
  $("attendanceArrival").value = fmtInputTime(p?.chegada);
  $("attendanceLunchOut").value = fmtInputTime(p?.saida_almoco);
  $("attendanceLunchIn").value = fmtInputTime(p?.retorno_almoco);
  $("attendanceDeparture").value = fmtInputTime(p?.saida);
  $("attendanceStatus").value = p?.tipo_dia || 'trabalho';
  $("attendanceCreditDays").value = Number(employee.dias_folga_ferias || 0);
  const hasLunch = !!(employee.almoco_inicio && employee.almoco_fim);
  $("attendanceLunchFields").classList.toggle("hidden", !hasLunch);
  $("attendanceModalHelp").textContent = "Digite somente o que você tiver anotado. Você pode salvar apenas a chegada e completar o restante depois. Escolha também o tipo do dia quando for feriado, falta ou folga/férias.";
  $("attendanceModal").classList.remove("hidden");
  setTimeout(() => $("attendanceDate")?.focus(), 50);
}

function closeAttendanceModal() { $("attendanceModal")?.classList.add("hidden"); }

function fmtInputTime(value) {
  if (!value) return "";
  const m = String(value).match(/(?:T|\s)(\d{2}:\d{2})/);
  return m ? m[1] : String(value).slice(0,5);
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
  const tipo = $("attendanceStatus").value || 'trabalho';
  const manualDays = Math.max(0, Number($("attendanceCreditDays").value || 0));
  const hasLunch = !!(employee.almoco_inicio && employee.almoco_fim);
  if (!date) return toast("Escolha a data.");
  if (tipo === 'trabalho' || tipo === 'feriado_trabalhado') {
    if (hasLunch && ((lunchOut && !lunchIn) || (!lunchOut && lunchIn))) return toast("Informe os dois horários do almoço ou deixe os dois vazios.");
  }
  const makeDateTime = (time) => time ? `${date}T${time}:00` : null;
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
    const empUpdate = await db.from("funcionarios").update({dias_folga_ferias:manualDays,updated_at:new Date().toISOString()}).eq("id",employee.id);
    if (empUpdate.error) throw empUpdate.error;
    closeAttendanceModal();
    await loadEmployees({silent:true});
    toast(`${employee.nome}: lançamento salvo.`);
  } catch(error) {
    console.error(error);
    toast("Erro ao salvar o lançamento. Confira o Console.");
  }
}

async function clearAttendance(employee) {
  if(!confirm(`Limpar o ponto de hoje de ${employee.nome}?`)) return;
  try {
    const r=await db.from("pontos_funcionarios").delete().eq("funcionario_id",employee.id).eq("data",localDateISO());
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
}

const originalInit = init;
// Complementa a inicialização original sem substituir a lógica do controle de óleo.
document.addEventListener("DOMContentLoaded", () => {
  setupEmployeeUI();
  const oldSubscribe = subscribe;
});
