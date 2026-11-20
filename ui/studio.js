(function () {
  "use strict";
  var q=function(s){return document.querySelector(s);}, running=false, history=[], plan=[], current=-1;
  function node(tag,cls,text){var el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;}
  function panel(title,id){var el=node('section','card studio-panel');el.appendChild(node('h3','',title));var body=node('div','',undefined);body.id=id;el.appendChild(body);return el;}
  var toolbar=node('div','studio-toolbar');toolbar.innerHTML='<span class="studio-label">CONTENT OPERATIONS / WORKSPACE</span><button class="btn ghost sm" id="themeSwitch" aria-pressed="false">切换深色</button>';
  q('.topbar').appendChild(toolbar);q('.studio-label').remove();
  var evidence=node('button','btn ghost sm','下载运行证据 JSON');evidence.id='exportEvidence';evidence.disabled=true;q('#exports').appendChild(evidence);
  evidence.onclick=function(){var result=Agent.state.result;if(!result)return;var record={version:'1.2',result:result,events:Agent.state.trace,policy:{maxSteps:Agent.limits.maxSteps,maxReviews:Agent.limits.maxReviews,maxMs:Agent.limits.maxMs},notice:'运行证据含本次商品输入和文案，不含 API 密钥；离线模式不是模型运行。'};var link=node('a');link.href=URL.createObjectURL(new Blob([JSON.stringify(record,null,2)],{type:'application/json'}));link.download='oneshot-run-evidence.json';link.click();setTimeout(function(){URL.revokeObjectURL(link.href);},1000);};
  q('#themeSwitch').onclick=function(){var dark=document.documentElement.dataset.theme!=='dark';document.documentElement.dataset.theme=dark?'dark':'light';this.textContent=dark?'切换浅色':'切换深色';this.setAttribute('aria-pressed',String(dark));};
  var draft=node('div','draft-status','草稿仅保存在本机浏览器');draft.id='draftStatus';q('#brief').after(draft);
  var progress=node('details','card studio-panel execution-plan');progress.appendChild(node('summary','','Agent 执行依据 · 展开工具输入与结果'));var planBody=node('div');planBody.id='executionPlan';progress.appendChild(planBody);q('.stagecol').appendChild(progress);
  var revisions=panel('修订记录 · 为什么这样改','revisionHistory');q('#reviewEvidence').appendChild(revisions);
  var delivery=panel('交付清单 · 责任边界','deliveryChecklist');q('.delivery-card').appendChild(delivery);
  q('#executionPlan').appendChild(node('p','hint','运行后显示实际计划和工具状态。'));
  q('#revisionHistory').appendChild(node('p','hint','每次规则审片保留本轮文案、未过项与修改对比。'));
  function checklist(res){var body=q('#deliveryChecklist');body.replaceChildren();[['规则初筛',res&&res.verdict&&res.verdict.pass],['人工批准',res&&res.deliveryApproved],['本地文件可导出',res&&res.deliveryApproved&&!!res.files]].forEach(function(row){body.appendChild(node('div','delivery-check '+(row[1]?'complete':''),(row[1]?'✓ ':'○ ')+row[0]));});}
  checklist(null);
  function save(){if(running)return;try{localStorage.setItem('oneshot.task-draft',JSON.stringify({brief:q('#brief').value,platform:q('#platform').value}));draft.textContent='草稿已保存到本机 · '+new Date().toLocaleTimeString();}catch(e){draft.textContent='浏览器不允许保存草稿，本次输入仍可使用。';}}
  try{var saved=JSON.parse(localStorage.getItem('oneshot.task-draft')||'null');if(!window.ONESHOT_DEMO&&saved&&typeof saved.brief==='string'&&PLAT[saved.platform]){q('#brief').value=saved.brief;q('#platform').value=saved.platform;draft.textContent='已恢复上次商品草稿 · 运行结果需重新生成';}}catch(e){draft.textContent='草稿不可读取，请直接输入商品信息。';}
  function changed(){if(running)return;evidence.disabled=true;save();checklist(null);q('#executionPlan').replaceChildren(node('p','hint','输入已变化，等待重新规划。'));q('#revisionHistory').replaceChildren(node('p','hint','输入已变化，旧版本不用于本次交付。'));}
  q('#brief').addEventListener('input',changed);q('#platform').addEventListener('change',changed);q('#btnClear').addEventListener('click',changed);q('#chips').addEventListener('click',changed);
  function shortValue(v){if(v===undefined)return '—';if(typeof v==='string')return v.length>100?v.slice(0,100)+'…':v;if(Array.isArray(v))return v.slice(0,4).join('、')||'无';if(v&&typeof v==='object'){if(v.rows)return v.rows.map(function(r){return r.k+'：'+r.v;}).join('；')||'未抽取到参数';if(v.lines)return ['hook','claim','proof','cta'].map(function(k){return v.lines[k];}).filter(Boolean).join(' / ');if(v.checks)return v.checks.filter(function(c){return !c.ok;}).map(function(c){return c.name+'：'+c.detail;}).join('；')||v.checks.length+' 项规则通过';if(v.files)return v.files.join('、');if(v.hits)return v.hits.map(function(h){return h.kind+' '+h.words.join('、');}).join('、')||'未命中已配置风险词';return Object.keys(v).slice(0,4).map(function(k){return k+'='+String(v[k]);}).join(' · ');}return String(v);}
  function renderPlan(){var body=q('#executionPlan');body.replaceChildren();plan.forEach(function(step,i){var rec=Agent.state.steps[i];if(rec&&rec.tool!==step.tool)rec=null;var state=rec?(rec.status==='failed'?'失败':rec.status==='denied'?'你拒绝了':rec.status==='skipped'?'跳过':'完成'):(i===current?'执行中':'等待');var row=node('div','plan-item '+(rec&&rec.status==='failed'?'failed':i===current?'active':rec?'complete':''));row.appendChild(node('span','plan-number',String(i+1).padStart(2,'0')));var info=node('div','plan-info');info.appendChild(node('b','',Tools.get(step.tool).title+' · '+state));info.appendChild(node('small','',step.why||step.tool));if(rec){var input=rec.args?Object.keys(rec.args).filter(function(k){return ['brief','text','platform','lines'].indexOf(k)>=0;}).map(function(k){return k+': '+shortValue(rec.args[k]);}).join(' · '):'';info.appendChild(node('small','plan-evidence','输入 · '+(input||'无直接输入')));info.appendChild(node('small','plan-evidence '+(rec.status==='failed'?'evidence-error':''),'结果 · '+(rec.error||shortValue(rec.obs))));}row.appendChild(info);body.appendChild(row);});}
  function explain(tool){var map={'memory.recall':'读取浏览器本地记忆；仅提供近期退回项作为起草上下文。','brief.parse':'按本地规则拆解商品名称、人群和价格。','facts.extract':'按规则抽取可识别的数值和部分型号/材质；不做完整语义核验。','compliance.scan':'按配置词表扫描当前草稿中的绝对化、功效和承诺风险词。','script.draft':LLM.active==='offline'?'离线规则生成四句脚本，不调用模型。':'调用已配置模型生成四句脚本；商品 brief 是事实来源。','script.revise':LLM.active==='offline'?'按固定规则替换失败项，不调用模型。':'把失败检查反馈给模型生成修订稿。','subtitle.fit':'按所选平台的单行字数上限压缩字幕。','review.judge':'执行本地规则初筛；规则通过不代表事实或法律审核通过。','stage.preview':'在页面本地预览四句分镜；不是 AI 生成视频。','deliver.export':'准备四种本地文件，需你在确认框批准。','memory.write':'将本次初筛记录写入浏览器本地记忆。'};return map[tool]||'执行受约束工作流中的下一步，并记录结果。'}
  var stageText=node('div','agent-stage','等待输入商品信息');stageText.id='agentStage';q('.script-card').insertBefore(stageText,q('#openReview'));
  function announce(text){var el=q('#agentStage');if(el)el.textContent=text;q('#nextAction').textContent=text;}
  function review(obs){var prev=history.length?history[history.length-1]:null;history.push(obs);var body=q('#revisionHistory');if(history.length===1)body.replaceChildren();var detail=node('details','revision');detail.open=true;detail.appendChild(node('summary','', '第 '+history.length+' 轮 · '+(obs.pass?'规则初筛通过':'退回修订')+' · '+obs.checks.filter(function(c){return c.ok;}).length+'/'+obs.checks.length));(obs.subs||[]).forEach(function(line,i){var row=node('div','revision-row');row.appendChild(node('small','',['钩子','卖点','证据','行动引导'][i]));if(prev&&prev.subs[i]!==line)row.appendChild(node('del','',prev.subs[i]));row.appendChild(node('p','',line));detail.appendChild(row);});obs.checks.filter(function(c){return !c.ok;}).forEach(function(c){detail.appendChild(node('p','revision-issue',c.name+'：'+c.detail+' '+(c.fix||'')));});body.appendChild(detail);}
  var original=Agent.event;
  Agent.event=function(kind,p){
    if(kind==='plan'){running=true;history=[];plan=p.steps.map(function(s){return Object.assign({},s);});current=0;renderPlan();checklist(null);q('#revisionHistory').replaceChildren(node('p','hint','等待本轮审片结果。'));announce(p.planner+'；Agent 将按素材、脚本、审查、交付四个阶段执行固定流程。');}
    if(kind==='step'){running=true;var id=p.step.tool;current=p.index;plan[current]=p.step;renderPlan();announce(id==='deliver.export'?'脚本已通过规则初筛。请核对四句内容后，在确认框批准本地导出。':explain(id));}
    if(kind==='observe'||kind==='tool_error'){renderPlan();}
    if(kind==='approval')announce('等待人工确认 · 请核对脚本；批准后开放本地导出。');
    if(kind==='observe'&&p.tool==='review.judge'){review(p.obs);announce(p.obs.pass?'规则初筛通过：请阅读四句脚本与检查项，决定是否批准本地导出。':'本轮未通过：Agent 将按失败项修订；未通过前不会开放交付。');}
    if(kind==='error')announce('Agent 在 '+(p.tool||'当前步骤')+' 遇到错误并停止；查看执行轨迹中的原因，修正输入或配置后重新运行。');
    if(kind==='done'){running=false;evidence.disabled=false;checklist(p);if(p.status==='delivered'){current=plan.length;renderPlan();announce('第 3 步完成：脚本已批准。进入第 4 步视频验证与交付，制作新 MP4 或检查已有视频。');}else if(p.status==='aborted')announce('任务已停止；交付仍锁定。检查失败步骤后可重新运行。');else if(p.verdict&&p.verdict.pass)announce('规则初筛通过；你拒绝了本次导出，文件仍锁定。确认内容后重新运行可再次审批。');else announce(p.error||'审片未通过：查看下方失败项与执行轨迹，修正 brief 后重新运行。');q('#executionPlan').appendChild(node('p','hint',p.error||'本次结束 · '+p.status+' · '+p.steps.length+' 次工具调用'));}
    window.dispatchEvent(new CustomEvent('oneshot:agent-state',{detail:{kind:kind,payload:p}}));
    return original.call(this,kind,p);
  };
  if(window.ONESHOT_DEMO){
    document.body.classList.add('guided-demo');
    var welcome=node('section','card demo-welcome demo-welcome-compact');welcome.innerHTML='<span>离线体验 · 无模型调用</span><div class="rowbtns"><button id="demoQuick" class="btn ghost sm">运行示例</button><button id="demoRepair" class="btn ghost sm">演示修订</button></div>';q('#chips').after(welcome);
    function startDemo(repair){if(Agent.state.running)return;q('#brief').value='保温杯 316L 不锈钢，容量 500ml，12 小时保温，一键开盖单手可开，食品级硅胶圈。售价 79 元，主打通勤上班族和学生党，今天下单送杯刷。';q('#platform').value='douyin';q('#bait').checked=repair;q('#brief').dispatchEvent(new Event('input',{bubbles:true}));LLM.active='offline';q('#railProviderTxt').textContent='离线交互演示 · 无模型调用';q('#btnStart2').click();}
    var quick=document.querySelector('#demoQuick');if(quick)quick.onclick=function(){startDemo(false);};
    var repair=document.querySelector('#demoRepair');if(repair)repair.onclick=function(){startDemo(true);};
    q('#nextAction').textContent='填写商品事实并运行 Agent。脚本通过规则初筛后，你可人工批准，再进入本机视频制作。';
    q('#railProviderTxt').textContent='离线交互演示 · 无模型调用';
  }

  var source=q('.desk>.col>.card');source.classList.add('brief-card');
  var assets=node('section','asset-picker');assets.innerHTML='<div class="asset-title"><b>03 / 商品素材</b><span>可选 · 仅发送到本机</span></div><button type="button" class="asset-add" id="addAssets"><span class="asset-plus">＋</span><span><b>添加商品图片</b><small>PNG、JPG、WebP · 最多 8 张</small></span><span aria-hidden="true">↗</span></button><div id="assetThumbs" class="asset-thumbs"></div>';
  q('.test-options').before(assets);q('#addAssets').onclick=function(){q('#productImages').click();};
  var actual=node('aside','production-note');actual.innerHTML='<span class="note-icon" aria-hidden="true">↳</span><div><b>交付的不只是文案</b><p>批准脚本后，本机制作 MP4、字幕、封面与报告。素材不会上传到 OneShot 云端。</p></div>';q('.technical').before(actual);
  var flow=q('.flow');q('.workspace-intro').after(flow);q('#nextAction').classList.add('action-note');
  var briefExtras=node('details','source-options');briefExtras.appendChild(node('summary','','示例与测试选项'));q('.chips').before(briefExtras);briefExtras.appendChild(q('.chips'));if(q('.demo-welcome'))briefExtras.appendChild(q('.demo-welcome'));briefExtras.appendChild(q('.test-options'));source.insertBefore(briefExtras,source.querySelector(':scope > .rowbtns'));
  var evidenceShelf=node('details','card evidence-shelf');evidenceShelf.appendChild(node('summary','','依据与工具执行'));q('.stagecol').appendChild(evidenceShelf);evidenceShelf.appendChild(q('.stagecol>.grid2'));evidenceShelf.appendChild(q('.execution-plan'));
  var stageFoot=node('div','stage-footer');stageFoot.innerHTML='<span>文本分镜 · 不是已生成的视频</span><span>4 SHOTS / 15 SEC</span>';q('#scriptOutput').after(stageFoot);
  var observeBox=node('section','run-strip');observeBox.innerHTML='<div class="run-strip-title"><span class="run-beacon"></span><b>运行现场</b><span id="runOrigin">尚未运行</span></div><div class="run-stats"><span><b id="visibleTools">0</b> 工具调用</span><span><b id="visibleReviews">0</b> 审查轮次</span><span id="visibleApproval">等待生成脚本</span></div>';q('.script-card').after(observeBox);
  q('.preview-details').removeAttribute('open');q('.preview-details').classList.add('legacy-preview');evidenceShelf.appendChild(q('.preview-details'));
  var photoUrls=[], art=q('#scriptOutput');
  function decorate(){
    var empty=art.querySelector('.script-empty');if(empty&&!empty.dataset.atelier){empty.dataset.atelier='true';empty.innerHTML='<div class="empty-copy"><span class="empty-kicker">YOUR NEXT PROJECT</span><strong>从事实出发，<br>让作品发生。</strong><p>选择案例或填写商品信息，然后生成四镜头脚本。这里只展示本次任务，不会填入预置成片。</p><span class="empty-step">真实输入 → 规则检查 → 人工批准</span></div>';}
    art.querySelectorAll('.script-line').forEach(function(line,i){if(!line.classList.contains('story-shot')&&!matchMedia('(prefers-reduced-motion: reduce)').matches&&line.animate)line.animate([{opacity:0,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],{duration:260,delay:i*45,easing:'ease-out'});line.classList.add('story-shot');line.setAttribute('aria-label','镜头 '+(i+1));var old=line.querySelector('.shot-image');if(old)old.remove();if(photoUrls.length){var img=node('img','shot-image');img.alt='你选择的商品图片 '+((i%photoUrls.length)+1);img.src=photoUrls[i%photoUrls.length];line.prepend(img);}});
  }
  new MutationObserver(function(records){if(records.some(function(r){return r.target===art;}))decorate();}).observe(art,{childList:true});decorate();
  q('#productImages').addEventListener('change',function(){photoUrls.forEach(URL.revokeObjectURL);photoUrls=[];var box=q('#assetThumbs');box.replaceChildren();var selected=Array.from(this.files).slice(0,8).filter(function(f){return f.size<=12*1024*1024&&['image/png','image/jpeg','image/webp'].includes(f.type);});selected.forEach(function(file){var url=URL.createObjectURL(file);photoUrls.push(url);var image=node('img');image.alt=file.name;image.src=url;box.appendChild(image);});q('#addAssets b').textContent=selected.length?'已选择 '+selected.length+' 张商品图':'添加商品图片';decorate();});
  window.addEventListener('pagehide',function(){photoUrls.forEach(URL.revokeObjectURL);});
  function resetVisible(){if(Agent.state.running)return;q('#visibleTools').textContent='0';q('#visibleReviews').textContent='0';q('#visibleApproval').textContent='等待重新生成';q('#runOrigin').textContent='输入已更新';}
  q('#brief').addEventListener('input',resetVisible);q('#platform').addEventListener('change',resetVisible);q('#btnClear').addEventListener('click',resetVisible);q('#chips').addEventListener('click',resetVisible);
  window.addEventListener('oneshot:agent-state',function(e){requestAnimationFrame(function(){q('#visibleTools').textContent=Agent.state.steps.length;q('#visibleReviews').textContent=history.length;q('#runOrigin').textContent=LLM.active==='offline'?'离线规则 · 无模型调用':'模型辅助 · '+LLM.cfg.model;var kind=e.detail.kind;q('#visibleApproval').textContent=kind==='approval'?'等待人工批准':kind==='done'?(e.detail.payload.deliveryApproved?'人工批准 ✓':'交付未开放'):Agent.state.running?'正在执行工具':'待命';});});
  var videoPanel=node('section','film-player');videoPanel.hidden=true;videoPanel.innerHTML='<header><span class="stage-caption">FINAL CUT</span><b>本次真实成片</b><span id="filmSpec"></span></header><video id="finalFilm" controls playsinline preload="metadata"></video><p>本机制作 · 镜头运动 / 分层字幕 / 转场 · 无音轨</p>';q('.media-columns').before(videoPanel);
  window.addEventListener('oneshot:media-ready',function(e){var d=e.detail,mp4=d.manifest.files.find(function(f){return f.name.endsWith('.mp4');});if(!mp4)return;q('#finalFilm').src=d.api+mp4.url.slice(4);q('#filmSpec').textContent=d.manifest.render.duration.toFixed(0)+' SEC / 1080 × 1920';videoPanel.hidden=false;});
  window.addEventListener('oneshot:media-invalidated',function(){q('#finalFilm').pause();q('#finalFilm').removeAttribute('src');q('#finalFilm').load();videoPanel.hidden=true;});

  var media=matchMedia('(prefers-reduced-motion: reduce)');
  media.addEventListener('change',function(){if(media.matches)document.querySelectorAll('.workspace-intro,.flow,.desk>.col,.script-card,.script-line').forEach(function(el){el.getAnimations().forEach(function(animation){animation.cancel();});});});
  if(!media.matches&&Element.prototype.animate){document.querySelectorAll('.workspace-intro,.flow,.desk>.col,.script-card').forEach(function(el,i){el.animate([{opacity:0,transform:'translateY(12px)'},{opacity:1,transform:'translateY(0)'}],{duration:400,delay:i*65,easing:'ease-out'});});}
  document.querySelectorAll('.script-card').forEach(function(card){
    var frame=0,point=null;
    card.addEventListener('pointermove',function(e){
      if(media.matches||e.pointerType==='touch')return;
      point={x:e.clientX,y:e.clientY};
      if(frame)return;
      frame=requestAnimationFrame(function(){if(media.matches){frame=0;return;}var rect=card.getBoundingClientRect();card.style.setProperty('--spot-x',(point.x-rect.left)+'px');card.style.setProperty('--spot-y',(point.y-rect.top)+'px');frame=0;});
    });
    card.addEventListener('pointerleave',function(){if(frame)cancelAnimationFrame(frame);frame=0;card.style.removeProperty('--spot-x');card.style.removeProperty('--spot-y');});
    media.addEventListener('change',function(){if(frame)cancelAnimationFrame(frame);frame=0;card.style.removeProperty('--spot-x');card.style.removeProperty('--spot-y');});
  });
})();
