"use strict";
var $ = function(s){ return document.querySelector(s); };
var cv = $("#cv"), ctx = cv.getContext("2d");
var W = 1080, H = 1920;
var C = { cream:"#FAF6EF", ink:"#171411", ink2:"#2A241D", copper:"#BA5C34",
          gold:"#C8952E", white:"#FFFCF6", muted:"#8B7E6D", line:"#DFD3BF" };
var PLAT = {
  douyin:{ name:"抖音", sub:14, hook:12, dur:[3,4,4,4], cps:6 },
  shipinhao:{ name:"视频号", sub:16, hook:14, dur:[3,3,5,4], cps:6 },
  xiaohongshu:{ name:"小红书", sub:12, hook:10, dur:[3,4,4,4], cps:6 }
};
var BANNED = [
  ["绝对化用语", /(最好|最佳|最强|最低|最高|第一|唯一|顶级|国家级|世界级|永久|万能|100%|绝对)/],
  ["功效宣称", /(根治|治愈|疗效|防癌|抗癌|减肥|降三高)/],
  ["虚假承诺", /(稳赚|包治|立刻见效|永不|全网最低)/]
];

function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; var t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function hash(s){ var h=2166136261; for(var i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619);} return h>>>0; }
function sleep(ms){ return new Promise(function(r){ setTimeout(r,ms); }); }
function now(){ return performance.now(); }
function toast(t){ var el=$("#toast"); el.textContent=t; el.classList.add("on"); clearTimeout(el._t); el._t=setTimeout(function(){el.classList.remove("on");},1900); }
function esc(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

/* ---------- 事实抽取 ---------- */
function extractFacts(brief){
  var facts=[], seen={};
  function push(k,v){
    if(seen["v|"+v]) return;
    seen["v|"+v] = 1; facts.push({k:k,v:v,src:"brief"});
  }
  var price = brief.match(/(\d+(?:\.\d+)?)\s*元/);
  if(price) push("价格", price[1]+" 元");
  var params = brief.match(/(\d+(?:\.\d+)?)\s*(小时|分钟|天|℃|度|克|kg|ml|次|年|L|万次)/g) || [];
  params.forEach(function(p){ push("参数", p.replace(/\s+/g,"")); });
  var model = brief.match(/(\d{3,4}[A-Za-z])\b/); if(model) push("材质/型号", model[1]);
  var materials=brief.match(/\b(?:316L|304|430)\b/gi)||[];materials.forEach(function(v){push("材质",v.toUpperCase());});
  var weights=brief.match(/(\d+(?:\.\d+)?)\s*(g|kg|克|千克|ml|毫升|L|升)/gi)||[];weights.forEach(function(v){push("容量/重量",v.replace(/\s+/g,""));});
  return facts;
}
function briefNumbers(brief){ return brief.match(/\d+(?:\.\d+)?/g) || []; }

/* ---------- 解析 ---------- */
function parseBrief(brief){
  var parts=brief.split(/[，,。；;\n]/).map(function(s){return s.trim();}).filter(Boolean);
  var name=(parts[0]||"商品").replace(/^(做一个|做个|做)/,"").split(/\s/)[0].slice(0,12);
  var claims=parts.filter(function(s){return !/售价|售价|人群|主打|下单|送|元/.test(s);});
  return {name:name,claims:claims.slice(0,4),price:(brief.match(/(\d+(?:\.\d+)?)\s*元/)||[])[1]||"",audience:(brief.match(/(?:主打|人群是|卖给)([^，,。]+)/)||[])[1]||"未提供",brief:brief};
}
var TRACE = [], STORY = null, T = 0, raf = 0;

var MEMKEY = "oneshot.mem.v1";
function memLoad(){ try { return JSON.parse(localStorage.getItem(MEMKEY) || "[]"); } catch(e){ return []; } }
function memSave(a){ try { localStorage.setItem(MEMKEY, JSON.stringify(a.slice(-200))); } catch(e){} }
function memTop(a){
  var c = {};
  a.forEach(function(r){ (r.first || []).forEach(function(n){ c[n] = (c[n] || 0) + 1; }); });
  return Object.keys(c).map(function(k){ return [k, c[k]]; }).sort(function(x, y){ return y[1] - x[1]; }).slice(0, 3);
}
function memNote(first){
  if(!first || !first.length) return "";
  var n = 0;
  memLoad().forEach(function(r){ if((r.first || []).some(function(x){ return first.indexOf(x) >= 0; })) n++; });
  return n >= 2 ? "记忆提示：这条和你本机此前 " + n + " 条退回同因（" + first.join(" / ") + "），重点看这里。" : "";
}
function memAdd(rec){ var a = memLoad(); a.push(rec); memSave(a); renderMem(); }
function renderMem(){
  var box = $("#mem"); if(!box) return;
  var a = memLoad();
  if(!a.length){ box.innerHTML = '<tr><td>—</td><td>还没有记录；跑一条，或跑一次批量审片就会累积</td></tr>'; return; }
  var pass1 = a.filter(function(r){ return (r.first || []).length === 0; }).length;
  var top = memTop(a);
  box.innerHTML =
    '<tr><td>累计</td><td>' + a.length + ' 条 · 首轮即过 ' + pass1 + ' 条（' + Math.round(pass1 / a.length * 100) + '%）</td></tr>' +
    '<tr><td>最近</td><td>' + a.slice(-3).map(function(r){ return esc(r.name) + ' ' + r.score + ' 分 · ' + r.rounds + ' 轮'; }).join('；') + '</td></tr>' +
    '<tr><td>最常退回</td><td>' + (top.length ? top.map(function(t){ return t[0] + ' ×' + t[1]; }).join(' · ') : '无') + '</td></tr>';
}
function memClear(){ memSave([]); renderMem(); toast("记忆已清空（不影响任何判定规则）"); }

function log(who, msg, cls){
  var el = $("#log"), d = document.createElement("div");
  d.className = "line";
  d.innerHTML = '<span class="who">'+esc(who)+'</span><span class="msg '+(cls||"")+'">'+esc(msg)+'</span>' +
                '<span class="ms">'+Math.round(now()%100000)+'</span>';
  el.appendChild(d); el.scrollTop = el.scrollHeight;
  TRACE.push({ t:Date.now(), agent:who, msg:msg, verdict:cls||"info" });
}

function makeScript(p,plat,rnd){
  return {hook:p.name+"，了解一下",claim:p.claims[0]||p.name,proof:p.claims[1]||"查看商品详情",cta:p.price?p.price+"元，查看详情":"查看商品详情"};
}
function clampSub(s, max){ return s.length<=max ? s : s.slice(0, max-1).replace(/[，,、]$/,"")+"…"; }

function unsupportedFacts(texts, brief){
  var nums=briefNumbers(brief);
  var numsInText = texts.match(/\d+(?:\.\d+)?/g) || [];
  var uniq = [];
  numsInText.forEach(function(n){ if(nums.indexOf(n) < 0 && uniq.indexOf(n) < 0) uniq.push(n); });
  var normalized=brief.replace(/\s/g,"").toLowerCase();
  var quantities=texts.match(/\d+(?:\.\d+)?\s*(?:小时|分钟|天|℃|度|克|kg|ml|g|次|年|L|元|%)/gi)||[];
  quantities.forEach(function(q){if(normalized.indexOf(q.replace(/\s/g,"").toLowerCase())<0 && uniq.indexOf(q)<0)uniq.push(q);});
  var unsupported=(texts.match(/实测|认证|便宜一半|用料扎实|耐用|保温|食品级/g)||[]).filter(function(t){return brief.indexOf(t)<0;});
  unsupported.forEach(function(t){if(uniq.indexOf(t)<0)uniq.push(t);});
  return uniq;
}

function review(subs, p, brief, facts, plat){
  var issues = [], total = plat.dur.reduce(function(a,b){return a+b;},0);
  var texts = subs.join(" ");
  issues.push({ name:"钩子时长", ok: plat.dur[0] <= 3, detail:"首镜 "+plat.dur[0]+"s（要求 ≤3s）", r: plat.dur[0]+"s" });
  issues.push({ name:"钩子字数", ok: subs[0].length <= plat.hook, detail: subs[0].length+" 字（上限 "+plat.hook+" 字）", r: subs[0].length+"", fix:"sub" });
  var over = [];
  subs.forEach(function(s,i){ if(s.length > plat.sub) over.push(i); });
  issues.push({ name:"单行字幕", ok: over.length===0,
    detail: over.length ? ("第 "+(over[0]+1)+" 条 "+subs[over[0]].length+" 字 > "+plat.sub+" 字上限") : ("全部 ≤ "+plat.sub+" 字"),
    r: "≤"+plat.sub, fix:"sub" });
  issues.push({ name:"总时长", ok: Math.abs(total-15)<=0.5, detail: total+"s（要求 15±0.5s）", r: total+"s" });
  issues.push({ name:"CTA 位置", ok: plat.dur[3] >= 3, detail:"结尾 "+plat.dur[3]+"s 落在最后一段", r: plat.dur[3]+"s" });
  var cps = texts.length/total;
  issues.push({ name:"语速", ok: cps <= plat.cps, detail: cps.toFixed(1)+" 字/秒（要求 ≤"+plat.cps+"）", r: cps.toFixed(1) });
  var uniq=unsupportedFacts(texts,brief);
  issues.push({ name:"事实一致", ok: uniq.length===0,
    detail: uniq.length ? ("发现未溯源数字、单位或宣称："+uniq.join("、")) : "数字与单位命中原文；部分宣称已扫，不等于完整语义核验",
    r: uniq.length ? "✕" : "✓", fix:"fact" });
  var hits = [];
  BANNED.forEach(function(b){ var mm = texts.match(b[1]); if(mm) hits.push(b[0]+"「"+mm[0]+"」"); });
  issues.push({ name:"广告法合规", ok: hits.length===0, detail: hits.length ? hits.join("；") : "未命中违禁词表（绝对化/功效/虚假承诺）",
    r: hits.length ? "✕" : "✓", fix:"banned" });
  return issues;
}

async function pipeline(){
  var brief = $("#brief").value.trim();
  var platKey = $("#platform").value, plat = PLAT[platKey];
  var seed = hash(brief + platKey), rnd = mulberry32(seed);
  $("#stageSeed").textContent = "seed " + seed.toString(16).slice(0,6);
  var t0 = now(), round = 1, issues = [], script, subs, pass = false, firstBad = [];
  $("#log").innerHTML = ""; TRACE.length = 0;
  $("#score").textContent = "—"; $("#scoreNote").textContent = "运行中"; $("#verdict").textContent = "";
  $("#live").classList.add("on"); $("#btnRun").disabled = true;

  log("FactAgent", "解析 brief → 任务卡（角色 / 触发条件 / 成功标准）");
  await sleep(220);
  var p = parseBrief(brief), facts = extractFacts(brief);
  renderFacts(facts);
  log("FactAgent", "事实表："+facts.length+" 条 · 商品「"+p.name+"」· 卖点 "+p.claims.length+" 条 · "+plat.name+" 规则：字幕 ≤"+plat.sub+" 字，钩子 ≤"+plat.hook+" 字", "ok");

  log("CopyAgent", "按平台规则生成 4 句口播（钩子/卖点/证据/行动）");
  await sleep(260);
  script = makeScript(p, plat, rnd);
  log("CopyAgent", "钩子「"+script.hook+"」· 证据「"+script.proof+"」", "ok");

  for(round = 1; round <= 3; round++){
    log("Storyboard", "第 "+round+" 轮分镜："+plat.dur.join(" / ")+" 秒");
    await sleep(190);
    subs = [script.hook, script.claim, script.proof, script.cta];
    paintSegs(plat.dur);
    log("Subtitle", "4 条字幕落版（上限 "+plat.sub+" 字）");
    await sleep(180);

    issues = review(subs, p, brief, facts, plat);
    var bad = issues.filter(function(i){ return !i.ok; });
    renderChecks(issues);
    if(round === 1) firstBad = bad.map(function(i){ return i.name; });
    if(bad.length === 0){ pass = true; log("Reviewer", "硬指标 "+issues.length+" 项全通过，允许交付", "ok"); break; }
    bad.forEach(function(i){ log("Reviewer", "✕ "+i.name+"："+i.detail, "bad"); });
    if(round === 3) break;
    log("Orchestrator", "↺ 打回重做（第 "+round+" 轮不合格，禁止交付）");
    var ORDER = ["fact","banned","sub"];
    ORDER.forEach(function(kind){
    bad.forEach(function(i){
      if(i.fix !== kind) return;
      if(i.fix === "fact"){
        script.proof = script.proof.replace(/，?实测\s*\d+(?:\.\d+)?\s*(小时|分钟|天|℃|度|次|年)/g, "");
        var briefFlat = brief.replace(/\s/g, "");
        script.proof = script.proof.replace(/\d+(?:\.\d+)?\s*(小时|分钟|天|℃|度|次|年)/g, function(m0){
          return briefFlat.indexOf(m0.replace(/\s/g,"")) >= 0 ? m0 : "";
        });
        script.proof = script.proof.replace(/^[，,、]+/,"").replace(/[，,、]+$/,"");
      }
      if(i.fix === "banned"){
        BANNED.forEach(function(b){
          script.proof = script.proof.replace(new RegExp(b[1].source,"g"), "");
          script.claim = script.claim.replace(new RegExp(b[1].source,"g"), "");
        });
      }
      if(i.fix === "sub"){
        script.hook = clampSub(script.hook, plat.hook);
        script.claim = clampSub(script.claim, plat.sub);
        script.proof = clampSub(script.proof.replace(/，$/,""), plat.sub);
        script.cta = clampSub(script.cta, plat.sub);
      }
    });
    });
    await sleep(300);
  }

  log("RenderAgent", "排版渲染 1080×1920 · 30fps");
  await sleep(180);
  STORY = { p:p, subs:subs, plat:plat, facts:facts, brief:brief };
  drawAt(1.2);
  var ms = Math.round(now()-t0);
  $("#stageMs").textContent = ms + " ms";
  log("RenderAgent", "成片就绪 · 全流程耗时 "+ms+" ms", "ok");

  var badN = issues.filter(function(i){ return !i.ok; }).length;
  var score = Math.max(0, 100 - badN*8 - (round-1)*4);
  $("#score").textContent = score;
  $("#score").style.color = pass ? "var(--ok)" : "var(--bad)";
  var okN = issues.filter(function(i){ return i.ok; }).length;
  $("#scoreNote").innerHTML = (pass?"通过":"未通过")+" · "+round+" 轮 · 命中 "+okN+"/"+issues.length+" 项" +
      '<span class="pill '+(pass?"pass":"fail")+'">'+(pass?"允许交付":"禁止交付")+'</span>';
  $("#verdict").textContent = pass
    ? "审片 Agent 判定可交付：字幕长度、时长、CTA 位置、语速、事实一致性与广告法合规均通过；报告可导出留存。"
    : "审片 Agent 判定禁止交付：仍有硬指标未通过，需人工介入或补充 brief。";
  var mnote = memNote(firstBad);
  if(mnote) $("#verdict").textContent += " " + mnote;
  memAdd({ t: Date.now(), name: p.name, plat: plat.name, score: score, rounds: round, first: firstBad });
  $("#live").classList.remove("on");
  $("#btnRun").disabled = false;
}

function paintSegs(dur){
  var names = ["镜1 钩子","镜2 产品","镜3 证据","镜4 行动"];
  $("#segs").querySelectorAll("div").forEach(function(d,i){ d.textContent = names[i]+" "+dur[i]+"s"; });
}
function renderFacts(facts){
  if(!facts.length){ $("#facts").innerHTML = '<tr><td>—</td><td>brief 中未发现可核验数字</td></tr>'; return; }
  $("#facts").innerHTML = facts.map(function(f){
    return '<tr><td>'+esc(f.k)+'</td><td>'+esc(f.v)+'<div class="src">来源：'+esc(f.src)+'</div></td></tr>';
  }).join("");
}
function renderChecks(issues){
  $("#checks").innerHTML = issues.map(function(i){
    return '<li><span class="k '+(i.ok?"ok":"bad")+'">'+(i.ok?"✓":"✕")+'</span>' +
      '<span class="n">'+esc(i.name)+'<div style="color:#A79B8A;font-size:10.5px">'+esc(i.detail)+'</div></span>' +
      '<span class="r">'+esc(i.r||"")+'</span></li>';
  }).join("");
}

function drawAt(t){
  T = t;
  ctx.clearRect(0,0,W,H);
  if(!STORY){ drawIdle(); return; }
  var p = STORY.p, subs = STORY.subs, plat = STORY.plat, d = plat.dur;
  var acc = [0, d[0], d[0]+d[1], d[0]+d[1]+d[2]];
  var i = 0;
  for(var k=3;k>=0;k--){ if(t >= acc[k]){ i = k; break; } }
  drawScene(i, t-acc[i], d[i], p, subs, plat);
  drawChrome(t, d, subs);
  setSeg(Math.min(3, Math.max(0, i)));
}
function drawIdle(){
  ctx.fillStyle = C.cream; ctx.fillRect(0,0,W,H);
  ctx.textAlign = "center";
  ctx.fillStyle = C.muted; ctx.font = "500 44px 'Microsoft YaHei',sans-serif";
  ctx.fillText("输入 brief，点「开始生成」", W/2, H/2);
  ctx.font = "400 32px 'Microsoft YaHei',sans-serif";
  ctx.fillText("事实溯源 · 审片修订 · 人工确认交付", W/2, H/2+64);
  ctx.textAlign = "left";
}
function wrap(s, max){
  var out = [], line = "";
  for(var i=0;i<s.length;i++){ var ch = s[i];
    if((line+ch).length > max){ out.push(line); line = ch; } else { line += ch; } }
  if(line) out.push(line);
  return out;
}
function roundRect(x,y,w,h,r){
  ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath();
}
function drawScene(i, lt, dur, p, subs, plat){
  var dark = (i % 2) === 1, ink = dark ? C.white : C.ink;
  ctx.fillStyle = dark ? C.ink : C.cream; ctx.fillRect(0,0,W,H);
  if(dark){
    var g1 = ctx.createRadialGradient(W*0.3,H*0.25,0,W*0.3,H*0.25,W*0.9);
    g1.addColorStop(0,"#3A3025"); g1.addColorStop(1,C.ink); ctx.fillStyle = g1; ctx.fillRect(0,0,W,H);
  } else {
    var g2 = ctx.createRadialGradient(W*0.7,0,0,W*0.7,0,W);
    g2.addColorStop(0,"#FFFDF7"); g2.addColorStop(1,C.cream); ctx.fillStyle = g2; ctx.fillRect(0,0,W,H);
  }
  var kickers = ["01 / HOOK","02 / PRODUCT","03 / PROOF","04 / CTA"];
  ctx.fillStyle = dark ? C.gold : C.copper;
  ctx.font = "700 24px ui-monospace,monospace";
  if("letterSpacing" in ctx) ctx.letterSpacing = "6px";
  ctx.fillText(kickers[i], 96, 170);
  if("letterSpacing" in ctx) ctx.letterSpacing = "0px";
  ctx.fillRect(96, 196, 120, 3);

  if(i === 0){
    var lines = wrap(subs[0], 8);
    var maxLen = 1;
    lines.forEach(function(l){ if(l.length > maxLen) maxLen = l.length; });
    var fs = Math.min(126, Math.floor((W - 184) / maxLen));
    var lh = Math.round(fs * 1.18);
    ctx.font = "600 " + fs + "px 'Songti SC','SimSun',serif";
    lines.forEach(function(l,k){
      var a = Math.min(1, Math.max(0,(lt-0.05-k*0.12)/0.4));
      ctx.globalAlpha = a; ctx.fillStyle = ink;
      ctx.fillText(l, 92, 470 + k*lh - (1-a)*24);
    });
    ctx.globalAlpha = 1;
    var w1 = Math.min(1, Math.max(0,(lt-0.5)/0.5));
    ctx.fillStyle = C.copper; ctx.fillRect(330, 660, 380*w1, 8);
    drawProduct(690, 1290, 300, 600, lt, false);
  }
  if(i === 1){
    ctx.fillStyle = ink; ctx.font = "600 92px 'Songti SC','SimSun',serif";
    ctx.fillText("三个理由", 92, 300);
    drawProduct(300, 1090, 340, 700, lt, true);
    var items = p.claims.length ? p.claims : [subs[1]];
    var subline = ["来源：商品 brief","来源：商品 brief","来源：商品 brief"];
    items.slice(0,3).forEach(function(it,k){
      var y = 440 + k*250, a = Math.min(1, Math.max(0,(lt-k*0.35)/0.5));
      ctx.globalAlpha = a;
      ctx.fillStyle = C.copper; ctx.font = "700 26px ui-monospace,monospace";
      ctx.fillText("0"+(k+1), 600, y);
      ctx.fillStyle = ink; ctx.font = "600 52px 'Microsoft YaHei',sans-serif";
      ctx.fillText(it.length>10 ? it.slice(0,10) : it, 600, y+84);
      ctx.fillStyle = dark ? "#9C9184" : C.muted; ctx.font = "400 26px 'Microsoft YaHei',sans-serif";
      ctx.fillText(subline[k] || "", 600, y+138);
      ctx.fillStyle = dark ? "#4A3F33" : C.line; ctx.fillRect(600, y+178, 372*a, 2);
      ctx.globalAlpha = 1;
    });
  }
  if(i === 2){
    var big = (p.price || "—").toString();
    ctx.fillStyle = dark ? C.gold : C.copper;
    ctx.font = "700 280px Georgia,'Times New Roman',serif";
    ctx.fillText(big, 88, 560);
    var bw = ctx.measureText(big).width;
    ctx.fillStyle = ink; ctx.font = "600 90px 'Songti SC','SimSun',serif";
    ctx.fillText(p.price ? "元" : "待补充", 88+bw+24, 552);
    ctx.fillStyle = dark ? "#CFC3B2" : C.ink2; ctx.font = "400 40px 'Microsoft YaHei',sans-serif";
    var sl = wrap(subs[2], 18);
    sl.forEach(function(l,k){ ctx.fillText(l, 96, 680 + k*56); });
    var base = 900, bwid = 860;
    var vals = [0, 0.62, 0];
    var labels = ["同类目均价 · 待运营补数","本店价" + (p.price ? " " + p.price + " 元" : ""),"券后到手 · 待运营补数"];
    vals.forEach(function(v,k){
      var y = base + k*170, grow = Math.min(1, Math.max(0,(lt-k*0.25)/0.6));
      ctx.fillStyle = dark ? "#3A3229" : "#E7DCC9"; ctx.fillRect(120, y, bwid, 22);
      if(v > 0){
        ctx.fillStyle = C.copper; ctx.fillRect(120, y, bwid*v*grow, 22);
      } else {
        ctx.save(); ctx.strokeStyle = dark ? "#6B5F4F" : "#C9BCA6"; ctx.lineWidth = 2;
        ctx.setLineDash([10,8]); ctx.strokeRect(120, y, bwid, 22); ctx.restore();
      }
      ctx.fillStyle = dark ? "#CFC3B2" : C.muted; ctx.font = "400 24px 'Microsoft YaHei',sans-serif";
      ctx.fillText(labels[k], 120, y-14);
    });
    ctx.fillStyle = dark ? "#8B7E6D" : C.muted; ctx.font = "400 24px 'Microsoft YaHei',sans-serif";
    ctx.fillText("示意图 · 数字来自 brief，可溯源", 120, base+3*170+18);
    drawProduct(886, 1494, 176, 322, lt, dark);
  }
  if(i === 3){
    var a2 = Math.min(1, Math.max(0, lt/0.5));
    ctx.globalAlpha = a2;
    if(p.price){
      ctx.fillStyle = C.gold; ctx.font = "700 280px Georgia,'Times New Roman',serif";
      ctx.fillText(p.price, 88, 520);
      var w2 = ctx.measureText(p.price).width;
      ctx.fillStyle = C.white; ctx.font = "600 90px 'Songti SC','SimSun',serif";
      ctx.fillText("元", 88+w2+22, 512);
    }
    ctx.fillStyle = C.white; ctx.font = "600 44px 'Microsoft YaHei',sans-serif";
    ctx.fillText(subs[3], 92, 660);
    ctx.globalAlpha = 1;
    var bw2 = 520, bh2 = 142, bx = 92, by = 800;
    ctx.fillStyle = C.copper; roundRect(bx, by, bw2, bh2, 71); ctx.fill();
    ctx.fillStyle = C.white; ctx.font = "600 42px 'Microsoft YaHei',sans-serif";
    ctx.fillText("点击左下角", bx+46, by+88);
    ctx.font = "600 46px 'Microsoft YaHei',sans-serif";
    ctx.fillText("↓", bx+bw2-92, by+88);
    drawProduct(828, 1180, 268, 528, lt, true);
    ctx.fillStyle = C.white; ctx.font = "600 40px 'Songti SC','SimSun',serif";
    ctx.fillText("一句话片场 · OneShot Studio", 92, 1548);
    ctx.fillStyle = "#9C9184"; ctx.font = "400 23px 'Microsoft YaHei',sans-serif";
    ctx.fillText("分镜预览 · 规则初筛，需运营复核", 92, 1598);
  }
}
var PRODUCT_IMAGE = null;
function setProductImage(img){ PRODUCT_IMAGE = img || null; if(STORY) drawAt(T); }
function drawProduct(cx,cy,bw,bh,t,dark){
  var p=STORY&&STORY.p;ctx.save();ctx.translate(cx,cy+Math.sin(t)*8);
  ctx.fillStyle=dark?"#302B26":"#F0E8DC";roundRect(-bw/2,-bh/2,bw,bh,24);ctx.fill();
  ctx.save();roundRect(-bw/2+8,-bh/2+8,bw-16,bh-16,18);ctx.clip();
  if(PRODUCT_IMAGE){var scale=Math.max((bw-16)/PRODUCT_IMAGE.width,(bh-16)/PRODUCT_IMAGE.height),iw=PRODUCT_IMAGE.width*scale,ih=PRODUCT_IMAGE.height*scale;ctx.drawImage(PRODUCT_IMAGE,-iw/2,-ih/2,iw,ih);}
  else{ctx.fillStyle=dark?"#302B26":"#F0E8DC";ctx.fillRect(-bw/2,-bh/2,bw,bh);ctx.fillStyle=dark?C.white:C.ink;ctx.textAlign="center";ctx.font="600 34px 'Microsoft YaHei',sans-serif";wrap(p?p.name:"商品",7).forEach(function(s,i){ctx.fillText(s,0,-30+i*48);});ctx.font="22px 'Microsoft YaHei',sans-serif";ctx.fillStyle=C.muted;ctx.fillText("上传商品图以替换占位",0,bh/2-46);}
  ctx.restore();ctx.strokeStyle=C.copper;ctx.lineWidth=3;roundRect(-bw/2,-bh/2,bw,bh,24);ctx.stroke();ctx.restore();
}
function drawChrome(t, dur, subs){
  var total = dur.reduce(function(a,b){return a+b;},0);
  var bx = 96, bwid = 888, acc = 0;
  dur.forEach(function(s,i){
    var sx = bx + bwid*acc/total, sw = bwid*s/total;
    ctx.fillStyle = "rgba(255,255,255,.18)"; ctx.fillRect(sx, 62, sw, 3);
    var pp = Math.min(1, Math.max(0,(t-acc)/s));
    if(pp > 0){ ctx.fillStyle = C.copper; ctx.fillRect(sx, 62, sw*pp, 3); }
    acc += s;
  });
  var idx = 0, a = 0;
  for(var k=0;k<4;k++){ if(t >= a) idx = k; a += dur[k]; }
  var darkScene = (idx % 2) === 1;
  if("letterSpacing" in ctx) ctx.letterSpacing = "5px";
  ctx.fillStyle = darkScene ? "rgba(255,255,255,.45)" : "rgba(23,20,17,.38)";
  ctx.font = "700 18px ui-monospace,monospace";
  ctx.textAlign = "right"; ctx.fillText("ONESHOT", 984, 100); ctx.textAlign = "left";
  if("letterSpacing" in ctx) ctx.letterSpacing = "0px";
  var sub = subs[idx]; if(!sub) return;
  var start = 0; for(var m=0;m<idx;m++) start += dur[m];
  var fade = Math.min(1, Math.max(0, (t-start)/0.25));
  ctx.save(); ctx.globalAlpha = fade;
  ctx.font = "600 42px 'Microsoft YaHei',sans-serif";
  var tw = ctx.measureText(sub).width, x = (W-tw)/2, y = 1746;
  if(darkScene){
    ctx.fillStyle = "rgba(0,0,0,.60)"; ctx.fillText(sub, x+2, y+3);
    ctx.fillStyle = C.white; ctx.fillText(sub, x, y);
  } else {
    ctx.fillStyle = "rgba(255,252,246,.85)"; ctx.fillText(sub, x+2, y+3);
    ctx.fillStyle = C.ink; ctx.fillText(sub, x, y);
  }
  ctx.fillStyle = C.copper; ctx.fillRect(x-30, y-26, 9, 14);
  ctx.restore();
}
function setSeg(i){ $("#segs").querySelectorAll("div").forEach(function(d,k){ d.classList.toggle("on", k === i); }); }

function play(){
  if(!STORY) return toast("先运行一次生成");
  cancelAnimationFrame(raf);
  var t0 = performance.now();
  function loop(){
    var t = (performance.now()-t0)/1000;
    if(t >= 15){ drawAt(15); return; }
    drawAt(t);
    raf = requestAnimationFrame(loop);
  }
  loop();
}
async function record(){
  if(!STORY) return toast("先运行一次生成");
  if(!cv.captureStream || !window.MediaRecorder) return toast("此浏览器不支持录制，可改用录屏");
  var stream = cv.captureStream(30);
  var mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm";
  var rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6000000 });
  var chunks = [];
  rec.ondataavailable = function(e){ if(e.data.size) chunks.push(e.data); };
  var done = new Promise(function(r){ rec.onstop = r; });
  rec.start();
  $("#live").classList.add("on"); $("#liveTxt").textContent = "录制中 15s";
  var t0 = performance.now();
  await new Promise(function(res){
    function loop(){
      var t = (performance.now()-t0)/1000;
      if(t >= 15.2){ drawAt(15); return res(); }
      drawAt(t); requestAnimationFrame(loop);
    }
    loop();
  });
  rec.stop(); await done;
  download(new Blob(chunks, {type:"video/webm"}), "oneshot-15s.webm");
  $("#live").classList.remove("on"); $("#liveTxt").textContent = "运行中";
  toast("成片已保存（15s webm）");
}
function saveCover(){
  if(!STORY) return toast("先运行一次生成");
  drawAt(13.2);
  cv.toBlob(function(b){ download(b, "oneshot-cover.png"); }, "image/png");
  toast("封面已保存（1080×1920）");
}
function report(){
  if(!STORY) return toast("先运行一次生成");
  var s = STORY, lines = [];
  lines.push("# 审片报告 · 一句话片场 OneShot Studio");
  lines.push("");
  lines.push("- 商品：" + s.p.name);
  lines.push("- 平台：" + s.plat.name + "（字幕 ≤" + s.plat.sub + " 字，分镜 " + s.plat.dur.join("/") + "s）");
  lines.push("- 卖点：" + (s.p.claims.join(" / ") || "—"));
  lines.push("- 价格：" + (s.p.price || "—") + "　人群：" + s.p.audience);
  lines.push("- 审片得分：" + $("#score").textContent);
  lines.push("");
  lines.push("## 硬指标");
  lines.push("");
  document.querySelectorAll("#checks li").forEach(function(li){
    var k = li.querySelector(".k").textContent.trim();
    var n = li.querySelector(".n").innerText.replace(/\n/g, " — ");
    lines.push("- [" + (k === "✓" ? "x" : " ") + "] " + n);
  });
  lines.push("");
  lines.push("## 事实表（文案数字必须命中）");
  lines.push("");
  s.facts.forEach(function(f){ lines.push("- " + f.k + "：" + f.v + "（来源 " + f.src + "）"); });
  lines.push("");
  lines.push("## 字幕");
  lines.push("");
  s.subs.forEach(function(x,i){ lines.push((i+1) + ". " + x + "（" + x.length + " 字）"); });
  lines.push("");
  lines.push("## 原始 brief");
  lines.push("");
  lines.push(s.brief);
  download(new Blob([lines.join("\n")], {type:"text/markdown"}), "审片报告.md");
  toast("审片报告已导出");
}
function trace(){
  if(!TRACE.length) return toast("先运行一次生成");
  var out = { seed: $("#stageSeed").textContent, platform: $("#platform").value, events: TRACE };
  download(new Blob([JSON.stringify(out, null, 2)], {type:"application/json"}), "执行轨迹.json");
  toast("执行轨迹已导出");
}
function download(blob, name){
  var a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 400);
}


