'use strict';
const fs = require('node:fs');
const path = require('node:path');
const FPS = 24;
const STYLE = 'editorial-motion-v1';
function timeline(duration) {
  const part = duration / 4, transition = Math.min(0.5, part / 5);
  return Array.from({length:4}, (_,i) => ({scene:i+1,start:i*part,end:(i+1)*part,sourceDuration:part+transition*(i===0||i===3?0.5:1),transition,motion:['缓入推进','细节近景','横向舒展','缓出定格'][i]}));
}
function wrapText(value, limit = 13) {
  const chars = Array.from(new Intl.Segmenter('zh',{granularity:'grapheme'}).segment(value.replace(/\s+/g,' ').trim()), x=>x.segment);
  const lines = []; let current = '', width = 0;
  for (const char of chars) {
    const w = /^[WM@%]$/.test(char) ? 1 : /^[\x20-\x7e]+$/.test(char) ? 0.65 : 1;
    if (width+w>limit && current) { lines.push(current);current='';width=0; }
    current += char; width += w;
  }
  if(current)lines.push(current);
  return lines.join('\n');
}
function scrim(file) {
  const w=1080,h=1920,pixels=Buffer.alloc(w*h*4);
  for(let y=0;y<h;y++) {
    const bottom=Math.min(0.94,Math.max(0,(y/h-0.43)/0.41)*0.94),top=Math.max(0,1-y/640)*0.50;
    const a=Math.round(Math.max(bottom,top)*255);
    for(let x=0;x<w;x++){const o=(y*w+x)*4;pixels[o]=10;pixels[o+1]=16;pixels[o+2]=29;pixels[o+3]=a;}
  }
  fs.writeFileSync(file,Buffer.concat([Buffer.from('P7\nWIDTH 1080\nHEIGHT 1920\nDEPTH 4\nMAXVAL 255\nTUPLTYPE RGB_ALPHA\nENDHDR\n'),pixels]));
}
async function compose({run,ffmpeg,sources,lines,duration,tmp,out}) {
  const shots=timeline(duration),args=['-hide_banner','-filter_complex_threads','1'],filters=[];
  shots.forEach((shot,i)=>{
    if(sources.length) args.push('-loop','1','-framerate',String(FPS),'-t',String(shot.sourceDuration),'-i',sources[i%sources.length]);
    else args.push('-f','lavfi','-i','color=c='+['0x243761','0x34446d','0x273951','0x152641'][i]+':s=1080x1920:r=24:d='+shot.sourceDuration);
    const last=Math.max(1,Math.round(shot.sourceDuration*FPS)-1),ease='(0.5-0.5*cos(PI*min(on/'+last+',1)))';
    const zoom=['1.015+0.075*'+ease,'1.15-0.055*'+ease,'1.085','1.07-0.055*'+ease][i];
    const x=i===2?'(iw-iw/zoom)*(0.30+0.35*'+ease+')':'(iw-iw/zoom)/2';
    filters.push('['+i+':v]scale=1620:2880:force_original_aspect_ratio=increase,crop=1620:2880,setsar=1,zoompan=z=\''+zoom+'\':x=\''+x+'\':y=\'(ih-ih/zoom)/2\':d=1:s=1080x1920:fps=24,trim=duration='+shot.sourceDuration+',settb=1/24,setpts=PTS-STARTPTS,format=yuv420p[s'+i+']');
  });
  let previous='s0';
  for(let i=1;i<4;i++){const next='mix'+i;filters.push('['+previous+'][s'+i+']xfade=transition=fade:duration='+shots[i].transition+':offset='+(shots[i].start-shots[i].transition/2)+'['+next+']');previous=next;}
  scrim(path.join(tmp,'scrim.pam'));args.push('-loop','1','-framerate','24','-i',path.join(tmp,'scrim.pam'));
  filters.push('['+previous+'][4:v]overlay=shortest=1:format=auto,format=yuv420p[base]');
  const overlays=["drawtext=fontfile='subtitle-font':text='ONESHOT   /   ORIGINAL STUDY':expansion=none:fontcolor=white@0.8:fontsize=23:x=84:y=89",'drawbox=x=84:y=139:w=912:h=1:color=white@0.24:t=fill','drawbox=x=84:y=1788:w=912:h=2:color=white@0.20:t=fill'];
  const stages=['01   /   INTRO','02   /   DETAIL','03   /   EVIDENCE','04   /   NEXT'];
  shots.forEach((shot,i)=>{
    const text=wrapText(lines[i]),rows=text.split('\n').length,font=rows>3?52:68,y=Math.min(1510,1700-rows*(font+16));
    fs.writeFileSync(path.join(tmp,'shot'+i+'.txt'),text,'utf8');
    const enable="enable='gte(t,"+shot.start+")*lt(t,"+shot.end+")'",alpha="alpha='min(1,max(0,(t-"+shot.start+")/0.25))*min(1,max(0,("+shot.end+"-t)/0.18))'";
    overlays.push("drawtext=fontfile='subtitle-font':text='"+stages[i]+"':expansion=none:fontcolor=0xb5caff:fontsize=25:x=86:y="+(y-72)+':'+enable);
    overlays.push("drawtext=fontfile='subtitle-font':textfile='shot"+i+".txt':expansion=none:fontcolor=0xf8faff:fontsize="+font+":line_spacing=16:x=82:y='"+y+"+18*(1-min(1,max(0,(t-"+shot.start+")/0.38)))':"+alpha+':'+enable);
    overlays.push('drawbox=x='+(84+i*236)+':y=1787:w=204:h=4:color=0x93b0ff:t=fill:'+enable);
  });
  overlays.push("drawtext=fontfile='subtitle-font':text='PRODUCT FILM   /   4 SHOTS':expansion=none:fontcolor=white@0.6:fontsize=21:x=84:y=1825");
  filters.push('[base]'+overlays.join(',')+'[v]');
  args.push('-filter_complex',filters.join(';'),'-map','[v]','-an','-t',String(duration),'-c:v','libx264','-threads','2','-preset','veryfast','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart','-r',String(FPS),'-y',out);
  await run(ffmpeg,args,180000,undefined,tmp);
  return {style:STYLE,shots:shots.map((s,i)=>({scene:s.scene,start:+s.start.toFixed(3),end:+s.end.toFixed(3),text:lines[i],visual:sources.length?'商品图运动构图 + 分层字幕':'品牌色场 + 分层字幕',motion:s.motion,transition:s.scene<4?'交叉溶解 '+s.transition+' 秒':'结束'}))};
}
module.exports={compose,timeline,wrapText,STYLE};
