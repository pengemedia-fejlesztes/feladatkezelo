/**
 * feladatkezelo – kombinalt Cloudflare Worker
 *  - /api* utak: irhato webhook (a data/tasks.json-t irja/olvassa a GitHub API-n; minden iras egy commit)
 *  - minden mas ut: a statikus app (index.html, data/tasks.json, stb.) az ASSETS bindingbol
 *
 * Titkok (Cloudflare -> a Worker -> Settings -> Variables and Secrets, Encrypt):
 *   GITHUB_TOKEN    – GitHub token, Contents: Read and write joggal a repora
 *   WEBHOOK_SECRET  – tetszoleges titkos kulcs a hivashoz
 * (A REPO / FILE_PATH / BRANCH alapertelmezett, nem kell beallitani.)
 */
const GH = "https://api.github.com";
function cors(){ return { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Methods":"GET,POST,OPTIONS", "Access-Control-Allow-Headers":"Authorization,Content-Type" }; }
function json(obj, status){ return new Response(JSON.stringify(obj,null,2), {status:status||200, headers:{"Content-Type":"application/json", ...cors()}}); }
function uid(){ return Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4); }
function toReminderMs(v){ if(v==null) return null; if(typeof v==="number") return v; const t=Date.parse(v); return isNaN(t)?null:t; }
function b64encode(str){ const bytes=new TextEncoder().encode(str); let bin=""; bytes.forEach(b=>bin+=String.fromCharCode(b)); return btoa(bin); }
function b64decode(b64){ const bin=atob((b64||"").replace(/\n/g,"")); const a=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) a[i]=bin.charCodeAt(i); return new TextDecoder().decode(a); }
async function ghGet(c){
  const r=await fetch(GH+"/repos/"+c.REPO+"/contents/"+c.FILE_PATH+"?ref="+c.BRANCH, { headers:{ "Authorization":"Bearer "+c.GITHUB_TOKEN, "Accept":"application/vnd.github+json", "User-Agent":"feladatkezelo-webhook" } });
  if(!r.ok) throw new Error("GitHub olvasas "+r.status+": "+(await r.text()));
  const j=await r.json(); return { sha:j.sha, data:JSON.parse(b64decode(j.content)) };
}
async function ghPut(c, data, sha, message){
  const r=await fetch(GH+"/repos/"+c.REPO+"/contents/"+c.FILE_PATH, { method:"PUT", headers:{ "Authorization":"Bearer "+c.GITHUB_TOKEN, "Accept":"application/vnd.github+json", "User-Agent":"feladatkezelo-webhook", "Content-Type":"application/json" }, body:JSON.stringify({ message:message, content:b64encode(JSON.stringify(data,null,2)), sha:sha, branch:c.BRANCH }) });
  if(!r.ok) throw new Error("GitHub iras "+r.status+": "+(await r.text())); return r.json();
}
function findList(data, ref){ if(!ref) return data.lists[0]; return data.lists.find(l=>l.id===ref) || data.lists.find(l=>l.name===ref) || null; }
function ensureList(data, name){ let l=data.lists.find(x=>x.name===name); if(!l){ const C=["#2E6FB0","#2C8C8C","#C77A16","#8A5BB8","#C0392B","#3B6FB0","#C9518A"]; l={id:uid(),name:name,color:C[data.lists.length%C.length]}; data.lists.push(l); } return l; }

async function handleApi(request, env){
  if(request.method==="OPTIONS") return new Response(null,{headers:cors()});
  const c={ REPO:env.REPO||"pengemedia-fejlesztes/feladatkezelo", FILE_PATH:env.FILE_PATH||"data/tasks.json", BRANCH:env.BRANCH||"main", GITHUB_TOKEN:env.GITHUB_TOKEN };
  const auth=request.headers.get("Authorization")||"";
  if(!env.WEBHOOK_SECRET || auth!=="Bearer "+env.WEBHOOK_SECRET) return json({error:"Nincs jogosultsag"},401);
  let payload={}, op="list";
  if(request.method==="POST"){ try{ payload=await request.json(); }catch(e){} op=payload.op||"list"; }
  try{
    if(op==="list"){ const g=await ghGet(c); return json({ok:true, lists:g.data.lists, tasks:g.data.tasks}); }
    if(op==="get"){ const g=await ghGet(c); const t=g.data.tasks.find(x=>x.id===payload.id); return t?json({ok:true,task:t}):json({error:"Nincs ilyen feladat"},404); }
    const g=await ghGet(c); const data=g.data; const now=Date.now(); let result, msg;
    if(op==="add"){
      const t=payload.task||{}; const list=t.list?ensureList(data,t.list):(findList(data,t.listId)||data.lists[0]);
      const task={ id:uid(), listId:list.id, title:String(t.title||""), done:!!t.done, important:!!t.important, note:String(t.note||""), due:String(t.due||""), createdAt:now, mod:now, order:data.tasks.length };
      const rem=toReminderMs(t.reminder); if(rem){ task.reminder=rem; task.reminderFired=false; }
      if(Array.isArray(t.steps)) task.steps=t.steps.map((s,i)=>({id:uid(),text:String(s.text||s),done:!!s.done,order:i}));
      data.tasks.push(task); data.createdTotal=(data.createdTotal||data.tasks.length)+1; result=task; msg="webhook: uj feladat - "+task.title.slice(0,60);
    } else {
      const t=data.tasks.find(x=>x.id===payload.id); if(!t) return json({error:"Nincs ilyen feladat"},404);
      if(op==="update"){ const f=payload.fields||{};
        if("title" in f) t.title=String(f.title||""); if("note" in f) t.note=String(f.note||""); if("due" in f) t.due=String(f.due||"");
        if("important" in f) t.important=!!f.important; if("done" in f) t.done=!!f.done;
        if("reminder" in f){ const r=toReminderMs(f.reminder); if(r){ t.reminder=r; t.reminderFired=false; } else { delete t.reminder; delete t.reminderFired; } }
        msg="webhook: modositas - "+String(t.title||"").slice(0,60);
      } else if(op==="setDue"){ t.due=String(payload.due||""); msg="webhook: hatarido - "+String(t.title||"").slice(0,60);
      } else if(op==="setReminder"){ const r=toReminderMs(payload.reminder); if(r){ t.reminder=r; t.reminderFired=false; } else { delete t.reminder; delete t.reminderFired; } msg="webhook: emlekezteto - "+String(t.title||"").slice(0,60);
      } else { return json({error:"Ismeretlen op: "+op},400); }
      t.mod=now; result=t;
    }
    await ghPut(c, data, g.sha, msg); return json({ok:true, op:op, result:result});
  }catch(e){ return json({error:String((e&&e.message)||e)},500); }
}

export default {
  async fetch(request, env){
    const url=new URL(request.url);
    if(url.pathname==="/api" || url.pathname.startsWith("/api/")) return handleApi(request, env);
    if(env.ASSETS) return env.ASSETS.fetch(request);
    return new Response("Not found", {status:404});
  }
};
