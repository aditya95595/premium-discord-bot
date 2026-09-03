const BASE='https://api.clashofclans.com/v1';

export type CocApiError={status:number;message:string};

function normalizeTag(tag:string){const value=tag.trim().toUpperCase();return value.startsWith('#')?value:`#${value}`;}

export function cocConfigured(){return Boolean(process.env.COC_API_TOKEN);}

async function request<T>(path:string):Promise<T>{
  const token=process.env.COC_API_TOKEN;
  if(!token)throw new Error('Clash of Clans API is not configured. Set COC_API_TOKEN.');
  const response=await fetch(`${BASE}${path}`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(10000)});
  if(!response.ok){
    let message=`Clash of Clans API returned ${response.status}`;
    try{const body=await response.json() as any;message=body?.message||message;}catch{}
    const error=new Error(message) as Error&CocApiError;error.status=response.status;throw error;
  }
  return response.json() as Promise<T>;
}

export function getClan(tag:string){return request<any>(`/clans/${encodeURIComponent(normalizeTag(tag))}`);}
export function getPlayer(tag:string){return request<any>(`/players/${encodeURIComponent(normalizeTag(tag))}`);}
export function getCurrentWar(tag:string){return request<any>(`/clans/${encodeURIComponent(normalizeTag(tag))}/currentwar`);}
export function getWarLog(tag:string){return request<any>(`/clans/${encodeURIComponent(normalizeTag(tag))}/warlog`);}
export function getCwlLeague(tag:string){return request<any>(`/clans/${encodeURIComponent(normalizeTag(tag))}/currentwar/leaguegroup`);}

export function clanSummary(clan:any){
  const members=Array.isArray(clan.memberList)?clan.memberList:[];
  const townHalls=members.reduce((acc:any,m:any)=>{const th=String(m.townHallLevel??'?');acc[th]=(acc[th]||0)+1;return acc;},{});
  return {tag:clan.tag,name:clan.name,level:clan.clanLevel,members:clan.members,warLeague:clan.warLeague?.name||'—',warWins:clan.warWins??0,warWinStreak:clan.warWinStreak??0,capitalLeague:clan.capitalLeague?.name||'—',capitalPoints:clan.clanCapitalPoints??0,townHalls};
}
