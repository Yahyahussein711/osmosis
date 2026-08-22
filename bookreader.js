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
  var words = [];       // flat [{text, sn}] — addressing unit for highlights
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
      color:var(--br-ink,#22201b);
      font-family:var(--br-font,"Lora",Georgia,serif);
      -webkit-user-select:none;user-select:none;-webkit-touch-callout:none;}
    #bookReader.on{display:block;}
    /* the page as a card that can be swiped down to leave */
    .br-card{position:absolute;inset:0;overflow:hidden;background:var(--br-paper,#f7f3ea);
      transform-origin:center 34%;will-change:transform;}
    #bookReader.dismissing{background:rgba(14,11,8,calc(.18 + var(--dp,0)*.5));
      backdrop-filter:blur(calc(var(--dp,0)*18px));-webkit-backdrop-filter:blur(calc(var(--dp,0)*18px));}
    #bookReader.dismissing .br-card{box-shadow:0 24px 70px rgba(0,0,0,.5);}
    .br-dismiss-x{position:absolute;top:calc(env(safe-area-inset-top,0px) + 12px);right:14px;z-index:30;
      width:34px;height:34px;border-radius:50%;border:none;box-shadow:none;cursor:pointer;
      background:color-mix(in srgb,var(--br-ink,#22201b) 10%,transparent);color:var(--br-ink,#22201b);
      display:flex;align-items:center;justify-content:center;opacity:0;pointer-events:none;transition:opacity .2s ease;}
    #bookReader.dismissing .br-dismiss-x{pointer-events:auto;}
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
      letter-spacing:var(--br-ls,0);word-spacing:var(--br-ws,0);
      will-change:transform;}
    #bookReader.br-bold .br-flow{font-weight:600;}
    .br-flow p{margin:0 0 .9em;text-align:justify;-webkit-hyphens:auto;hyphens:auto;orphans:2;widows:2;}
    #bookReader.br-nojustify .br-flow p{text-align:left;-webkit-hyphens:none;hyphens:none;}
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
    .br-pop-icons{display:grid;grid-template-columns:repeat(3,1fr);align-items:center;justify-items:center;padding:10px 8px;}
    .br-pop-ico{width:42px;height:42px;border-radius:50%;border:none;cursor:pointer;box-shadow:none;
      display:flex;align-items:center;justify-content:center;
      background:color-mix(in srgb,var(--br-ink,#22201b) 7%,transparent);color:var(--br-ink,#22201b);}
    .br-pop-ico.on{background:var(--br-accent,#9e4632);color:#fff;}
    .br-pop-ico:active{background:color-mix(in srgb,var(--br-ink,#22201b) 16%,transparent);}
    /* keep every reader-button icon from being crushed by its flex button */
    #bookReader button svg{flex-shrink:0;}
    .br-pop-ico svg{width:20px;height:20px;min-width:20px;min-height:20px;}
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
    /* ---- Themes & Settings + Customise (Phase 2) ---- */
    .br-size{display:flex;align-items:stretch;margin:14px 16px 6px;border-radius:12px;
      overflow:hidden;border:1px solid color-mix(in srgb,var(--br-ink,#22201b) 12%,transparent);}
    .br-size-btn{flex:1;border:none;background:none;cursor:pointer;box-shadow:none;
      color:var(--br-ink,#22201b);font-family:var(--br-font,"Lora",Georgia,serif);
      padding:12px;display:flex;align-items:center;justify-content:center;}
    .br-size-btn:active{background:color-mix(in srgb,var(--br-ink,#22201b) 8%,transparent);}
    .br-size-btn+.br-size-btn{border-left:1px solid color-mix(in srgb,var(--br-ink,#22201b) 12%,transparent);}
    .br-size-sm{font-size:.95rem;} .br-size-lg{font-size:1.5rem;}
    .br-themes{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:12px 16px 6px;}
    .br-theme{position:relative;border-radius:12px;cursor:pointer;box-shadow:none;
      border:2px solid transparent;padding:16px 8px 10px;text-align:center;
      display:flex;flex-direction:column;align-items:center;gap:4px;overflow:hidden;}
    .br-theme.on{border-color:var(--br-ink,#22201b);}
    .br-theme-aa{font-family:var(--br-font,"Lora",Georgia,serif);font-size:1.5rem;line-height:1;}
    .br-theme-nm{font-family:var(--br-font,"Lora",Georgia,serif);font-size:.72rem;}
    .br-cust-btn{display:flex;align-items:center;justify-content:center;gap:8px;
      width:calc(100% - 32px);margin:12px 16px 8px;padding:13px;border:none;border-radius:12px;
      cursor:pointer;box-shadow:none;background:color-mix(in srgb,var(--br-ink,#22201b) 7%,transparent);
      color:var(--br-ink,#22201b);font-family:"Outfit",system-ui,sans-serif;font-size:.92rem;font-weight:600;}
    .br-cust-btn:active{background:color-mix(in srgb,var(--br-ink,#22201b) 14%,transparent);}
    .br-set-grp{margin:6px 0 4px;padding:2px 18px;font-family:"Outfit",system-ui,sans-serif;
      font-size:.7rem;letter-spacing:.5px;text-transform:uppercase;color:var(--br-faint,#9a9384);}
    .br-set-row{display:flex;align-items:center;justify-content:space-between;gap:12px;
      padding:12px 18px;border-bottom:1px solid color-mix(in srgb,var(--br-ink,#22201b) 8%,transparent);}
    .br-set-label{font-family:"Outfit",system-ui,sans-serif;font-size:.92rem;color:var(--br-ink,#22201b);}
    .br-set-val{font-family:"Outfit",system-ui,sans-serif;font-size:.82rem;color:var(--br-faint,#9a9384);
      min-width:42px;text-align:right;font-variant-numeric:tabular-nums;}
    .br-slide-row{display:block;padding:10px 18px 14px;border-bottom:1px solid color-mix(in srgb,var(--br-ink,#22201b) 8%,transparent);}
    .br-slide-top{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;}
    .br-range{width:100%;-webkit-appearance:none;appearance:none;height:4px;border-radius:3px;
      background:color-mix(in srgb,var(--br-ink,#22201b) 16%,transparent);outline:none;}
    .br-range::-webkit-slider-thumb{-webkit-appearance:none;width:26px;height:26px;border-radius:50%;
      background:#fff;border:1px solid color-mix(in srgb,var(--br-ink,#22201b) 20%,transparent);
      box-shadow:0 1px 4px rgba(0,0,0,.25);cursor:pointer;}
    .br-select{font-family:"Outfit",system-ui,sans-serif;font-size:.9rem;border:none;background:none;
      color:var(--br-ink,#22201b);cursor:pointer;text-align:right;}
    .br-tog{position:relative;width:46px;height:28px;border-radius:999px;cursor:pointer;border:none;
      background:color-mix(in srgb,var(--br-ink,#22201b) 18%,transparent);transition:background .2s ease;flex-shrink:0;}
    .br-tog::after{content:"";position:absolute;top:3px;left:3px;width:22px;height:22px;border-radius:50%;
      background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3);transition:transform .2s ease;}
    .br-tog.on{background:var(--br-accent,#9e4632);}
    .br-tog.on::after{transform:translateX(18px);}
    .br-reset{display:block;width:calc(100% - 32px);margin:16px 16px 6px;padding:13px;border:none;border-radius:12px;
      cursor:pointer;box-shadow:none;background:none;color:#c0392b;font-family:"Outfit",system-ui,sans-serif;font-size:.92rem;font-weight:600;}
    .br-cust-preview{padding:16px 18px;border-bottom:1px solid color-mix(in srgb,var(--br-ink,#22201b) 10%,transparent);
      font-family:var(--br-font,"Lora",Georgia,serif);font-size:var(--br-fs,1.2rem);line-height:var(--br-lh,1.6);
      letter-spacing:var(--br-ls,0);word-spacing:var(--br-ws,0);color:var(--br-ink,#22201b);
      max-height:26vh;overflow:hidden;text-align:justify;}
    #bookReader.br-bold .br-cust-preview{font-weight:600;}
    #bookReader.br-nojustify .br-cust-preview{text-align:left;}
    /* ---- highlights + notes (Phase 4) — word-level ---- */
    .br-flow .wd.br-hl{background:color-mix(in srgb,var(--br-accent,#9e4632) 22%,transparent);}
    .br-flow .wd.br-hl.br-hasnote{box-shadow:inset 0 -2px 0 var(--br-accent,#9e4632);}
    .br-flow .wd.br-sel{background:color-mix(in srgb,var(--br-accent,#9e4632) 36%,transparent);}
    /* draggable selection handles */
    .br-handle{position:absolute;z-index:13;display:none;width:26px;margin-left:-13px;
      touch-action:none;cursor:ew-resize;}
    .br-handle.on{display:block;}
    .br-handle::before{content:"";position:absolute;left:12px;top:0;bottom:0;width:2px;
      background:var(--br-accent,#9e4632);}
    .br-handle::after{content:"";position:absolute;left:6px;width:14px;height:14px;border-radius:50%;
      background:var(--br-accent,#9e4632);box-shadow:0 1px 4px rgba(0,0,0,.35);}
    .br-handle.start::after{top:-11px;}
    .br-handle.end::after{bottom:-11px;}
    .br-flow .br-author{text-align:center;font-style:italic;color:var(--br-faint,#9a9384);
      font-size:.95em;margin:-.3em 0 1.7em;}
    .br-flow p.br-first::first-letter{float:left;font-family:var(--br-font,"Lora",Georgia,serif);
      font-size:3.05em;line-height:.82;padding:.02em .09em 0 0;color:var(--br-accent,#9e4632);font-weight:600;}
    .br-hlbar{position:absolute;z-index:14;transform:translate(-50%,-118%);display:none;
      background:#221d17;color:#fff;border-radius:12px;padding:2px;box-shadow:0 8px 26px rgba(0,0,0,.42);
      white-space:nowrap;font-family:"Outfit",system-ui,sans-serif;}
    .br-hlbar.on{display:flex;align-items:stretch;}
    .br-hlbar button{border:none;background:none;color:#fff;font-size:.85rem;padding:10px 14px;cursor:pointer;border-radius:9px;box-shadow:none;}
    .br-hlbar button:active{background:rgba(255,255,255,.16);}
    .br-hlbar .sep{width:1px;background:rgba(255,255,255,.22);margin:7px 0;}
    .br-note-wrap{position:absolute;inset:0;z-index:15;display:none;align-items:center;justify-content:center;
      background:rgba(20,16,10,.42);padding:20px;}
    .br-note-wrap.on{display:flex;}
    .br-note{width:min(440px,90vw);background:var(--br-paper,#f7f3ea);border-radius:16px;padding:16px;
      box-shadow:0 14px 44px rgba(0,0,0,.4);}
    .br-note-q{font-family:var(--br-font,"Lora",Georgia,serif);font-style:italic;font-size:.95rem;
      color:var(--br-ink,#22201b);border-left:3px solid var(--br-accent,#9e4632);padding-left:11px;
      margin-bottom:12px;max-height:22vh;overflow:auto;}
    .br-note textarea{width:100%;min-height:96px;border:1px solid color-mix(in srgb,var(--br-ink,#22201b) 14%,transparent);
      border-radius:10px;background:none;color:var(--br-ink,#22201b);padding:11px;font-family:"Outfit",system-ui,sans-serif;
      font-size:.98rem;line-height:1.5;outline:none;resize:vertical;box-sizing:border-box;}
    .br-note-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:12px;}
    .br-note-actions button{border:none;border-radius:10px;padding:10px 18px;cursor:pointer;box-shadow:none;
      font-family:"Outfit",system-ui,sans-serif;font-size:.9rem;font-weight:600;}
    .br-note-cancel{background:none;color:var(--br-faint,#9a9384);}
    .br-note-save{background:var(--br-accent,#9e4632);color:#fff;}
    .br-row-note{display:block;margin-top:4px;font-style:normal;color:var(--br-faint,#9a9384);font-size:.82rem;}
    /* bottom reading-progress hairline */
    .br-progline{position:absolute;left:0;bottom:0;height:2px;background:var(--br-accent,#9e4632);
      width:0;opacity:.5;z-index:3;transition:width .3s ease;pointer-events:none;}
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
      '<div class="br-card" id="brCard">' +
      '<button class="br-dismiss-x" id="brDismissX" aria-label="Close"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>' +
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
      '</div>' +
      '<div class="br-progline" id="brProgline"></div>' +
      // ---- selection handles + highlight bar + note composer (Phase 4) ----
      '<div class="br-handle start" id="brHandleA"></div>' +
      '<div class="br-handle end" id="brHandleB"></div>' +
      '<div class="br-hlbar" id="brHlbar">' +
      '  <button data-hl="toggle" id="brHlToggle">Highlight</button>' +
      '  <span class="sep"></span>' +
      '  <button data-hl="note">Note</button>' +
      '  <span class="sep"></span>' +
      '  <button data-hl="copy">Copy</button>' +
      '</div>' +
      '<div class="br-note-wrap" id="brNoteWrap">' +
      '  <div class="br-note">' +
      '    <div class="br-note-q" id="brNoteQ"></div>' +
      '    <textarea id="brNoteText" placeholder="Write a note…"></textarea>' +
      '    <div class="br-note-actions">' +
      '      <button class="br-note-cancel" id="brNoteCancel">Cancel</button>' +
      '      <button class="br-note-save" id="brNoteSave">Save</button>' +
      '    </div>' +
      '  </div>' +
      '</div>' +
      '</div>'; // close .br-card
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
    el.hlbar = r.querySelector("#brHlbar");
    el.hlToggle = r.querySelector("#brHlToggle");
    el.noteWrap = r.querySelector("#brNoteWrap");
    el.noteQ = r.querySelector("#brNoteQ");
    el.noteText = r.querySelector("#brNoteText");
    el.progline = r.querySelector("#brProgline");
    el.handleA = r.querySelector("#brHandleA");
    el.handleB = r.querySelector("#brHandleB");
    el.card = r.querySelector("#brCard");
    el.dismissX = r.querySelector("#brDismissX");

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
    // highlight bar + note composer
    el.hlbar.querySelectorAll("button").forEach(function (b) {
      b.addEventListener("click", function (e) { e.stopPropagation(); onHlAction(b.dataset.hl); });
    });
    r.querySelector("#brNoteCancel").addEventListener("click", closeNote);
    r.querySelector("#brNoteSave").addEventListener("click", saveNote);
    el.noteWrap.addEventListener("click", function (e) { if (e.target === el.noteWrap) closeNote(); });
    wireHandle(el.handleA, "A");
    wireHandle(el.handleB, "B");
    el.dismissX.addEventListener("click", function (e) { e.stopPropagation(); close(); });

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
  function buildFlow(title, article) {
    sentences = [];
    words = [];
    var content = article && article.content;
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
    if (article && article.author)
      html += '<div class="br-author">' + escapeHtml(article.author) + "</div>";
    var firstP = true;
    paras.forEach(function (para) {
      if (para === "---") { html += '<hr class="br-rule">'; return; }
      if (para.indexOf("## ") === 0) { html += "<h3>" + inlineMd(para.slice(3)) + "</h3>"; return; }
      if (para.indexOf("# ") === 0) { html += '<h2 class="br-ch">' + inlineMd(para.slice(2)) + "</h2>"; return; }
      var cls = firstP ? " class=\"br-first\"" : "";
      firstP = false;
      html += "<p" + cls + ">";
      splitSentences(para).forEach(function (s) {
        var si = sentences.length;
        sentences.push({ text: s.trim() });
        html += '<span class="sn" data-i="' + si + '">';
        // each word carries its trailing space so highlights read continuously
        var toks = s.match(/\S+\s*/g) || [];
        toks.forEach(function (tok) {
          var wi = words.length;
          words.push({ text: tok, sn: si });
          html += '<span class="wd" data-w="' + wi + '">' +
            escapeHtml(tok).replace(/\*/g, "") + "</span>";
        });
        html += "</span>";
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
    if (el.progline)
      el.progline.style.width =
        pageCount > 1 ? (page / (pageCount - 1)) * 100 + "%" : "100%";
    if (storeKey) lsSet(storeKey, String(anchor));
  }

  // ---- page turns --------------------------------------------
  function go(dir) {
    if (animating) return;
    var target = page + dir;
    if (target < 0 || target > pageCount - 1) return;
    closeHlBar(); clearSel();
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
      if (el.hlbar.classList.contains("on")) { closeHlBar(); clearSel(); }
      try { el.stage.setPointerCapture(e.pointerId); } catch (err) {}
      g = { id: e.pointerId, x0: e.clientX, y0: e.clientY, axis: null,
            t0: performance.now(), moved: false, dragging: false, longpressed: false, selecting: false,
            lp: setTimeout(function () {
              if (!g || g.moved) return;
              g.longpressed = true;
              var w = wordAt(g.x0, g.y0);
              if (w < 0) return;
              var idx = hlRangeAt(w);
              if (idx >= 0) { g.selecting = false; openBarExisting(idx); }
              else { g.selecting = true; startSel(w); }
            }, 430) };
      el.flow.style.transition = "none";
    });
    el.stage.addEventListener("pointermove", function (e) {
      if (!g || e.pointerId !== g.id) return;
      var dx = e.clientX - g.x0, dy = e.clientY - g.y0;
      if (Math.hypot(dx, dy) > 7 && g.lp) { clearTimeout(g.lp); g.lp = null; }
      if (Math.hypot(dx, dy) > 8) g.moved = true;
      if (g.longpressed) {
        if (g.selecting) extendSel(wordAt(e.clientX, e.clientY));
        return;
      }
      if (!g.axis && Math.hypot(dx, dy) > 10) {
        g.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
        if (g.axis === "x") {
          if ((dx < 0 && page >= pageCount - 1) || (dx > 0 && page <= 0)) g.axis = "refuse";
          else g.dragging = true;
        } else if (g.axis === "y" && dy > 0) {
          g.dismissing = true; // a downward drag peels the page away to leave
        }
      }
      if (g.dismissing) { dismissDrag(Math.max(0, dy)); return; }
      if (g.dragging) {
        el.flow.style.transform =
          "translate3d(" + (-page * U + dx) + "px,0,0)";
      }
    });
    function end(e) {
      if (!g || e.pointerId !== g.id) return;
      if (g.lp) clearTimeout(g.lp);
      var dx = e.clientX - g.x0, dy = e.clientY - g.y0;
      var dt = performance.now() - g.t0;
      if (g.longpressed) {
        if (g.selecting) openBarNew(selS, selE);
        g = null; return;
      }
      if (g.dismissing) {
        dismissEnd(Math.max(0, dy), dy / ((performance.now() - g.t0) || 1));
        g = null; return;
      }
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
      if (g && g.lp) clearTimeout(g.lp);
      if (g && g.dragging) place(page, true);
      if (g && g.dismissing) dismissEnd(0, 0);
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

  // ---- swipe-down-to-leave (interactive dismiss) -------------
  function dismissDrag(dy) {
    var H = el.reader.clientHeight || 800;
    var p = Math.max(0, Math.min(1, dy / (H * 0.4)));
    el.reader.classList.add("dismissing");
    el.reader.style.setProperty("--dp", p.toFixed(3));
    el.card.style.transition = "none";
    el.card.style.transform =
      "translateY(" + dy * 0.35 + "px) scale(" + (1 - p * 0.16) + ")";
    el.card.style.borderRadius = p * 34 + "px";
    el.dismissX.style.opacity = Math.min(1, p * 4);
  }
  function dismissEnd(dy, vy) {
    var H = el.reader.clientHeight || 800;
    var p = Math.max(0, Math.min(1, dy / (H * 0.4)));
    if (p > 0.32 || (vy > 0.9 && dy > 80)) {
      // commit: throw the card down and leave
      el.card.style.transition =
        "transform .3s cubic-bezier(.4,0,.6,1), border-radius .3s ease, opacity .3s ease";
      el.card.style.transform = "translateY(" + H + "px) scale(.8)";
      el.card.style.opacity = "0";
      setTimeout(function () { close(); resetCard(); }, 260);
    } else {
      // snap back to full screen
      el.card.style.transition =
        "transform .34s cubic-bezier(.22,1,.36,1), border-radius .34s ease";
      el.card.style.transform = "none";
      el.card.style.borderRadius = "0";
      el.dismissX.style.opacity = "0";
      el.reader.style.setProperty("--dp", "0");
      setTimeout(function () {
        el.reader.classList.remove("dismissing");
        el.card.style.transition = "";
      }, 360);
    }
  }
  function resetCard() {
    if (!el.card) return;
    el.card.style.transition = "none";
    el.card.style.transform = "";
    el.card.style.borderRadius = "";
    el.card.style.opacity = "";
    el.reader.classList.remove("dismissing");
    el.reader.style.removeProperty("--dp");
    el.dismissX.style.opacity = "0";
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
    else if (act === "themes") buildThemes();
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
    var n = Object.keys(bmSet).length + hlRanges.length;
    if (el.bmN) el.bmN.textContent = n ? String(n) : "";
    if (el.icoBm) el.icoBm.classList.toggle("on", !!bmSet[currentAnchor()]);
  }
  function buildBookmarks() {
    openSheet("Bookmarks & Highlights");
    var html = "";
    if (hlRanges.length) {
      html += '<div class="br-set-grp">Highlights</div>';
      hlRanges
        .map(function (r) { return r; })
        .sort(function (a, b) { return a.s - b.s; })
        .forEach(function (r) {
          var sn = words[r.s] ? words[r.s].sn : 0;
          var pg = snPage[sn] != null ? snPage[sn] : 0;
          html +=
            '<button class="br-row br-quote" data-sn="' + sn + '"><span class="br-row-pg">p. ' +
            (pg + 1) + "</span>" + escapeHtml(rangeText(r).slice(0, 90)) +
            (r.note ? '<span class="br-row-note">✎ ' + escapeHtml(r.note.slice(0, 80)) + "</span>" : "") +
            "</button>";
        });
    }
    var bms = Object.keys(bmSet).map(Number).sort(function (a, b) { return a - b; });
    if (bms.length) {
      html += '<div class="br-set-grp">Bookmarks</div>';
      bms.forEach(function (i) {
        var pg = snPage[i] != null ? snPage[i] : 0;
        html +=
          '<button class="br-row br-quote" data-sn="' + i + '"><span class="br-row-pg">p. ' +
          (pg + 1) + "</span>" + escapeHtml(sentenceText(i).slice(0, 90)) + "</button>";
      });
    }
    el.sheetBody.innerHTML =
      html ||
      '<div class="br-empty">No marks yet — long-press a passage to highlight it, or tap the bookmark icon to save your place.</div>';
    wireRows();
  }
  function shareStory() {
    var title = el.runhead.textContent || "Osmosis";
    if (navigator.share) navigator.share({ title: title, text: title }).catch(function () {});
    else toast("Sharing isn’t available here");
  }
  function toast(m) { if (typeof showToast === "function") showToast(m); }

  // ---- Highlights + notes (Phase 4) — word-range selection ----
  // hlRanges: [{ s, e, note? }] over word indices. Long-press then drag
  // across words to select the exact text (Apple-Books style).
  var hlRanges = [];
  var hlKey = "";
  var curSel = null;          // { s, e, idx } — active bar target (idx<0 = new)
  var selActive = false, selS = -1, selE = -1, selAnchor = -1;

  function loadHighlights(key) {
    hlKey = key ? "osmosis_reader_hl_" + key : "";
    hlRanges = [];
    if (!hlKey) return;
    try {
      var raw = lsGet(hlKey);
      var parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed)) hlRanges = parsed;
    } catch (e) {}
  }
  function saveHighlights() { if (hlKey) lsSet(hlKey, JSON.stringify(hlRanges)); }
  function wordSpan(w) { return el.flow.querySelector('.wd[data-w="' + w + '"]'); }
  function applyHighlights() {
    el.flow.querySelectorAll(".wd.br-hl,.wd.br-hasnote").forEach(function (s) {
      s.classList.remove("br-hl", "br-hasnote");
    });
    hlRanges.forEach(function (r) {
      for (var w = r.s; w <= r.e; w++) {
        var span = wordSpan(w);
        if (span) { span.classList.add("br-hl"); if (r.note) span.classList.add("br-hasnote"); }
      }
    });
  }
  function rangeText(r) {
    var t = "";
    for (var w = r.s; w <= r.e; w++) t += (words[w] ? words[w].text : "");
    return t.replace(/\s+/g, " ").trim();
  }
  function hlRangeAt(w) {
    for (var i = 0; i < hlRanges.length; i++)
      if (w >= hlRanges[i].s && w <= hlRanges[i].e) return i;
    return -1;
  }
  function sentenceText(i) { return (sentences[i] && sentences[i].text) || ""; }
  function recordMark(kind, text) {
    try { if (typeof trackEngagement === "function") trackEngagement(kind, text); } catch (e) {}
  }

  // ---- live selection ----
  function wordAt(x, y) {
    // look through the handles/bar to the word beneath
    var list = document.elementsFromPoint
      ? document.elementsFromPoint(x, y)
      : [document.elementFromPoint(x, y)];
    for (var i = 0; i < list.length; i++) {
      var wd = list[i] && list[i].closest ? list[i].closest(".wd") : null;
      if (wd) return +wd.dataset.w;
    }
    return -1;
  }
  function startSel(w) { selActive = true; selAnchor = w; selS = selE = w; renderSel(); }
  function extendSel(w) {
    if (!selActive || w < 0) return;
    if (w >= selAnchor) { selS = selAnchor; selE = w; }
    else { selS = w; selE = selAnchor; }
    renderSel();
  }
  function renderSel() {
    el.flow.querySelectorAll(".wd.br-sel").forEach(function (s) { s.classList.remove("br-sel"); });
    for (var w = selS; w <= selE; w++) { var s = wordSpan(w); if (s) s.classList.add("br-sel"); }
  }
  function clearSel() {
    selActive = false;
    el.flow.querySelectorAll(".wd.br-sel").forEach(function (s) { s.classList.remove("br-sel"); });
    hideHandles();
  }
  // ---- draggable selection handles ----
  function placeHandles() {
    var fw = wordSpan(selS), lw = wordSpan(selE);
    if (!fw || !lw) { hideHandles(); return; }
    var r1 = fw.getBoundingClientRect(), r2 = lw.getBoundingClientRect();
    el.handleA.style.left = r1.left + "px";
    el.handleA.style.top = r1.top + "px";
    el.handleA.style.height = r1.height + "px";
    el.handleA.classList.add("on");
    el.handleB.style.left = r2.right + "px";
    el.handleB.style.top = r2.top + "px";
    el.handleB.style.height = r2.height + "px";
    el.handleB.classList.add("on");
  }
  function hideHandles() {
    if (el.handleA) el.handleA.classList.remove("on");
    if (el.handleB) el.handleB.classList.remove("on");
  }
  function wireHandle(h, which) {
    h.addEventListener("pointerdown", function (e) {
      e.preventDefault(); e.stopPropagation();
      try { h.setPointerCapture(e.pointerId); } catch (err) {}
      h._drag = true;
      closeHlBar();
    });
    h.addEventListener("pointermove", function (e) {
      if (!h._drag) return;
      var w = wordAt(e.clientX, e.clientY);
      if (w < 0) return;
      if (which === "A") selS = Math.min(w, selE);
      else selE = Math.max(w, selS);
      renderSel(); placeHandles();
    });
    function up() {
      if (!h._drag) return;
      h._drag = false;
      openBarNew(selS, selE);
    }
    h.addEventListener("pointerup", up);
    h.addEventListener("pointercancel", up);
  }

  // ---- the floating bar ----
  function positionBar(s, e) {
    var first = wordSpan(s), last = wordSpan(e);
    if (!first) return;
    var r1 = first.getBoundingClientRect();
    var r2 = last ? last.getBoundingClientRect() : r1;
    var sr = el.stage.getBoundingClientRect();
    var cx = (r1.left + r2.right) / 2;
    cx = Math.min(Math.max(cx, sr.left + 80), sr.right - 80);
    var top = Math.min(r1.top, r2.top);
    var cy = Math.max(top, sr.top + 44);
    el.hlbar.style.left = cx + "px";
    el.hlbar.style.top = cy + "px";
    el.hlbar.classList.add("on");
  }
  function openBarNew(s, e) {
    curSel = { s: s, e: e, idx: -1 };
    el.hlToggle.textContent = "Highlight";
    positionBar(s, e);
    placeHandles();
  }
  function openBarExisting(idx) {
    var r = hlRanges[idx];
    curSel = { s: r.s, e: r.e, idx: idx };
    el.hlToggle.textContent = "Unhighlight";
    positionBar(r.s, r.e);
  }
  function closeHlBar() { el.hlbar.classList.remove("on"); }

  function onHlAction(act) {
    if (!curSel) return;
    if (act === "toggle") {
      if (curSel.idx >= 0) {
        hlRanges.splice(curSel.idx, 1);
        toast("Removed");
      } else {
        hlRanges.push({ s: curSel.s, e: curSel.e });
        recordMark("highlight", '"' + rangeText(curSel) + '"');
        toast("Highlighted");
      }
      saveHighlights(); applyHighlights(); refreshBmUI();
      clearSel(); closeHlBar();
    } else if (act === "note") {
      openNote();
    } else if (act === "copy") {
      if (navigator.clipboard) navigator.clipboard.writeText(rangeText(curSel)).catch(function () {});
      toast("Copied"); clearSel(); closeHlBar();
    }
  }

  function openNote() {
    if (!curSel) return;
    el.noteQ.textContent = "“" + rangeText(curSel) + "”";
    el.noteText.value = (curSel.idx >= 0 && hlRanges[curSel.idx].note) || "";
    el.noteWrap.classList.add("on");
    closeHlBar();
    setTimeout(function () { el.noteText.focus(); }, 60);
  }
  function closeNote() { el.noteWrap.classList.remove("on"); }
  function saveNote() {
    if (!curSel) return;
    var txt = el.noteText.value.trim(), isNew = curSel.idx < 0;
    var r;
    if (isNew) { r = { s: curSel.s, e: curSel.e }; if (txt) r.note = txt; hlRanges.push(r); }
    else { r = hlRanges[curSel.idx]; if (txt) r.note = txt; else delete r.note; }
    saveHighlights(); applyHighlights(); refreshBmUI();
    if (txt) recordMark("note", txt + '\n\n"' + rangeText(r) + '"');
    clearSel(); closeNote(); toast("Note saved");
  }

  // ---- Settings: themes + typography (Phase 2) ---------------
  var THEMES = {
    original: { paper: "#ffffff", ink: "#1b1a17", faint: "#9a9384", accent: "#9e4632", label: "Original" },
    quiet:    { paper: "#17140f", ink: "#e7dfcf", faint: "#8f8672", accent: "#d08a5e", label: "Quiet" },
    paper:    { paper: "#f7f3ea", ink: "#22201b", faint: "#9a9384", accent: "#9e4632", label: "Paper" },
    bold:     { paper: "#faf7f0", ink: "#100f0d", faint: "#8a8272", accent: "#8a3c2a", label: "Bold" },
    calm:     { paper: "#efe6d6", ink: "#3a3225", faint: "#9c8f79", accent: "#a25a34", label: "Calm" },
    focus:    { paper: "#fbf7ee", ink: "#2b2720", faint: "#a2977f", accent: "#9e4632", label: "Focus" },
  };
  var THEME_ORDER = ["original", "quiet", "paper", "bold", "calm", "focus"];
  var FONTS = [
    { v: "'Lora', Georgia, serif", n: "Lora" },
    { v: "Georgia, 'Times New Roman', serif", n: "Georgia" },
    { v: "'Iowan Old Style','Palatino Linotype',Palatino,serif", n: "Iowan" },
    { v: "'Charter',Georgia,serif", n: "Charter" },
    { v: "-apple-system,system-ui,'Segoe UI',sans-serif", n: "System Sans" },
  ];
  var SKEY = "osmosis_reader_settings";
  var DEFAULTS = { theme: "paper", fontPx: 20, lineH: 1.6, letter: 0, word: 0, margin: 30, font: FONTS[0].v, bold: false, justify: true };
  var settings = Object.assign({}, DEFAULTS);
  var settingsLoaded = false;

  function loadSettings() {
    if (settingsLoaded) return;
    settingsLoaded = true;
    try { var raw = lsGet(SKEY); if (raw) settings = Object.assign({}, DEFAULTS, JSON.parse(raw)); } catch (e) {}
  }
  function saveSettings() { lsSet(SKEY, JSON.stringify(settings)); }
  function applySettings() {
    var root = el.reader, s = settings, th = THEMES[s.theme] || THEMES.paper;
    root.style.setProperty("--br-paper", th.paper);
    root.style.setProperty("--br-ink", th.ink);
    root.style.setProperty("--br-faint", th.faint);
    root.style.setProperty("--br-accent", th.accent);
    root.style.setProperty("--br-font", s.font);
    root.style.setProperty("--br-fs", s.fontPx + "px");
    root.style.setProperty("--br-lh", String(s.lineH));
    root.style.setProperty("--br-ls", s.letter + "em");
    root.style.setProperty("--br-ws", s.word + "em");
    root.style.setProperty("--br-mside", s.margin + "px");
    root.classList.toggle("br-bold", !!s.bold);
    root.classList.toggle("br-nojustify", !s.justify);
  }
  // metric change → re-paginate keeping the same sentence; colour change → not
  function setMetric(fn) { fn(); saveSettings(); applySettings(); relayout(); }
  function setColour(fn) { fn(); saveSettings(); applySettings(); }
  function pct(em) { return (em >= 0 ? "+" : "") + Math.round(em * 100) + "%"; }
  function slideRow(label, id, min, max, step, val, disp) {
    return '<div class="br-slide-row"><div class="br-slide-top"><span class="br-set-label">' +
      label + '</span><span class="br-set-val" id="' + id + 'V">' + disp +
      '</span></div><input class="br-range" id="' + id + '" type="range" min="' + min +
      '" max="' + max + '" step="' + step + '" value="' + val + '"></div>';
  }

  function buildThemes() {
    openSheet("Themes & Settings");
    var h = '<div class="br-size"><button class="br-size-btn br-size-sm" data-d="-1">A</button><button class="br-size-btn br-size-lg" data-d="1">A</button></div>';
    h += '<div class="br-themes">';
    THEME_ORDER.forEach(function (k) {
      var t = THEMES[k], on = settings.theme === k;
      h += '<button class="br-theme' + (on ? " on" : "") + '" data-theme="' + k +
        '" style="background:' + t.paper + ";color:" + t.ink + ";border-color:" +
        (on ? t.ink : "transparent") + '"><span class="br-theme-aa">Aa</span><span class="br-theme-nm">' +
        t.label + "</span></button>";
    });
    h += "</div>";
    h += '<button class="br-cust-btn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> Customise…</button>';
    el.sheetBody.innerHTML = h;
    el.sheetBody.querySelectorAll(".br-size-btn").forEach(function (b) {
      b.addEventListener("click", function () {
        setMetric(function () { settings.fontPx = clamp(settings.fontPx + +b.dataset.d, 14, 30); });
      });
    });
    el.sheetBody.querySelectorAll(".br-theme").forEach(function (b) {
      b.addEventListener("click", function () {
        setColour(function () { settings.theme = b.dataset.theme; });
        el.sheetBody.querySelectorAll(".br-theme").forEach(function (x) {
          var on = x === b;
          x.classList.toggle("on", on);
          x.style.borderColor = on ? THEMES[x.dataset.theme].ink : "transparent";
        });
      });
    });
    el.sheetBody.querySelector(".br-cust-btn").addEventListener("click", buildCustomise);
  }

  function buildCustomise() {
    openSheet("Customise");
    var s = settings;
    var fontOpts = FONTS.map(function (f) {
      return '<option value="' + f.v + '"' + (s.font === f.v ? " selected" : "") + ">" + f.n + "</option>";
    }).join("");
    var h = '<div class="br-cust-preview">Still waters run deep, and the road that leads to water always charges for the arriving. Attention is the rarest form of generosity.</div>';
    h += '<div class="br-set-grp">Text</div>';
    h += '<div class="br-set-row"><span class="br-set-label">Font</span><select class="br-select" id="brFont">' + fontOpts + "</select></div>";
    h += '<div class="br-set-row"><span class="br-set-label">Bold Text</span><button class="br-tog' + (s.bold ? " on" : "") + '" id="brBold" aria-label="Bold"></button></div>';
    h += '<div class="br-set-grp">Layout</div>';
    h += slideRow("Line Spacing", "brLine", 1.2, 2.4, 0.05, s.lineH, s.lineH.toFixed(2));
    h += slideRow("Letter Spacing", "brLetter", -0.03, 0.1, 0.005, s.letter, pct(s.letter));
    h += slideRow("Word Spacing", "brWord", -0.05, 0.4, 0.01, s.word, pct(s.word));
    h += slideRow("Margins", "brMargin", 12, 84, 2, s.margin, s.margin + "px");
    h += '<div class="br-set-row"><span class="br-set-label">Justify Text</span><button class="br-tog' + (s.justify ? " on" : "") + '" id="brJustify" aria-label="Justify"></button></div>';
    h += '<button class="br-reset" id="brReset">Reset</button>';
    el.sheetBody.innerHTML = h;

    document.getElementById("brFont").addEventListener("change", function (e) {
      setMetric(function () { settings.font = e.target.value; });
    });
    document.getElementById("brBold").addEventListener("click", function () {
      setMetric(function () { settings.bold = !settings.bold; });
      this.classList.toggle("on", settings.bold);
    });
    document.getElementById("brJustify").addEventListener("click", function () {
      setMetric(function () { settings.justify = !settings.justify; });
      this.classList.toggle("on", settings.justify);
    });
    bindSlider("brLine", function (x) { settings.lineH = x; }, function (x) { return x.toFixed(2); });
    bindSlider("brLetter", function (x) { settings.letter = x; }, pct);
    bindSlider("brWord", function (x) { settings.word = x; }, pct);
    bindSlider("brMargin", function (x) { settings.margin = x; }, function (x) { return x + "px"; });
    document.getElementById("brReset").addEventListener("click", function () {
      settings = Object.assign({}, DEFAULTS);
      saveSettings(); applySettings(); relayout(); buildCustomise();
    });
  }
  // Live-apply on drag (no re-paginate); re-paginate on release to fix maps.
  function bindSlider(id, apply, disp) {
    var sl = document.getElementById(id), v = document.getElementById(id + "V");
    sl.addEventListener("input", function () {
      apply(parseFloat(sl.value));
      saveSettings(); applySettings();
      if (v) v.textContent = disp(parseFloat(sl.value));
    });
    sl.addEventListener("change", function () { relayout(); });
  }

  // ---- open / close ------------------------------------------
  function open(article, title, key) {
    buildDOM();
    storeKey = key ? "osmosis_reader_anchor_" + key : "";
    var saved = storeKey ? parseInt(lsGet(storeKey), 10) : NaN;
    anchor = isNaN(saved) ? 0 : saved;
    loadBookmarks(key);
    loadHighlights(key);
    loadSettings();
    applySettings();
    el.runhead.textContent = title || "";
    buildFlow(title, article);
    applyHighlights();
    resetCard();
    el.reader.classList.add("on");
    chromeShown = false;
    el.reader.classList.remove("chrome");
    closeMenu();
    closeHlBar();
    closeNote();
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
