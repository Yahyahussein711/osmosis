/* ============================================================
   Osmosis — Coachmarks: an interactive, game-style spotlight tour
   that walks through LITERALLY every page and tool.
   Dims the screen, cuts a hole over a real element, explains it,
   and can navigate between pages / open the workstation itself.
   Tap the dim (or Next) to advance; Skip ends it and won't nag.
   ============================================================ */
(function () {
  "use strict";

  var DONE = "osmosis_coach_done";

  var overlay, spot, tip;
  var steps = [],
    idx = 0,
    active = false,
    onDone = null,
    curTarget = null,
    curStep = null,
    token = 0;

  function esc(x) {
    return String(x == null ? "" : x).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function q(sel) {
    if (!sel) return null;
    return typeof sel === "function" ? sel() : document.querySelector(sel);
  }
  function visible(el) {
    if (!el) return false;
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }
  function waitFor(sel, timeout) {
    return new Promise(function (res) {
      if (!sel) {
        res(null);
        return;
      }
      var t0 = Date.now();
      (function poll() {
        var el = q(sel);
        if (el && visible(el)) {
          res(el);
          return;
        }
        if (Date.now() - t0 > timeout) {
          res(el && visible(el) ? el : null);
          return;
        }
        setTimeout(poll, 70);
      })();
    });
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
    token++;
    curTarget = null;
    curStep = null;
    if (overlay) overlay.style.display = "none";
    document.body.classList.remove("coach-on");
    // Clean up anything the tour opened.
    if (
      document.body.classList.contains("drawer-active") &&
      typeof window.closeNotesDrawer === "function"
    ) {
      try {
        window.closeNotesDrawer();
      } catch (e) {}
    }
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
    var my = ++token;
    // While we transition, just dim (drop the stale spotlight/card).
    overlay.classList.add("coach-centered");
    spot.style.display = "none";
    tip.style.visibility = "hidden";
    Promise.resolve()
      .then(function () {
        return s.pre ? s.pre() : null;
      })
      .then(function () {
        // small settle so a freshly-navigated view can lay out
        return new Promise(function (r) {
          setTimeout(r, s.pre ? 260 : 0);
        });
      })
      .then(function () {
        if (my !== token) return; // superseded (user advanced/skipped)
        return waitFor(s.target, s.pre ? 2000 : 1200);
      })
      .then(function (t) {
        if (my !== token) return;
        if (s.target && !t) {
          next();
          return;
        } // never appeared → skip
        curTarget = t;
        curStep = s;
        if (t) {
          try {
            t.scrollIntoView({ block: "center", inline: "nearest" });
          } catch (e) {}
        }
        renderTip(s);
        tip.style.visibility = "visible";
        requestAnimationFrame(function () {
          requestAnimationFrame(position);
        });
      });
  }

  function progressHtml(total, i) {
    if (total > 8) {
      return '<div class="coach-count">' + (i + 1) + " / " + total + "</div>";
    }
    var out = '<div class="coach-dots">';
    for (var k = 0; k < total; k++) {
      out += '<span class="coach-dot' + (k === i ? " on" : "") + '"></span>';
    }
    return out + "</div>";
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
      '<button class="coach-skip" type="button">Skip tour</button>' +
      progressHtml(total, idx) +
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
    if (curTarget && visible(curTarget)) {
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
    var th = tip.offsetHeight || 170;
    var top;
    if (r.bottom + 14 + th < vh - 10) top = r.bottom + 14;
    else if (r.top - 14 - th > 10) top = r.top - 14 - th;
    else top = Math.max(10, vh - th - 10);
    var left = r.left + r.width / 2 - tw / 2;
    left = Math.max(12, Math.min(left, vw - tw - 12));
    tip.style.left = left + "px";
    tip.style.top = top + "px";
  }

  // ---- navigation helpers used by steps ----------------------------
  function clickNav(id) {
    return function () {
      var b = document.getElementById(id);
      if (b) b.click();
    };
  }
  function goLibrary() {
    if (typeof window.goToExploreView === "function") window.goToExploreView();
    else clickNav("navHome")();
  }
  function clickLens(name) {
    return function () {
      var b = document.querySelector('.chron-lens[data-lens="' + name + '"]');
      if (b) b.click();
    };
  }
  function firstCard() {
    var g = document.getElementById("articlesGrid");
    if (!g) return null;
    var kids = g.children;
    for (var i = 0; i < kids.length; i++) {
      if (kids[i].id && kids[i].id.indexOf("tip_") === 0) continue;
      if (visible(kids[i])) return kids[i];
    }
    return null;
  }
  function openStory() {
    var av = document.getElementById("articleView");
    if (av && av.classList.contains("active")) return;
    try {
      var td = window.topicsData;
      for (var d in td) {
        var subs = td[d].subtopics;
        for (var su in subs) {
          var arts = subs[su].articles;
          for (var a in arts) {
            if (typeof window.navigateToArticle === "function") {
              window.navigateToArticle(d, su, a);
              return;
            }
          }
        }
      }
    } catch (e) {}
  }
  function openWSReflection() {
    if (typeof window.openNotesDrawer === "function") window.openNotesDrawer(0);
  }
  function switchWSNotes() {
    var b = document.querySelector(
      '#mainCarouselTabs .drawer-tab[data-step="1"]',
    );
    if (b) b.click();
  }
  function finishTour() {
    if (typeof window.closeNotesDrawer === "function") {
      try {
        window.closeNotesDrawer();
      } catch (e) {}
    }
    goLibrary();
  }

  // ---- the full tour ------------------------------------------------
  var TOUR = [
    {
      pre: goLibrary,
      target: "#navHome",
      eyebrow: "The Library",
      title: "Your shelf",
      text: "Home base. Every story lives here — tap one to read it.",
    },
    {
      target: firstCard,
      eyebrow: "The Library",
      title: "Story cards",
      text: "Each card shows its read time, your <b>progress</b>, and how many notes you've made. Finished ones dim so the unread stand out.",
    },
    {
      pre: clickNav("navGenerator"),
      target: "#navGenerator",
      eyebrow: "Create",
      title: "Write your own",
      text: "Add your own stories — a title, a hook, and content. They sit right alongside the rest, fully markable.",
    },
    {
      pre: clickNav("navTimeline"),
      target: "#navTimeline",
      eyebrow: "The Chronicle",
      title: "Your reading life",
      text: "Everything you've ever marked — seen through three lenses.",
    },
    {
      pre: clickLens("journal"),
      target: '.chron-lens[data-lens="journal"]',
      eyebrow: "Chronicle · Journal",
      title: "The timeline",
      text: "A dated stream of every highlight, note, reflection and bookmark. Search it, favourite entries, and scrub through time.",
    },
    {
      pre: clickLens("stories"),
      target: '.chron-lens[data-lens="stories"]',
      eyebrow: "Chronicle · By Story",
      title: "Story dossiers",
      text: "Everything you did in each story, gathered into an expandable dossier grouped by type — with a tap back to any mark.",
    },
    {
      pre: clickLens("patterns"),
      target: '.chron-lens[data-lens="patterns"]',
      eyebrow: "Chronicle · Patterns",
      title: "Your reading character",
      text: "A portrait of you as a reader — an <b>archetype</b>, plus charts for your week, your hours, your cadence, authors and more.",
    },
    {
      pre: clickNav("navDashboard"),
      target: ".study-review",
      eyebrow: "The Study · Daily Review",
      title: "Spaced repetition",
      text: "Your reflections resurface on a widening schedule so they never fade. Recall, reveal what you wrote, then rate how it lands.",
    },
    {
      target: "#parlourCard",
      eyebrow: "The Study · For Fun",
      title: "The Parlour Game",
      text: "A quiz built from what you've <b>actually read</b> — passages, authors, your own margins. Build a streak, use 50/50.",
    },
    {
      target: "#honoursCard",
      eyebrow: "The Study · Rewards",
      title: "Honours & ranks",
      text: "Earn stamped seals for milestones, each worth points that carry a rank. Tap to open the whole cabinet.",
    },
    {
      target: "#marginsCard",
      eyebrow: "The Study · Serendipity",
      title: "The Common Thread",
      text: "Two passages you marked in <b>different stories</b> that share an idea — the invisible threads through your reading.",
    },
    {
      pre: clickNav("navMenuBtn"),
      target: ".settings-masthead",
      eyebrow: "Settings",
      title: "Make it yours",
      text: "Switch themes, tune reading size and voice, and export or import your whole library as a backup.",
    },
    {
      pre: openStory,
      target: "#articleContent",
      eyebrow: "Read & Capture",
      title: "Select text to mark it",
      text: "While reading, select any passage to <b>highlight</b> it, add a <b>note</b>, drop a <b>bookmark</b>, or <b>define</b> a word.",
    },
    {
      target: "#startDeepWorkBtn",
      eyebrow: "Reading · Focus",
      title: "Deep Work",
      text: "Start a distraction-free session — the page clears, a timer runs, and your time at the desk is logged.",
    },
    {
      target: "#topNotesBtn",
      eyebrow: "Reading · Workstation",
      title: "Your writing desk",
      text: "This opens the workstation — where you manage every note you've made. Let's open it.",
    },
    {
      pre: openWSReflection,
      target: "#noteGuideBtn",
      eyebrow: "The Workstation · Notes",
      title: "Guided notes",
      text: "Facing a blank note? Tap <b>✦ Guide me</b> — pick a lens, answer with tap-in starters, and press further to go deeper. Swipe the sheet down to close it.",
    },
    {
      pre: finishTour,
      target: null,
      eyebrow: "Gestures · That's everything",
      title: "You know it all now",
      text: "Pull any sheet <b>down</b> to close it, and swipe a story <b>right</b> from the left edge to exit. Now — pick a story and begin.",
    },
  ];

  function startTour() {
    start(TOUR, function () {
      try {
        localStorage.setItem(DONE, "1");
      } catch (e) {}
    });
  }

  window.osmosisStartTour = function () {
    try {
      localStorage.removeItem(DONE);
    } catch (e) {}
    if (active) end();
    setTimeout(startTour, 60);
  };

  function boot() {
    var done = true;
    try {
      done = localStorage.getItem(DONE) === "1";
    } catch (e) {}
    if (!done) {
      setTimeout(startTour, 900);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
