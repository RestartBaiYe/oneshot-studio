/* OneShot Agent Runtime · 模型层
   三种 provider：
   - openai：任意 OpenAI 兼容端点（fetch /chat/completions，需 baseURL + key）
   - ollama：本机 Ollama（/api/chat，免 key）
   - offline：本地确定性策略（无网络、无 key 时使用；同一输入可复现）
   选择顺序：显式设置 > 自动探测 Ollama > offline。 */
(function (root) {
  var LLM = {
    active: "offline",
    cfg: { base: "", key: "", model: "gpt-4o-mini", temp: 0.3 },
    stats: { calls: 0, promptChars: 0, completionChars: 0, costCny: 0, ms: 0 },
    log: [],

    cancel: function () { if (this.controller) this.controller.abort(); },
    request: async function (url, options) {
      var controller = new AbortController(); this.controller = controller;
      var timer = setTimeout(function(){ controller.abort(); }, 20000);
      try { var response = await fetch(url, Object.assign({}, options || {}, { signal: controller.signal })); var body = await response.text(); return { ok: response.ok, status: response.status, json: async function(){return JSON.parse(body);} }; }
      finally { clearTimeout(timer); if(this.controller === controller) this.controller = null; }
    },
    price: function (model) {
      var m = String(model || "").toLowerCase();
      if (m.indexOf("deepseek") >= 0) return { in: 1.0, out: 2.0 };
      if (m.indexOf("qwen") >= 0) return { in: 2.0, out: 6.0 };
      return { in: 3.5, out: 10.5 };
    },

    setConfig: function (c) {
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
      this.stats.calls++;
      this.stats.ms += ms;
      this.stats.promptChars += pc;
      this.stats.completionChars += (out.text || "").length;
      // 兼容接口的实际计价由服务商账单确定，不根据模型名猜测。
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
            max_tokens: opts.maxTokens || 900, response_format: opts.json ? { type: "json_object" } : undefined
          })
        });
        if (!r.ok) return { text: "", offline: true, error: "HTTP " + r.status };
        var j = await r.json();
        var txt = (((j.choices || [])[0] || {}).message || {}).content || "";
        return { text: txt, offline: false };
      } catch (e) { return { text: "", offline: true, error: String(e) }; }
    },

    ollama: async function (messages, opts) {
      try {
        var r = await this.request(this.cfg.base + "/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: this.cfg.model, messages: messages, stream: false, format: opts.json ? "json" : undefined })
        });
        if (!r.ok) return { text: "", offline: true, error: "HTTP " + r.status };
        var j = await r.json();
        return { text: (j.message || {}).content || "", offline: false };
      } catch (e) { return { text: "", offline: true, error: String(e) }; }
    },

    label: function () {
      if (this.active === "offline") return "离线确定性策略（无模型，可复现）";
      if (this.active === "ollama") return "Ollama · " + this.cfg.model;
      return "OpenAI 兼容 · " + this.cfg.model;
    }
  };
  root.LLM = LLM;
})(window);
