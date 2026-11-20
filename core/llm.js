/* OneShot Agent Runtime · 模型层
   三种 provider：
   - openai：任意 OpenAI 兼容端点（fetch /chat/completions，需 baseURL + key）
   - ollama：本机 Ollama（/api/chat，免 key）
   - offline：本地确定性策略（无网络、无 key 时使用；同一输入可复现）
   选择顺序：显式设置 > 自动探测 Ollama > offline。 */
(function (root) {
  var LLM = {
    active: "offline",
    cfg: { base: "", key: "", model: "gpt-4o-mini", temp: 0.3, callLimit:4, inputRate:null, outputRate:null },
    stats: { calls: 0, promptChars: 0, completionChars: 0, costCny: 0, ms: 0 },
    log: [],

    cancel: function () { if (this.controller) this.controller.abort(); },
    request: async function (url, options) {
      var controller = new AbortController(); this.controller = controller;
      var timer = setTimeout(function(){ controller.abort(); }, 20000);
      try { var response = await fetch(url, Object.assign({}, options || {}, { signal: controller.signal })); var body = await response.text(); return { ok: response.ok, status: response.status, json: async function(){return JSON.parse(body);} }; }
      finally { clearTimeout(timer); if(this.controller === controller) this.controller = null; }
    },
    resetMeter: function(){this.stats={calls:0,promptChars:0,completionChars:0,ms:0,inputTokens:0,outputTokens:0,missingUsage:0,costCny:this.active==='offline'?0:null,callLimit:this.cfg.callLimit};this.log=[];},
    setConfig: function (c) {
      const limit=Number(c.callLimit??4),rate=v=>v===null||v===undefined||v===''?null:Number(v);const inRate=rate(c.inputRate),outRate=rate(c.outputRate);
      if(!Number.isInteger(limit)||limit<1||limit>8||[inRate,outRate].some(v=>v!==null&&(!Number.isFinite(v)||v<0)))throw Error('预算需为 1–8 次，参考单价须为非负数或留空');
      if(c.base){const u=new URL(c.base);if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.search||u.hash)throw Error('只接受不含凭据或查询参数的模型端点');if(u.protocol==='http:'&&!['localhost','127.0.0.1','[::1]'].includes(u.hostname))throw Error('非本机端点必须使用 HTTPS');}
      this.cfg.callLimit=limit;this.cfg.inputRate=inRate;this.cfg.outputRate=outRate;
      this.cfg.base = (c.base || "").replace(/\/+$/, "");
      this.cfg.key = c.key || "";
      this.cfg.model = c.model || this.cfg.model;
      this.active = this.cfg.base ? (this.cfg.base.indexOf("11434") >= 0 ? "ollama" : "openai") : "offline";
      this.save();
      return this.active;
    },

    save: function () {
      try { var safe = Object.assign({}, this.cfg); delete safe.key; localStorage.setItem("oneshot.llm", JSON.stringify(safe)); } catch (e) {}
    },

    load: function () {
      try {
        var c = JSON.parse(localStorage.getItem("oneshot.llm") || "null");
        if (c && c.base) this.setConfig(c);
      } catch (e) {}
      return this.active;
    },

    probeOllama: async function () {
      try {
        var r = await this.request("http://127.0.0.1:11434/api/tags", { method: "GET" });
        if (!r.ok) return false;
        var j = await r.json();
        var names = (j.models || []).map(function (m) { return m.name; });
        if (!names.length) return false;
        this.active = "ollama";
        this.cfg.base = "http://127.0.0.1:11434";
        this.cfg.model = names[0];
        this.badge = "Ollama · " + names[0];
        return true;
      } catch (e) { return false; }
    },

    chat: async function (messages, opts) {
      opts = opts || {};
      if(this.active==="offline")return {text:"",offline:true,error:"未配置模型"};
      if(this.stats.calls>=this.cfg.callLimit)return {text:"",offline:true,error:"达到本次模型请求预算（"+this.cfg.callLimit+" 次）；未发出额外请求"};
      if(messages.reduce((n,m)=>n+String(m.content||"").length,0)>24000)return {text:"",offline:true,error:"模型输入超出 24000 字符限制"};
      this.stats.calls++;
      var t0 = performance.now();
      var out = null;
      if (this.active === "ollama") out = await this.ollama(messages, opts);
      else if (this.active === "openai") out = await this.openai(messages, opts);
      else out = null;
      if (out === null) {
        out = { text: "", offline: true };
        out.error = "未配置模型";
      }
      var ms = Math.round(performance.now() - t0);
      var pc = messages.map(function (m) { return m.content || ""; }).join("").length;
      this.stats.ms += ms;
      this.stats.promptChars += pc;
      this.stats.completionChars += (out.text || "").length;
      const u=out.usage;if(u&&Number.isSafeInteger(u.input)&&u.input>=0&&Number.isSafeInteger(u.output)&&u.output>=0){this.stats.inputTokens+=u.input;this.stats.outputTokens+=u.output;}else this.stats.missingUsage++;
      this.stats.costCny=this.stats.missingUsage||this.cfg.inputRate==null||this.cfg.outputRate==null?null:(this.stats.inputTokens*this.cfg.inputRate+this.stats.outputTokens*this.cfg.outputRate)/1e6;
      this.log.push({ at: Date.now(), provider: this.active, model: this.cfg.model, ms: ms, chars: pc, offline: !!out.offline });
      return out;
    },

    openai: async function (messages, opts) {
      try {
        var r = await this.request(this.cfg.base + "/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + this.cfg.key },
          body: JSON.stringify({
            model: this.cfg.model, messages: messages, temperature: opts.temp != null ? opts.temp : this.cfg.temp,
            max_tokens: Math.min(opts.maxTokens || 900,900), response_format: opts.json ? { type: "json_object" } : undefined
          })
        });
        if (!r.ok) return { text: "", offline: true, error: "HTTP " + r.status };
        var j = await r.json();
        var txt = (((j.choices || [])[0] || {}).message || {}).content || "";
        return { text: txt, offline:false, usage:{input:j.usage?.prompt_tokens,output:j.usage?.completion_tokens} };
      } catch (e) { return { text: "", offline: true, error: String(e) }; }
    },

    ollama: async function (messages, opts) {
      try {
        var r = await this.request(this.cfg.base + "/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: this.cfg.model, messages: messages, stream: false, options:{num_predict:Math.min(opts.maxTokens||900,900)}, format: opts.json ? "json" : undefined })
        });
        if (!r.ok) return { text: "", offline: true, error: "HTTP " + r.status };
        var j = await r.json();
        return { text: (j.message || {}).content || "", offline: false,usage:{input:j.prompt_eval_count,output:j.eval_count} };
      } catch (e) { return { text: "", offline: true, error: String(e) }; }
    },

    label: function () {
      if (this.active === "offline") return "离线确定性策略（无模型，可复现）";
      if (this.active === "ollama") return "Ollama · " + this.cfg.model;
      return "OpenAI 兼容 · " + this.cfg.model;
    }
  };
  LLM.resetMeter();root.LLM = LLM;
})(window);
