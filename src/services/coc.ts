const BASE='https://api.clashofclans.com/v1';

export type CocApiError={status:number;message:string};

function normalizeTag(tag:string){const value=tag.trim().toUpperCase();return value.startsWith('#')?value:`#${value}`;}
export function normalizedCocTag(tag:string){return normalizeTag(tag);}
export function cocConfigured(){return Boolean(process.env.COC_API_TOKEN);}

// Small in-process cache keeps the bot responsive and protects the official API from burst traffic.
const cache=new Map<string,{expires:number;value:unknown}>();
const TTL=30_000;

async function request<T>(path:string,ttl=TTL):Promise<T>{
  const token=process.env.COC_API_TOKEN;
  if(!token)throw new Error('Clash of Clans API is not configured. Set COC_API_TOKEN.');
  const hit=cache.get(path);
  if(hit&&hit.expires>Date.now())return hit.value as T;
  const response=await fetch(`${BASE}${path}`,{headers:{Authorization:`Bearer ${token}`,Accept:'application/json'},signal:AbortSignal.timeout(10000)});
  if(!response.ok){
    let message=`Clash of Clans API returned ${response.status}`;
    try{const body=await response.json() as any;message=body?.message||message;}catch{}
    const error=new Error(message) as Error&CocApiError;error.status=response.status;throw error;
  }
  const value=await response.json() as T;
  cache.set(path,{expires:Date.now()+ttl,value});
  return value;
}

export function clearCocCache(){cache.clear();}
export function getClan(tag:string){return request<any>(`/clans/${encodeURIComponent(normalizeTag(tag))}`);}
export function getPlayer(tag:string){return request<any>(`/players/${encodeURIComponent(normalizeTag(tag))}`);}
export function getPlayerBattleLog(tag:string){return request<any>(`/players/${encodeURIComponent(normalizeTag(tag))}/battlelog`,60_000);}
export function getCurrentWar(tag:string){return request<any>(`/clans/${encodeURIComponent(normalizeTag(tag))}/currentwar`,15_000);}
export function getWarLog(tag:string){return request<any>(`/clans/${encodeURIComponent(normalizeTag(tag))}/warlog`,120_000);}
export function getCwlLeague(tag:string){return request<any>(`/clans/${encodeURIComponent(normalizeTag(tag))}/currentwar/leaguegroup`,30_000);}
export function getRaidLog(tag:string){return request<any>(`/clans/${encodeURIComponent(normalizeTag(tag))}/capitalraidseasons`,120_000);}

export function clanSummary(clan:any){
  const members=Array.isArray(clan.memberList)?clan.memberList:[];
  const townHalls=members.reduce((acc:any,m:any)=>{const th=String(m.townHallLevel??'?');acc[th]=(acc[th]||0)+1;return acc;},{});
  const totalDonations=members.reduce((n:number,m:any)=>n+Number(m.donations||0),0);
  const totalReceived=members.reduce((n:number,m:any)=>n+Number(m.donationsReceived||0),0);
  return {tag:clan.tag,name:clan.name,level:clan.clanLevel,members:clan.members,warLeague:clan.warLeague?.name||'—',warWins:clan.warWins??0,warLosses:clan.warLosses??0,warWinStreak:clan.warWinStreak??0,capitalLeague:clan.capitalLeague?.name||'—',capitalPoints:clan.clanCapitalPoints??0,capitalContributions:members.reduce((n:number,m:any)=>n+Number(m.clanCapitalContributions||0),0),totalDonations,totalReceived,townHalls};
}

export function warSummary(war:any,clanTag:string){
  if(!war)return null;
  const ours=war.clan,opp=war.opponent;
  const requested=normalizeTag(clanTag);
  const ourSide=ours?.tag===requested?ours:opp?.tag===requested?opp:ours;
  const opponent=ourSide===ours?opp:ours;
  const attacks=(ourSide?.members||[]).flatMap((m:any)=>(m.attacks||[]).map((a:any)=>({...a,attackerName:m.name,attackerTag:m.tag,mapPosition:m.mapPosition}))).sort((a:any,b:any)=>Number(a.order||0)-Number(b.order||0));
  const used=attacks.length;
  const members=ourSide?.members||[];
  const possible=members.length*(war.teamSize?Math.min(2,war.teamSize):2);
  return {state:war.state,teamSize:war.teamSize,ourSide,opponent,attacks,used,possible,remaining:Math.max(0,possible-used),preparationStartTime:war.preparationStartTime,startTime:war.startTime,endTime:war.endTime};
}

export function playerSummary(player:any){
  const heroes=(player.heroes||[]).filter((h:any)=>h.village==='home');
  const pets=(player.heroEquipment||[]).length;
  return {tag:player.tag,name:player.name,townHallLevel:player.townHallLevel,trophies:player.trophies,bestTrophies:player.bestTrophies,warStars:player.warStars,donations:player.donations||0,donationsReceived:player.donationsReceived||0,capitalContributions:player.clanCapitalContributions||0,heroes,heroLevels:heroes.reduce((n:number,h:any)=>n+Number(h.level||0),0),equipmentCount:pets,clan:player.clan||null};
}
