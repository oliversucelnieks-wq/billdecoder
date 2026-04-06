let currentFile = null;
let letterContent = '';
let usageCount = parseInt(localStorage.getItem('bd_usage') || '0');
const FREE_LIMIT = 3;

document.addEventListener('dragover', e => { e.preventDefault(); document.body.classList.add('dragging'); });
document.addEventListener('dragleave', e => { if (!e.relatedTarget) document.body.classList.remove('dragging'); });
document.addEventListener('drop', e => {
  e.preventDefault(); document.body.classList.remove('dragging');
  const file = e.dataTransfer?.files[0];
  if (file && file.type.startsWith('image/')) handleFile(file);
});

function handleFile(file) {
  if (!file) return;
  if (!file.type.startsWith('image/')) { showToast('Please upload an image file'); return; }
  if (file.size > 10 * 1024 * 1024) { showToast('File too large. Max 10MB.'); return; }
  currentFile = file;
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('preview-img').src = e.target.result;
    document.getElementById('preview-name').textContent = file.name;
    document.getElementById('upload-area').style.display = 'none';
    document.getElementById('upload-preview').style.display = 'flex';
    document.getElementById('analyze-btn').style.display = 'block';
  };
  reader.readAsDataURL(file);
}

function resetUpload() {
  currentFile = null;
  document.getElementById('bill-input').value = '';
  document.getElementById('upload-area').style.display = 'block';
  document.getElementById('upload-preview').style.display = 'none';
  document.getElementById('analyze-btn').style.display = 'none';
  document.getElementById('results').style.display = 'none';
  document.getElementById('upload-card').style.display = 'block';
  document.getElementById('loading-state').style.display = 'none';
}

async function analyzeBill() {
  if (!currentFile) return;
  if (usageCount >= FREE_LIMIT) {
    const go = confirm('Free analyses used. Upgrade to Pro for unlimited?');
    if (go) showPricing(); return;
  }
  const msgs = ['Reading billing codes...','Comparing to Medicare rates...','Checking for duplicate charges...','Identifying overcharges...','Writing your dispute letter...'];
  let mi = 0;
  const el = document.getElementById('loading-msg');
  document.getElementById('upload-card').style.display = 'none';
  document.getElementById('results').style.display = 'none';
  document.getElementById('loading-state').style.display = 'block';
  const iv = setInterval(() => { mi = (mi+1) % msgs.length; el.textContent = msgs[mi]; }, 2500);
  try {
    const fd = new FormData(); fd.append('bill', currentFile);
    const res = await fetch('/api/analyze', { method:'POST', body:fd });
    const data = await res.json();
    clearInterval(iv);
    document.getElementById('loading-state').style.display = 'none';
    if (!res.ok || data.error) { document.getElementById('upload-card').style.display='block'; showToast(data.error || 'Analysis failed.'); return; }
    usageCount++; localStorage.setItem('bd_usage', usageCount);
    renderResults(data.analysis);
  } catch(err) {
    clearInterval(iv);
    document.getElementById('loading-state').style.display = 'none';
    document.getElementById('upload-card').style.display = 'block';
    showToast('Something went wrong. Please try again.');
  }
}

