/* ============================================================
   Osmosis — hands-free reading.
   • Auto-scroll with a speed you choose (1–10), remembered.
   • Screen wake lock so the phone stops sleeping while you read.
   ============================================================ */
(function () {
  "use strict";

  var SPEED_KEY = "osmosis_scroll_speed";
  var AWAKE_KEY = "osmosis_keep_awake";

  var raf = null,
    playing = false,
    carry = 0,
    lastT = 0,
    wl = null;

  function $(id) {
    return document.getElementById(id);
  }
  function artActive() {
    var v = $("articleView");
    return !!(v && v.classList.contains("active"));
  }
  function ls(k, d) {
    try {
      var v = localStorage.getItem(k);
      return v === null ? d : v;
    } catch (e) {
      return d;
    }
  }

  // ---- screen wake lock --------------------------------------------
  function awakeWanted() {
    if (ls(AWAKE_KEY, "1") === "0") return false;
    return artActive() || playing;
  }
  function acquireWake() {
    if (!("wakeLock" in navigator) || wl || !awakeWanted()) return;
    if (document.visibilityState !== "visible") return;
    try {
      navigator.wakeLock
        .request("screen")
        .then(function (lock) {
          wl = lock;
          lock.addEventListener("release", function () {
            wl = null;
          });
        })
        .catch(function () {
          wl = null;
        });
    } catch (e) {
      wl = null;
    }
  }
  function releaseWake() {
    if (wl) {
      try {
        wl.release();
      } catch (e) {}
      wl = null;
    }
  }
  function syncWake() {
    if (awakeWanted()) acquireWake();
    else releaseWake();
  }
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") syncWake();
    else releaseWake();
  });
  // Some browsers only grant a wake lock off a user gesture — re-try on any
  // interaction while we still want one.
  function gestureRetry() {
    if (awakeWanted() && !wl) acquireWake();
  }
  document.addEventListener("click", gestureRetry, true);
  document.addEventListener("touchend", gestureRetry, {
    passive: true,
    capture: true,
  });

  // ---- auto-scroll --------------------------------------------------
  function speed() {
    var v = parseInt(ls(SPEED_KEY, "3"), 10);
    if (!v || isNaN(v)) v = 3;
    return Math.min(10, Math.max(1, v));
  }
  function setSpeed(v) {
    try {
      localStorage.setItem(SPEED_KEY, String(v));
    } catch (e) {}
    var r = $("asRate");
    if (r) r.textContent = v;
  }
  function atBottom() {
    return (
      window.innerHeight + window.scrollY >=
      document.documentElement.scrollHeight - 2
    );
  }
  function tick(t) {
    if (!playing) return;
    if (!lastT) lastT = t;
    var dt = (t - lastT) / 1000;
    lastT = t;
    if (dt > 0.25) dt = 0.016; // was backgrounded — don't lurch
    carry += speed() * 10 * dt; // px per second = speed × 10
    var px = Math.floor(carry);
    if (px >= 1) {
      carry -= px;
      window.scrollBy(0, px);
    }
    if (atBottom()) {
      pause();
      return;
    }
    raf = requestAnimationFrame(tick);
  }
  var GLYPH_DRIFT =
    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="7 6 12 11 17 6"></polyline><polyline points="7 13 12 18 17 13"></polyline></svg>';
  var GLYPH_STOP =
    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="9" y1="6" x2="9" y2="18"></line><line x1="15" y1="6" x2="15" y2="18"></line></svg>';

  function paint() {
    var b = $("asToggle");
    if (b) {
      b.innerHTML = playing ? GLYPH_STOP : GLYPH_DRIFT;
      b.classList.toggle("on", playing);
      b.setAttribute("aria-label", playing ? "Stop auto-scroll" : "Auto-scroll");
    }
    var pop = $("asSpeedPop");
    if (pop) pop.style.display = playing ? "flex" : "none";
  }
  function play() {
    if (playing) return;
    playing = true;
    lastT = 0;
    carry = 0;
    paint();
    syncWake();
    raf = requestAnimationFrame(tick);
  }
  function pause() {
    playing = false;
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    paint();
    syncWake();
  }
  function toggle() {
    if (playing) pause();
    else play();
  }
  window.osmosisAutoScrollToggle = toggle;
  window.osmosisAutoScrollStart = play;
  window.osmosisAutoScrollStop = pause;

  function wire() {
    var t = $("asToggle");
    if (t) t.addEventListener("click", toggle);
    var stop = $("asStop");
    if (stop) {
      stop.addEventListener("click", pause);
      stop.addEventListener("touchstart", function (e) {
        e.preventDefault();
        pause();
      });
    }

    // Auto-scroll is started from the selection popup (＋ Scroll). While it's
    // drifting, a tap on the story stops it. We listen on TOUCHSTART (and
    // click, for mouse) because a click often never fires while the page is
    // moving under your finger. The tap is swallowed so it can't reach Focus
    // mode's double-tap-to-exit logic.
    var content = $("articleContent");
    if (content) {
      var stopIfDrifting = function (e) {
        if (!playing) return;
        if (
          e.target &&
          e.target.closest &&
          e.target.closest(
            "a,button,mark,.inline-bookmark,input,textarea,.as-speedpop",
          )
        )
          return;
        e.stopPropagation();
        pause();
      };
      content.addEventListener("touchstart", stopIfDrifting, { passive: true });
      content.addEventListener("click", stopIfDrifting);

      // Discreet, invisible start: a quick TWO-FINGER tap on the story toggles
      // the drift. Collides with nothing (selection, single-tap-stop, or
      // Focus's double-tap-exit all use one finger).
      var twoStart = 0;
      content.addEventListener(
        "touchstart",
        function (e) {
          twoStart = e.touches && e.touches.length === 2 ? Date.now() : 0;
        },
        { passive: true },
      );
      content.addEventListener(
        "touchend",
        function (e) {
          if (
            twoStart &&
            e.touches &&
            e.touches.length === 0 &&
            Date.now() - twoStart < 400
          ) {
            twoStart = 0;
            toggle();
          }
        },
        { passive: true },
      );
    }

    var s = $("asSpeed");
    if (s) {
      s.value = speed();
      s.addEventListener("input", function () {
        setSpeed(parseInt(s.value, 10));
      });
    }
    setSpeed(speed());
    paint();

    var k = $("keepAwakeToggle");
    if (k) {
      k.checked = ls(AWAKE_KEY, "1") !== "0";
      k.addEventListener("change", function () {
        try {
          localStorage.setItem(AWAKE_KEY, k.checked ? "1" : "0");
        } catch (e) {}
        syncWake();
      });
    }

    // Leaving the story stops the drift.
    var av = $("articleView");
    if (av && window.MutationObserver) {
      new MutationObserver(function () {
        if (!av.classList.contains("active")) pause();
        syncWake();
      }).observe(av, { attributes: true, attributeFilter: ["class"] });
    }
    syncWake();
  }

  // ---- Chronicle: jump up / down through a long record --------------
  function chronWire() {
    var tv = $("timelineView");
    var jump = $("chronJump");
    if (!tv || !jump) return;

    // One tap goes the whole way — top, or all the way to the bottom.
    function jumpTo(dir) {
      window.scrollTo({
        top:
          dir < 0
            ? 0
            : Math.max(
                document.documentElement.scrollHeight,
                document.body.scrollHeight,
              ),
        behavior: "smooth",
      });
    }
    var up = $("chronUp");
    if (up)
      up.addEventListener("click", function () {
        jumpTo(-1);
      });
    var down = $("chronDown");
    if (down)
      down.addEventListener("click", function () {
        jumpTo(1);
      });

    function refresh() {
      var on =
        tv.classList.contains("active") &&
        document.documentElement.scrollHeight > window.innerHeight + 200;
      jump.style.display = on ? "flex" : "none";
    }
    if (window.MutationObserver) {
      new MutationObserver(refresh).observe(tv, {
        attributes: true,
        attributeFilter: ["class"],
      });
      var body = $("journeyTimeline");
      if (body) new MutationObserver(refresh).observe(body, { childList: true });
    }
    window.addEventListener("resize", refresh);
    window.addEventListener("scroll", refresh, { passive: true });
    refresh();
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", function () {
      wire();
      chronWire();
    });
  else {
    wire();
    chronWire();
  }
})();
