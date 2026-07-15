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
  function paint() {
    var b = $("asToggle");
    if (b) {
      b.textContent = playing ? "❚❚" : "▶";
      b.classList.toggle("on", playing);
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
  function showDock(on) {
    var d = $("autoScrollDock");
    if (!d) return;
    if (!on) pause();
    d.style.display = on ? "flex" : "none";
    if (on) wake();
  }

  // The control shouldn't sit on the page while you read: it fades out after
  // a beat and comes back on any touch, tap or scroll.
  var hideT = null;
  function wake() {
    var d = $("autoScrollDock");
    if (!d || d.style.display === "none") return;
    d.classList.remove("faded");
    clearTimeout(hideT);
    hideT = setTimeout(function () {
      d.classList.add("faded");
    }, 1200);
  }
  window.osmosisAutoScrollToggle = toggle;

  function wire() {
    var t = $("asToggle");
    if (t)
      t.addEventListener("click", function () {
        toggle();
        wake();
      });
    // Only a deliberate tap brings it back — scrolling never does, so it
    // never flickers while you're actually reading.
    document.addEventListener("click", wake, { passive: true });
    var s = $("asSpeed");
    if (s) {
      s.value = speed();
      s.addEventListener("input", function () {
        setSpeed(parseInt(s.value, 10));
      });
    }
    setSpeed(speed());
    paint();
    showDock(artActive());

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

    // The play button lives with the story: it appears in the reading view
    // and leaving the story stops everything.
    var av = $("articleView");
    if (av && window.MutationObserver) {
      new MutationObserver(function () {
        showDock(av.classList.contains("active"));
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