function renderResults(a) {
  const s = a.summary;
  const risk = s.overallRisk || 'medium';
  document.getElementById('score-icon').textContent = risk==='high'?'🚨':risk==='medium'?'⚠️':'✅';
  document.getElementById('score-title').textContent = risk==='high'?'Significant Issues Found':risk==='medium'?'Some Issues Found':'Looks Mostly Clean';
  document.getElementById('score-sub').textContent = (s.errorCount||0)+' issue(s) detected · Potential overcharge: '+fmt(s.potentialOvercharge||0);
  const grid = document.getElementById('summary-grid'); grid.innerHTML='';
  [{val:fmt(s.totalCharged),key:'Total Billed',cls:''},{val:fmt(s.estimatedFairValue),key:'Fair Value',cls:'safe'},{val:fmt(s.potentialOvercharge),key:'Overcharge',cls:s.potentialOvercharge>100?'danger':s.potentialOvercharge>0?'warning':'safe'},{val:s.errorCount||0,key:'Issues',cls:s.errorCount>2?'danger':s.errorCount>0?'warning':'safe'}].forEach(c=>{const el=document.createElement('div');el.className='summary-card '+c.cls;el.innerHTML='<div class="summary-val">'+c.val+'</div><div class="summary-key">'+c.key+'</div>';grid.appendChild(el);});
  const fs=document.getElementById('red-flags-section'),fl=document.getElementById('red-flags-list');fl.innerHTML='';
  if(a.redFlags&&a.redFlags.length){fs.style.display='block';a.redFlags.forEach(f=>{const el=document.createElement('div');el.className='flag-item';el.innerHTML='<div class="flag-dot '+(f.severity||'medium')+'"></div><div><div class="flag-issue">'+esc(f.issue)+'</div><div class="flag-action">'+esc(f.action)+'</div></div>';fl.appendChild(el);})}else{fs.style.display='none';}
  const tb=document.getElementById('items-body');tb.innerHTML='';
  (a.lineItems||[]).forEach(item=>{const tr=document.createElement('tr');tr.innerHTML='<td>'+esc(item.service)+(item.flagReason?'<div class="item-flag-reason">'+esc(item.flagReason)+'</div>':'')+'</td><td>'+(item.cptCode?esc(item.cptCode):'—')+'</td><td>'+fmt(item.chargedAmount||0)+'</td><td>'+fmt(item.estimatedFairAmount||0)+'</td><td><span class="item-status '+(item.flag||'ok')+'">'+(item.flag||'ok').toUpperCase()+'</span></td>';tb.appendChild(tr);});
  const rs=document.getElementById('rec-section'),rl=document.getElementById('rec-list');rl.innerHTML='';
  if(a.recommendations&&a.recommendations.length){rs.style.display='block';a.recommendations.forEach(r=>{const el=document.createElement('div');el.className='rec-item';el.textContent=r;rl.appendChild(el);})}else{rs.style.display='none';}
  const ls=document.getElementById('letter-section');
  if(a.disputeLetter&&a.disputeLetter.body){ls.style.display='block';document.getElementById('letter-subject').textContent=a.disputeLetter.subject||'Medical Bill Dispute';document.getElementById('letter-body').textContent=a.disputeLetter.body;letterContent=(a.disputeLetter.subject||'Medical Bill Dispute')+'

'+a.disputeLetter.body;}else{ls.style.display='none';}
  document.getElementById('results').style.display='block';
  document.getElementById('results').scrollIntoView({behavior:'smooth',block:'start'});
}

function copyLetter(){navigator.clipboard.writeText(letterContent).then(()=>showToast('✅ Letter copied!'));}
function downloadLetter(){const b=new Blob([letterContent],{type:'text/plain'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='medical-bill-dispute.txt';a.click();}
async function checkout(plan){try{const r=await fetch('/api/payment/create-checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({plan})});const d=await r.json();if(d.url)window.location.href=d.url;else showToast('Payment failed.');}catch{showToast('Payment failed.');}}
function fmt(n){if(!n&&n!==0)return'—';return'$'+Number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});}
function esc(s){if(!s)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function showToast(m){const t=document.getElementById('toast');t.textContent=m;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),3500);}
function scrollToUpload(){document.getElementById('upload-section').scrollIntoView({behavior:'smooth'});}
function showPricing(){document.getElementById('pricing-section').scrollIntoView({behavior:'smooth'});}
const p=new URLSearchParams(window.location.search);
if(p.get('payment')==='success'){showToast('🎉 Payment successful! Unlimited analyses unlocked.');localStorage.setItem('bd_usage','0');usageCount=0;history.replaceState({},'','/');}
else if(p.get('payment')==='cancelled'){showToast('Payment cancelled.');history.replaceState({},'','/');}