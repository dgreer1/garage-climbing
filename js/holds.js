// holds.js - fast digitisation and editing of holds
import { loadJSON, saveToLocal, loadFromLocal, downloadJSON, readFileInput } from './storage.js';

class HoldsApp{
  constructor(){
    this.img = document.getElementById('wallImage');
    this.svg = document.getElementById('svgOverlay');
    this.root = document.getElementById('adminApp');
    this.holdListEl = document.getElementById('holdList');
    this.holdPropsEl = document.getElementById('holdProps');
    this.modeRegisterBtn = document.getElementById('modeRegister');
    this.modeHoldsBtn = document.getElementById('modeHolds');
    this.downloadBtn = document.getElementById('downloadHolds');
    this.importInput = document.getElementById('importHolds');

    this.holds = [];
    this.mode = 'register'; // 'register' or 'holds'
    this.dragging = null; // {id, offsetX, offsetY}
    this.undoStack = [];

    this.setup();
  }

  async setup(){
    const remote = await loadJSON('data/holds.json');
    if(remote && remote.holds) this.holds = remote.holds.slice();
    const local = loadFromLocal('holds'); if(local) this.holds = local.holds.slice();
    this.attach();
    this.render();
  }

  attach(){
    // mode buttons are handled by shared UI updater; just ensure setMode responds when called
    // svg interactions
    if(this.svg) {
      this.svg.addEventListener('pointerdown', (e)=> this.onPointerDown(e));
      window.addEventListener('pointermove', (e)=> this.onPointerMove(e));
      window.addEventListener('pointerup', (e)=> this.onPointerUp(e));
    }
    if(this.root) this.root.addEventListener('click', (e)=> this.onRootClick(e));
    if(this.downloadBtn) this.downloadBtn.addEventListener('click', ()=> downloadJSON('holds.json',{holds:this.holds}));
    if(this.importInput) this.importInput.addEventListener('change', (e)=>{ const f = e.target.files[0]; if(!f) return; readFileInput(f, (d)=>{ if(d.holds){ this.holds = d.holds; this.save(); this.render(); } else alert('No holds array found'); }); });
    // clear local holds (button moved into holds section)
    const clearH = document.getElementById('clearHolds'); if(clearH) clearH.addEventListener('click', ()=>{ if(confirm('Clear local holds? This cannot be undone.')){ localStorage.removeItem('holds'); this.holds = []; this.save(); this.render(); }});
  }

  setMode(m){
    this.mode = m;
    // update registration app mode so CP clicks are ignored when in holds mode
    if(window.regApp) window.regApp.mode = (m==='register') ? 'register' : 'other';
    if(m==='holds'){
      if(window.regApp && window.regApp.instructionsEl) window.regApp.instructionsEl.textContent = 'Holds mode: click to add holds; drag to move; select to edit';
    } else {
      if(window.regApp && window.regApp.instructionsEl) window.regApp.instructionsEl.textContent = 'click on the image to add CPs';
    }
    // update shared UI (buttons) if available
    if(window.updateModeUI) window.updateModeUI(m);
    this.render();
  }

  onRootClick(e){
    // only handle add-clicks when in holds mode and click on image area
    if(this.mode !== 'holds') return;
    // ignore clicks on UI buttons
    const tgt = e.target; if(!tgt) return;
    if(tgt.closest('.btn') || tgt.closest('.cp-item') || tgt.closest('#holdList')) return;
    // calculate normalized coords relative to image
    const rect = this.img.getBoundingClientRect();
    const x = (e.clientX - rect.left)/rect.width; const y = (e.clientY - rect.top)/rect.height;
    if(x<0||x>1||y<0||y>1) return;
    // add new hold
    const id = this.nextId();
    const h = { id:id, x:Number(x.toFixed(6)), y:Number(y.toFixed(6)), colour:'blue', gridRef:'', notes:'', active:true };
    this.holds.push(h);
    this.pushUndo({type:'add', hold:h.id});
    this.save(); this.render();
  }

  onPointerDown(e){
    if(this.mode !== 'holds') return;
    const tgt = e.target; if(!tgt) return;
    if(tgt.tagName === 'circle'){
      const id = this.findHoldIdFromElement(tgt);
      if(!id) return;
      // start dragging
      const rect = this.img.getBoundingClientRect();
      const cx = parseFloat(tgt.getAttribute('cx'));
      const cy = parseFloat(tgt.getAttribute('cy'));
      this.dragging = { id, startX: e.clientX, startY: e.clientY, origX: cx, origY: cy, rect };
      tgt.setPointerCapture(e.pointerId);
    }
  }

  onPointerMove(e){
    if(!this.dragging) return;
    const d = this.dragging;
    const dx = e.clientX - d.startX; const dy = e.clientY - d.startY;
    const newXpx = d.origX + dx; const newYpx = d.origY + dy;
    // convert px to normalized
    const nx = newXpx / d.rect.width; const ny = newYpx / d.rect.height;
    const hold = this.holds.find(h=>h.id===d.id);
    if(hold){ hold.x = Number(Math.max(0,Math.min(1,nx)).toFixed(6)); hold.y = Number(Math.max(0,Math.min(1,ny)).toFixed(6)); this.save(); this.render(); }
  }

  onPointerUp(e){
    if(!this.dragging) return;
    // finalize
    this.pushUndo({type:'move', hold:this.dragging.id});
    this.dragging = null;
  }

