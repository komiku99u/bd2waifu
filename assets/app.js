import { WAIFU_IDS } from '../data/waifu-ids.js';

const state = {
  characters: [],
  byId: new Map(),
  selected: [],
  costumeByCharacter: new Map(),
  lang: 'en'
};

const $ = (s) => document.querySelector(s);
const grid = $('#characterGrid');
const strip = $('#selectionStrip');
const countEl = $('#selectedCount');
const generateBtn = $('#generateBtn');
const customizeBtn = $('#customizeBtn');
const searchInput = $('#searchInput');
const elementFilter = $('#elementFilter');
const costumeModal = $('#costumeModal');
const resultModal = $('#resultModal');
const costumeList = $('#costumeList');
const resultCanvas = $('#resultCanvas');

const i18n = {
  en: {
    eyebrow:'YOUR WAIFU. YOUR STORY.', heroTitle:'The 9 Waifu<br>That Shaped<br>Who I Am', heroCopy:'Old favorites. Unforgettable characters. Bring your nine waifu together in one image to save and share.', chooseBtn:'Choose my 9 waifu <span>→</span>', rankingLink:'Explore the rankings ↗', exampleCaption:'Nine waifu. A little piece of you.', chooseEyebrow:'MAKE YOUR LIST', chooseTitle:'Choose your 9 waifu', searchPlaceholder:'Search waifu...', customizeBtn:'Customize costumes', generateBtn:'Generate my 9 waifu →', popularTitle:'Popular waifu', period:'Based on community selections'
  },
  jp: {
    eyebrow:'あなたの推し。あなたの物語。', heroTitle:'私を形作った<br>9人のワイフ', heroCopy:'忘れられないキャラクターたち。あなたの9人のワイフを1枚の画像にまとめて保存・シェアしよう。', chooseBtn:'9人のワイフを選ぶ <span>→</span>', rankingLink:'ランキングを見る ↗', exampleCaption:'9人のワイフ。あなたの一部。', chooseEyebrow:'リストを作る', chooseTitle:'9人のワイフを選ぶ', searchPlaceholder:'ワイフを検索...', customizeBtn:'衣装を選ぶ', generateBtn:'9人のワイフを生成 →', popularTitle:'人気のワイフ', period:'みんなの選択を集計'
  }
};

async function init() {
  const data = await fetch('./data/master-data.json').then(r => r.json());
  state.characters = data.characters.filter(c => WAIFU_IDS.includes(c.id));
  state.byId = new Map(state.characters.map(c => [c.id, c]));
  seedExample();
  restoreFromUrl();
  bindEvents();
  renderAll();
  loadPopular();
}

function imageSrc(url) {
  return `/api/image?url=${encodeURIComponent(url)}`;
}

function seedExample() {
  const ids = ['justia','eclipse','rubia','sylvia','angelica','helena','refithea','venaka','wilhelmina'];
  const examples = ids.map(id => state.byId.get(id)).filter(Boolean);
  $('#exampleGrid').innerHTML = examples.map(c => `<img loading="lazy" src="${esc(imageSrc(c.costumes?.[0]?.image || c.image))}" alt="${esc(c.name)}">`).join('');
}

function bindEvents() {
  searchInput.addEventListener('input', renderCharacters);
  elementFilter.addEventListener('change', renderCharacters);
  generateBtn.addEventListener('click', generateResult);
  customizeBtn.addEventListener('click', openCustomize);
  document.querySelectorAll('[data-close-modal]').forEach(el => el.addEventListener('click', closeCostume));
  $('#closeResult').addEventListener('click', () => resultModal.classList.add('hidden'));
  $('#downloadBtn').addEventListener('click', downloadResult);
  $('#shareBtn').addEventListener('click', shareResult);
  $('#copyBtn').addEventListener('click', copyShareLink);
  document.querySelectorAll('.lang').forEach(btn => btn.addEventListener('click', () => setLanguage(btn.dataset.lang)));
  window.addEventListener('popstate', restoreFromUrl);
}

