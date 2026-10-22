'use strict';
/* ---------- Helpers ---------- */
const TYPES={contribution:{l:'Contribution',s:1,c:'in'},loan:{l:'Loan given',s:-1,c:'out'},repayment:{l:'Loan repayment',s:1,c:'in'},expense:{l:'Group expense',s:-1,c:'out'}};
const r2=n=>Math.round(n*100)/100;
const inr=n=>(n<0?'−':'')+'₹'+new Intl.NumberFormat('en-IN',{maximumFractionDigits:2}).format(Math.abs(n));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>Math.random().toString(36).slice(2,10)+Date.now().toString(36);
const today=()=>{const d=new Date();return new Date(d-d.getTimezoneOffset()*6e4).toISOString().slice(0,10)};
const thisMonth=()=>today().slice(0,7);
const fmtDate=s=>s.split('-').reverse().join('/');
const monthName=m=>new Date(m+'-01T00:00').toLocaleDateString('en-IN',{month:'long',year:'numeric'});
const blank=()=>({v:1,opening:0,rates:[{from:'0000-00',amount:200}],members:[],tx:[],savedAt:null});

/* ---------- Local cache and shared storage ---------- */
const Store={
  key(){return localStorage.getItem('gfm-mode')==='sample'?'gfm-sample':'gfm-data'},
  load(){try{const r=localStorage.getItem(this.key());return r?JSON.parse(r):null}catch(e){return null}},
  save(d){d.savedAt=new Date().toISOString();localStorage.setItem(this.key(),JSON.stringify(d))}
};

/* ---------- Business logic (pure) ---------- */
function calc(d){
  const s={contrib:0,loan:0,repay:0,exp:0},by={};
  d.members.forEach(m=>by[m.id]={c:0,b:0,r:0});
  const key={contribution:'contrib',loan:'loan',repayment:'repay',expense:'exp'};
  d.tx.forEach(t=>{s[key[t.type]]+=t.amount;const b=by[t.memberId];
    if(b){if(t.type==='contribution')b.c+=t.amount;if(t.type==='loan')b.b+=t.amount;if(t.type==='repayment')b.r+=t.amount}});
  s.out=r2(s.loan-s.repay);
  s.bal=r2(d.opening+s.contrib+s.repay-s.loan-s.exp);
  for(const k of ['contrib','loan','repay','exp'])s[k]=r2(s[k]);
  for(const id in by){const b=by[id];b.c=r2(b.c);b.b=r2(b.b);b.r=r2(b.r);b.o=r2(b.b-b.r)}
  return{s,by};
}
function rateFor(d,m){let a=200;for(const r of [...d.rates].sort((x,y)=>x.from.localeCompare(y.from)))if(r.from<=m)a=r.amount;return a}
const paid=(d,id,m)=>r2(d.tx.filter(t=>t.type==='contribution'&&t.memberId===id&&t.month===m).reduce((a,t)=>a+t.amount,0));
function validTx(d,t,ign){
  if(!(t.amount>0)||!isFinite(t.amount))return 'Enter an amount greater than zero.';
  if(!/^\d{4}-\d{2}-\d{2}$/.test(t.date)||isNaN(new Date(t.date)))return 'Pick a valid date.';
  if(t.type!=='expense'&&!d.members.some(m=>m.id===t.memberId))return 'Select a member.';
  if(t.type==='contribution'&&!/^\d{4}-(0[1-9]|1[0-2])$/.test(t.month))return 'Pick a contribution month.';
  if(t.type==='expense'&&!t.category.trim())return 'Enter what the money was spent on.';
  const {s,by}=calc({...d,tx:d.tx.filter(x=>x.id!==ign)});
  if(t.type==='repayment'&&t.amount>by[t.memberId].o)return `This member owes only ${inr(by[t.memberId].o)}. Repayment can't be higher.`;
  if((t.type==='loan'||t.type==='expense')&&t.amount>s.bal)return `Only ${inr(s.bal)} is available in the fund.`;
  return '';
}
function warnings(d){
  const {s,by}=calc(d),w=[];
  if(s.bal<0)w.push(`Available cash is negative (${inr(s.bal)}). Check recent edits, deletions or the opening balance.`);
  d.members.forEach(m=>{if(by[m.id].o<0)w.push(`${m.name} has repaid ${inr(-by[m.id].o)} more than they borrowed. Fix the loan or repayment records.`)});
  const ids=new Set(d.members.map(m=>m.id));
  if(d.tx.some(t=>t.type!=='expense'&&!ids.has(t.memberId)))w.push('Some transactions point to a member that no longer exists.');
  return w;
}
function validData(d){
  const ok=d&&typeof d==='object'&&Array.isArray(d.members)&&Array.isArray(d.tx)&&typeof d.opening==='number'&&Array.isArray(d.rates)&&
    d.members.every(m=>m&&typeof m.id==='string'&&typeof m.name==='string')&&
    d.tx.every(t=>t&&TYPES[t.type]&&typeof t.id==='string'&&t.amount>0&&isFinite(t.amount)&&/^\d{4}-\d{2}-\d{2}$/.test(t.date))&&
    d.rates.every(r=>typeof r.from==='string'&&r.amount>0);
  if(ok)d.tx.forEach(t=>{t.note=t.note||'';t.category=t.category||'';t.month=t.month||'';t.memberId=t.memberId||''});
  return !!ok;
}
const sorted=l=>l.map((t,i)=>[t,i]).sort((a,b)=>b[0].date.localeCompare(a[0].date)||b[1]-a[1]).map(x=>x[0]);
if(typeof module!=='undefined')module.exports={calc,validTx,blank,paid,rateFor,warnings,validData};

