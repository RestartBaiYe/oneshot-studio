/* OneShot Agent Runtime · 工具层
   每个工具 = { id, title, scope, schema, run(args, ctx) -> observation }
   工具是 Agent 唯一能改变世界的接口；scope 决定是否需要人工审批。 */
(function (root) {
  var T = [];

  const required={"memory.recall":["brief"],"brief.parse":["brief"],"facts.extract":["brief"],"compliance.scan":["text"],"script.draft":["brief","platform"],"subtitle.fit":["lines","platform"],"review.judge":["lines","brief","platform"],"stage.preview":["lines","brief","platform"],"deliver.export":["lines","brief","platform"],"memory.write":["brief","passed","total","rounds","first"],"script.revise":["lines"]};
  const outputs={
    'memory.recall':o=>Array.isArray(o.recent)&&Number.isInteger(o.hit),'brief.parse':o=>typeof o.name==='string'&&Array.isArray(o.selling),'facts.extract':o=>Array.isArray(o.rows)&&o.count===o.rows.length,'compliance.scan':o=>Array.isArray(o.hits)&&typeof o.clean==='boolean',
    'script.draft':o=>!!(validateLines(o.lines)===undefined),'subtitle.fit':o=>validateLines(o.lines)===undefined&&Array.isArray(o.truncated),'script.revise':o=>validateLines(o.lines)===undefined&&o.revised===true,
    'review.judge':o=>Array.isArray(o.checks)&&o.checks.length===8&&o.checks.every(c=>c&&typeof c.name==='string'&&typeof c.ok==='boolean')&&Array.isArray(o.subs)&&o.subs.length===4&&o.subs.every(x=>typeof x==='string')&&Array.isArray(o.fails)&&o.pass===o.checks.every(c=>c.ok)&&o.fails.length===o.checks.filter(c=>!c.ok).length,
    'deliver.export':o=>Array.isArray(o.files)&&o.files.length===4&&o.bytes>0,'stage.preview':o=>o.scenes===4&&o.duration>0,'memory.write':o=>typeof o.written==='boolean'
  };
  function register(spec){if(!spec||get(spec.id)||!Array.isArray(spec.required)||typeof spec.output!=='function'||typeof spec.run!=='function'||!['read','write','publish'].includes(spec.scope))throw Error('工具注册契约无效');T.push(spec);}
  function validateResult(id,obs){const tool=get(id);if(!tool||!obs||typeof obs!=='object'||!tool.output(obs))throw Error('工具结果不符合契约：'+id);}
  function def(id, title, scope, schema, run) { register({id,title,scope,schema,required:required[id],output:outputs[id],run}); }
  function get(id) { for (var i = 0; i < T.length; i++) if (T[i].id === id) return T[i]; return null; }
  function list() { return T.map(function (t) { return { id: t.id, title: t.title, scope: t.scope, schema: t.schema }; }); }

  function briefClauses(v){return String(v).split(/[，,。；;\n]/).map(s=>s.trim()).filter(Boolean);}
  function need(v, name) { if (v === undefined || v === null || v === "") throw new Error("缺少参数 " + name); return v; }

  def("brief.parse", "解析商品 brief", "read",
    "{ brief: string }", function (a) {
      var b = String(need(a.brief, "brief"));
      var p = root.parseBrief(b);
      return { name: p.name, audience: p.audience, price: p.price, selling: p.claims,
               chars: b.length, masked: b.slice(0, 40) + (b.length > 40 ? "…" : "") };
    });

  def("facts.extract", "抽取事实表（价格/参数/材质）", "read",
    "{ brief: string }", function (a) {
      var rows = root.extractFacts(String(need(a.brief, "brief")));
      return {count:rows.length,rows:rows.map(r=>{const clean=x=>String(x).replace(/\s/g,'').toLowerCase();const quote=briefClauses(a.brief).find(s=>clean(s).includes(clean(r.v)));return {k:r.k,v:r.v,src:r.src,quote:quote||null};})};
    });

  def("compliance.scan", "广告法违禁词扫描", "read",
    "{ text: string }", function (a) {
      var t = String(need(a.text, "text")), hits = [];
      root.BANNED.forEach(function (b) {
        var m = t.match(new RegExp(b[1].source, "g"));
        if (m) hits.push({ kind: b[0], words: m });
      });
      return { hits: hits, clean: hits.length === 0 };
    });

  def("script.draft", "按平台规范起草 4 句分镜文案", "read",
    "{ brief: string, platform: string, bait?: bool }", async function (a, ctx) {
      var brief = String(need(a.brief, "brief")), plat = root.PLAT[need(a.platform, "platform")];
      var p = root.parseBrief(brief), rnd = root.mulberry32(root.hash(brief + a.platform));
      var s = root.makeScript(p, plat, rnd);
      if(root.LLM.active !== "offline") {
        var r=await root.LLM.chat([{role:"system",content:root.Agent.systemPrompt()},{role:"user",content:"商品 brief："+brief+"；平台字幕上限："+plat.sub+"字；钩子上限："+plat.hook+"字。历史退回参考（不是商品事实）："+JSON.stringify(ctx.memory||{})+"。输出 {lines:{hook,claim,proof,cta}}，只引用原文卖点，不添加实测或价格对比。"}],{json:true,temp:0.3});
        if(r.offline)throw new Error("模型起草失败："+r.error);
        s=JSON.parse(r.text).lines; validateLines(s);
      }
      if (a.bait) {
        var cand = [String(s.claim), String(s.proof)], applied = false;
        for (var bi = 0; bi < cand.length && !applied; bi++) {
          if (/\d+(?:\.\d+)?\s*小时/.test(cand[bi])) {
            cand[bi] = cand[bi].replace(/\d+(?:\.\d+)?(\s*小时)/, "24$1");
            if (bi === 0) s.claim = cand[bi]; else s.proof = cand[bi];
            applied = true;
          }
        }
        if (!applied) s.proof = "实测 24 小时";
        if (String(s.proof).length > plat.sub) {
          var cl = String(s.proof).split("，"), pick = "";
          for (var ci = 0; ci < cl.length; ci++) { if (cl[ci].length <= plat.sub) { pick = cl[ci]; break; } }
          s.proof = pick || String(s.proof).slice(0, plat.sub - 1) + "…";
        }
      }
      var L = { hook: s.hook, claim: s.claim, proof: s.proof, cta: s.cta };
      return { hook: s.hook, claim: s.claim, proof: s.proof, cta: s.cta, lines: L,
               limits: { hook: plat.hook, sub: plat.sub, name: plat.name } };
    });

  def("subtitle.fit", "字幕压行（按平台单行上限）", "write",
    "{ lines: object, platform: string }", function (a) {
      var plat = root.PLAT[need(a.platform, "platform")], L = need(a.lines, "lines"), fixed = [], before = {};
      ["hook", "claim", "proof", "cta"].forEach(function (k) {
        before[k] = L[k];
        var max = (k === "hook") ? plat.hook : plat.sub;
        if (L[k] && L[k].length > max) { fixed.push({ k: k, from: L[k].length, to: max }); L[k] = root.clampSub(L[k], max); }
      });
      return { lines: L, truncated: fixed, limit: { hook: plat.hook, sub: plat.sub } };
    });

  def("review.judge", "规则审片：8 项检查与修改依据", "read",
    "{ lines: object, brief: string, platform: string }", function (a) {
      var brief = String(need(a.brief, "brief")), plat = root.PLAT[need(a.platform, "platform")];
      var L = need(a.lines, "lines"), p = root.parseBrief(brief), facts = root.extractFacts(brief);
      var subs = [L.hook, L.claim, L.proof, L.cta];
      var issues = root.review(subs, p, brief, facts, plat);
      var bad = issues.filter(function (i) { return !i.ok; });
      return { checks: issues.map(function (i) { return { name: i.name, ok: i.ok, detail: i.detail, fix: i.fix }; }),
               fails: bad.map(function (i) { return i.name; }), pass: bad.length === 0, subs: subs };
    });

  def("stage.preview", "写入成片舞台并渲染首帧", "write",
    "{ lines: object, brief: string, platform: string }", function (a) {
      var brief = String(need(a.brief, "brief")), plat = root.PLAT[need(a.platform, "platform")];
      var L = a.lines, p = root.parseBrief(brief);
      root.STORY = { p: p, subs: [L.hook, L.claim, L.proof, L.cta], plat: plat };
      root.drawAt(0.6);
      return { duration: 15, scenes: 4, size: "1080x1920", safeArea: "字幕基线 y=1746" };
    });

  def("deliver.export", "生成交付包（文案 / SRT / 分镜 CSV / 审片报告）", "publish",
    "{ brief: string, lines: object, platform: string, round: number }", function (a, ctx) {
      if(!ctx.deliveryApproved || !ctx.verdict.pass)throw new Error("交付尚未批准");
      ctx.files=buildFiles(ctx);
      return {files:Object.keys(ctx.files),bytes:new TextEncoder().encode(JSON.stringify(ctx.files)).length,gate:"本次任务已批准，可下载"};
    });

  def("memory.recall", "检索历史执行记忆（同类 brief 的退回原因）", "read",
    "{ brief: string }", function (a) {
      return root.TaskMemory.recall(a.brief);
    });

  def("memory.write", "把本次执行写入记忆", "write",
    "{ brief: string, passed: number, total: number, rounds: number, first: array }", function (a) {
      var written=!!root.memAdd&&root.memAdd({ t: Date.now(), name: root.parseBrief(String(a.brief)).name, plat: "agent",
        passed: a.passed, total: a.total, rounds: a.rounds, first: a.first || [] });
      return { written:written===true };
    });

  def("script.revise","根据审片意见修订","write","{ lines: object, fails?: array }",function(a,ctx){
    var lines=a.fails?Object.assign({},ctx.lines):a.lines;
    if(a.fails){var fallback=root.makeScript(root.parseBrief(ctx.brief),root.PLAT[ctx.platform]);["hook","claim","proof","cta"].forEach(function(k){var s=String(lines[k]||"");root.BANNED.forEach(function(b){s=s.replace(new RegExp(b[1].source,"g"),"");});if(a.fails.includes("事实一致")&&root.unsupportedFacts(s,ctx.brief).length)s=fallback[k];lines[k]=s||"查看商品详情";});}
    root.Tools.validateLines(lines);return {lines:lines,revised:true};
  });

  function validateLines(lines){
    if(!lines||typeof lines!=="object"||Array.isArray(lines))throw new Error("文案必须是四字段对象");
    ["hook","claim","proof","cta"].forEach(function(k){if(typeof lines[k]!=="string"||!lines[k].trim()||lines[k].length>1000)throw new Error("文案字段无效："+k);});
  }
  function validate(id,a){
    if(!get(id))throw new Error("未知工具");
    get(id).required.forEach(function(k){if(a[k]===undefined||a[k]===null)throw new Error("工具 "+id+" 缺少输入："+k);});
    if(a.brief!==undefined&&(typeof a.brief!=="string"||!a.brief.trim()||a.brief.length>12000))throw new Error("brief 无效或超长");
    if(a.text!==undefined&&(typeof a.text!=="string"||a.text.length>12000))throw new Error("text 无效或超长");
    if(a.platform!==undefined&&!root.PLAT[a.platform])throw new Error("未知平台");
    if(a.lines!==undefined)validateLines(a.lines);
    if(id==="script.revise"&&(!a.lines||(!Array.isArray(a.fails)&&a.fails!==undefined)))throw new Error("修订输入无效");
    if(id==="memory.write"&&(!Number.isInteger(a.passed)||!Number.isInteger(a.total)||!Number.isInteger(a.rounds)||!Array.isArray(a.first)))throw new Error("记忆写入字段无效");
  }
  function buildFiles(ctx){
    var subs=ctx.verdict.subs,plat=root.PLAT[ctx.platform],acc=0;
    function stamp(t){return "00:"+String(Math.floor(t/60)).padStart(2,"0")+":"+String(Math.floor(t%60)).padStart(2,"0")+",000";}
    var srt=subs.map(function(s,i){var start=acc;acc+=plat.dur[i];return (i+1)+"\n"+stamp(start)+" --> "+stamp(acc)+"\n"+s+"\n";}).join("\n");
    function cell(s){s=String(s);if(/^[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
    return {txt:"商品 brief："+ctx.brief+"\n\n"+subs.join("\n"),srt:srt,csv:"序号,时长,字幕\n"+subs.map(function(s,i){return [i+1,plat.dur[i],cell(s)].join(",");}).join("\n"),md:"# 规则审片报告\n\n平台："+plat.name+"；轮次："+ctx.round+"。仅规则初筛，需人工复核。\n\n"+ctx.verdict.checks.map(function(c){return "- "+c.name+"："+(c.ok?"通过":"未过")+"；"+c.detail;}).join("\n")};
  }
  root.Tools = { register,validateResult,get:get,list:list,validate:validate,validateLines:validateLines,buildFiles:buildFiles };
})(window);