  findHoldIdFromElement(el){
    // assume parent g contains text with id
    const g = el.parentNode; if(!g) return null;
    const txt = g.querySelector('text'); if(!txt) return null; return txt.textContent;
  }

  nextId(){
    const existing = this.holds.map(h=>h.id);
    let n=1; while(existing.includes('H'+String(n).padStart(3,'0'))) n++; return 'H'+String(n).padStart(3,'0');
  }

  save(){ saveToLocal('holds',{holds:this.holds}); }

  pushUndo(op){ this.undoStack.push(op); if(this.undoStack.length>50) this.undoStack.shift(); }

  render(){
    // render holds list
    this.holdListEl.innerHTML='';
    for(const h of this.holds){
      const div = document.createElement('div'); div.className='cp-item';
      // show editable input only when this hold is selected
      const isSelected = this.selectedHold && this.selectedHold.id === h.id;
      const displayName = h.name || h.id;
      const leftHtml = isSelected
        ? `<input class="hold-name" data-id="${h.id}" value="${displayName}" style="width:140px;margin-right:0.5rem" /> ${h.gridRef?('['+h.gridRef+']'):''} ${h.active? '':'(inactive)'} `
        : `<span class="hold-name-display" data-id="${h.id}" style="display:inline-block;width:140px;margin-right:0.5rem">${displayName}</span> ${h.gridRef?('['+h.gridRef+']'):''} ${h.active? '':'(inactive)'} `;
      div.innerHTML = `<div>${leftHtml}</div><div><button class='small' data-id='${h.id}' data-action='select'>Select</button></div>`;
      this.holdListEl.appendChild(div);
      if(isSelected){
        const nameInput = div.querySelector('.hold-name');
        nameInput.addEventListener('change', (ev)=>{ const v = ev.target.value.trim(); const ho = this.holds.find(x=>x.id===h.id); if(ho){ ho.name = v || ho.id; this.save(); this.render(); } });
      }
      div.querySelector('button').addEventListener('click', ()=> this.selectHold(h.id));
    }
    // render SVG markers (keep CPs already drawn by regApp, so we append holds)
    // remove existing hold markers
    // markers grouped with class 'hold-marker'
    const existing = Array.from(this.svg.querySelectorAll('.hold-marker')); existing.forEach(n=>n.remove());
    const rect = this.img.getBoundingClientRect(); const w = rect.width || Number(this.svg.getAttribute('width'))||800; const h = rect.height || Number(this.svg.getAttribute('height'))||600;
    for(const ho of this.holds){
      const cx = ho.x * w; const cy = ho.y * h;
      const g = document.createElementNS('http://www.w3.org/2000/svg','g'); g.classList.add('hold-marker');
      const circle = document.createElementNS('http://www.w3.org/2000/svg','circle');
      circle.setAttribute('cx', cx); circle.setAttribute('cy', cy); circle.setAttribute('r', 6); circle.setAttribute('fill', ho.colour||'blue'); circle.setAttribute('stroke','#fff'); circle.setAttribute('stroke-width',1);
      const text = document.createElementNS('http://www.w3.org/2000/svg','text'); text.setAttribute('x', cx+8); text.setAttribute('y', cy+4); text.setAttribute('fill','#111'); text.setAttribute('font-size',10); text.textContent = (ho.name && ho.name.length>0) ? ho.name : ho.id;
      g.appendChild(circle); g.appendChild(text);
      this.svg.appendChild(g);
    }
    // render selected hold props
    if(this.selectedHold) this.renderProps(this.selectedHold);
  }

  selectHold(id){
    this.selectedHold = this.holds.find(h=>h.id===id);
    this.render();
    this.renderProps(this.selectedHold);
  }

  renderProps(h){
    if(!h){ this.holdPropsEl.innerHTML=''; return; }
    this.holdPropsEl.innerHTML = `
      <div><strong>${h.id}</strong></div>
      <div style="margin-top:0.5rem">Grid ref: <input id="propGrid" value="${h.gridRef||''}" /></div>
      <div style="margin-top:0.5rem">Colour: <input id="propColour" value="${h.colour||''}" /></div>
      <div style="margin-top:0.5rem">Notes: <textarea id="propNotes">${h.notes||''}</textarea></div>
      <div style="margin-top:0.5rem"><label><input id="propActive" type="checkbox" ${h.active? 'checked':''} /> Active</label></div>
      <div style="margin-top:0.5rem"><button id="propSave" class="btn small">Save</button> <button id="propDelete" class="btn small">Delete</button></div>
    `;
    document.getElementById('propSave').addEventListener('click', ()=>{
      h.gridRef = document.getElementById('propGrid').value;
      h.colour = document.getElementById('propColour').value || 'blue';
      h.notes = document.getElementById('propNotes').value;
      h.active = document.getElementById('propActive').checked;
      this.save(); this.render();
    });
    document.getElementById('propDelete').addEventListener('click', ()=>{ if(confirm('Delete hold '+h.id+'?')){ this.holds = this.holds.filter(x=>x.id!==h.id); this.save(); this.selectedHold = null; this.render(); } });
  }
}

window.addEventListener('DOMContentLoaded', ()=>{ window.holdsApp = new HoldsApp(); });

export default HoldsApp;
