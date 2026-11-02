'use strict';
const TYPES=['Fire','Water','Grass','Lightning','Ice','Earth','Wind','Light','Dark'];
const COLORS=['#e55d62','#5098e4','#55b47b','#edcf17','#4fc3d6','#b9a077','#4ebfb1','#ffac36','#9d6bcf'];
// Attacker (rows) against defender (columns), verified against Aniidex element matchup table (rows attack, columns defend).
const MATRIX=[[0.625,0.625,1.6,1,1.6,0.625,1,0.625,1],[1.6,0.625,0.625,1,0.625,1.6,1,0.625,1],[0.625,1.6,0.625,1,1,1.6,1,0.625,1],[1,1.6,1,0.625,0.625,0.625,1.6,1,1],[0.625,1.6,1,1.6,0.625,0.625,1,1,1],[1.6,0.625,0.625,1,1.6,0.625,1,1,0.625],[1,1,1.6,0.625,1,1,0.625,1,1.6],[1,1,1,0.625,1,1,1.6,0.625,1.6],[1,0.625,1.6,1.6,1,1,0.625,1.6,1]];
const KEY='aniimo_type_helper_v1';
const NEW_ICON=t=>`assets/${t.toLowerCase()}-badge.png`;
const NEW_TILE=t=>`assets/${t.toLowerCase()}-circle.png`;
const GLOW={Fire:'#e55d62',Water:'#5098e4',Grass:'#55b47b',Lightning:'#edcf17',Ice:'#4fc3d6',Earth:'#b9a077',Wind:'#4ebfb1',Light:'#ffac36',Dark:'#9d6bcf'};
let selectedFriendly=0,editSide='friendly',editIndex=0,radarMode='defense',radarMember='team',checkerMode='defense';
const emptySlot=()=>({types:['None','None'],moves:['None','None','None','None']});
const emptyTeam=i=>({name:`Team ${i+1}`,slots:Array.from({length:4},emptySlot)});
const fresh=()=>({check:['None','None'],teams:Array.from({length:7},(_,i)=>emptyTeam(i)),selected:0,battleTeam:0,enemy:Array.from({length:4},emptySlot),focus:0,history:[],tab:'checker'});
let state=fresh();
try{const s=JSON.parse(localStorage.getItem(KEY));if(s&&Array.isArray(s.teams)&&s.teams.length>=7&&Array.isArray(s.enemy))state={...fresh(),...s}}catch(e){console.warn('Could not restore saved state',e)}
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const img=(t,cl='')=>t==='None'?'<span class="muted small">None</span>':`<img class="type-img ${cl}" src="${NEW_ICON(t)}" alt="${t}">`;
const opts=(selected,allowNone=true)=>[...(allowNone?['None']:[]),...TYPES].map(t=>`<option value="${t}" ${selected===t?'selected':''}>${t}</option>`).join('');
function normalizeTypes(types){if(!Array.isArray(types))return ['None','None'];if(types[0]===types[1]&&types[0]!=='None')types[1]='None';return types}
function normalizeSaved(){const valid=t=>TYPES.includes(t)?t:'None';state.check=Array.isArray(state.check)?[valid(state.check[0]),valid(state.check[1])]:['None','None'];state.teams.forEach(t=>t.slots.forEach(slot=>{slot.types=[valid(slot.types?.[0]),valid(slot.types?.[1])];slot.moves=(slot.moves||[]).map(valid)}));state.enemy.forEach(slot=>{slot.types=[valid(slot.types?.[0]),valid(slot.types?.[1])];slot.moves=(slot.moves||[]).map(valid)});normalizeTypes(state.check);state.teams.forEach(t=>t.slots.forEach(s=>normalizeTypes(s.types)));state.enemy.forEach(s=>normalizeTypes(s.types));state.history.forEach(h=>{if(h.friendly)h.friendly.slots.forEach(s=>normalizeTypes(s.types));if(h.enemy)h.enemy.forEach(s=>normalizeTypes(s.types))})}
// Upgrade older saved three-move slots without losing existing skills or Ultimates.
function upgradeMoves(slot){
 if(!slot||!Array.isArray(slot.moves)){if(slot)slot.moves=['None','None','None','None'];return}
 if(slot.moves.length===3)slot.moves=['None',...slot.moves];
 while(slot.moves.length<4)slot.moves.push('None');
 if(slot.moves.length>4)slot.moves=slot.moves.slice(0,4);
}
state.teams.forEach(t=>{if(!Array.isArray(t.slots))t.slots=Array.from({length:4},emptySlot);t.slots.forEach(upgradeMoves)});
if(!Array.isArray(state.enemy)||state.enemy.length!==4)state.enemy=Array.from({length:4},emptySlot);
state.enemy.forEach(upgradeMoves);
state.history.forEach(h=>{if(h.friendly?.slots)h.friendly.slots.forEach(upgradeMoves);if(Array.isArray(h.enemy))h.enemy.forEach(upgradeMoves)});
normalizeSaved();
if(!Number.isInteger(state.selected)||state.selected<0||state.selected>6)state.selected=0;
if(!Number.isInteger(state.battleTeam)||state.battleTeam<0||state.battleTeam>6)state.battleTeam=0;
if(!Number.isInteger(state.selected)||state.selected<0||state.selected>6)state.selected=0;
if(!Number.isInteger(state.focus)||state.focus<0||state.focus>3)state.focus=0;
function persist(){try{localStorage.setItem(KEY,JSON.stringify(state));$('saveIndicator').textContent='● Autosaved on this device'}catch(e){$('saveIndicator').textContent='⚠ Could not save: storage blocked'}}
function effectiveness(attack,defenders){if(!TYPES.includes(attack)||!Array.isArray(defenders)||!defenders.some(t=>TYPES.includes(t)))return null;return [...new Set(defenders.filter(t=>TYPES.includes(t)))].reduce((v,t)=>v*MATRIX[TYPES.indexOf(attack)][TYPES.indexOf(t)],1)}
function format(v){return v===null?'—':`×${Number(v.toFixed(4)).toString()}`}
function classification(v){return v>1.001?'good':v<.999?'bad':'normal'}
function defensive(t){return TYPES.map(a=>({type:a,value:effectiveness(a,t)}))}
// Defense uses ONLY the target Aniimo’s Type 1 / Type 2. Moves belong to the attacker.
function damageTaken(attackType,defendingAniimo){return effectiveness(attackType,defendingAniimo.types)}
function selectFields(slot,where,index){return visualFields(slot,where,index)}
function slotHtml(slot,index,where){return `<div class="slot-card"><h4>${where==='enemy'?'Enemy':'Aniimo'} ${index+1}</h4>${selectFields(slot,where,index)}</div>`}
function checkerField(i){const current=state.check[i],options=['None',...TYPES].filter(t=>i!==1||t!==state.check[0]);const picture=t=>t==='None'?'<span class="picker-none">NONE</span>':`<img src="${NEW_ICON(t)}" alt="${t}">`;return `<div class="image-picker"><button type="button" class="picker-current" data-picker-toggle aria-label="Choose Type ${i+1}, currently ${current}">${picture(current)}<span class="picker-chevron">⌄</span></button><div class="picker-options" hidden>${options.map(t=>`<button type="button" class="picker-option ${t===current?'chosen':''}" data-check-value="${t}" data-check-index="${i}" aria-label="${t}">${picture(t)}</button>`).join('')}</div></div>`}
function renderChecker(){
 const defense=checkerMode==='defense';
 document.querySelectorAll('[data-checker-mode]').forEach(b=>b.classList.toggle('active',b.dataset.checkerMode===checkerMode));
 $('checkerIntro').textContent=defense?'Choose one or two defending elements to see incoming damage.':'Choose one or two attack elements to see which enemy types they counter.';
 $('checkerTypesHeading').textContent=defense?'Defensive types':'Attack elements';
 $('checkerChartHeading').textContent=defense?'🛡 Defense':'⚔ Offense';
 $('checkerChartSubtitle').textContent=defense?'Damage your Aniimo takes':'Damage your Aniimo deals';
 $('checkerPicker1').innerHTML=checkerField(0);$('checkerPicker2').innerHTML=checkerField(1);
 const chosen=state.check.filter(t=>TYPES.includes(t));
 const values=defense?defensive(chosen):TYPES.map(type=>({type,value:chosen.length?Math.max(...chosen.map(t=>effectiveness(t,[type]))):null}));
 const groups=defense?[['WEAK','bad',x=>x.value>1.001],['RESISTS','good',x=>x.value<.999],['NEUTRAL','neutral',x=>Math.abs(x.value-1)<.001]]:[['SUPER EFFECTIVE','good',x=>x.value>1.001],['RESISTED','bad',x=>x.value<.999],['NEUTRAL','neutral',x=>Math.abs(x.value-1)<.001]];
 $('checkerSummary').innerHTML=`<div class="simple-match-groups">${groups.map(([label,kind,test])=>`<section class="simple-match-group ${kind}"><h4>${label}</h4><div class="simple-match-chips">${values.filter(x=>x.value!==null&&test(x)).map(x=>`<div class="simple-match-chip"><img src="${NEW_TILE(x.type)}" alt=""><b>${x.type}</b><strong>${format(x.value)}</strong></div>`).join('')||'<span class="empty-match">—</span>'}</div></section>`).join('')}</div>`;

}