/* ---------- UI ---------- */
if(typeof document!=='undefined'){
const $=s=>document.querySelector(s);
const config=window.FUND_SUPABASE_CONFIG||{};
let cloud=null,cloudSetupError='';
if(config.url||config.publishableKey){
  if(!config.url||!config.publishableKey)cloudSetupError='Set both the Supabase project URL and publishable key in supabase-config.js.';
  else if(!window.supabase)cloudSetupError='The Supabase client did not load. Check the network connection and reload.';
  else try{cloud=window.supabase.createClient(config.url,config.publishableKey)}
  catch(error){cloudSetupError='Invalid Supabase configuration: '+error.message}
}
let D=Store.load()||blank(),selMonth=thisMonth(),busy=false,F={type:'',member:'',month:'',from:'',to:'',q:''};
let cloudVersion=null,initializing=!!cloud&&localStorage.getItem('gfm-mode')!=='sample';
let authSession=null,isAdmin=false;
let syncMessage=cloud?'Connecting to shared fund…':cloudSetupError||'Cloud sync is not configured; data is saved only in this browser.';
let remoteQueue=Promise.resolve();
const sample=()=>localStorage.getItem('gfm-mode')==='sample';
const sessionIsAdmin=session=>session?.user?.app_metadata?.fund_role==='admin';
const nameOf=id=>(D.members.find(m=>m.id===id)||{name:'(removed member)'}).name;
const toast=(m,long)=>{const t=$('#toast');t.textContent=m;t.className='show';clearTimeout(toast.h);toast.h=setTimeout(()=>t.className='',long?5000:2200)};

async function getSharedState(){
  const {data,error}=await cloud.from('fund_state').select('state,version').eq('id','shared').maybeSingle();
  if(error)throw error;
  return data;
}
async function initializeCloud(){
  if(!cloud||sample())return;
  initializing=true;syncMessage='Connecting to shared fund…';render();
  try{
    const {data:sessionData,error:sessionError}=await cloud.auth.getSession();
    if(sessionError)throw sessionError;
    authSession=sessionData.session;
    isAdmin=sessionIsAdmin(authSession);
    let row=await getSharedState();
    if(!row){
      const local=Store.load();
      const hasLocalData=local&&(local.members.length||local.tx.length||local.opening||
        local.rates.some(r=>r.from!=='0000-00'||r.amount!==200));
      if(hasLocalData&&isAdmin){
        const result=await cloud.from('fund_state').insert({id:'shared',state:local,version:1}).select('state,version').single();
        if(result.error&&result.error.code==='23505')row=await getSharedState();
        else if(result.error)throw result.error;
        else row=result.data;
      }else cloudVersion=0;
    }
    if(row){
      if(!validData(row.state))throw new Error('The shared database contains invalid fund data.');
      D=row.state;cloudVersion=Number(row.version);Store.save(D);
    }
    syncMessage=isAdmin?'Connected as fund admin. Changes can be made.':'Connected to the shared fund. Read-only access.';
  }catch(error){
    cloudVersion=null;
    D=Store.load()||blank();
    syncMessage='Cloud sync unavailable: '+(error.message||'check the Supabase setup and connection.');
  }finally{
    initializing=false;render();
  }
}
function queueCloudSave(state){
  if(!cloud||sample())return;
  if(!isAdmin){
    syncMessage='Read-only: sign in with the fund admin account to make changes.';
    render();return;
  }
  const snapshot=JSON.parse(JSON.stringify(state));
  if(cloudVersion===null){
    syncMessage='Changes are saved only in this browser because cloud sync is unavailable.';
    render();return;
  }
  remoteQueue=remoteQueue.then(async()=>{
    let result;
    if(cloudVersion===0){
      result=await cloud.from('fund_state').insert({id:'shared',state:snapshot,version:1}).select('version').single();
      if(result.error&&result.error.code==='23505')throw new Error('Another device created the shared fund first. Reload this app to get the latest data.');
    }else{
      result=await cloud.from('fund_state').update({state:snapshot,version:cloudVersion+1})
        .eq('id','shared').eq('version',cloudVersion).select('version').maybeSingle();
    }
    if(result.error)throw result.error;
    if(!result.data)throw new Error('The fund changed on another device. Reload this app before making more changes.');
    cloudVersion=Number(result.data.version);
    syncMessage='All changes synced to Supabase.';
    render();
  }).catch(error=>{
    syncMessage='Cloud sync failed: '+(error.message||'unknown database error')+' Export a backup before reloading.';
    render();
  });
}

function commit(fn){
  if(!sample()&&!isAdmin){toast('Read-only access. Sign in with the fund admin account to make changes.',1);return false}
  const snap=JSON.stringify(D);
  try{fn(D);Store.save(D)}
  catch(e){D=JSON.parse(snap);toast('Could not save locally: '+e.message+' Export a backup now.',1);render();return false}
  render();queueCloudSave(D);return true;
}

const txRows=(l,a=isAdmin)=>l.length?l.map(t=>{const T=TYPES[t.type],who=t.type==='expense'?t.category:nameOf(t.memberId);
  return `<li class="tx"><div class="tl"><span class="chip ${t.type==='loan'?'loan':T.c}">${T.l}</span><b>${esc(who)}</b><small>${fmtDate(t.date)}${t.month?', for '+monthName(t.month):''}</small>${t.note?`<small>${esc(t.note)}</small>`:''}</div>
  <div class="ta"><b class="${T.c}" title="Effect on available balance">${T.s>0?'+':'−'}${inr(t.amount)}</b>${a?`<span><button class="lnk" data-act="edit" data-id="${t.id}">Edit</button><button class="lnk" data-act="del" data-id="${t.id}">Delete</button></span>`:''}</div></li>`}).join(''):'<li class="empty">No transactions yet.</li>';

function vDash(){
  const {s}=calc(D),act=D.members.filter(m=>m.active),req=rateFor(D,selMonth);
  const rows=act.map(m=>{const p=paid(D,m.id,selMonth);return{m,p,due:r2(Math.max(0,req-p))}});
  const pend=r2(rows.reduce((a,r)=>a+r.due,0)),target=req*act.length,got=rows.reduce((a,r)=>a+Math.min(r.p,req),0),pct=target?Math.round(got/target*100):0;
  return `<section class="hero"><p>Available cash</p><strong class="big">${inr(s.bal)}</strong>${isAdmin?'<button class="primary" data-act="add">+ Add Transaction</button>':''}</section>
  <div class="grid">
   <div class="card"><span>Total Contributions</span><b class="in">${inr(s.contrib)}</b></div>
   <div class="card"><span>Loans Outstanding</span><b class="out">${inr(s.out)}</b></div>
   <div class="card"><span>Total Expenses</span><b class="out">${inr(s.exp)}</b></div>
   <div class="card"><span>Total Repaid</span><b class="in">${inr(s.repay)}</b></div>
   <div class="card" style="grid-column:1/-1"><span>Pending for ${monthName(selMonth)}</span><b class="info">${inr(pend)}</b></div></div>
  <h2>Monthly collection</h2><div class="card">
   <label style="margin:0">Month<input type="month" id="selm" value="${selMonth}"></label>
   ${act.length?`<div class="bar" aria-hidden="true"><i style="width:${pct}%"></i></div><small>${inr(got)} of ${inr(target)} collected (${inr(req)} per member)</small>
   <ul>${rows.map(r=>`<li class="row"><span>${esc(r.m.name)}</span><span>${r.p>=req?'<span class="chip paid">Paid</span>':`<span class="chip ${r.p>0?'part':'due'}">${r.p>0?'Part-paid, ':'Due '}${inr(r.due)}${r.p>0?' left':''}</span> ${isAdmin?`<button class="lnk" data-act="addc" data-m="${r.m.id}">Record</button>`:''}`}</span></li>`).join('')}</ul>`
   :'<p class="empty">No active members yet. <a href="#members">Add your members</a> to start tracking.</p>'}</div>
  <h2>Latest activity</h2><div class="card"><ul>${txRows(sorted(D.tx).slice(0,5),false)}</ul></div>`;
}

function vMembers(){
  const {by}=calc(D),req=rateFor(D,thisMonth());
  return `${isAdmin?'<form id="addm" class="flex" style="align-items:end"><label style="flex:3;margin:0">New member<input name="n" placeholder="Name" required autocomplete="off"></label><button class="primary" style="flex:1">Add</button></form>':''}
  <div class="stack" style="margin-top:14px">${D.members.length?D.members.map(m=>{const b=by[m.id],p=paid(D,m.id,thisMonth());
   const st=!m.active?'<span class="chip off">Inactive</span>':p>=req?'<span class="chip paid">Paid this month</span>':`<span class="chip ${p>0?'part':'due'}">${p>0?'Part-paid':'Not paid'} this month</span>`;
   return `<div class="card"><div class="flex" style="justify-content:space-between;align-items:center"><h3>${esc(m.name)}</h3>${st}</div>
   <div class="two" style="margin:10px 0"><small>Contributed<br><b class="in">${inr(b.c)}</b></small><small>Borrowed<br><b class="out">${inr(b.b)}</b></small><small>Repaid<br><b class="in">${inr(b.r)}</b></small><small>Owes now<br><b class="${b.o>0?'out':''}">${inr(b.o)}</b></small></div>
   <ul>${txRows(sorted(D.tx.filter(t=>t.memberId===m.id)).slice(0,3),false)}</ul>
   <div class="flex"><button data-act="det" data-id="${m.id}">All records</button>${isAdmin?`<button data-act="editm" data-id="${m.id}">Rename</button><button data-act="tog" data-id="${m.id}">${m.active?'Set inactive':'Set active'}</button>`:''}</div></div>`}).join(''):'<p class="empty">No members yet.</p>'}</div>`;
}

function vTx(){
  return `<div class="filters card"><input class="full" type="search" placeholder="Search name, note, amount" data-f="q" value="${esc(F.q)}" aria-label="Search">
   <select data-f="type" aria-label="Type"><option value="">All types</option>${Object.entries(TYPES).map(([k,v])=>`<option value="${k}" ${F.type===k?'selected':''}>${v.l}</option>`).join('')}</select>
   <select data-f="member" aria-label="Member"><option value="">All members</option>${D.members.map(m=>`<option value="${m.id}" ${F.member===m.id?'selected':''}>${esc(m.name)}</option>`).join('')}</select>
   <label style="margin:0">Month<input type="month" data-f="month" value="${F.month}"></label><span></span>
   <label style="margin:0">From<input type="date" data-f="from" value="${F.from}"></label><label style="margin:0">To<input type="date" data-f="to" value="${F.to}"></label></div>
  <div class="flex" style="margin:12px 0"><button data-act="csv">Export CSV</button><button data-act="clearf">Clear filters</button></div>
  <div class="card"><ul id="txlist"></ul></div>`;
}
function filtered(){const q=F.q.trim().toLowerCase();return sorted(D.tx).filter(t=>(!F.type||t.type===F.type)&&(!F.member||t.memberId===F.member)&&(!F.month||(t.month||t.date.slice(0,7))===F.month)&&(!F.from||t.date>=F.from)&&(!F.to||t.date<=F.to)&&(!q||[nameOf(t.memberId),t.category,t.note,TYPES[t.type].l,t.amount].join(' ').toLowerCase().includes(q)))}
const renderList=()=>{const l=$('#txlist');if(l)l.innerHTML=txRows(filtered())};

function vLoans(){
  const {s,by}=calc(D),l=D.members.filter(m=>by[m.id].b>0||by[m.id].o!==0);
  return `<div class="card"><small>Total outstanding</small><b class="out" style="display:block;font-size:28px">${inr(s.out)}</b><small>Given ${inr(s.loan)}, repaid ${inr(s.repay)}</small></div>
  <div class="stack" style="margin-top:12px">${l.length?l.map(m=>{const b=by[m.id];return `<div class="card"><div class="flex" style="justify-content:space-between"><h3>${esc(m.name)}</h3><b class="${b.o>0?'out':''}">${inr(b.o)} owed</b></div><small>Borrowed ${inr(b.b)}, repaid ${inr(b.r)}</small>
   <ul>${txRows(sorted(D.tx.filter(t=>t.memberId===m.id&&(t.type==='loan'||t.type==='repayment'))).slice(0,4),false)}</ul>
   ${isAdmin?`<div class="flex"><button data-act="newloan" data-m="${m.id}">Give loan</button><button class="primary" data-act="repay" data-m="${m.id}" ${b.o>0?'':'disabled'}>Record repayment</button></div>`:''}</div>`}).join(''):'<p class="empty">No loans yet.</p>'}</div>`;
}

function vSettings(){
  return `<div class="card"><h3>Shared fund storage</h3><p class="hint">${esc(syncMessage)}</p>
   <p class="hint">The dashboard is public and read-only. Only the configured fund admin can change shared records.</p>
   <p class="hint">A local browser copy is also kept as a cache. Export backups regularly.</p>
   <p class="hint">Last saved: ${D.savedAt?new Date(D.savedAt).toLocaleString('en-IN'):'nothing saved yet'}</p>
   <div class="stack"><button class="primary" data-act="json">Export Backup (JSON)</button><button data-act="csv">Export CSV</button>${isAdmin?'<button data-act="restore">Restore Backup</button>':''}</div></div>
  ${isAdmin?`<h2>Fund settings</h2><div class="card"><label style="margin:0">Opening balance (₹)<input id="open" type="number" inputmode="decimal" min="0" step="0.01" value="${D.opening}"></label><button style="margin-top:8px" data-act="saveopen">Save opening balance</button>
   <label>Monthly contribution (₹)<input id="rate" type="number" inputmode="decimal" min="1" step="1" value="${rateFor(D,thisMonth())}"></label>
   <label>Applies from month<input id="ratem" type="month" value="${thisMonth()}"></label><button style="margin-top:8px" data-act="saverate">Save contribution amount</button><p class="hint">Earlier months keep the amount that applied then.</p></div>
  <h2>Testing and reset</h2><div class="card stack"><button data-act="${sample()?'exitsample':'sample'}">${sample()?'Leave sample mode':'Try with sample data'}</button><p class="hint">Sample data is kept separate and never touches your real records.</p><button class="danger" data-act="reset">Erase all ${sample()?'sample':'real'} data</button></div>`:''}`;
}

const routes={dashboard:vDash,members:vMembers,transactions:vTx,loans:vLoans,settings:vSettings};
function render(){
  let v=(location.hash||'#dashboard').slice(1);if(!routes[v])v='dashboard';
  const access=$('#admin-access');
  access.textContent=isAdmin?'Sign out':authSession?'Sign out (read-only)':'Admin sign in';
  access.dataset.act=authSession?'signout':'auth';
  $('[data-act="add"]')?.toggleAttribute('hidden',!isAdmin);
  $('#view').innerHTML=(sample()?'<div class="banner sample">Sample mode: these records are not your real fund. <button class="lnk" data-act="exitsample">Leave</button></div>':'')+
    (!sample()?`<div class="banner ${cloud&&cloudVersion!==null?'sample':'warn'}" role="status">${esc(syncMessage)}</div>`:'')+
    (initializing?'<div class="card">Connecting to the shared fund. Please wait…</div>':warnings(D).map(w=>`<div class="banner warn" role="alert">${esc(w)}</div>`).join('')+routes[v]());
  document.querySelectorAll('#nav a').forEach(a=>a.classList.toggle('on',a.getAttribute('href')==='#'+v));
  if(v==='transactions')renderList();
}

/* ---------- Transaction form ---------- */
function openForm(type='contribution',id='',member=''){
  const t=id?D.tx.find(x=>x.id===id):{type,memberId:member,amount:type==='contribution'?rateFor(D,thisMonth()):'',date:today(),month:thisMonth(),note:'',category:''};
  const dlg=$('#dlg'),ty=t.type;
  dlg.innerHTML=`<form id="f"><h3>${id?'Edit':'Add'} transaction</h3>
  ${id?'':`<div class="seg" style="margin-top:10px">${Object.entries(TYPES).map(([k,v])=>`<button type="button" class="${k===ty?'on':''}" data-act="ftype" data-t="${k}">${v.l}</button>`).join('')}</div>`}
  ${ty!=='expense'?`<label>Member<select name="member" required><option value="">Choose…</option>${D.members.map(m=>`<option value="${m.id}" ${m.id===t.memberId?'selected':''}>${esc(m.name)}${m.active?'':' (inactive)'}</option>`).join('')}</select></label>`:`<label>Spent on<input name="category" value="${esc(t.category)}" placeholder="e.g. Tea, printing, gift" required></label>`}
  ${ty==='repayment'?'<p id="owe" class="hint"></p>':''}
  <label>Amount (₹)<input name="amount" type="number" inputmode="decimal" step="0.01" min="0.01" value="${t.amount}" required></label>
  ${ty==='contribution'?`<label>For month<input name="month" type="month" value="${t.month}" required></label>`:''}
  <label>Date<input name="date" type="date" value="${t.date}" required></label>
  <label>${ty==='loan'?'Purpose or note (optional)':'Note (optional)'}<input name="note" value="${esc(t.note)}"></label>
  <p id="err" class="err" role="alert"></p><div class="flex"><button type="button" data-act="close">Cancel</button><button class="primary">Save</button></div></form>`;
  const f=$('#f'),owe=$('#owe');
  const showOwe=()=>{if(!owe)return;const id2=f.member.value;if(!id2){owe.textContent='';return}const {by}=calc({...D,tx:D.tx.filter(x=>x.id!==id)});owe.textContent='Outstanding loan: '+inr(by[id2].o)};
  if(owe){f.member.onchange=showOwe;showOwe()}
  f.onsubmit=e=>{e.preventDefault();if(busy)return;const g=n=>f.elements[n]?f.elements[n].value:'';
    const nt={id:t.id||uid(),type:ty,memberId:g('member'),amount:r2(parseFloat(g('amount'))),date:g('date'),month:g('month'),category:g('category').trim(),note:g('note').trim()};
    const er=validTx(D,nt,id);if(er){$('#err').textContent=er;return}
    busy=true;const ok=commit(d=>{if(id)d.tx[d.tx.findIndex(x=>x.id===id)]=nt;else d.tx.push(nt)});busy=false;
    if(ok){dlg.close();toast('Saved')}};
  if(!dlg.open)dlg.showModal();
}

function openAdminLogin(){
  if(!cloud)return toast('Supabase is not configured.',1);
  const dlg=$('#dlg');
  dlg.innerHTML='<form id="admin-login"><h3>Admin sign in</h3><p class="hint">Only the configured fund admin account can edit shared records.</p><label>Email<input name="email" type="email" autocomplete="username" required></label><label>Password<input name="password" type="password" autocomplete="current-password" required></label><p id="auth-err" class="err" role="alert"></p><div class="flex"><button type="button" data-act="close">Cancel</button><button class="primary">Sign in</button></div></form>';
  $('#admin-login').onsubmit=async e=>{
    e.preventDefault();
    const form=e.currentTarget,submit=form.querySelector('button[type="submit"],button.primary');
    submit.disabled=true;
    const {error}=await cloud.auth.signInWithPassword({email:form.elements.email.value.trim(),password:form.elements.password.value});
    submit.disabled=false;
    if(error){$('#auth-err').textContent=error.message;return}
    dlg.close();
    toast('Signed in. Admin permissions are checked by Supabase.');
  };
  if(!dlg.open)dlg.showModal();
}

/* ---------- Files ---------- */
const download=(name,text,mime)=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:mime}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1e3)};
const makeSample=()=>{const d=blank(),n=['Asha','Bala','Chitra','Dev','Esha','Farid'],m=thisMonth(),dt=today();
  d.members=n.map(x=>({id:uid(),name:x,active:true}));
  d.members.forEach(x=>d.tx.push({id:uid(),type:'contribution',memberId:x.id,amount:200,date:dt,month:m,note:'',category:''}));
  d.tx.push({id:uid(),type:'loan',memberId:d.members[1].id,amount:500,date:dt,month:'',note:'Sample loan',category:''},{id:uid(),type:'repayment',memberId:d.members[1].id,amount:200,date:dt,month:'',note:'',category:''},{id:uid(),type:'expense',memberId:'',amount:100,date:dt,month:'',note:'',category:'Tea and snacks'});return d};

