(() => {
  'use strict';
  const q=s=>document.querySelector(s), nav=q('.work-steps'), next=q('#slateNext'), note=q('#projectNotice');
  const tabs=Array.from(nav.querySelectorAll('button')), symbols={idle:'○',ready:'◇',active:'▶',done:'✓',hold:'!',skip:'—'};
  const names=['素材准备','脚本生成','审查批准','视频交付'];
  tabs.forEach((tab,i)=>{tab.replaceChildren();const head=document.createElement('span');head.className='slate-index';head.textContent='0'+(i+1);const mark=document.createElement('i');mark.setAttribute('aria-hidden','true');head.append(mark);const name=document.createElement('b');name.textContent=names[i];const status=document.createElement('small');tab.append(head,name,status);});
  let intent='create',working=false,script=false,round=0,phase='',result=null,media={},invalidated=false,dirty=false,action;
  const guide=q('.prep-guide'),receipt=document.createElement('aside');receipt.className='card slate-receipt';receipt.hidden=true;guide.after(receipt);
  let receiptFor=null;
  function refreshReceipt(){const current=result?.deliveryApproved?result:null;guide.hidden=!!current;receipt.hidden=!current;if(current===receiptFor)return;receiptFor=current;receipt.replaceChildren();if(!current)return;
    const add=(parent,tag,cls,text)=>{const el=document.createElement(tag);el.className=cls;el.textContent=text;parent.appendChild(el);return el;};
    add(receipt,'span','slate-eyebrow','APPROVED COPY  /  审批留底');add(receipt,'h2','','本次已批准脚本');const list=add(receipt,'ol','slate-lines','');current.verdict.subs.forEach((line,i)=>{const row=add(list,'li','','');add(row,'small','',['01　开场','02　卖点','03　证据','04　行动'][i]);add(row,'span','',line);});add(receipt,'p','slate-foot','本页可回看原始事实。修改商品信息或平台后，这份批准失效。');
  }
  function reset(){if(working||Workbench.busy())return;invalidated=invalidated||!!result;result=null;script=false;round=0;phase='';}
  function focus(pane,id){Workbench.go(pane);const el=q(id);if(el){el.focus({preventScroll:true});el.scrollIntoView({block:'center'});}}
  function setAction(text,fn){next.textContent=text;next.disabled=!fn;action=fn;}
  next.onclick=()=>{if(action&&!next.disabled)action();};
  const run=()=>q('#btnStart2').click();
  function paint(){
    const valid=q('#brief').value.trim().length>=8, approved=!!result?.deliveryApproved, independent=intent==='check', skip=independent&&!working;
    const tabStates=[valid?['ready','已就绪']:['idle','待填写'],['idle','待生成'],['idle','待审查'],['idle','未开放']];
    let text=valid?(invalidated?'输入已修改，旧审批失效。重新生成后再交付。':'商品事实已就绪，生成四镜脚本后再核对。'):'先写商品名称和一条真实卖点，至少 8 个字符。',btn=valid?'生成并审查脚本 →':'填写商品事实 →',act=valid?run:()=>focus('desk','#brief');
    if(working||result){tabStates[0]=['done','已用于本轮'];tabStates[1]=script||result?.verdict?['done','四镜已生成']:['active','正在生成'];}
    if(working){text=phase||'正在根据本次商品事实制定计划。';btn='运行中';act=null;if(round||phase==='正在执行规则初筛。')tabStates[2]=['active',round?'复核第 '+round+' 轮':'规则初筛'];if(phase==='等待你核对脚本并决定是否交付。'){tabStates[2]=['hold','待批准'];btn='等待批准';}}
    if(result){const n=result.round||round;tabStates[1]=script||result.verdict?['done','四镜已生成']:['hold','未生成'];if(approved){tabStates[2]=['done','已批准 · '+n+'轮'];tabStates[3]=['ready','MP4 待制作'];text='脚本已批准。回看不会清除批准；新 MP4 尚未制作。';btn='去制作 MP4 →';act=()=>focus('media',!media.online?'#mediaServiceCheck':media.imagesValid?'#makeVideo':'#productImages');}else{const denied=result.status==='reviewed'&&result.verdict?.pass;tabStates[2]=['hold',denied?'未批准':result.status==='aborted'?'已停止':result.status==='needs_review'?'需修订':'运行失败'];text=denied?'本次未获批准，文件仍锁定。可再次运行并核对。':result.error||'本轮未完成，请查看检查项，修正输入后重跑。';btn=denied?'重新运行并核对 →':'返回素材修改 →';act=denied?run:()=>focus('desk','#brief');}}
    if(skip){for(let i=0;i<3;i++)tabStates[i]=['skip','无需此步'];}
    if(independent&&!working){tabStates[3]=media.report?['done','报告已就绪']:media.file?['ready','待检查']:['idle','待选视频'];text=media.report?'技术报告已生成，可下载本次检查结果。':media.file?'已选择视频。技术检查读取元数据、黑场与镜头变化。':'已有视频可直接检查，不需要脚本或审批。';btn=media.report?'下载检查报告 ↓':media.file?'去检查视频 →':'选择视频 →';act=media.report?()=>q('#downloadVideoReport').click():()=>focus('media',media.file&&media.fileValid?'#runVideoReview':'#reviewVideo');}
    if(media.film&&!independent&&!working){tabStates[3]=['done','5 份文件就绪'];text='本次成片与配套文件已生成，可以播放或下载。';btn='查看本次文件 →';act=()=>focus('media','#renderFiles a');}
    if(!working&&media.status==='failed'&&((media.kind==='review')===independent)){tabStates[3]=['hold','需要重试'];text='媒体操作失败。查看本次错误后决定是否重试，不会自动重复执行。';btn='查看失败原因 →';act=()=>focus('media',media.online?'#mediaRetry':'#mediaServiceCheck');}
    if(!working&&independent&&media.file&&!media.fileValid){tabStates[3]=['hold','视频过大'];text='视频超过 500 MB，请替换后再检查。';btn='替换视频 →';act=()=>focus('media','#reviewVideo');}
    if(!working&&!independent&&approved&&!media.imagesValid){tabStates[3]=['hold','图片需更换'];text='请使用最多 8 张 JPG、PNG 或 WebP 图片，每张不超过 12 MB。';btn='更换图片 →';act=()=>focus('media','#productImages');}
    if(!working&&!media.online&&((approved&&!independent&&!media.film)||(independent&&media.fileValid&&!media.report))){tabStates[3]=['hold','待连接服务'];text='本机媒体服务未连接。脚本文案仍可在获批后下载。';btn='连接本机服务 →';act=()=>focus('media','#mediaServiceCheck');}
    if(media.rendering||media.reviewing){tabStates[3]=['active',media.rendering?'正在编码':'正在检查'];text='本机正在处理，完成后在第 4 步领取文件。';btn='处理中';act=null;}
    tabs.forEach((tab,i)=>{const [tone,label]=tabStates[i];if(tab.dataset.tone!==tone){tab.dataset.tone=tone;tab.querySelector('i').textContent=symbols[tone];}if(tab.querySelector('small').textContent!==label)tab.querySelector('small').textContent=label;});
    if(!working&&document.body.dataset.workstep==='delivery'){
      if(act&&btn==='去制作 MP4 →'){btn='制作本次 MP4';act=()=>q('#makeVideo').click();}
      if(act&&btn==='去检查视频 →'){btn='开始技术检查';act=()=>q('#runVideoReview').click();}
      if(act&&btn==='连接本机服务 →'){btn='重新连接';act=()=>{q('#mediaServiceCheck').click();focus('media','#mediaServiceCheck');};}
      if(act&&(btn==='选择视频 →'||btn==='替换视频 →'))act=()=>q('#reviewVideo').click();
    }
    refreshReceipt();
    if(note.textContent!==text)note.textContent=text;if(next.textContent!==btn||next.disabled!==!act)setAction(btn,act);else action=act;
    q('#btnStop').disabled=!Workbench.busy();q('#btnStart2').textContent=approved?'重新生成脚本':'生成并检查脚本';
  }
  function schedule(){if(!dirty){dirty=true;queueMicrotask(()=>{dirty=false;paint();});}}
  window.addEventListener('oneshot:make-video',()=>{intent='create';schedule();});
  window.addEventListener('oneshot:check-video',()=>{intent='check';schedule();});
  window.addEventListener('oneshot:script-start',()=>{working=true;result=null;intent='create';phase='';script=false;round=0;invalidated=false;schedule();});
  window.addEventListener('oneshot:agent-state',({detail:{kind,payload:p}})=>{if(!working)return;if(kind==='step'){if(p.step.tool==='review.judge')phase='正在执行规则初筛。';if(p.step.tool==='script.revise')phase='正在根据退回项修订问题镜头。';}if(kind==='observe'){if(p.tool==='script.draft')script=true;if(p.tool==='review.judge')round++;}if(kind==='approval')phase='等待你核对脚本并决定是否交付。';if(kind==='done'){working=false;result=p;}schedule();});
  window.addEventListener('oneshot:media-state',e=>{media=e.detail;if(media.rendering)intent='create';if(media.reviewing)intent='check';schedule();});
  window.addEventListener('oneshot:navigate',schedule);
  for(const [id,ev] of [['#brief','input'],['#platform','change'],['#chips','click'],['#btnClear','click']])q(id).addEventListener(ev,()=>{if(!working&&!Workbench.busy()){reset();intent='create';if(id==='#btnClear')invalidated=false;}schedule();});
  q('#reviewVideo').addEventListener('change',()=>{if(q('#reviewVideo').files.length)intent='check';schedule();});
  q('#newProject').addEventListener('click',()=>{if(!Workbench.busy()){invalidated=false;intent='create';schedule();}});
  media=Workbench.mediaState();paint();
})();
