// ====== Storage Keys ======
const LS_SONGS = 'kish_band_playlist_v1';
const LS_USERS = 'kish_users_v1';
const LS_SIGNUPS = 'kish_signups_v1';
const LS_POSTS = 'kish_board_posts_v1';
const LS_SESSION = 'kish_session_v1';
const LS_LOGS = 'kish_admin_logs_v1';

const collator = new Intl.Collator('ko', { sensitivity: 'base', numeric: true });

// ====== Utils ======
const uid = ()=>'id-'+Math.random().toString(36).slice(2)+Date.now().toString(36);
const fmtDate = (d)=>{
  const pad = n=> String(n).padStart(2,'0');
  const dt = new Date(d);
  return `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
};
async function hashHex(text){
  try{
    if(window.crypto && window.crypto.subtle){
      const buf = new TextEncoder().encode(text);
      const digest = await crypto.subtle.digest('SHA-256', buf);
      return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');
    }
  }catch(e){ /* fall through */ }
  // Fallback hash (DJB2) for non-secure contexts (e.g., file://)
  let h = 5381; for(let i=0;i<text.length;i++){ h=((h<<5)+h)+text.charCodeAt(i); h|=0; }
  return 'x'+(h>>>0).toString(16);
}

const read = (k, def)=>{ try{ return JSON.parse(localStorage.getItem(k)) ?? def; }catch(e){ return def; } };
const write = (k,v)=> localStorage.setItem(k, JSON.stringify(v));

// ====== Auth State ======
let session = read(LS_SESSION, null); // {name}

// ====== Users & Signups & Logs ======
let users = read(LS_USERS, []);      // [{id,name,hash,dept,part,partCustom,createdAt}]
let signups = read(LS_SIGNUPS, []);  // pending
let logs = read(LS_LOGS, []);        // [{id,ts,actor,action,meta}]

function addLog(action, meta={}){
  logs.unshift({ id: uid(), ts: Date.now(), actor: session?.name || 'system', action, meta });
  if(logs.length>500) logs = logs.slice(0,500);
  write(LS_LOGS, logs);
  // refresh if admin tab visible
  if(document.getElementById('tab-admin').style.display!=='none' && document.querySelector('#tab-admin').style.display!=='none'){
    renderLogs();
  }
}

// ensure admin exists
(function ensureAdmin(){
  if(!users.some(u=>u.name==='admin')){
    users.push({ id: uid(), name:'admin', hash:'admin:1111', dept:'관리자', part:'관리자', partCustom:'', createdAt: Date.now() });
    write(LS_USERS, users);
    addLog('bootstrap_admin', {name:'admin'});
  }
})();

// ====== DOM Refs ======
const authScreen = document.getElementById('authScreen');
const appScreen = document.getElementById('appScreen');
const userBar = document.getElementById('userBar');

const tabLogin = document.getElementById('tabLogin');
const tabSignup = document.getElementById('tabSignup');
const loginPane = document.getElementById('loginPane');
const signupPane = document.getElementById('signupPane');

const loginName = document.getElementById('loginName');
const loginPw = document.getElementById('loginPw');
const loginBtn = document.getElementById('loginBtn');

const suName = document.getElementById('suName');
const suPw = document.getElementById('suPw');
const suPw2 = document.getElementById('suPw2');
const suDept = document.getElementById('suDept');
const suPart = document.getElementById('suPart');
const suPartCustomWrap = document.getElementById('suPartCustomWrap');
const suPartCustom = document.getElementById('suPartCustom');
const signupBtn = document.getElementById('signupBtn');

const mainTabs = document.getElementById('mainTabs');
const adminTab = document.getElementById('adminTab');

// ====== SONGS (Playlist) ======
const DEFAULT_PARTS = [
  { key:'1stKeys',  label:'1st 건반', builtin:true },
  { key:'2ndKeys',  label:'2nd 건반', builtin:true },
  { key:'1stElec',  label:'1st 일렉', builtin:true },
  { key:'2ndElec',  label:'2nd 일렉', builtin:true },
  { key:'Acoustic', label:'어쿠스틱 기타', builtin:true },
  { key:'Bass',     label:'베이스 기타', builtin:true },
  { key:'Drums',    label:'드럼', builtin:true },
  { key:'Vocal1',   label:'보컬 1', builtin:true },
  { key:'Vocal2',   label:'보컬 2', builtin:true },
  { key:'Vocal3',   label:'보컬 3', builtin:true },
];
const slugify = (s)=> s.toString().trim().replace(/\s+/g,'-').replace(/[^\w\-가-힣]/g,'').replace(/\-+/g,'-').toLowerCase() || ('p-'+Math.random().toString(36).slice(2,7));
const uniqueKey = (base, used)=>{ let k = base; let i=2; while(used.has(k)) k = base+"-"+(i++); return k; };
const cloneDefaults = ()=> DEFAULT_PARTS.map(p=> ({ key:p.key, label:p.label, player:'', ref:'', misc:'', builtin:true }));
function normalizeSong(s){
  if(Array.isArray(s.parts)){
    s.parts = s.parts.map(p=> ({ key: p.key || slugify(p.label||'part'), label: p.label || p.key || '파트', player: p.player || '', ref: p.ref || '', misc: p.misc || '', builtin: !!p.builtin && DEFAULT_PARTS.some(d=>d.key===p.key) }));
    return s;
  }
  const arr = []; const obj = s.parts || {}; const used = new Set();
  DEFAULT_PARTS.forEach(d=>{ const pr = obj[d.key] || {player:'',ref:'',misc:''}; arr.push({ key:d.key, label:d.label, player:pr.player||'', ref:pr.ref||'', misc:pr.misc||'', builtin:true }); used.add(d.key); });
  Object.keys(obj).forEach(k=>{ if(!used.has(k)){ const pr = obj[k] || {player:'',ref:'',misc:''}; arr.push({ key:k, label:k, player:pr.player||'', ref:pr.ref||'', misc:pr.misc||'', builtin:false }); } });
  s.parts = arr; return s;
}

let songs = (read(LS_SONGS, []).map(normalizeSong));
const saveSongs = ()=> write(LS_SONGS, songs);

// Playlist DOM
const listEl = document.getElementById('list');
const emptyEl = document.getElementById('empty');
const addBtn = document.getElementById('addBtn');

const songDlg = document.getElementById('songDlg');
const songForm = document.getElementById('songForm');
const closeDlg = document.getElementById('closeDlg');
const cancelBtn = document.getElementById('cancelBtn');

const titleInput = document.getElementById('title');
const artistInput = document.getElementById('artist');
const versionInput = document.getElementById('version');
const partsTbody = document.getElementById('partsTbody');
const addPartBtn = document.getElementById('addPartBtn');

const searchField = document.getElementById('searchField');
const searchInput = document.getElementById('searchInput');
const acMenu = document.getElementById('acMenu');
const clearSearch = document.getElementById('clearSearch');

// By person dialog DOM
const byPersonBtn = document.getElementById('byPersonBtn');
const personDlg = document.getElementById('personDlg');
const closePersonDlg = document.getElementById('closePersonDlg');
const personInput = document.getElementById('personInput');
const personAcMenu = document.getElementById('personAcMenu');
const personClear = document.getElementById('personClear');
const personTableBody = document.querySelector('#personTable tbody');
const personEmpty = document.getElementById('personEmpty');
const personColumns = ['title','artist','version','part','ref','misc'];
let personSort = { key: 'title', dir: 'asc' };
const personThead = document.querySelector('#personTable thead');

function updatePersonHeader(){
  const labels = ['곡','가수','버전','담당 파트','예시 링크','공유 링크'];
  const ths = personThead.querySelectorAll('th');
  ths.forEach((th,i)=>{
    const k = personColumns[i];
    let label = labels[i];
    if(k===personSort.key){ label += personSort.dir==='asc' ? ' ▲' : ' ▼'; }
    th.textContent = label;
  });
}
personThead.addEventListener('click', (e)=>{
  const th = e.target.closest('th');
  if(!th) return;
  const idx = Array.from(personThead.querySelector('tr').children).indexOf(th);
  const key = personColumns[idx];
  if(!key) return;
  if(personSort.key===key){ personSort.dir = personSort.dir==='asc' ? 'desc' : 'asc'; }
  else { personSort.key = key; personSort.dir = 'asc'; }
  updatePersonHeader();
  renderPersonResults(personInput.value.trim());
});

// auth bar render
function renderUserBar(){
  if(!session){ userBar.style.display='none'; return; }
  userBar.style.display='flex';
  userBar.innerHTML = '';
  const span = document.createElement('div');
  span.className='muted';
  span.textContent = `${session.name}님`;
  const profile = document.createElement('button');
  profile.className='btn';
  profile.textContent='내 정보';
  profile.addEventListener('click', openProfile);
  const logout = document.createElement('button');
  logout.className='btn ghost';
  logout.textContent = '로그아웃';
  logout.addEventListener('click', ()=>{ session=null; localStorage.removeItem(LS_SESSION); location.reload(); });
  userBar.appendChild(span); userBar.appendChild(profile); userBar.appendChild(logout);
}

// ====== Playlist Rendering ======
function renderSongs(){
  const q = searchInput.value.trim().toLowerCase();
  const field = searchField.value;
  const filtered = songs
    .slice()
    .sort((a,b)=> collator.compare(a.title||'', b.title||''))
    .filter(s=> { if(!q) return true; const t=(s[field]||'').toLowerCase(); return t.includes(q); });

  listEl.innerHTML='';
  if(filtered.length===0){ emptyEl.style.display='block'; return; }
  emptyEl.style.display='none';

  filtered.forEach((s, idx)=>{
    const row = document.createElement('div'); row.className='row';
    const head = document.createElement('div'); head.className='rowHead';

    const tl = document.createElement('div');
    tl.innerHTML = `<b>${idx+1}. ${s.title}</b> <span class="muted"> · ${s.artist}${s.version? ' · '+s.version:''}</span>`;
    const btns = document.createElement('div'); btns.style.display='flex'; btns.style.gap='6px';
    const editBtn = document.createElement('button'); editBtn.className='btn'; editBtn.textContent='편집'; editBtn.addEventListener('click', ()=> openEditSong(s.id));
    const delBtn = document.createElement('button'); delBtn.className='btn danger'; delBtn.textContent='삭제'; delBtn.addEventListener('click', ()=> deleteSong(s.id));
    btns.appendChild(editBtn); btns.appendChild(delBtn);
    head.appendChild(tl); head.appendChild(btns);

    const det = document.createElement('details');
    const sum = document.createElement('summary'); sum.textContent = '자세히 보기'; det.appendChild(sum);
    const tbl = document.createElement('table'); tbl.className='parts';
    tbl.innerHTML = `<thead><tr><th>파트</th><th>담당자</th><th>예시 링크</th><th>기타/공유</th></tr></thead>`;
    const tb = document.createElement('tbody');
    (s.parts||[]).forEach(p=>{
      const linkA = p.ref ? `<a href="${p.ref}" target="_blank" rel="noopener">열기</a>` : '<span class="muted">-</span>';
      const linkB = p.misc ? `<a href="${p.misc}" target="_blank" rel="noopener">열기</a>` : '<span class="muted">-</span>';
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${p.label}</td><td>${p.player||'<span class="muted">(미정)</span>'}</td><td>${linkA}</td><td>${linkB}</td>`;
      tb.appendChild(tr);
    });
    tbl.appendChild(tb); det.appendChild(tbl);

    row.appendChild(head); row.appendChild(det);
    listEl.appendChild(row);
  });
}