function setLanguage(lang) {
  state.lang = lang === 'jp' ? 'jp' : 'en';
  document.documentElement.lang = state.lang === 'jp' ? 'ja' : 'en';
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (i18n[state.lang][key]) el.innerHTML = i18n[state.lang][key];
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => el.placeholder = i18n[state.lang][el.dataset.i18nPlaceholder]);
  document.querySelectorAll('.lang').forEach(b => b.classList.toggle('active', b.dataset.lang === state.lang));
}

function renderAll() {
  renderCharacters();
  renderSelection();
  updateActions();
}

function renderCharacters() {
  const q = searchInput.value.trim().toLowerCase();
  const element = elementFilter.value;
  const filtered = state.characters.filter(c => {
    const matchName = c.name.toLowerCase().includes(q);
    const matchElement = element === 'all' || c.element === element;
    return matchName && matchElement;
  });
  grid.innerHTML = filtered.map(c => {
    const selected = state.selected.includes(c.id);
    const img = c.costumes?.[0]?.image || c.image;
    return `<button class="character-card ${selected ? 'selected' : ''}" data-id="${esc(c.id)}" aria-pressed="${selected}">
      <img loading="lazy" src="${esc(imageSrc(img))}" alt="${esc(c.name)}" onerror="this.style.opacity='0'">
      <span class="character-name">${esc(c.name)}</span>
    </button>`;
  }).join('') || '<p class="muted">No waifu found.</p>';
  grid.querySelectorAll('.character-card').forEach(card => card.addEventListener('click', () => toggleCharacter(card.dataset.id)));
}

function toggleCharacter(id) {
  if (state.selected.includes(id)) {
    state.selected = state.selected.filter(x => x !== id);
  } else {
    if (state.selected.length >= 9) return;
    state.selected.push(id);
    const c = state.byId.get(id);
    if (c && c.costumes?.length && !state.costumeByCharacter.has(id)) state.costumeByCharacter.set(id, c.costumes[0].id);
  }
  renderAll();
}

function renderSelection() {
  countEl.textContent = state.selected.length;
  strip.innerHTML = state.selected.map((id, i) => {
    const c = state.byId.get(id); if (!c) return '';
    const costume = selectedCostume(c);
    return `<div class="slot" data-slot-id="${esc(id)}" title="${esc(c.name)}">
      <img src="${esc(imageSrc(costume?.image || c.image))}" alt="${esc(c.name)}">
      <span>${i + 1}</span>
    </div>`;
  }).join('');
  for (let i = state.selected.length; i < 9; i++) strip.insertAdjacentHTML('beforeend', `<div class="slot empty"><span>+</span></div>`);
  strip.querySelectorAll('.slot[data-slot-id]').forEach(slot => slot.addEventListener('click', () => openCostume(slot.dataset.slotId)));
}

function updateActions() {
  const ready = state.selected.length === 9;
  generateBtn.disabled = !ready;
  customizeBtn.disabled = state.selected.length === 0;
}

function openCustomize() {
  if (!state.selected.length) return;
  openCostume(state.selected[0]);
}

function openCostume(id) {
  const c = state.byId.get(id); if (!c) return;
  $('#costumeTitle').textContent = c.name;
  const costumes = c.costumes?.length ? c.costumes : [{id:`${c.id}_default`,name:'Default',image:c.image}];
  costumeList.innerHTML = costumes.map(co => {
    const active = state.costumeByCharacter.get(id) === co.id;
    return `<button class="costume-option ${active ? 'active' : ''}" data-costume="${esc(co.id)}" data-character="${esc(id)}">
      <img loading="lazy" src="${esc(imageSrc(co.image))}" alt="${esc(co.name)}"><span>${esc(co.name)}</span>
    </button>`;
  }).join('');
  costumeList.querySelectorAll('.costume-option').forEach(btn => btn.addEventListener('click', () => {
    state.costumeByCharacter.set(id, btn.dataset.costume);
    renderSelection();
    openCostume(id);
  }));
  costumeModal.classList.remove('hidden');
}

