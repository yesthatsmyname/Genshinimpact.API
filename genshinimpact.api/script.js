const API='https://genshin.jmp.blue';
const state={type:'characters',slugs:[],entries:[],cache:new Map()};
const titles={characters:['Character Archive','Meet the people of Teyvat.'],weapons:['Weapon Library','Tools and treasures for every journey.'],artifacts:['Artifact Compendium','Collections, bonuses, and ancient relics.'],elements:['The Seven Elements','The elemental forces that shape Teyvat.'],nations:['Nations of Teyvat','Explore the lands and their identities.']};
const $=s=>document.querySelector(s);
function human(slug){return slug.split('-').map(w=>w?w[0].toUpperCase()+w.slice(1):w).join(' ')}
function pickName(obj,slug){return obj?.name||obj?.title||human(slug)}
function imageUrl(type,slug,kind='icon'){return `${API}/${type}/${encodeURIComponent(slug)}/${kind}`}
function setStatus(ok,msg){$('#statusDot').style.background=ok?'#7fe0b0':'#e9b46b';$('#statusText').textContent=msg}
async function getJSON(url){const r=await fetch(url);if(!r.ok)throw new Error(`API request failed (${r.status})`);return r.json()}
async function loadType(type){
 state.type=type;$('#search').value='';$('#elementFilter').value='';$('#elementFilter').classList.toggle('hidden',type!=='characters');
 $('#sectionTitle').textContent=titles[type][0];$('#sectionDesc').textContent=titles[type][1];$('#countLabel').textContent='Loading entries…';$('#grid').innerHTML='<div class="loading">Gathering knowledge from the archive…</div>';
 document.querySelectorAll('.navlinks button').forEach(b=>b.classList.toggle('active',b.dataset.type===type));
 try{
  const slugs=await getJSON(`${API}/${type}?lang=en`);
  state.slugs=Array.isArray(slugs)?slugs:(slugs.types||[]);
  const initial=state.slugs.slice(0,48);
  const details=await Promise.all(initial.map(async slug=>{try{return {slug,data:await getJSON(`${API}/${type}/${encodeURIComponent(slug)}?lang=en`)}}catch{return {slug,data:{}}}}));
  state.entries=details.map(x=>({slug:x.slug,...x.data}));
  setStatus(true,'API connected');render();
 }catch(err){setStatus(false,'API unavailable');$('#grid').innerHTML=`<div class="empty">Could not load the archive right now.<br><small>${err.message}. Check your connection and try again.</small><p><button id="retry" class="tag">Retry</button></p></div>`;$('#retry')?.addEventListener('click',()=>loadType(type));$('#countLabel').textContent='0 entries'}
}
function render(){
 const q=$('#search').value.trim().toLowerCase(),el=$('#elementFilter').value;
 let items=state.entries.filter(x=>pickName(x,x.slug).toLowerCase().includes(q)||x.slug.includes(q));
 if(el)items=items.filter(x=>(x.vision||x.element||'').toLowerCase()===el.toLowerCase());
 items.sort((a,b)=>pickName(a,a.slug).localeCompare(pickName(b,b.slug)) * ($('#sort').value==='za'?-1:1));
 $('#countLabel').textContent=`${items.length}${state.slugs.length>state.entries.length?' shown of '+state.slugs.length:''} entries`;
 $('#grid').innerHTML='';
 if(!items.length){$('#grid').innerHTML='<div class="empty">No matching entries. Try another search.</div>';return}
 for(const item of items){
  const name=pickName(item,item.slug),element=item.vision||item.element||item.type||'Archive entry',rarity=item.rarity;
  const card=document.createElement('article');card.className='item';card.tabIndex=0;card.setAttribute('role','button');card.setAttribute('aria-label',`View ${name}`);
  const pic=document.createElement('div');pic.className='portrait';
  if(state.type==='characters'){const img=document.createElement('img');img.loading='lazy';img.alt=name;img.src=imageUrl(state.type,item.slug,'icon');img.onerror=()=>{img.remove();pic.innerHTML='<div class="placeholder">✧</div>'};pic.append(img)}
  else pic.innerHTML='<div class="placeholder">✧</div>';
  if(rarity) {const stars=document.createElement('div');stars.className='rarity';stars.textContent='★'.repeat(Math.min(5,Number(rarity)||0));pic.append(stars)}
  const body=document.createElement('div');body.className='itembody';const h=document.createElement('h3');h.textContent=name;const meta=document.createElement('div');meta.className='meta';meta.innerHTML=`<span class="tag">${escapeHTML(element)}</span>${rarity?`<span>${escapeHTML(String(rarity))}★</span>`:''}`;body.append(h,meta);card.append(pic,body);
  card.addEventListener('click',()=>openDetail(item));card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openDetail(item)}});
  $('#grid').append(card);
 }
}
function escapeHTML(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function formatValue(v){if(v==null||v==='')return '';if(Array.isArray(v))return v.map(x=>typeof x==='object'?(x.name||x.title||''):x).join(', ');if(typeof v==='object')return Object.entries(v).map(([k,val])=>`${k}: ${formatValue(val)}`).join(' · ');return String(v)}
function openDetail(item){
 $('#modal').classList.add('open');$('#modalTitle').textContent=pickName(item,item.slug);$('#detailContent').innerHTML='<div class="loadline">Loading entry details…</div>';
 const key=`${state.type}/${item.slug}`;
 const request=state.cache.get(key)||getJSON(`${API}/${state.type}/${encodeURIComponent(item.slug)}?lang=en`).catch(()=>item);
 state.cache.set(key,request);
 request.then(data=>{
  const name=pickName(data,item.slug);$('#modalTitle').textContent=name;
  const img=document.createElement('img');img.alt=name;img.src=imageUrl(state.type,item.slug,state.type==='characters'?'card':'icon');img.onerror=()=>{img.style.display='none'};
  const info=document.createElement('div');const desc=data.description||data.desc||data.effect||data.bonus||'Explore this entry in the wider Genshin Impact universe.';
  const heading=document.createElement('h3');heading.textContent='Overview';const p=document.createElement('p');p.textContent=desc;info.append(heading,p);
  const fields=['vision','element','weapon','weaponType','nation','region','rarity','birthday','affiliation','description','effectName','setBonus','twoPieceBonus','fourPieceBonus','baseAttack','subStat'];
  const used=new Set(['name','title','description','desc','effect','bonus']);
  fields.forEach(k=>{if(data[k]&&k!=='description'){const h=document.createElement('h3');h.textContent=k.replace(/([A-Z])/g,' $1').replace(/^./,c=>c.toUpperCase());const p=document.createElement('p');p.textContent=formatValue(data[k]);info.append(h,p);used.add(k)}});
  const lists=Object.entries(data).filter(([k,v])=>!used.has(k)&&Array.isArray(v)&&v.length&&v.length<15);
  lists.slice(0,4).forEach(([k,v])=>{const h=document.createElement('h3');h.textContent=k.replace(/([A-Z])/g,' $1').replace(/^./,c=>c.toUpperCase());const ul=document.createElement('ul');v.slice(0,8).forEach(row=>{const li=document.createElement('li');li.textContent=typeof row==='object'?(row.name||row.title||row.description||formatValue(row)):String(row);ul.append(li)});info.append(h,ul)});
  $('#detailContent').replaceChildren(img,info);
 }).catch(()=>{$('#detailContent').innerHTML='<p>Details could not be loaded. Please try again later.</p>'});
}
document.querySelectorAll('.navlinks button').forEach(b=>b.addEventListener('click',()=>loadType(b.dataset.type)));
$('#search').addEventListener('input',render);$('#elementFilter').addEventListener('change',render);$('#sort').addEventListener('change',render);
$('#closeModal').addEventListener('click',()=>$('#modal').classList.remove('open'));$('#modal').addEventListener('click',e=>{if(e.target===$('#modal'))$('#modal').classList.remove('open')});document.addEventListener('keydown',e=>{if(e.key==='Escape')$('#modal').classList.remove('open')});
loadType('characters');