// ====== Song Editor ======
let editingSongId = null;
let editingParts = [];
function buildPartsEditor(){
  partsTbody.innerHTML='';
  editingParts.forEach(p=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span>${p.label}</span>${p.builtin? '': `<button type="button" class="miniDel" data-key="${p.key}">삭제</button>`}</td>
      <td><input type="text" data-key="${p.key}" data-field="player" placeholder="담당자 이름" value="${p.player||''}"></td>
      <td><input type="url" data-key="${p.key}" data-field="ref" placeholder="예시 링크 (https://)" value="${p.ref||''}"></td>
      <td><input type="url" data-key="${p.key}" data-field="misc" placeholder="기타/공유 링크 (https://)" value="${p.misc||''}"></td>`;
    partsTbody.appendChild(tr);
  });
}

function openAddSong(){
  editingSongId = null;
  titleInput.value=''; artistInput.value=''; versionInput.value='';
  editingParts = cloneDefaults();
  buildPartsEditor();
  songDlg.showModal(); setTimeout(()=> titleInput.focus(), 50);
}
function openEditSong(id){
  const s = songs.find(x=>x.id===id); if(!s) return;
  editingSongId = id;
  titleInput.value = s.title||''; artistInput.value=s.artist||''; versionInput.value=s.version||'';
  editingParts = (s.parts||[]).map(p=>({...p}));
  buildPartsEditor(); songDlg.showModal(); setTimeout(()=> titleInput.focus(), 50);
}
function gatherParts(){
  const map = new Map(editingParts.map(p=>[p.key,p]));
  partsTbody.querySelectorAll('input').forEach(inp=>{ const k=inp.dataset.key; const f=inp.dataset.field; if(k&&f&&map.has(k)){ map.get(k)[f] = inp.value.trim(); }});
  return Array.from(map.values());
}

function deleteSong(id){
  const s = songs.find(x=>x.id===id); if(!s) return;
  if(!confirm('이 곡을 삭제할까요?')) return;
  songs = songs.filter(x=>x.id!==id); saveSongs(); renderSongs();
  addLog('song_deleted', {title:s.title, artist:s.artist});
}

addPartBtn.addEventListener('click', ()=>{
  const name = prompt('추가할 파트 이름을 입력하세요'); if(!name) return;
  const base = slugify(name); const used = new Set(editingParts.map(p=>p.key)); const key = uniqueKey(base, used);
  editingParts.push({ key, label:name.trim(), player:'', ref:'', misc:'', builtin:false }); buildPartsEditor();
});
partsTbody.addEventListener('click', (e)=>{ const btn=e.target.closest('.miniDel'); if(!btn) return; const key=btn.dataset.key; const idx=editingParts.findIndex(p=>p.key===key); if(idx>-1){ if(editingParts[idx].builtin){ alert('기본 파트는 삭제할 수 없습니다.'); return;} editingParts.splice(idx,1); buildPartsEditor(); }});

songForm.addEventListener('submit', (e)=>{
  e.preventDefault();
  const title = titleInput.value.trim(); const artist = artistInput.value.trim(); const version = versionInput.value.trim(); if(!title||!artist){ alert('제목과 가수를 입력해주세요.'); return; }
  const parts = gatherParts();
  if(editingSongId){ songs = songs.map(s=> s.id===editingSongId ? { ...s, title, artist, version, parts } : s); addLog('song_edited', {title, artist}); }
  else { songs.push({ id: uid(), title, artist, version, parts }); addLog('song_added', {title, artist}); }
  saveSongs(); songDlg.close(); renderSongs();
});
[closeDlg, cancelBtn].forEach(b=> b.addEventListener('click', ()=> songDlg.close()));
addBtn.addEventListener('click', openAddSong);

// ====== Search & Autocomplete (Songs) ======
let acTimer=null;
function updateAutocomplete(){
  const q = searchInput.value.trim().toLowerCase(); const field = searchField.value; if(!q){ acMenu.style.display='none'; acMenu.innerHTML=''; renderSongs(); return; }
  const candidates = songs.map(s=> s[field]||'').filter(Boolean).filter((v,i,arr)=> arr.indexOf(v)===i).filter(v=> v.toLowerCase().includes(q)).sort((a,b)=> collator.compare(a,b)).slice(0,8);
  if(candidates.length===0){ acMenu.style.display='none'; acMenu.innerHTML=''; renderSongs(); return; }
  acMenu.innerHTML = candidates.map(v=> `<div class="ac-item" data-value="${v.replaceAll('"','&quot;')}">${v}</div>`).join('');
  acMenu.style.display='block';
}
searchInput.addEventListener('input', ()=>{ clearTimeout(acTimer); acTimer=setTimeout(()=>{ updateAutocomplete(); renderSongs(); }, 200); });
searchField.addEventListener('change', ()=>{ updateAutocomplete(); renderSongs(); });
acMenu.addEventListener('click', (e)=>{ const item=e.target.closest('.ac-item'); if(!item) return; searchInput.value=item.dataset.value||''; acMenu.style.display='none'; renderSongs(); });
document.addEventListener('click', (e)=>{ if(!acMenu.contains(e.target) && e.target!==searchInput){ acMenu.style.display='none'; }});
clearSearch.addEventListener('click', ()=>{ searchInput.value=''; acMenu.style.display='none'; renderSongs(); });

// ====== By Person (partial match + clickable sort) ======
function getAllPlayers(){
  const names = [];
  songs.forEach(s=>{ (s.parts||[]).forEach(p=>{ const val=(p.player||'').trim(); if(!val) return; val.split(/[,/&]+/).map(x=>x.trim()).filter(Boolean).forEach(n=> names.push(n)); }); });
  return Array.from(new Set(names)).sort((a,b)=> collator.compare(a,b));
}
function renderPersonResults(name){
  personTableBody.innerHTML='';
  if(!name){ personEmpty.style.display='block'; return; }
  const needle = name.toLowerCase(); const rows=[];
  songs.forEach(s=>{ (s.parts||[]).forEach(p=>{ const txt=(p.player||'').trim(); if(!txt) return; const tokens = txt.split(/[,/&]+/).map(x=>x.trim()).filter(Boolean); const match = tokens.some(t=> t.toLowerCase().includes(needle)); if(match){ rows.push({ title:s.title, artist:s.artist, version:s.version||'', part:p.label, ref:p.ref||'', misc:p.misc||'' }); } }); });
  rows.sort((a,b)=>{ const k=personSort.key; const dir = personSort.dir==='asc'?1:-1; return dir*collator.compare((a[k]||''),(b[k]||'')); });
  if(rows.length===0){ personEmpty.style.display='block'; return; }
  personEmpty.style.display='none';
  rows.forEach(r=>{ const tr=document.createElement('tr'); const linkA=r.ref?`<a href="${r.ref}" target="_blank" rel="noopener">열기</a>`:'<span class="muted">-</span>'; const linkB=r.misc?`<a href="${r.misc}" target="_blank" rel="noopener">열기</a>`:'<span class="muted">-</span>'; tr.innerHTML = `<td>${r.title}</td><td>${r.artist}</td><td>${r.version}</td><td>${r.part}</td><td>${linkA}</td><td>${linkB}</td>`; personTableBody.appendChild(tr); });
}
function openPersonDlg(){ personInput.value=''; personAcMenu.style.display='none'; renderPersonResults(''); updatePersonHeader(); personDlg.showModal(); setTimeout(()=> personInput.focus(), 50); }
byPersonBtn.addEventListener('click', openPersonDlg);
closePersonDlg.addEventListener('click', ()=> personDlg.close());
personInput.addEventListener('input', ()=>{ const q=personInput.value.trim().toLowerCase(); const all=getAllPlayers(); let cand=all; if(q) cand=all.filter(n=> n.toLowerCase().includes(q)); cand=cand.slice(0,8); if(cand.length===0){ personAcMenu.style.display='none'; personAcMenu.innerHTML=''; return; } personAcMenu.innerHTML = cand.map(v=> `<div class="ac-item" data-value="${v.replaceAll('"','&quot;')}">${v}</div>`).join(''); personAcMenu.style.display='block'; });
personAcMenu.addEventListener('click', (e)=>{ const item=e.target.closest('.ac-item'); if(!item) return; personInput.value=item.dataset.value||''; personAcMenu.style.display='none'; renderPersonResults(personInput.value.trim()); });
personClear.addEventListener('click', ()=>{ personInput.value=''; personAcMenu.style.display='none'; renderPersonResults(''); });
document.addEventListener('click', (e)=>{ if(personDlg.open && !personAcMenu.contains(e.target) && e.target!==personInput){ personAcMenu.style.display='none'; }});

// ====== BOARD ======
let posts = read(LS_POSTS, []); // {id,title,body,author,createdAt,updatedAt,comments?}
posts = posts.map(p=> ({ ...p, comments: Array.isArray(p.comments) ? p.comments : [] }));
write(LS_POSTS, posts);

const boardTableBody = document.querySelector('#boardTable tbody');
const boardEmpty = document.getElementById('boardEmpty');
const postNewBtn = document.getElementById('postNewBtn');

const postDlg = document.getElementById('postDlg');
const postForm = document.getElementById('postForm');
const postDlgTitle = document.getElementById('postDlgTitle');
const closePostDlg = document.getElementById('closePostDlg');
const cancelPostBtn = document.getElementById('cancelPostBtn');
const postTitle = document.getElementById('postTitle');
const postBody = document.getElementById('postBody');

const postViewDlg = document.getElementById('postViewDlg');
const postViewTitle = document.getElementById('postViewTitle');
const postMeta = document.getElementById('postMeta');
const postViewBody = document.getElementById('postViewBody');
const postViewActions = document.getElementById('postViewActions');
const commentsWrap = document.getElementById('commentsWrap');
const commentBody = document.getElementById('commentBody');
const addCommentBtn = document.getElementById('addCommentBtn');
const cancelCommentBtn = document.getElementById('cancelCommentBtn');
const closePostViewDlg = document.getElementById('closePostViewDlg');

let editingPostId = null;
let viewingPostId = null;

function renderBoard(){
  const rows = posts.slice().sort((a,b)=> b.createdAt - a.createdAt);
  boardTableBody.innerHTML='';
  if(rows.length===0){ boardEmpty.style.display='block'; return; }
  boardEmpty.style.display='none';
  rows.forEach((p,idx)=>{
    const tr=document.createElement('tr');
    const canEdit = session && (session.name==='admin' || session.name===p.author);
    const titleBtn = `<button class='btn ghost' data-act='open' style='padding:0;color:var(--accent)'>${p.title}</button>`;
    tr.innerHTML = `<td>${idx+1}</td><td>${titleBtn}</td><td>${p.author}</td><td>${fmtDate(p.createdAt)}</td><td>${canEdit?'<button class="btn" data-act="edit">편집</button> <button class="btn danger" data-act="del">삭제</button>':''}</td>`;
    tr.querySelector('[data-act=open]')?.addEventListener('click', ()=> openViewPost(p.id));
    tr.querySelector('[data-act=edit]')?.addEventListener('click', ()=> openEditPost(p.id));
    tr.querySelector('[data-act=del]')?.addEventListener('click', ()=> deletePost(p.id));
    boardTableBody.appendChild(tr);
  });
}

function openNewPost(){ editingPostId=null; postDlgTitle.textContent='글쓰기'; postTitle.value=''; postBody.value=''; postDlg.showModal(); setTimeout(()=> postTitle.focus(), 50); }
function openEditPost(id){ const p=posts.find(x=>x.id===id); if(!p) return; editingPostId=id; postDlgTitle.textContent='글 수정'; postTitle.value=p.title; postBody.value=p.body; postDlg.showModal(); setTimeout(()=> postTitle.focus(), 50); }
function deletePost(id){
  const p = posts.find(x=>x.id===id); if(!p) return;
  if(!confirm('이 글을 삭제할까요?')) return; posts = posts.filter(x=>x.id!==id); write(LS_POSTS, posts); renderBoard(); addLog('post_deleted', {title:p.title, author:p.author});
}

postNewBtn.addEventListener('click', ()=>{ if(!session){ alert('로그인이 필요합니다.'); return; } openNewPost(); });
postForm.addEventListener('submit', (e)=>{ e.preventDefault(); if(!session){ alert('로그인이 필요합니다.'); return; } const title=postTitle.value.trim(); const body=postBody.value.trim(); if(!title){ alert('제목을 입력하세요.'); return;} if(!body){ alert('내용을 입력하세요.'); return; } if(editingPostId){ posts = posts.map(p=> p.id===editingPostId ? { ...p, title, body, updatedAt: Date.now() } : p); addLog('post_edited', {id: editingPostId, title}); } else { posts.push({ id: uid(), title, body, author: session.name, createdAt: Date.now(), updatedAt: Date.now(), comments: [] }); addLog('post_added', {title}); } write(LS_POSTS, posts); postDlg.close(); renderBoard(); });
[closePostDlg, cancelPostBtn].forEach(b=> b.addEventListener('click', ()=> postDlg.close()));

function openViewPost(id){
  const p = posts.find(x=>x.id===id); if(!p) return; viewingPostId=id;
  postViewTitle.textContent = p.title; postViewBody.textContent = p.body; postMeta.textContent = `${p.author} · ${fmtDate(p.createdAt)}`;
  // viewer actions
  postViewActions.innerHTML='';
  if(session && (session.name==='admin' || session.name===p.author)){
    const eBtn=document.createElement('button'); eBtn.className='btn'; eBtn.textContent='편집'; eBtn.addEventListener('click', ()=>{ postViewDlg.close(); openEditPost(id); });
    const dBtn=document.createElement('button'); dBtn.className='btn danger'; dBtn.textContent='삭제'; dBtn.addEventListener('click', ()=>{ if(confirm('이 글을 삭제할까요?')){ deletePost(id); postViewDlg.close(); } });
    postViewActions.appendChild(eBtn); postViewActions.appendChild(dBtn);
  }
  renderComments();
  commentBody.value='';
  postViewDlg.showModal();
}
closePostViewDlg.addEventListener('click', ()=> postViewDlg.close());

function renderComments(){
  commentsWrap.innerHTML='';
  const p = posts.find(x=>x.id===viewingPostId); if(!p) return;
  const items = (p.comments||[]).slice().sort((a,b)=> a.createdAt - b.createdAt);
  if(items.length===0){
    const empty = document.createElement('div'); empty.className='empty'; empty.textContent='댓글이 아직 없습니다.'; commentsWrap.appendChild(empty); return;
  }
  items.forEach(c=>{
    const div=document.createElement('div'); div.className='comment';
    const head=document.createElement('div'); head.className='commentHead';
    head.innerHTML = `<div class='muted'>${c.author} · ${fmtDate(c.createdAt)}</div>`;
    if(session && (session.name==='admin' || session.name===c.author)){
      const actions=document.createElement('div');
      const eb=document.createElement('button'); eb.className='btn'; eb.textContent='편집'; eb.addEventListener('click', ()=> editComment(c.id));
      const db=document.createElement('button'); db.className='btn danger'; db.textContent='삭제'; db.addEventListener('click', ()=> deleteComment(c.id));
      actions.appendChild(eb); actions.appendChild(db); head.appendChild(actions);
    }
    const body=document.createElement('div'); body.style.whiteSpace='pre-wrap'; body.style.marginTop='6px'; body.textContent=c.body;
    div.appendChild(head); div.appendChild(body);
    commentsWrap.appendChild(div);
  });
}

function addComment(){
  if(!session){ alert('로그인이 필요합니다.'); return; }
  const text = commentBody.value.trim(); if(!text){ alert('댓글 내용을 입력하세요.'); return; }
  const p = posts.find(x=>x.id===viewingPostId); if(!p) return;
  p.comments = Array.isArray(p.comments) ? p.comments : [];
  p.comments.push({ id: uid(), body: text, author: session.name, createdAt: Date.now() });
  write(LS_POSTS, posts);
  commentBody.value='';
  renderComments();
}
function editComment(cid){
  const p = posts.find(x=>x.id===viewingPostId); if(!p) return;
  const c = (p.comments||[]).find(x=>x.id===cid); if(!c) return;
  const text = prompt('댓글 수정', c.body);
  if(text===null) return;
  c.body = text.trim();
  write(LS_POSTS, posts);
  renderComments();
}
function deleteComment(cid){
  const p = posts.find(x=>x.id===viewingPostId); if(!p) return;
  const c = (p.comments||[]).find(x=>x.id===cid); if(!c) return;
  if(!confirm('이 댓글을 삭제할까요?')) return;
  p.comments = (p.comments||[]).filter(x=>x.id!==cid);
  write(LS_POSTS, posts);
  renderComments();
  addLog('comment_deleted', {postTitle:p.title, commentAuthor:c.author});
}
addCommentBtn.addEventListener('click', addComment);
cancelCommentBtn.addEventListener('click', ()=> commentBody.value='');

// ====== Admin: Approvals ======
const signupTableBody = document.querySelector('#signupTable tbody');
const signupEmpty = document.getElementById('signupEmpty');

function renderApprovals(){
  signupTableBody.innerHTML='';
  if(!signups.length){ signupEmpty.style.display='block'; return; }
  signupEmpty.style.display='none';
  signups.slice().sort((a,b)=> a.createdAt-b.createdAt).forEach(s=>{
    const tr=document.createElement('tr');
    const part = s.part==='직접입력' ? (s.partCustom||'직접입력') : s.part;
    tr.innerHTML = `<td>${s.name}</td><td>${s.dept||''}</td><td>${part}</td><td>${fmtDate(s.createdAt)}</td><td><button class='btn' data-act='ok'>승인</button> <button class='btn danger' data-act='no'>거절</button></td>`;
    tr.querySelector('[data-act=ok]').addEventListener('click', async ()=>{
      if(users.some(u=> u.name===s.name)) { alert('이미 같은 이름의 계정이 존재합니다.'); return; }
      users.push({ id: uid(), name:s.name, hash:s.hash, dept:s.dept||'', part:s.part, partCustom:s.partCustom||'', createdAt: Date.now() });
      write(LS_USERS, users);
      signups = signups.filter(x=> x!==s); write(LS_SIGNUPS, signups);
      addLog('signup_approved', {name:s.name, dept:s.dept, part:(s.part==='직접입력'?(s.partCustom||s.part):s.part)});
      renderApprovals(); renderUsers();
    });
    tr.querySelector('[data-act=no]')?.addEventListener('click', ()=>{ signups = signups.filter(x=> x!==s); write(LS_SIGNUPS, signups); addLog('signup_rejected', {name:s.name}); renderApprovals(); });
    signupTableBody.appendChild(tr);
  });
}

// ====== Admin: Users (add/edit/delete/reset) ======
const usersTableBody = document.querySelector('#usersTable tbody');
const usersEmpty = document.getElementById('usersEmpty');
const userAddBtn = document.getElementById('userAddBtn');

const userDlg = document.getElementById('userDlg');
const userForm = document.getElementById('userForm');
const userDlgTitle = document.getElementById('userDlgTitle');
const closeUserDlg = document.getElementById('closeUserDlg');
const cancelUserBtn = document.getElementById('cancelUserBtn');
const udName = document.getElementById('udName');
const udPw = document.getElementById('udPw');
const udDept = document.getElementById('udDept');
const udPart = document.getElementById('udPart');
const udPartCustomWrap = document.getElementById('udPartCustomWrap');
const udPartCustom = document.getElementById('udPartCustom');

let editingUserId = null; // null => add, else edit

function renderUsers(){
  usersTableBody.innerHTML='';
  const data = users.slice().sort((a,b)=> collator.compare(a.name,b.name));
  if(data.length===0){ usersEmpty.style.display='block'; return; }
  usersEmpty.style.display='none';
  data.forEach(u=>{
    const part = u.part==='직접입력' ? (u.partCustom||'직접입력') : u.part;
    const tr=document.createElement('tr');
    const isAdmin = (u.name==='admin');
    const mgmt = isAdmin? '<span class="muted">(관리자)</span>' : `<button class='btn' data-act='edit'>수정</button> <button class='btn' data-act='reset'>비번 초기화</button> <button class='btn danger' data-act='del'>삭제</button>`;
    tr.innerHTML = `<td>${u.name}</td><td>${u.dept||''}</td><td>${part||''}</td><td>${fmtDate(u.createdAt)}</td><td>${mgmt}</td>`;
    if(!isAdmin){
      tr.querySelector('[data-act=edit]')?.addEventListener('click', ()=> openEditUser(u.id));
      tr.querySelector('[data-act=reset]')?.addEventListener('click', ()=> resetPassword(u.id));
      tr.querySelector('[data-act=del]')?.addEventListener('click', ()=> deleteUser(u.id));
    }
    usersTableBody.appendChild(tr);
  });
}

function openAddUser(){
  editingUserId = null;
  userDlgTitle.textContent='사용자 추가';
  udName.value=''; udPw.value=''; udDept.value=''; udPart.value='일렉기타'; udPartCustom.value=''; udPartCustomWrap.style.display='none';
  document.getElementById('udPwHint').textContent='(새 사용자: 필수 / 수정 시 비워두면 유지)';
  userDlg.showModal();
}
function openEditUser(id){
  const u = users.find(x=>x.id===id); if(!u) return;
  editingUserId = id;
  userDlgTitle.textContent='사용자 수정';
  udName.value=u.name; udPw.value=''; udDept.value=u.dept||''; udPart.value=u.part||'일렉기타'; udPartCustom.value=u.partCustom||''; udPartCustomWrap.style.display = (udPart.value==='직접입력') ? 'block' : 'none';
  document.getElementById('udPwHint').textContent='(비워두면 비밀번호 변경 없음)';
  userDlg.showModal();
}

function resetPassword(uidx){
  const u = users.find(x=>x.id===uidx); if(!u) return;
  if(u.name==='admin'){ alert('관리자 계정 비밀번호는 이 화면에서 변경할 수 없습니다. (현재: 1111)'); return; }
  const pw = prompt(`새 비밀번호를 입력하세요 (사용자: ${u.name})`);
  if(pw===null || pw==='') return;
  hashHex(pw).then(h=>{ u.hash = h; write(LS_USERS, users); addLog('password_reset', {name:u.name}); alert('비밀번호가 초기화되었습니다.'); });
}
function deleteUser(uidx){
  const u = users.find(x=>x.id===uidx); if(!u) return;
  if(u.name==='admin'){ alert('관리자 계정은 삭제할 수 없습니다.'); return; }
  if(!confirm(`${u.name} 계정을 삭제할까요?`)) return;
  users = users.filter(x=> x.id!==uidx); write(LS_USERS, users); renderUsers(); addLog('user_deleted', {name:u.name});
  if(session && session.name===u.name){ alert('삭제된 계정으로 로그인되어 있어 로그아웃됩니다.'); session=null; localStorage.removeItem(LS_SESSION); location.reload(); }
}

userAddBtn.addEventListener('click', openAddUser);
udPart.addEventListener('change', ()=>{ udPartCustomWrap.style.display = (udPart.value==='직접입력') ? 'block' : 'none'; });
userForm.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const name=udName.value.trim(); const pw=udPw.value; const dept=udDept.value.trim(); const part=udPart.value; const partCustom=udPartCustom.value.trim();
  if(!name){ alert('이름을 입력하세요.'); return; }
  if(part==='직접입력' && !partCustom){ alert('담당 파트를 직접 입력하세요.'); return; }
  if(editingUserId){
    const u = users.find(x=>x.id===editingUserId); if(!u) return;
    if(name!==u.name && users.some(x=>x.name===name)){ alert('이미 존재하는 이름입니다.'); return; }
    const oldName = u.name;
    u.name = name; u.dept = dept; u.part = part; u.partCustom = partCustom;
    if(pw){ u.hash = await hashHex(pw); }
    write(LS_USERS, users); renderUsers(); userDlg.close(); addLog('user_edited', {oldName, newName:name});
    if(session && session.name===oldName){ session.name = name; write(LS_SESSION, session); renderUserBar(); }
  } else {
    if(!pw){ alert('새 사용자 비밀번호를 입력하세요.'); return; }
    if(users.some(u=> u.name===name)) { alert('이미 존재하는 이름입니다.'); return; }
    const hash = await hashHex(pw);
    users.push({ id: uid(), name, hash, dept, part, partCustom, createdAt: Date.now() }); write(LS_USERS, users);
    userDlg.close(); renderUsers(); addLog('user_added', {name});
  }
});
[closeUserDlg, cancelUserBtn].forEach(b=> b.addEventListener('click', ()=> userDlg.close()));

