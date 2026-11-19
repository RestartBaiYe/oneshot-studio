(function () {
  "use strict";
  const q = s => document.querySelector(s), cases = window.ONESHOT_CASES || [];
  const gallery = q('#pane-gallery');
  let loading = false, followRun = false, navigationVersion = 0;
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  gallery.innerHTML =     '<div class="gallery-intro"><div><span class="eyebrow">ONESHOT / CONTENT OPERATIONS STUDIO</span><h2>下一支短片，<br>从这里<span>开始。</span></h2><p>把商品事实变成脚本，把审查和交付放进同一条工作流。<br>先看作品，再亲手运行一次。</p><div class="gallery-actions"><button class="btn" id="startFeatured">用通勤杯案例开始 ↗</button><button class="btn ghost" id="newProject">从空白创建</button></div><div class="gallery-caption"><span>01 素材</span><i>→</i><span>02 脚本</span><i>→</i><span>03 审查</span><i>→</i><span>04 交付</span></div></div><button class="featured-film" data-preview="commute" aria-label="播放通勤杯预置成片"><img src="samples/commute/product.png" alt="自行绘制的蓝色通勤杯示意图"><span class="featured-label">FEATURED STUDY / 001</span><span class="featured-title">日常，也值得<br>一个好镜头。</span><span class="featured-play">▶ <b>看 12 秒预置成片</b></span><span class="preset-stamp">预置样例 · 非本次生成</span></button></div>' +
    '<div class="gallery-section-head"><div><span class="eyebrow">PICK A STARTING POINT</span><h3>三个案例，三种工作现场。</h3></div><span>无需密钥看样例 · 本次运行单独记录</span></div><div class="case-grid">' +
    cases.map(c => '<article class="case-card"><button class="case-image" data-preview="'+c.id+'" aria-label="查看'+escape(c.title)+'预置成片"><img loading="eager" src="'+c.cover+'" alt="'+escape(c.title)+'自制素材"><span>'+escape(c.tag)+'</span><i>▶</i></button><div class="case-body"><h4>'+escape(c.title)+'</h4><p>'+escape(c.description)+'</p><div class="case-actions"><button class="btn ghost sm" data-load="'+c.id+'">'+(c.kind==='review'?'载入视频检查 →':'载入并准备运行 →')+'</button><button class="text-action" data-preview="'+c.id+'">看样例</button></div></div></article>').join('') +
    '</div><aside class="gallery-boundary"><b>样例可直接看，工作必须真实跑。</b><p>预置视频与报告来自本机 FFmpeg 实际生成/检测，不算作本次任务完成。脚本、修订与审批可在浏览器现场运行；制作新 MP4 或重新检查视频需连接本机服务。离线规则不是在线模型。</p><a href="README.md" target="_blank" rel="noreferrer">启动与能力说明 ↗</a></aside><p id="galleryStatus" role="status"></p>';
  const modal = document.createElement('dialog');
  modal.id = 'sampleDialog';
  modal.setAttribute('aria-labelledby','sampleTitle');
  modal.innerHTML = '<header><div><span class="preset-label">预置样例 / NOT A LIVE RESULT</span><h2 id="sampleTitle"></h2></div><button class="btn ghost sm" id="closeSample" aria-label="关闭样例">关闭 ×</button></header><div class="sample-content"><video id="sampleVideo" controls playsinline preload="metadata"></video><div class="sample-notes"><h3>先看输出，再重跑流程。</h3><p>这是随项目附带的预置成片，不会写入本次审批、工具记录或交付包。</p><div id="sampleReport" aria-live="polite"></div><div class="sample-downloads"><a id="sampleDownload" download>下载预置 MP4 ↗</a><a id="sampleReportDownload" download>下载预置报告 JSON ↗</a></div><button class="btn" id="loadFromSample">以此案例开始新任务 →</button><p class="hint">商品为自行绘制的演示图，不是真实品牌广告；无音轨、无生成式视频。</p></div></div>';
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
  async function asFile(url,name,type) { const response=await fetch(url);if(!response.ok)throw Error('样例文件不可用 (HTTP '+response.status+')');return new File([await response.blob()],name,{type}); }
  function setFile(selector,file) { const dt=new DataTransfer();if(file)dt.items.add(file);q(selector).files=dt.files;q(selector).dispatchEvent(new Event('change',{bubbles:true})); }
  function updateMode() { q('#taskMode').textContent=LLM.active==='offline'?'离线规则 · 无模型调用':'模型辅助 · '+LLM.cfg.model; }
  async function load(id) {
    if (loading || Workbench.busy()) { notice('当前任务仍在运行，请先停止或完成审批。'); return; }
    const c=cases.find(c=>c.id===id);if(!c)return;
    loading=true;gallery.setAttribute('aria-busy','true');notice('正在从项目样例载入素材…');
    try {
      const f=c.kind==='review'?await asFile(c.video,c.id+'-preset.mp4','video/mp4'):await asFile(c.image,c.id+'-product.png','image/png');
      q('#btnClear').click();q('#toast').classList.remove('on');setFile('#productImages',null);setFile('#reviewVideo',null);
      LLM.active='offline';q('#railProviderTxt').textContent='离线规则 · 无模型调用';updateMode();
      q('#projectTitle').textContent=c.title;q('#brief').value=c.brief || '';q('#bait').checked=!!c.repair;q('#platform').value=c.platform || 'douyin';q('#videoDuration').value='12';
      q('#brief').dispatchEvent(new Event('input',{bubbles:true}));
      if(c.kind==='review'){setFile('#reviewVideo',f);Workbench.go('media');notice('已载入带黑场的测试视频。本次检查尚未运行；连接本机服务后点击“开始技术审查”。');}
      else {setFile('#productImages',f);Workbench.go('desk');notice(c.repair?'已载入咖啡案例，并启用一次未提供主张的故障注入。点击“生成并检查脚本”，观察真实退回与修订。':'素材已就位。核对商品事实，点击“生成并检查脚本”；预置成片没有进入本次交付包。');}
      if(modal.open)closeSample();
    } catch(e){notice('载入失败：'+e.message+'。请重试，或从空白创建任务。');}
    finally{loading=false;gallery.removeAttribute('aria-busy');}
  }
  gallery.addEventListener('click',e=>{const previewButton=e.target.closest('[data-preview]'),loadButton=e.target.closest('[data-load]');if(previewButton)preview(previewButton.dataset.preview);if(loadButton)load(loadButton.dataset.load);});
  q('#loadFromSample').onclick=()=>load(previewId);
  q('#startFeatured').onclick=()=>load('commute');
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
  function resetReview(){if(Workbench.busy())return;q('#revHead').innerHTML=previousReview;q('#revChecks').innerHTML=previousChecks;q('#projectNotice').textContent='输入已更新，旧审批与文件已失效。重新生成脚本后再交付。';}
  q('#brief').addEventListener('input',resetReview);q('#platform').addEventListener('change',resetReview);q('#btnClear').addEventListener('click',resetReview);
  window.addEventListener('oneshot:navigate',e=>{navigationVersion++;const titles={gallery:'案例展厅',desk:'创作工作台',script:'创作工作台',review:'脚本审查',delivery:'脚本审查',media:'本次交付',settings:'模型设置',trace:'执行记录',memory:'本地记忆',batch:'批量任务'};q('.topbar h1').firstChild.textContent=titles[e.detail.pane]||'OneShot';updateMode();});
  window.addEventListener('oneshot:agent-state',e=>{const {kind,payload}=e.detail;
    if(kind==='plan'){followRun=document.body.dataset.surface==='project';if(!followRun)return;Workbench.go('script');notice('正在现场运行：脚本生成 → 规则检查 → 有限修订 → 人工批准。');}
    if(kind==='approval')q('#projectNotice').textContent='等待你核对文案。批准后才能导出或制作本次成片。';
    if(kind==='done'&&followRun){const scheduledAt=navigationVersion;requestAnimationFrame(()=>{if(navigationVersion!==scheduledAt)return;updateMode();Workbench.go('review');notice(payload.deliveryApproved?'本次脚本已批准。第 4 步可下载文件，或在本机制作新 MP4。':payload.status==='aborted'?'任务已停止，文件未开放；可以修改输入后重新运行。':payload.verdict?.pass?'本次初筛通过，但你未批准交付；文件保持锁定。':payload.error||'本次规则检查未通过，查看失败项后修改输入或配置。');});}
  });
  window.addEventListener('oneshot:media-ready',()=>notice('本次新 MP4 已编码完成。播放器和下载文件来自这次实际运行。'));
  window.addEventListener('pagehide',()=>q('#sampleVideo').pause());
  Workbench.go('gallery');
})();
