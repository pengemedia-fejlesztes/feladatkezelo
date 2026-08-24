/**
 * Feladatkezelő – Írható webhook (Cloudflare Worker)
 * A data/tasks.json fájlt olvassa/írja a GitHub repóban.
 * Minden ÍRÁS egy git commit -> automatikus verziózás + teljes előzmény.
 *
 * Környezeti változók (Cloudflare -> a Worker -> Settings -> Variables and Secrets):
 *   GITHUB_TOKEN    – GitHub token, Contents: Read and write joggal a repóra   [Secret]
 *   WEBHOOK_SECRET  – tetszőleges titkos kulcs a híváshoz                       [Secret]
 *   REPO            – "pengemedia-fejlesztes/feladatkezelo"                     [Text]
 *   FILE_PATH       – "data/tasks.json"                                         [Text]
 *   BRANCH          – "main"                                                    [Text]
 *
 * Hívás: POST https://<worker-url>/   Header: Authorization: Bearer <WEBHOOK_SECRET>
 * Body (JSON) példák:
 *   { "op":"list" }
 *   { "op":"get", "id":"<taskId>" }
 *   { "op":"add", "task":{ "title":"Új feladat", "list":"Feladatok", "due":"2026-07-20",
 *                          "note":"leírás", "important":true, "reminder":"2026-07-20T09:00" } }
 *   { "op":"update", "id":"<taskId>", "fields":{ "note":"új leírás", "due":"2026-07-22",
 *                          "reminder":"2026-07-22T08:30", "important":false, "done":false } }
 *   { "op":"setDue", "id":"<taskId>", "due":"2026-07-25" }
 *   { "op":"setReminder", "id":"<taskId>", "reminder":"2026-07-25T07:00" }   // reminder:null = törlés
 */

const GH = "https://api.github.com";

function cors(){ return {
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Methods":"GET,POST,OPTIONS",
  "Access-Control-Allow-Headers":"Authorization,Content-Type"
}; }
function json(obj, status){ return new Response(JSON.stringify(obj,null,2), {status:status||200, headers:{"Content-Type":"application/json", ...cors()}}); }
function uid(){ return Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4); }
function toReminderMs(v){ if(v==null) return null; if(typeof v==="number") return v; const t=Date.parse(v); return isNaN(t)?null:t; }
function b64encode(str){ const bytes=new TextEncoder().encode(str); let bin=""; bytes.forEach(b=>bin+=String.fromCharCode(b)); return btoa(bin); }
function b64decode(b64){ const bin=atob((b64||"").replace(/\n/g,"")); const a=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) a[i]=bin.charCodeAt(i); return new TextDecoder().decode(a); }