// ====== Admin Logs ======
const logsTableBody = document.querySelector('#logsTable tbody');
const logsEmpty = document.getElementById('logsEmpty');
const logsClearBtn = document.getElementById('logsClearBtn');
const logsExportBtn = document.getElementById('logsExportBtn');

function friendly(action, meta){
  switch(action){
    case 'bootstrap_admin': return '관리자 계정 초기 생성';
    case 'signup_approved': return `가입 승인: ${meta.name}`;
    case 'signup_rejected': return `가입 거절: ${meta.name}`;
    case 'signup_auto_approved': return `가입 자동 승인: ${meta.name}`;
    case 'user_added': return `사용자 추가: ${meta.name}`;
    case 'user_edited': return `사용자 수정: ${meta.oldName} → ${meta.newName}`;
    case 'user_deleted': return `사용자 삭제: ${meta.name}`;
    case 'password_reset': return `비번 초기화: ${meta.name}`;
    case 'self_edited': return `내 정보 수정: ${meta.oldName} → ${meta.newName}`;
    case 'self_password_changed': return `내 비밀번호 변경`;
    case 'song_added': return `곡 추가: ${meta.title} / ${meta.artist}`;
    case 'song_edited': return `곡 수정: ${meta.title} / ${meta.artist}`;
    case 'song_deleted': return `곡 삭제: ${meta.title} / ${meta.artist}`;
    case 'post_added': return `글 등록: ${meta.title}`;
    case 'post_edited': return `글 수정: ${meta.title}`;
    case 'post_deleted': return `글 삭제: ${meta.title}`;
    case 'comment_deleted': return `댓글 삭제: ${meta.postTitle}`;
    default: return action;
  }
}

