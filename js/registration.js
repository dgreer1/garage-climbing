// registration.js - handle wall image display and normalized coordinate clicks using SVG overlay
import { loadJSON, saveToLocal, loadFromLocal, downloadJSON, readFileInput } from './storage.js';

const DEFAULT_IMG = 'georef_image.jpg';

class RegistrationApp{
  constructor(root){
    this.root = root;
    this.imgEl = root.querySelector('#wallImage');
    // some controls live outside the app root; select them from document
    this.svg = document.getElementById('svgOverlay') || root.querySelector('svg');
    this.cpListEl = document.getElementById('cpList');
    this.cps = [];
    this.mode = 'register';
    this.editingId = null; // id of CP being moved
    this.instructionsEl = document.getElementById('modeInstructions');
    this.setup();
  }

  async setup(){
    // try load control points from data/control-points.json then localStorage
    const remote = await loadJSON('data/control-points.json');
    if(remote && remote.controlPoints) this.cps = remote.controlPoints.slice();
    const local = loadFromLocal('controlPoints'); if(local) this.cps = local.controlPoints.slice();
    this.renderList();
    this.attachEvents();
  }

  attachEvents(){
    // attach a single listener on the app root to avoid duplicate events
    if(this.root) this.root.addEventListener('click', (e)=>this.onImageClick(e));
    window.addEventListener('resize', ()=>this.syncSVGSize());
    this.imgEl.addEventListener('load', ()=>{ this.syncSVGSize(); this.renderList(); });
    document.getElementById('useRepoImg').addEventListener('click', ()=>{ this.imgEl.src = DEFAULT_IMG; });
    document.getElementById('imgFile').addEventListener('change', (e)=>{ const f = e.target.files[0]; if(!f) return; const url = URL.createObjectURL(f); this.imgEl.src = url; });
    document.getElementById('downloadCPs').addEventListener('click', ()=> downloadJSON('control-points.json',{controlPoints:this.cps}));
    document.getElementById('importCPs').addEventListener('change', (e)=>{ const f = e.target.files[0]; if(!f) return; readFileInput(f, (d)=>{ if(d.controlPoints) { this.cps = d.controlPoints; this.saveLocal(); this.renderList(); } else alert('No controlPoints array found'); }); });
    // clear local control points (button moved into CP section)
    const clearCPs = document.getElementById('clearCPs');
    if(clearCPs) clearCPs.addEventListener('click', ()=>{ if(confirm('Clear local control points? This cannot be undone.')){ localStorage.removeItem('controlPoints'); this.cps = []; this.saveLocal(); this.renderList(); }});
    // update instructions if present
    if(this.instructionsEl) this.instructionsEl.textContent = 'click on the image to add CPs';
  }