async function ghGet(env){
  const r=await fetch(GH+"/repos/"+env.REPO+"/contents/"+env.FILE_PATH+"?ref="+(env.BRANCH||"main"), {
    headers:{ "Authorization":"Bearer "+env.GITHUB_TOKEN, "Accept":"application/vnd.github+json", "User-Agent":"feladatkezelo-webhook" }
  });
  if(!r.ok) throw new Error("GitHub olvasas hiba "+r.status+": "+(await r.text()));
  const j=await r.json();
  return { sha:j.sha, data:JSON.parse(b64decode(j.content)) };
}
async function ghPut(env, data, sha, message){
  const r=await fetch(GH+"/repos/"+env.REPO+"/contents/"+env.FILE_PATH, {
    method:"PUT",
    headers:{ "Authorization":"Bearer "+env.GITHUB_TOKEN, "Accept":"application/vnd.github+json", "User-Agent":"feladatkezelo-webhook", "Content-Type":"application/json" },
    body:JSON.stringify({ message:message, content:b64encode(JSON.stringify(data,null,2)), sha:sha, branch:(env.BRANCH||"main") })
  });
  if(!r.ok) throw new Error("GitHub iras hiba "+r.status+": "+(await r.text()));
  return r.json();
}
/* --- Ekezet- es kisbetu-fuggetlen kereses (AI-baratsag): "ugyved" == "Ügyvéd" --- */
function norm(s){ return String(s==null?"":s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim(); }
function hay(t){ return [t.title,t.note].concat(Array.isArray(t.steps)?t.steps.map(s=>(s&&s.text)||""):[]).map(norm).join(" \n "); }
function findTasks(data, q, scope){
  const nq=norm(q); if(!nq) return [];
  const exact=data.tasks.filter(t=>norm(t.title)===nq);
  if(exact.length) return exact;
  return data.tasks.filter(t=> scope==="title" ? norm(t.title).includes(nq) : hay(t).includes(nq));
}
function slimTask(data,t){
  const l=(data.lists||[]).find(x=>x.id===t.listId);
  return { id:t.id, title:t.title||"", list:l?l.name:"", due:t.due||"", done:!!t.done, important:!!t.important, note:t.note||"" };
}
/* id VAGY q/title alapjan oldja fel a feladatot; tobb talalatnal 409 + a listaval */
function resolveTask(data, payload){
  if(payload.id){
    const t=data.tasks.find(x=>x.id===payload.id);
    return t?{task:t}:{error:"Nincs ilyen feladat: "+payload.id, status:404};
  }
  const q=payload.q||payload.title;
  if(!q) return {error:"Hianyzik az 'id' vagy a 'q' mezo", status:400};
  let hits=findTasks(data,q,"title");
  if(!hits.length) hits=findTasks(data,q,"all");
  if(!hits.length) return {error:"Nincs talalat erre: "+q, status:404};
  if(hits.length>1) return {error:"Tobb talalat ("+hits.length+") erre: "+q+" - add meg az id-t", status:409, matches:hits.map(t=>slimTask(data,t))};
  return {task:hits[0]};
}
function findList(data, ref){ if(!ref) return data.lists[0]; return data.lists.find(l=>l.id===ref) || data.lists.find(l=>l.name===ref) || null; }
function ensureList(data, name){
  let l=data.lists.find(x=>x.name===name);
  if(!l){ const C=["#2E6FB0","#2C8C8C","#C77A16","#8A5BB8","#C0392B","#3B6FB0","#C9518A"]; l={id:uid(),name:name,color:C[data.lists.length%C.length]}; data.lists.push(l); }
  return l;
}

export default {
  async fetch(request, env){
    if(request.method==="OPTIONS") return new Response(null,{headers:cors()});
    const auth=request.headers.get("Authorization")||"";
    if(!env.WEBHOOK_SECRET || auth!=="Bearer "+env.WEBHOOK_SECRET) return json({error:"Nincs jogosultsag"},401);

    let payload={}, op="list";
    if(request.method==="POST"){ try{ payload=await request.json(); }catch(e){} op=payload.op||"list"; }

    try{
      if(op==="list"){ const g=await ghGet(env); return json({ok:true, lists:g.data.lists, tasks:g.data.tasks}); }
      /* Ekezet-fuggetlen kereses: {"op":"find","q":"ugyved"} megtalalja az "Ügyvéd"-et is.
         scope: "title" = csak cim, egyebkent cim+leiras+lepesek. */
      if(op==="find"||op==="search"){
        const g=await ghGet(env);
        const hits=findTasks(g.data, payload.q||payload.title||"", payload.in||payload.scope||"all");
        return json({ok:true, count:hits.length, tasks:hits.map(t=>slimTask(g.data,t))});
      }
      if(op==="get"){
        const g=await ghGet(env); const r=resolveTask(g.data,payload);
        if(r.error) return json({error:r.error, matches:r.matches}, r.status);
        return json({ok:true, task:r.task});
      }

      const g=await ghGet(env); const data=g.data; const now=Date.now(); let result, msg;

      if(op==="add"){
        const t=payload.task||{};
        const list=t.list?ensureList(data,t.list):(findList(data,t.listId)||data.lists[0]);
        const task={ id:uid(), listId:list.id, title:String(t.title||""), done:!!t.done, important:!!t.important,
          note:String(t.note||""), due:String(t.due||""), createdAt:now, mod:now, order:data.tasks.length };
        const rem=toReminderMs(t.reminder); if(rem){ task.reminder=rem; task.reminderFired=false; }
        if(Array.isArray(t.steps)) task.steps=t.steps.map((s,i)=>({id:uid(),text:String(s.text||s),done:!!s.done,order:i}));
        data.tasks.push(task); data.createdTotal=(data.createdTotal||data.tasks.length)+1;
        result=task; msg="webhook: uj feladat - "+task.title.slice(0,60);
      } else {
        const r=resolveTask(data,payload);
        if(r.error) return json({error:r.error, matches:r.matches}, r.status);
        const t=r.task;
        if(op==="update"){
          const f=payload.fields||{};
          if("title" in f) t.title=String(f.title||"");
          if("note" in f) t.note=String(f.note||"");
          if("due" in f) t.due=String(f.due||"");
          if("important" in f) t.important=!!f.important;
          if("done" in f) t.done=!!f.done;
          if("reminder" in f){ const r=toReminderMs(f.reminder); if(r){ t.reminder=r; t.reminderFired=false; } else { delete t.reminder; delete t.reminderFired; } }
          msg="webhook: modositas - "+String(t.title||"").slice(0,60);
        } else if(op==="setDue"){ t.due=String(payload.due||""); msg="webhook: hatarido - "+String(t.title||"").slice(0,60);
        } else if(op==="setReminder"){ const r=toReminderMs(payload.reminder); if(r){ t.reminder=r; t.reminderFired=false; } else { delete t.reminder; delete t.reminderFired; } msg="webhook: emlekezteto - "+String(t.title||"").slice(0,60);
        } else { return json({error:"Ismeretlen op: "+op},400); }
        t.mod=now; result=t;
      }
      await ghPut(env, data, g.sha, msg);
      return json({ok:true, op:op, result:result});
    }catch(e){ return json({error:String((e&&e.message)||e)},500); }
  }
};
