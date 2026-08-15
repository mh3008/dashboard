/* ============================================================
   SHARED PLANTS DATA MODULE — plant catalogue + read/write helpers
   for 'plants:data', used by plants.html and life.html so both
   pages always agree on soak status.
   ============================================================ */
function storeGet(k){ try { return JSON.parse(localStorage.getItem(k)); } catch(e){ return null; } }
function storeSet(k,v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} }
function pad2(n){ return String(n).padStart(2,'0'); }
function getActiveDateString(){ var d=new Date(); if(d.getHours()<6) d.setDate(d.getDate()-1); return d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate()); }
function dayDiff(a,b){
  var pa=a.split('-'),pb=b.split('-');
  var da=new Date(+pa[0],+pa[1]-1,+pa[2]), db=new Date(+pb[0],+pb[1]-1,+pb[2]);
  return Math.round((db-da)/86400000);
}

var PLANTS_STORE_KEY = 'plants:data';

window.LO_PLANTS = [
  { id:'peace', name:'Peace Lily', latin:'Spathiphyllum', emoji:'🌿', soakDays:7, hue:'#6be3a4',
    mist:'Mist fronds daily — loves humidity. Soil can stay lightly moist.',
    tips:['Low-to-medium indirect light, tolerates shade','Drooping leaves mean thirsty — it recovers fast','Drench until water runs out the bottom, empty the saucer'] },
  { id:'areca', name:'Areca Palm', latin:'Dypsis lutescens', emoji:'🌴', soakDays:6, hue:'#38bdf8',
    mist:'Mist fronds daily — brown tips mean the air is too dry.',
    tips:['Bright indirect light, not harsh direct sun','Thirstiest plant here — keep the root ball consistently moist, never let it dry fully','Soak deeply every 6 days; surface spraying alone leaves the lower roots dry'] },
  { id:'dracaena', name:'Dracaena Marginata', latin:'Dracaena marginata', emoji:'🌱', soakDays:14, hue:'#a3e635',
    mist:'Light mist is fine — not essential.',
    tips:['Bright indirect light','Let soil dry between soaks','Sensitive to fluoride in tap water — filtered is better'] },
  { id:'aloe', name:'Aloe Vera', latin:'Aloe barbadensis', emoji:'🌵', soakDays:21, hue:'#facc15',
    mist:'Light mist only. Never let water sit in the leaf rosette — it rots.',
    tips:['Full sun windowsill is ideal','Soak deeply then let it go completely dry for weeks','Well-draining pot — never leave it standing in water','Underwatering is far safer than overwatering'] },
  { id:'haworthia', name:'Haworthia', latin:'Haworthia fasciata', emoji:'🪴', soakDays:21, hue:'#5eead4',
    mist:'Mist the soil, not the centre. Water pooling in the rosette rots the crown.',
    tips:['Bright light, tolerates direct sun','Extremely drought tolerant','Soak fully then leave completely dry until the soil has no moisture at all','Slow grower — that is normal'] }
];

/* status is one of 'never' | 'soaked-today' | 'overdue' | 'due' | 'ok' —
   thresholds copied verbatim from plants.html's original plantCard() logic */
window.LO_PLANT_STATE = function(plantId){
  var p = null, i;
  for (i=0;i<window.LO_PLANTS.length;i++){ if (window.LO_PLANTS[i].id === plantId){ p = window.LO_PLANTS[i]; break; } }
  if (!p) return null;

  var data = storeGet(PLANTS_STORE_KEY) || {};
  var rec = data[plantId] || {};
  var last = rec.lastSoak;
  var today = getActiveDateString();
  var daysSince = last ? dayDiff(last, today) : null;
  var daysLeft = (daysSince != null) ? p.soakDays - daysSince : null;
  var justSoaked = (last === today);

  var status, statusText;
  if (!last){
    status = 'never'; statusText = 'never soaked — soak now';
  } else if (justSoaked){
    status = 'soaked-today'; statusText = 'soaked today ✓';
  } else if (daysLeft != null && daysLeft <= 0){
    status = 'overdue'; statusText = Math.abs(daysLeft) + ' day' + (Math.abs(daysLeft)===1?'':'s') + ' overdue';
  } else if (daysLeft != null && daysLeft <= 2){
    status = 'due'; statusText = 'due ' + (daysLeft === 0 ? 'today' : (daysLeft === 1 ? 'tomorrow' : 'in ' + daysLeft + ' days'));
  } else {
    status = 'ok'; statusText = daysLeft + ' days until next soak';
  }

  var pct = !last ? 100 : Math.min(100, (daysSince / p.soakDays) * 100);

  return { lastSoak:(last || null), daysSince:daysSince, daysLeft:daysLeft, pct:pct, status:status, statusText:statusText };
};

window.LO_PLANT_COUNTS = function(){
  var overdue = 0, due = 0, ok = 0;
  window.LO_PLANTS.forEach(function(p){
    var st = window.LO_PLANT_STATE(p.id).status;
    if (st === 'overdue') overdue++;
    else if (st === 'due' || st === 'never') due++;
    else ok++;
  });
  return { overdue:overdue, due:due, ok:ok };
};

window.LO_PLANT_SOAK = function(plantId){
  var data = storeGet(PLANTS_STORE_KEY) || {};
  if (!data[plantId]) data[plantId] = {};
  data[plantId].lastSoak = getActiveDateString();
  storeSet(PLANTS_STORE_KEY, data);
};
