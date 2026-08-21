/* ============================================================
   Osmosis — Book Reader (Apple-Books-style paginated reader)
   Phase 1: paginated surface, running head + folio, tap chrome,
   swipe / tap / keyboard page turns, position persistence,
   re-paginate + re-anchor on resize and font load.
   Themes & Settings, Customise, and the ☰ menu arrive next.
   Self-contained: injects its own styles and overlay.
   ============================================================ */
(function () {
  "use strict";

  // ---- state -------------------------------------------------
  var W = 0, H = 0, GAP = 0, U = 0; // U = W + GAP
  var page = 0, pageCount = 1;
  var snPage = {};      // sentence index -> page
  var anchor = 0;       // current sentence index (survives re-layout)
  var storeKey = "";
  var animating = false;
  var chromeShown = false;
  var built = false;
  var sentences = [];   // flat [{text}]
  var EASE = "cubic-bezier(.32,.72,.28,1)";
  var REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var el = {}; // dom refs

  // ---- storage (try/catch, in-memory fallback) ---------------
  var mem = {};
  function lsGet(k) {
    try { var v = localStorage.getItem(k); return v === null ? mem[k] : v; }
    catch (e) { return mem[k]; }
  }
  function lsSet(k, v) {
    mem[k] = v;
    try { localStorage.setItem(k, v); } catch (e) {}
  }

  // ---- styles ------------------------------------------------
  function injectStyles() {
    if (document.getElementById("bookReaderStyles")) return;
    var css = `
    #bookReader{position:fixed;inset:0;z-index:5000;display:none;
      background:var(--br-paper,#f7f3ea);color:var(--br-ink,#22201b);
      font-family:var(--br-font,"Lora",Georgia,serif);
      -webkit-user-select:none;user-select:none;-webkit-touch-callout:none;}
    #bookReader.on{display:block;}
    /* running head + folio, always visible */
    .br-runhead{position:absolute;top:0;left:0;right:0;height:var(--br-mtop,58px);
      display:flex;align-items:center;justify-content:center;
      font-size:.82rem;color:var(--br-faint,#9a9384);letter-spacing:.2px;
      text-align:center;padding:0 54px;pointer-events:none;z-index:2;}
    .br-runhead span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;}
    .br-folio{position:absolute;bottom:0;left:0;right:0;height:var(--br-mbot,46px);
      display:flex;align-items:center;justify-content:center;
      font-size:.8rem;color:var(--br-faint,#9a9384);pointer-events:none;z-index:2;
      font-variant-numeric:tabular-nums;}
    /* the paged text window */
    .br-stage{position:absolute;top:var(--br-mtop,58px);bottom:var(--br-mbot,46px);
      left:var(--br-mside,30px);right:var(--br-mside,30px);overflow:hidden;
      touch-action:none;z-index:1;}
    .br-flow{position:relative;width:100%;column-fill:auto;
      font-size:var(--br-fs,1.22rem);line-height:var(--br-lh,1.6);
      will-change:transform;}
    .br-flow p{margin:0 0 .9em;text-align:justify;-webkit-hyphens:auto;hyphens:auto;orphans:2;widows:2;}
    .br-flow p.br-first{text-indent:0;}
    .br-flow p+p{text-indent:1.3em;}
    .br-flow h2.br-ch{font-size:1.4em;font-weight:600;line-height:1.2;
      text-align:center;margin:0 0 1em;break-after:avoid;}
    .br-flow .sn{}
    /* chrome bars (tap to toggle) */
    .br-bar{position:absolute;left:0;right:0;z-index:6;display:flex;align-items:center;
      padding:0 12px;background:color-mix(in srgb,var(--br-paper,#f7f3ea) 88%,transparent);
      backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);
      transition:transform .28s ease,opacity .28s ease;font-family:"Outfit",system-ui,sans-serif;}
    .br-top{top:0;height:calc(var(--br-mtop,58px) + env(safe-area-inset-top,0px));
      padding-top:env(safe-area-inset-top,0px);justify-content:center;}
    .br-bot{bottom:0;height:calc(56px + env(safe-area-inset-bottom,0px));
      padding-bottom:env(safe-area-inset-bottom,0px);justify-content:center;}
    #bookReader:not(.chrome) .br-top{transform:translateY(-100%);opacity:0;pointer-events:none;}
    #bookReader:not(.chrome) .br-bot{transform:translateY(100%);opacity:0;pointer-events:none;}
    .br-chaplbl{font-size:.82rem;color:var(--br-faint,#9a9384);}
    .br-progress{font-size:.8rem;color:var(--br-faint,#9a9384);font-variant-numeric:tabular-nums;}
    .br-round{position:absolute;width:38px;height:38px;border-radius:50%;border:none;cursor:pointer;
      display:flex;align-items:center;justify-content:center;
      background:color-mix(in srgb,var(--br-ink,#22201b) 8%,transparent);
      color:var(--br-ink,#22201b);box-shadow:none;padding:0;}
    .br-round:active{background:color-mix(in srgb,var(--br-ink,#22201b) 16%,transparent);}
    .br-close{right:14px;top:calc(env(safe-area-inset-top,0px) + 50%);transform:translateY(-50%);}
    .br-menu{right:14px;top:50%;transform:translateY(-50%);}
    `;
    var s = document.createElement("style");
    s.id = "bookReaderStyles";
    s.textContent = css;
    document.head.appendChild(s);
  }

  // ---- build overlay DOM once --------------------------------
  function buildDOM() {
    if (built) return;
    injectStyles();
    var r = document.createElement("div");
    r.id = "bookReader";
    r.innerHTML =
      '<div class="br-runhead"><span id="brRunhead"></span></div>' +
      '<div class="br-stage" id="brStage"><div class="br-flow" id="brFlow"></div></div>' +
      '<div class="br-folio" id="brFolio"></div>' +
      '<div class="br-bar br-top">' +
      '  <span class="br-chaplbl" id="brChapLbl"></span>' +
      '  <button class="br-round br-close" id="brClose" aria-label="Close">' +
      '    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>' +
      '  </button>' +
      '</div>' +
      '<div class="br-bar br-bot">' +
      '  <span class="br-progress" id="brProgress"></span>' +
      '  <button class="br-round br-menu" id="brMenu" aria-label="Menu">' +
      '    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="4" y1="7" x2="20" y2="7"></line><line x1="4" y1="12" x2="20" y2="12"></line><line x1="4" y1="17" x2="20" y2="17"></line></svg>' +
      '  </button>' +
      '</div>';
    document.body.appendChild(r);
    el.reader = r;
    el.stage = r.querySelector("#brStage");
    el.flow = r.querySelector("#brFlow");
    el.runhead = r.querySelector("#brRunhead");
    el.folio = r.querySelector("#brFolio");
    el.chapLbl = r.querySelector("#brChapLbl");
    el.progress = r.querySelector("#brProgress");

    r.querySelector("#brClose").addEventListener("click", function (e) {
      e.stopPropagation();
      close();
    });
    r.querySelector("#brMenu").addEventListener("click", function (e) {
      e.stopPropagation();
      if (typeof showToast === "function") showToast("Menu — coming next");
    });

    wireGestures();
    window.addEventListener("resize", onResize);
    window.addEventListener("keydown", onKey);
    if (document.fonts && document.fonts.ready)
      document.fonts.ready.then(function () {
        if (el.reader.classList.contains("on")) relayout();
      });
    built = true;
  }

  // ---- content: split into sentences, wrap in spans ----------
  function escapeHtml(s) {
    return (s == null ? "" : String(s))
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function inlineMd(s) {
    return escapeHtml(s)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>");
  }
  function splitSentences(p) {
    var m = p.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g);
    return m || [p];
  }
  function buildFlow(title, content) {
    sentences = [];
    var paras = String(content || "")
      .split(/\r?\n\s*\r?\n/)
      .map(function (p) { return p.trim(); })
      .filter(Boolean);
    // drop a leading markdown title/divider that duplicates the title
    if (paras.length && paras[0].indexOf("# ") === 0) {
      paras.shift();
      if (paras.length && paras[0] === "---") paras.shift();
    }
    var html = '<h2 class="br-ch">' + escapeHtml(title || "") + "</h2>";
    var firstP = true;
    paras.forEach(function (para) {
      if (para === "---") { html += '<hr class="br-rule">'; return; }
      if (para.indexOf("## ") === 0) { html += "<h3>" + inlineMd(para.slice(3)) + "</h3>"; return; }
      if (para.indexOf("# ") === 0) { html += '<h2 class="br-ch">' + inlineMd(para.slice(2)) + "</h2>"; return; }
      var cls = firstP ? " class=\"br-first\"" : "";
      firstP = false;
      html += "<p" + cls + ">";
      splitSentences(para).forEach(function (s) {
        var i = sentences.length;
        sentences.push({ text: s.trim() });
        html += '<span class="sn" data-i="' + i + '">' + inlineMd(s) + "</span>";
      });
      html += "</p>";
    });
    el.flow.innerHTML = html;
  }

  // ---- pagination + maps -------------------------------------
  function measure() {
    W = el.stage.clientWidth;
    H = el.stage.clientHeight;
    GAP = Math.max(44, W * 0.16);
    U = W + GAP;
    el.flow.style.height = H + "px";
    el.flow.style.columnWidth = W + "px";
    el.flow.style.columnGap = GAP + "px";
  }
  function buildMaps() {
    pageCount = Math.max(1, Math.round((el.flow.scrollWidth + GAP) / U));
    var sns = el.flow.querySelectorAll(".sn");
    var reads = [];
    for (var k = 0; k < sns.length; k++)
      reads.push([+sns[k].dataset.i, sns[k].offsetLeft]);
    snPage = {};
    reads.forEach(function (pair) {
      snPage[pair[0]] = Math.floor((pair[1] + 2) / U);
    });
  }
  function place(pg, animate) {
    el.flow.style.transition = animate
      ? "transform " + (REDUCED ? 1 : 360) + "ms " + EASE
      : "none";
    el.flow.style.transform = "translate3d(" + -pg * U + "px,0,0)";
  }

  function relayout() {
    measure();
    buildMaps();
    page = clamp(snPage[anchor] != null ? snPage[anchor] : 0, 0, pageCount - 1);
    place(page, false);
    updateMeta();
  }

  function firstSentenceOfPage(pg) {
    var best = null;
    for (var k in snPage) {
      if (snPage[k] === pg) { var i = +k; if (best === null || i < best) best = i; }
    }
    return best == null ? anchor : best;
  }

  function updateMeta() {
    var left = pageCount - page - 1;
    el.chapLbl.textContent =
      left <= 0 ? "Last page" : left + (left === 1 ? " page left" : " pages left");
    el.progress.textContent = "Page " + (page + 1) + " of " + pageCount;
    el.folio.textContent = String(page + 1);
    if (storeKey) lsSet(storeKey, String(anchor));
  }

  // ---- page turns --------------------------------------------
  function go(dir) {
    if (animating) return;
    var target = page + dir;
    if (target < 0 || target > pageCount - 1) return;
    animating = true;
    page = target;
    anchor = firstSentenceOfPage(page);
    place(page, true);
    updateMeta();
    setTimeout(function () { animating = false; }, (REDUCED ? 1 : 360) + 20);
  }

  // ---- gestures ----------------------------------------------
  function wireGestures() {
    var g = null;
    el.stage.addEventListener("pointerdown", function (e) {
      if (animating) return;
      el.stage.setPointerCapture(e.pointerId);
      g = { id: e.pointerId, x0: e.clientX, y0: e.clientY, axis: null,
            t0: performance.now(), moved: false, dragging: false };
      el.flow.style.transition = "none";
    });
    el.stage.addEventListener("pointermove", function (e) {
      if (!g || e.pointerId !== g.id) return;
      var dx = e.clientX - g.x0, dy = e.clientY - g.y0;
      if (Math.hypot(dx, dy) > 8) g.moved = true;
      if (!g.axis && Math.hypot(dx, dy) > 10) {
        g.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
        if (g.axis === "x") {
          // refuse at the ends
          if ((dx < 0 && page >= pageCount - 1) || (dx > 0 && page <= 0)) g.axis = "refuse";
          else g.dragging = true;
        }
      }
      if (g.dragging) {
        el.flow.style.transform =
          "translate3d(" + (-page * U + dx) + "px,0,0)";
      }
    });
    function end(e) {
      if (!g || e.pointerId !== g.id) return;
      var dx = e.clientX - g.x0, dy = e.clientY - g.y0;
      var dt = performance.now() - g.t0;
      if (g.dragging) {
        var frac = -dx / W;
        var v = dx / dt; // px/ms
        if (frac > 0.28 || v < -0.5) go(1);
        else if (frac < -0.28 || v > 0.5) go(-1);
        else place(page, true);
      } else if (!g.moved && dt < 500) {
        // tap zones
        var x = e.clientX;
        var w = el.stage.clientWidth;
        if (x < w * 0.26) go(-1);
        else if (x > w * 0.74) go(1);
        else toggleChrome();
      }
      g = null;
    }
    el.stage.addEventListener("pointerup", end);
    el.stage.addEventListener("pointercancel", function (e) {
      if (g && g.dragging) place(page, true);
      g = null;
    });
  }

  function onKey(e) {
    if (!el.reader.classList.contains("on")) return;
    if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") { e.preventDefault(); go(1); }
    else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); go(-1); }
    else if (e.key === "Escape") close();
  }

  var resizeT = null;
  function onResize() {
    if (!el.reader.classList.contains("on")) return;
    clearTimeout(resizeT);
    resizeT = setTimeout(relayout, 180);
  }

  function toggleChrome() {
    chromeShown = !chromeShown;
    el.reader.classList.toggle("chrome", chromeShown);
  }

  // ---- open / close ------------------------------------------
  function open(article, title, key) {
    buildDOM();
    storeKey = key ? "osmosis_reader_anchor_" + key : "";
    var saved = storeKey ? parseInt(lsGet(storeKey), 10) : NaN;
    anchor = isNaN(saved) ? 0 : saved;
    el.runhead.textContent = title || "";
    buildFlow(title, article && article.content);
    el.reader.classList.add("on");
    chromeShown = false;
    el.reader.classList.remove("chrome");
    // paginate after the browser has laid the flow out
    requestAnimationFrame(function () {
      requestAnimationFrame(relayout);
    });
  }

  function close() {
    el.reader.classList.remove("on");
    // unwind the underlying navigation via the existing Back button
    var back = document.getElementById("backToPrevious");
    if (back) back.click();
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  // ---- public ------------------------------------------------
  window.OsmosisReader = { open: open, close: close, relayout: relayout };
})();
