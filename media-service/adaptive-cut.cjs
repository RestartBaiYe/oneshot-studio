'use strict';
const {promisify}=require('node:util'),exec=promisify(require('node:child_process').execFile);
const fps=24,sampleRate=8,side=48,area=side*side,maxFrames=30*fps;
const profiles={balanced:[1.55,2.35,2.7,1.9],snappy:[1.25,1.95,2.2,1.6],detail:[1.85,2.85,3.15,2.15]};
const reason=['首镜尽早进入可见变化，删去等待。','保留能承载购买理由的完整展示片段。','为卖点佐证与数字留出识别时间。','给行动文案留出停留时间，不拖长尾段。'];
const bound=(n,lo,hi)=>Math.min(hi,Math.max(lo,n));
function reading(script){const v=String(script||'');const c=(v.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu)||[]).length,w=(v.match(/[A-Za-z0-9]+(?:[.,][0-9]+)?/g)||[]).length;return Math.ceil((.35+c/7+w*.34)*fps);}
function samples(bytes){if(!bytes.length||bytes.length%area!==0)throw Error('视频抽样不完整');const out=[];let prev=null;for(let pos=0;pos<bytes.length;pos+=area){const v=bytes.subarray(pos,pos+area);let dark=0,mean=0,diff=0;for(let i=0;i<area;i++){mean+=v[i];if(v[i]<=22)dark++;if(prev)diff+=Math.abs(v[i]-prev[i]);}out.push({black:dark/area>.96,mean:mean/area,motion:prev?diff/area/255:0});prev=v;}return out;}
async function scan(ffmpeg,path){const {stdout}=await exec(ffmpeg,['-nostdin','-v','error','-protocol_whitelist','file,pipe','-i',path,'-map','0:v:0','-t','30','-vf','fps=8,scale=48:48:flags=area,format=gray','-an','-f','rawvideo','pipe:1'],{encoding:'buffer',windowsHide:true,timeout:20000,maxBuffer:area*(30*sampleRate+3)});return samples(stdout);}
function suggest(series,available,shot,i,profile='balanced'){
 if(!profiles[profile]||!series.length||!Number.isInteger(available)||available<1||available>maxFrames)throw Error('素材或节奏模式无效');
 const N=series.length,read=reading(shot.script),plan=profiles[profile][i];const active=series.filter(f=>!f.black&&f.motion>.018&&f.motion<.27).length/sampleRate;
 const desired=Math.min(5,Math.max(read/fps,plan+(i===1||i===2?Math.min(1.0,active*.22):0)));
 const minimum=Math.min(available,Math.max(24,Math.min(120,read),Math.ceil((i===2?1.85:i===3?1.5:1.1)*fps)));
 const longest=Math.min(available,Math.max(minimum,Math.min(120,Math.ceil((desired+.65)*fps))));
 let best=null;const weights=[1.1,1.0,.65,.32];for(let length=minimum;length<=longest;length++){for(let start=0;start<=available-length;start+=3){const left=Math.min(N-1,Math.floor(start/3)),right=Math.max(left+1,Math.min(N,Math.ceil((start+length)/3)));let blacks=0,interest=0,cuts=0,hold=0,early=0;for(let k=left;k<right;k++){const a=series[k],m=k===left?0:a.motion;blacks+=+a.black;if(!a.black){const activity=bound((m-.012)/.055,0,1)*(m>.27?.15:1);interest+=activity;if(k<left+5)early+=activity;if(m<.03)hold++;}if(k>left&&m>.27)cuts++;}const L=right-left;const score=weights[i]*(interest/L)*1.6+(i===0?early/Math.min(5,L)*1.7:0)+(i>=2?hold/L*.55:0)-blacks/L*8-(series[left].black?2:0)-(series[right-1].black?1:0)-cuts/L*2.5-Math.abs(length/fps-desired)*.95-start/available*.045;if(!best||score>best.score)best={score,inFrame:start,frames:length,blackSamples:blacks,windowSamples:L};}}
 const visible=series.some(x=>!x.black);const warnings=[];const skipped=series.slice(0,Math.floor(best.inFrame/3)),blackLead=skipped.filter(f=>f.black).length/sampleRate;const why=!visible?'采样接近全黑；本建议不能修复素材。':blackLead>=.25?'跳过前部约 '+blackLead.toFixed(2)+' 秒近黑采样。':active<.25?'画面变化少，以文案可读性定长。':i<2?'优先保留连续画面变化，避免空等。':'画面较稳定的区间优先留给细节或文案。';if(read>best.frames)warnings.push('素材或建议上限不足以读完文案：请精简文案或人工延长。');if(!visible)warnings.push('采样画面几乎全黑，建议换镜头；节奏不能修复内容。');else if(best.blackSamples)warnings.push('建议区间仍含暗场，请试看。');if(active<.25)warnings.push('未检出持续运动；按字幕和镜头职责推荐，静物不等于无价值。');return {inFrame:best.inFrame,frames:best.frames,sourceFrames:available,readFrames:read,samples:N,motionSeconds:Math.round(active*100)/100,warnings,note:reason[i]+why,origin:'measured'};
}
module.exports={profiles,reading,samples,scan,suggest};