var BATCH = [], BATCH_SEL = 0;

function runOne(brief, plat, platKey){
  var rnd = mulberry32(hash(brief + platKey));
  var p = parseBrief(brief), facts = extractFacts(brief);
  var script = makeScript(p, plat, rnd);
  var subs = [], issues = [], pass = false, round = 1, first = [];
  for(round = 1; round <= 3; round++){
    subs = [script.hook, script.claim, script.proof, script.cta];
    issues = review(subs, p, brief, facts, plat);
    var bad = issues.filter(function(i){ return !i.ok; });
    if(round === 1) first = bad.map(function(i){ return i.name; });
    if(bad.length === 0){ pass = true; break; }
    if(round === 3) break;
    ["fact","banned","sub"].forEach(function(kind){
      bad.forEach(function(i){
        if(i.fix !== kind) return;
        if(i.fix === "fact"){
          script.proof = script.proof.replace(/，?实测\s*\d+(?:\.\d+)?\s*(小时|分钟|天|℃|度|次|年)/g, "");
          var briefFlat = brief.replace(/\s/g, "");
          script.proof = script.proof.replace(/\d+(?:\.\d+)?\s*(小时|分钟|天|℃|度|次|年)/g, function(m0){
            return briefFlat.indexOf(m0.replace(/\s/g,"")) >= 0 ? m0 : "";
          });
          script.proof = script.proof.replace(/^[，,、]+/,"").replace(/[，,、]+$/,"");
        }
        if(i.fix === "banned"){
          BANNED.forEach(function(b){
            script.proof = script.proof.replace(new RegExp(b[1].source,"g"), "");
            script.claim = script.claim.replace(new RegExp(b[1].source,"g"), "");
          });
        }
        if(i.fix === "sub"){
          script.hook = clampSub(script.hook, plat.hook);
          script.claim = clampSub(script.claim, plat.sub);
          script.proof = clampSub(script.proof.replace(/，$/,""), plat.sub);
          script.cta = clampSub(script.cta, plat.sub);
        }
      });
    });
  }
  var badN = issues.filter(function(i){ return !i.ok; }).length;
  return { brief:brief, name:p.name, subs:subs, issues:issues, rounds:round, pass:pass, first:first,
           score: Math.max(0, 100 - badN*8 - (round-1)*4), facts:facts };
}