function renderTeams(){ $('teamGrid').innerHTML=state.teams.slice(0,7).map((t,i)=>`<button class="team-card ${i===state.selected?'selected':''}" data-team="${i}" aria-pressed="${i===state.selected}"><b>${esc(t.name||`Team ${i+1}`)}</b></button>`).join('');const t=state.teams[state.selected];$('teamEditorTitle').textContent=`Edit Team ${state.selected+1}`;$('teamName').value=t.name;$('teamSlots').innerHTML=t.slots.map((s,i)=>compactTeamSlot(s,i)).join('');let weak=TYPES.map(type=>({type,count:t.slots.filter(s=>damageTaken(type,s)!==null&&damageTaken(type,s)>1.001).length})).filter(x=>x.count>=2).sort((a,b)=>b.count-a.count);let coverage=TYPES.filter(type=>t.slots.some(s=>s.moves.some(m=>effectiveness(m,[type])>1.001)));if($('teamCoverage'))$('teamCoverage').innerHTML=`<b>Team coverage</b><div>Shared defensive weaknesses: ${weak.map(x=>`${x.type} (${x.count}/4 slots)`).join(' · ')||'None across 2+ slots'}</div><div>Attack types your selected moves can hit super effectively: ${coverage.join(', ')||'No moves selected yet'}</div>`;renderMyTeamRadar()}
// V7.0: the team editor uses the same compact icon rows as Battle Arena.
// Keep the existing centered picker and saved-team mutation handlers.
function compactTeamSlot(slot,index){
 upgradeMoves(slot);
 const picker=(t,group,j)=>{
  const options=['None',...TYPES].filter(x=>!(group==='types'&&j===1&&x!=='None'&&x===slot.types[0]));
  const ultimate=group==='moves'&&j===3;
  return `<span class="image-picker compact-team-picker"><button type="button" class="picker-current compact-team-trigger" data-picker-toggle title="${group==='types'?'Type':'Move'} ${j+1}: ${t}" aria-label="Edit Aniimo ${index+1} ${group==='types'?'type':'move'} ${j+1}, currently ${t}">${miniType(t,ultimate?'ultimate-mini':'')}</button><span class="picker-options" hidden>${options.map(x=>`<button type="button" class="picker-option ${x===t?'chosen':''}" data-picker-value="${x}" data-kind="friendly" data-slot="${index}" data-group="${group}" data-i="${j}" aria-label="${x}">${x==='None'?'<span class="picker-none">NONE</span>':`<img src="${NEW_ICON(x)}" alt="${x}">`}</button>`).join('')}</span></span>`;
 };
 return `<div class="compact-team-slot slot-card"><h4>Aniimo ${index+1}</h4><div class="compact-team-types">${slot.types.map((t,j)=>picker(t,'types',j)).join('')}</div><div class="compact-team-moves">${slot.moves.map((t,j)=>picker(t,'moves',j)).join('')}</div></div>`;
}
function miniType(t,extra=''){return t==='None'?`<span class="type-mini empty ${extra}">+</span>`:`<span class="type-mini ${extra}" style="--glow:${GLOW[t]}" title="${t}"><img src="${NEW_TILE(t)}" alt="${t}"></span>`}
function moveIcons(slot){upgradeMoves(slot);return `<div class="mini-moves">${slot.moves.map((m,i)=>miniType(m,i===3?'ultimate-mini':'')).join('')}</div>`}
function pickCard(slot,index,side){
 upgradeMoves(slot);
 const chosen=side==='friendly'?selectedFriendly===index:state.focus===index;
 const popup=(type,group,j)=>{
   const options=['None',...TYPES].filter(t=>!(group==='types'&&j===1&&t!=='None'&&t===slot.types[0]));
   return `<span class="arena-inline-edit"><button type="button" class="arena-inline-trigger" data-inline-toggle title="Edit ${group==='types'?'type':'move'} ${j+1}" aria-label="Edit ${group==='types'?'type':'move'} ${j+1}: ${type}">${miniType(type,group==='moves'&&j===3?'ultimate-mini':'')}</button><span class="arena-inline-menu" hidden>${options.map(t=>`<button type="button" data-inline-value="${t}" data-inline-side="${side}" data-inline-slot="${index}" data-inline-group="${group}" data-inline-index="${j}" title="${t}" aria-label="${t}">${miniType(t)}</button>`).join('')}</span></span>`;
 };
 return `<div class="arena-pick ${chosen?'picked':''}" data-edit-side="${side}" data-edit-index="${index}"><button type="button" class="arena-pick-select" data-pick-select="${side}" data-pick-index="${index}" aria-pressed="${chosen}"><b>${side==='enemy'?'Enemy':'Aniimo'} ${index+1}</b></button><div class="mini-types">${slot.types.map((t,j)=>popup(t,'types',j)).join('')}</div><div class="mini-moves">${slot.moves.map((m,j)=>popup(m,'moves',j)).join('')}</div></div>`;
}
function visualFields(slot,side,index){upgradeMoves(slot);
 const field=(title,group,j,allowNone)=>{
  const current=slot[group][j]||'None';
  const options=(allowNone?['None',...TYPES]:TYPES).filter(t=>!(group==='types'&&j===1&&t!=='None'&&t===slot.types[0]));
  const image=t=>t==='None'?'<span class="picker-none">NONE</span>':`<img src="${NEW_ICON(t)}" alt="${t}">`;
  const selectedMarkup=current==='None'?'<span class="uniform-type-name">NONE</span>':`<span class="uniform-type-icon"><img src="${NEW_TILE(current)}" alt=""></span><span class="uniform-type-name">${current.toUpperCase()}</span>`;
  const selectedColor=current==='None'?'':`style="--selected-type-color:${GLOW[current]};background-color:${GLOW[current]}!important;background-image:none!important;color:#fff!important"`;
  return `<label><span class="field-tab">${title}</span><div class="image-picker"><button type="button" class="picker-current uniform-type-button ${current==='None'?'uniform-empty':'uniform-selected'}" ${selectedColor} data-picker-toggle aria-label="Choose ${title}, currently ${current}">${selectedMarkup}<span class="picker-chevron">⌄</span></button><div class="picker-options" hidden>${options.map(t=>`<button type="button" class="picker-option ${current===t?'chosen':''}" data-picker-value="${t}" data-kind="${side}" data-slot="${index}" data-group="${group}" data-i="${j}" aria-label="${t}">${image(t)}</button>`).join('')}</div></div></label>`;
 };
 return `<div class="visual-fields"><div class="field-grid">${field('Type 1','types',0,true)}${field('Type 2','types',1,true)}</div><div class="field-grid moves">${field('Basic Attack Type','moves',0,true)}${field('Skill 1','moves',1,true)}${field('Skill 2','moves',2,true)}${field('Ultimate','moves',3,true)}</div></div>`;
}
function renderBattle(){const team=state.teams[state.battleTeam].slots;$('battleTeam').innerHTML=state.teams.slice(0,7).map((t,i)=>`<option value="${i}" ${i===state.battleTeam?'selected':''}>${esc(t.name||`Team ${i+1}`)}</option>`).join('');$('friendlyPicks').innerHTML=team.map((s,i)=>pickCard(s,i,'friendly')).join('');$('enemyPicks').innerHTML=state.enemy.map((s,i)=>pickCard(s,i,'enemy')).join('');renderVsMatchup()}
function renderVsMatchup(){
 const friend=state.teams[state.battleTeam].slots[selectedFriendly],enemy=state.enemy[state.focus];
 const mini=s=>`<div class="vs-types">${s.types.filter(t=>t!=='None').map(t=>miniType(t)).join('')}</div>${moveIcons(s)}`;
 const allMoves=(attacker,defender)=>attacker.moves.map((t,i)=>({type:t,name:['Basic','Skill 1','Skill 2','Ultimate'][i],index:i,value:effectiveness(t,defender.types)})).filter(x=>x.value!==null);
 const yours=allMoves(friend,enemy),theirs=allMoves(enemy,friend);
 const group=(heading,kind,items)=>`<section class="simple-match-group ${kind}"><h4>${heading}</h4><div class="battle-group-moves">${items.length?items.map(m=>`<div class="battle-group-move">${miniType(m.type,m.index===3?'ultimate-mini':'')}<b>${m.name}</b><strong>${format(m.value)}</strong></div>`).join(''):'<span class="empty-match">—</span>'}</div></section>`;
 const panel=(heading,sub,moves,incoming)=>{
  const good=moves.filter(x=>incoming?x.value<.999:x.value>1.001);
  const bad=moves.filter(x=>incoming?x.value>1.001:x.value<.999);
  const neutral=moves.filter(x=>Math.abs(x.value-1)<.001);
  return `<div class="battle-combined-panel"><h3>${heading}</h3><p class="battle-combined-sub">${sub}</p>${group(incoming?'SAFE — LESS DAMAGE TAKEN':'STRONG — MORE DAMAGE DEALT','good',good)}${group(incoming?'DANGER — MORE DAMAGE TAKEN':'WEAK — LESS DAMAGE DEALT','bad',bad)}${group('NORMAL DAMAGE','neutral',neutral)}${moves.length?'':'<p class="match-description">No moves configured yet.</p>'}</div>`;
 };
 // A matchup is only rated when both sides have at least one configured attack.
 // Use the strongest available friendly attack and the most dangerous enemy attack.
 const best=yours.length?Math.max(...yours.map(m=>m.value)):null;
 const worst=theirs.length?Math.max(...theirs.map(m=>m.value)):null;
 let rating='UNKNOWN MATCHUP',tone='unknown',explanation='Add attack moves for both Aniimo to compare.';
 if(best!==null&&worst!==null){
  const offense=best>1.001?'extra':best<.999?'reduced':'normal';
  const defense=worst>1.001?'extra':worst<.999?'reduced':'normal';
  if(offense==='normal'&&defense==='normal'){
   rating='NEUTRAL MATCHUP';tone='neutral';explanation='Both sides deal normal damage. Neither side has a type advantage.';
  }else if((offense==='extra'&&defense!=='extra')||(offense==='normal'&&defense==='reduced')){
   rating='GOOD MATCHUP';tone='good';
   explanation=offense==='extra'?(defense==='reduced'?'You deal extra damage and resist the enemy’s attacks!':'You deal extra damage while taking normal damage!'):'You deal normal damage, but resist the enemy’s attacks!';
  }else if((offense==='reduced'&&defense!=='reduced')||(offense==='normal'&&defense==='extra')){
   rating='BAD MATCHUP';tone='bad';
   explanation=offense==='reduced'?(defense==='extra'?'Your attacks are resisted, and you take extra damage. Consider switching.':'Your attacks are resisted while you take normal damage. Consider switching.'):'You deal normal damage, but take extra damage. Consider switching.';
  }else{
   rating='OKAY MATCHUP';tone='okay';
   explanation=offense==='extra'?'Both sides deal extra damage. A risky trade-off!':'Both sides deal reduced damage. Neither side has a clear advantage.';
  }
 }
 $('battleVs').innerHTML=`<h3 class="vs-heading">VS.</h3><div class="vs-contestants"><div class="vs-fighter"><b>♡ Aniimo ${selectedFriendly+1}</b>${mini(friend)}</div><span class="vs-arrow">⚔</span><div class="vs-fighter"><b>⚔ Enemy ${state.focus+1}</b>${mini(enemy)}</div></div>
 <div class="battle-combined-grid">${panel('⚔ YOU → ENEMY','Your moves → enemy’s types',yours,false)}${panel('🛡 ENEMY → YOU','Enemy moves → your Aniimo’s types',theirs,true)}</div>
 <div class="battle-match-rating ${tone}" aria-live="polite"><h3>${rating}</h3><p>${explanation}</p></div>`;
}