function closeCostume() { costumeModal.classList.add('hidden'); }

function selectedCostume(c) {
  const id = state.costumeByCharacter.get(c.id);
  return c.costumes?.find(co => co.id === id) || c.costumes?.[0] || null;
}

function makeShareUrl() {
  const set = state.selected.map(id => `${id}:${state.costumeByCharacter.get(id) || ''}`).join(',');
  const url = new URL(location.href);
  url.search = '';
  url.hash = `set=${encodeURIComponent(set)}`;
  return url.toString();
}

function restoreFromUrl() {
  const raw = new URL(location.href).hash.startsWith('#set=') ? new URL(location.href).hash.slice(5) : new URL(location.href).searchParams.get('set');
  if (!raw) return;
  try {
    const decoded = decodeURIComponent(raw);
    const pairs = decoded.split(',').filter(Boolean);
    state.selected = [];
    state.costumeByCharacter.clear();
    for (const pair of pairs) {
      const [id, costumeId] = pair.split(':');
      if (!state.byId.has(id) || state.selected.includes(id) || state.selected.length >= 9) continue;
      state.selected.push(id);
      const c = state.byId.get(id);
      const valid = c.costumes?.some(co => co.id === costumeId);
      state.costumeByCharacter.set(id, valid ? costumeId : (c.costumes?.[0]?.id || ''));
    }
    renderAll();
  } catch {}
}

async function generateResult() {
  if (state.selected.length !== 9) return;
  closeCostume();
  resultModal.classList.remove('hidden');
  $('#shareStatus').textContent = 'Generating image…';
  await drawResult();
  $('#shareStatus').textContent = '';
  history.replaceState(null, '', makeShareUrl());
  fetch('/api/popular', {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({waifuIds:state.selected})}).catch(()=>{});
  loadPopular();
}

async function drawResult() {
  const ctx = resultCanvas.getContext('2d');
  const W = resultCanvas.width, H = resultCanvas.height;
  ctx.fillStyle = '#f4f5e9'; ctx.fillRect(0,0,W,H);
  ctx.fillStyle = '#173b31'; ctx.textAlign = 'center';
  ctx.font = '900 54px Arial, sans-serif'; ctx.fillText('MY 9 WAIFU', W/2, 74);
  ctx.font = '700 21px Arial, sans-serif'; ctx.fillStyle = '#68796d'; ctx.fillText('THE CHARACTERS THAT SHAPED MY STORY', W/2, 108);

  const margin=42, gap=14, top=135, tileW=(W-margin*2-gap*2)/3, tileH=tileW*(4/3);
  for (let i=0;i<9;i++) {
    const c=state.byId.get(state.selected[i]);
    const co=selectedCostume(c);
    const x=margin+(i%3)*(tileW+gap), y=top+Math.floor(i/3)*(tileH+gap);
    ctx.save();
    roundRect(ctx,x,y,tileW,tileH,16); ctx.clip();
    ctx.fillStyle='#e5e9de'; ctx.fillRect(x,y,tileW,tileH);
    try {
      const img=await loadImage(co?.image || c.image);
      drawCover(ctx,img,x,y,tileW,tileH);
    } catch {
      ctx.fillStyle='#dfe5db'; ctx.fillRect(x,y,tileW,tileH);
      ctx.fillStyle='#5b6c62'; ctx.font='700 20px Arial'; ctx.textAlign='center'; ctx.fillText(c.name,x+tileW/2,y+tileH/2);
    }
    const grad=ctx.createLinearGradient(0,y+tileH-130,0,y+tileH); grad.addColorStop(0,'rgba(0,0,0,0)'); grad.addColorStop(1,'rgba(0,0,0,.78)'); ctx.fillStyle=grad; ctx.fillRect(x,y,tileW,tileH);
    ctx.restore();

    // Decorative frame around every waifu card. The double-line frame,
    // corner ornaments and small center marks make the generated sheet
    // feel more like a finished collectible card instead of a plain grid.
    drawCardFrame(ctx,x,y,tileW,tileH);
    drawNamePlate(ctx,x,y,tileW,tileH,c.name);
  }

  // Subtle outer frame for the whole poster.
  ctx.save();
  ctx.strokeStyle='#214b3d';
  ctx.lineWidth=3;
  roundRect(ctx,18,18,W-36,H-36,24);
  ctx.stroke();
  ctx.strokeStyle='rgba(60,124,100,.38)';
  ctx.lineWidth=1;
  roundRect(ctx,27,27,W-54,H-54,18);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle='#6a786d'; ctx.textAlign='center'; ctx.font='600 16px Arial'; ctx.fillText('my9waifu · make your own list',W/2,H-28);
}