function renderLogs(){
  logsTableBody.innerHTML='';
  const data = logs.slice(0,300); // show latest 300
  if(data.length===0){ logsEmpty.style.display='block'; return; }
  logsEmpty.style.display='none';
  data.forEach(l=>{
    const tr=document.createElement('tr');
    const detail = JSON.stringify(l.meta||{}, null, 0);
    tr.innerHTML = `<td>${fmtDate(l.ts)}</td><td>${l.actor||'-'}</td><td>${friendly(l.action,l.meta)}</td><td><code style="white-space:pre-wrap">${detail}</code></td>`;
    logsTableBody.appendChild(tr);
  });
}

logsClearBtn.addEventListener('click', ()=>{ if(!confirm('모든 로그를 비울까요?')) return; logs=[]; write(LS_LOGS, logs); renderLogs(); });
logsExportBtn.addEventListener('click', ()=>{
  const blob = new Blob([JSON.stringify(logs,null,2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download='kish_admin_logs.json'; a.click(); URL.revokeObjectURL(url);
});

// ====== Tabs ======
function showTab(id){
  document.querySelectorAll('#appScreen section[id^=tab-]').forEach(sec=> sec.style.display='none');
  document.getElementById('tab-'+id).style.display='block';
  document.querySelectorAll('#mainTabs .tab').forEach(t=> t.classList.remove('active'));
  document.querySelector(`#mainTabs .tab[data-tab="${id}"]`).classList.add('active');
  if(id==='playlist'){ renderSongs(); }
  if(id==='board'){ renderBoard(); }
  if(id==='admin'){ renderApprovals(); renderUsers(); renderLogs(); }
}
mainTabs.addEventListener('click', (e)=>{ const b=e.target.closest('.tab'); if(!b) return; const id=b.dataset.tab; showTab(id); });

// ====== AUTH Handlers ======
tabLogin.addEventListener('click', ()=>{ tabLogin.classList.add('active'); tabSignup.classList.remove('active'); loginPane.style.display='block'; signupPane.style.display='none'; });
tabSignup.addEventListener('click', ()=>{ tabSignup.classList.add('active'); tabLogin.classList.remove('active'); loginPane.style.display='none'; signupPane.style.display='block'; });

suPart.addEventListener('change', ()=>{ suPartCustomWrap.style.display = (suPart.value==='직접입력') ? 'block' : 'none'; });

// (변경) 회원가입 → 자동 승인 등록 후 로그인 탭으로
signupBtn.addEventListener('click', async ()=>{
  const name=suName.value.trim(); const pw=suPw.value; const pw2=suPw2.value; const dept=suDept.value.trim(); const part=suPart.value; const partCustom=suPartCustom.value.trim();
  if(!name||!pw||!pw2){ alert('이름/비밀번호를 입력하세요.'); return; }
  if(pw!==pw2){ alert('비밀번호가 일치하지 않습니다.'); return; }
  if(part==='직접입력' && !partCustom){ alert('담당 파트를 직접 입력하세요.'); return; }
  if(users.some(u=> u.name===name)) { alert('이미 등록된 이름입니다.'); return; }
  if(signups.some(s=> s.name===name)) { alert('이미 신청 대기 중인 이름입니다.'); return; }
  const hash = await hashHex(pw);
  users.push({ id: uid(), name, hash, dept, part, partCustom, createdAt: Date.now() });
  write(LS_USERS, users);
  addLog('signup_auto_approved', {name, dept, part: (part==='직접입력'?(partCustom||part):part)});
  alert('회원가입이 완료되었습니다. 로그인 화면으로 이동합니다.');
  // reset + switch to login
  suName.value=''; suPw.value=''; suPw2.value=''; suDept.value=''; suPart.value='일렉기타'; suPartCustom.value=''; suPartCustomWrap.style.display='none';
  tabLogin.classList.add('active'); tabSignup.classList.remove('active');
  loginPane.style.display='block'; signupPane.style.display='none';
  loginName.value = name; loginPw.value = '';
  setTimeout(()=> loginPw.focus(), 50);
});

loginBtn.addEventListener('click', async ()=>{
  const name=loginName.value.trim(); const pw=loginPw.value; if(!name||!pw){ alert('이름/비밀번호를 입력하세요.'); return; }
  if(name==='admin'){
    if(pw==='1111'){ session={name}; write(LS_SESSION, session); enterApp(); }
    else alert('관리자 비밀번호가 올바르지 않습니다.');
    return;
  }
  const user = users.find(u=> u.name===name);
  if(!user){
    if(signups.some(s=> s.name===name)) alert('승인 대기 중입니다. 관리자 승인을 기다려주세요.'); else alert('등록된 사용자가 아닙니다. 회원가입 후 승인을 받으세요.');
    return;
  }
  const hash = await hashHex(pw);
  if(hash!==user.hash){ alert('비밀번호가 올바르지 않습니다.'); return; }
  session={name}; write(LS_SESSION, session); enterApp();
});

// Quick init/reset & Enter-to-login
const initBtn = document.getElementById('initBtn');
if(initBtn){
  initBtn.addEventListener('click', ()=>{
    if(!confirm('로컬 저장소의 데이터를 초기화할까요? (곡/사용자/게시글/로그/세션)')) return;
    try{
      [LS_SONGS,LS_USERS,LS_SIGNUPS,LS_POSTS,LS_SESSION,LS_LOGS].forEach(k=> localStorage.removeItem(k));
    }catch(e){}
    alert('초기화 완료. 페이지를 새로고침합니다.');
    location.reload();
  });
}
[loginName, loginPw].forEach(el=> el && el.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ loginBtn.click(); }}));

