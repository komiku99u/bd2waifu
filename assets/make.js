const state = {
  characters: [],
  byId: new Map(),
  selected: [],
  costumeByCharacter: new Map(),
  openCostumeId: null,
  activeSlotIndex: null,
  lang: 'en'
};

const $ = (s) => document.querySelector(s);
const grid = $('#characterGrid');
const strip = $('#selectionStrip');
const characterModal = $('#characterModal');
const characterModalBackdrop = $('#characterModalBackdrop');
const closeCharacterModalBtn = $('#closeCharacterModal');
const countEl = $('#selectedCount');
const generateBtn = $('#generateBtn');
const searchInput = $('#searchInput');
const elementFilter = $('#elementFilter');
const resultModal = $('#resultModal');
const resultCanvas = $('#resultCanvas');
const costumeModal = $('#costumeModal');
const costumeModalTitle = $('#costumeModalTitle');
const costumeModalList = $('#costumeModalList');

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
  elementFilter.querySelectorAll('[data-element]').forEach(btn => btn.addEventListener('click', () => setElementFilter(btn.dataset.element)));
  updateElementFilterUI();
  generateBtn.addEventListener('click', generateResult);
  $('#closeResult').addEventListener('click', () => resultModal.classList.add('hidden'));
  $('#downloadBtn').addEventListener('click', downloadResult);
  $('#shareBtn').addEventListener('click', shareResult);
  $('#copyBtn').addEventListener('click', copyShareLink);
  $('#closeCostumeModal').addEventListener('click', closeCostumeModal);
  $('#costumeModalBackdrop').addEventListener('click', closeCostumeModal);
  closeCharacterModalBtn.addEventListener('click', closeCharacterModal);
  characterModalBackdrop.addEventListener('click', closeCharacterModal);
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!costumeModal.classList.contains('hidden')) closeCostumeModal();
    else if (!characterModal.classList.contains('hidden')) closeCharacterModal();
  });
  document.querySelectorAll('.lang').forEach(btn => btn.addEventListener('click', () => setLanguage(btn.dataset.lang)));
  window.addEventListener('popstate', restoreFromUrl);
}

function setElementFilter(element) {
  elementFilter.dataset.value = element;
  updateElementFilterUI();
  renderCharacters();
}

function updateElementFilterUI() {
  const active = elementFilter.dataset.value || 'all';
  elementFilter.querySelectorAll('[data-element]').forEach(btn => {
    const isActive = btn.dataset.element === active;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', String(isActive));
  });
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
  const element = elementFilter.dataset.value || 'all';
  const filtered = state.characters.filter(c => {
    const matchName = c.name.toLowerCase().includes(q);
    const matchElement = element === 'all' || c.element === element;
    return matchName && matchElement;
  });

  grid.innerHTML = filtered.map(c => {
    const selected = state.selected.includes(c.id);
    const costumes = Array.isArray(c.costumes) ? c.costumes : [];
    return `<article class="character-card ${selected ? 'selected' : ''}" data-id="${esc(c.id)}">
      <button class="character-main" type="button" aria-pressed="${selected}" aria-label="Select ${esc(c.name)}">
        <img loading="lazy" src="${esc(imageSrc(selectedCostume(c)?.image || c.image))}" alt="${esc(c.name)}" onerror="this.style.opacity='0'">
        <span class="character-name">${esc(c.name)}</span>
      </button>
      ${costumes.length ? `<button class="costume-trigger" type="button" data-costume-toggle="${esc(c.id)}">${i18n[state.lang].chooseCostume}<span>⌄</span></button>` : `<div class="no-costume">${i18n[state.lang].noCostume}</div>`}
    </article>`;
  }).join('') || '<p class="muted">No character found.</p>';

  grid.querySelectorAll('.character-main').forEach(btn => btn.addEventListener('click', () => {
    assignCharacterToSlot(btn.closest('.character-card').dataset.id);
  }));
  grid.querySelectorAll('[data-costume-toggle]').forEach(btn => btn.addEventListener('click', (e) => {
    e.stopPropagation();
    openCostumeModal(btn.dataset.costumeToggle);
  }));
}

