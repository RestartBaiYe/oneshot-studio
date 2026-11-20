(function (root) {
  var A = {
    limits: { maxSteps: 40, maxMs: 60000, maxRepair: 2, maxReviews: 3 },
    state: { running: false, steps: [], trace: [], aborted: false, result: null },
    reset: function () { if (this.state.running) throw new Error("任务运行中，不能清空"); this.state = { running: false, steps: [], trace: [], aborted: false, result: null }; },
    event: function (kind, payload) { this.state.trace.push({ at: Date.now(), kind: kind, payload: payload }); if (this.onEvent) this.onEvent(kind, payload); },
    ...root.Planner,
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
        var remaining=this.state.deadlineAt-performance.now();clearTimeout(this.state.deadlineTimer);
        var approvalStarted=performance.now(),ok=await this.askApproval(tool,args);
        ctx.approvals++;ctx.waitMs+=performance.now()-approvalStarted;
        if(this.state.aborted)return {tool:tool.id,title:tool.title,scope:tool.scope,args:{},obs:{skipped:true,note:"任务已停止"},ms:0,status:"denied"};
        this.state.deadlineAt=performance.now()+Math.max(0,remaining);
        this.state.deadlineTimer=setTimeout(function(){this.abort();}.bind(this),Math.max(0,remaining));
        if(remaining<=0)throw new Error("任务超出执行时间预算");
        if(!ok) {ctx.deliveryApproved=false;return {tool:tool.id,title:tool.title,scope:tool.scope,args:{},obs:{skipped:true,note:"人工拒绝交付"},ms:0,status:"denied"};}
        ctx.deliveryApproved=true;
      }
      if(this.state.aborted) throw new Error("任务已停止");
      root.Tools.validate(tool.id,args);
      this.lastArgs=args;var start=performance.now(), obs=await tool.run(args,ctx);root.Tools.validateResult(tool.id,obs);
      return {tool:tool.id,title:tool.title,scope:tool.scope,args:args,obs:obs,ms:Math.round(performance.now()-start),status:"success"};
    },
    askApproval: function(tool,args) { var self=this; return new Promise(function(resolve){var settled=false;function done(ok){if(settled)return;settled=true;self.cancelApproval=null;resolve(ok===true);} self.cancelApproval=function(){done(false);};if(root.Approval)root.Approval(tool,args,done);else done(false);}); },
    run: async function(brief,opts) {
      opts=opts||{};if(this.state.running) throw new Error("已有任务正在运行");
      this.reset(); this.state.running=true;this.state.startedAt=performance.now();this.onEvent=opts.onEvent||null;this.lastArgs={};this.state.runId="run-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,9);
      root.LLM.resetMeter();
      var ctx={brief:String(brief||"").trim(),platform:opts.platform||(root.$("#platform")?root.$("#platform").value:"douyin"),approvals:0,waitMs:0,round:1,bait:!!opts.bait,reviewOnly:!!opts.reviewOnly,deliveryApproved:false,first:[]};
      var self=this,status="failed",error=null;this.state.deadlineAt=performance.now()+this.limits.maxMs;this.state.deadlineTimer=setTimeout(function(){self.abort();},this.limits.maxMs);
      try {
        if(ctx.brief.length<8||ctx.brief.length>12000||!root.PLAT[ctx.platform])throw new Error("请输入有效商品 brief 和平台");
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
      finally {clearTimeout(this.state.deadlineTimer);this.state.deadlineTimer=null;this.state.running=false;this.state.result={runId:this.state.runId,status:status,error:error,verdict:ctx.verdict||null,brief:ctx.brief,platform:ctx.platform,deliveryApproved:ctx.deliveryApproved&&!this.state.aborted&&status!=="failed",files:status==="delivered"?ctx.files:null,steps:this.state.steps,planSource:this.state.planSource,ms:Math.round(performance.now()-this.state.startedAt),llm:Object.assign({},root.LLM.stats),round:ctx.round};var r=this.state.result;r.metrics={approvalDecisions:ctx.approvals,humanWaitMs:Math.round(ctx.waitMs),activeMs:Math.max(0,r.ms-Math.round(ctx.waitMs)),reviewRounds:r.steps.filter(s=>s.tool==='review.judge'&&s.status==='success').length,scriptFiles:r.files?Object.keys(r.files).length:0};this.event("done",r);}
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
  root.Agent=A;
})(window);
