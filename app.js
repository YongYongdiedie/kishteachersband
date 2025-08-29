// Cloud version using Firebase Auth + Firestore
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.1/firebase-app.js';
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, signOut, sendPasswordResetEmail, updateProfile
} from 'https://www.gstatic.com/firebasejs/10.12.1/firebase-auth.js';
import {
  getFirestore, collection, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc,
  onSnapshot, serverTimestamp, query, where, orderBy, getDocs
} from 'https://www.gstatic.com/firebasejs/10.12.1/firebase-firestore.js';
import { FIREBASE_CONFIG, ADMIN_EMAIL } from './firebase-config.js';

// ====== Init Firebase ======
const app = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);
const db = getFirestore(app);

// ====== Utils & State ======
const collator = new Intl.Collator('ko', { sensitivity: 'base', numeric: true });
const fmtDate = (t)=>{
  if(!t) return '';
  const d = t.toDate ? t.toDate() : new Date(t);
  const pad = n=> String(n).padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const uid = ()=> 'id-'+Math.random().toString(36).slice(2)+Date.now().toString(36);

// DOM
const userBar = document.getElementById('userBar');
const authScreen = document.getElementById('authScreen');
const appScreen = document.getElementById('appScreen');

const tabLogin = document.getElementById('tabLogin');
const tabSignup = document.getElementById('tabSignup');
const loginPane = document.getElementById('loginPane');
const signupPane = document.getElementById('signupPane');

const loginEmail = document.getElementById('loginEmail');
const loginPw = document.getElementById('loginPw');
const loginBtn = document.getElementById('loginBtn');

const suName = document.getElementById('suName');
const suEmail = document.getElementById('suEmail');
const suPw = document.getElementById('suPw');
const suPw2 = document.getElementById('suPw2');
const suDept = document.getElementById('suDept');
const suPart = document.getElementById('suPart');
const suPartCustomWrap = document.getElementById('suPartCustomWrap');
const suPartCustom = document.getElementById('suPartCustom');
const signupBtn = document.getElementById('signupBtn');

const mainTabs = document.getElementById('mainTabs');
const adminTab = document.getElementById('adminTab');

// Playlist
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

// By person
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

// Board
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

// Admin
const signupTableBody = document.querySelector('#signupTable tbody');
const signupEmpty = document.getElementById('signupEmpty');
const usersTableBody = document.querySelector('#usersTable tbody');
const usersEmpty = document.getElementById('usersEmpty');

// State
let currentUser = null;
let currentUserDoc = null;
let isAdmin = false;
let songs = [];
let posts = [];
let unsubscribers = [];

// Default parts
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
const uniqueKey = (base, used)=>{ let k = base; let i=2; while(used.has(k)) k = base+'-'+(i++); return k; };
const cloneDefaults = ()=> DEFAULT_PARTS.map(p=> ({ key:p.key, label:p.label, player:'', ref:'', misc:'', builtin:true }));

// ====== Tabs & Header ======
function showTab(id){
  document.querySelectorAll('#appScreen section[id^=tab-]').forEach(sec=> sec.style.display='none');
  document.getElementById('tab-'+id).style.display='block';
  document.querySelectorAll('#mainTabs .tab').forEach(t=> t.classList.remove('active'));
  document.querySelector(`#mainTabs .tab[data-tab="${id}"]`).classList.add('active');
  if(id==='playlist'){ renderSongs(); }
  if(id==='board'){ renderBoard(); }
  if(id==='admin'){ renderApprovals(); renderUsers(); }
}
mainTabs.addEventListener('click', (e)=>{ const b=e.target.closest('.tab'); if(!b) return; const id=b.dataset.tab; showTab(id); });

function renderUserBar(){
  if(!currentUser || !currentUserDoc){ userBar.style.display='none'; return; }
  userBar.style.display='flex';
  userBar.innerHTML='';
  const span=document.createElement('div'); span.className='muted';
  span.textContent = `${currentUserDoc.name||'(이름없음)'}님` + (isAdmin?' (관리자)':'');
  const profileBtn=document.createElement('button'); profileBtn.className='btn'; profileBtn.textContent='내 정보';
  profileBtn.addEventListener('click', ()=> openSelfProfile());
  const logout=document.createElement('button'); logout.className='btn ghost'; logout.textContent='로그아웃';
  logout.addEventListener('click', ()=> signOut(auth));
  userBar.appendChild(span); userBar.appendChild(profileBtn); userBar.appendChild(logout);
}

// ====== Auth UI ======
tabLogin.addEventListener('click', ()=>{ tabLogin.classList.add('active'); tabSignup.classList.remove('active'); loginPane.style.display='block'; signupPane.style.display='none'; });
tabSignup.addEventListener('click', ()=>{ tabSignup.classList.add('active'); tabLogin.classList.remove('active'); loginPane.style.display='none'; signupPane.style.display='block'; });
suPart.addEventListener('change', ()=>{ suPartCustomWrap.style.display = (suPart.value==='직접입력') ? 'block':'none'; });

signupBtn.addEventListener('click', async ()=>{
  const name = suName.value.trim();
  const email = suEmail.value.trim();
  const pw = suPw.value; const pw2=suPw2.value;
  const dept = suDept.value.trim(); const part = suPart.value; const partCustom = suPartCustom.value.trim();
  if(!name||!email||!pw||!pw2){ alert('이름/이메일/비밀번호를 입력하세요.'); return; }
  if(pw!==pw2){ alert('비밀번호가 일치하지 않습니다.'); return; }
  try{
    const cred = await createUserWithEmailAndPassword(auth, email, pw);
    await updateProfile(cred.user, { displayName: name });
    // Create user doc (approved: false)
    const uref = doc(db,'users', cred.user.uid);
    await setDoc(uref, {
      name, email, dept, part, partCustom, role: (email===ADMIN_EMAIL?'admin':'member'),
      approved: (email===ADMIN_EMAIL), createdAt: serverTimestamp()
    });
    alert('회원가입이 완료되었습니다. '+(email===ADMIN_EMAIL?'관리자 계정은 바로 사용 가능합니다.':'관리자 승인 후 이용할 수 있습니다.'));
    // if not admin, sign out to prevent access before approval
    if(email !== ADMIN_EMAIL){ await signOut(auth); tabLogin.click(); loginEmail.value = email; loginPw.value=''; }
  }catch(e){
    console.error(e); alert('회원가입 실패: '+(e.message||e));
  }
});

loginBtn.addEventListener('click', async ()=>{
  const email=loginEmail.value.trim(); const pw=loginPw.value;
  if(!email||!pw){ alert('이메일과 비밀번호를 입력하세요.'); return; }
  try{
    await signInWithEmailAndPassword(auth, email, pw);
  }catch(e){
    console.error(e); alert('로그인 실패: '+(e.message||e));
  }
});

// ====== Auth State ======
onAuthStateChanged(auth, async (user)=>{
  currentUser = user;
  // Clear old listeners
  unsubscribers.forEach(u=>{ try{u();}catch(e){} }); unsubscribers=[];

  if(!user){
    // show auth screen
    authScreen.style.display='block'; appScreen.style.display='none';
    userBar.style.display='none';
    return;
  }
  // Load user doc
  const uref = doc(db,'users', user.uid);
  const snap = await getDoc(uref);
  if(!snap.exists()){
    // create minimal doc; require approval unless admin email
    await setDoc(uref, { name: user.displayName||'', email: user.email, role: (user.email===ADMIN_EMAIL?'admin':'member'), approved: (user.email===ADMIN_EMAIL), createdAt: serverTimestamp() });
    currentUserDoc = { ...snap.data(), role: (user.email===ADMIN_EMAIL?'admin':'member'), approved: (user.email===ADMIN_EMAIL) };
  }else{
    currentUserDoc = snap.data();
  }
  // Check approval
  if(!currentUserDoc.approved){
    alert('승인 대기 중입니다. 관리자 승인을 받으면 이용할 수 있어요.');
    await signOut(auth);
    return;
  }
  // Admin?
  isAdmin = (currentUserDoc.role==='admin' || (user.email===ADMIN_EMAIL));
  adminTab.style.display = isAdmin ? 'inline-flex' : 'none';

  // Setup real-time listeners
  listenSongs();
  listenPosts();

  // Show app
  authScreen.style.display='none'; appScreen.style.display='block';
  renderUserBar();
  showTab('playlist');
});

// ====== Songs (Firestore) ======
function listenSongs(){
  const qref = collection(db,'songs');
  const unsub = onSnapshot(qref, (snap)=>{
    songs = snap.docs.map(d=> ({ id:d.id, ...d.data() }));
    renderSongs();
  });
  unsubscribers.push(unsub);
}

function renderSongs(){
  const q = (searchInput.value||'').trim().toLowerCase();
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
    if(isAdmin){
      const editBtn = document.createElement('button'); editBtn.className='btn'; editBtn.textContent='편집'; editBtn.addEventListener('click', ()=> openEditSong(s.id));
      const delBtn = document.createElement('button'); delBtn.className='btn danger'; delBtn.textContent='삭제'; delBtn.addEventListener('click', ()=> deleteSong(s.id));
      btns.appendChild(editBtn); btns.appendChild(delBtn);
    }
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
addPartBtn?.addEventListener('click', ()=>{
  const name = prompt('추가할 파트 이름을 입력하세요'); if(!name) return;
  const base = slugify(name); const used = new Set(editingParts.map(p=>p.key)); const key = uniqueKey(base, used);
  editingParts.push({ key, label:name.trim(), player:'', ref:'', misc:'', builtin:false }); buildPartsEditor();
});
partsTbody?.addEventListener('click', (e)=>{ const btn=e.target.closest('.miniDel'); if(!btn) return; const key=btn.dataset.key; const idx=editingParts.findIndex(p=>p.key===key); if(idx>-1){ if(editingParts[idx].builtin){ alert('기본 파트는 삭제할 수 없습니다.'); return;} editingParts.splice(idx,1); buildPartsEditor(); }});

function openAddSong(){
  if(!isAdmin){ alert('관리자만 곡을 추가할 수 있습니다.'); return; }
  editingSongId = null;
  titleInput.value=''; artistInput.value=''; versionInput.value='';
  editingParts = cloneDefaults();
  buildPartsEditor();
  songDlg.showModal(); setTimeout(()=> titleInput.focus(), 50);
}
function openEditSong(id){
  if(!isAdmin){ return; }
  const s = songs.find(x=>x.id===id); if(!s) return;
  editingSongId = id;
  titleInput.value = s.title||''; artistInput.value=s.artist||''; versionInput.value=s.version||'';
  editingParts = (s.parts||[]).map(p=>({...p}));
  buildPartsEditor(); songDlg.showModal(); setTimeout(()=> titleInput.focus(), 50);
}
async function deleteSong(id){
  if(!isAdmin) return;
  if(!confirm('이 곡을 삭제할까요?')) return;
  await deleteDoc(doc(db,'songs', id));
}
songForm?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  if(!isAdmin){ alert('관리자만 저장 가능합니다.'); return; }
  const title = titleInput.value.trim(); const artist = artistInput.value.trim(); const version = versionInput.value.trim();
  if(!title||!artist){ alert('제목과 가수를 입력해주세요.'); return; }
  const parts = [];
  const map = new Map(editingParts.map(p=>[p.key,p]));
  partsTbody.querySelectorAll('input').forEach(inp=>{ const k=inp.dataset.key; const f=inp.dataset.field; if(k&&f&&map.has(k)){ map.get(k)[f] = inp.value.trim(); }});
  map.forEach(v=> parts.push(v));
  if(editingSongId){
    await updateDoc(doc(db,'songs', editingSongId), { title, artist, version, parts });
  }else{
    await addDoc(collection(db,'songs'), { title, artist, version, parts, createdAt: serverTimestamp(), createdBy: currentUser.uid });
  }
  songDlg.close();
});
[closeDlg, cancelBtn].forEach(b=> b?.addEventListener('click', ()=> songDlg.close()));
addBtn?.addEventListener('click', openAddSong);

