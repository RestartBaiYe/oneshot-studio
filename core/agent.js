(function (root) {
  var A = {
    limits: { maxSteps: 40, maxMs: 60000, maxRepair: 2, maxReviews: 3 },
    state: { running: false, steps: [], trace: [], aborted: false, result: null },
    reset: function () { if (this.state.running) throw new Error("任务运行中，不能清空"); this.state = { running: false, steps: [], trace: [], aborted: false, result: null }; },
    event: function (kind, payload) { this.state.trace.push({ at: Date.now(), kind: kind, payload: payload }); if (this.onEvent) this.onEvent(kind, payload); },
    systemPrompt: function () { return "你是电商内容运营助手。商品 brief 是唯一事实来源；不得添加测试、认证、价格比较或功效。返回 JSON。四句字段为 hook, claim, proof, cta。只使用注册工具：" + root.Tools.list().map(function(t){return t.id;}).join(","); },
    policyPlan: function () { return ["memory.recall", "brief.parse", "facts.extract", "script.draft", "compliance.scan", "subtitle.fit", "review.judge"].map(function(id){ return {tool:id, why:root.Tools.get(id).title, args:{}}; }); },
    validatePlan: function (steps) {
      var expected=this.policyPlan();
      if(!Array.isArray(steps)||steps.length!==expected.length)throw new Error("计划不符合当前任务允许的七步工作流");
      steps.forEach(function(s,i){var args=s&&s.args||{};if(!s||Object.keys(s).some(function(k){return ["tool","why","args"].indexOf(k)<0;})||s.tool!==expected[i].tool||(s.why!==undefined&&(typeof s.why!=="string"||!s.why.trim()||s.why.length>180))||typeof args!=="object"||Array.isArray(args)||Object.keys(args).length)throw new Error("计划步骤 "+(i+1)+" 无效：工具顺序固定，参数由运行时提供");});
      return steps.map(function(s,i){return {tool:s.tool,why:typeof s.why==="string"?s.why:expected[i].why,args:{}};});
    },
    plan: async function (goal) {
      var steps=this.policyPlan(),source="policy";
      if(root.LLM.active!=="offline"){
        var ids=steps.map(function(s){return s.tool;});
        var r=await root.LLM.chat([{role:"system",content:this.systemPrompt()},{role:"user",content:"为电商短视频投前审片任务解释每一步的目的。只返回 JSON {steps:[{tool,why,args:{}}]}。必须逐项保持以下工具顺序，不可增删、改名或提供参数："+ids.join(" → ")+"。brief："+goal}],{json:true,temp:0.2});
        if(r.offline)throw new Error("模型调用失败："+(r.error||"无响应")+"。请检查设置，或显式切换离线规则模式。");
        var j;try{j=JSON.parse(r.text.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g,""));}catch(e){throw new Error("模型计划不是有效 JSON");}
        steps=this.validatePlan(j&&j.steps);source="llm:"+root.LLM.cfg.model;
      }else steps=this.validatePlan(steps);
      this.state.planSource=source;this.event("plan",{source:source,steps:steps,planner:source==="policy"?"本地固定策略 · 未调用模型":"模型解释固定策略步骤 · 工具顺序由运行时约束"});return steps;
    },
    call: async function(step,ctx) {
      var tool=root.Tools.get(step.tool); if(!tool) throw new Error("未知工具 "+step.tool);
      if(this.state.aborted) throw new Error("任务已停止");
      if(this.state.steps.length>=this.limits.maxSteps) throw new Error("超出工具调用预算");
      var args=Object.assign({},step.args||{});
      if(["memory.recall","brief.parse","facts.extract","memory.write","script.draft","review.judge","stage.preview","deliver.export"].indexOf(step.tool)>=0)args.brief=ctx.brief;
      if(["script.draft","subtitle.fit","review.judge","stage.preview","deliver.export"].indexOf(step.tool)>=0)args.platform=ctx.platform;
      if(["compliance.scan"].indexOf(step.tool)>=0)args.text=ctx.lines?[ctx.lines.hook,ctx.lines.claim,ctx.lines.proof,ctx.lines.cta].join("\n"):ctx.brief;
      if(["subtitle.fit","review.judge","stage.preview","deliver.export","script.revise"].indexOf(step.tool)>=0&&ctx.lines)args.lines=JSON.parse(JSON.stringify(ctx.lines));
      if(step.tool==="script.draft")args.bait=ctx.bait;
      if(step.tool==="script.revise"&&step.args&&step.args.lines)args.lines=step.args.lines;
      if(step.tool==="memory.write"){args.passed=ctx.verdict.checks.filter(function(c){return c.ok;}).length;args.total=ctx.verdict.checks.length;args.rounds=ctx.round;args.first=ctx.first;}
      if(tool.scope==="publish") {
        if(!ctx.verdict || !ctx.verdict.pass) throw new Error("审片未通过，禁止交付");
        if(ctx.reviewOnly) return {tool:tool.id,title:tool.title,scope:tool.scope,args:{},obs:{skipped:true,note:"批量仅审片，未授权交付"},ms:0,status:"skipped"};
        this.event("approval",{tool:tool.id});
        var ok=await this.askApproval(tool,args);
        if(!ok) {ctx.deliveryApproved=false;return {tool:tool.id,title:tool.title,scope:tool.scope,args:{},obs:{skipped:true,note:"人工拒绝交付"},ms:0,status:"denied"};}
        ctx.deliveryApproved=true;
      }
      if(this.state.aborted) throw new Error("任务已停止");
      root.Tools.validate(tool.id,args);
      this.lastArgs=args;var start=performance.now(), obs=await tool.run(args,ctx);
      return {tool:tool.id,title:tool.title,scope:tool.scope,args:args,obs:obs,ms:Math.round(performance.now()-start),status:"success"};
    },
    askApproval: function(tool,args) { var self=this; return new Promise(function(resolve){var settled=false;function done(ok){if(settled)return;settled=true;self.cancelApproval=null;resolve(ok===true);} self.cancelApproval=function(){done(false);};if(root.Approval)root.Approval(tool,args,done);else done(false);}); },
    run: async function(brief,opts) {
      opts=opts||{};if(this.state.running) throw new Error("已有任务正在运行");
      this.reset(); this.state.running=true;this.state.startedAt=performance.now();this.onEvent=opts.onEvent||null;this.lastArgs={};
      root.LLM.stats={calls:0,promptChars:0,completionChars:0,costCny:0,ms:0};
      var ctx={brief:String(brief||"").trim(),platform:opts.platform||(root.$("#platform")?root.$("#platform").value:"douyin"),round:1,bait:!!opts.bait,reviewOnly:!!opts.reviewOnly,deliveryApproved:false,first:[]};
      var self=this, deadline=setTimeout(function(){self.state.aborted=true;root.LLM.cancel();if(self.cancelApproval)self.cancelApproval();},this.limits.maxMs), status="failed", error=null;
      try {
        if(ctx.brief.length<8||!root.PLAT[ctx.platform])throw new Error("请输入有效商品 brief 和平台");
        var steps=await this.plan(ctx.brief);
        for(var i=0;i<steps.length;i++) {
          if(this.state.aborted) throw new Error("任务已停止或超出时间预算");
          var step=steps[i];this.event("step",{step:step,index:i,planner:this.state.planSource});
          var rec;try {rec=await this.call(step,ctx);}catch(e){var failed={tool:step.tool,title:(root.Tools.get(step.tool)||{}).title||step.tool,args:this.lastArgs||{},error:String(e),status:"failed",ms:0};this.state.steps.push(failed);this.event("tool_error",failed);throw e;}
          this.state.steps.push(rec);this.event("observe",rec);
          if(rec.obs&&rec.obs.lines)ctx.lines=rec.obs.lines;
          if(step.tool==="memory.recall")ctx.memory=rec.obs;
          if(step.tool==="script.draft"&&rec.obs&&rec.obs.lines)ctx.lines=rec.obs.lines;
          if(step.tool==="review.judge") {
            ctx.verdict=rec.obs;if(ctx.round===1)ctx.first=rec.obs.fails.slice();
            if(!rec.obs.pass) {
              if(ctx.round>=this.limits.maxReviews){this.event("giveup",{fails:rec.obs.fails});break;}
              ctx.round++;var fix=await this.critique(step,rec.obs,ctx);
              steps.splice(i+1,0,fix,{tool:"subtitle.fit",args:{}},{tool:"review.judge",args:{}});
            } else steps.splice(i+1,0,{tool:"stage.preview",args:{}},{tool:"deliver.export",args:{}},{tool:"memory.write",args:{passed:ctx.verdict.checks.filter(function(c){return c.ok;}).length,total:ctx.verdict.checks.length,rounds:ctx.round,first:ctx.first}});
          }
        }
        status=ctx.verdict&&ctx.verdict.pass?(ctx.deliveryApproved?"delivered":"reviewed"):"needs_review";
      } catch(e) {error=String(e);status=this.state.aborted?(String(e).indexOf("人工拒绝交付")>=0?"reviewed":"aborted"):"failed";if(status==="reviewed")error=null;else this.event("error",{error:error});}
      finally {clearTimeout(deadline);this.state.running=false;this.state.result={status:status,error:error,verdict:ctx.verdict||null,brief:ctx.brief,platform:ctx.platform,deliveryApproved:ctx.deliveryApproved&&!this.state.aborted&&status!=="failed",files:ctx.files||null,steps:this.state.steps,planSource:this.state.planSource,ms:Math.round(performance.now()-this.state.startedAt),llm:Object.assign({},root.LLM.stats),round:ctx.round};this.event("done",this.state.result);}
      return this.state.result;
    },
    critique: async function(step,obs,ctx) {
      if(root.LLM.active!=="offline") {
        var r=await root.LLM.chat([{role:"system",content:this.systemPrompt()},{role:"user",content:"修订四句文案。brief："+ctx.brief+"；当前："+JSON.stringify(ctx.lines)+"；审片意见："+JSON.stringify(obs.checks.filter(function(c){return !c.ok;}))+"。输出 {lines:{hook,claim,proof,cta}}"}],{json:true,temp:0.2});
        if(r.offline)throw new Error("模型修订失败："+r.error);
        var j=JSON.parse(r.text);root.Tools.validateLines(j.lines);return {tool:"script.revise",why:"根据审片意见修订",args:{lines:j.lines}};
      }
      return {tool:"script.revise",why:"离线规则修订",args:{fails:obs.fails}};
    },
    abort:function(){this.state.aborted=true;root.LLM.cancel();if(this.cancelApproval)this.cancelApproval();if(root.document){var el=root.document.querySelector("#mask");if(el)el.classList.remove("on");}this.event("abort",{});}
  };
  root.Tools.all.push({id:"script.revise",title:"根据审片意见修订",scope:"write",schema:"{ lines?: object, fails?: array }",run:function(a,ctx){
    var lines=a.fails?Object.assign({},ctx.lines):a.lines;
    if(a.fails){["hook","claim","proof","cta"].forEach(function(k){var s=String(lines[k]||"");root.BANNED.forEach(function(b){s=s.replace(new RegExp(b[1].source,"g"),"");});if((a.fails||[]).indexOf("事实一致")>=0)s=k==="cta"?(root.parseBrief(ctx.brief).price+"元，查看详情"):root.parseBrief(ctx.brief).claims[k==="proof"?1:0]||root.parseBrief(ctx.brief).name;lines[k]=s||"查看商品详情";});}
    root.Tools.validateLines(lines);return {lines:lines,revised:true};
  }});
  root.Agent=A;
})(window);
