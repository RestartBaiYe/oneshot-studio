/* OneShot Studio · 界面层：把 Agent 运行时接到产品上（无框架，单文件零依赖） */
(function () {
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  var esc = function (s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); };
  var LAST = null, playing = false, raf = 0;

  window.onerror = function (m, src, line, col) {
    document.title = "ERR|" + m + "|" + line + ":" + col;
    var t = $("#toast"); if (t) { t.textContent = "脚本错误：" + m + " @" + line; t.classList.add("on"); }
    return false;
  };

  var BRIEFS = [
    { n: "保温杯", b: "保温杯 316L 不锈钢，容量 500ml，12 小时保温，一键开盖单手可开，79 元，通勤上班族" },
    { n: "咖啡豆", b: "咖啡豆 深烘意式拼配，454g，油脂厚，坚果与可可风味，售价 118 元，手冲意式都行" },
    { n: "猫粮", b: "全价冻干猫粮 鸡肉味，1.5kg，粗蛋白 40%，无谷配方，129 元，成猫全阶段" }
  ];

  function toast(t) { var el = $("#toast"); el.textContent = t; el.classList.add("on"); clearTimeout(el._t); el._t = setTimeout(function () { el.classList.remove("on"); }, 2400); }
  function download(blob, name) {
    var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 800);
  }

  function phase(n, text) {
    document.querySelectorAll("[data-phase]").forEach(function(el,i){el.classList.toggle("active",i===n);el.classList.toggle("complete",i<n);});
    $("#nextAction").textContent=text;
  }
  function renderScript(lines) {
    var labels=["钩子","卖点","证据","行动引导"], times=["00–03s","03–07s","07–11s","11–15s"];
    $("#scriptOutput").innerHTML=lines.length ? lines.map(function(s,i){return '<div class="script-line"><span class="shot-no">0'+(i+1)+'</span><div><small>'+labels[i]+' · '+times[i]+'</small><p>'+esc(s)+'</p></div></div>';}).join("") : '<div class="script-empty"><span>等待本轮脚本</span><p>生成后在这里逐行审阅，再决定是否交付。</p></div>';
  }
  function invalidateInput(){ if(Agent.state.running || batchRunning)return; LAST=null; STORY=null; Agent.state.result=null; renderScript([]); document.querySelectorAll("#exports button, #expTxt2, #expSrt2, #expCsv2, #expMd2").forEach(function(b){b.disabled=true;}); $("#gateNote").textContent="商品或平台已修改，请重新运行并审批。"; $("#statusTxt").textContent="输入已更新"; $("#status").className="status"; phase(0,"输入已更新，运行 Agent 生成本次脚本。"); }
  $("#brief").addEventListener("input",function(){this.setCustomValidity("");invalidateInput();});
  $("#platform").addEventListener("change",invalidateInput);
  $("#showcase").onclick=function(){var on=document.body.classList.toggle("showcase");this.textContent=on?"退出演示视图":"演示视图";};
  /* ---------- 导航 ---------- */
  function go(pane) {
    var step = pane === "desk" ? "materials" : pane === "script" ? "script" : pane === "review" ? "review" : pane === "media" || pane === "delivery" ? "delivery" : "";
    var target = pane === "delivery" ? "media" : pane === "script" ? "desk" : pane;
    var selected = pane === "gallery" ? "gallery" : step ? "desk" : pane;
    document.body.dataset.workstep = step;
    document.body.dataset.surface = pane === "gallery" ? "gallery" : step ? "project" : "utility";
    $$("#nav button[data-pane]").forEach(function(b){b.classList.toggle("on", b.dataset.pane === selected);});
    $$(".pane").forEach(function(p){p.classList.toggle("on",p.id === "pane-" + target);});
    $$("[data-workstep]").filter(function(el){return el.tagName === "BUTTON";}).forEach(function(b){var on=b.dataset.workstep === step;b.classList.toggle("on",on);if(on)b.setAttribute("aria-current","step");else b.removeAttribute("aria-current");});
    window.dispatchEvent(new CustomEvent("oneshot:navigate",{detail:{pane:pane,step:step}}));
  }
  window.Workbench = {go:go,current:()=>LAST,busy:function(){return Agent.state.running || batchRunning;}};
  $$("#nav button[data-pane]").forEach(function (b) { b.onclick = function () { go(b.dataset.pane); }; });
  var videoStep=document.querySelector("#goVideoWorkshop"); if(videoStep) videoStep.onclick=function(){go("media");};
  $("#openReview").onclick=function(){go("review");};
  $("#goExistingVideo").onclick=function(){go("media");};
  $("#backToReview").onclick=function(){go("review");};

  /* ---------- 注册表 / 契约 / 预算 ---------- */
  function renderRegistry() {
    var list = Tools.list();
    $("#toolN").textContent = list.length + " tools";
    $("#schemaN").textContent = list.length + " tools";
    $("#toolList").innerHTML = list.map(function (t) {
      return '<div style="display:flex;gap:8px;align-items:baseline;padding:5px 0;border-bottom:1px dashed var(--line)">' +
        '<span class="tool ' + (t.scope === "publish" ? "publish" : "") + '">' + esc(t.id) + "</span>" +
        '<span style="font-size:11.5px;color:var(--muted)">' + esc(t.title) + "</span>" +
        '<span style="margin-left:auto;font-size:10.5px;color:var(--muted)">' + esc(t.scope) + "</span></div>";
    }).join("");
    $("#schemaList").innerHTML = list.map(function (t) {
      return '<div style="padding:7px 0;border-bottom:1px dashed var(--line)"><div style="display:flex;gap:8px;align-items:center">' +
        '<span class="tool ' + (t.scope === "publish" ? "publish" : "") + '">' + esc(t.id) + "</span>" +
        '<span style="font-size:11.5px;color:var(--muted);margin-left:auto">' + esc(t.scope) + "</span></div>" +
        '<div style="font:11.5px/1.5 var(--mono);color:var(--muted);margin-top:3px;word-break:break-all">' + esc(typeof t.schema === "object" ? JSON.stringify(t.schema) : t.schema) + "</div></div>";
    }).join("");
    $("#gSteps").textContent = Agent.limits.maxSteps;
    $("#gMs").textContent = Math.round(Agent.limits.maxMs / 1000) + " s";
    $("#gRepair").textContent = Agent.limits.maxReviews + " 轮（含首轮）";
  }

  /* ---------- 时间线 ---------- */
  function tlReset() { $("#tl").innerHTML = ""; }
  function tlAdd(kind, html, cls) {
    var d = document.createElement("div");
    d.className = "ev " + (cls || "");
    d.innerHTML = html;
    $("#tl").appendChild(d);
    $("#tl").scrollTop = $("#tl").scrollHeight;
    return d;
  }
  function short(x, n) { var s = JSON.stringify(x); if (!s) return ""; return s.length > (n || 160) ? s.slice(0, n || 160) + "…" : s; }

  function onEvent(kind, p) {
    if (kind === "approval") { phase(2, "审片初筛通过，等待你批准本次交付。"); }
    if (kind === "step") { var id=p.step.tool; if(id === "script.draft" || id === "script.revise") phase(1, "正在起草或修订脚本，文字将显示在结果区。"); if(id === "review.judge") phase(2, "正在核对事实、风险词和字幕长度。"); }
    if (kind === "plan") {
      $("#planSrc").textContent = p.source === "policy" ? "policy planner" : p.source;
      tlAdd("plan", '<div class="hd"><b>制定计划</b><span class="ms">' + p.steps.length + ' 步</span></div>' +
        '<div class="why">规划器：' + esc(p.source) + "；每步都会真实调用工具，报错会停止并显示原因，审片退回会在预算内重写。</div>" +
        '<pre>' + esc(p.steps.map(function (s, i) { return (i + 1) + ". " + s.tool + " — " + (s.why || ""); }).join("\n")) + "</pre>", "run");
    } else if (kind === "step") {
      if (p.step.tool === "script.revise" || p.step.tool === "subtitle.fit") {
        tlAdd("step", '<div class="hd"><span class="tool">' + esc(p.step.tool) + '</span><b>' + esc(p.step.why || "") + "</b></div>", "run");
      }
    } else if (kind === "observe") {
      var r = p, ok = !(r.obs && r.obs.pass === false) && !r.error;
      var cls = r.tool === "review.judge" ? (r.obs && r.obs.pass ? "ok" : "bad") : (ok ? "ok" : "bad");
      var extra = "";
      if (r.obs && r.obs.fails && r.obs.fails.length) extra = '<div class="why bad">未过：' + esc(r.obs.fails.join("、")) + "</div>";
      if (r.obs && r.obs.truncated && r.obs.truncated.length) extra = '<div class="why">已压行 ' + r.obs.truncated.length + " 处</div>";
      if (r.obs && r.obs.skipped) extra = '<div class="why">' + esc(r.obs.note) + "</div>";
      tlAdd("observe", '<div class="hd"><span class="tool ' + (r.scope === "publish" ? "publish" : "") + '">' + esc(r.tool) +
        "</span><b>" + esc(r.title || "") + '</b><span class="ms">' + (r.ms ? r.ms + " ms" : "<1 ms") + "</span></div>" + extra +
        "<details><summary style='font-size:11.5px;color:var(--muted);cursor:pointer;margin-top:3px'>观察结果</summary><pre>" + esc(short(r.obs, 900)) + "</pre></details>", cls);
      bumpMeters();
    } else if (kind === "error") {
      tlAdd("error", '<div class="hd"><b class="bad">工具报错</b><span class="tool">' + esc(p.tool) + '</span></div><div class="why">' + esc(p.error) + "</div>", "bad");
    } else if (kind === "limit") {
      tlAdd("limit", '<div class="hd"><b>触发预算上限</b><span class="ms">' + esc(p.reason) + "</span></div>", "bad");
    } else if (kind === "giveup") {
      tlAdd("giveup", '<div class="hd"><b class="bad">修复轮次用尽，停在人工复核</b><span class="ms">' + esc((p.fails || []).join("、")) + "</span></div>", "bad");
    } else if (kind === "abort") {
      tlAdd("abort", '<div class="hd"><b>已中止</b></div>', "bad");
    } else if (kind === "done") {
      tlAdd("done", '<div class="hd"><b>执行结束</b><span class="ms">' + p.ms + " ms · " + p.steps.length + " 步</span></div>", p.verdict && p.verdict.pass ? "ok" : "bad");
    }
    renderTrace();
  }

  function bumpMeters() {
    $("#mSteps").textContent = Agent.state.steps.length;
    $("#mMs").textContent = Math.round(performance.now() - Agent.state.startedAt) || 0;
    $("#mCost").textContent = LLM.active === "offline" ? "离线 · 无 API 调用" : "未计价 · 以账单为准";
    $("#lCalls").textContent = Agent.state.steps.length;
    $("#lLlm").textContent = LLM.stats.calls;
    $("#lChars").textContent = LLM.stats.promptChars + LLM.stats.completionChars;
    $("#lMs").textContent = Math.round(performance.now() - Agent.state.startedAt) || 0;
  }

  function renderTrace() {
    $("#traceN").textContent = Agent.state.trace.length + " events";
    $("#tracePre").textContent = JSON.stringify({ run: { plan: Agent.state.planSource, steps: Agent.state.steps.map(function (s) { return { tool: s.tool, ms: s.ms, obs: s.obs }; }) }, events: Agent.state.trace }, null, 2);
  }

  /* ---------- 审批门 ---------- */
  function approvalReceipt(){
    var box=$("#approvalReceipt"), steps=Agent.state.steps, rounds=steps.filter(s=>s.tool==='review.judge'&&s.obs).map(s=>s.obs), current=rounds.at(-1);
    box.replaceChildren();if(!current)return;
    function add(parent,tag,cls,value){var el=document.createElement(tag);el.className=cls;el.textContent=value;parent.appendChild(el);return el;}
    add(box,'p','receipt-meta',(LLM.active==='offline'?'离线规则 · 无模型调用':'模型辅助文案 · 本地规则复核')+' ／ 第 '+rounds.length+' 轮 ／ '+current.checks.filter(c=>c.ok).length+' 项规则通过');
    var previous=rounds.slice(0,-1).reverse().find(r=>!r.pass);
    if(previous){add(box,'h4','','上次为什么退回？');previous.checks.filter(c=>!c.ok).forEach(c=>add(box,'p','receipt-issue',c.name+'：'+c.detail));current.subs.forEach((line,i)=>{if(previous.subs[i]===line)return;var row=add(box,'div','receipt-diff','');add(row,'span','','镜头 0'+(i+1));add(row,'del','',previous.subs[i]);add(row,'ins','',line);});}
    else add(box,'p','receipt-plain','首轮通过，未发生退回或改写。');
    add(box,'h4','','对照本次商品原文');add(box,'blockquote','receipt-source',$('#brief').value);
  }
  window.Approval = function (tool, args, resolve) {
    approvalReceipt();$("#apTitle").textContent = "批准这四句脚本？";
    $("#apBody").textContent = tool.title + " 会写入/交付本地产物，Agent 已暂停等你批准（这是守卫规则，不是装饰）。";
    $("#apArgs").textContent = JSON.stringify(args, null, 2);
    if (STORY && STORY.subs) renderScript(STORY.subs);
    $("#apBody").textContent = "请核对以下四行文案。批准后开放 TXT、SRT、CSV 与审片报告的本地导出。规则初筛不代替人工内容审核。";
    $("#apArgs").textContent = (STORY && STORY.subs ? STORY.subs.map(function(s,i){return ["钩子","卖点","证据","行动引导"][i] + "：" + s;}).join("\n\n") : "脚本未生成") + "\n\n批准范围：开放本次脚本文件导出，并允许使用这些文案在本机制作 MP4；不自动发布。";
    var previousFocus = document.activeElement, modal = $("#mask .modal");
    modal.setAttribute("role", "dialog"); modal.setAttribute("aria-modal", "true"); modal.setAttribute("aria-labelledby", "apTitle");
    $("#mask").classList.add("on");
    var done = function (v) { $("#mask").classList.remove("on"); $("#mask").removeEventListener("keydown", modalKeys); $("#apYes").onclick = null; $("#apNo").onclick = null; if(previousFocus && previousFocus.isConnected) previousFocus.focus(); resolve(v); };
    function modalKeys(e) { if(e.key === "Escape") { e.preventDefault(); e.stopPropagation(); done(false); } if(e.key === "Tab") { var buttons = Array.from(modal.querySelectorAll("button:not([disabled])")); var first = buttons[0], last = buttons[buttons.length-1]; if(e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if(!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); } } }
    $("#mask").addEventListener("keydown", modalKeys);
    $("#mask .approval-scroll").scrollTop=0;$("#apNo").focus({preventScroll:true});
    $("#apYes").onclick = function () { done(true); };
    $("#apNo").onclick = function () { done(false); };
  };

  /* ---------- 运行 ---------- */
  async function run() {
    var brief = $("#brief").value.trim();
    if (brief.length < 8) {go("desk");$("#brief").focus();$("#brief").setCustomValidity("请至少填写 8 个字符，例如：通勤保温杯，500ml，售价79元。");$("#brief").reportValidity();return;}
    if (batchRunning || Agent.state.running) return toast("正在运行，先停止或等它结束");
    Agent.state.result=null;window.dispatchEvent(new Event('oneshot:script-start'));tlReset(); LAST = null; STORY = null; drawAt(0); renderScript([]); phase(0, "正在制定受约束计划，随后核对商品事实。");
    document.querySelectorAll("#exports button, #expTxt2, #expSrt2, #expCsv2, #expMd2").forEach(function(b){b.disabled=true;});
    $("#status").className = "status run"; $("#statusTxt").textContent = "运行中";
    $("#btnStart").disabled = true; $("#gateNote").textContent = "运行中，交付锁定。";
    $("#planSrc").textContent = "planning…"; $("#brief").disabled=true; $("#platform").disabled=true; $("#bait").disabled=true;
    try {
      LAST = await Agent.run(brief, { onEvent: onEvent, requireApproval: true, bait: $("#bait") && $("#bait").checked });
      finish(LAST);
    } catch (e) {
      $("#status").className = "status bad"; $("#statusTxt").textContent = "出错";
      tlAdd("err", '<div class="hd"><b class="bad">运行失败</b></div><div class="why">' + esc(String(e)) + "</div>", "bad");
      toast("运行出错：" + String(e).slice(0, 80));
    }
    $("#btnStart").disabled = false; $("#brief").disabled=false; $("#platform").disabled=false; $("#bait").disabled=false;
  }

  function finish(res) {
    var v = res.verdict || {};
    if(res.error) toast(res.error);
    $("#status").className = "status " + (v.pass ? "ok" : "bad");
    $("#statusTxt").textContent = res.status === "delivered" ? "已批准交付" : res.status === "reviewed" ? "初筛通过 · 未交付" : res.status === "aborted" ? "已停止" : "需复核";
    $("#navReview").textContent = v.pass ? "✓" : "✗";
    document.querySelectorAll("#exports button, #expTxt2, #expSrt2, #expCsv2, #expMd2").forEach(function(b){b.disabled=!res.deliveryApproved;});
    bumpMeters(); renderReview(v, res); renderArts(res); renderMem(); renderTrace();
    $("#gateNote").textContent = res.deliveryApproved ? "第 3 步完成：本次脚本已批准。可导出脚本文件，或进入第 4 步制作 / 检查视频。" : v.pass ? "第 3 步暂停：你未批准本次交付。重新运行后可再次核对。" : "第 3 步未完成：查看失败项和修复记录，修改后重新运行。";
  }

  function renderReview(v, res) {
    if (!v.checks) return;
    var passN = v.checks.filter(function (c) { return c.ok; }).length;
    var score = passN;
    $("#revHead").innerHTML = '<div class="gauge"><span class="v">' + score + '</span><span class="u">项通过 · ' + passN + "/" + v.checks.length + " 项通过 · 第 " + res.round + " 轮</span></div>" +
      '<div class="kv" style="margin-top:8px"><span>结论</span><b class="' + (v.pass ? "ok" : "bad") + '">' + (v.pass ? "规则初筛通过 · 交付另需批准" : "打回重做") + "</b></div>" +
      '<div class="kv"><span>规划器</span><b>' + esc(res.planSource) + "</b></div>" +
      '<div class="kv"><span>耗时</span><b>' + res.ms + " ms</b></div>";
    var subs = v.subs || [];
    $("#revChecks").innerHTML = '<div class="card" style="padding:10px 12px;background:var(--paper)"><h3 style="margin:0 0 8px">四条分镜<span class="n">' + $("#platform").value + "</span></h3>" +
      subs.map(function (s, i) {
        var d = ["钩子", "卖点", "证据", "CTA"][i];
        return '<div class="kv"><span>' + d + "</span><b style='font-family:var(--sans);font-weight:400;text-align:right'>" + esc(s) + "</b></div>";
      }).join("") + "</div>" +
      v.checks.map(function (c) {
      return '<div class="chk ' + (c.ok ? "pass" : "fail") + '"><div class="i">' + (c.ok ? "✓" : "!") + '</div><div><div>' + esc(c.name) +
        '</div><div class="d">' + esc(c.detail || "") + "</div></div></div>";
    }).join("");
    var fixes = Agent.state.steps.filter(function (s) { return s.tool === "script.revise"; });
    $("#revFixes").innerHTML = fixes.length ? fixes.map(function (s, i) {
      return '<div class="check chk" style="border:0;background:none;padding:4px 0"><div class="i" style="background:var(--copper)">' + (i + 1) + '</div><div><div>' + esc(s.tool === "script.revise" ? "按审片意见修订" : "重新压行") +
        '</div><div class="d">' + esc(short(s.obs && s.obs.lines, 160)) + "</div></div></div>";
    }).join("") : '<p class="sec-note">本轮没有被退回：8 项一次通过，没有修复动作。</p>';
  }

  function renderArts(res) {
    var v = res.verdict || {};
    var subs = (v.subs || []).map(function (s) { return s || ""; });
    $("#artMeta").innerHTML = "<span>平台 <b>" + esc($("#platform").value) + "</b></span><span>时长 <b>15.0 s</b></span><span>尺寸 <b>1080×1920</b></span><span>字幕 <b>" + subs.length + "</b> 行</span>";
    renderScript(subs);
    if(res.error) { phase(0, "任务停止：" + res.error + " 请到运行设置检查连接，修正后重新运行。"); return; }
    phase(res.deliveryApproved ? 3 : 2, res.deliveryApproved ? "第 3 步完成。进入第 4 步，制作新视频或检查已有视频。" : "第 3 步未完成。查看审查结论，修改商品信息后重新运行。");
  }

  function renderMem() {
    var all = (typeof memLoad === "function" ? memLoad() : []) || [];
    $("#navMem").textContent = all.length;
    var pass1 = all.filter(function (r) { return r.rounds === 1; }).length;
    $("#memStats").innerHTML = '<div class="card" style="padding:10px"><div class="kv"><span>记录</span><b>' + all.length + '</b></div></div>' +
      '<div class="card" style="padding:10px"><div class="kv"><span>首轮即过</span><b>' + (all.length ? Math.round(pass1 / all.length * 100) : 0) + '%</b></div></div>' +
      '<div class="card" style="padding:10px"><div class="kv"><span>最近</span><b>' + (all.length ? new Date(all[all.length - 1].t).toLocaleTimeString() : "—") + "</b></div></div>";
    $("#memList").innerHTML = all.length ? '<table><thead><tr><th>时间</th><th>商品</th><th>规则通过</th><th>轮</th><th>首次退回</th></tr></thead><tbody>' +
      all.slice(-12).reverse().map(function (r) {
        return "<tr><td>" + new Date(r.t).toLocaleString() + "</td><td>" + esc(r.name) + '</td><td><b>' + (r.total ? r.passed + "/" + r.total : "旧记录 · 无检查计数") + "</b></td><td>" + r.rounds + "</td><td>" + esc((r.first || []).join("、")) + "</td></tr>";
      }).join("") + "</tbody></table>" : '<div class="empty"><span class="big">◌</span>记忆为空</div>';
  }

  /* ---------- 导出 ---------- */
  function buildFiles() {
    var v = (LAST && LAST.verdict) || {};
    var subs = (v.subs || []).map(function (s) { return s || ""; });
    var plat = PLAT[LAST.platform], brief = LAST.brief;
    var txt = "【商品 brief】\n" + brief + "\n\n【四条分镜文案 · " + plat.name + "】\n" +
      subs.map(function (s, i) { return (i + 1) + ". " + s + "  (" + s.length + " 字)"; }).join("\n") +
      "\n\n【审片结论】" + (v.pass ? "通过" : "未通过") + " · 轮次 " + (LAST ? LAST.round : 1) + "\n";
    var acc = [0, plat.dur[0], plat.dur[0] + plat.dur[1], plat.dur[0] + plat.dur[1] + plat.dur[2]];
    var srt = subs.map(function (s, i) {
      var a = acc[i], b = i === 3 ? 15 : acc[i + 1];
      return (i + 1) + "\n" + tsf(a) + " --> " + tsf(b) + "\n" + s + "\n";
    }).join("\n");
    var csv = "序号,场景,时长s,字幕,字数\n" + subs.map(function (s, i) {
      var d = i === 3 ? 15 - acc[3] : plat.dur[i];
      return [i + 1, ["钩子", "卖点", "证据", "CTA"][i], d, '"' + s.replace(/"/g, '""') + '"', s.length].join(",");
    }).join("\n");
    var md = "# 审片报告\n\n- 平台：" + plat.name + "\n- 结论：" + (v.pass ? "通过" : "未通过") + "\n- 轮次：" + (LAST ? LAST.round : 1) +
      "\n- 规划器：" + Agent.state.planSource + "\n\n| 指标 | 结果 | 说明 |\n|---|---|---|\n" +
      (v.checks || []).map(function (c) { return "| " + c.name + " | " + (c.ok ? "通过" : "未通过") + " | " + String(c.detail || "").replace(/\|/g, "/") + " |"; }).join("\n") + "\n";
    return { txt: txt, srt: srt, csv: csv, md: md };
  }
  function tsf(t) { var h = 0, m = Math.floor(t / 60), s = Math.floor(t % 60), ms = Math.round((t - Math.floor(t)) * 1000); return "00:" + pad(m) + ":" + pad(s) + "," + ("00" + ms).slice(-3); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }

  function exportAs(kind) {
    var v = (LAST && LAST.verdict) || {};
    if (!v.pass || !LAST.deliveryApproved || !LAST.files) return toast("交付闸门锁定：需要审片通过并批准本次交付");
    if(LAST.brief !== $("#brief").value.trim() || LAST.platform !== $("#platform").value) return toast("任务输入已改变，请重新运行并批准");
    var f = LAST.files, map = { txt: ["文案.txt", "text/plain"], srt: ["字幕.srt", "text/plain"], csv: ["分镜表.csv", "text/csv"], md: ["审片报告.md", "text/markdown"] };
    download(new Blob(["\ufeff" + f[kind]], { type: map[kind][1] + ";charset=utf-8" }), map[kind][0]);
    toast(map[kind][0] + " 已导出");
  }
  ["txt", "srt", "csv", "md"].forEach(function (k) {
    var a = document.getElementById("exp" + k.charAt(0).toUpperCase() + k.slice(1));
    var b = document.getElementById("exp" + k.charAt(0).toUpperCase() + k.slice(1) + "2");
    if (a) a.onclick = function () { exportAs(k); };
    if (b) b.onclick = function () { exportAs(k); };
  });

  /* ---------- 舞台播放 ---------- */
  function playStage() {
    if (!STORY) return toast("先运行一次 Agent");
    if (playing) { playing = false; cancelAnimationFrame(raf); $("#btnPlayIcon").textContent = "▶"; return; }
    playing = true; $("#btnPlayIcon").textContent = "❚❚";
    var t0 = performance.now();
    function loop() {
      if (!playing) return;
      var t = (performance.now() - t0) / 1000;
      if (t >= 15) { drawAt(15); updateTc(15); playing = false; $("#btnPlayIcon").textContent = "▶"; return; }
      drawAt(t); updateTc(t);
      raf = requestAnimationFrame(loop);
    }
    loop();
  }
  function updateTc(t) { $("#prog").style.width = (t / 15 * 100) + "%"; $("#tc").textContent = "00:" + pad(Math.floor(t)) + " / 00:15"; }
  $("#btnPlayIcon").onclick = playStage;
  $("#btnShot").onclick = function () {
    if (!STORY) return toast("先运行一次 Agent");
    drawAt(12.4);
    cv.toBlob(function (b) { download(b, "oneshot-cover.png"); toast("封面已保存 1080×1920"); }, "image/png");
  };

  /* ---------- 批量 ---------- */
  var BATCH = [], batchRunning=false;
  async function runBatch() {
    if(Agent.state.running || batchRunning) return toast("已有任务正在执行");
    batchRunning=true;
    try {
    var lines = $("#batchBox").value.split(/\n+/).map(function (s) { return s.trim(); }).filter(function (s) { return s.length >= 8; }).slice(0, 40);
    if (!lines.length) return toast("先粘 brief，一行一条");
    $("#btnBatchRun").disabled = true; $("#batchTable").innerHTML = '<div class="empty">跑 0/' + lines.length + "</div>";
    BATCH = []; var bt0 = performance.now();
    for (var i = 0; i < lines.length; i++) {
      $("#batchTable").innerHTML = '<div class="empty">跑 ' + (i + 1) + "/" + lines.length + "：" + esc(lines[i].slice(0, 18)) + "</div>";
      var r = await Agent.run(lines[i], { reviewOnly: true });
      var v = r.verdict || {};
      BATCH.push({ brief: lines[i], pass: v.pass, round: r.round, fails: v.fails || [], ms: r.ms });
    }
    $("#btnBatchRun").disabled = false;
    BATCH.total = Math.round(performance.now() - bt0);
    renderBatch(); renderMem();
    } finally {batchRunning=false; $("#btnBatchRun").disabled=false;}
  }
  function renderBatch() {
    $("#batchN").textContent = BATCH.length;
    if (!BATCH.length) return;
    var pass = BATCH.filter(function (b) { return b.pass; }).length;
    $("#batchTable").innerHTML = '<p class="sec-note">' + BATCH.length + " 条 · 通过 " + pass + " 条 · 平均 " + (Math.round(((BATCH.total || 0) / BATCH.length) * 10) / 10 || "<1") + " ms/条（含每条的完整工具链）</p>" +
      "<table><thead><tr><th>#</th><th>brief</th><th>结论</th><th>轮</th><th>未过项</th></tr></thead><tbody>" +
      BATCH.map(function (b, i) {
        return "<tr><td>" + (i + 1) + "</td><td>" + esc(b.brief.slice(0, 16)) + "</td><td class=\"" + (b.pass ? "ok" : "bad") + "\">" + (b.pass ? "通过" : "打回") +
          "</td><td>" + b.round + "</td><td>" + esc(b.fails.join("、")) + "</td></tr>";
      }).join("") + "</tbody></table>";
  }
  $("#btnBatchRun").onclick = runBatch;
  $("#btnBatchCsv").onclick = function () {
    if (!BATCH.length) return toast("还没有批量结果");
    var csv = "序号,brief,结论,轮次,未过项,耗时ms\n" + BATCH.map(function (b, i) {
      return [i + 1, '"' + b.brief.replace(/"/g, '""') + '"', b.pass ? "通过" : "打回", b.round, '"' + b.fails.join("、") + '"', b.ms].join(",");
    }).join("\n");
    download(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }), "批量审片.csv");
    toast("批量审片.csv 已导出");
  };

  /* ---------- 设置 ---------- */
  function renderCfg() {
    $("#cfgBase").value = LLM.cfg.base || "";
    $("#cfgKey").value = LLM.cfg.key || "";
    $("#cfgModel").value = LLM.cfg.model || "";
    $("#setCur").textContent = LLM.active;
    $("#cfgNote").textContent = "当前：" + LLM.label() + (LLM.active === "offline" ? " · 未发起任何网络请求" : " · 已配置，尚需成功调用验证");
    $("#railProviderTxt").textContent = LLM.active === "offline" ? "离线确定性策略" : LLM.label();
    $("#railProvider").classList.toggle("off", LLM.active === "offline");
  }
  $("#btnCfgSave").onclick = async function () {
    var base = $("#cfgBase").value.trim();
    LLM.setConfig({ base: base, key: $("#cfgKey").value.trim(), model: $("#cfgModel").value.trim() || LLM.cfg.model });
    if (!base) { renderCfg(); return toast("已回到离线确定性策略"); }
    if (base.indexOf("11434") >= 0) {
      var ok = await LLM.probeOllama();
      renderCfg();
      return toast(ok ? "已接通 Ollama：" + LLM.cfg.model : "未连接 Ollama；保留当前配置，请检查服务或显式切换离线模式");
    }
    renderCfg();
    var probe=await LLM.chat([{role:"user",content:"请仅回复 OK"}],{maxTokens:8});
    $("#cfgNote").textContent=probe.offline?"连接失败："+probe.error:"已验证模型响应 · "+LLM.cfg.model;
    toast(probe.offline?"模型连接失败，请检查端点或跨域设置":"模型连接验证成功");
  };
  $("#btnCfgReset").onclick = function () { LLM.setConfig({ base: "", key: "", model: LLM.cfg.model }); renderCfg(); toast("已回到离线确定性策略"); };

  /* ---------- 清空 / 记忆 ---------- */
  $("#btnClear").onclick = function () { if(Agent.state.running || batchRunning)return toast("请先停止任务"); LAST=null; STORY=null; tlReset(); Agent.reset(); renderTrace(); renderScript([]); phase(0,"轨迹已清空。填写商品信息后重新运行。"); document.querySelectorAll("#exports button, #expTxt2, #expSrt2, #expCsv2, #expMd2").forEach(function(b){b.disabled=true;}); $("#status").className = "status"; $("#statusTxt").textContent = "待命"; toast("轨迹已清空"); };
  $("#btnStop").onclick = function () { Agent.abort(); toast("已请求停止"); };
  $("#btnMemClear2").onclick = function () { memSave([]); renderMem(); toast("记忆已清空（不影响判定规则）"); };
  $("#btnTraceJson").onclick = function () { download(new Blob([$("#tracePre").textContent], { type: "application/json" }), "trace.json"); toast("trace.json 已导出"); };
  $("#btnTraceCopy").onclick = function () { navigator.clipboard && navigator.clipboard.writeText($("#tracePre").textContent); toast("已复制到剪贴板"); };

  /* ---------- 启动 ---------- */
  $("#chips").innerHTML = BRIEFS.map(function (b, i) { return '<button type="button" class="chip" data-i="' + i + '">' + esc(b.n) + "</button>"; }).join("");
  $$("#chips .chip").forEach(function (c) { c.onclick = function () { if(Agent.state.running || batchRunning)return toast("请先等待当前任务结束"); $("#brief").value = BRIEFS[+c.dataset.i].b; invalidateInput(); toast("已载入示例 brief：" + BRIEFS[+c.dataset.i].n); }; });
  $("#btnStart").onclick = run;
  $("#btnStart2").onclick = run;
  document.addEventListener("keydown", function (e) { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); run(); } });
  window.ONESHOT_DEMO = location.hostname === "restartbaiye.github.io" || new URLSearchParams(location.search).get("demo") === "1";
  if (window.ONESHOT_DEMO) { LLM.active="offline"; LLM.cfg.base=""; LLM.cfg.key=""; } else LLM.load();
  renderRegistry(); renderCfg(); renderMem(); renderTrace();

  /* 事实表与合规面板：从最近一次 observe 里取 */
  var origOnEvent = onEvent;
  onEvent = function (kind, p) {
    origOnEvent(kind, p);
    if (kind === "observe" && p.obs) {
      if (p.tool === "facts.extract") {
        $("#factN").textContent = p.obs.count + " 条";
        $("#factList").innerHTML = (p.obs.rows || []).map(function (r) {
          return '<div class="kv"><span>' + esc(r.k) + '</span><b>' + esc(r.v) + "</b></div>";
        }).join("") || '<div class="empty">brief 里没有可抽取的数值</div>';
      }
      if (p.tool === "compliance.scan") {
        $("#compList").innerHTML = p.obs.clean ? '<div class="chk pass"><div class="i">✓</div><div>原文无违禁词<div class="d">绝对化用语 / 功效宣称 / 虚假承诺 三组规则</div></div></div>'
          : (p.obs.hits || []).map(function (h) { return '<div class="chk fail"><div class="i">!</div><div>' + esc(h.kind) + '<div class="d">' + esc(h.words.join("、")) + "</div></div></div>"; }).join("");
      }
    }
  };
})();