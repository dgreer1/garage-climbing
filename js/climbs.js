// climbs.js - simple climb creation/editor
import { loadJSON, saveToLocal, loadFromLocal, downloadJSON, readFileInput } from './storage.js';

class ClimbApp{
  constructor(){
    this.climbListEl = document.getElementById('climbList');
    this.climbPropsEl = document.getElementById('climbProps');
    this.nameInput = document.getElementById('climbName');
    this.gradeInput = document.getElementById('climbGrade');
    this.startBtn = document.getElementById('startRecord');
    this.stopBtn = document.getElementById('stopRecord');
    this.saveBtn = document.getElementById('saveClimb');
    this.downloadBtn = document.getElementById('downloadClimbs');
    this.importInput = document.getElementById('importClimbs');

    this.climbs = [];
    this.recording = false;
    this.currentSequence = [];
    this.selectedClimb = null;
    this.addHoldMode = false; // when true, clicks on holds append to selected climb

    this.setup();
  }

  async setup(){
    const remote = await loadJSON('data/climbs.json');
    if(remote && remote.climbs) this.climbs = remote.climbs.slice();
    const local = loadFromLocal('climbs'); if(local) this.climbs = local.climbs.slice();
    this.attach();
    this.render();
  }

  attach(){
    if(this.startBtn) this.startBtn.addEventListener('click', ()=> this.startRecording());
    if(this.stopBtn) this.stopBtn.addEventListener('click', ()=> this.stopRecording());
    if(this.saveBtn) this.saveBtn.addEventListener('click', ()=> this.saveClimb());
    const newBtn = document.getElementById('newClimb'); if(newBtn) newBtn.addEventListener('click', ()=> this.newClimb());
    if(this.downloadBtn) this.downloadBtn.addEventListener('click', ()=> downloadJSON('climbs.json',{climbs:this.climbs}));
    if(this.importInput) this.importInput.addEventListener('change', (e)=>{ const f = e.target.files[0]; if(!f) return; readFileInput(f, (d)=>{ if(d.climbs){ this.climbs = d.climbs; this.save(); this.render(); } else alert('No climbs array found'); }); });
    // capture hold clicks when recording or in add-hold mode
    document.addEventListener('click', (e)=> this.onDocClick(e), true);
  }

  async onDocClick(e){
    // identify if user clicked a hold marker
    const tgt = e.target; if(!tgt) return;
    if(tgt.tagName && tgt.tagName.toLowerCase() === 'circle'){
      // ask holds app for id
      if(window.holdsApp && window.holdsApp.findHoldIdFromElement){
        const id = window.holdsApp.findHoldIdFromElement(tgt);
        if(!id) return;
        // if in add-hold mode and a climb is selected -> append to that climb
        if(this.addHoldMode && this.selectedClimb){
          this.selectedClimb.holds.push(id);
          this.save(); this.render(); this.selectClimb(this.selectedClimb.id);
          return;
        }
        // otherwise if recording, add to currentSequence
        if(this.recording){ this.currentSequence.push(id); this.renderRecording(); }
      }
    }
  }

  startRecording(){
    this.recording = true; this.currentSequence = [];
    if(this.startBtn) this.startBtn.style.display='none';
    if(this.stopBtn) this.stopBtn.style.display='inline-block';
    if(window.updateModeUI) window.updateModeUI('climbs');
  }
  stopRecording(){
    this.recording = false;
    if(this.startBtn) this.startBtn.style.display='inline-block';
    if(this.stopBtn) this.stopBtn.style.display='none';
    this.renderRecording();
  }

  renderRecording(){
    // show current sequence in climbProps
    this.climbPropsEl.innerHTML = `<div><strong>Recording sequence</strong></div><div style="margin-top:0.5rem">${this.currentSequence.join(', ')}</div>`;
  }

  save(){ saveToLocal('climbs',{climbs:this.climbs}); }

  nextId(){ const existing = this.climbs.map(c=>c.id); let n=1; while(existing.includes('CL'+String(n).padStart(3,'0'))) n++; return 'CL'+String(n).padStart(3,'0'); }

  saveClimb(){
    const name = (this.nameInput && this.nameInput.value.trim()) || '';
    const grade = (this.gradeInput && this.gradeInput.value.trim()) || '';
    // If editing an existing climb, update it
    if(this.selectedClimb){
      this.selectedClimb.name = name || this.selectedClimb.id;
      this.selectedClimb.grade = grade;
      this.selectedClimb.notes = document.getElementById('climbNotes') ? document.getElementById('climbNotes').value : (this.selectedClimb.notes||'');
      // if currentSequence has items (from recording), replace holds; otherwise keep existing
      if(this.currentSequence.length>0) this.selectedClimb.holds = this.currentSequence.slice();
      this.save(); this.render(); this.selectClimb(this.selectedClimb.id);
      // clear recording state
      this.currentSequence = [];
      this.renderRecording();
      return;
    }

    if(this.currentSequence.length===0){ if(!confirm('Sequence is empty. Save empty climb?')) return; }
    const id = this.nextId();
    const climb = { id, name: name || id, grade, holds: this.currentSequence.slice(), notes:'', createdAt:new Date().toISOString() };
    this.climbs.push(climb);
    this.save(); this.render();
    this.currentSequence = [];
    this.renderRecording();
    if(this.nameInput) this.nameInput.value=''; if(this.gradeInput) this.gradeInput.value='';
  }

