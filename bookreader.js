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
    /* vertically centred within each bar via top/bottom + margin auto */
    .br-close{right:14px;top:env(safe-area-inset-top,0px);bottom:0;margin:auto 0;}
    .br-menu{right:14px;top:0;bottom:calc(env(safe-area-inset-bottom,0px) + 14px);margin:auto 0;}
    /* ---- menu popover + sheets (Phase 3) ---- */
    .br-scrim{position:absolute;inset:0;z-index:9;background:rgba(20,16,10,.28);
      opacity:0;pointer-events:none;transition:opacity .22s ease;}
    .br-scrim.on{opacity:1;pointer-events:auto;}
    .br-pop{position:absolute;right:12px;z-index:11;width:min(320px,86vw);
      bottom:calc(64px + env(safe-area-inset-bottom,0px));
      background:var(--br-paper,#f7f3ea);border-radius:16px;
      box-shadow:0 12px 40px rgba(20,16,10,.32);overflow:hidden;
      transform:translateY(10px) scale(.98);opacity:0;pointer-events:none;
      transform-origin:bottom right;transition:opacity .2s ease,transform .2s ease;
      font-family:"Outfit",system-ui,sans-serif;}
    .br-pop.on{opacity:1;transform:none;pointer-events:auto;}
    .br-pop-row{display:flex;align-items:center;gap:12px;width:100%;text-align:left;
      background:none;border:none;box-shadow:none;cursor:pointer;padding:14px 16px;
      font-size:.95rem;color:var(--br-ink,#22201b);border-bottom:1px solid color-mix(in srgb,var(--br-ink,#22201b) 8%,transparent);}
    .br-pop-row:active{background:color-mix(in srgb,var(--br-ink,#22201b) 6%,transparent);}
    .br-pop-row .br-pl{flex:1;}
    .br-pop-row .br-pr{color:var(--br-faint,#9a9384);font-size:.85rem;display:flex;align-items:center;gap:6px;}
    .br-pop-row svg{flex-shrink:0;opacity:.85;}
    .br-pop-icons{display:flex;justify-content:space-around;align-items:center;padding:10px 8px;}
    .br-pop-ico{width:42px;height:42px;border-radius:50%;border:none;cursor:pointer;box-shadow:none;
      display:flex;align-items:center;justify-content:center;
      background:color-mix(in srgb,var(--br-ink,#22201b) 7%,transparent);color:var(--br-ink,#22201b);}
    .br-pop-ico.on{background:var(--br-accent,#9e4632);color:#fff;}
    .br-pop-ico:active{background:color-mix(in srgb,var(--br-ink,#22201b) 16%,transparent);}
    .br-sheet{position:absolute;left:0;right:0;bottom:0;z-index:12;max-height:86%;
      display:flex;flex-direction:column;background:var(--br-paper,#f7f3ea);
      border-radius:18px 18px 0 0;box-shadow:0 -10px 40px rgba(20,16,10,.3);
      transform:translateY(101%);transition:transform .28s cubic-bezier(.22,1,.36,1);
      font-family:"Outfit",system-ui,sans-serif;padding-bottom:env(safe-area-inset-bottom,0px);}
    .br-sheet.on{transform:none;}
    .br-sheet-head{display:flex;align-items:center;justify-content:space-between;
      padding:16px 18px 12px;border-bottom:1px solid color-mix(in srgb,var(--br-ink,#22201b) 10%,transparent);}
    .br-sheet-title{font-family:var(--br-font,"Lora",Georgia,serif);font-size:1.1rem;font-weight:600;}
    .br-sheet-x{width:30px;height:30px;border:none;border-radius:50%;cursor:pointer;box-shadow:none;
      background:color-mix(in srgb,var(--br-ink,#22201b) 8%,transparent);color:var(--br-ink,#22201b);
      display:flex;align-items:center;justify-content:center;}
    .br-sheet-body{overflow-y:auto;-webkit-overflow-scrolling:touch;padding:6px 0 18px;}
    .br-sheet-search{width:calc(100% - 32px);margin:12px 16px;padding:11px 14px;border-radius:10px;
      border:1px solid color-mix(in srgb,var(--br-ink,#22201b) 14%,transparent);
      background:color-mix(in srgb,var(--br-ink,#22201b) 4%,transparent);
      color:var(--br-ink,#22201b);font-size:1rem;outline:none;font-family:inherit;}
    .br-row{display:block;width:100%;text-align:left;border:none;background:none;cursor:pointer;box-shadow:none;
      color:var(--br-ink,#22201b);padding:12px 18px;font-size:.92rem;line-height:1.45;
      border-bottom:1px solid color-mix(in srgb,var(--br-ink,#22201b) 8%,transparent);font-family:inherit;}
    .br-row:active{background:color-mix(in srgb,var(--br-ink,#22201b) 6%,transparent);}
    .br-row .br-row-pg{float:right;color:var(--br-faint,#9a9384);font-size:.82rem;margin-left:10px;}
    .br-row small{display:block;color:var(--br-faint,#9a9384);font-size:.78rem;margin-top:3px;}
    .br-row mark{background:color-mix(in srgb,var(--br-accent,#9e4632) 22%,transparent);color:inherit;border-radius:2px;}
    .br-row.br-quote{font-family:var(--br-font,"Lora",Georgia,serif);font-style:italic;}
    .br-empty{padding:40px 20px;text-align:center;color:var(--br-faint,#9a9384);
      font-family:var(--br-font,"Lora",Georgia,serif);font-style:italic;}
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
      '</div>' +
      // ---- menu popover + sheets (Phase 3) ----
      '<div class="br-scrim" id="brScrim"></div>' +
      '<div class="br-pop" id="brPop">' +
      '  <button class="br-pop-row" data-act="contents"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg><span class="br-pl">Contents</span><span class="br-pr" id="brPopPct"></span></button>' +
      '  <button class="br-pop-row" data-act="bookmarks"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg><span class="br-pl">Bookmarks &amp; Highlights</span><span class="br-pr" id="brBmN"></span></button>' +
      '  <button class="br-pop-row" data-act="search"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><span class="br-pl">Search Story</span></button>' +
      '  <button class="br-pop-row" data-act="themes"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20V7a3 3 0 0 1 3-3h0a3 3 0 0 1 3 3v13"/><line x1="4" y1="13" x2="10" y2="13"/><path d="M14 20l4-11 4 11"/><line x1="15.5" y1="16" x2="20.5" y2="16"/></svg><span class="br-pl">Themes &amp; Settings</span></button>' +
      '  <div class="br-pop-icons">' +
      '    <button class="br-pop-ico" data-ico="share" aria-label="Share"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg></button>' +
      '    <button class="br-pop-ico" data-ico="scroll" aria-label="Scroll mode"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="16" y2="6"/><line x1="6" y1="10" x2="18" y2="10"/><line x1="6" y1="14" x2="18" y2="14"/><line x1="8" y1="18" x2="16" y2="18"/></svg></button>' +
      '    <button class="br-pop-ico" data-ico="bookmark" id="brIcoBm" aria-label="Bookmark this page"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg></button>' +
      '  </div>' +
      '</div>' +
      '<div class="br-sheet" id="brSheet">' +
      '  <div class="br-sheet-head"><span class="br-sheet-title" id="brSheetTitle"></span>' +
      '    <button class="br-sheet-x" id="brSheetX" aria-label="Close"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>' +
      '  </div>' +
      '  <div class="br-sheet-body" id="brSheetBody"></div>' +
      '</div>';
    document.body.appendChild(r);
    el.reader = r;
    el.stage = r.querySelector("#brStage");
    el.flow = r.querySelector("#brFlow");
    el.runhead = r.querySelector("#brRunhead");
    el.folio = r.querySelector("#brFolio");
    el.chapLbl = r.querySelector("#brChapLbl");
    el.progress = r.querySelector("#brProgress");

    el.scrim = r.querySelector("#brScrim");
    el.pop = r.querySelector("#brPop");
    el.sheet = r.querySelector("#brSheet");
    el.sheetTitle = r.querySelector("#brSheetTitle");
    el.sheetBody = r.querySelector("#brSheetBody");
    el.popPct = r.querySelector("#brPopPct");
    el.bmN = r.querySelector("#brBmN");
    el.icoBm = r.querySelector("#brIcoBm");

    r.querySelector("#brClose").addEventListener("click", function (e) {
      e.stopPropagation();
      close();
    });
    r.querySelector("#brMenu").addEventListener("click", function (e) {
      e.stopPropagation();
      openMenu();
    });
    el.scrim.addEventListener("click", closeMenu);
    r.querySelector("#brSheetX").addEventListener("click", closeSheet);
    el.pop.querySelectorAll(".br-pop-row").forEach(function (b) {
      b.addEventListener("click", function () { onMenuAct(b.dataset.act); });
    });
    el.pop.querySelectorAll(".br-pop-ico").forEach(function (b) {
      b.addEventListener("click", function () { onMenuIco(b.dataset.ico); });
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
      try { el.stage.setPointerCapture(e.pointerId); } catch (err) {}
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
        // Only a swipe turns pages — a tap just shows/hides the chrome.
        toggleChrome();
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
    if (e.key === "Escape") {
      if (el.sheet.classList.contains("on")) return closeSheet();
      if (el.pop.classList.contains("on")) return closeMenu();
      return close();
    }
    if (el.pop.classList.contains("on") || el.sheet.classList.contains("on")) return;
    if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") { e.preventDefault(); go(1); }
    else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); go(-1); }
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

  // ---- navigation helpers ------------------------------------
  function jumpToPage(pg) {
    page = clamp(pg, 0, pageCount - 1);
    anchor = firstSentenceOfPage(page);
    place(page, false);
    updateMeta();
    closeMenu();
  }
  function jumpToSentence(i) {
    anchor = i;
    jumpToPage(snPage[i] != null ? snPage[i] : 0);
  }

  // ---- menu popover ------------------------------------------
  function openMenu() {
    el.popPct.textContent = Math.round(((page + 1) / pageCount) * 100) + "%";
    refreshBmUI();
    el.scrim.classList.add("on");
    el.pop.classList.add("on");
  }
  function closeMenu() {
    el.pop.classList.remove("on");
    el.sheet.classList.remove("on");
    el.scrim.classList.remove("on");
  }
  function openSheet(title) {
    el.sheetTitle.textContent = title;
    el.pop.classList.remove("on");
    el.scrim.classList.add("on");
    el.sheet.classList.add("on");
  }
  function closeSheet() {
    el.sheet.classList.remove("on");
    if (!el.pop.classList.contains("on")) el.scrim.classList.remove("on");
  }
  function onMenuAct(act) {
    if (act === "contents") buildContents();
    else if (act === "search") buildSearch();
    else if (act === "bookmarks") buildBookmarks();
    else if (act === "themes" && typeof showToast === "function")
      showToast("Themes & Settings — coming next");
  }
  function onMenuIco(ico) {
    if (ico === "bookmark") { toggleBookmark(); refreshBmUI(); }
    else if (ico === "share") shareStory();
    else if (ico === "scroll" && typeof showToast === "function")
      showToast("Scroll view — coming later");
  }
  function wireRows() {
    el.sheetBody.querySelectorAll(".br-row").forEach(function (b) {
      b.addEventListener("click", function () {
        if (b.dataset.sn != null) jumpToSentence(+b.dataset.sn);
        else if (b.dataset.pg != null) jumpToPage(+b.dataset.pg);
      });
    });
  }

  // ---- Contents ----------------------------------------------
  function buildContents() {
    openSheet("Contents");
    var heads = el.flow.querySelectorAll(".br-ch, h3");
    var html = "";
    for (var k = 0; k < heads.length; k++) {
      var pg = Math.floor((heads[k].offsetLeft + 2) / U);
      html +=
        '<button class="br-row" data-pg="' + pg + '"><span class="br-row-pg">p. ' +
        (pg + 1) + "</span>" + escapeHtml(heads[k].textContent) + "</button>";
    }
    el.sheetBody.innerHTML =
      html || '<div class="br-empty">One continuous passage — no sections.</div>';
    wireRows();
  }

  // ---- Search ------------------------------------------------
  function buildSearch() {
    openSheet("Search Story");
    el.sheetBody.innerHTML =
      '<input class="br-sheet-search" id="brSearchIn" type="search" placeholder="Find in this story…" autocomplete="off"><div id="brSearchOut"></div>';
    var inp = el.sheetBody.querySelector("#brSearchIn");
    var out = el.sheetBody.querySelector("#brSearchOut");
    inp.addEventListener("input", function () {
      var q = inp.value.trim().toLowerCase();
      out.innerHTML = "";
      if (q.length < 3) return;
      var hits = 0, html = "";
      for (var i = 0; i < sentences.length && hits < 40; i++) {
        var t = sentences[i].text;
        var idx = t.toLowerCase().indexOf(q);
        if (idx === -1) continue;
        hits++;
        var a = Math.max(0, idx - 24);
        var pre = (a > 0 ? "…" : "") + t.slice(a, idx);
        var mid = t.slice(idx, idx + q.length);
        var post = t.slice(idx + q.length, idx + q.length + 44);
        var pg = snPage[i] != null ? snPage[i] : 0;
        html +=
          '<button class="br-row br-quote" data-sn="' + i + '"><span class="br-row-pg">p. ' +
          (pg + 1) + "</span>" + escapeHtml(pre) + "<mark>" + escapeHtml(mid) +
          "</mark>" + escapeHtml(post) + "</button>";
      }
      out.innerHTML = html || '<div class="br-empty">No matches.</div>';
      wireRows();
    });
    setTimeout(function () { inp.focus(); }, 80);
  }

  // ---- Bookmarks ---------------------------------------------
  var bmSet = {};
  var bmKey = "";
  function loadBookmarks(key) {
    bmKey = key ? "osmosis_reader_bm_" + key : "";
    bmSet = {};
    if (!bmKey) return;
    try {
      var raw = lsGet(bmKey);
      if (raw) JSON.parse(raw).forEach(function (i) { bmSet[i] = 1; });
    } catch (e) {}
  }
  function saveBookmarks() {
    if (bmKey) lsSet(bmKey, JSON.stringify(Object.keys(bmSet).map(Number)));
  }
  function currentAnchor() { return firstSentenceOfPage(page); }
  function toggleBookmark() {
    var i = currentAnchor();
    if (bmSet[i]) { delete bmSet[i]; toast("Bookmark removed"); }
    else { bmSet[i] = 1; toast("Bookmarked"); }
    saveBookmarks();
  }
  function refreshBmUI() {
    var n = Object.keys(bmSet).length;
    if (el.bmN) el.bmN.textContent = n ? String(n) : "";
    if (el.icoBm) el.icoBm.classList.toggle("on", !!bmSet[currentAnchor()]);
  }
  function buildBookmarks() {
    openSheet("Bookmarks & Highlights");
    var list = Object.keys(bmSet).map(Number).sort(function (a, b) { return a - b; });
    if (!list.length) {
      el.sheetBody.innerHTML =
        '<div class="br-empty">No bookmarks yet — tap the bookmark icon to save your place.</div>';
      return;
    }
    var html = "";
    list.forEach(function (i) {
      var pg = snPage[i] != null ? snPage[i] : 0;
      var txt = (sentences[i] && sentences[i].text) || "";
      html +=
        '<button class="br-row br-quote" data-sn="' + i + '"><span class="br-row-pg">p. ' +
        (pg + 1) + "</span>" + escapeHtml(txt.slice(0, 90)) + "</button>";
    });
    el.sheetBody.innerHTML = html;
    wireRows();
  }
  function shareStory() {
    var title = el.runhead.textContent || "Osmosis";
    if (navigator.share) navigator.share({ title: title, text: title }).catch(function () {});
    else toast("Sharing isn’t available here");
  }
  function toast(m) { if (typeof showToast === "function") showToast(m); }

  // ---- open / close ------------------------------------------
  function open(article, title, key) {
    buildDOM();
    storeKey = key ? "osmosis_reader_anchor_" + key : "";
    var saved = storeKey ? parseInt(lsGet(storeKey), 10) : NaN;
    anchor = isNaN(saved) ? 0 : saved;
    loadBookmarks(key);
    el.runhead.textContent = title || "";
    buildFlow(title, article && article.content);
    el.reader.classList.add("on");
    chromeShown = false;
    el.reader.classList.remove("chrome");
    closeMenu();
    // paginate after the browser has laid the flow out
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { relayout(); refreshBmUI(); });
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