// ====== Profile (self-edit) ======
const profileDlg = document.getElementById('profileDlg');
const profileForm = document.getElementById('profileForm');
const closeProfileDlg = document.getElementById('closeProfileDlg');
const pfName = document.getElementById('pfName');
const pfDept = document.getElementById('pfDept');
const pfPart = document.getElementById('pfPart');
const pfPartCustomWrap = document.getElementById('pfPartCustomWrap');
const pfPartCustom = document.getElementById('pfPartCustom');
const pfCurPw = document.getElementById('pfCurPw');
const pfNewPw = document.getElementById('pfNewPw');
const pfNewPw2 = document.getElementById('pfNewPw2');

function openProfile(){
  if(!session){ alert('로그인이 필요합니다.'); return; }
  const u = users.find(x=> x.name===session.name);
  if(!u){ alert('세션 오류: 사용자를 찾을 수 없습니다.'); return; }
  const isAdmin = (u.name==='admin');
  pfName.value = u.name;
  pfDept.value = u.dept||'';
  pfPart.value = u.part||'일렉기타';
  pfPartCustom.value = u.partCustom||'';
  pfPartCustomWrap.style.display = (pfPart.value==='직접입력') ? 'block':'none';
  pfCurPw.value=''; pfNewPw.value=''; pfNewPw2.value='';
  pfName.disabled = isAdmin;
  pfCurPw.disabled = isAdmin; pfNewPw.disabled = isAdmin; pfNewPw2.disabled = isAdmin;
  document.getElementById('pfPwHint').textContent = isAdmin ? '(관리자는 여기서 비밀번호를 변경할 수 없습니다. 기본값: 1111)' : '(비밀번호 변경 시에만 입력)';
  profileDlg.showModal();
  setTimeout(()=> pfName.focus(), 50);
}

