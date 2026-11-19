(function () {
  "use strict";
  const q = s => document.querySelector(s), cases = window.ONESHOT_CASES || [];
  const gallery = q('#pane-gallery');
  let loading = false, followRun = false, navigationVersion = 0;
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  gallery.innerHTML = '<div class="gallery-intro"><div class="gallery-copy"><span class="eyebrow"><i></i> A SMALL STUDIO. A COMPLETE WORKFLOW.</span><h2>把商品卖点写成<br><span>四镜头短片脚本。</span></h2><p>第一次用？用通勤杯试一次，无需安装。网页会现场生成四句文案，供你核对、下载。<br>想看视频效果可播放预置样片；制作自己的 MP4 需启动本机服务。</p><div class="gallery-actions"><button class="btn" id="quickScript">生成通勤杯示例脚本 <span>↗</span></button><button class="btn ghost" id="newProject">用我的商品写脚本</button></div><div class="gallery-caption"><span>01 素材</span><i>—</i><span>02 脚本</span><i>—</i><span>03 审查</span><i>—</i><span>04 交付</span></div></div><div class="feature-wrap"><button class="featured-film" data-preview="commute" aria-label="播放通勤杯预置成片"><span class="feature-orbit"></span><span class="featured-label">THE EVERYDAY COLLECTION</span><span class="featured-title">Form.<br><em>In motion.</em></span><span class="film-window"><video id="galleryReel" muted loop playsinline preload="none" poster="samples/commute/cover.jpg" aria-hidden="true" tabindex="-1"></video></span><span class="film-edition">Nº 01<br><small>OBJECT STUDY</small></span><span class="featured-play"><i>↗</i><b>播放完整案例</b><small>12 SEC</small></span><span class="preset-stamp">预置样例 · 非本次生成</span></button><button id="reelMotion" class="reel-motion" aria-label="播放展厅动态预览" aria-pressed="false">播放动态预览</button></div></div>' +
    '<div class="gallery-section-head"><div><span class="eyebrow">SELECTED WORK / 01 — 03</span><h3>每个作品，都有来路。</h3></div><span>先看输出，再亲手运行一次 ↙</span></div><div class="case-grid">' +
    cases.map((c,i) => '<article class="case-card"><button class="case-image" data-preview="'+c.id+'" aria-label="查看'+escape(c.title)+'预置成片"><img loading="eager" src="'+c.cover+'" alt="'+escape(c.title)+'自制素材"><span>'+escape(c.tag)+'</span><i>↗</i><b class="case-duration">12″ / PRESET</b></button><div class="case-body"><span class="case-number">0'+(i+1)+'</span><h4>'+escape(c.title)+'</h4><p>'+escape(c.description)+'</p><div class="case-actions"><button class="btn ghost sm" '+(c.id==='commute'?'id="startFeatured" ':'')+'data-load="'+c.id+'">'+(c.kind==='review'?'载入视频检查 →':'载入素材，自己编辑 →')+'</button><button class="text-action" data-preview="'+c.id+'">观看成片 ↗</button></div></div></article>').join('') +
    '</div><aside class="gallery-boundary"><b>不是播放一次，<br>而是真正完成一次。</b><p>样例来自实际编码与检测，明确标记为预置内容。现场运行会产生独立的脚本、修订、审批与交付记录。<br>新视频制作与回检需要本机 FFmpeg；离线规则不是在线模型。</p><a href="README.md" target="_blank" rel="noreferrer">启动与能力说明 ↗</a></aside><p id="galleryStatus" role="status"></p>';
  const modal = document.createElement('dialog');
  modal.id = 'sampleDialog';
  modal.setAttribute('aria-labelledby','sampleTitle');
  modal.innerHTML = '<header><div><span class="preset-label">预置样例 / NOT A LIVE RESULT</span><h2 id="sampleTitle"></h2></div><button class="btn ghost sm" id="closeSample" aria-label="关闭样例">关闭 ×</button></header><div class="sample-content"><video id="sampleVideo" controls playsinline preload="metadata"></video><div class="sample-notes"><h3>一支短片，及其制作依据。</h3><p>这是随项目附带的预置成片，不会写入本次审批、工具记录或交付包。</p><div id="sampleReport" aria-live="polite"></div><div class="sample-downloads"><a id="sampleDownload" download>下载预置 MP4 ↗</a><a id="sampleReportDownload" download>下载预置报告 JSON ↗</a></div><button class="btn" id="loadFromSample">以此案例开始新任务 →</button><p class="hint">商品为自行绘制的演示图。镜头运动与转场由本机合成；无音轨、无生成式视频。</p></div></div>';
  document.body.appendChild(modal);
  function closeSample() { q('#sampleVideo').pause(); modal.close(); q('#sampleVideo').removeAttribute('src'); q('#sampleVideo').load(); }
  q('#closeSample').onclick = closeSample;
  modal.addEventListener('cancel', e => { e.preventDefault(); closeSample(); });
  modal.addEventListener('keydown', e => {
    if(e.key!=='Tab')return;
    const targets=Array.from(modal.querySelectorAll('button,a[href],video')).filter(el=>!el.disabled&&el.getClientRects().length);
    const first=targets[0],last=targets[targets.length-1];
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  });
  let previewId = '';
  async function preview(id) {
    const c = cases.find(c => c.id === id); if (!c) return;
    previewId = id; q('#sampleTitle').textContent = c.title; q('#sampleVideo').src = c.video;
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
  function notice(text) { q('#galleryStatus').textContent=text; q('#projectNotice').textContent=text; if(document.body.dataset.workstep==='materials')q('#agentStage').textContent='素材与事实已准备，点击生成脚本开始本次运行。'; }
  async function asFile(url,name,type) { const response=await fetch(url,{signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('样例文件不可用 (HTTP '+response.status+')');return new File([await response.blob()],name,{type}); }
  function setFile(selector,file) { const dt=new DataTransfer();if(file)dt.items.add(file);q(selector).files=dt.files;q(selector).dispatchEvent(new Event('change',{bubbles:true})); }
  function updateMode() { q('#taskMode').textContent=LLM.active==='offline'?'离线规则 · 无模型调用':'模型辅助 · '+LLM.cfg.model; }
  async function load(id,quick=false) {
    if (loading || Workbench.busy()) { notice('当前任务仍在运行，请先停止或完成审批。'); return; }
    const c=cases.find(c=>c.id===id);if(!c)return;
    const trigger=modal.open?q('#loadFromSample'):quick?q('#quickScript'):gallery.querySelector('[data-load="'+id+'"]');const label=trigger.textContent;trigger.disabled=true;trigger.textContent=quick?'正在生成脚本…':'正在载入素材…';
    loading=true;gallery.setAttribute('aria-busy','true');notice('正在从项目样例载入素材…');
    try {
      const f=quick?null:c.kind==='review'?await asFile(c.video,c.id+'-preset.mp4','video/mp4'):await asFile(c.image,c.id+'-product.png','image/png');
      q('#btnClear').click();q('#toast').classList.remove('on');setFile('#productImages',null);setFile('#reviewVideo',null);
      LLM.active='offline';q('#railProviderTxt').textContent='离线规则 · 无模型调用';updateMode();
      q('#projectTitle').textContent=c.title;q('#brief').value=c.brief || '';q('#bait').checked=!!c.repair;q('#platform').value=c.platform || 'douyin';q('#videoDuration').value='12';
      q('#brief').dispatchEvent(new Event('input',{bubbles:true}));
      if(quick){Workbench.go('script');notice('正在用商品事实生成四句文案；不下载图片，不制作视频。');q('#btnStart2').click();}
      else if(c.kind==='review'){setFile('#reviewVideo',f);Workbench.go('media');notice('已载入带黑场的测试视频。本次检查尚未运行；连接本机服务后点击“开始技术审查”。');}
      else {setFile('#productImages',f);Workbench.go('desk');notice(c.repair?'已载入咖啡案例，并启用一次未提供主张的故障注入。点击“生成并检查脚本”，观察真实退回与修订。':'素材已就位。核对商品事实，点击“生成并检查脚本”；预置成片没有进入本次交付包。');}
      if(modal.open)closeSample();
    } catch(e){const msg='载入失败：'+(e.name==='TimeoutError'?'素材下载超时':e.message)+'。可重试，或用首页示例直接生成脚本。';notice(msg);if(modal.open)q('#sampleReport').textContent=msg;else trigger.after(q('#galleryStatus'));}
    finally{trigger.disabled=false;trigger.textContent=label;loading=false;gallery.removeAttribute('aria-busy');}
  }
  gallery.addEventListener('click',e=>{const previewButton=e.target.closest('[data-preview]'),loadButton=e.target.closest('[data-load]');if(previewButton)preview(previewButton.dataset.preview);if(loadButton)load(loadButton.dataset.load);});
  q('#loadFromSample').onclick=()=>load(previewId);
  q('#quickScript').onclick=()=>load('commute',true);
  q('#newProject').onclick=()=>{if(loading||Workbench.busy())return notice('先停止或完成当前任务。');q('#btnClear').click();q('#toast').classList.remove('on');setFile('#productImages',null);setFile('#reviewVideo',null);q('#brief').value='';q('#bait').checked=false;q('#brief').dispatchEvent(new Event('input',{bubbles:true}));q('#projectTitle').textContent='新建短片';updateMode();Workbench.go('desk');q('#brief').focus();notice('从商品名称、真实参数、售价和目标人群开始。没有的信息不应编造。');};
  q('#backGallery').onclick=()=>Workbench.go('gallery');
  document.querySelectorAll('.work-steps button').forEach(b=>b.onclick=()=>Workbench.go(b.dataset.go));
  q('#btnStart2').textContent='生成并检查脚本';q('#btnStart').textContent='生成脚本';q('#openReview').textContent='查看审查与修订 →';
  q('#goVideoWorkshop').textContent='继续到第 4 步：交付 →';
  q('#projectChrome').after(q('#pane-desk'));
  q('.workspace-intro').hidden=true;q('.flow').hidden=true;
  const exports=q('.delivery-card');q('.media-intro').after(exports);
  const continuation=document.createElement('div');continuation.className='stage-continuation';continuation.innerHTML='<button class="btn" id="showCurrentReview">查看规则、修订与批准状态 →</button><span>本次任务证据，非预置报告</span>';q('.run-strip').after(continuation);q('#showCurrentReview').onclick=()=>Workbench.go('review');
  const previousReview=q('#revHead').innerHTML, previousChecks=q('#revChecks').innerHTML;
  const output=document.createElement('section');output.className='card';output.hidden=true;output.innerHTML='<h2>本次生成的短片脚本</h2><p>这是可用于拍摄或配字幕的文案，还不是 MP4。</p><pre style="white-space:pre-wrap;overflow-wrap:anywhere;font:inherit" id="approvedCopy"></pre><div class="rowbtns"><button class="btn" id="getApprovedCopy">下载本次文案 TXT</button><button class="btn ghost" id="getApprovedSubs">下载字幕 SRT</button></div>';q('#pane-review .delivery-stage').prepend(output);q('#getApprovedCopy').onclick=()=>q('#expTxt2').click();q('#getApprovedSubs').onclick=()=>q('#expSrt2').click();
  function clearOutput(){output.hidden=true;q('#approvedCopy').textContent='';}
  function resetReview(){if(Workbench.busy())return;clearOutput();q('#revHead').innerHTML=previousReview;q('#revChecks').innerHTML=previousChecks;q('#projectNotice').textContent='输入已更新，旧审批与文件已失效。重新生成脚本后再交付。';}
  q('#brief').addEventListener('input',resetReview);q('#platform').addEventListener('change',resetReview);q('#btnClear').addEventListener('click',resetReview);
  window.addEventListener('oneshot:navigate',e=>{navigationVersion++;const titles={gallery:'案例展厅',desk:'创作工作台',script:'创作工作台',review:'脚本审查',delivery:'脚本审查',media:'本次交付',settings:'模型设置',trace:'执行记录',memory:'本地记忆',batch:'批量任务'};q('.topbar h1').firstChild.textContent=titles[e.detail.pane]||'OneShot';updateMode();});
  window.addEventListener('oneshot:agent-state',e=>{const {kind,payload}=e.detail;
    if(kind==='plan'){clearOutput();followRun=document.body.dataset.surface==='project';if(!followRun)return;Workbench.go('script');notice('正在现场运行：脚本生成 → 规则检查 → 有限修订 → 人工批准。');}
    if(kind==='approval')q('#projectNotice').textContent='等待你核对文案。批准后才能导出或制作本次成片。';
    if(kind==='done'&&followRun){const scheduledAt=navigationVersion;requestAnimationFrame(()=>{if(navigationVersion!==scheduledAt)return;updateMode();Workbench.go('review');if(payload.deliveryApproved&&payload.files){q('#approvedCopy').textContent=payload.files.txt;output.hidden=false;output.scrollIntoView({block:'start'});}notice(payload.deliveryApproved?'本次脚本已批准。第 4 步可下载文件，或在本机制作新 MP4。':payload.status==='aborted'?'任务已停止，文件未开放；可以修改输入后重新运行。':payload.verdict?.pass?'本次初筛通过，但你未批准交付；文件保持锁定。':payload.error||'本次规则检查未通过，查看失败项后修改输入或配置。');});}
  });
  window.addEventListener('oneshot:media-ready',()=>notice('本次新 MP4 已编码完成。播放器和下载文件来自这次实际运行。'));
  window.addEventListener('pagehide',()=>q('#sampleVideo').pause());
  Workbench.go('gallery');
})();