const A={
  auth:openAdminLogin,
  signout:async()=>{const {error}=await cloud.auth.signOut();if(error)toast('Could not sign out: '+error.message,1)},
  add:()=>openForm(),addc:d=>openForm('contribution','',d.m),newloan:d=>openForm('loan','',d.m),repay:d=>openForm('repayment','',d.m),
  ftype:d=>{const m=$('#f [name=member]');openForm(d.t,'',m?m.value:'')},close:()=>$('#dlg').close(),
  edit:d=>openForm(D.tx.find(x=>x.id===d.id).type,d.id),
  del:d=>{const t=D.tx.find(x=>x.id===d.id);if(confirm(`Delete this ${TYPES[t.type].l.toLowerCase()} of ${inr(t.amount)}? All balances will be recalculated.`)){commit(x=>x.tx=x.tx.filter(y=>y.id!==d.id));toast('Deleted')}},
  editm:d=>{const m=D.members.find(x=>x.id===d.id),n=prompt('Member name',m.name);if(n&&n.trim())commit(()=>m.name=n.trim())},
  tog:d=>{const m=D.members.find(x=>x.id===d.id);commit(()=>m.active=!m.active)},
  det:d=>{const m=D.members.find(x=>x.id===d.id),b=calc(D).by[m.id];$('#dlg').innerHTML=`<h3>${esc(m.name)}</h3><p class="hint">Contributed ${inr(b.c)}. Borrowed ${inr(b.b)}, repaid ${inr(b.r)}, owes ${inr(b.o)}.</p><ul style="max-height:50vh;overflow:auto">${txRows(sorted(D.tx.filter(t=>t.memberId===m.id)))}</ul><button data-act="close" style="width:100%;margin-top:10px">Close</button>`;$('#dlg').showModal()},
  clearf:()=>{F={type:'',member:'',month:'',from:'',to:'',q:''};render()},
  csv:()=>{const q=v=>`"${String(v).replace(/"/g,'""')}"`,rows=[['Date','Type','Member / Spent on','Month','Amount','Effect on balance','Note']];
    sorted(D.tx).reverse().forEach(t=>rows.push([t.date,TYPES[t.type].l,t.type==='expense'?t.category:nameOf(t.memberId),t.month,t.amount,TYPES[t.type].s*t.amount,t.note]));
    download(`group-fund-transactions-${today()}.csv`,'\ufeff'+rows.map(r=>r.map(q).join(',')).join('\n'),'text/csv')},
  json:()=>{download(`group-fund-backup-${today()}.json`,JSON.stringify(D,null,1),'application/json');toast('Backup downloaded')},
  restore:()=>$('#file').click(),
  saveopen:()=>{const v=parseFloat($('#open').value);if(!(v>=0)||!isFinite(v))return toast('Enter a valid opening balance.');
    const nb=calc({...D,opening:r2(v)}).s.bal;if(confirm(`Change opening balance to ${inr(v)}? Available cash will become ${inr(nb)}.`)){commit(d=>d.opening=r2(v));toast('Opening balance saved')}},
  saverate:()=>{const v=parseFloat($('#rate').value),m=$('#ratem').value;if(!(v>0)||!m)return toast('Enter an amount and a month.');
    if(confirm(`Set the monthly contribution to ${inr(v)} from ${monthName(m)}?`)){commit(d=>{d.rates=d.rates.filter(r=>r.from!==m);d.rates.push({from:m,amount:r2(v)})});toast('Contribution amount saved')}},
  sample:()=>{if(!confirm('Switch to sample mode? Your real records stay untouched.'))return;localStorage.setItem('gfm-mode','sample');D=makeSample();try{Store.save(D)}catch(e){toast('Could not save sample data: '+e.message,1)}location.hash='#dashboard';render()},
  exitsample:()=>{localStorage.removeItem('gfm-mode');D=Store.load()||blank();render();toast('Back to your real records');initializeCloud()},
  reset:()=>{if(confirm('Erase ALL records on this device? This cannot be undone unless you have a backup.')&&confirm('Really erase everything?'))commit(d=>Object.assign(d,blank()))}
};
document.addEventListener('click',e=>{const b=e.target.closest('[data-act]');if(b&&initializing)return toast('Wait for the shared fund to finish connecting.');if(b&&['add','addc','newloan','repay','edit','del','editm','tog','saveopen','saverate','restore','reset'].includes(b.dataset.act)&&!isAdmin)return toast('Read-only access. Sign in with the fund admin account to make changes.',1);if(b&&A[b.dataset.act])A[b.dataset.act](b.dataset)});
document.addEventListener('submit',e=>{if(e.target.id!=='addm')return;e.preventDefault();const n=e.target.n.value.trim();
  if(initializing)return toast('Wait for the shared fund to finish connecting.');
  if(!isAdmin)return toast('Read-only access. Sign in with the fund admin account to make changes.',1);
  if(!n)return;if(D.members.some(m=>m.name.toLowerCase()===n.toLowerCase())&&!confirm(`A member named "${n}" already exists. Add another?`))return;
  commit(d=>d.members.push({id:uid(),name:n,active:true}))});