pfPart.addEventListener('change', ()=>{ pfPartCustomWrap.style.display = (pfPart.value==='직접입력') ? 'block' : 'none'; });
profileForm.addEventListener('submit', async (e)=>{
  e.preventDefault();
  if(!session) return;
  const u = users.find(x=> x.name===session.name); if(!u) return;
  const isAdmin = (u.name==='admin');
  const name = pfName.value.trim();
  const dept = pfDept.value.trim();
  const part = pfPart.value;
  const partCustom = pfPartCustom.value.trim();
  if(part==='직접입력' && !partCustom){ alert('담당 파트를 직접 입력하세요.'); return; }
  if(!isAdmin && name!==u.name && users.some(x=> x.name===name)){ alert('이미 존재하는 이름입니다.'); return; }
  const oldName = u.name;
  if(!isAdmin) u.name = name;
  u.dept = dept; u.part = part; u.partCustom = partCustom;

  const cur = pfCurPw.value; const n1 = pfNewPw.value; const n2 = pfNewPw2.value;
  if(n1 || n2 || cur){
    if(isAdmin){ alert('관리자 비밀번호는 이 화면에서 변경할 수 없습니다.'); }
    else {
      if(!cur){ alert('현재 비밀번호를 입력하세요.'); return; }
      const curHash = await hashHex(cur);
      if(curHash !== u.hash){ alert('현재 비밀번호가 일치하지 않습니다.'); return; }
      if(!n1){ alert('새 비밀번호를 입력하세요.'); return; }
      if(n1 !== n2){ alert('새 비밀번호가 일치하지 않습니다.'); return; }
      u.hash = await hashHex(n1);
      addLog('self_password_changed', {name: u.name});
    }
  }
  write(LS_USERS, users);
  if(session && session.name===oldName && !isAdmin){ session.name = u.name; write(LS_SESSION, session); renderUserBar(); }
  addLog('self_edited', {oldName, newName: u.name});
  profileDlg.close();
  if(document.querySelector('#tab-admin').style.display!=='none'){ renderUsers(); }
});
[closeProfileDlg].forEach(b=> b.addEventListener('click', ()=> profileDlg.close()));

// ====== Enter App ======
function enterApp(){
  authScreen.style.display='none'; appScreen.style.display='block';
  renderUserBar();
  adminTab.style.display = (session && session.name==='admin') ? 'inline-flex' : 'none';
  showTab('playlist');
}

// Auto-login if session exists
if(session){ enterApp(); }
