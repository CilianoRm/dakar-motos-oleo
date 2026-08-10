const MECHANICS=["GIL","AMAURI","SAMUEL","TIAGUINHO","TIAGO"];
const KEY="dakarOleoStateV1";
const CHANNEL="dakarOleoChannel";
let channel=null;
try{channel=new BroadcastChannel(CHANNEL)}catch(e){}

function defaultState(){return{current:0,counts:{GIL:0,AMAURI:0,SAMUEL:0,TIAGUINHO:0,TIAGO:0},history:[]}}
function load(){try{return JSON.parse(localStorage.getItem(KEY))||defaultState()}catch(e){return defaultState()}}
let state=load();

function save(){localStorage.setItem(KEY,JSON.stringify(state));if(channel)channel.postMessage(state);render()}
function receive(s){state=s;render()}
if(channel)channel.onmessage=e=>receive(e.data);
window.addEventListener("storage",e=>{if(e.key===KEY&&e.newValue)receive(JSON.parse(e.newValue))});

function render(){
 document.getElementById("currentName").textContent=MECHANICS[state.current];
 document.getElementById("tvName").textContent=MECHANICS[state.current];
 document.getElementById("sequence").innerHTML=MECHANICS.map((m,i)=>`<div class="sequence-item ${i===state.current?"active":""}"><span class="number">${i+1}</span><span>${m}</span></div>`).join("");
 document.getElementById("mechanics").innerHTML=MECHANICS.map(m=>{
   const c=state.counts[m]||0; const pending=c<0;
   return `<div class="mechanic"><span class="mechanic-name">${m}</span><span class="count ${pending?"pending":""}">${c}<small>${pending?"pendente":"trocas"}</small></span></div>`;
 }).join("");
 document.getElementById("tvList").innerHTML=MECHANICS.map((m,i)=>{
   const c=state.counts[m]||0;
   return `<div class="tv-person ${i===state.current?"active":""}"><strong>${m}</strong><span>${c<0?c+" pendente":c+" trocas"}</span></div>`;
 }).join("");
 const h=document.getElementById("history");
 h.innerHTML=state.history.length?state.history.slice(0,10).map(x=>`<div class="history-row">${x}</div>`).join(""):"<div class='history-row'>Nenhuma ação registrada.</div>";
}
function now(){return new Date().toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}
function act(type){
 const m=MECHANICS[state.current];
 if(type==="oil") state.counts[m]=(state.counts[m]||0)+1;
 else state.counts[m]=(state.counts[m]||0)-1;
 state.history.unshift(`${now()} — ${m} ${type==="oil"?"trocou óleo":"ocupado"}`);
 state.history=state.history.slice(0,30);
 state.current=(state.current+1)%MECHANICS.length;
 save();toast(type==="oil"?`${m}: troca registrada`:`${m}: pendência registrada`);
}
function toast(msg){const t=document.getElementById("toast");t.textContent=msg;t.style.display="block";clearTimeout(window.tt);window.tt=setTimeout(()=>t.style.display="none",1800)}
document.getElementById("oilBtn").onclick=()=>act("oil");
document.getElementById("busyBtn").onclick=()=>act("busy");
document.getElementById("resetTurn").onclick=()=>{state.current=0;save();toast("A vez voltou para Gil")};
document.getElementById("clearData").onclick=()=>{if(confirm("Zerar todos os contadores e histórico?")){state=defaultState();save();toast("Dados zerados")}};
document.getElementById("openPanel").onclick=()=>{const u=new URL(location.href);u.searchParams.set("painel","1");window.open(u.toString(),"_blank")};
document.getElementById("copyPanel").onclick=async()=>{const u=new URL(location.href);u.searchParams.set("painel","1");try{await navigator.clipboard.writeText(u.toString());toast("Link do painel copiado")}catch(e){prompt("Copie o link:",u.toString())}};
function clock(){document.getElementById("clock").textContent=new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}
setInterval(clock,1000);clock();

if(new URLSearchParams(location.search).get("painel")==="1"){
 document.getElementById("controlView").classList.add("hidden");
 document.querySelector("header").classList.add("hidden");
 document.getElementById("tvView").classList.remove("hidden");
 document.body.style.padding="0";
 document.querySelector(".app").style.padding="0";
 document.querySelector(".tv-view").style.borderRadius="0";
}
render();