// Search & autocomplete
let acTimer=null;
function updateAutocomplete(){
  const q = searchInput.value.trim().toLowerCase(); const field = searchField.value; if(!q){ acMenu.style.display='none'; acMenu.innerHTML=''; renderSongs(); return; }
  const candidates = songs.map(s=> s[field]||'').filter(Boolean).filter((v,i,arr)=> arr.indexOf(v)===i).filter(v=> v.toLowerCase().includes(q)).sort((a,b)=> collator.compare(a,b)).slice(0,8);
  if(candidates.length===0){ acMenu.style.display='none'; acMenu.innerHTML=''; renderSongs(); return; }
  acMenu.innerHTML = candidates.map(v=> `<div class="ac-item" data-value="${v.replaceAll('"','&quot;')}">${v}</div>`).join('');
  acMenu.style.display='block';
}
searchInput?.addEventListener('input', ()=>{ clearTimeout(acTimer); acTimer=setTimeout(()=>{ updateAutocomplete(); renderSongs(); }, 200); });
searchField?.addEventListener('change', ()=>{ updateAutocomplete(); renderSongs(); });
acMenu?.addEventListener('click', (e)=>{ const item=e.target.closest('.ac-item'); if(!item) return; searchInput.value=item.dataset.value||''; acMenu.style.display='none'; renderSongs(); });
document.addEventListener('click', (e)=>{ if(acMenu && !acMenu.contains(e.target) && e.target!==searchInput){ acMenu.style.display='none'; }});
clearSearch?.addEventListener('click', ()=>{ searchInput.value=''; acMenu.style.display='none'; renderSongs(); });