function drawCardFrame(ctx,x,y,w,h){
  const outer=6;
  const inner=12;
  const r=16;
  const color='#f3d26b';
  const dark='#214b3d';

  ctx.save();

  // Dark green backing gives the frame enough contrast over bright artwork.
  ctx.strokeStyle=dark;
  ctx.lineWidth=7;
  roundRect(ctx,x+outer/2,y+outer/2,w-outer,h-outer,r+2);
  ctx.stroke();

  // Main warm-gold double border.
  ctx.strokeStyle=color;
  ctx.lineWidth=2.5;
  roundRect(ctx,x+outer+2,y+outer+2,w-(outer+2)*2,h-(outer+2)*2,r);
  ctx.stroke();

  ctx.strokeStyle='rgba(243,210,107,.72)';
  ctx.lineWidth=1;
  roundRect(ctx,x+inner,y+inner,w-inner*2,h-inner*2,10);
  ctx.stroke();

  // Corner ornaments.
  const len=Math.min(34,w*.12);
  const pad=inner+5;
  ctx.strokeStyle=color;
  ctx.lineWidth=2;
  ctx.lineCap='round';

  function corner(cx,cy,dx,dy){
    ctx.beginPath();
    ctx.moveTo(cx,cy+dy*len);
    ctx.lineTo(cx,cy);
    ctx.lineTo(cx+dx*len,cy);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx+dx*8,cy+dy*8,4,0,Math.PI*2);
    ctx.stroke();
  }

  corner(x+pad,y+pad,1,1);
  corner(x+w-pad,y+pad,-1,1);
  corner(x+pad,y+h-pad,1,-1);
  corner(x+w-pad,y+h-pad,-1,-1);

  // Small diamond marks centered on the top and bottom edges.
  drawDiamond(ctx,x+w/2,y+pad-1,5,color);
  drawDiamond(ctx,x+w/2,y+h-pad+1,5,color);

  ctx.restore();
}


function drawNamePlate(ctx,x,y,w,h,name){
  const plateW = Math.min(w-34, 260);
  const plateH = 42;
  const px = x + (w-plateW)/2;
  const py = y + h - plateH - 15;
  const r = 11;
  const dark = '#214b3d';
  const gold = '#f3d26b';

  ctx.save();

  // Soft dark backing keeps the name readable over any artwork.
  ctx.fillStyle = 'rgba(20,34,29,.84)';
  roundRect(ctx,px,py,plateW,plateH,r);
  ctx.fill();

  // Ornate double border.
  ctx.strokeStyle = dark;
  ctx.lineWidth = 3;
  roundRect(ctx,px,py,plateW,plateH,r);
  ctx.stroke();

  ctx.strokeStyle = gold;
  ctx.lineWidth = 1.6;
  roundRect(ctx,px+4,py+4,plateW-8,plateH-8,7);
  ctx.stroke();

  // Small diamond ornaments on both sides.
  drawDiamond(ctx,px+12,py+plateH/2,3,gold);
  drawDiamond(ctx,px+plateW-12,py+plateH/2,3,gold);

  ctx.fillStyle='#fff';
  ctx.textAlign='center';
  ctx.textBaseline='middle';
  ctx.font='900 19px Arial, sans-serif';
  fitTextCentered(ctx,name,px+plateW/2,py+plateH/2,plateW-34,19);

  ctx.restore();
}

