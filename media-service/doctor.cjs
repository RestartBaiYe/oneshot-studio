'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),{execFile}=require('node:child_process'),{promisify}=require('node:util');
const exec=promisify(execFile);
function settings(env=process.env){return {ffmpeg:env.FFMPEG_PATH||'ffmpeg',ffprobe:env.FFPROBE_PATH||(env.FFMPEG_PATH?path.join(path.dirname(env.FFMPEG_PATH),process.platform==='win32'?'ffprobe.exe':'ffprobe'):'ffprobe'),font:env.ONESHOT_FONT||path.join(env.WINDIR||'C:/Windows','Fonts','msyh.ttc')};}
async function verify({ffmpeg,ffprobe,font}=settings()){
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'oneshot-check-'));let step='读取中文字体 (ONESHOT_FONT)';
 const run=(exe,args)=>exec(exe,args,{cwd:dir,windowsHide:true,timeout:20000,maxBuffer:256*1024});
 try{await fs.copyFile(font,path.join(dir,'font'));await fs.writeFile(path.join(dir,'caption'),'上新预检','utf8');step='FFmpeg 字幕与 H.264 编码 (FFMPEG_PATH)';await run(ffmpeg,['-hide_banner','-loglevel','error','-f','lavfi','-i','color=c=navy:s=160x96:r=12','-vf','drawtext=fontfile=font:textfile=caption:expansion=none:fontcolor=white:fontsize=18','-frames:v','3','-c:v','libx264','-pix_fmt','yuv420p','check.mp4']);step='FFprobe 产物读取 (FFPROBE_PATH)';let {stdout}=await run(ffprobe,['-v','error','-select_streams','v:0','-show_entries','stream=codec_name,nb_frames','-of','json','check.mp4']);let v=JSON.parse(stdout).streams?.[0];if(v?.codec_name!=='h264'||Number(v.nb_frames)!==3)throw Error('编码或帧数不匹配');return {ready:true,codec:'h264',frames:3,subtitleFilter:true};}catch(e){throw Error(step+' 失败：'+(e.code||e.signal||'检查命令输出')+'。修正依赖后重新启动。');}finally{await fs.rm(dir,{recursive:true,force:true});}
}
module.exports={settings,verify};if(require.main===module)verify().then(x=>console.log(JSON.stringify(x))).catch(e=>{console.error(e.message);process.exitCode=1});
