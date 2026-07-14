/* ============================================================
   Osmosis — Import from a link.
   Fetches any article URL, cleans it to readable text, and fills
   the Create form so it becomes a fully markable story. Also
   handles ?url=/?text= (PWA share target / iOS Shortcut).
   ------------------------------------------------------------
   Coverage: tries Jina Reader (clean markdown, CORS-friendly);
   if that can't read the site, falls back to fetching the raw
   HTML through a CORS proxy and extracting the main article
   heuristically. Both paths run through a "tidy" cleaner that
   strips images, unwraps links, and drops nav/boilerplate.
   If everything fails, the user pastes the text (always works).
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
      if (!/\s/.test(u) && /\.[a-z]{2,}/i.test(u)) u = "https://" + u;
    }
    return u;
  }

  function fetchText(url, opts) {
    opts = opts || {};
    var ctrl =
      typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = ctrl
      ? setTimeout(function () {
          ctrl.abort();
        }, opts.timeout || 20000)
      : null;
    return fetch(url, {
      headers: opts.headers || {},
      signal: ctrl ? ctrl.signal : undefined,
    })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.text();
      })
      .finally(function () {
        if (timer) clearTimeout(timer);
      });
  }

  // ---- cleaning ----------------------------------------------------
  var JUNK =
    /(subscribe|sign\s?up|newsletter|advertisement|sponsored|cookie|accept all|related\s+(stories|articles|posts|reading)|read more|share (this|on)|follow us|most popular|trending now|©|all rights reserved|terms of (service|use)|privacy policy|back to top|skip to (content|main)|^menu$|log\s?in|sign\s?in|create an account|comments? \(\d|view comments|leave a (comment|reply)|watch:|listen:|image:|photograph:|getty images|reuters|associated press)/i;

  function tidy(md) {
    if (!md) return "";
    var t = md.replace(/\r\n?/g, "\n");
    // markdown images → gone
    t = t.replace(/!\[[^\]]*\]\([^)]*\)/g, "");
    // reference definitions:  [1]: http://…
    t = t.replace(/^\s*\[[^\]]+\]:\s*\S+.*$/gm, "");
    // inline links [text](url) → text
    t = t.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
    // bare autolinks <http…>
    t = t.replace(/<https?:\/\/[^>\s]+>/g, "");
    // lines that are only a URL
    t = t.replace(/^\s*https?:\/\/\S+\s*$/gm, "");
    // stray markdown image/link leftovers like empty [] ()
    t = t.replace(/\[\s*\]\(\s*\)/g, "");
    // drop short boilerplate / navigation lines
    t = t
      .split("\n")
      .filter(function (line) {
        var s = line.trim();
        if (!s) return true;
        if (s.length < 80 && JUNK.test(s)) return false;
        // lines that are mostly symbols / separators of navigation dots
        if (/^[\s•·|>—–-]{0,4}$/.test(s)) return true; // keep simple rules
        return true;
      })
      .join("\n");
    // collapse runs of blank lines
    t = t.replace(/\n{3,}/g, "\n\n");
    return t.trim();
  }

  function makeHook(content) {
    var paras = (content || "").split(/\n{2,}/);
    for (var i = 0; i < paras.length; i++) {
      var s = paras[i].trim();
      if (!s) continue;
      if (s[0] === "#" || s[0] === "!" || s[0] === "[" || s[0] === ">")
        continue;
      s = s
        .replace(/[#*_`>\[\]]/g, "")
        .replace(/\s+/g, " ")
        .trim();
      if (s.length < 15) continue;
      return s.length > 160 ? s.slice(0, 157) + "…" : s;
    }
    return "";
  }

  // ---- source 1: Jina Reader (clean markdown) ----------------------
  function parseReader(text, url) {
    var title = "";
    var tm = text.match(/^Title:\s*(.+)$/m);
    if (tm) title = tm[1].trim();
    var body = text;
    var marker = "Markdown Content:";
    var i = text.indexOf(marker);
    if (i >= 0) body = text.slice(i + marker.length);
    body = tidy(body);
    // drop a leading H1 that just repeats the title
    body = body.replace(/^#\s+(.*)\n+/, function (m, h1) {
      return title && h1.trim().toLowerCase() === title.toLowerCase() ? "" : m;
    });
    if (!title) title = titleFromUrl(url);
    return { title: title, hook: makeHook(body), content: body, url: url };
  }

  function importViaReader(url) {
    return fetchText("https://r.jina.ai/" + url, {
      headers: { Accept: "text/plain", "X-Return-Format": "markdown" },
      timeout: 22000,
    }).then(function (text) {
      return parseReader(text || "", url);
    });
  }

  // ---- source 2: raw HTML via proxy + heuristic extraction ---------
  function titleFromUrl(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch (e) {
      return "Imported article";
    }
  }
  function extractFromHtml(html, url) {
    var doc = new DOMParser().parseFromString(html, "text/html");
    doc
      .querySelectorAll(
        "script,style,noscript,nav,header,footer,aside,form,iframe,svg,button,figure,figcaption,[role=navigation],[role=banner],[role=complementary],[aria-hidden=true],.ad,.ads,.advert,.share,.social,.newsletter,.related,.comments,.comment,.nav,.menu,.sidebar,.promo,.subscribe",
      )
      .forEach(function (n) {
        try {
          n.remove();
        } catch (e) {}
      });
    var title =
      (doc.querySelector("meta[property='og:title']") || {}).content ||
      (doc.querySelector("title") || {}).textContent ||
      "";
    function score(el) {
      var len = 0;
      el.querySelectorAll("p").forEach(function (p) {
        len += (p.textContent || "").trim().length;
      });
      return len;
    }
    var cands = doc.querySelectorAll(
      "article, main, [role=main], .post, .article, .entry-content, .post-content, .article-content, .article-body, #content, .content, .story-body",
    );
    var best = null,
      bestScore = 0;
    (cands.length ? cands : [doc.body]).forEach(function (el) {
      var s = score(el);
      if (s > bestScore) {
        bestScore = s;
        best = el;
      }
    });
    if (!best || (bestScore < 400 && score(doc.body) > bestScore))
      best = doc.body;
    return { title: (title || "").trim(), node: best };
  }
  function nodeToText(root) {
    if (!root) return "";
    var out = [];
    root
      .querySelectorAll("h1,h2,h3,h4,p,li,blockquote,pre")
      .forEach(function (el) {
        var t = (el.textContent || "").replace(/\s+/g, " ").trim();
        if (!t) return;
        var tag = el.tagName.toLowerCase();
        if (tag[0] === "h") out.push("## " + t);
        else if (tag === "li") out.push("- " + t);
        else if (tag === "blockquote") out.push("> " + t);
        else out.push(t);
      });
    return out.join("\n\n");
  }
  function importViaProxy(url) {
    return fetchText(
      "https://api.allorigins.win/raw?url=" + encodeURIComponent(url),
      { timeout: 22000 },
    ).then(function (html) {
      var ex = extractFromHtml(html || "", url);
      var content = tidy(nodeToText(ex.node));
      var title = ex.title || titleFromUrl(url);
      return { title: title, hook: makeHook(content), content: content, url: url };
    });
  }

  // ---- fill the Create form ----------------------------------------
  function fillForm(a) {
    var setVal = function (id, v) {
      var el = $(id);
      if (el) el.value = v == null ? "" : v;
    };
    setVal("genTitle", (a.title || "").slice(0, 200));
    setVal("genHook", a.hook || "");
    var content = a.content || "";
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
    var len = function (a) {
      return a && a.content ? a.content.length : 0;
    };
    importViaReader(url)
      .catch(function () {
        return null;
      })
      .then(function (a) {
        // Good enough already? Use it. Otherwise try the other source and
        // keep whichever pulled more real text.
        if (len(a) >= 400) return a;
        setHint("Reading the page more thoroughly…");
        return importViaProxy(url)
          .then(function (b) {
            if (!a) return b;
            return len(b) > len(a) ? b : a;
          })
          .catch(function () {
            return a;
          });
      })
      .then(function (best) {
        if (len(best) < 40) throw new Error("empty");
        fillForm(best);
        setHint(
          "Imported — review the fields below, then Save Story. Still messy? Tap “Tidy the text”.",
        );
        toast("Article imported ✓");
      })
      .catch(function (e) {
        console.warn("import failed", e);
        setHint(
          "Couldn't read that link (it may block readers, need a login, or be JavaScript-only). Open the page, copy the article text, paste it into the body below, then tap “Tidy the text”.",
          true,
        );
      })
      .finally(function () {
        setBusy(false);
      });
  }
  window.osmosisImportUrl = importUrl;

  // Clean whatever is currently in the body (imported OR pasted by hand).
  function tidyBody() {
    var c = $("genContent");
    if (!c) return;
    var val = c.value || "";
    if (!val.trim()) {
      setHint("Nothing to tidy yet — import a link or paste some text first.");
      return;
    }
    // preserve a trailing source line
    var src = "";
    var m = val.match(/\n+—\s*Source:\s*\S+\s*$/);
    if (m) {
      src = m[0];
      val = val.slice(0, m.index);
    }
    c.value = tidy(val) + src;
    c.dispatchEvent(new Event("input", { bubbles: true }));
    setHint("Tidied ✓ — review and Save Story.");
    toast("Text tidied ✓");
  }
  window.osmosisTidyBody = tidyBody;

  // ---- shared link (?url= / ?text=) → import automatically ----------
  function handleShared() {
    var url = "";
    try {
      var p = new URLSearchParams(location.search);
      url = p.get("url") || "";
      var txt = p.get("text") || "";
      if (!url && txt) {
        var mm = txt.match(/https?:\/\/\S+/);
        if (mm) url = mm[0];
      }
    } catch (e) {}
    if (!url) return;
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
    var tb = $("tidyBtn");
    if (tb) tb.addEventListener("click", tidyBody);
    handleShared();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wire);
  } else {
    wire();
  }
})();
