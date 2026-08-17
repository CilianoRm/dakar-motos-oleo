const MECHANICS=["GIL","AMAURI","SAMUEL","TIAGUINHO","TIAGO"];
const SUPABASE_URL="https://faujgnzagnktsmxbnmmx.supabase.co";
const SUPABASE_KEY="sb_publishable_BQVeY4ChsN9Vr1JzwXpcOw_RWALGfvj";
let db=null,state={current:0,counts:{GIL:0,AMAURI:0,SAMUEL:0,TIAGUINHO:0,TIAGO:0},available:{GIL:true,AMAURI:true,SAMUEL:true,TIAGUINHO:true,TIAGO:true},history:[]},channel=null;

function configured(){return SUPABASE_URL.startsWith("http")&&!SUPABASE_URL.includes("COLE_AQUI")&&!SUPABASE_KEY.includes("COLE_AQUI")}
async function init(){if(!configured()){render();warn();return}db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);await load();subscribe();render()}
async function load(){
  const {data,error}=await db.from("controle").select("*").eq("id",1).maybeSingle();
  if(error){console.error("Erro ao carregar controle:",error);toast("Erro ao carregar banco");return}
  if(data){state.current=data.current_index||0;state.counts={GIL:data.gil_count||0,AMAURI:data.amauri_count||0,SAMUEL:data.samuel_count||0,TIAGUINHO:data.tiaguinho_count||0,TIAGO:data.tiago_count||0};state.available={GIL:data.gil_available!==false,AMAURI:data.amauri_available!==false,SAMUEL:data.samuel_available!==false,TIAGUINHO:data.tiaguinho_available!==false,TIAGO:data.tiago_available!==false}}
  const h=await db.from("historico").select("*").order("created_at",{ascending:false}).limit(30);state.history=(h.data||[]).map(x=>`${fmt(x.created_at)} — ${x.mecanico} ${x.acao}`)
}
function subscribe(){
  if(channel) db.removeChannel(channel);
  channel=db.channel("dakar-motos-oleo").on("postgres_changes",{event:"*",schema:"public",table:"controle"},async()=>{await load();render()}).on("postgres_changes",{event:"*",schema:"public",table:"historico"},async()=>{await load();render()}).subscribe((status)=>{console.log("Realtime:",status)});
}
function col(m){return({GIL:"gil_count",AMAURI:"amauri_count",SAMUEL:"samuel_count",TIAGUINHO:"tiaguinho_count",TIAGO:"tiago_count"})[m]}
function availCol(m){return({GIL:"gil_available",AMAURI:"amauri_available",SAMUEL:"samuel_available",TIAGUINHO:"tiaguinho_available",TIAGO:"tiago_available"})[m]}
function nextPriority(){
  const available=MECHANICS.filter(m=>state.available[m]);
  if(!available.length) return state.current;
  let best=available[0];
  for(const m of available){
    if((state.counts[m]||0)<(state.counts[best]||0)) best=m;
  }
  return MECHANICS.indexOf(best);
}
async function actOil(){
  if(!db)return toast("Configure o Supabase primeiro");
  const m=MECHANICS[state.current];
  if(!state.available[m])return toast(`${m} está ocupado`);
  const d=1; const u={updated_at:new Date().toISOString()}; u[col(m)]=(state.counts[m]||0)+d;
  const next=nextPriorityAfter(m,d); u.current_index=next;
  const r=await db.from("controle").update(u).eq("id",1);
  if(r.error){console.error(r.error);return toast("Erro ao registrar: "+(r.error.message||"verifique o banco"))}
  const h=await db.from("historico").insert({mecanico:m,acao:"trocou óleo",delta:d});
  if(h.error) console.error("Histórico:",h.error);
  await load();render();toast(`${m}: troca registrada`)
}
function nextPriorityAfter(changed,d){
  const counts={...state.counts,[changed]:(state.counts[changed]||0)+d};
  const available=MECHANICS.filter(m=>state.available[m]);
  if(!available.length)return state.current;
  let best=available[0];
  for(const m of available){if((counts[m]||0)<(counts[best]||0))best=m;}
  return MECHANICS.indexOf(best);
}
async function selectMechanic(m){
  if(!state.available[m])return toast(`${m} está ocupado e não pode ser selecionado`);
  if(!db)return toast("Configure o Supabase primeiro");
  const r=await db.from("controle").update({current_index:MECHANICS.indexOf(m),updated_at:new Date().toISOString()}).eq("id",1);
  if(r.error){console.error(r.error);return toast("Erro ao mudar a vez")}
  await load();render();toast(`${m} agora está no painel`)
}
function openCorrection(){
  const box=document.getElementById("correctionList");
  box.innerHTML=MECHANICS.map(m=>`<button class="correction-person" data-mechanic="${m}"><span>${m}</span><strong>${state.counts[m]||0} troca${(state.counts[m]||0)===1?"":"s"}</strong></button>`).join("");
  box.querySelectorAll("button").forEach(b=>b.onclick=()=>correctOne(b.dataset.mechanic));
  document.getElementById("correctionModal").classList.remove("hidden");
}
function closeCorrection(){document.getElementById("correctionModal").classList.add("hidden")}
async function correctOne(m){
  if(!db)return toast("Configure o Supabase primeiro");
  const u={updated_at:new Date().toISOString()};u[col(m)]=(state.counts[m]||0)-1;
  const r=await db.from("controle").update(u).eq("id",1);
  if(r.error){console.error(r.error);return toast("Erro ao corrigir")}
  const h=await db.from("historico").insert({mecanico:m,acao:"correção -1 troca",delta:-1});
  if(h.error)console.error("Histórico:",h.error);
  closeCorrection();await load();render();toast(`${m}: 1 troca removida`)
}
async function toggle(m){
  if(!db)return toast("Configure o Supabase primeiro");
  const u={};u[availCol(m)]=!state.available[m];u.updated_at=new Date().toISOString();
  const r=await db.from("controle").update(u).eq("id",1);
  if(r.error){console.error(r.error);return toast("Erro ao alterar status")}
  await load();render();
}
async function resetTurn(){
  if(!db)return toast("Configure o Supabase primeiro");
  const n=nextPriority();const r=await db.from("controle").update({current_index:n,updated_at:new Date().toISOString()}).eq("id",1);
  if(r.error)return toast("Erro");await load();render();toast("Prioridade recalculada")
}
async function clearData(){
  if(!confirm("Zerar todos os contadores e histórico?"))return;
  const r=await db.from("controle").update({current_index:0,gil_count:0,amauri_count:0,samuel_count:0,tiaguinho_count:0,tiago_count:0,updated_at:new Date().toISOString()}).eq("id",1);
  if(r.error)return toast("Erro");
  const h=await db.from("historico").delete().neq("id",0);if(h.error)console.error(h.error);
  await load();render();toast("Dados zerados")
}
function render(){
  const cur=MECHANICS[state.current];document.getElementById("currentName").textContent=cur;document.getElementById("tvName").textContent=cur;
  document.getElementById("sequence").innerHTML=MECHANICS.map((m,i)=>{const a=state.available[m],c=state.counts[m]||0;return `<button class="sequence-item ${i===state.current?"active":""} ${!a?"disabled":""}" onclick="selectMechanic('${m}')" ${!a?"disabled":""}><span class="number">${i+1}</span><span class="seq-main"><b>${m}</b><small>${c} troca${c===1?"":"s"}</small></span><span class="seq-status ${a?"available":"unavailable"}">${a?"DISPONÍVEL":"OCUPADO"}</span></button>`}).join("");
  document.getElementById("mechanics").innerHTML=MECHANICS.map(m=>{let c=state.counts[m]||0,a=state.available[m];return `<div class="mechanic"><span class="mechanic-name">${m}<span class="status ${a?"available":"unavailable"}">${a?"● DISPONÍVEL":"● OCUPADO"}</span></span><span class="mechanic-actions"><button class="secondary" onclick="toggle('${m}')">${a?"OCUPAR":"LIBERAR"}</button><span class="count ${c<0?"pending":""}">${c}<small>${c<0?"pendente":"trocas"}</small></span></span></div>`}).join("");
  document.getElementById("tvList").innerHTML=MECHANICS.map((m,i)=>`<div class="tv-person ${i===state.current?"active":""}"><strong>${m}</strong><span>${state.counts[m]} trocas</span></div>`).join("");
  document.getElementById("history").innerHTML=state.history.length?state.history.slice(0,10).map(x=>`<div class="history-row">${x}</div>`).join(""):"<div class='history-row'>Nenhuma ação registrada.</div>"
}
function fmt(v){return new Date(v).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}
function toast(s){let t=document.getElementById("toast");t.textContent=s;t.style.display="block";clearTimeout(window.tt);window.tt=setTimeout(()=>t.style.display="none",2200)}
function warn(){let e=document.createElement("div");e.style.cssText="position:fixed;bottom:20px;left:20px;right:20px;background:#171717;border:1px solid #f5252d;padding:14px;border-radius:9px;z-index:9999";e.innerHTML="Configure SUPABASE_URL e SUPABASE_KEY no app.js antes de publicar.";document.body.appendChild(e)}
function clock(){document.getElementById("clock").textContent=new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}
document.getElementById("oilBtn").onclick=actOil;document.getElementById("busyBtn").onclick=openCorrection;document.getElementById("resetTurn").onclick=resetTurn;document.getElementById("clearData").onclick=clearData;document.getElementById("closeCorrection").onclick=closeCorrection;
document.getElementById("openPanel").onclick=()=>{let u=new URL(location.href);u.searchParams.set("painel","1");window.open(u,"_blank")};document.getElementById("copyPanel").onclick=async()=>{let u=new URL(location.href);u.searchParams.set("painel","1");try{await navigator.clipboard.writeText(u);toast("Link do painel copiado")}catch(e){prompt("Copie o link:",u)}};
setInterval(clock,1000);clock();
if(new URLSearchParams(location.search).get("painel")==="1"){document.getElementById("controlView").classList.add("hidden");document.querySelector("header").classList.add("hidden");document.getElementById("tvView").classList.remove("hidden");document.body.style.padding="0";document.querySelector(".app").style.padding="0";document.querySelector(".tv-view").style.borderRadius="0"}
init();