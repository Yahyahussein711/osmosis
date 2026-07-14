/* ============================================================
   Osmosis — Import from a link.
   Fetches any article URL, cleans it to readable text, and fills
   the Create form so it becomes a fully markable story. Also
   handles ?url=/?text= (PWA share target / iOS Shortcut).
   ------------------------------------------------------------
   A static site can't fetch arbitrary pages (CORS), so we use
   Jina Reader (r.jina.ai) — a CORS-friendly readability service.
   If it fails, the user pastes the text into the body (always works).
   ============================================================ */
(function () {
  "use strict";

  function $(id) {
    return document.getElementById(id);
  }
  function toast(m) {
    if (typeof window.showToast === "function") window.showToast(m);
  }
  function setHint(msg, isErr) {
    var el = $("importHint");
    if (!el) return;
    el.textContent = msg;
    el.classList.toggle("import-err", !!isErr);
  }
  function setBusy(on) {
    var btn = $("importUrlBtn");
    if (btn) {
      btn.disabled = on;
      btn.textContent = on ? "Importing…" : "Import";
    }
    var box = $("importUrl");
    if (box) box.disabled = on;
  }

  function normalizeUrl(u) {
    u = (u || "").trim();
    if (!u) return "";
    if (!/^https?:\/\//i.test(u)) {
      // bare domain like "example.com/foo" → assume https
      if (!/\s/.test(u) && /\.[a-z]{2,}/i.test(u)) u = "https://" + u;
    }
    return u;
  }

  // Parse Jina Reader's response: a header block then "Markdown Content:".
  function parseReader(text, url) {
    var title = "";
    var tm = text.match(/^Title:\s*(.+)$/m);
    if (tm) title = tm[1].trim();
    var body = text;
    var marker = "Markdown Content:";
    var i = text.indexOf(marker);
    if (i >= 0) body = text.slice(i + marker.length).trim();
    // drop a leading duplicate H1 that just repeats the title
    body = body.replace(/^#\s+.*\n+/, function (m) {
      return title && m.toLowerCase().indexOf(title.toLowerCase()) >= 0 ? "" : m;
    });
    // hook = first real paragraph
    var hook = "";
    var paras = body.split(/\n{2,}/);
    for (var p = 0; p < paras.length; p++) {
      var s = paras[p].trim();
      if (!s) continue;
      if (s[0] === "#" || s[0] === "!" || s[0] === "[" || s[0] === ">") continue;
      hook = s.replace(/[#*_`>\[\]]/g, "").replace(/\s+/g, " ").trim();
      break;
    }
    if (hook.length > 160) hook = hook.slice(0, 157) + "…";
    if (!title) {
      try {
        title = new URL(url).hostname.replace(/^www\./, "");
      } catch (e) {
        title = "Imported article";
      }
    }
    return { title: title, hook: hook, content: body, url: url };
  }

  function fillForm(a) {
    var setVal = function (id, v) {
      var el = $(id);
      if (el) el.value = v == null ? "" : v;
    };
    setVal("genTitle", (a.title || "").slice(0, 200));
    setVal("genHook", a.hook || "");
    var content = a.content || "";
    // keep the source at the foot so you always know where it came from
    if (a.url) content += "\n\n— Source: " + a.url;
    if (content.length > 50000) content = content.slice(0, 49980) + "\n\n…";
    setVal("genContent", content);
    if (typeof window.updateGenContentCount === "function") {
      try {
        window.updateGenContentCount();
      } catch (e) {}
    }
    var c = $("genContent");
    if (c) c.dispatchEvent(new Event("input", { bubbles: true }));
    var t = $("genTitle");
    if (t) t.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function importUrl(rawUrl) {
    var url = normalizeUrl(rawUrl);
    if (!/^https?:\/\//i.test(url)) {
      setHint("Enter a valid link (https://…).", true);
      return;
    }
    setBusy(true);
    setHint("Fetching & cleaning the article…");
    // Jina Reader returns clean markdown of the page, CORS-enabled.
    fetch("https://r.jina.ai/" + url, {
      headers: { Accept: "text/plain", "X-Return-Format": "markdown" },
    })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.text();
      })
      .then(function (text) {
        if (!text || text.trim().length < 40) throw new Error("empty");
        var article = parseReader(text, url);
        fillForm(article);
        setHint("Imported — review the fields below, then Save Story.");
        toast("Article imported ✓");
      })
      .catch(function (e) {
        console.warn("import failed", e);
        setHint(
          "Couldn't fetch that link (it may block readers, or you're offline). Open the page, copy the text, and paste it into the body below.",
          true,
        );
      })
      .finally(function () {
        setBusy(false);
      });
  }
  window.osmosisImportUrl = importUrl;

  // ---- shared link (?url= / ?text=) → import automatically ----------
  function handleShared() {
    var url = "";
    try {
      var p = new URLSearchParams(location.search);
      url = p.get("url") || "";
      var txt = p.get("text") || "";
      if (!url && txt) {
        var m = txt.match(/https?:\/\/\S+/);
        if (m) url = m[0];
      }
    } catch (e) {}
    if (!url) return;
    // Clear the query so a refresh doesn't re-import.
    try {
      history.replaceState(null, "", location.pathname);
    } catch (e) {}
    var nav = $("navGenerator");
    if (nav) nav.click();
    setTimeout(function () {
      var box = $("importUrl");
      if (box) box.value = url;
      importUrl(url);
    }, 450);
  }

  function wire() {
    var btn = $("importUrlBtn");
    if (btn)
      btn.addEventListener("click", function () {
        importUrl(($("importUrl") || {}).value || "");
      });
    var box = $("importUrl");
    if (box)
      box.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          importUrl(box.value);
        }
      });
    handleShared();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wire);
  } else {
    wire();
  }
})();
