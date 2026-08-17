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
  channel = db.channel("dakar-motos-oleo-v4")
    .on("postgres_changes", { event:"*", schema:"public", table:"controle" }, () => load({ silent:true }))
    .on("postgres_changes", { event:"*", schema:"public", table:"historico" }, () => load({ silent:true }))
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