function batch(){
  var key = $("#platform").value, plat = PLAT[key];
  var lines = $("#batch").value.split(/\n+/).map(function(s){ return s.trim(); }).filter(function(s){ return s.length >= 8; });
  if(!lines.length) return toast("先粘 brief，一行一条");
  if(lines.length > 40) lines = lines.slice(0, 40);
  var t0 = now();
  BATCH = lines.map(function(b){ return runOne(b, plat, key); });
  BATCH_SEL = 0;
  BATCH.forEach(function(r){ memAdd({ t: Date.now(), name: r.name, plat: plat.name, score: r.score, rounds: r.rounds, first: r.first }); });
  renderBatch();
  toast("批量审片完成：" + BATCH.length + " 条 · " + Math.round(now()-t0) + " ms");
}

function renderBatch(){
  var okN = BATCH.filter(function(r){ return r.pass; }).length;
  var rows = ["<tr><td>合计</td><td>" + BATCH.length + " 条 · 可投 " + okN + " 条 · 不可投 " + (BATCH.length - okN) + " 条</td></tr>"];
  BATCH.forEach(function(r, k){
    var bad = r.issues.filter(function(i){ return !i.ok; });
    var why;
    if(!r.pass) why = "3 轮未过：" + bad.map(function(i){ return i.name; }).join(" / ");
    else if(r.first.length) why = "首轮 " + r.first.join(" / ") + " → " + r.rounds + " 轮通过";
    else why = "首轮 8 项全过";
    rows.push('<tr data-k="' + k + '" style="cursor:pointer' + (k === BATCH_SEL ? ';background:#FBEFE6' : '') + '">' +
      "<td>" + (k+1) + " · " + esc(r.name) + "</td><td><b>" + r.score + "</b> " + (r.pass ? "可投" : "不可投") + "<br>" + esc(why) + "</td></tr>");
  });
  $("#bTable").innerHTML = rows.join("");
  $("#bTable").querySelectorAll("tr[data-k]").forEach(function(tr){
    tr.onclick = function(){
      BATCH_SEL = +tr.dataset.k;
      $("#brief").value = BATCH[BATCH_SEL].brief;
      renderBatch();
      pipeline().catch(function(e){ toast("运行出错：" + e.message); });
    };
  });
}

