const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const assert=require('node:assert/strict'), path=require('node:path'), fs=require('node:fs'), {spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'), local=process.env.TEST_URL || 'http://127.0.0.1:41739', before=process.argv.includes('--before');
const base=before?'http://127.0.0.1:41938':local, dir=process.env.EVIDENCE_DIR||path.join(root,'test-results/workbench');
(async()=>{
 let server,browser;
 try{
  if(before){server=spawn(process.execPath,['media-service/server.cjs'],{cwd:path.join(root,'github-release'),env:{...process.env,ONESHOT_PORT:'41938'}});await new Promise((resolve,reject)=>{server.once('exit',()=>reject(Error('baseline service unavailable')));server.stdout.once('data',resolve);server.once('error',reject)});}
  browser=await chromium.launch(process.env.BROWSER_PATH?{executablePath:process.env.BROWSER_PATH}:{channel:'msedge'}); fs.mkdirSync(dir,{recursive:true});
  for(const [width,theme] of [[1280,'light'],[390,'dark']]){
   const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
   await page.goto(base+'/?demo=1');await page.click('#newProject');if((await page.locator('html').getAttribute('data-theme')==='dark')!==(theme==='dark'))await page.click('#themeSwitch');
   for(const [tab,id] of [['desk','materials'],['script','script'],['review','review'],['media','delivery']]){
    await page.click('[data-go="'+tab+'"]');assert.equal(await page.locator('[aria-current="step"]').getAttribute('data-workstep'),id);
    assert(await page.locator('#pane-'+(tab==='script'?'desk':tab)).isVisible());
    if(tab==='media')await page.waitForFunction(()=>document.querySelector('#mediaServiceState').textContent.match(/已连接|已就绪/));
    await page.screenshot({path:path.join(dir,(before?'before':'after')+'-'+width+'-'+theme+'-'+id+'.png')});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
   }await page.close();
  }
  if(before)return;
  const p=await browser.newPage({acceptDownloads:true}), errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(base+'/?demo=1');
  await p.click('#pathReview');await p.setInputFiles('#reviewVideo',path.join(root,fs.existsSync(path.join(root,'demo/samples'))?'demo/samples':'samples','blackframe/film.mp4'));
  let calls=0;await p.route('**/api/review',r=>{calls++;return r.fulfill({status:503,json:{error:'服务暂不可用'}})});
  await p.click('#runVideoReview');await p.waitForSelector('#mediaRunState[data-state="failed"]');assert.equal(calls,1);assert.match(await p.innerText('.work-steps [data-go="media"] small'),/需要重试/);assert(await p.isDisabled('#downloadVideoReport'));
  const id=await p.getAttribute('#mediaRunState','data-run');await p.unroute('**/api/review');await p.click('#mediaRetry');await p.waitForSelector('#mediaRunState[data-state="done"]',{timeout:150000});assert.equal(await p.getAttribute('#mediaRunState','data-run'),id);assert.match(await p.innerText('#mediaRunState'),/第 2 次/);assert(await p.isEnabled('#downloadVideoReport'));assert.match(await p.innerText('.work-steps [data-go="media"] small'),/报告已就绪/);
  await p.setInputFiles('#reviewVideo',[]);assert(await p.isDisabled('#downloadVideoReport'));assert(await p.isDisabled('#mediaRetry'));
  await p.click('#backGallery');await p.click('#quickScript');await p.waitForSelector('#mask.on');assert.equal(await p.getAttribute('[aria-current="step"]','data-workstep'),'review');await p.click('#apYes');await p.waitForSelector('#getApprovedCopy');await p.click('[data-go="script"]');await p.click('#openReview');assert(await p.isVisible('#pane-review'));await p.click('#goVideoWorkshop');assert(await p.isVisible('#pane-media'));
  let finish,started;const pending=new Promise(r=>started=r);await p.route('**/api/render',async r=>{started();await new Promise(res=>finish=res);await r.fulfill({status:503,json:{error:'旧任务'}})});
  await p.click('#makeVideo');await pending;await p.click('[data-go="desk"]');await p.fill('#brief','换商品：书签 5 克，零售价 9 元。');finish();await p.waitForSelector('#mediaRunState[data-state="stale"]',{state:'attached'});await p.click('[data-go="media"]');assert(await p.isDisabled('#makeVideo'));assert(await p.isDisabled('#mediaRetry'));assert.equal(await p.locator('.render-file').count(),0);assert.deepEqual(errors,[]);console.log('PASS 4 routes x 2 viewports/themes; review 503 → manual retry with same ID → real report; input change locks downloads; stale render ignored');
 }finally{if(browser)await browser.close();if(server)server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1});