function bestMove(attacker,defender){const arr=attacker.moves.map((m,i)=>({name:['Basic Attack','Skill 1','Skill 2','Ultimate'][i],type:m,value:effectiveness(m,defender.types)})).filter(x=>x.value!==null);return arr.length?arr.reduce((a,b)=>b.value>a.value?b:a):null}
function renderBattleResults(){const team=state.teams[state.battleTeam].slots,focus=state.enemy[state.focus];$('battleFocusTitle').textContent=`Who should I use against Enemy ${state.focus+1}?`;const results=team.map((s,i)=>({s,i,attack:bestMove(s,focus),danger:bestMove(focus,s)})).sort((a,b)=>(b.attack?.value??-1)-(a.attack?.value??-1));$('battleMatrix').innerHTML=results.map((x,rank)=>{const v=x.attack?.value??null,d=x.danger?.value??null;const tone=v===null?'unknown':classification(v);const label=v===null?'Add moves':v>1?'Super effective':v<1?'Resisted':'Normal effectiveness';const danger=d===null?'Enemy moves unknown':d>1?'⚠ Vulnerable to enemy moves':d<1?'✓ Resists enemy moves':'Neutral incoming damage';return `<details class="rank-card"><summary><div class="rank-number">${rank+1}</div><div class="rank-name"><b>Aniimo ${x.i+1}</b><span>${x.s.types.filter(t=>t!=='None').map(t=>miniType(t)).join('')}</span></div><div class="rank-move">${x.attack?miniType(x.attack.type,x.attack.name==='Ultimate'?'ultimate-mini':''):''}<div><b>${x.attack?'Use '+x.attack.type:'Choose a move'}</b><small>${label}</small></div></div><div class="rank-power ${tone}">${format(v)}</div><div class="rank-danger ${d===null?'unknown':d>1?'bad':d<1?'good':'normal'}">${danger}</div><span class="expand-hint">⌄</span></summary><div class="rank-details"><div><b>⚔ Your moves against this enemy</b>${moveRows(x.s,focus)}</div><div><b>🛡 Enemy moves against you</b>${moveRows(focus,x.s,true)}</div></div></details>`}).join('');$('battleDetails').innerHTML='<p class="muted small">Element multipliers are not actual damage. A strong attack is not necessarily the safest choice. Expand any Aniimo to compare all moves.</p>'}
function moveRows(attacker,defender,incoming=false){return attacker.moves.map((m,j)=>{const v=effectiveness(m,defender.types);return `<div class="visual-move-row">${miniType(m,j===3?'ultimate-mini':'')}<span>${['Basic Attack','Skill 1','Skill 2','Ultimate'][j]}</span><b class="value ${v===null?'normal':incoming?(v>1?'bad':v<1?'good':'normal'):classification(v)}">${format(v)}</b></div>`}).join('')}
function radarValues(){const team=state.teams[state.battleTeam].slots;const slots=radarMember==='team'?team:[team[Number(radarMember)]];return TYPES.map(type=>{const vals=slots.map(slot=>radarMode==='defense'?damageTaken(type,slot):Math.max(...slot.moves.map(m=>effectiveness(m,[type])??0)));const valid=vals.filter(v=>v>0);return {type,values:vals,value:valid.length?(radarMode==='defense'?Math.min(...valid):Math.max(...valid)):null,covered:radarMode==='defense'?vals.filter(v=>v<=1).length:vals.filter(v=>v>1).length}})}
function renderTeamRadar(){document.querySelectorAll('[data-radar-mode]').forEach(b=>b.classList.toggle('active',b.dataset.radarMode===radarMode));const vals=radarValues();const cx=235,cy=208,r=124,angles=TYPES.map((_,i)=>-Math.PI/2+i*2*Math.PI/9);const xy=(i,rad)=>`${(cx+Math.cos(angles[i])*rad).toFixed(1)},${(cy+Math.sin(angles[i])*rad).toFixed(1)}`;const polygon=(rs)=>rs.map((rad,i)=>xy(i,rad)).join(' ');const grid=[.625,1,1.6,2.56].map(v=>`<polygon points="${polygon(TYPES.map(()=>r*v/2.56))}" fill="none" stroke="#a5bad6" stroke-opacity=".55"/>`).join('');const dots=vals.map((x,i)=>{let v=x.value??0,rad=r*Math.min(v,2.56)/2.56;return `<circle cx="${cx+Math.cos(angles[i])*rad}" cy="${cy+Math.sin(angles[i])*rad}" r="4.5" fill="${(radarMode==='offense'?v<1:v>1)?'#e56a69':(radarMode==='offense'?v>1:v<1)?'#24ac81':'#7d94b2'}" stroke="white" stroke-width="2"/>`}).join('');const axis=angles.map((a,i)=>`<line x1="${cx}" y1="${cy}" x2="${cx+Math.cos(a)*r}" y2="${cy+Math.sin(a)*r}" stroke="#b6c9e0"/>`).join('');const shape=polygon(vals.map(x=>r*Math.min(x.value??0,2.56)/2.56));const labels=vals.map((x,i)=>{let xx=cx+Math.cos(angles[i])*170,yy=cy+Math.sin(angles[i])*160;const c=x.value===null?'#7d94b2':(radarMode==='offense'?x.value<1:x.value>1)?'#c62846':(radarMode==='offense'?x.value>1:x.value<1)?'#168568':'#6d83a2';return `<image href="${NEW_TILE(x.type)}" x="${xx-23}" y="${yy-26}" width="46" height="46"/><text x="${xx}" y="${yy+29}" text-anchor="middle" font-size="12" font-weight="800" fill="${c}">${format(x.value)}</text>`}).join('');$('teamRadar').innerHTML=`<div class="radar-member-switch"><button type="button" data-radar-member="team" class="${radarMember==='team'?'active':''}">Whole team</button>${[0,1,2,3].map(i=>`<button type="button" data-radar-member="${i}" class="${radarMember===String(i)?'active':''}">Aniimo ${i+1}</button>`).join('')}</div><svg viewBox="0 0 470 430" role="img" aria-label="${radarMode} effectiveness for ${radarMember==='team'?'whole team':`Aniimo ${Number(radarMember)+1}`}">${grid}${axis}<polygon points="${shape}" fill="#f28b85" fill-opacity=".19" stroke="#e56a69" stroke-width="2.5"/>${dots}${labels}<circle cx="${cx}" cy="${cy}" r="5" fill="#637a99"/></svg><div class="radar-key"><span>${radarMode==='defense'?'🟢 Resists':'🟢 Super effective'}</span><span>⚪ Neutral</span><span>${radarMode==='defense'?'🔴 Weak':'🔴 Resisted'}</span></div>`;const sorted=[...vals].filter(x=>x.value!==null&&(radarMode==='defense'?x.value>1.001:x.value<.999)).sort((a,b)=>radarMode==='defense'?b.value-a.value:a.value-b.value);$('radarExplanation').innerHTML=`<h4>${radarMode==='defense'?'🛡 Defensive coverage':'⚔ Offensive coverage'}</h4><p>${radarMode==='defense'?radarMember==='team'?'Each point shows the <b>lowest incoming multiplier</b> among your four Aniimo — the safest switch-in.':'Each point shows the <b>incoming multiplier</b> for this Aniimo.':radarMember==='team'?'Each point shows the <b>highest move multiplier</b> available on your team.':'Each point shows this Aniimo’s <b>best configured move multiplier</b>.'}</p><div class="radar-callout">${radarMode==='defense'?'Weaknesses to incoming attacks':'Hardest enemy elements to counter'}</div>${sorted.length?sorted.slice(0,4).map(x=>`<div class="radar-row">${miniType(x.type)}<b>${x.type}</b><strong>${format(x.value)}</strong></div>`).join(''):'<p class="small muted">None — no unfavorable matchups found.</p>'}<p class="small muted">${radarMode==='defense'?radarMember==='team'?'Lower is safer. Switch to an Aniimo that resists this attack.':'Lower means this Aniimo takes less damage.':'Higher is better. Missing move types are not counted.'}</p>`}
let myRadarMode="defense",myRadarMember="team",battleView="offense";
function myRadarValues(){
 const team=state.teams[state.selected].slots;
 const slots=myRadarMember==='team'?team:[team[Number(myRadarMember)]];
 return TYPES.map(type=>{
  const vals=slots.map(slot=>myRadarMode==='defense'?damageTaken(type,slot):(slot.moves.some(m=>TYPES.includes(m))?Math.max(...slot.moves.filter(m=>TYPES.includes(m)).map(m=>effectiveness(m,[type]))):null));
  const valid=vals.filter(v=>v!==null&&v>0);
  return {type,values:vals,value:valid.length?(myRadarMode==='defense'?Math.min(...valid):Math.max(...valid)):null,covered:myRadarMode==='defense'?vals.filter(v=>v!==null&&v<=1).length:vals.filter(v=>v>1).length};
 });
}

