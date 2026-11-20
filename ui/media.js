(function(){
  "use strict";
  var q=function(s){return document.querySelector(s);};
  var local=/^https?:$/.test(location.protocol)&&['127.0.0.1','localhost'].includes(location.hostname);
  var API=local?location.origin+'/api':'http://127.0.0.1:41739/api';
  var service=false,rendering=false,reviewing=false,revision=0,reviewVersion=0,reviewReport=null,serial=0,last=null;
  var images=q('#productImages'),make=q('#makeVideo'),file=q('#reviewVideo'),review=q('#runVideoReview'),report=q('#downloadVideoReport');
  function note(text){q('#mediaStatus').textContent=text;}
  var state=q('#mediaRunState'),retry=q('#mediaRetry');
  function stamp(task,status,message){
    if(task!==last)return;
    task.status=status;state.dataset.state=status;state.dataset.run=task.id;
    state.textContent=(task.kind==='render'?'制作':'检查')+' #'+task.id+' · 第 '+task.attempt+' 次 · '+message;
    retry.hidden=status!=='failed';retry.disabled=retry.hidden||!service;
  }
  function begin(kind,again){
    var task=again?last:{kind:kind,id:String(++serial).padStart(3,'0'),attempt:0};
    last=task;task.attempt++;(kind==='render'?make:review).after(state,retry);
    stamp(task,'running',kind==='render'?'正在编码 MP4…':'正在分析视频…');return task;
  }
  function expire(kind){if(last&&last.kind===kind)stamp(last,'stale','输入已变化，旧结果和重试已失效。');}
  function failure(task,e){var msg=e.message||'未知错误';var action=e.status===400||e.status===413?'请修改素材后重新开始。':e instanceof TypeError?'请确认本机服务已启动、重新连接后再重试。':'检查原因后可手动重试，不会自动发起新任务。';stamp(task,'failed','失败：'+msg+'。'+action);note('失败：'+msg+'。'+action);}
  retry.hidden=true;
  function imageError(){var list=Array.from(images.files||[]);return list.length>8||list.some(function(f){return f.size>12*1024*1024||!['image/png','image/jpeg','image/webp'].includes(f.type);});}
  function approved(){var r=window.Workbench.current();return !!(r&&r.status==='delivered'&&r.deliveryApproved&&r.verdict&&r.verdict.pass&&r.verdict.subs.length===4&&!Agent.state.running);}
  var lastSummary='';
  function publishMedia(){const snapshot={online:service,rendering,reviewing,file:!!file.files.length,fileValid:!!file.files.length&&file.files[0].size<=500*1024*1024,imagesValid:!imageError(),film:!!q('#renderFiles .render-file'),report:!!reviewReport&&!report.disabled,kind:last?.kind||'',status:last?.status||''};const sig=JSON.stringify(snapshot);if(sig!==lastSummary){lastSummary=sig;window.dispatchEvent(new CustomEvent('oneshot:media-state',{detail:snapshot}));}return snapshot;}
  window.Workbench.mediaState=publishMedia;
  function controls(){make.disabled=!service||!approved()||imageError()||rendering||reviewing;make.textContent=rendering?'正在制作 MP4…':!service?'连接本机服务后制作':!approved()?'先生成脚本并批准交付':'制作 MP4 与配套文件';retry.disabled=retry.hidden||!service||rendering||reviewing;review.disabled=!service||rendering||reviewing||!file.files.length||file.files[0].size>500*1024*1024;publishMedia();}
  async function json(url,opts,timeout){var controller=new AbortController(),timer=setTimeout(function(){controller.abort();},timeout||240000);try{var r=await fetch(url,Object.assign({},opts,{signal:controller.signal}));if(!r.ok){var err=await r.json().catch(()=>({}));throw Object.assign(new Error((err.error||'请求失败')+' (HTTP '+r.status+')'),{status:r.status});}return await r.json();}catch(e){if(e.name==='AbortError')throw new Error('请求超时；请检查服务窗口后重试，本机任务可能仍在处理。');throw e;}finally{clearTimeout(timer);}}
  function base64(f){return new Promise(function(resolve,reject){var r=new FileReader();r.onload=function(){resolve(String(r.result).split(',')[1]);};r.onerror=function(){reject(new Error('读取文件失败'));};r.readAsDataURL(f);});}
  async function check(){q('#mediaServiceState').textContent='正在连接本机服务…';try{var j=await json(API+'/health',{cache:'no-store'},5000);service=j.ok===true&&j.service==='oneshot-local-media';if(!service)throw new Error('服务身份不匹配');q('#mediaServiceState').textContent='本机 FFmpeg 服务已连接';note('已连接。批准脚本后制作 MP4；检查已有视频无需生成脚本。');}catch(e){service=false;q('#mediaServiceState').textContent='本机服务未连接';note('连接失败：'+e.message+'。请启动 media-service/start.bat，并打开 http://127.0.0.1:41739；网页版本还可能需要允许浏览器的本地网络访问。');}q('#mediaServiceDot').classList.toggle('online',service);controls();}
  function invalidate(){revision++;expire('render');q('#renderFiles').replaceChildren();window.dispatchEvent(new CustomEvent('oneshot:media-invalidated'));controls();}
  window.addEventListener('oneshot:agent-state',function(e){requestAnimationFrame(controls);});
  window.addEventListener('oneshot:script-start',invalidate);
  ['#brief','#platform','#productImages','#videoDuration'].forEach(function(id){q(id).addEventListener(id==='#brief'?'input':'change',invalidate);});
  q('#chips').addEventListener('click',invalidate);q('#btnClear').addEventListener('click',invalidate);
  q('#mediaServiceCheck').addEventListener('click',check);
  images.addEventListener('change',function(){note(imageError()?'最多 8 张 PNG/JPEG/WebP，每张不超过 12 MB。':images.files.length?'商品图已选择；批准脚本后可制作视频。':'未选商品图，将使用品牌色场、分层文字与转场。');controls();});
  function showFiles(manifest){var box=q('#renderFiles');box.replaceChildren();manifest.files.forEach(function(f){var a=document.createElement('a');a.className='render-file';a.href=API+f.url.slice(4);a.textContent=f.name+' · '+Math.max(1,Math.round(f.bytes/1024))+' KB';a.download=f.name;a.rel='noreferrer';box.appendChild(a);});var p=document.createElement('p');p.className='media-note';p.textContent='H.264 · '+manifest.render.video.width+'×'+manifest.render.video.height+' · '+manifest.render.duration.toFixed(1)+' 秒 · 无音轨。'+manifest.disclosure;box.appendChild(p);window.dispatchEvent(new CustomEvent('oneshot:media-ready',{detail:{manifest:manifest,api:API}}));}
  async function render(again){if(!service||!approved()||rendering||reviewing||imageError()){controls();return;}rendering=true;var task=begin('render',again);q('#renderFiles').replaceChildren();window.dispatchEvent(new CustomEvent('oneshot:media-invalidated'));var version=revision,brief=q('#brief').value,lines=Workbench.current().verdict.subs.slice(),platform=q('#platform').value,duration=Number(q('#videoDuration').value),selected=Array.from(images.files);controls();note('正在本机合成四段镜头运动、字幕与转场，再编码 MP4。不会调用模型或自动重试。');try{var imgs=[];for(var f of selected)imgs.push({name:f.name,data:await base64(f)});var out=await json(API+'/render',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({brief:brief,lines:lines,platform:platform,duration:duration,images:imgs})});if(version!==revision||!approved())return;showFiles(out);stamp(task,'done','完成 · 5 份文件 · 服务任务 '+out.job);note('已生成 MP4 和 4 份配套文件。点击文件名下载。');}catch(e){if(version===revision)failure(task,e);}finally{rendering=false;controls();}}
  make.addEventListener('click',()=>render(false));
  file.addEventListener('change',function(){reviewVersion++;expire('review');reviewReport=null;report.disabled=true;q('#videoAnalysis').replaceChildren();var f=file.files[0];q('#videoMeta').textContent=f?f.name+' · '+(f.size/1024/1024).toFixed(1)+' MB · 只发往本机服务':'尚未选择视频';if(f&&f.size>500*1024*1024)note('视频须小于 500 MB。');controls();});
  async function inspect(again){var f=file.files[0];if(!f||!service||rendering||reviewing||f.size>500*1024*1024)return;reviewing=true;var version=reviewVersion,task=begin('review',again);reviewReport=null;q('#videoAnalysis').replaceChildren();report.disabled=true;file.disabled=true;controls();note('正在本机读取元数据、检测黑场和画面变化…');try{var checked=await json(API+'/review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({video:await base64(f)})});if(version!==reviewVersion||file.files[0]!==f)return;reviewReport=checked;var box=q('#videoAnalysis');box.replaceChildren();var h=document.createElement('h3');h.textContent='技术审查完成';box.appendChild(h);[['时长',reviewReport.metadata.duration.toFixed(2)+' 秒'],['分辨率',reviewReport.metadata.video.width+'×'+reviewReport.metadata.video.height],['编码',reviewReport.metadata.video.codec],['检测黑场',reviewReport.blackSegments.length+' 段'],['显著画面变化',reviewReport.sceneChangeCount+' 次']].forEach(function(r){var p=document.createElement('p');p.textContent=r[0]+'：'+r[1];box.appendChild(p);});var n=document.createElement('p');n.textContent=reviewReport.assessment;box.appendChild(n);report.disabled=false;stamp(task,'done','完成 · 技术报告 · 服务任务 '+reviewReport.job);note('技术报告已生成。上传原视频在服务分析结束后删除；语义和审美仍需人工检查。');}catch(e){if(version===reviewVersion)failure(task,e);}finally{reviewing=false;file.disabled=false;controls();}}
  review.addEventListener('click',()=>inspect(false));
  retry.onclick=function(){if(!last||last.status!=='failed'||retry.disabled)return;last.kind==='render'?render(true):inspect(true);};
  report.addEventListener('click',function(){if(!reviewReport)return;var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(reviewReport,null,2)],{type:'application/json'}));a.download='视频技术审查.json';a.click();setTimeout(function(){URL.revokeObjectURL(a.href);},1000);});
  check();
})();
