const cocOriginalRender=render;
let cocData=null;
function cocEscape(v){return esc(v);}
function cocNum(v){return Number(v||0).toLocaleString();}
function cocPct(v){return `${Number(v||0).toFixed(1)}%`;}
async function cocLoad(){
  try{cocData=await api(`/api/guild/${state.guild}/coc`);cocRender();}
  catch(e){$('#content').innerHTML=`<div class="card"><h3>⚔️ Clash of Clans</h3><p class="danger">${cocEscape(e.message)}</p></div>`;}
}
function cocRender(){
  const d=cocData||{};
  const c=d.clan;
  $('#pageTitle').textContent='Clash of Clans';
  $$('.nav').forEach(b=>b.classList.toggle('active',b.dataset.view==='coc'));
  if(!d.configured||!d.tag){
    $('#content').innerHTML=`<div class="two"><div class="card"><p class="eyebrow">CLAN COMMAND CENTER</p><h3>Connect your Clash of Clans clan</h3><p class="muted">Set a clan tag to unlock live clan, member, war, war-log and CWL data.</p><div class="form"><div class="field"><label>Clan tag</label><input id="cocTag" maxlength="16" placeholder="#ABC123" value="${cocEscape(d.tag||'')}"></div><button class="btn primary" onclick="cocSave()">Connect clan</button></div></div><div class="card"><h3>API status</h3><div class="list"><div class="row"><span>CoC API</span><b class="${d.configured?'goodtext':'danger'}">${d.configured?'Configured':'Not configured'}</b></div><div class="row"><span>Live data</span><b>${d.configured?'Ready':'Waiting for API token'}</b></div></div></div></div>`;return;
  }
  if(!c){$('#content').innerHTML=`<div class="card"><h3>⚔️ Clash of Clans</h3><p class="danger">Unable to load clan data.</p></div>`;return;}
  const members=d.members||[];
  const th=Object.entries(c.townHalls||{}).sort((a,b)=>Number(b[0])-Number(a[0])).map(([k,v])=>`<span class="pill">TH${cocEscape(k)} · ${v}</span>`).join(' ');
  const war=d.war;
  const warRows=members.slice(0,12).map(m=>`<div class="row"><span><b>${cocEscape(m.name)}</b><br><span class="muted">${cocEscape(m.tag)} · TH${cocEscape(m.townHallLevel)} · ${cocNum(m.trophies)} 🏆</span></span><span>${cocNum(m.clanRank||0)} rank</span></div>`).join('');
  const warText=war?.state==='inWar'?`${cocEscape(war.clan?.name||'Clan')} <b>${war.clan?.stars||0}</b> — <b>${war.opponent?.stars||0}</b> ${cocEscape(war.opponent?.name||'Opponent')}`:war?.state==='warEnded'?'War ended':war?.state==='notInWar'?'Not in war':'Unavailable';
  const log=(d.warlog||[]).slice(0,6).map(w=>`<div class="row"><span>${w.result==='win'?'🟢':w.result==='lose'?'🔴':'⚪'} ${cocEscape(w.opponent?.name||'Opponent')}</span><b>${w.clan?.stars??0}-${w.opponent?.stars??0}</b></div>`).join('')||'<span class="muted">No recent wars.</span>';
  const cwl=(d.cwl?.clans||[]).map(x=>`<div class="row"><span>${cocEscape(x.name)}</span><span class="muted">${cocEscape(x.tag)}</span></div>`).join('')||'<span class="muted">No active CWL group.</span>';
  $('#content').innerHTML=`<div class="grid"><div class="card metric"><div class="label">MEMBERS</div><div class="value">${cocNum(c.members)}</div><div class="sub">of 50</div></div><div class="card metric"><div class="label">CLAN LEVEL</div><div class="value">${cocNum(c.level)}</div><div class="sub">${cocEscape(c.warLeague)}</div></div><div class="card metric"><div class="label">WAR WINS</div><div class="value">${cocNum(c.warWins)}</div><div class="sub">Streak ${cocNum(c.warWinStreak)}</div></div><div class="card metric"><div class="label">CAPITAL</div><div class="value">${cocNum(c.capitalPoints)}</div><div class="sub">${cocEscape(c.capitalLeague)}</div></div></div><div class="card section"><div class="actions" style="justify-content:space-between;align-items:center"><div><p class="eyebrow">CONNECTED CLAN</p><h3>🏰 ${cocEscape(c.name)}</h3><span class="muted">${cocEscape(c.tag)}</span></div><div class="actions"><button class="btn" onclick="cocRefresh()">↻ Refresh</button><button class="btn" onclick="cocConfigure()">⚙ Configure</button></div></div><div style="margin-top:14px">${th||'<span class="muted">No town hall data.</span>'}</div></div><div class="two section"><div class="card"><h3>⚔️ Current War</h3><div class="list"><div class="row"><span>${warText}</span><span class="muted">${war?.state||'—'}</span></div><div class="row"><span>Destruction</span><b>${cocPct(war?.clan?.destructionPercentage)} — ${cocPct(war?.opponent?.destructionPercentage)}</b></div></div></div><div class="card"><h3>🏆 CWL</h3><div class="list">${cwl}</div></div></div><div class="two section"><div class="card"><h3>👥 Members</h3><div class="list">${warRows||'<span class="muted">No members returned.</span>'}</div></div><div class="card"><h3>📜 Recent Wars</h3><div class="list">${log}</div></div></div>`;
}
async function cocSave(){const tag=$('#cocTag')?.value.trim()||'';try{await api(`/api/guild/${state.guild}/coc/config`,{method:'POST',body:JSON.stringify({tag})});toast('Clan connected');await cocLoad();}catch(e){toast(e.message)}}
async function cocRefresh(){await cocLoad();}
function cocConfigure(){
 const current=cocData?.tag||'';$('#content').innerHTML=`<div class="card"><p class="eyebrow">CLAN CONFIGURATION</p><h3>Connect a clan</h3><p class="muted">The API token stays server-side. Only the clan tag is stored per Discord server.</p><div class="form"><div class="field"><label>Clan tag</label><input id="cocTag" maxlength="16" value="${cocEscape(current)}" placeholder="#ABC123"></div><div class="actions"><button class="btn primary" onclick="cocSave()">Save</button><button class="btn" onclick="cocLoad()">Cancel</button></div></div></div>`;
}
function cocPage(){cocLoad();}
render=function(){if(state.view==='coc')cocPage();else cocOriginalRender();};