function renderMyTeamRadar(){document.querySelectorAll('[data-my-radar-mode]').forEach(b=>b.classList.toggle('active',b.dataset.myRadarMode===myRadarMode));const vals=myRadarValues();const cx=235,cy=208,r=124,angles=TYPES.map((_,i)=>-Math.PI/2+i*2*Math.PI/9);const xy=(i,rad)=>`${(cx+Math.cos(angles[i])*rad).toFixed(1)},${(cy+Math.sin(angles[i])*rad).toFixed(1)}`;const polygon=(rs)=>rs.map((rad,i)=>xy(i,rad)).join(' ');const grid=[.625,1,1.6,2.56].map(v=>`<polygon points="${polygon(TYPES.map(()=>r*v/2.56))}" fill="none" stroke="#a5bad6" stroke-opacity=".55"/>`).join('');const dots=vals.map((x,i)=>{let v=x.value??0,rad=r*Math.min(v,2.56)/2.56;return `<circle cx="${cx+Math.cos(angles[i])*rad}" cy="${cy+Math.sin(angles[i])*rad}" r="4.5" fill="${(myRadarMode==='offense'?v<1:v>1)?'#e56a69':(myRadarMode==='offense'?v>1:v<1)?'#24ac81':'#7d94b2'}" stroke="white" stroke-width="2"/>`}).join('');const axis=angles.map((a,i)=>`<line x1="${cx}" y1="${cy}" x2="${cx+Math.cos(a)*r}" y2="${cy+Math.sin(a)*r}" stroke="#b6c9e0"/>`).join('');const shape=polygon(vals.map(x=>r*Math.min(x.value??0,2.56)/2.56));const labels=vals.map((x,i)=>{let xx=cx+Math.cos(angles[i])*170,yy=cy+Math.sin(angles[i])*160;const c=x.value===null?'#7d94b2':(myRadarMode==='offense'?x.value<1:x.value>1)?'#c62846':(myRadarMode==='offense'?x.value>1:x.value<1)?'#168568':'#6d83a2';return `<image href="${NEW_TILE(x.type)}" x="${xx-23}" y="${yy-26}" width="46" height="46"/><text x="${xx}" y="${yy+29}" text-anchor="middle" font-size="12" font-weight="800" fill="${c}">${format(x.value)}</text>`}).join('');$('myTeamRadar').innerHTML=`<div class="radar-member-switch"><button type="button" data-my-radar-member="team" class="${myRadarMember==='team'?'active':''}">Whole team</button>${[0,1,2,3].map(i=>`<button type="button" data-my-radar-member="${i}" class="${myRadarMember===String(i)?'active':''}">Aniimo ${i+1}</button>`).join('')}</div><svg viewBox="0 0 470 430" role="img" aria-label="${myRadarMode} effectiveness for ${myRadarMember==='team'?'whole team':`Aniimo ${Number(myRadarMember)+1}`}">${grid}${axis}<polygon points="${shape}" fill="#f28b85" fill-opacity=".19" stroke="#e56a69" stroke-width="2.5"/>${dots}${labels}<circle cx="${cx}" cy="${cy}" r="5" fill="#637a99"/></svg><div class="radar-key"><span>${myRadarMode==='defense'?'🟢 Resists':'🟢 Super effective'}</span><span>⚪ Neutral</span><span>${myRadarMode==='defense'?'🔴 Weak':'🔴 Resisted'}</span></div>`;const sorted=[...vals].filter(x=>x.value!==null&&(myRadarMode==='defense'?x.value>1.001:x.value<.999)).sort((a,b)=>myRadarMode==='defense'?b.value-a.value:a.value-b.value);$('myRadarExplanation').innerHTML=`<h4>${myRadarMode==='defense'?'🛡 Defensive coverage':'⚔ Offensive coverage'}</h4><p>${myRadarMode==='defense'?myRadarMember==='team'?'Each point shows the <b>lowest incoming multiplier</b> among your four Aniimo — the safest switch-in.':'Each point shows the <b>incoming multiplier</b> for this Aniimo.':myRadarMember==='team'?'Each point shows the <b>highest move multiplier</b> available on your team.':'Each point shows this Aniimo’s <b>best configured move multiplier</b>.'}</p><div class="radar-callout">${myRadarMode==='defense'?'Weaknesses to incoming attacks':'Hardest enemy elements to counter'}</div>${sorted.length?sorted.slice(0,4).map(x=>`<div class="radar-row">${miniType(x.type)}<b>${x.type}</b><strong>${format(x.value)}</strong></div>`).join(''):'<p class="small muted">None — no unfavorable matchups found.</p>'}<p class="small muted">${myRadarMode==='defense'?myRadarMember==='team'?'Lower is safer. Switch to an Aniimo that resists this attack.':'Lower means this Aniimo takes less damage.':'Higher is better. Missing move types are not counted.'}</p>`}

