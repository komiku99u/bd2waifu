const state = {
  characters: [],
  byId: new Map(),
  selected: [],
  costumeByCharacter: new Map(),
  openCostumeId: null,
  lang: 'en'
};

const $ = (s) => document.querySelector(s);
const grid = $('#characterGrid');
const strip = $('#selectionStrip');
const countEl = $('#selectedCount');
const generateBtn = $('#generateBtn');
const searchInput = $('#searchInput');
const elementFilter = $('#elementFilter');
const resultModal = $('#resultModal');
const resultCanvas = $('#resultCanvas');

const i18n = {
  en: {
    chooseEyebrow:'MAKE YOUR LIST', chooseTitle:'Choose your 9 waifu', searchPlaceholder:'Search waifu...', generateBtn:'Generate my 9 waifu →', noCostume:'No costume available', chooseCostume:'Choose costume', hideCostume:'Hide costumes'
  },
  jp: {
    chooseEyebrow:'リストを作る', chooseTitle:'9人のワイフを選ぶ', searchPlaceholder:'ワイフを検索...', generateBtn:'9人のワイフを生成 →', noCostume:'衣装なし', chooseCostume:'衣装を選ぶ', hideCostume:'衣装を閉じる'
  }
};

async function init() {
  const data = await fetch('./data/master-data.json').then(r => r.json());
  // Deliberately use the complete master data: every character is selectable.
  state.characters = data.characters;
  state.byId = new Map(state.characters.map(c => [c.id, c]));
  restoreFromUrl();
  bindEvents();
  renderAll();
}

function imageSrc(url) {
  return `/api/image?url=${encodeURIComponent(url)}`;
}

function bindEvents() {
  searchInput.addEventListener('input', renderCharacters);
  elementFilter.addEventListener('change', renderCharacters);
  generateBtn.addEventListener('click', generateResult);
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
  renderCharacters();
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
    const costumes = Array.isArray(c.costumes) ? c.costumes : [];
    const open = state.openCostumeId === c.id && costumes.length > 0;
    const current = selectedCostume(c);
    return `<article class="character-card ${selected ? 'selected' : ''}" data-id="${esc(c.id)}">
      <button class="character-main" type="button" aria-pressed="${selected}" aria-label="${selected ? 'Remove ' : 'Select '}${esc(c.name)}">
        <img loading="lazy" src="${esc(imageSrc(current?.image || c.image))}" alt="${esc(c.name)}" onerror="this.style.opacity='0'">
        <span class="character-name">${esc(c.name)}</span>
      </button>
      ${costumes.length ? `<button class="costume-trigger" type="button" data-costume-toggle="${esc(c.id)}">${open ? i18n[state.lang].hideCostume : i18n[state.lang].chooseCostume}<span>⌄</span></button>
      <div class="inline-costumes ${open ? '' : 'hidden'}">
        ${costumes.map(co => `<button class="costume-option-inline ${current?.id === co.id ? 'active' : ''}" type="button" data-costume-id="${esc(co.id)}" data-character-id="${esc(c.id)}">
          <img loading="lazy" src="${esc(imageSrc(co.image))}" alt="${esc(co.name)}">
          <span>${esc(co.name)}</span>
        </button>`).join('')}
      </div>` : `<div class="no-costume">${i18n[state.lang].noCostume}</div>`}
    </article>`;
  }).join('') || '<p class="muted">No character found.</p>';

  grid.querySelectorAll('.character-main').forEach(btn => btn.addEventListener('click', () => {
    const id = btn.closest('.character-card').dataset.id;
    toggleCharacter(id);
  }));
  grid.querySelectorAll('[data-costume-toggle]').forEach(btn => btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const id = btn.dataset.costumeToggle;
    state.openCostumeId = state.openCostumeId === id ? null : id;
    renderCharacters();
  }));
  grid.querySelectorAll('[data-costume-id]').forEach(btn => btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const id = btn.dataset.characterId;
    state.costumeByCharacter.set(id, btn.dataset.costumeId);
    state.openCostumeId = id;
    renderCharacters();
    renderSelection();
  }));
}

function toggleCharacter(id) {
  if (state.selected.includes(id)) {
    state.selected = state.selected.filter(x => x !== id);
    state.costumeByCharacter.delete(id);
    if (state.openCostumeId === id) state.openCostumeId = null;
  } else {
    if (state.selected.length >= 9) return;
    state.selected.push(id);
    const c = state.byId.get(id);
    if (c?.costumes?.length && !state.costumeByCharacter.has(id)) state.costumeByCharacter.set(id, c.costumes[0].id);
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
  strip.querySelectorAll('.slot[data-slot-id]').forEach(slot => slot.addEventListener('click', () => {
    state.openCostumeId = slot.dataset.slotId;
    renderCharacters();
    const card = grid.querySelector(`[data-id="${CSS.escape(slot.dataset.slotId)}"]`);
    card?.scrollIntoView({behavior:'smooth',block:'center'});
  }));
}

function updateActions() {
  generateBtn.disabled = state.selected.length !== 9;
}

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
  const current = new URL(location.href);
  const raw = current.hash.startsWith('#set=') ? current.hash.slice(5) : current.searchParams.get('set');
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
  } catch {}
}

async function generateResult() {
  if (state.selected.length !== 9) return;
  resultModal.classList.remove('hidden');
  $('#shareStatus').textContent = 'Generating image…';
  await drawResult();
  $('#shareStatus').textContent = '';
  history.replaceState(null, '', makeShareUrl());
  fetch('/api/popular', {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({waifuIds:state.selected})}).catch(()=>{});
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

function esc(value){return String(value??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]))}

init().catch(err=>{console.error(err);document.body.innerHTML='<div style="padding:30px;font-family:system-ui">Could not load master data.</div>'});
