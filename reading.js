/* ============================================================
   Osmosis — reading helpers.
   • Screen wake lock so the phone stops sleeping while you read.
   • Chronicle: jump to the very top / bottom of a long record.
   ============================================================ */
(function () {
  "use strict";

  var AWAKE_KEY = "osmosis_keep_awake";
  var wl = null;

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
    return artActive();
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

  function wire() {
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
    var av = $("articleView");
    if (av && window.MutationObserver) {
      new MutationObserver(syncWake).observe(av, {
        attributes: true,
        attributeFilter: ["class"],
      });
    }
    syncWake();
  }

  // ---- Chronicle: jump to the very top / bottom of a long record ----
  function chronWire() {
    var tv = $("timelineView");
    var jump = $("chronJump");
    if (!tv || !jump) return;

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