  newClimb(){
    // clear selection and inputs so Save will create a new climb
    this.selectedClimb = null;
    this.currentSequence = [];
    this.addHoldMode = false;
    if(this.nameInput) this.nameInput.value='';
    if(this.gradeInput) this.gradeInput.value='';
    if(this.climbPropsEl) this.climbPropsEl.innerHTML = '';
    this.renderRecording();
    this.render();
  }

  render(){
    this.climbListEl.innerHTML = '';
    for(const c of this.climbs){
      const div = document.createElement('div'); div.className='cp-item';
      div.innerHTML = `<div>${c.id} - ${c.name} (${c.grade})</div><div><button class='small' data-id='${c.id}'>View</button></div>`;
      this.climbListEl.appendChild(div);
      div.querySelector('button').addEventListener('click', ()=> this.selectClimb(c.id));
    }
  }

  selectClimb(id){
    this.selectedClimb = this.climbs.find(c=>c.id===id);
    if(!this.selectedClimb) return;
    // populate editor inputs
    if(this.nameInput) this.nameInput.value = this.selectedClimb.name || '';
    if(this.gradeInput) this.gradeInput.value = this.selectedClimb.grade || '';
    // show holds sequence with edit controls
    const seqHtml = this.selectedClimb.holds.map((hid,idx)=> `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.25rem"><div>${idx+1}. ${hid}</div><div><button class='small' data-idx='${idx}' data-action='up'>▲</button> <button class='small' data-idx='${idx}' data-action='down'>▼</button> <button class='small' data-idx='${idx}' data-action='remove'>Remove</button></div></div>`).join('');
    this.climbPropsEl.innerHTML = `<div><strong>${this.selectedClimb.id} - Editing</strong></div>
      <div style="margin-top:0.5rem"><strong>Sequence</strong></div>
      <div id="climbSeq" style="margin-top:0.5rem">${seqHtml}</div>
      <div style="margin-top:0.5rem"><button id="addHoldToClimb" class="btn small">Add hold (click markers)</button></div>
      <div style="margin-top:0.5rem">Notes: <textarea id="climbNotes">${this.selectedClimb.notes||''}</textarea></div>
      <div style="margin-top:0.5rem"><button id="climbSaveNotes" class="btn small">Save changes</button> <button id="climbDelete" class="btn small">Delete</button></div>`;
    // sequence control handlers
    const seqEl = document.getElementById('climbSeq');
    seqEl.querySelectorAll('button').forEach(btn=>{
      const action = btn.dataset.action; const idx = Number(btn.dataset.idx);
      btn.addEventListener('click', ()=>{
        if(action==='remove'){ this.selectedClimb.holds.splice(idx,1); this.save(); this.selectClimb(this.selectedClimb.id); this.render(); }
        if(action==='up' && idx>0){ const a=this.selectedClimb.holds; [a[idx-1],a[idx]]=[a[idx],a[idx-1]]; this.save(); this.selectClimb(this.selectedClimb.id); this.render(); }
        if(action==='down' && idx < this.selectedClimb.holds.length-1){ const a=this.selectedClimb.holds; [a[idx+1],a[idx]]=[a[idx],a[idx+1]]; this.save(); this.selectClimb(this.selectedClimb.id); this.render(); }
      });
    });
    document.getElementById('addHoldToClimb').addEventListener('click', ()=>{ this.addHoldMode = !this.addHoldMode; document.getElementById('addHoldToClimb').textContent = this.addHoldMode ? 'Stop adding holds' : 'Add hold (click markers)'; });
    document.getElementById('climbSaveNotes').addEventListener('click', ()=>{ this.selectedClimb.notes = document.getElementById('climbNotes').value; this.selectedClimb.name = this.nameInput.value.trim() || this.selectedClimb.id; this.selectedClimb.grade = this.gradeInput.value.trim(); this.save(); this.render(); this.selectClimb(this.selectedClimb.id); });
    document.getElementById('climbDelete').addEventListener('click', ()=>{ if(confirm('Delete '+this.selectedClimb.id+'?')){ this.climbs = this.climbs.filter(x=>x.id!==this.selectedClimb.id); this.selectedClimb = null; this.save(); this.render(); this.climbPropsEl.innerHTML=''; } });
  }
}

window.addEventListener('DOMContentLoaded', ()=>{ window.climbApp = new ClimbApp(); });

export default ClimbApp;