  syncSVGSize(){
    const rect = this.imgEl.getBoundingClientRect();
    if(!this.svg) return;
    // position svg to match the image top-left inside the container and size it to the image
    this.svg.style.left = (this.imgEl.offsetLeft) + 'px';
    this.svg.style.top = (this.imgEl.offsetTop) + 'px';
    this.svg.style.width = rect.width + 'px';
    this.svg.style.height = rect.height + 'px';
    // set explicit SVG attributes so coordinates map 1:1
    try{
      this.svg.setAttribute('width', rect.width);
      this.svg.setAttribute('height', rect.height);
      this.svg.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);
    }catch(e){}
  }

  onImageClick(e){
    if(this.mode !== 'register') return;
    // ignore clicks on existing SVG markers
    const tgt = e.target && e.target.tagName && e.target.tagName.toLowerCase();
    if(tgt === 'circle' || tgt === 'text' || tgt === 'g') return;
    // debug
    // console.log('onImageClick', tgt, e.clientX, e.clientY);
    const rect = this.imgEl.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    if(this.editingId){
      // move existing control point to clicked position
      const cp = this.cps.find(c=>c.id===this.editingId);
      if(cp){ cp.x = Number(x.toFixed(6)); cp.y = Number(y.toFixed(6)); }
      this.editingId = null;
      if(this.instructionsEl) this.instructionsEl.textContent = 'click on the image to add CPs';
      this.saveLocal(); this.renderList();
      return;
    }
    const id = this.nextId();
    const cp = { id: id, x: Number(x.toFixed(6)), y: Number(y.toFixed(6)) };
    this.cps.push(cp);
    this.saveLocal();
    this.renderList();
  }

  nextId(){
    const existing = this.cps.map(c=>c.id).filter(Boolean);
    let n = 1;
    while(existing.includes('CP'+String(n).padStart(2,'0'))) n++;
    return 'CP'+String(n).padStart(2,'0');
  }

  saveLocal(){ saveToLocal('controlPoints',{controlPoints:this.cps}); }

  renderList(){
    this.cpListEl.innerHTML='';
    this.renderSVG();
    for(const cp of this.cps){
      const div = document.createElement('div'); div.className='cp-item';
      div.innerHTML = `<div>${cp.id} (${cp.x.toFixed(3)}, ${cp.y.toFixed(3)})</div><div><button class="small" data-id="${cp.id}" data-action="move">Move</button> <button class="small" data-id="${cp.id}" data-action="delete">Delete</button></div>`;
      this.cpListEl.appendChild(div);
      div.querySelectorAll('button').forEach(btn=>{
        const action = btn.dataset.action;
        if(action === 'move') btn.addEventListener('click', ()=> this.editCP(cp.id));
        if(action === 'delete') btn.addEventListener('click', ()=> this.deleteCP(cp.id));
      });
    }
  }

  editCP(id){
    // enter move/edit mode: next click on the image will reposition this control point
    if(this.editingId === id){
      // cancel
      this.editingId = null;
      if(this.instructionsEl) this.instructionsEl.textContent = 'click on the image to add CPs';
    } else {
      this.editingId = id;
      if(this.instructionsEl) this.instructionsEl.textContent = `Move ${id}: click the image to set new position or click Move again to cancel`;
    }
    this.renderList();
  }

  deleteCP(id){
    if(!confirm(`Delete control point ${id}?`)) return;
    this.cps = this.cps.filter(c=>c.id!==id);
    if(this.editingId === id) this.editingId = null;
    this.saveLocal(); this.renderList();
  }

  renderSVG(){
    // ensure svg sizing is updated
    this.syncSVGSize();
    // clear
    while(this.svg.firstChild) this.svg.removeChild(this.svg.firstChild);
    const rect = this.imgEl.getBoundingClientRect();
    const w = rect.width || Number(this.svg.getAttribute('width')) || 800;
    const h = rect.height || Number(this.svg.getAttribute('height')) || 600;
    for(const cp of this.cps){
      const cx = cp.x * w; const cy = cp.y * h;
      const g = document.createElementNS('http://www.w3.org/2000/svg','g');
      const circle = document.createElementNS('http://www.w3.org/2000/svg','circle');
      // smaller marker radius so dots are not too large
      circle.setAttribute('cx', cx); circle.setAttribute('cy', cy); circle.setAttribute('r', 5); circle.setAttribute('fill','#ff5722'); circle.setAttribute('stroke','#fff'); circle.setAttribute('stroke-width',1.5);
      // highlight the CP being edited
      if(this.editingId === cp.id){ circle.setAttribute('fill','#ffd54f'); circle.setAttribute('r',7); circle.setAttribute('stroke','#222'); }
      circle.style.cursor = 'pointer';
      circle.setAttribute('pointer-events','all');
      const text = document.createElementNS('http://www.w3.org/2000/svg','text'); text.setAttribute('x', cx+8); text.setAttribute('y', cy+4); text.setAttribute('fill','#111'); text.setAttribute('font-size',12); text.textContent = cp.id;
      text.style.pointerEvents = 'none';
      g.appendChild(circle); g.appendChild(text);
      this.svg.appendChild(g);
    }
  }
}

window.addEventListener('DOMContentLoaded', ()=>{
  const appRoot = document.getElementById('adminApp');
  window.regApp = new RegistrationApp(appRoot);
  // global mode UI updater used by both apps
  window.updateModeUI = (mode)=>{
    const btnReg = document.getElementById('modeRegister');
    const btnH = document.getElementById('modeHolds');
    if(btnReg) btnReg.classList.toggle('active', mode==='register');
    if(btnH) btnH.classList.toggle('active', mode==='holds');
    // set registration app mode
    if(window.regApp) window.regApp.mode = (mode==='register') ? 'register' : 'other';
    // set holds app mode if present
    if(window.holdsApp) window.holdsApp.mode = mode==='holds' ? 'holds' : 'register';
    if(window.holdsApp) window.holdsApp.render();
    // update instructions
    const ctl = document.querySelector('.controls');
    if(ctl) ctl.innerHTML = `Mode: <strong>${mode==='register' ? 'Register control points' : 'Holds'}</strong> — <span id="modeInstructions">${mode==='register' ? 'click on the image to add CPs' : 'click on the image to add/drag holds'}</span>`;
  };

  // wire mode buttons to the shared updater
  const bReg = document.getElementById('modeRegister'); if(bReg) bReg.addEventListener('click', ()=> window.updateModeUI('register'));
  const bH = document.getElementById('modeHolds'); if(bH) bH.addEventListener('click', ()=> window.updateModeUI('holds'));

  // set initial mode UI
  window.updateModeUI('register');

  // Export all data (aggregate JSON download)
  const exportBtn = document.getElementById('exportAll');
  if(exportBtn) exportBtn.addEventListener('click', async ()=>{
    const cpLocal = loadFromLocal('controlPoints');
    const holdsLocal = loadFromLocal('holds');
    const controlPoints = (cpLocal && cpLocal.controlPoints) ? cpLocal.controlPoints : (await loadJSON('data/control-points.json'))?.controlPoints || [];
    const holds = (holdsLocal && holdsLocal.holds) ? holdsLocal.holds : (await loadJSON('data/holds.json'))?.holds || [];
    const layouts = (await loadJSON('data/layouts.json')) || {};
    const climbs = (await loadJSON('data/climbs.json')) || {};
    const bundle = { controlPoints, holds, layouts, climbs, exportedAt: new Date().toISOString() };
    downloadJSON('project-data.json', bundle);
  });
});

export default RegistrationApp;