function fitTextCentered(ctx,text,x,y,maxWidth,fontSize){
  let s=text;
  while(ctx.measureText(s).width>maxWidth && s.length>3){
    s=s.slice(0,-4)+'…';
  }
  ctx.fillText(s,x,y);
}

function drawDiamond(ctx,cx,cy,size,color){
  ctx.save();
  ctx.strokeStyle=color;
  ctx.lineWidth=1.5;
  ctx.beginPath();
  ctx.moveTo(cx,cy-size);
  ctx.lineTo(cx+size,cy);
  ctx.lineTo(cx,cy+size);
  ctx.lineTo(cx-size,cy);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function roundRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath()}
function drawCover(ctx,img,x,y,w,h){const iw=img.naturalWidth||img.width,ih=img.naturalHeight||img.height;const scale=Math.max(w/iw,h/ih);const nw=iw*scale,nh=ih*scale;ctx.drawImage(img,x+(w-nw)/2,y+(h-nh)/2,nw,nh)}
function fitText(ctx,text,x,y,maxWidth,fontSize){let s=text;while(ctx.measureText(s).width>maxWidth&&s.length>3)s=s.slice(0,-4)+'…';ctx.fillText(s,x,y)}

function loadImage(url){
  return new Promise((resolve,reject)=>{
    const img=new Image();
    img.crossOrigin='anonymous';
    const timer=setTimeout(()=>{ img.src=''; reject(new Error('Image timeout')); },12000);
    img.onload=()=>{ clearTimeout(timer); resolve(img); };
    img.onerror=()=>{ clearTimeout(timer); reject(new Error('Image failed')); };
    img.src=imageSrc(url);
  });
}

function downloadResult(){const a=document.createElement('a');a.download='my-9-waifu.png';a.href=resultCanvas.toDataURL('image/png');a.click()}
async function shareResult(){const url=makeShareUrl();if(navigator.share){try{await navigator.share({title:'My 9 Waifu',text:'My 9 Waifu',url})}catch{}}else copyText(url)}
async function copyShareLink(){const url=makeShareUrl();await copyText(url);$('#shareStatus').textContent='Share link copied!'}
async function copyText(t){try{await navigator.clipboard.writeText(t)}catch{const ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove()}}

async function loadPopular(){
  const box=$('#popularList');
  try{
    const r=await fetch('/api/popular'); if(!r.ok) throw new Error();
    const rows=await r.json();
    if(!rows.length){box.innerHTML='<p class="muted">No selections yet. Be the first to create the ranking.</p>';return}
    box.innerHTML=rows.map((row,i)=>{const c=state.byId.get(row.waifu_id);if(!c)return '';const img=c.costumes?.[0]?.image||c.image;return `<div class="popular-row"><div class="rank ${i<3?'top':''}">${i+1}</div><img loading="lazy" src="${esc(imageSrc(img))}" alt="${esc(c.name)}" onerror="this.style.opacity='0'"><div class="popular-name">${esc(c.name)}</div><div class="votes">${Number(row.vote_count||0).toLocaleString()} picks</div></div>`}).join('')||'<p class="muted">No selections yet.</p>';
  }catch{box.innerHTML='<p class="muted">Popularity will appear after Cloudflare D1 is connected.</p>'}
}

function esc(value){return String(value??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]))}

init().catch(err=>{console.error(err);document.body.innerHTML='<div style="padding:30px;font-family:system-ui">Could not load master data.</div>'});