// By Person
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
personThead?.addEventListener('click', (e)=>{
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
byPersonBtn?.addEventListener('click', openPersonDlg);
closePersonDlg?.addEventListener('click', ()=> personDlg.close());
personInput?.addEventListener('input', ()=>{ const q=personInput.value.trim().toLowerCase(); const all=getAllPlayers(); let cand=all; if(q) cand=all.filter(n=> n.toLowerCase().includes(q)); cand=cand.slice(0,8); if(cand.length===0){ personAcMenu.style.display='none'; personAcMenu.innerHTML=''; return; } personAcMenu.innerHTML = cand.map(v=> `<div class="ac-item" data-value="${v.replaceAll('"','&quot;')}">${v}</div>`).join(''); personAcMenu.style.display='block'; });
personAcMenu?.addEventListener('click', (e)=>{ const item=e.target.closest('.ac-item'); if(!item) return; personInput.value=item.dataset.value||''; personAcMenu.style.display='none'; renderPersonResults(personInput.value.trim()); });
personClear?.addEventListener('click', ()=>{ personInput.value=''; personAcMenu.style.display='none'; renderPersonResults(''); });
document.addEventListener('click', (e)=>{ if(personDlg.open && !personAcMenu.contains(e.target) && e.target!==personInput){ personAcMenu.style.display='none'; }});

// ====== Board (Firestore) ======
function listenPosts(){
  const qref = query(collection(db,'posts'), orderBy('createdAt','desc'));
  const unsub = onSnapshot(qref, (snap)=>{
    posts = snap.docs.map(d=> ({ id:d.id, ...d.data() }));
    renderBoard();
  });
  unsubscribers.push(unsub);
}
function renderBoard(){
  boardTableBody.innerHTML='';
  if(!posts.length){ boardEmpty.style.display='block'; return; }
  boardEmpty.style.display='none';
  posts.forEach((p,idx)=>{
    const tr=document.createElement('tr');
    const canEdit = isAdmin || (currentUser && p.authorUid===currentUser.uid);
    const titleBtn = `<button class='btn ghost' data-act='open' style='padding:0;color:var(--accent)'>${p.title}</button>`;
    tr.innerHTML = `<td>${idx+1}</td><td>${titleBtn}</td><td>${p.authorName||'-'}</td><td>${fmtDate(p.createdAt)}</td><td>${canEdit?'<button class="btn" data-act="edit">편집</button> <button class="btn danger" data-act="del">삭제</button>':''}</td>`;
    tr.querySelector('[data-act=open]')?.addEventListener('click', ()=> openViewPost(p.id));
    tr.querySelector('[data-act=edit]')?.addEventListener('click', ()=> openEditPost(p.id));
    tr.querySelector('[data-act=del]')?.addEventListener('click', ()=> deletePost(p.id));
    boardTableBody.appendChild(tr);
  });
}
function openNewPost(){ postDlgTitle.textContent='글쓰기'; postTitle.value=''; postBody.value=''; postDlg.showModal(); setTimeout(()=> postTitle.focus(), 50); }
function openEditPost(id){ const p=posts.find(x=>x.id===id); if(!p) return; postDlgTitle.textContent='글 수정'; postTitle.value=p.title; postBody.value=p.body; postDlg.showModal(); setTimeout(()=> postTitle.focus(), 50); editingPostId=id; }
async function deletePost(id){
  if(!confirm('이 글을 삭제할까요?')) return;
  await deleteDoc(doc(db,'posts', id));
}

let editingPostId = null;
postNewBtn?.addEventListener('click', ()=>{ if(!currentUser){ alert('로그인이 필요합니다.'); return; } openNewPost(); });
postForm?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  if(!currentUser){ alert('로그인이 필요합니다.'); return; }
  const title=postTitle.value.trim(); const body=postBody.value.trim();
  if(!title || !body){ alert('제목/내용을 입력하세요.'); return; }
  if(editingPostId){
    await updateDoc(doc(db,'posts', editingPostId), { title, body });
    editingPostId=null;
  }else{
    await addDoc(collection(db,'posts'), { title, body, authorUid: currentUser.uid, authorName: currentUserDoc?.name || currentUser.email, createdAt: serverTimestamp() });
  }
  postDlg.close();
});
[closePostDlg, cancelPostBtn].forEach(b=> b?.addEventListener('click', ()=> postDlg.close()));

