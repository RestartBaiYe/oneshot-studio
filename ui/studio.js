(function () {
  "use strict";
  var q=function(s){return document.querySelector(s);}, running=false, history=[], plan=[], current=-1;
  function node(tag,cls,text){var el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;}
  function panel(title,id){var el=node('section','card studio-panel');el.appendChild(node('h3','',title));var body=node('div','',undefined);body.id=id;el.appendChild(body);return el;}
  var toolbar=node('div','studio-toolbar');toolbar.innerHTML='<span class="studio-label">CONTENT OPERATIONS / WORKSPACE</span><button class="btn ghost sm" id="themeSwitch" aria-pressed="true">切换浅色</button>';
  q('#pane-desk').prepend(toolbar);
  var visual=node('div','pipeline-art');visual.setAttribute('aria-label','商品事实经过规则审片，再由人工批准交付');visual.innerHTML='<div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><span class="pipeline-kicker">ONESHOT / CONTROLLED DELIVERY</span><div class="pipeline-nodes"><span>商品事实<small>BRIEF</small></span><i>→</i><span class="pipeline-core">审片<small>REVIEW</small></span><i>→</i><span>人工批准<small>APPROVAL</small></span></div><span class="pipeline-caption">每次修订留下依据 · 每次交付经过批准</span>';q('.workspace-intro').appendChild(visual);
  var scope=node('p','scope-note','为电商内容运营准备投前脚本。交付 TXT / SRT / CSV / 审片报告；8 项初筛通过并经人工批准后解锁导出。');q('.flow').after(scope);
  var evidence=node('button','btn ghost sm','下载运行证据 JSON');evidence.id='exportEvidence';evidence.disabled=true;q('#exports').appendChild(evidence);
  evidence.onclick=function(){var result=Agent.state.result;if(!result)return;var record={version:'1.2',result:result,events:Agent.state.trace,policy:{maxSteps:Agent.limits.maxSteps,maxReviews:Agent.limits.maxReviews,maxMs:Agent.limits.maxMs},notice:'运行证据含本次商品输入和文案，不含 API 密钥；离线模式不是模型运行。'};var link=node('a');link.href=URL.createObjectURL(new Blob([JSON.stringify(record,null,2)],{type:'application/json'}));link.download='oneshot-run-evidence.json';link.click();setTimeout(function(){URL.revokeObjectURL(link.href);},1000);};document.documentElement.dataset.theme='dark';
  q('#themeSwitch').onclick=function(){var dark=document.documentElement.dataset.theme!=='dark';document.documentElement.dataset.theme=dark?'dark':'light';this.textContent=dark?'切换浅色':'切换深色';this.setAttribute('aria-pressed',String(dark));};
  var draft=node('div','draft-status','草稿仅保存在本机浏览器');draft.id='draftStatus';q('#brief').after(draft);
  var progress=panel('本次任务 · 执行计划','executionPlan');q('.desk>.col').appendChild(progress);
  var revisions=panel('审片版本 · 修改依据','revisionHistory');q('.stagecol').appendChild(revisions);
  var delivery=panel('交付清单 · 责任边界','deliveryChecklist');q('.delivery-card').appendChild(delivery);
  q('#executionPlan').appendChild(node('p','hint','运行后显示实际计划和工具状态。'));
  q('#revisionHistory').appendChild(node('p','hint','每次规则审片保留本轮文案、未过项与修改对比。'));
  function checklist(res){var body=q('#deliveryChecklist');body.replaceChildren();[['规则初筛',res&&res.verdict&&res.verdict.pass],['人工批准',res&&res.deliveryApproved],['本地文件可导出',res&&res.deliveryApproved&&!!res.files]].forEach(function(row){body.appendChild(node('div','delivery-check '+(row[1]?'complete':''),(row[1]?'✓ ':'○ ')+row[0]));});}
  checklist(null);
  function save(){if(running)return;try{localStorage.setItem('oneshot.task-draft',JSON.stringify({brief:q('#brief').value,platform:q('#platform').value}));draft.textContent='草稿已保存到本机 · '+new Date().toLocaleTimeString();}catch(e){draft.textContent='浏览器不允许保存草稿，本次输入仍可使用。';}}
  try{var saved=JSON.parse(localStorage.getItem('oneshot.task-draft')||'null');if(saved&&typeof saved.brief==='string'&&PLAT[saved.platform]){q('#brief').value=saved.brief;q('#platform').value=saved.platform;draft.textContent='已恢复上次商品草稿 · 运行结果需重新生成';}}catch(e){draft.textContent='草稿不可读取，请直接输入商品信息。';}
  function changed(){if(running)return;evidence.disabled=true;save();checklist(null);q('#executionPlan').replaceChildren(node('p','hint','输入已变化，等待重新规划。'));q('#revisionHistory').replaceChildren(node('p','hint','输入已变化，旧版本不用于本次交付。'));}
  q('#brief').addEventListener('input',changed);q('#platform').addEventListener('change',changed);q('#btnClear').addEventListener('click',changed);q('#chips').addEventListener('click',changed);
  function renderPlan(){var body=q('#executionPlan');body.replaceChildren();plan.forEach(function(step,i){var row=node('div','plan-item '+(i===current?'active':i<current?'complete':''));row.appendChild(node('span','plan-number',String(i+1).padStart(2,'0')));var info=node('div');info.appendChild(node('b','',Tools.get(step.tool).title));info.appendChild(node('small','',step.why||step.tool));row.appendChild(info);body.appendChild(row);});}
  function review(obs){var prev=history.length?history[history.length-1]:null;history.push(obs);var body=q('#revisionHistory');if(history.length===1)body.replaceChildren();var detail=node('details','revision');detail.open=true;detail.appendChild(node('summary','', '第 '+history.length+' 轮 · '+(obs.pass?'规则初筛通过':'退回修订')+' · '+obs.checks.filter(function(c){return c.ok;}).length+'/'+obs.checks.length));(obs.subs||[]).forEach(function(line,i){var row=node('div','revision-row');row.appendChild(node('small','',['钩子','卖点','证据','行动引导'][i]));if(prev&&prev.subs[i]!==line)row.appendChild(node('del','',prev.subs[i]));row.appendChild(node('p','',line));detail.appendChild(row);});obs.checks.filter(function(c){return !c.ok;}).forEach(function(c){detail.appendChild(node('p','revision-issue',c.name+'：'+c.detail+' '+(c.fix||'')));});body.appendChild(detail);}
  var original=Agent.event;
  Agent.event=function(kind,p){
    if(kind==='plan'){running=true;history=[];plan=p.steps.map(function(s){return Object.assign({},s);});current=0;renderPlan();checklist(null);q('#revisionHistory').replaceChildren(node('p','hint','等待本轮审片结果。'));}
    if(kind==='step'){running=true;var id=p.step.tool;current=p.index;plan[current]=p.step;renderPlan();}
    if(kind==='observe'&&p.tool==='review.judge')review(p.obs);
    if(kind==='done'){running=false;evidence.disabled=false;checklist(p);if(p.status==='delivered'){current=plan.length;renderPlan();}q('#executionPlan').appendChild(node('p','hint',p.error||'本次结束 · '+p.status+' · '+p.steps.length+' 次工具调用'));}
    return original.call(this,kind,p);
  };
  var media=matchMedia('(prefers-reduced-motion: reduce)');
  if(!media.matches&&Element.prototype.animate){document.querySelectorAll('.workspace-intro,.flow,.desk>.col,.script-card').forEach(function(el,i){el.animate([{opacity:0,transform:'translateY(12px)'},{opacity:1,transform:'translateY(0)'}],{duration:400,delay:i*65,easing:'ease-out'});});}
  document.querySelectorAll('.card').forEach(function(card){card.addEventListener('pointermove',function(e){if(media.matches||e.pointerType==='touch')return;var rect=card.getBoundingClientRect();card.style.setProperty('--spot-x',(e.clientX-rect.left)+'px');card.style.setProperty('--spot-y',(e.clientY-rect.top)+'px');});});
})();
