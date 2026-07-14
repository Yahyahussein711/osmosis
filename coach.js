/* ============================================================
   Osmosis — Coachmarks: an interactive, game-style spotlight tour.
   Dims the screen, cuts a hole over a real element, and shows a
   small card explaining it. Tap anywhere (or Next) to advance.
   ------------------------------------------------------------
   • Home tour   → runs once on first load, over the nav bar.
   • Reading tour → runs the first time you open a story, over the
     real Focus / Notes / Back controls.
   Replay both from Settings.
   ============================================================ */
(function () {
  "use strict";

  var DONE_HOME = "osmosis_coach_home_done";
  var DONE_READ = "osmosis_coach_reading_done";

  var overlay, spot, tip;
  var steps = [],
    idx = 0,
    active = false,
    onDone = null,
    curTarget = null,
    curStep = null;

  function esc(x) {
    return String(x == null ? "" : x).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function q(sel) {
    if (!sel) return null;
    return typeof sel === "function" ? sel() : document.querySelector(sel);
  }

  function build() {
    if (overlay) return;
    overlay = document.createElement("div");
    overlay.className = "coach-overlay";
    spot = document.createElement("div");
    spot.className = "coach-spot";
    tip = document.createElement("div");
    tip.className = "coach-tip";
    overlay.appendChild(spot);
    overlay.appendChild(tip);
    document.body.appendChild(overlay);
    // Tap the dimmed area to advance; taps on the card do their own thing.
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay || e.target === spot) next();
    });
    tip.addEventListener("click", function (e) {
      e.stopPropagation();
    });
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
  }

  function start(list, done) {
    if (active) return;
    build();
    steps = list || [];
    idx = 0;
    onDone = done || null;
    active = true;
    overlay.style.display = "block";
    document.body.classList.add("coach-on");
    show();
  }
  function end() {
    if (!active) return;
    active = false;
    curTarget = null;
    curStep = null;
    if (overlay) overlay.style.display = "none";
    document.body.classList.remove("coach-on");
    var d = onDone;
    onDone = null;
    if (d) d();
  }
  function next() {
    if (!active) return;
    if (idx >= steps.length - 1) {
      end();
      return;
    }
    idx++;
    show();
  }
  function prev() {
    if (!active || idx === 0) return;
    idx--;
    show();
  }

  function show() {
    var s = steps[idx];
    if (!s) {
      end();
      return;
    }
    var t = s.target ? q(s.target) : null;
    if (s.target && !t) {
      // Element isn't here — skip rather than get stuck.
      next();
      return;
    }
    curTarget = t;
    curStep = s;
    if (t && t.scrollIntoView) {
      try {
        t.scrollIntoView({ block: "center", inline: "nearest" });
      } catch (e) {}
    }
    renderTip(s);
    requestAnimationFrame(function () {
      requestAnimationFrame(position);
    });
  }

  function dotsHtml(total, i) {
    var out = "";
    for (var k = 0; k < total; k++) {
      out += '<span class="coach-dot' + (k === i ? " on" : "") + '"></span>';
    }
    return out;
  }

  function renderTip(s) {
    var total = steps.length;
    var last = idx >= total - 1;
    tip.innerHTML =
      '<div class="coach-eyebrow">' +
      esc(s.eyebrow || "Step " + (idx + 1)) +
      "</div>" +
      '<div class="coach-title">' +
      esc(s.title || "") +
      "</div>" +
      '<div class="coach-text">' +
      (s.text || "") +
      "</div>" +
      '<div class="coach-foot">' +
      '<button class="coach-skip" type="button">Skip</button>' +
      '<div class="coach-dots">' +
      dotsHtml(total, idx) +
      "</div>" +
      '<div class="coach-nav">' +
      (idx > 0 ? '<button class="coach-back" type="button">Back</button>' : "") +
      '<button class="coach-next" type="button">' +
      (last ? "Done" : "Next") +
      "</button>" +
      "</div>" +
      "</div>";
    tip.querySelector(".coach-skip").addEventListener("click", function (e) {
      e.stopPropagation();
      end();
    });
    tip.querySelector(".coach-next").addEventListener("click", function (e) {
      e.stopPropagation();
      next();
    });
    var b = tip.querySelector(".coach-back");
    if (b)
      b.addEventListener("click", function (e) {
        e.stopPropagation();
        prev();
      });
  }

  function position() {
    if (!active) return;
    if (curTarget) {
      var r = curTarget.getBoundingClientRect();
      var pad = 8;
      overlay.classList.remove("coach-centered");
      spot.style.display = "block";
      spot.style.left = r.left - pad + "px";
      spot.style.top = r.top - pad + "px";
      spot.style.width = r.width + pad * 2 + "px";
      spot.style.height = r.height + pad * 2 + "px";
      placeTip(r);
    } else {
      // A step with no target: center the card over a plain dim.
      overlay.classList.add("coach-centered");
      spot.style.display = "none";
      tip.style.left = "50%";
      tip.style.top = "50%";
      tip.style.transform = "translate(-50%, -50%)";
    }
  }

  function placeTip(r) {
    tip.style.transform = "";
    var vw = window.innerWidth,
      vh = window.innerHeight;
    var tw = tip.offsetWidth || 300;
    var th = tip.offsetHeight || 160;
    var top;
    if (r.bottom + 14 + th < vh - 10) {
      top = r.bottom + 14;
    } else if (r.top - 14 - th > 10) {
      top = r.top - 14 - th;
    } else {
      top = Math.max(10, vh - th - 10);
    }
    var left = r.left + r.width / 2 - tw / 2;
    left = Math.max(12, Math.min(left, vw - tw - 12));
    tip.style.left = left + "px";
    tip.style.top = top + "px";
  }

  // ---- Tours --------------------------------------------------------
  var HOME = [
    {
      target: "#navHome",
      eyebrow: "The Library",
      title: "Your shelf",
      text: "Every story lives here. This is home base — tap a story to start reading.",
    },
    {
      target: "#navTimeline",
      eyebrow: "The Chronicle",
      title: "Everything you've marked",
      text: "Your whole reading life — as a <b>journal</b>, <b>by story</b>, and as <b>patterns</b> about you.",
    },
    {
      target: "#navDashboard",
      eyebrow: "The Study",
      title: "Progress & review",
      text: "Your stats, the <b>Daily Review</b>, the <b>Parlour Game</b>, your honours, and the Common Thread.",
    },
    {
      target: "#navGenerator",
      eyebrow: "Create",
      title: "Write your own",
      text: "Add your own stories to read and mark up, right alongside the rest.",
    },
    {
      target: "#navMenuBtn",
      eyebrow: "Settings",
      title: "Make it yours",
      text: "Themes, reading size, <b>account sync</b>, backup — and you can replay this tour here anytime.",
    },
    {
      target: null,
      eyebrow: "You're set",
      title: "Open a story",
      text: "Tap any story in the Library and I'll point out the reading tools as you go.",
    },
  ];

  var READ = [
    {
      target: "#articleContent",
      eyebrow: "Read & Capture",
      title: "Select text to mark it",
      text: "Select any passage to <b>highlight</b> it, attach a <b>note</b>, drop a <b>bookmark</b>, or <b>define</b> a word.",
    },
    {
      target: "#startDeepWorkBtn",
      eyebrow: "Focus",
      title: "Deep Work",
      text: "Start a distraction-free session — the page clears, a timer runs, and your desk time is logged.",
    },
    {
      target: "#topNotesBtn",
      eyebrow: "The Workstation",
      title: "Notes & reflections",
      text: "Open your writing desk to manage notes and write <b>guided reflections</b>. Swipe it down to close.",
    },
    {
      target: "#backToPrevious",
      eyebrow: "Done reading?",
      title: "Head back",
      text: "Tap Back — or <b>swipe right</b> from the left edge — to slide the story away and return to the Library.",
    },
  ];

  function startHomeTour() {
    start(HOME, function () {
      try {
        localStorage.setItem(DONE_HOME, "1");
      } catch (e) {}
    });
  }
  var readingArmed = false;
  function maybeReadingTour() {
    if (active) return;
    var done = false;
    try {
      done = localStorage.getItem(DONE_READ) === "1";
    } catch (e) {}
    if (done || readingArmed) return;
    readingArmed = true;
    setTimeout(function () {
      var av = document.getElementById("articleView");
      if (!av || !av.classList.contains("active")) {
        readingArmed = false;
        return;
      }
      start(READ, function () {
        try {
          localStorage.setItem(DONE_READ, "1");
        } catch (e) {}
      });
    }, 650);
  }

  // Replay entry point (from Settings): reset and run from the top.
  window.osmosisStartTour = function () {
    try {
      localStorage.removeItem(DONE_HOME);
      localStorage.removeItem(DONE_READ);
    } catch (e) {}
    readingArmed = false;
    if (active) end();
    startHomeTour();
  };

  // ---- boot & triggers ---------------------------------------------
  function boot() {
    // Watch for the reading view becoming active → fire the reading tour once.
    var av = document.getElementById("articleView");
    if (av && window.MutationObserver) {
      new MutationObserver(function () {
        if (av.classList.contains("active")) maybeReadingTour();
      }).observe(av, { attributes: true, attributeFilter: ["class"] });
      if (av.classList.contains("active")) maybeReadingTour();
    }

    // First-run home tour (only when we're actually on the Library, not
    // resumed straight into a story).
    var homeDone = true;
    try {
      homeDone = localStorage.getItem(DONE_HOME) === "1";
    } catch (e) {}
    if (!homeDone) {
      setTimeout(function () {
        var art = document.getElementById("articleView");
        if (art && art.classList.contains("active")) return; // reading tour will run
        startHomeTour();
      }, 800);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