const closePostViewDlg2 = document.getElementById('closePostViewDlg');
closePostViewDlg2?.addEventListener('click', ()=> postViewDlg.close());

async function openViewPost(id){
  const pRef = doc(db,'posts', id);
  const pSnap = posts.find(x=>x.id===id);
  postViewTitle.textContent = pSnap?.title || '글 제목';
  postViewBody.textContent = pSnap?.body || '';
  postMeta.textContent = `${pSnap?.authorName||'-'} · ${fmtDate(pSnap?.createdAt)}`;
  const canEdit = isAdmin || (currentUser && pSnap?.authorUid===currentUser.uid);
  postViewActions.innerHTML='';
  if(canEdit){
    const eBtn=document.createElement('button'); eBtn.className='btn'; eBtn.textContent='편집'; eBtn.addEventListener('click', ()=>{ postViewDlg.close(); openEditPost(id); });
    const dBtn=document.createElement('button'); dBtn.className='btn danger'; dBtn.textContent='삭제'; dBtn.addEventListener('click', async ()=>{ if(confirm('이 글을 삭제할까요?')){ await deleteDoc(pRef); postViewDlg.close(); }});
    postViewActions.appendChild(eBtn); postViewActions.appendChild(dBtn);
  }
  // comments live
  commentsWrap.innerHTML='';
  const cRef = collection(db,'posts', id, 'comments');
  const unsub = onSnapshot(query(cRef, orderBy('createdAt','asc')), (snap)=>{
    commentsWrap.innerHTML='';
    if(snap.empty){
      const empty = document.createElement('div'); empty.className='empty'; empty.textContent='댓글이 아직 없습니다.'; commentsWrap.appendChild(empty);
      return;
    }
    snap.forEach(docc=>{
      const c=docc.data();
      const div=document.createElement('div'); div.className='comment';
      const head=document.createElement('div'); head.className='commentHead';
      head.innerHTML = `<div class='muted'>${c.authorName||'-'} · ${fmtDate(c.createdAt)}</div>`;
      if(isAdmin || (currentUser && c.authorUid===currentUser.uid)){
        const actions=document.createElement('div');
        const eb=document.createElement('button'); eb.className='btn'; eb.textContent='편집'; eb.addEventListener('click', async ()=>{ const text=prompt('댓글 수정', c.body||''); if(text===null) return; await updateDoc(doc(db,'posts',id,'comments',docc.id), { body: text }); });
        const dbtn=document.createElement('button'); dbtn.className='btn danger'; dbtn.textContent='삭제'; dbtn.addEventListener('click', async ()=>{ if(confirm('댓글 삭제할까요?')) await deleteDoc(doc(db,'posts',id,'comments',docc.id)); });
        actions.appendChild(eb); actions.appendChild(dbtn); head.appendChild(actions);
      }
      const body=document.createElement('div'); body.style.whiteSpace='pre-wrap'; body.style.marginTop='6px'; body.textContent=c.body||'';
      div.appendChild(head); div.appendChild(body);
      commentsWrap.appendChild(div);
    });
  });
  unsubscribers.push(unsub);
  addCommentBtn.onclick = async ()=>{
    const text = commentBody.value.trim(); if(!text){ alert('댓글 내용을 입력하세요.'); return; }
    await addDoc(cRef, { body: text, authorUid: currentUser.uid, authorName: currentUserDoc?.name || currentUser.email, createdAt: serverTimestamp() });
    commentBody.value='';
  };
  cancelCommentBtn.onclick = ()=> commentBody.value='';
  postViewDlg.showModal();
}

