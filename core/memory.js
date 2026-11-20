(function(root){
  const key='oneshot.mem.v1';function read(){try{const a=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(a)?a.slice(-200):[];}catch{return [];}}
  function write(a){try{localStorage.setItem(key,JSON.stringify(a.slice(-200)));return true;}catch{return false;}}
  function recall(brief){const a=read(),name=root.parseBrief(String(brief)).name;const matched=a.filter(r=>r&&r.name===name);return {total:a.length,hit:matched.length,recent:matched.slice(-3).map(r=>({name:String(r.name).slice(0,32),first:Array.isArray(r.first)?r.first.filter(v=>typeof v==='string').slice(0,8).map(v=>v.slice(0,48)):[]}))};}
  root.TaskMemory={read,write,recall};
})(window);
