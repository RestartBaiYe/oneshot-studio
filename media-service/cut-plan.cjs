'use strict';const fps=24,sourceSeconds=5;
const hooks=[
 '第一帧就有商品和视觉悬念：可从一个有辨识度的局部或一个已开始的动作切入，在首秒内让人认出商品。不以标志、空镜或缓慢推近开场。',
 '用一个可见的变化给出购买理由。按商品属性选手部动作、使用前后的可见状态或材质受光变化；动作完成就切，不表演未经证实的性能。',
 '改变景别或角度给出证据。尝试微距细节、侧向掠过或焦点转移，一镜只讲一件事；关键细节稳定可读后切走。',
 '用与上一镜有联系的轮廓、动作方向或颜色收束，留够识别包装和行动引导的时间；不用冗长淡出、重复片头或虚构价格牌。'];
const policy='以消费者决策而非单纯追求运动量为目标：首镜直接展示产品正解决的可见问题；第二镜说清一个购买理由；第三镜用可核对的视觉证据回应一个具体疑虑；最后给清楚、不虚构紧迫感的下一步。数字、包装和行动文案不要一闪而过。你是短广告剪辑师：依照商品可见特征主动选开场钩子与景别，不要四镜都慢推或静置。每镜设计一个可在前几秒兑现的视觉动作，并说明切点。可以用动作衔接、形状呼应、景别反差，而非滥用转场特效。画面字幕须在选用时长内能读完。每镜为 5 秒素材，成片不必用满。按展示动作、细节和文案阅读时间独立选择入点 start、使用秒数 seconds，合计不超 5；开场和收尾适当紧凑，卖点或证据需要时间就留足。cut.note 写具体的剪点（例如：拉链拉到顶时切），不要泛写“更有吸引力”。';
const notes=['主体可辨认、动作刚揭示时切到卖点。','购买理由对应的动作完成时切，不保留静止尾段。','证据细节清楚可读后切走。','商品与行动文案能读清时结束。'];
const err=msg=>Object.assign(Error(msg),{status:400});
function checked(x,cap=sourceSeconds*fps){if(!x||typeof x.start!=='number'||typeof x.seconds!=='number'||!Number.isFinite(x.start)||!Number.isFinite(x.seconds)||x.start<0||Math.round(x.seconds*fps)<Math.min(fps,cap)||Math.round((x.start+x.seconds)*fps)>cap)throw err('入点不能小于 0，通常至少选用 1 秒，出点不能超出素材实际时长。');const at=Math.round(x.start*fps),end=Math.round((x.start+x.seconds)*fps);if(typeof x.note!=='string'||!x.note.trim()||x.note.length>160)throw err('剪点说明需要 1–160 字');return {inFrame:at,frames:end-at,note:x.note.trim()};}
function suggest(shots){return shots.map((s,i)=>{if(s.cut){try{return {...checked(s.cut),origin:'model'};}catch{}}const base=[1.75,2.75,2.5,1.75][i],reading=Math.ceil(Array.from(s.script||'').length/8*4)/4;const secs=Math.min(5,Math.max(base,reading));return {...checked({start:0,seconds:secs,note:notes[i]}),origin:'rule'};});}
function userPlan(xs,caps=[],previous=[]){if(!Array.isArray(xs)||xs.length!==4)throw err('需要四个剪辑区间');return xs.map((x,i)=>{const prev=previous?.[i];if(prev&&Number.isFinite(x?.start)&&Number.isFinite(x?.seconds)&&Math.round(x?.start*fps)===prev.inFrame&&Math.round(x?.seconds*fps)===prev.frames&&x?.note===prev.note)return prev;return {...checked(x,caps[i]),origin:'manual'};});}
function fit(c,available){if(!Number.isInteger(available)||available<1)throw err('镜头没有可剪辑的视频帧');if(!c)return {inFrame:0,frames:available};const frames=Math.min(c.frames,available),inFrame=Math.min(c.inFrame,available-frames);return {inFrame,frames};}
function cue(c){if(!c)return '';return '素材按 5 秒生成。把关键动作安排在素材约 '+(c.inFrame/fps).toFixed(2)+'–'+((c.inFrame+c.frames)/fps).toFixed(2)+' 秒，便于剪辑；切点：'+c.note+' 不用空镜等动作，不用长淡出。';}
module.exports={fps,sourceSeconds,hooks,policy,suggest,userPlan,fit,cue};