function renderHistory(){let list=state.history;$('historyList').innerHTML=list.length?list.map((h,i)=>`<div class="history-item"><div><b>${esc(h.name)}</b><small>${esc(h.date)} · ${esc(h.teamName)}</small></div><div class="history-actions"><button class="primary" data-load="${i}">Reopen</button><button class="danger-button" data-delete="${i}">Delete</button></div></div>`).join(''):'<div class="panel"><h3>No battles saved yet ♡</h3><p class="muted">Go to Battle Mode and press “Save to History” when you want to keep a comparison.</p></div>'}
function activate(tab){state.tab=tab;document.querySelectorAll('.tabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id===tab));persist()}
function refresh(){for(const render of [renderChecker,renderTeams,renderBattle,renderHistory]){try{render()}catch(e){console.error("Aniimo panel error:",render.name,e)}}activate(state.tab)}
document.addEventListener('change',e=>{const el=e.target;if(el.dataset.check!==undefined){let i=Number(el.dataset.check);state.check[i]=el.value;normalizeTypes(state.check);renderChecker();persist();return}if(el.dataset.kind){let i=Number(el.dataset.slot),g=el.dataset.group,j=Number(el.dataset.i);let slot=el.dataset.kind==='friendly'?state.teams[state.selected].slots[i]:state.enemy[i];slot[g][j]=el.value;if(g==='types')normalizeTypes(slot.types);if(el.dataset.kind==='friendly'){renderTeams();renderBattle()}else{renderBattle()}persist();return}if(el.id==='battleTeam'){state.battleTeam=Number(el.value);renderBattle();persist()}});
function positionArenaMenu(menu,trigger){
 const rect=trigger.getBoundingClientRect(),width=156,gap=7;
 const below=window.innerHeight-rect.bottom,above=rect.top;
 const placeAbove=below<205 && above>below;
 const x=Math.max(8,Math.min(window.innerWidth-width-8,rect.left+rect.width/2-width/2));
 menu.style.position='fixed';menu.style.left=x+'px';menu.style.transform='none';
 menu.style.top=placeAbove?'auto':Math.min(window.innerHeight-40,rect.bottom+gap)+'px';
 menu.style.bottom=placeAbove?(window.innerHeight-rect.top+gap)+'px':'auto';
 menu.style.maxHeight=Math.max(85,(placeAbove?above:below)-16)+'px';menu.style.overflowY='auto';
}
// Keep regular element pickers inside the visible viewport on desktop.
// On narrow screens the existing centered selection sheet is intentional.
function positionElementPicker(menu,trigger){
 // Overlay anchored to its trigger, without participating in the team grid.
 // Choose above/below based on viewport room and scroll only inside the menu.
 const rect=trigger.getBoundingClientRect();
 const vw=window.innerWidth, vh=window.visualViewport?.height||window.innerHeight;
 const mobile=vw<=700;
 if(mobile){
  menu.style.cssText='position:fixed!important;left:12px!important;right:12px!important;top:auto!important;bottom:12px!important;width:auto!important;max-height:min(58dvh,440px)!important;overflow-y:auto!important;z-index:99999!important;';
  return;
 }
 const gap=7, margin=10;
 const width=Math.min(Math.max(rect.width,175),vw-2*margin);
 const left=Math.max(margin,Math.min(rect.left,vw-width-margin));
 const below=vh-rect.bottom-gap-margin, above=rect.top-gap-margin;
 const placeAbove=below<240 && above>below;
 const available=Math.max(90,placeAbove?above:below);
 const height=Math.min(300,available);
 const top=placeAbove?Math.max(margin,rect.top-gap-height):Math.min(vh-margin-height,rect.bottom+gap);
 menu.style.cssText=`position:fixed!important;left:${left}px!important;right:auto!important;top:${top}px!important;bottom:auto!important;width:${width}px!important;min-width:0!important;max-width:${width}px!important;max-height:${height}px!important;overflow-y:auto!important;z-index:99999!important;transform:none!important;margin:0!important;`;
}

function updateOpenElementPickers(){
 document.querySelectorAll('.picker-options:not([hidden])').forEach(menu=>{
  const trigger=menu.closest('.image-picker')?.querySelector('[data-picker-toggle]');
  if(trigger)positionElementPicker(menu,trigger);
 });
}
window.addEventListener('scroll',updateOpenElementPickers,true);
window.addEventListener('resize',updateOpenElementPickers);
if(window.visualViewport){window.visualViewport.addEventListener('resize',updateOpenElementPickers);window.visualViewport.addEventListener('scroll',updateOpenElementPickers)}
function updateOpenArenaMenus(){document.querySelectorAll('.arena-inline-menu:not([hidden])').forEach(menu=>{const trigger=menu.closest('.arena-inline-edit')?.querySelector('[data-inline-toggle]');if(trigger)positionArenaMenu(menu,trigger)})}
window.addEventListener('scroll',updateOpenArenaMenus,true);window.addEventListener('resize',updateOpenArenaMenus);
document.addEventListener('click',e=>{const inlineValue=e.target.closest('[data-inline-value]');
 if(inlineValue){
  const d=inlineValue.dataset,idx=Number(d.inlineSlot),j=Number(d.inlineIndex);
  const slot=d.inlineSide==='enemy'?state.enemy[idx]:state.teams[state.battleTeam].slots[idx];
  slot[d.inlineGroup][j]=d.inlineValue;
  if(d.inlineGroup==='types')normalizeTypes(slot.types);
  renderTeams();renderBattle();persist();return;
 }
 const inlineToggle=e.target.closest('[data-inline-toggle]');
 if(inlineToggle){
  const menu=inlineToggle.closest('.arena-inline-edit').querySelector('.arena-inline-menu');
  document.querySelectorAll('.arena-inline-menu').forEach(m=>{if(m!==menu)m.hidden=true});
  const opening=menu.hidden;menu.hidden=!opening;if(opening)positionArenaMenu(menu,inlineToggle);return;
 }
 if(!e.target.closest('.arena-inline-edit'))document.querySelectorAll('.arena-inline-menu').forEach(m=>m.hidden=true);
 const pickSelect=e.target.closest('[data-pick-select]');
 if(pickSelect){
  const side=pickSelect.dataset.pickSelect,idx=Number(pickSelect.dataset.pickIndex);
  if(side==='enemy')state.focus=idx;else selectedFriendly=idx;
  renderBattle();persist();return;
 }
 const battleButton=e.target.closest('[data-battle-view]');if(battleButton){battleView=battleButton.dataset.battleView;renderVsMatchup();return}const myMode=e.target.closest('[data-my-radar-mode]');if(myMode){myRadarMode=myMode.dataset.myRadarMode;renderMyTeamRadar();return}const myMember=e.target.closest('[data-my-radar-member]');if(myMember){myRadarMember=myMember.dataset.myRadarMember;renderMyTeamRadar();return}const checkerModeBtn=e.target.closest('[data-checker-mode]');if(checkerModeBtn){checkerMode=checkerModeBtn.dataset.checkerMode;renderChecker();return}const checkerValue=e.target.closest('[data-check-value]');if(checkerValue){state.check[Number(checkerValue.dataset.checkIndex)]=checkerValue.dataset.checkValue;normalizeTypes(state.check);renderChecker();persist();return}const pickerValue=e.target.closest('[data-picker-value]');if(pickerValue){const i=Number(pickerValue.dataset.slot),j=Number(pickerValue.dataset.i),g=pickerValue.dataset.group,side=pickerValue.dataset.kind;const slot=side==='enemy'?state.enemy[i]:state.teams[pickerValue.closest('#teamSlots')?state.selected:state.battleTeam].slots[i];slot[g][j]=pickerValue.dataset.pickerValue;if(g==='types')normalizeTypes(slot.types);renderTeams();renderBattle();persist();return}if(!e.target.closest('.image-picker'))document.querySelectorAll('.picker-options:not([hidden])').forEach(x=>x.hidden=true);const pickerToggle=e.target.closest('[data-picker-toggle]');if(pickerToggle){const box=pickerToggle.closest('.image-picker');const options=box.querySelector('.picker-options');document.querySelectorAll('.picker-options').forEach(x=>{if(x!==options)x.hidden=true});options.hidden=!options.hidden;if(!options.hidden)positionElementPicker(options,pickerToggle);return}const radarBtn=e.target.closest('[data-radar-mode]');if(radarBtn){radarMode=radarBtn.dataset.radarMode;renderTeamRadar();return}const memberBtn=e.target.closest('[data-radar-member]');if(memberBtn){radarMember=memberBtn.dataset.radarMember;renderTeamRadar();return}const arenaPick=e.target.closest('[data-edit-side]');if(arenaPick){editSide=arenaPick.dataset.editSide;editIndex=Number(arenaPick.dataset.editIndex);if(editSide==='enemy')state.focus=editIndex;else selectedFriendly=editIndex;renderBattle();persist();return}const enemyPick=e.target.closest('[data-focus-enemy]');if(enemyPick){state.focus=Number(enemyPick.dataset.focusEnemy);renderBattle();persist();return}const tab=e.target.closest('[data-tab]');if(tab){activate(tab.dataset.tab);return}const team=e.target.closest('[data-team]');if(team){state.selected=Number(team.dataset.team);renderTeams();persist();return}const load=e.target.closest('[data-load]');if(load){const h=state.history[Number(load.dataset.load)];if(!h)return;state.battleTeam=h.battleTeam;if(h.friendly)state.teams[h.battleTeam]=structuredClone(h.friendly);state.enemy=structuredClone(h.enemy);normalizeSaved();state.focus=0;editSide='enemy';editIndex=0;renderTeams();renderBattle();activate('battle');showToast('Opened successfully');persist();return}const del=e.target.closest('[data-delete]');if(del){{state.history.splice(Number(del.dataset.delete),1);renderHistory();persist();showToast('Battle deleted')}return}});
$('teamName').addEventListener('input',e=>{state.teams[state.selected].name=e.target.value;renderTeamCardsOnly();persist()});function renderTeamCardsOnly(){document.querySelectorAll('[data-team]').forEach((el,i)=>{el.querySelector('b').textContent=state.teams[i].name||`Team ${i+1}`})}
$('saveBattle').addEventListener('click',()=>{const name=prompt('Name this battle:',`Battle vs opponent · ${new Date().toLocaleDateString()}`);if(name===null)return;state.history.unshift({name:name.trim()||'Untitled battle',date:new Date().toLocaleString(),teamName:state.teams[state.battleTeam].name,battleTeam:state.battleTeam,friendly:structuredClone(state.teams[state.battleTeam]),enemy:structuredClone(state.enemy)});if(state.history.length>100)state.history.length=100;renderHistory();persist();$('saveBattle').textContent='✓ Saved!';setTimeout(()=>$('saveBattle').textContent='♡ Save to History',1600)});
$('clearHistory').addEventListener('click',()=>{if(state.history.length){state.history=[];renderHistory();persist();showToast('History cleared')}});
$('copyTeam').addEventListener('click',()=>{
 const from=state.selected;
 const overlay=document.createElement('div');overlay.className='centered-element-layer';overlay.innerHTML=`<section class="centered-element-dialog" role="dialog" aria-modal="true" aria-label="Copy team"><div class="centered-element-header"><strong>Copy Team ${from+1} to…</strong><button type="button" class="centered-element-close" aria-label="Close">×</button></div><p class="muted small">The chosen team's current contents will be replaced.</p><div class="copy-team-grid">${state.teams.map((t,i)=>`<button type="button" data-copy-target="${i}" ${i===from?'disabled':''}>Team ${i+1}<small>${esc(t.name)}</small></button>`).join('')}</div></section>`;
 overlay.querySelector('.centered-element-close').onclick=()=>overlay.remove();overlay.onclick=e=>{if(e.target===overlay)overlay.remove()};
 overlay.querySelectorAll('[data-copy-target]').forEach(b=>b.onclick=()=>{const dest=Number(b.dataset.copyTarget);state.teams[dest]=structuredClone(state.teams[from]);state.teams[dest].name+=' (Copy)';state.selected=dest;overlay.remove();renderTeams();renderBattle();persist();showToast('Team copied successfully')});
 document.body.append(overlay);
});
function showToast(message){let toast=document.getElementById('aniimo-toast');if(!toast){toast=document.createElement('div');toast.id='aniimo-toast';toast.setAttribute('role','status');document.body.append(toast)}toast.textContent='✓ '+message;toast.classList.add('visible');clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>toast.classList.remove('visible'),2300)}

// V4.3: Coverage details always follow the radar's selected scope.
function teamCoveragePanel(slots){
 const isTeam=myRadarMember==='team';
 const offense=TYPES.map(type=>{
  const strengths=slots.flatMap(slot=>slot.moves.filter(m=>TYPES.includes(m)).map(move=>effectiveness(move,[type]))).filter(v=>v!==null&&v>1.001);
  return {type,best:strengths.length?Math.max(...strengths):null};
 });
 const defense=TYPES.map(type=>({type,weak:slots.filter(s=>damageTaken(type,s)!==null&&damageTaken(type,s)>1.001).length,resist:slots.filter(s=>damageTaken(type,s)!==null&&damageTaken(type,s)<.999).length}));
 const covered=offense.filter(x=>x.best!==null).length;
 const shared=defense.filter(x=>x.weak>=(isTeam?2:1)).length;
 const icon=t=>`<img src="${NEW_TILE(t)}" alt="" class="coverage-icon">`;
 const offenseRows=offense.map(x=>`<div class="coverage-line ${x.best!==null?'coverage-positive':'coverage-negative'}">${icon(x.type)}<b>${x.type}</b><span>${x.best!==null?format(x.best):'Gap'}</span></div>`).join('');
 const defenseRows=defense.map(x=>`<div class="coverage-line ${x.weak?'coverage-negative':''}">${icon(x.type)}<b>${x.type}</b><span class="coverage-count"><em>${x.weak} weak</em><strong>${x.resist} resist</strong></span></div>`).join('');
 const subject=isTeam?'your four Aniimo':`Aniimo ${Number(myRadarMember)+1}`;
 return `<div class="coverage-two-panels"><section class="coverage-list-panel"><h3>⚔ Offense coverage <small>${covered}/9 · ${Math.round(covered/9*100)}%</small></h3><p class="muted small">Using configured Basic Attack, Skills and Ultimate for ${subject}.</p>${offenseRows}</section><section class="coverage-list-panel"><h3>🛡 Incoming damage <small>${shared} ${isTeam?'shared weaknesses':'weaknesses'}</small></h3><p class="muted small">How ${subject} ${isTeam?'respond':'responds'} to each attacking element.</p>${defenseRows}</section></div>`;
}
function updateCoveragePanels(){
 const panel=$('myRadarExplanation')?.closest('.coverage-panel');
 if(!panel)return;
 let target=panel.querySelector('.coverage-analysis');
 if(!target){target=document.createElement('div');target.className='coverage-analysis';panel.append(target)}
 const team=state.teams[state.selected].slots;
 const slots=myRadarMember==='team'?team:[team[Number(myRadarMember)]];
 target.innerHTML=teamCoveragePanel(slots);
}
// V4.5: one visual, one scope, one mode. All nine matchups stay visible.
function renderSimpleCoverage(){
 const team=state.teams[state.selected].slots;
 const slots=myRadarMember==='team'?team:[team[Number(myRadarMember)]];
 const isDefense=myRadarMode==='defense';
 const values=TYPES.map(type=>{
  const multipliers=slots.map(slot=>isDefense
   ? damageTaken(type,slot)
   : (slot.moves.some(m=>TYPES.includes(m))
      ? Math.max(...slot.moves.filter(m=>TYPES.includes(m)).map(m=>effectiveness(m,[type])))
      : null));
  const valid=multipliers.filter(v=>v!==null);
  const value=valid.length?(isDefense?Math.min(...valid):Math.max(...valid)):null;
  return {type,value};
 });
 const groups=[
  {label:isDefense?'WEAK':'SUPER EFFECTIVE',kind:isDefense?'bad':'good',items:values.filter(x=>x.value!==null&&(isDefense?x.value>1.001:x.value>1.001))},
  {label:isDefense?'RESISTS':'RESISTED',kind:isDefense?'good':'bad',items:values.filter(x=>x.value!==null&&(isDefense?x.value<.999:x.value<.999))},
  {label:'NEUTRAL',kind:'neutral',items:values.filter(x=>x.value!==null&&x.value>=.999&&x.value<=1.001)},
  ...(!isDefense?[{label:'NO ATTACKS',kind:'neutral',items:values.filter(x=>x.value===null)}]:[])
 ];
 const chip=x=>`<div class="simple-match-chip"><img src="${NEW_TILE(x.type)}" alt=""><b>${x.type}</b><strong>${x.value===null?'—':format(x.value)}</strong></div>`;
 $('myTeamRadar').innerHTML=`<div class="radar-member-switch"><button type="button" data-my-radar-member="team" class="${myRadarMember==='team'?'active':''}">Whole team</button>${[0,1,2,3].map(i=>`<button type="button" data-my-radar-member="${i}" class="${myRadarMember===String(i)?'active':''}">Aniimo ${i+1}</button>`).join('')}</div><div class="simple-match-groups">${groups.map(g=>`<section class="simple-match-group ${g.kind}"><h4><span class="match-dot"></span>${g.label}</h4><div class="simple-match-chips">${g.items.length?g.items.map(chip).join(''):'<span class="empty-match">—</span>'}</div></section>`).join('')}</div>`;
 $('myRadarExplanation').innerHTML='';
 const analysis=document.querySelector('.my-team-coverage .coverage-analysis');if(analysis)analysis.remove();
 document.querySelectorAll('[data-my-radar-mode]').forEach(b=>b.classList.toggle('active',b.dataset.myRadarMode===myRadarMode));
}

// V4.6: Whole-team offense and defense shown together, with no misleading best-switch defense.
function renderClearCoverage(){
 const team=state.teams[state.selected].slots;
 const all=myRadarMember==='team';
 const slots=all?team:[team[Number(myRadarMember)]];
 const defense=myRadarMode==='defense';
 const chip=(type,value,text)=>`<div class="simple-match-chip"><img src="${NEW_TILE(type)}" alt=""><b>${type}</b><strong>${text??format(value)}</strong></div>`;
 const group=(label,kind,items,description='')=>`<section class="simple-match-group ${kind}"><h4>${label}</h4>${description?`<p class="match-description">${description}</p>`:''}<div class="simple-match-chips">${items.length?items.join(''):'<span class="empty-match">—</span>'}</div></section>`;
 let sections='';
 if(defense && all){
   const vals=TYPES.map(type=>({
     type,
     weak:slots.filter(s=>damageTaken(type,s)!==null&&damageTaken(type,s)>1.001).length,
     resist:slots.filter(s=>damageTaken(type,s)!==null&&damageTaken(type,s)<.999).length,
     neutral:slots.filter(s=>damageTaken(type,s)!==null&&Math.abs(damageTaken(type,s)-1)<.001).length
   }));
   sections+=group('WEAK TO','bad',vals.filter(x=>x.weak).map(x=>chip(x.type,null,`${x.weak} ${x.weak===1?'Aniimo':'Aniimo'} weak`)),'Counted from each teammate’s Type 1 and Type 2 only.');
   sections+=group('RESISTS','good',vals.filter(x=>x.resist).map(x=>chip(x.type,null,`${x.resist} resist`)),'Counted from each teammate’s Type 1 and Type 2 only.');
   sections+=group('NEUTRAL','neutral',vals.filter(x=>x.neutral).map(x=>chip(x.type,null,`${x.neutral} neutral`)),'Counted from each teammate’s Type 1 and Type 2 only.');
 }else if(!defense && all){
   const vals=TYPES.map(type=>{
     const multipliers=slots.map(slot=>slot.moves.filter(m=>TYPES.includes(m)).map(m=>effectiveness(m,[type])));
     return {type,
       strong:multipliers.filter(ms=>ms.some(v=>v>1.001)).length,
       resisted:multipliers.filter(ms=>ms.some(v=>v<.999)).length,
       neutral:multipliers.filter(ms=>ms.some(v=>Math.abs(v-1)<.001)).length};
   });
   sections+=group('SUPER EFFECTIVE','good',vals.filter(x=>x.strong).map(x=>chip(x.type,null,`${x.strong} Aniimo`)),'Aniimo with at least one strong move against this element.');
   sections+=group('RESISTED','bad',vals.filter(x=>x.resisted).map(x=>chip(x.type,null,`${x.resisted} Aniimo`)),'Aniimo with at least one resisted move against this element.');
   sections+=group('NEUTRAL','neutral',vals.filter(x=>x.neutral).map(x=>chip(x.type,null,`${x.neutral} Aniimo`)),'Aniimo with at least one neutral move against this element.');
 }else{
   const vals=TYPES.map(type=>{
     const attacks=slots.flatMap(s=>s.moves.filter(m=>TYPES.includes(m)).map(m=>effectiveness(m,[type])));
     return {type,value:defense?damageTaken(type,slots[0]):(attacks.length?Math.max(...attacks):null)};
   });
   if(defense){
     sections+=group('WEAK','bad',vals.filter(x=>x.value!==null&&x.value>1.001).map(x=>chip(x.type,x.value)),'These elements deal extra damage to your Aniimo’s types.');
     sections+=group('RESISTS','good',vals.filter(x=>x.value!==null&&x.value<.999).map(x=>chip(x.type,x.value)),'Your Aniimo’s types reduce damage from these elements.');
     sections+=group('NEUTRAL','neutral',vals.filter(x=>x.value!==null&&Math.abs(x.value-1)<.001).map(x=>chip(x.type,x.value)),'These elements deal normal damage to your Aniimo’s types.');
   }else{
     sections+=group('SUPER EFFECTIVE','good',vals.filter(x=>x.value!==null&&x.value>1.001).map(x=>chip(x.type,x.value)),'Your best configured move deals more damage to these elements.');
     sections+=group('RESISTED','bad',vals.filter(x=>x.value!==null&&x.value<.999).map(x=>chip(x.type,x.value)),'Your best configured move deals less damage to these elements.');
     sections+=group('NEUTRAL','neutral',vals.filter(x=>x.value!==null&&Math.abs(x.value-1)<.001).map(x=>chip(x.type,x.value)),'Your best configured move deals normal damage.');
     // Unconfigured moves do not imply a neutral or resisted matchup.
   }
 }
 const nav=`<div class="radar-member-switch"><button type="button" data-my-radar-member="team" class="${all?'active':''}">Whole team</button>${[0,1,2,3].map(i=>`<button type="button" data-my-radar-member="${i}" class="${myRadarMember===String(i)?'active':''}">Aniimo ${i+1}<span class="member-type-icons">${team[i].types.filter(t=>t!=='None').map(t=>miniType(t)).join('')}</span></button>`).join('')}</div>`;
 $('myTeamRadar').innerHTML=nav+`<p class="match-mode-caption">${defense?'🛡 Defense · Damage your Aniimo takes (based on its types)':'⚔ Offense · Damage your Aniimo deals (based on its moves)'}</p><div class="simple-match-groups">${sections}</div>`;
 $('myRadarExplanation').innerHTML='';
 const sw=document.querySelector('.my-team-coverage .coverage-switch');
 if(sw)sw.style.display='';
 document.querySelectorAll('[data-my-radar-mode]').forEach(b=>b.classList.toggle('active',b.dataset.myRadarMode===myRadarMode));
}
renderMyTeamRadar=renderClearCoverage;


refresh();

// Close open element menus with Escape, without changing selections.
document.addEventListener('keydown',e=>{if(e.key==='Escape'){document.querySelectorAll('.picker-options:not([hidden]),.arena-inline-menu:not([hidden])').forEach(x=>x.hidden=true)}});

// V6.1: Explicit clears. Never erase saved history unless History's own clear is used.
$('clearChecker').addEventListener('click',()=>{state.check=['None','None'];renderChecker();persist()});
$('clearTeam').addEventListener('click',()=>{const t=state.teams[state.selected];t.slots=Array.from({length:4},emptySlot);renderTeams();renderBattle();persist()});
$('clearBattle').addEventListener('click',()=>{state.enemy=Array.from({length:4},emptySlot);state.focus=0;renderBattle();persist()});

// V6.3: One centered, responsive element picker shared by all editing surfaces.
(function(){
 let lastTrigger=null;
 function closePicker(){const layer=document.getElementById('centered-element-layer');if(layer)layer.remove();if(lastTrigger&&lastTrigger.isConnected)lastTrigger.focus({preventScroll:true});lastTrigger=null;}
 function openPicker(trigger){
  closePicker();lastTrigger=trigger;
  const parent=trigger.closest('.image-picker, .arena-inline-edit');
  const source=parent?.querySelector('.picker-options, .arena-inline-menu');
  if(!source)return;
  const firstOption=source.querySelector('button');
  const group=firstOption?.dataset.group || firstOption?.dataset.inlineGroup;
  const rawIndex=firstOption?.dataset.i ?? firstOption?.dataset.inlineIndex ?? firstOption?.dataset.checkIndex;
  const idx=Number(rawIndex ?? 0);
  const titles=group==='types'||(!group&&firstOption?.hasAttribute('data-check-index'))
   ? ['Element Type 1','Element Type 2']
   : ['Element of Basic Attack','Element of Skill 1','Element of Skill 2','Element of Ultimate'];
  const pickerTitle=titles[Math.max(0,Math.min(idx,titles.length-1))] || 'Choose an element';
  const slotRaw=firstOption?.dataset.slot ?? firstOption?.dataset.inlineSlot;
  const side=firstOption?.dataset.kind ?? firstOption?.dataset.inlineSide;
  const context=slotRaw===undefined?'':`${side==='enemy'?'Enemy':'Aniimo'} ${Number(slotRaw)+1}`;
  const layer=document.createElement('div');layer.id='centered-element-layer';layer.className='centered-element-layer';
  const dialog=document.createElement('section');dialog.className='centered-element-dialog';dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label',pickerTitle);
  const header=document.createElement('div');header.className='centered-element-header';
  const title=document.createElement('strong');title.textContent=pickerTitle;
  const x=document.createElement('button');x.type='button';x.className='centered-element-close';x.textContent='×';x.setAttribute('aria-label','Close element picker');x.addEventListener('click',closePicker);
  header.append(title,x);
  if(context){const subtitle=document.createElement('div');subtitle.className='centered-element-context';subtitle.textContent=context;subtitle.style.cssText='font-size:13px;color:#587397;margin:-10px 0 12px 2px';dialog.append(header,subtitle);}
  const grid=document.createElement('div');grid.className='centered-element-grid';
  source.querySelectorAll('button').forEach(original=>{
   const btn=original.cloneNode(true);btn.classList.add('centered-element-option');btn.removeAttribute('style');
   // Consistent icon + readable label in every picker (checker, teams, arena).
   const elementName=btn.getAttribute('aria-label') || btn.dataset.pickerValue || btn.dataset.inlineValue || btn.dataset.checkValue || 'None';
   const normalized=elementName.toLowerCase()==='none'?'None':elementName.charAt(0).toUpperCase()+elementName.slice(1).toLowerCase();
   btn.replaceChildren();
   if(normalized==='None'){
    const empty=document.createElement('span');empty.className='centered-element-empty';empty.textContent='+';btn.append(empty);
   }else{
    const icon=document.createElement('img');icon.src=`assets/${normalized.toLowerCase()}-circle.png`;icon.alt='';icon.className='centered-element-badge';btn.append(icon);
   }
   const label=document.createElement('span');label.className='centered-element-name';label.textContent=normalized;btn.append(label);
   btn.setAttribute('aria-label',normalized);
   btn.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();original.click();closePicker();});
   grid.appendChild(btn);
  });
  if(!header.isConnected)dialog.append(header);dialog.append(grid);layer.append(dialog);document.body.append(layer);
  layer.addEventListener('click',e=>{if(e.target===layer)closePicker()});
  x.focus({preventScroll:true});
 }
 document.addEventListener('click',e=>{
  const trigger=e.target.closest('[data-picker-toggle], [data-inline-toggle]');
  if(!trigger)return;
  e.preventDefault();e.stopImmediatePropagation();openPicker(trigger);
 },true);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.getElementById('centered-element-layer')){e.stopImmediatePropagation();closePicker();}},true);
})();
