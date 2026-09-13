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
    this.photoCps = {}; // per-photo control points when registering an image (id -> {x,y})
    this.editingPhotoCpId = null; // which canonical CP id is being assigned on next click
    this.currentImageName = DEFAULT_IMG;
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
    document.getElementById('useRepoImg').addEventListener('click', ()=>{ this.currentImageName = DEFAULT_IMG; this.photoCps = {}; this.imgEl.src = DEFAULT_IMG; this.renderList(); });
    document.getElementById('imgFile').addEventListener('change', (e)=>{ const f = e.target.files[0]; if(!f) return; this.currentImageName = f.name; this.photoCps = {}; const url = URL.createObjectURL(f); this.imgEl.src = url; this.renderList(); });
    document.getElementById('downloadCPs').addEventListener('click', ()=> this.downloadCanonicalCPs());
    const downloadImageCPs = document.getElementById('downloadImageCPs');
    if(downloadImageCPs) downloadImageCPs.addEventListener('click', ()=> this.downloadImageCPs());
    document.getElementById('importCPs').addEventListener('change', (e)=>{ const f = e.target.files[0]; if(!f) return; readFileInput(f, (d)=>{ if(d.controlPoints) { this.cps = d.controlPoints; this.saveLocal(); this.renderList(); } else alert('No controlPoints array found'); }); });
    // layouts (per-image) save/load
    const saveLayoutBtn = document.getElementById('saveLayout'); if(saveLayoutBtn) saveLayoutBtn.addEventListener('click', ()=> this.saveLayoutForImage());
    const applyLayoutBtn = document.getElementById('applyLayout'); if(applyLayoutBtn) applyLayoutBtn.addEventListener('click', ()=> this.applyLayoutToHolds());
    const downloadLayouts = document.getElementById('downloadLayouts'); if(downloadLayouts) downloadLayouts.addEventListener('click', ()=> downloadJSON('layouts.json', this.loadLayouts() || {}));
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
    // if assigning a photo CP mapping, handle that first
    if(this.editingPhotoCpId){ this.assignPhotoCpAt(x,y); return; }
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

  // called when the user clicks a CP's "Set on image" in the list — next image click will assign that CP id on current image
  setPhotoCpPending(id){ this.editingPhotoCpId = id; if(this.instructionsEl) this.instructionsEl.textContent = `Assign ${id}: click on the image to set its position for this photo`; }

  assignPhotoCpAt(x,y){ if(!this.editingPhotoCpId) return; this.photoCps[this.editingPhotoCpId] = { x: Number(x.toFixed(6)), y: Number(y.toFixed(6)) }; this.editingPhotoCpId = null; if(this.instructionsEl) this.instructionsEl.textContent = 'click on the image to add CPs'; this.renderList(); }

  downloadCanonicalCPs(){
    const imageControlPoints = this.cps
      .filter(cp => this.photoCps[cp.id])
      .map(cp => ({
        id: cp.id,
        canonical: { x: cp.x, y: cp.y },
        image: { x: this.photoCps[cp.id].x, y: this.photoCps[cp.id].y }
      }));
    const exportData = { controlPoints: this.cps };
    if(imageControlPoints.length > 0){
      exportData.image = this.currentImageName;
      exportData.imageControlPoints = imageControlPoints;
    }
    downloadJSON('control-points.json', exportData);
  }

  downloadImageCPs(){
    const imageControlPoints = this.cps
      .filter(cp => this.photoCps[cp.id])
      .map(cp => ({
        id: cp.id,
        canonical: { x: cp.x, y: cp.y },
        image: { x: this.photoCps[cp.id].x, y: this.photoCps[cp.id].y }
      }));
    if(imageControlPoints.length === 0){
      alert('No image control points have been assigned. Click Set on image for each CP, then click its position on the image.');
      return;
    }
    downloadJSON('image-control-points.json', {
      image: this.currentImageName,
      imageControlPoints
    });
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
      const assigned = this.photoCps[cp.id] ? ` — photo: (${this.photoCps[cp.id].x.toFixed(3)}, ${this.photoCps[cp.id].y.toFixed(3)})` : '';
      const div = document.createElement('div'); div.className='cp-item';
      div.innerHTML = `<div>${cp.id} (${cp.x.toFixed(3)}, ${cp.y.toFixed(3)})${assigned}</div><div><button class="small" title="Move this canonical control point on the reference image." data-id="${cp.id}" data-action="move">Move</button> <button class="small" title="Delete this canonical control point." data-id="${cp.id}" data-action="delete">Delete</button> <button class="small" title="Choose this CP, then click its matching location on the currently loaded image." data-id="${cp.id}" data-action="setphoto">Set on image</button></div>`;
      this.cpListEl.appendChild(div);
      div.querySelectorAll('button').forEach(btn=>{
        const action = btn.dataset.action;
        if(action === 'move') btn.addEventListener('click', ()=> this.editCP(cp.id));
        if(action === 'delete') btn.addEventListener('click', ()=> this.deleteCP(cp.id));
        if(action === 'setphoto') btn.addEventListener('click', ()=> this.setPhotoCpPending(cp.id));
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
    // draw canonical control points only when in register/CP mode
    if(this.mode === 'register'){
      for(const cp of this.cps){
      const cx = cp.x * w; const cy = cp.y * h;
      const g = document.createElementNS('http://www.w3.org/2000/svg','g');
      const circle = document.createElementNS('http://www.w3.org/2000/svg','circle');
      // smaller marker radius so dots are not too large
      circle.setAttribute('cx', cx); circle.setAttribute('cy', cy); circle.setAttribute('r', 2.5); circle.setAttribute('fill','#ff5722'); circle.setAttribute('stroke','#fff'); circle.setAttribute('stroke-width',1.5);
      // highlight the CP being edited
      if(this.editingId === cp.id){ circle.setAttribute('fill','#ffd54f'); circle.setAttribute('r',3.5); circle.setAttribute('stroke','#222'); }
      circle.style.cursor = 'pointer';
      circle.setAttribute('pointer-events','all');
      const text = document.createElementNS('http://www.w3.org/2000/svg','text'); text.setAttribute('x', cx+8); text.setAttribute('y', cy+4); text.setAttribute('fill','#111'); text.setAttribute('font-size',12); text.textContent = cp.id;
      text.style.pointerEvents = 'none';
      g.appendChild(circle); g.appendChild(text);
        this.svg.appendChild(g);
      }
      // draw photo-assigned CPs as larger hollow markers in a different colour
      for(const id in this.photoCps){
        const p = this.photoCps[id];
        const cx = p.x * w; const cy = p.y * h;
        const g = document.createElementNS('http://www.w3.org/2000/svg','g');
        const circ = document.createElementNS('http://www.w3.org/2000/svg','circle');
        circ.setAttribute('cx', cx); circ.setAttribute('cy', cy); circ.setAttribute('r', 5); circ.setAttribute('fill', 'none'); circ.setAttribute('stroke', '#3b82f6'); circ.setAttribute('stroke-width', 2);
        const txt = document.createElementNS('http://www.w3.org/2000/svg','text'); txt.setAttribute('x', cx+8); txt.setAttribute('y', cy+4); txt.setAttribute('fill','#0b3'); txt.setAttribute('font-size',12); txt.textContent = id;
        g.appendChild(circ); g.appendChild(txt); this.svg.appendChild(g);
      }
    }
  }

  // save layout for current image: compute homography from canonical CPs -> photo CPs and store
  loadLayouts(){ try{ return JSON.parse(localStorage.getItem('layouts') || '{}'); }catch(e){ return {}; } }

  saveLayouts(obj){ try{ localStorage.setItem('layouts', JSON.stringify(obj)); }catch(e){}
  }

  saveLayoutForImage(){
    // require layoutName and at least 4 matched CPs
    const nameInput = document.getElementById('layoutName'); if(!nameInput) return alert('Provide a layout id in the input');
    const id = nameInput.value && nameInput.value.trim(); if(!id) return alert('Enter a layout id (short string)');
    const imgSrc = this.imgEl.getAttribute('src') || 'image';
    // build pairs from canonical cps and this.photoCps
    const pairs = [];
    for(const cp of this.cps){ if(this.photoCps[cp.id]) pairs.push({ id: cp.id, canonical: {x: cp.x, y: cp.y}, photo: {x: this.photoCps[cp.id].x, y: this.photoCps[cp.id].y} }); }
    if(pairs.length < 4) return alert('At least 4 assigned control points are required to compute a projective transform.');
    // prepare arrays
    const src = pairs.map(p=> [p.canonical.x, p.canonical.y]);
    const dst = pairs.map(p=> [p.photo.x, p.photo.y]);
    const H = computeHomography(src, dst); // maps canonical -> photo
    if(!H) return alert('Failed to compute transform');
    const layouts = this.loadLayouts() || {};
    layouts[id] = { image: this.currentImageName || imgSrc, pairs: pairs, H: H };
    this.saveLayouts(layouts);
    downloadJSON('layouts-'+id+'.json', layouts[id]);
    alert('Layout saved locally and downloaded. Commit to repo as data/layouts.json if desired.');
  }

  applyLayoutToHolds(){
    const nameInput = document.getElementById('layoutName'); if(!nameInput) return alert('Provide a layout id in the input');
    const id = nameInput.value && nameInput.value.trim(); if(!id) return alert('Enter a layout id');
    const layouts = this.loadLayouts()||{}; const layout = layouts[id]; if(!layout) return alert('No layout found with that id');
    const H = layout.H; if(!H) return alert('Layout has no transform');
    // load existing holds (from data or local) and map their coords
    const localHolds = loadFromLocal('holds');
    let holds = (localHolds && localHolds.holds) ? localHolds.holds.slice() : null;
    // try remote if no local
    loadJSON('data/holds.json').then(d=>{
      if(!holds) holds = (d && d.holds) ? d.holds.slice() : [];
      const newHolds = holds.map(h=>{
        const [nx, ny] = applyH(H, h.x, h.y);
        return Object.assign({}, h, { x: Number(nx.toFixed(6)), y: Number(ny.toFixed(6)) });
      });
      downloadJSON('holds-updated.json', { holds: newHolds });
      alert('Downloaded updated holds JSON as holds-updated.json. Review and commit to data/holds.json if correct.');
    }).catch(err=> alert('Failed to load existing holds: ' + err));
  }

  // apply homography H (array 9) to point (x,y) in normalized coords
  
}

function applyH(H, x, y){
  const a = H;
  const u = a[0]*x + a[1]*y + a[2];
  const v = a[3]*x + a[4]*y + a[5];
  const w = a[6]*x + a[7]*y + a[8];
  if(!w) return [u, v];
  return [u/w, v/w];

}

// compute homography mapping from array of [x,y] src to array of [u,v] dst (normalized coords). returns array H of 9 elements row-major where H[8]=1
function computeHomography(srcPts, dstPts){
  const n = srcPts.length; if(n < 4) return null;
  // solve linear system A h = b for h (8 unknowns), with h9 = 1
  const A = []; const b = [];
  for(let i=0;i<n;i++){
    const [x,y] = srcPts[i]; const [u,v] = dstPts[i];
    A.push([ x, y, 1, 0, 0, 0, -x*u, -y*u ]); b.push(u);
    A.push([ 0, 0, 0, x, y, 1, -x*v, -y*v ]); b.push(v);
  }
  const h = solveLinearSystem(A, b); if(!h) return null;
  const H = [h[0],h[1],h[2],h[3],h[4],h[5],h[6],h[7],1];
  return H;
}

// simple Gaussian elimination solver for Ax=b, A is m x m (square), given as array of rows
function solveLinearSystem(A, b){
  const m = A.length; if(m === 0) return null; const n = A[0].length; if(m !== n) {
    // if overdetermined (more equations than unknowns), solve normal equations (A^T A x = A^T b)
    const At = transpose(A);
    const AtA = mulMat(At, A);
    const Atb = mulMatVec(At, b);
    return solveLinearSystem(AtA, Atb);
  }
  // augment
  const M = []; for(let i=0;i<m;i++){ M.push(A[i].slice()); M[i].push(b[i]); }
  const N = m;
  for(let i=0;i<N;i++){
    // pivot
    let maxRow = i; for(let k=i+1;k<N;k++) if(Math.abs(M[k][i]) > Math.abs(M[maxRow][i])) maxRow = k;
    if(Math.abs(M[maxRow][i]) < 1e-12) return null; // singular
    const tmp = M[i]; M[i] = M[maxRow]; M[maxRow] = tmp;
    const diag = M[i][i];
    for(let j=i;j<=N;j++) M[i][j] /= diag;
    for(let r=0;r<N;r++) if(r!==i){ const factor = M[r][i]; for(let c=i;c<=N;c++) M[r][c] -= factor * M[i][c]; }
  }
  const x = new Array(N); for(let i=0;i<N;i++) x[i] = M[i][N]; return x;
}

function transpose(A){ const r = A.length, c = A[0].length; const T = []; for(let j=0;j<c;j++){ const row = []; for(let i=0;i<r;i++) row.push(A[i][j]); T.push(row);} return T; }
function mulMat(A,B){ const r=A.length, m=A[0].length, c=B[0].length; const C = Array.from({length:r}, ()=> Array(c).fill(0)); for(let i=0;i<r;i++) for(let k=0;k<m;k++) for(let j=0;j<c;j++) C[i][j] += A[i][k]*B[k][j]; return C; }
function mulMatVec(A, v){ const r=A.length, c=A[0].length; const out = Array(r).fill(0); for(let i=0;i<r;i++) for(let j=0;j<c;j++) out[i] += A[i][j]*v[j]; return out; }

window.addEventListener('DOMContentLoaded', ()=>{
  const appRoot = document.getElementById('adminApp');
  window.regApp = new RegistrationApp(appRoot);
  // global mode UI updater used by both apps
  window.updateModeUI = (mode)=>{
    const btnReg = document.getElementById('modeRegister');
    const btnH = document.getElementById('modeHolds');
    const btnC = document.getElementById('modeClimbs');
    if(btnReg) btnReg.classList.toggle('active', mode==='register');
    if(btnH) btnH.classList.toggle('active', mode==='holds');
    if(btnC) btnC.classList.toggle('active', mode==='climbs');
    // set registration app mode
    if(window.regApp) window.regApp.mode = (mode==='register') ? 'register' : 'other';
    if(window.regApp) window.regApp.renderSVG();
    // set holds app mode if present
    if(window.holdsApp) window.holdsApp.mode = (mode==='holds' || mode==='climbs') ? mode : 'register';
    if(window.holdsApp) window.holdsApp.render();
    // show/hide right-side sections
    const cpSec = document.getElementById('cpSection');
    const holdsSec = document.getElementById('holdsSection');
    const climbsSec = document.getElementById('climbsSection');
    if(cpSec) cpSec.classList.toggle('hidden', mode!=='register');
    if(holdsSec) holdsSec.classList.toggle('hidden', mode!=='holds');
    if(climbsSec) climbsSec.classList.toggle('hidden', mode!=='climbs');
    // render climbs UI if present
    if(window.climbApp) window.climbApp.render();
    // update instructions
    const ctl = document.querySelector('.controls');
    if(ctl){
      let txt = '';
      if(mode==='register') txt = 'click on the image to add CPs';
      else if(mode==='holds') txt = 'click on the image to add/drag holds';
      else if(mode==='climbs') txt = 'Climb mode: record a sequence of holds';
      ctl.innerHTML = `Mode: <strong>${mode==='register' ? 'Register control points' : mode==='holds' ? 'Holds' : 'Climbs'}</strong> — <span id="modeInstructions">${txt}</span>`;
    }
  };

  // wire mode buttons to the shared updater
  const bReg = document.getElementById('modeRegister'); if(bReg) bReg.addEventListener('click', ()=> window.updateModeUI('register'));
  const bH = document.getElementById('modeHolds'); if(bH) bH.addEventListener('click', ()=> window.updateModeUI('holds'));
  const bC = document.getElementById('modeClimbs'); if(bC) bC.addEventListener('click', ()=> window.updateModeUI('climbs'));

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
