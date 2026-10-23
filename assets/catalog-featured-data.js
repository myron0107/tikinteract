// Optional publication metadata lives in the existing catalog configuration.
export function latestPublishedGame(games=[]){
 return games.map((game,index)=>({game,index,time:typeof game.publishedAt==='string'?Date.parse(game.publishedAt)||0:0})).filter(({game})=>game.status==='published').sort((a,b)=>b.time-a.time||b.index-a.index)[0]?.game||null;
}
// A release badge is temporary and depends on actual publication metadata.
export function isRecentRelease(game,now=Date.now()){
 const published=typeof game?.publishedAt==='string'?Date.parse(game.publishedAt):NaN;
 return game?.status==='published'&&Number.isFinite(published)&&published<=now&&now-published<30*24*60*60*1000;
}
export function withPublicationDate(game,previous=null,now=new Date().toISOString()){
 const next={...game};
 if(previous?.publishedAt)next.publishedAt=previous.publishedAt;
 else if(next.status==='published'&&previous?.status!=='published')next.publishedAt=now;
 return next;
}
