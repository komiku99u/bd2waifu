import { WAIFU_IDS } from '../data/waifu-ids.js';

const state = { characters: [], byId: new Map(), lang: 'en' };
const $ = (s) => document.querySelector(s);

const i18n = {
  en: { eyebrow:'YOUR WAIFU. YOUR STORY.', heroTitle:'The 9 Waifu<br>That Shaped<br>Who I Am', heroCopy:'Old favorites. Unforgettable characters. Bring your nine waifu together in one image to save and share.', chooseBtn:'Choose my 9 waifu <span>→</span>', rankingLink:'Explore the rankings ↗', exampleCaption:'Nine waifu. A little piece of you.', popularTitle:'Popular waifu', period:'Based on community selections' },
  jp: { eyebrow:'あなたの推し。あなたの物語。', heroTitle:'私を形作った<br>9人のワイフ', heroCopy:'忘れられないキャラクターたち。あなたの9人のワイフを1枚の画像にまとめて保存・シェアしよう。', chooseBtn:'9人のワイフを選ぶ <span>→</span>', rankingLink:'ランキングを見る ↗', exampleCaption:'9人のワイフ。あなたの一部。', popularTitle:'人気のワイフ', period:'みんなの選択を集計' }
};

async function init(){
  const data=await fetch('./data/master-data.json').then(r=>r.json());
  state.characters=data.characters.filter(c=>WAIFU_IDS.includes(c.id));
  state.byId=new Map(state.characters.map(c=>[c.id,c]));
  seedExample();
  bindEvents();
  loadPopular();
}

function imageSrc(url){return `/api/image?url=${encodeURIComponent(url)}`;}
function seedExample(){
  const ids=['justia','eclipse','rubia','sylvia','angelica','helena','refithea','venaka','wilhelmina'];
  const examples=ids.map(id=>state.byId.get(id)).filter(Boolean);
  $('#exampleGrid').innerHTML=examples.map(c=>`<img loading="lazy" src="${esc(imageSrc(c.costumes?.[0]?.image||c.image))}" alt="${esc(c.name)}">`).join('');
}
function bindEvents(){document.querySelectorAll('.lang').forEach(btn=>btn.addEventListener('click',()=>setLanguage(btn.dataset.lang)));}
function setLanguage(lang){
  state.lang=lang==='jp'?'jp':'en'; document.documentElement.lang=state.lang==='jp'?'ja':'en';
  document.querySelectorAll('[data-i18n]').forEach(el=>{const key=el.dataset.i18n;if(i18n[state.lang][key])el.innerHTML=i18n[state.lang][key];});
  document.querySelectorAll('.lang').forEach(b=>b.classList.toggle('active',b.dataset.lang===state.lang));
}
async function loadPopular(){
  const box=$('#popularList');
  try{
    const r=await fetch('/api/popular'); if(!r.ok)throw new Error();
    const rows=await r.json();
    if(!rows.length){box.innerHTML='<p class="muted">No selections yet. Be the first to create the ranking.</p>';return;}
    box.innerHTML=rows.map((row,i)=>{const c=state.byId.get(row.waifu_id);if(!c)return '';const img=c.costumes?.[0]?.image||c.image;return `<div class="popular-row"><div class="rank ${i<3?'top':''}">${i+1}</div><img loading="lazy" src="${esc(imageSrc(img))}" alt="${esc(c.name)}" onerror="this.style.opacity='0'"><div class="popular-name">${esc(c.name)}</div><div class="votes">${Number(row.vote_count||0).toLocaleString()} picks</div></div>`}).join('')||'<p class="muted">No selections yet.</p>';
  }catch{box.innerHTML='<p class="muted">Popularity will appear after Cloudflare D1 is connected.</p>';}
}
function esc(value){return String(value??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));}
init().catch(err=>{console.error(err);document.body.innerHTML='<div style="padding:30px;font-family:system-ui">Could not load master data.</div>';});
