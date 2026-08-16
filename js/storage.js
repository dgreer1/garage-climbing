// storage.js - simple loader/saver for data files and localStorage
async function loadJSON(path){
  try{
    const res = await fetch(path + '?_=' + Date.now());
    if(!res.ok) return null;
    return await res.json();
  }catch(e){
    return null;
  }
}

function saveToLocal(key, obj){
  localStorage.setItem(key, JSON.stringify(obj));
}

function loadFromLocal(key){
  const s = localStorage.getItem(key); if(!s) return null; return JSON.parse(s);
}

function downloadJSON(filename,obj){
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(obj,null,2));
  const a = document.createElement('a'); a.setAttribute('href', dataStr); a.setAttribute('download', filename); document.body.appendChild(a); a.click(); a.remove();
}

function readFileInput(file, cb){
  const reader = new FileReader();
  reader.onload = ()=>{ try{ cb(JSON.parse(reader.result)); }catch(e){ alert('Invalid JSON file'); }};
  reader.readAsText(file);
}

export { loadJSON, saveToLocal, loadFromLocal, downloadJSON, readFileInput };