document.addEventListener('input',e=>{const k=e.target.dataset.f;if(k){F[k]=e.target.value;renderList()}});
document.addEventListener('change',e=>{if(e.target.id==='selm'&&e.target.value){selMonth=e.target.value;render()}});
$('#file').onchange=e=>{const fl=e.target.files[0];e.target.value='';if(!fl)return;const rd=new FileReader();
  rd.onload=()=>{let d;try{d=JSON.parse(rd.result)}catch(x){return toast('That file is not a valid backup.',1)}
    if(!validData(d))return toast('That backup is missing data or damaged. Nothing was changed.',1);
    if(confirm(`Replace current records with this backup (${d.members.length} members, ${d.tx.length} transactions)?`)){commit(x=>Object.assign(x,d));toast('Backup restored')}};rd.readAsText(fl)};
addEventListener('hashchange',render);
render();
if(cloud){
  cloud.auth.onAuthStateChange((event,session)=>{
    authSession=session;isAdmin=sessionIsAdmin(session);
    if(event==='SIGNED_IN'||event==='SIGNED_OUT'||event==='USER_UPDATED'){
      initializing=true;syncMessage=isAdmin?'Refreshing fund as admin…':'Refreshing read-only fund…';render();
      setTimeout(()=>initializeCloud(),0);
    }else render();
  });
  initializeCloud();
}
if('serviceWorker' in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('sw.js').catch(()=>{});
}
