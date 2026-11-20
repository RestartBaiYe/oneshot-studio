(function () {
  "use strict";
  const q = s => document.querySelector(s), cases = window.ONESHOT_CASES || [];
  const gallery = q('#pane-gallery');
  let loading = false, followRun = false, navigationVersion = 0;
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const cards = cases.map((c, i) => `<article class="case-card"><button class="case-image" data-preview="${c.id}" aria-label="播放${escape(c.title)}预置成片"><img loading="eager" src="${c.cover}" alt="${escape(c.title)}样片"><span>预置样片</span><b class="case-duration">12 秒</b></button><div class="case-body"><span class="case-number">0${i + 1}</span><h4>${escape(c.title)}</h4><p>${escape(c.description)}</p><div class="case-actions"><button class="btn ghost sm" data-load="${c.id}">${c.kind === 'review' ? '载入视频检查' : '载入脚本测试'}</button><button class="text-action" data-preview="${c.id}">观看样片</button></div></div></article>`).join('');
  gallery.innerHTML = `<section class="home-hero screening-hero" aria-labelledby="featureTitle"><div class="home-copy"><div class="issue-dateline"><span class="screen-kicker">ONESHOT <i></i> 广告样刊</span><span>VOL. 01</span></div><p class="feature-index">本期封面 <span>OBJECT STUDIES</span></p><h2 id="featureTitle">通勤杯<span>上新短片。</span></h2><p class="feature-deck">从杯身细节到通勤场景。先看这支 12 秒样片，再用自己的商品原图策划四镜广告。</p><div class="home-actions"><button class="btn watch-feature" data-preview="commute">▶ 播放预置样片 · 12 秒</button><button class="btn ghost" id="enterAI">用商品图做 AI 视频 →</button><button class="btn ghost" id="quickScript">试跑离线示例脚本</button></div><div class="film-credit">预置 MP4 <i>／</i> 竖屏 9:16 <i>／</i> 无音轨</div></div><button class="home-preview print-frame" data-preview="commute" aria-label="播放通勤杯上新预置样片"><svg class="issue-orbit" viewBox="0 0 440 410" preserveAspectRatio="xMidYMid slice" fill="none" aria-hidden="true"><g stroke="currentColor" stroke-width="1"><circle cx="237" cy="209" r="144"/><circle cx="237" cy="209" r="122" stroke-dasharray="2 7"/><path d="M-10 316 462 91M-10 333 462 108M55 388V20M380 388V20M22 354H420M22 53H420"/><path d="M32 75V31h42M362 379h41v-42" stroke-width="3"/></g></svg><span class="print-grid" aria-hidden="true"></span><span class="print-count" aria-hidden="true">Nº 01</span><img src="samples/commute/preview.jpg" width="540" height="960" fetchpriority="high" alt="通勤杯样片的商品插画"><span class="print-label">PRODUCT PLATE <i>通勤杯 / 001</i></span><span class="print-play" aria-hidden="true">▶</span></button></section>
<section class="gallery-examples" aria-label="三个作品案例"><header><span class="eyebrow">SELECTED FILMS / 片单</span><h3>本期片单<span class="issue-counter"> / 03</span></h3><p>选一部观看。放映结束前就可以用同一份素材重跑，不会把预置成片算作本次交付。</p></header><div class="case-grid">${cards}</div><p id="galleryStatus" class="gallery-status" role="status" aria-live="polite"></p></section>
<section class="use-path" aria-label="四种使用方式"><header><div><span class="eyebrow">WORK DESK / 自己动手</span><h3>开始自己的任务</h3></div><button class="btn" id="newProject">打开商品素材 →</button></header><div class="path-grid"><button class="path-card path-demo" id="pathScript"><span>01 / 文案</span><b>离线示例：脚本与审批</b><small>用示例事实生成四句文案，由你决定是否导出。</small><i>浏览器即可运行 →</i></button><button class="path-card" id="pathMake"><span>02 / 制作</span><b>制作新的 MP4</b><small>从原图和介绍策划商业广告，逐镜批准后提交视频模型。</small><i>本机工作台 · 需模型配置 →</i></button><button class="path-card" id="pathReview"><span>03 / 质检</span><b>检查已有视频</b><small>查时长、分辨率、黑场和画面变化，不需要脚本。</small><i>需要本机 FFmpeg →</i></button><button class="path-card" id="pathSamples"><span>04 / 放映</span><b>查看样片和报告</b><small>对照预置视频和对应的制作记录。</small><i>无需安装 →</i></button></div></section><aside class="capability-note"><b>制作边界</b><p>展厅样片是预置作品，离线案例只演示脚本检查。正式广告由图文模型策划、视频模型逐镜生成；本机只剪接已返回的真实片段，不自动发布。</p><a href="README.md">本机启动说明 →</a></aside>`;
  const modal = document.createElement('dialog');
  modal.id = 'sampleDialog';
  modal.setAttribute('aria-labelledby','sampleTitle');
  modal.innerHTML = '<header><div><span class="preset-label">预置样例 / NOT A LIVE RESULT</span><h2 id="sampleTitle"></h2></div><button class="btn ghost sm" id="closeSample" aria-label="关闭样例">关闭 ×</button></header><div class="sample-content"><video id="sampleVideo" controls playsinline preload="metadata"></video><div class="sample-notes"><h3>这部样片是怎么做的？</h3><p>这是随项目附带的预置成片，不会写入本次审批、工具记录或交付包。</p><div id="sampleReport" aria-live="polite"></div><div class="sample-downloads"><a id="sampleDownload" download>下载预置 MP4 ↗</a><a id="sampleReportDownload" download>下载预置报告 JSON ↗</a></div><button class="btn" id="loadFromSample">以此案例开始新任务 →</button><p class="hint">商品为自行绘制的演示图。镜头运动与转场由本机合成；无音轨、无生成式视频。</p></div></div>';
  document.body.appendChild(modal);
  function closeSample() { previewIntent++;q('#sampleVideo').pause(); modal.close(); q('#sampleVideo').removeAttribute('src'); q('#sampleVideo').load(); }
  q('#closeSample').onclick = closeSample;
  modal.addEventListener('close',()=>{q('#sampleVideo').pause();});
  modal.addEventListener('cancel', e => { e.preventDefault(); closeSample(); });
  modal.addEventListener('keydown', e => {
    if(e.key!=='Tab')return;
    const targets=Array.from(modal.querySelectorAll('button,a[href],video')).filter(el=>!el.disabled&&el.getClientRects().length);
    const first=targets[0],last=targets[targets.length-1];
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  });
  let previewId = '',previewIntent=0;
  async function preview(id) {
    const c = cases.find(c => c.id === id); if (!c) return;
    previewIntent++;previewId=id;q('#loadFromSample').textContent=c.kind==='review'?'载入此视频，在本机复检 →':'用这份素材重新生成脚本 →';q('.sample-notes h3').textContent=c.id==='coffee'?'一个没有依据的卖点，怎样退回？':c.kind==='review'?'黑场出现在哪一秒？':'从商品事实到四镜头短片'; q('#sampleTitle').textContent = c.title; q('#sampleVideo').src = c.video;
    q('#sampleDownload').href = c.video; q('#sampleReportDownload').href = c.report;
    q('#sampleReport').textContent = '读取随包附带的实测报告…';
    if (!modal.open) modal.showModal();
    q('#sampleVideo').play().catch(() => {});
    try {
      const response = await fetch(c.report); if (!response.ok) throw Error('HTTP '+response.status);
      const report = await response.json(); if (!modal.open || previewId !== id) return;
      const meta = report.metadata || report.render;
      q('#sampleReport').replaceChildren();
      const rows = [['预置文件', meta.duration.toFixed(2)+' 秒 / '+meta.video.width+' × '+meta.video.height+' / '+meta.video.codec], ['检查来源',c.kind==='review'?'FFmpeg 像素阈值检测（预先运行）':'本地规则审查与 FFmpeg 编码（预先运行）']];
      if (report.run) rows.push(['脚本预检',report.run.round+' 轮 / '+report.run.llmCalls+' 次模型调用']);
      if (report.blackSegments) rows.push(['预置报告中的黑场',report.blackSegments.map(s=>s.start.toFixed(2)+'–'+s.end.toFixed(2)+' 秒').join('，') || '未检测到']);
      rows.forEach(([label,text])=>{const p=document.createElement('p');p.textContent=label+'：'+text;q('#sampleReport').appendChild(p);});
      if (report.blackSegments?.length) { const jump=document.createElement('button');jump.className='btn ghost sm';jump.textContent='跳到黑场 03.00s';jump.onclick=()=>{q('#sampleVideo').currentTime=3;q('#sampleVideo').pause();};q('#sampleReport').appendChild(jump); }
    } catch (e) { if (modal.open && previewId===id) q('#sampleReport').textContent='报告未能读取：'+e.message+'。可直接下载报告查看。'; }
  }
  function notice(text) { q('#galleryStatus').textContent=text;  if(document.body.dataset.workstep==='materials')q('#agentStage').textContent='素材与事实已准备，点击生成脚本开始本次运行。'; }
  async function asFile(url,name,type) { const response=await fetch(url,{signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('样例文件不可用 (HTTP '+response.status+')');return new File([await response.blob()],name,{type}); }
  function setFile(selector,file) { const dt=new DataTransfer();if(file)dt.items.add(file);q(selector).files=dt.files;q(selector).dispatchEvent(new Event('change',{bubbles:true})); }
  function updateMode() { if(document.body.dataset.flow==='demo')q('#taskMode').textContent=LLM.active==='offline'?'案例演示 · 离线规则':'案例演示 · '+LLM.cfg.model; }
  async function load(id,quick=false,fromScreen=false) {
    if (loading || Workbench.busy()) { notice('当前任务仍在运行，请先停止或完成审批。'); return; }
    const c=cases.find(c=>c.id===id);if(!c)return;
    const viewAtLoad=navigationVersion,intent=previewIntent;const trigger=modal.open?q('#loadFromSample'):quick?q('#quickScript'):gallery.querySelector('[data-load="'+id+'"]');const label=trigger.textContent;trigger.disabled=true;trigger.textContent=quick?'正在生成脚本…':'正在载入素材…';
    loading=true;gallery.setAttribute('aria-busy','true');gallery.classList.add('is-loading');notice('正在准备 '+c.title+'。如果网络加载失败，可直接使用首页示例生成脚本。');
    try {
      const f=quick?null:c.kind==='review'?await asFile(c.video,c.id+'-preset.mp4','video/mp4'):await asFile(c.image,c.id+'-product.png','image/png');
      if(viewAtLoad!==navigationVersion||fromScreen&&(!modal.open||previewId!==id||intent!==previewIntent))return;
      q('#btnClear').click();q('#toast').classList.remove('on');setFile('#productImages',null);setFile('#reviewVideo',null);
      LLM.active='offline';q('#railProviderTxt').textContent='离线规则 · 无模型调用';updateMode();
      q('#projectTitle').textContent=c.title;q('#brief').value=c.brief || '';q('#bait').checked=!!c.repair;q('#platform').value=c.platform || 'douyin';q('#videoDuration').value='12';
      q('#brief').dispatchEvent(new Event('input',{bubbles:true}));
      if(quick){Workbench.go('script');notice('正在用商品事实生成四句文案；不下载图片，不制作视频。');q('#btnStart2').click();}
      else if(c.kind==='review'){setFile('#reviewVideo',f);openVideoCheck();notice('已载入带黑场的测试视频。本次检查尚未运行；连接本机服务后点击“开始技术审查”。');}
      else {setFile('#productImages',f);Workbench.go('desk');notice(c.repair?'已载入咖啡案例，并启用一次未提供主张的故障注入。点击“生成并检查脚本”，观察真实退回与修订。':'素材已就位。核对商品事实，点击“生成并检查脚本”；预置成片没有进入本次交付包。');}
      if(modal.open)closeSample();
      if(fromScreen&&c.kind!=='review'){Workbench.go('script');notice('使用同一份案例素材现场生成。离线规则模式，不调用模型；请核对后决定。');q('#btnStart2').click();}
    } catch(e){if(fromScreen&&(!modal.open||previewId!==id||intent!==previewIntent))return;const msg='载入失败：'+(e.name==='TimeoutError'?'素材下载超时':e.message)+'。可重试，或用首页示例直接生成脚本。';notice(msg);if(modal.open)q('#sampleReport').textContent=msg;else trigger.after(q('#galleryStatus'));}
    finally{trigger.disabled=false;trigger.textContent=label;loading=false;gallery.removeAttribute('aria-busy');gallery.classList.remove('is-loading');}
  }
  gallery.addEventListener('click',e=>{const previewButton=e.target.closest('[data-preview]'),loadButton=e.target.closest('[data-load]');if(previewButton)preview(previewButton.dataset.preview);if(loadButton)load(loadButton.dataset.load);});
  q('#loadFromSample').onclick=()=>load(previewId,false,true);
  q('#quickScript').onclick=()=>load('commute',true);
  q('#pathScript').onclick=()=>load('commute',true);
  q('#pathMake').onclick=()=>{if(Workbench.busy())return notice('先完成或停止当前任务。');window.dispatchEvent(new Event('oneshot:make-video'));const result=Workbench.current();if(result&&result.deliveryApproved){q('#projectTitle').textContent='制作新视频';Workbench.go('media');}else{q('#newProject').click();notice('先填写商品事实并批准脚本；第 4 步才会开放新 MP4。');}};
  function openVideoCheck(){window.dispatchEvent(new Event('oneshot:check-video'));Workbench.go('media');q('#reviewVideo').focus();q('#reviewVideo').scrollIntoView({block:'center'});}
  q('#pathReview').onclick=()=>{if(Workbench.busy())return notice('先完成或停止当前任务。');q('#projectTitle').textContent='检查已有视频';openVideoCheck();};
  q('#pathSamples').onclick=()=>preview('commute');
  q('#newProject').onclick=()=>window.StudioAI?.openSource();
  q('#backGallery').onclick=()=>Workbench.go('gallery');
  document.querySelectorAll('.work-steps button').forEach((b,i)=>b.onclick=()=>Workbench.go(document.body.dataset.flow==='ai'?['ai-source','ai-script','ai-check','ai-film'][i]:b.dataset.go));
  q('#btnStart2').textContent='生成并检查脚本';q('#btnStart').textContent='生成脚本';q('#openReview').textContent='查看审查与修订 →';
  q('#goVideoWorkshop').textContent='进入视频验证与交付 →';
  const prep=document.createElement('aside');prep.className='prep-guide card';prep.innerHTML='<span class="eyebrow">01 / 素材准备</span><h2>先写什么？</h2><p>列出商品名称、规格、价格，以及你能证实的卖点。没有的数据留空。</p><dl><dt>例如</dt><dd>通勤保温杯，316L 不锈钢，容量 500 ml，售价 79 元。</dd><dt>下一步会得到什么</dt><dd>四句分镜文案：开场、卖点、证据、行动引导。你批准前，不会导出或制作成片。</dd></dl>';q('.desk>.col').after(prep);q('#projectChrome').after(q('#pane-desk'));
  q('.workspace-intro').hidden=true;q('.flow').hidden=true;
  const exports=q('.delivery-card');q('.media-intro').after(exports);
  const continuation=document.createElement('div');continuation.className='stage-continuation';continuation.innerHTML='<button class="btn" id="showCurrentReview">查看规则、修订与批准状态 →</button><span>本次任务证据，非预置报告</span>';q('.run-strip').after(continuation);q('#showCurrentReview').onclick=()=>Workbench.go('review');
  const previousReview=q('#revHead').innerHTML, previousChecks=q('#revChecks').innerHTML;
  const output=document.createElement('section');output.className='card';output.hidden=true;output.innerHTML='<span class="eyebrow">本次运行 · 已通过规则初筛 · 已人工批准</span><h2>你的四镜头脚本</h2><p>下方文字是这次实际生成并批准的内容。它是脚本，不是预置样片或 MP4。</p><pre style="white-space:pre-wrap;overflow-wrap:anywhere;font:inherit" id="approvedCopy"></pre><div class="rowbtns"><button class="btn" id="getApprovedCopy">下载本次文案 TXT</button><button class="btn ghost" id="getApprovedSubs">下载字幕 SRT</button><button class="btn ghost" id="continueToMake">继续制作 MP4 →</button></div><section class="run-receipt" aria-label="本次执行凭据"><h3>本次执行凭据</h3><div id="runSummary"></div><p class="result-verify" id="resultVerify"></p></section>';q('#pane-review .delivery-stage').prepend(output);q('#getApprovedCopy').onclick=()=>q('#expTxt2').click();q('#getApprovedSubs').onclick=()=>q('#expSrt2').click();q('#continueToMake').onclick=()=>{window.dispatchEvent(new Event('oneshot:make-video'));Workbench.go('media');};
  function clearOutput(){output.hidden=true;q('#approvedCopy').textContent='';}
  function resetReview(){if(Workbench.busy())return;clearOutput();q('#revFixes').textContent='生成后查看本次修订记录。';q('#revHead').innerHTML=previousReview;q('#revChecks').innerHTML=previousChecks;}
  q('#brief').addEventListener('input',resetReview);q('#platform').addEventListener('change',resetReview);q('#btnClear').addEventListener('click',resetReview);q('#chips').addEventListener('click',resetReview);
  window.addEventListener('oneshot:navigate',e=>{navigationVersion++;const titles={'ai-source':'商品素材','ai-script':'图文分镜','ai-check':'审查批准','ai-film':'AI 视频交付',gallery:'案例展厅',desk:'素材准备',script:'生成脚本',review:'审查批准',delivery:'视频验证与交付',media:'视频验证与交付',settings:'模型配置','demo-settings':'案例演示设置',trace:'执行记录',memory:'本地记忆',batch:'批量任务'};q('.topbar h1').firstChild.textContent=titles[e.detail.pane]||'OneShot';updateMode();});
  window.addEventListener('oneshot:script-start',()=>{followRun=document.body.dataset.surface==='project';if(followRun)Workbench.go('script');clearOutput();q('#revHead').innerHTML=previousReview;q('#revChecks').replaceChildren();});
  window.addEventListener('oneshot:agent-state',e=>{const {kind,payload}=e.detail;
    if(kind==='plan'){clearOutput();followRun=document.body.dataset.surface==='project';if(!followRun)return;Workbench.go('script');notice('正在现场运行：脚本生成 → 规则检查 → 有限修订 → 人工批准。');}
    if(kind==='approval'&&followRun){Workbench.go('review');}
    if(kind==='done'&&followRun){const scheduledAt=navigationVersion;requestAnimationFrame(()=>{if(navigationVersion!==scheduledAt)return;updateMode();Workbench.go('review');if(payload.deliveryApproved&&payload.files){q('#approvedCopy').textContent=payload.files.txt;const m=payload.metrics,l=payload.llm,summary=q('#runSummary');summary.replaceChildren();[['执行用时',m.activeMs+' ms'],['人工等待',m.humanWaitMs+' ms'],['复核 / 批准',m.reviewRounds+' 轮 / '+m.approvalDecisions+' 次'],['模型请求',l.calls+' / '+l.callLimit+' 次']].forEach(([name,value])=>{const box=document.createElement('div'),label=document.createElement('small'),v=document.createElement('b');label.textContent=name;v.textContent=value;box.append(label,v);summary.append(box);});q('#resultVerify').textContent=payload.runId+' · '+payload.steps.length+' 条工具记录 · '+(l.calls?(l.missingUsage?'用量不完整':l.inputTokens+' 输入 / '+l.outputTokens+' 输出 token')+' · '+(l.costCny==null?'费用未知':'参考估算 ¥'+l.costCny.toFixed(6)):'离线 0 次模型调用，API 费 ¥0')+'。脚本已批准，视频须另行制作。';output.hidden=false;output.scrollIntoView({block:'start'});}notice(payload.deliveryApproved?'本次脚本已批准。第 4 步可下载文件，或在本机制作新 MP4。':payload.status==='aborted'?'任务已停止，文件未开放；可以修改输入后重新运行。':payload.verdict?.pass?'本次初筛通过，但你未批准交付；文件保持锁定。':payload.error||'本次规则检查未通过，查看失败项后修改输入或配置。');});}
  });
  window.addEventListener('oneshot:media-ready',()=>notice('本次新 MP4 已编码完成。播放器和下载文件来自这次实际运行。'));
  window.addEventListener('pagehide',()=>q('#sampleVideo').pause());
  Workbench.go('gallery');
})();