// ====== Admin ======
async function renderApprovals(){
  signupTableBody.innerHTML='';
  // pending = users where approved==false
  const qref = query(collection(db,'users'), where('approved','==', false));
  const snap = await getDocs(qref);
  if(snap.empty){ signupEmpty.style.display='block'; return; }
  signupEmpty.style.display='none';
  snap.forEach(docu=>{
    const u = { id: docu.id, ...docu.data() };
    const part = u.part==='직접입력' ? (u.partCustom||'직접입력') : u.part;
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${u.name||''}</td><td>${u.email||''}</td><td>${u.dept||''}</td><td>${part||''}</td><td>${fmtDate(u.createdAt)}</td><td><button class='btn' data-act='ok'>승인</button> <button class='btn danger' data-act='no'>거절</button></td>`;
    tr.querySelector('[data-act=ok]').addEventListener('click', async ()=>{
      await updateDoc(doc(db,'users', u.id), { approved: true });
      renderApprovals(); renderUsers();
    });
    tr.querySelector('[data-act=no]').addEventListener('click', async ()=>{
      await deleteDoc(doc(db,'users', u.id));
      renderApprovals(); renderUsers();
    });
    signupTableBody.appendChild(tr);
  });
}
async function renderUsers(){
  usersTableBody.innerHTML='';
  const qref = query(collection(db,'users'), orderBy('name'));
  const snap = await getDocs(qref);
  if(snap.empty){ usersEmpty.style.display='block'; return; }
  usersEmpty.style.display='none';
  snap.forEach(docu=>{
    const u = { id: docu.id, ...docu.data() };
    const part = u.part==='직접입력' ? (u.partCustom||'직접입력') : u.part;
    const tr=document.createElement('tr');
    const controls = document.createElement('td');
    controls.innerHTML = `
      <button class='btn' data-act='edit'>수정</button>
      <button class='btn' data-act='toggle'>${u.approved?'승인취소':'승인'}</button>
      <button class='btn' data-act='pw'>비번재설정</button>
      <button class='btn danger' data-act='del'>삭제</button>
    `;
    tr.innerHTML = `<td>${u.name||''}</td><td>${u.email||''}</td><td>${u.dept||''}</td><td>${part||''}</td><td>${u.role||'member'}</td>`;
    tr.appendChild(controls);
    controls.querySelector('[data-act=edit]').addEventListener('click', ()=> editUserDialog(u));
    controls.querySelector('[data-act=toggle]').addEventListener('click', async ()=>{ await updateDoc(doc(db,'users',u.id), { approved: !u.approved }); renderUsers(); });
    controls.querySelector('[data-act=pw]').addEventListener('click', async ()=>{ try{ await sendPasswordResetEmail(auth, u.email); alert('비밀번호 재설정 메일을 발송했습니다.'); } catch(e){ alert('발송 실패: '+e.message); } });
    controls.querySelector('[data-act=del]').addEventListener('click', async ()=>{ if(!confirm('사용자 문서를 삭제할까요? (Auth 계정은 유지)')) return; await deleteDoc(doc(db,'users',u.id)); renderUsers(); });
    usersTableBody.appendChild(tr);
  });
}
function editUserDialog(u){
  const dlg = document.createElement('dialog');
  dlg.innerHTML = `
    <form method="dialog">
      <div class="dlgHead"><div style="font-weight:800">사용자 수정</div><button class="btn" type="button" id="x">닫기</button></div>
      <div class="dlgBody">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="field"><label>이름</label><input id="n" value="${u.name||''}"></div>
          <div class="field"><label>부서</label><input id="d" value="${u.dept||''}"></div>
          <div class="field"><label>담당 파트</label>
            <select id="p">
              <option ${u.part==='일렉기타'?'selected':''}>일렉기타</option>
              <option ${u.part==='베이스기타'?'selected':''}>베이스기타</option>
              <option ${u.part==='보컬'?'selected':''}>보컬</option>
              <option ${u.part==='피아노'?'selected':''}>피아노</option>
              <option ${u.part==='신디사이저'?'selected':''}>신디사이저</option>
              <option ${u.part==='직접입력'?'selected':''}>직접입력</option>
            </select>
          </div>
          <div class="field" id="cw"><label>담당 파트(직접입력)</label><input id="pc" value="${u.partCustom||''}"></div>
          <div class="field"><label>권한</label>
            <select id="r">
              <option ${u.role==='member'?'selected':''} value="member">member</option>
              <option ${u.role==='admin'?'selected':''} value="admin">admin</option>
            </select>
          </div>
        </div>
      </div>
      <div class="dlgFoot">
        <button class="btn" type="button" id="cancel">취소</button>
        <button class="btn accent" type="submit">저장</button>
      </div>
    </form>`;
  document.body.appendChild(dlg);
  const pSel = dlg.querySelector('#p'); const cw=dlg.querySelector('#cw');
  const updateCW = ()=>{ cw.style.display = (pSel.value==='직접입력') ? 'block':'none'; };
  pSel.addEventListener('change', updateCW); updateCW();
  dlg.querySelector('#x').addEventListener('click', ()=> dlg.close());
  dlg.querySelector('#cancel').addEventListener('click', ()=> dlg.close());
  dlg.addEventListener('close', ()=> dlg.remove());
  dlg.addEventListener('submit', async (e)=>{
    e.preventDefault();
    await updateDoc(doc(db,'users',u.id), {
      name: dlg.querySelector('#n').value.trim(),
      dept: dlg.querySelector('#d').value.trim(),
      part: pSel.value,
      partCustom: dlg.querySelector('#pc').value.trim(),
      role: dlg.querySelector('#r').value
    });
    dlg.close();
    renderUsers();
  });
  dlg.showModal();
}

// ====== Profile (self) ======
function openSelfProfile(){
  const dlg = document.createElement('dialog');
  dlg.innerHTML = `
    <form method="dialog">
      <div class="dlgHead"><div style="font-weight:800">내 정보</div><button class="btn" type="button" id="x">닫기</button></div>
      <div class="dlgBody">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="field"><label>이름</label><input id="n" value="${currentUserDoc?.name||''}"></div>
          <div class="field"><label>부서</label><input id="d" value="${currentUserDoc?.dept||''}"></div>
          <div class="field"><label>담당 파트</label>
            <select id="p">
              <option ${currentUserDoc?.part==='일렉기타'?'selected':''}>일렉기타</option>
              <option ${currentUserDoc?.part==='베이스기타'?'selected':''}>베이스기타</option>
              <option ${currentUserDoc?.part==='보컬'?'selected':''}>보컬</option>
              <option ${currentUserDoc?.part==='피아노'?'selected':''}>피아노</option>
              <option ${currentUserDoc?.part==='신디사이저'?'selected':''}>신디사이저</option>
              <option ${currentUserDoc?.part==='직접입력'?'selected':''}>직접입력</option>
            </select>
          </div>
          <div class="field" id="cw"><label>담당 파트(직접입력)</label><input id="pc" value="${currentUserDoc?.partCustom||''}"></div>
        </div>
        <div class="card" style="margin-top:12px">
          <div class="field"><label>비밀번호 재설정</label>
            <button class="btn" type="button" id="pw">재설정 메일 보내기</button>
          </div>
        </div>
      </div>
      <div class="dlgFoot">
        <button class="btn" type="button" id="cancel">취소</button>
        <button class="btn accent" type="submit">저장</button>
      </div>
    </form>`;
  document.body.appendChild(dlg);
  const pSel = dlg.querySelector('#p'); const cw=dlg.querySelector('#cw');
  const updateCW = ()=>{ cw.style.display = (pSel.value==='직접입력') ? 'block':'none'; };
  pSel.addEventListener('change', updateCW); updateCW();
  dlg.querySelector('#x').addEventListener('click', ()=> dlg.close());
  dlg.querySelector('#cancel').addEventListener('click', ()=> dlg.close());
  dlg.addEventListener('close', ()=> dlg.remove());
  dlg.querySelector('#pw').addEventListener('click', async ()=>{
    try{ await sendPasswordResetEmail(auth, currentUser.email); alert('재설정 메일을 보냈습니다.'); }catch(e){ alert('실패: '+e.message); }
  });
  dlg.addEventListener('submit', async (e)=>{
    e.preventDefault();
    await updateDoc(doc(db,'users', currentUser.uid), {
      name: dlg.querySelector('#n').value.trim(),
      dept: dlg.querySelector('#d').value.trim(),
      part: pSel.value,
      partCustom: dlg.querySelector('#pc').value.trim()
    });
    dlg.close();
    // refresh
    const snap = await getDoc(doc(db,'users', currentUser.uid)); currentUserDoc = snap.data(); renderUserBar();
  });
  dlg.showModal();
}

// ====== Enter ======
function enterApp(){ authScreen.style.display='none'; appScreen.style.display='block'; renderUserBar(); showTab('playlist'); }

// initially show auth
authScreen.style.display='block'; appScreen.style.display='none';