function pad2(n){ return (n < 10 ? "0" : "") + n; }
function ts(t){
  var ms = Math.round(t * 1000);
  var h = Math.floor(ms / 3600000); ms -= h * 3600000;
  var m = Math.floor(ms / 60000); ms -= m * 60000;
  var s = Math.floor(ms / 1000); ms -= s * 1000;
  return pad2(h) + ":" + pad2(m) + ":" + pad2(s) + "," + ("00" + ms).slice(-3);
}

function currentRow(){
  if(BATCH.length) return BATCH[Math.min(BATCH_SEL, BATCH.length-1)];
  return null;
}

function exportCsv(){
  if(!BATCH.length) return toast("先跑一次批量审片");
  var head = ["序号","商品","得分","轮次","判定","问题","brief"];
  var out = [head.join(",")];
  BATCH.forEach(function(r, k){
    var bad = r.issues.filter(function(i){ return !i.ok; });
    var why = bad.length ? bad.map(function(i){ return i.name + ":" + i.detail; }).join(" | ") : "8 项全过";
    out.push([k+1, r.name, r.score, r.rounds, r.pass ? "可投" : "不可投", why, r.brief]
      .map(function(v){ return '"' + String(v).replace(/"/g, '""') + '"'; }).join(","));
  });
  download(new Blob(["\ufeff" + out.join("\n")], {type:"text/csv;charset=utf-8"}), "批量审片汇总.csv");
  toast("汇总 CSV 已导出");
}

function exportKit(kind){
  var r = currentRow();
  if(!r) return toast("先跑一次批量审片，或点表格里的一行");
  kind = kind || "txt";
  if(!r.pass) return toast("这条没过审片，交付文件锁定——按 06 的打回理由改 brief 再跑");
  var plat = PLAT[$("#platform").value];
  var txt = ["商品：" + r.name, "平台：" + plat.name, "得分：" + r.score + " · " + r.rounds + " 轮 · " + (r.pass ? "可投" : "不可投"), "",
             "【文案 · 15 秒】"].concat(r.subs.map(function(s, i){ return (i+1) + ". " + s; })).join("\n");
  if(kind === "txt"){ download(new Blob([txt], {type:"text/plain;charset=utf-8"}), "文案.txt"); return toast("文案.txt 已导出"); }

  var t = 0, srt = [];
  r.subs.forEach(function(s, i){
    var d = plat.dur[i] || 4;
    srt.push(String(i+1));
    srt.push(ts(t) + " --> " + ts(t + d));
    srt.push(s);
    srt.push("");
    t += d;
  });
  if(kind === "srt"){ download(new Blob([srt.join("\n")], {type:"text/plain;charset=utf-8"}), "字幕.srt"); return toast("字幕.srt 已导出"); }

  var pic = ["钩子：大字标题 + 产品位", "产品：产品特写/实拍替换", "证据：参数与价格条形", "行动：价格与下手理由"];
  var rows = [["镜号","起止","秒数","画面","字幕"]];
  t = 0;
  r.subs.forEach(function(s, i){
    var d = plat.dur[i] || 4;
    rows.push([i+1, (t.toFixed(1)) + "-" + ((t+d).toFixed(1)) + "s", d, pic[i], s]);
    t += d;
  });
  var csv = rows.map(function(row){ return row.map(function(v){ return '"' + String(v).replace(/"/g,'""') + '"'; }).join(","); }).join("\n");
  if(kind === "sht"){ download(new Blob(["\ufeff" + csv], {type:"text/csv;charset=utf-8"}), "分镜表.csv"); return toast("分镜表.csv 已导出"); }
}

$("#btnRun").onclick = function(){
  pipeline().catch(function(e){ toast("运行出错：" + e.message); });
};
$("#btnPlay").onclick = play;
$("#btnRec").onclick = record;
$("#btnCover").onclick = saveCover;
$("#btnReport").onclick = report;
$("#btnTrace").onclick = trace;
$("#btnBatch").onclick = batch;
$("#btnCsv").onclick = exportCsv;
$("#btnTxt").onclick = function(){ exportKit("txt"); };
$("#btnSrt").onclick = function(){ exportKit("srt"); };
$("#btnSht").onclick = function(){ exportKit("sht"); };
$("#btnMemClear").onclick = memClear;
document.querySelectorAll(".chip").forEach(function(c){
  c.onclick = function(){ $("#brief").value = c.dataset.b; toast("已载入示例 brief"); };
});
$("#phone").onclick = function(){
  var el = $("#phone");
  if(document.fullscreenElement){ document.exitFullscreen(); }
  else if(el.requestFullscreen){ el.requestFullscreen(); }
};
drawIdle();