function openCharacterModal(slotIndex) {
  state.activeSlotIndex = slotIndex;
  searchInput.value = '';
  setElementFilter('all');
  renderCharacters();
  characterModal.classList.remove('hidden');
  document.body.classList.add('modal-open');
  setTimeout(() => searchInput.focus(), 50);
}

function closeCharacterModal() {
  characterModal.classList.add('hidden');
  document.body.classList.remove('modal-open');
  state.activeSlotIndex = null;
}

function assignCharacterToSlot(id) {
  const index = state.activeSlotIndex;
  if (index === null || index === undefined) return;
  const existingIndex = state.selected.indexOf(id);
  if (existingIndex !== -1 && existingIndex !== index) {
    // Prevent duplicate characters.
    return;
  }
  const previous = state.selected[index];
  if (previous && previous !== id) state.costumeByCharacter.delete(previous);
  state.selected[index] = id;
  const c = state.byId.get(id);
  if (c?.costumes?.length) {
    if (!state.costumeByCharacter.has(id)) state.costumeByCharacter.set(id, c.costumes[0].id);
  } else {
    state.costumeByCharacter.delete(id);
  }
  closeCharacterModal();
  renderAll();
}

function openCostumeModal(characterId) {
  const c = state.byId.get(characterId);
  if (!c || !Array.isArray(c.costumes) || !c.costumes.length) return;

  state.openCostumeId = characterId;
  const current = selectedCostume(c);
  costumeModalTitle.textContent = `${c.name} — Choose costume`;
  costumeModalList.innerHTML = c.costumes.map(co => `<button class="costume-option ${current?.id === co.id ? 'active' : ''}" type="button" data-modal-costume-id="${esc(co.id)}" data-character-id="${esc(c.id)}">
    <img loading="lazy" src="${esc(imageSrc(co.image))}" alt="${esc(co.name)}">
    <span>${esc(co.name)}</span>
  </button>`).join('');

  costumeModal.classList.remove('hidden');
  document.body.classList.add('modal-open');

  costumeModalList.querySelectorAll('[data-modal-costume-id]').forEach(btn => btn.addEventListener('click', () => {
    state.costumeByCharacter.set(btn.dataset.characterId, btn.dataset.modalCostumeId);
    closeCostumeModal();
    renderCharacters();
    renderSelection();
  }));
}

function closeCostumeModal() {
  if (!costumeModal) return;
  costumeModal.classList.add('hidden');
  document.body.classList.remove('modal-open');
  state.openCostumeId = null;
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
  countEl.textContent = state.selected.filter(Boolean).length;
  strip.innerHTML = '';
  for (let i = 0; i < 9; i++) {
    const id = state.selected[i];
    if (id) {
      const c = state.byId.get(id);
      if (!c) continue;
      const costume = selectedCostume(c);
      strip.insertAdjacentHTML('beforeend', `<button class="slot filled" type="button" data-slot-index="${i}" title="${esc(c.name)}">
        <img src="${esc(imageSrc(costume?.image || c.image))}" alt="${esc(c.name)}">
        <span>${i + 1}</span>
      </button>`);
    } else {
      strip.insertAdjacentHTML('beforeend', `<button class="slot empty" type="button" data-slot-index="${i}" aria-label="Choose character for slot ${i + 1}"><span>+</span><small>${i + 1}</small></button>`);
    }
  }
  strip.querySelectorAll('[data-slot-index]').forEach(slot => slot.addEventListener('click', () => {
    openCharacterModal(Number(slot.dataset.slotIndex));
  }));
}

function updateActions() {
  generateBtn.disabled = state.selected.filter(Boolean).length !== 9 || state.selected.length < 9 || state.selected.some(id => !id);
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
  if (state.selected.filter(Boolean).length !== 9 || state.selected.length < 9 || state.selected.some(id => !id)) return;
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
