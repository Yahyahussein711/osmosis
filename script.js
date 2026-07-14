// ============================================================
// OSMOSIS — script.js
// Requires: window.topicsData and window.pathsData from content.js
// ============================================================

// ============================================================
// DASHBOARD SYSTEM
// ============================================================
function renderDashboard() {
  const timeline = userLearningJourney.timeline || [];
  const principles = getPrinciples();
  const readArticles = Object.values(userLearningJourney.topics).reduce((sum, t) => sum + (t.readArticles?.length || 0), 0);

  // Calculate stats
  const stats = {
    articles: readArticles,
    highlights: timeline.filter(t => t.type === "Highlight").length,
    notes: timeline.filter(t => t.type === "Note").length,
    reflections: timeline.filter(t => t.type === "Reflection").length,
    principles: principles.length,
    totalEvidence: principles.reduce((sum, p) => sum + p.evidence.length, 0)
  };

  // Update stat cards (note: Highlights count includes both Highlights and Notes)
  document.getElementById("dashArticlesCount").textContent = stats.articles;
  document.getElementById("dashHighlightsCount").textContent = stats.highlights + stats.notes;
  document.getElementById("dashReflectionsCount").textContent = stats.reflections;

  // Update label to be accurate
  const highlightsLabel = document.querySelector("#dashHighlightsCount")?.parentElement?.querySelector("div:last-child");
  if (highlightsLabel) highlightsLabel.textContent = "Notes & Highlights";

  // Calculate streak
  const today = new Date().toISOString().split('T')[0];
  const recentDays = new Set();
  timeline.forEach(item => {
    const date = new Date(item.date).toISOString().split('T')[0];
    recentDays.add(date);
  });

  let streak = 0;
  let currentDate = new Date();
  while (true) {
    const dateStr = currentDate.toISOString().split('T')[0];
    if (recentDays.has(dateStr)) {
      streak++;
      currentDate.setDate(currentDate.getDate() - 1);
    } else if (dateStr === today) {
      currentDate.setDate(currentDate.getDate() - 1);
    } else {
      break;
    }
  }

  // Render heatmap
  renderHeatmap();

  // Render dashboard cards
  renderDashboardCards();

  // Calculate achievements for progress display
  const allAchievements = [
    { label: "5 Articles", current: stats.articles, target: 5 },
    { label: "10 Highlights", current: stats.highlights + stats.notes, target: 10 },
    { label: "10 Evidence Items", current: stats.totalEvidence, target: 10 },
    { label: "7 Day Streak", current: streak, target: 7 }
  ];

  // Populate detail sections
  populateDashboardDetails(stats, timeline, [], [], streak, allAchievements);
}
// DASHBOARD — "The Study": stats ledger, Daily Review, and three living
// pieces that reward a visit: your own margins resurfaced, a personal
// parlour quiz on what you've read, and an honours ladder. Plus the heatmap.
function renderDashboardCards() {
  const grid = document.getElementById("dashboardCardsGrid");
  if (!grid) return;

  const timeline = userLearningJourney.timeline || [];
  const stories = Object.values(userLearningJourney.topics || {}).reduce(
    (s, t) => s + (t.readArticles ? t.readArticles.length : 0),
    0,
  );
  const highlights = timeline.filter((t) => t.type === "Highlight").length;
  const notes = timeline.filter((t) => t.type === "Note").length;
  const reflections = timeline.filter((t) => t.type === "Reflection").length;
  const dueCount = getDueReviewItems().length;
  const streak =
    typeof calcStreak === "function" ? calcStreak() : { current: 0, longest: 0 };
  const deskSec = typeof getDeskSeconds === "function" ? getDeskSeconds() : 0;

  // Time-aware greeting up top
  const greet = document.getElementById("studyGreeting");
  if (greet) {
    const hr = new Date().getHours();
    const tod =
      hr < 11 ? "Good morning" : hr < 17 ? "Good afternoon" : hr < 22 ? "Good evening" : "A late hour";
    let line;
    if (dueCount)
      line = `${tod}. ${dueCount} reflection${dueCount === 1 ? "" : "s"} to revisit.`;
    else if (!stories) line = `${tod}. Your study is bare — read a story to begin.`;
    else line = `${tod}. Nothing due today — read on, or revisit your margins.`;
    greet.textContent = line;
  }

  const ledgerStat = (n, l) =>
    `<div class="study-stat"><div class="study-stat-num">${n}</div><div class="study-stat-name">${l}</div></div>`;

  const metaParts = [];
  if (deskSec >= 60) metaParts.push(`${formatDeskTime(deskSec)} at the desk`);
  if (streak.current > 0)
    metaParts.push(
      `${streak.current}-day streak${streak.longest > streak.current ? ` · best ${streak.longest}` : ""}`,
    );
  const meta = metaParts.length
    ? `<div class="study-ledger-meta">— ${metaParts.join(" · ")} —</div>`
    : "";

  grid.innerHTML = `
    <section class="study-block">
      <div class="study-sec-label">The Ledger</div>
      <div class="study-ledger">
        ${ledgerStat(stories, "Stories")}
        <div class="study-ledger-div" aria-hidden="true"></div>
        ${ledgerStat(highlights, "Highlights")}
        <div class="study-ledger-div" aria-hidden="true"></div>
        ${ledgerStat(notes, "Notes")}
        <div class="study-ledger-div" aria-hidden="true"></div>
        ${ledgerStat(reflections, "Reflections")}
      </div>
      ${meta}
    </section>

    <div class="study-feature study-review" onclick="openReviewSession()">
      <div class="study-review-left">
        <div class="study-feature-label">Daily Review</div>
        <div class="study-feature-num">${dueCount}</div>
        <div class="study-feature-sub">${dueCount ? (dueCount === 1 ? "reflection to revisit" : "reflections to revisit") : "all caught up"}</div>
      </div>
      <div class="study-review-right">
        <div class="study-review-blurb">${dueCount ? "Sit again with what you wrote — remember it, and deepen it." : "Nothing to revisit. Your reflections will return in time."}</div>
        <div class="study-feature-cta">${dueCount ? "Begin the session →" : "Come back tomorrow"}</div>
      </div>
    </div>

    <section class="study-block">
      <div class="study-sec-label">Activity <span class="study-sec-sub">last 28 days</span></div>
      <div class="study-activity"><div id="habitHeatmap" class="heatmap-grid"></div></div>
    </section>

    <div class="study-feature mg-card" id="marginsCard"></div>

    <div class="study-actions">
      <div class="study-feature pg-card" id="parlourCard"></div>
      <div class="study-feature hn-card" id="honoursCard"></div>
    </div>
  `;

  renderHeatmap();
  renderMarginsCard();
  renderParlourCard();
  renderHonoursCard();
}
// ---- From your margins: your own words, resurfaced ----
function _marginItems() {
  return (userLearningJourney.timeline || []).filter(
    (t) =>
      (isType(t.type, "Highlight") ||
        isType(t.type, "Note") ||
        isType(t.type, "Reflection")) &&
      t.text &&
      t.text.trim().length > 15,
  );
}
let _marginsIdx = null;
// "3 weeks ago" style timestamps make an old margin feel like a memory
function _relTime(dateStr) {
  const days = Math.floor((Date.now() - new Date(dateStr)) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) {
    const w = Math.round(days / 7);
    return `${w} week${w === 1 ? "" : "s"} ago`;
  }
  if (days < 365) {
    const m = Math.round(days / 30);
    return `${m} month${m === 1 ? "" : "s"} ago`;
  }
  const y = Math.round(days / 365);
  return `${y} year${y === 1 ? "" : "s"} ago`;
}
const _mgTrim = (s, n) => {
  const t = s.replace(/\s+/g, " ").trim().replace(/^"|"$/g, "");
  return t.length > n ? t.slice(0, n) + "…" : t;
};
const _THR_STOP = new Set(
  "about above after again against almost alone along already although always among another around because become before began being below beside better between beyond called cannot could during either enough every everything first found great himself herself myself never nothing often other others perhaps rather really seemed shall should since something still such their there these thing things think third those though three through toward under until upon using where which while whole whose without would years young".split(" "),
);
let _threadIdx = null;

// Find pairs of passages you marked in DIFFERENT stories that share a
// meaningful word — the invisible threads running through your reading.
function _buildThreads() {
  const quotes = [];
  (userLearningJourney.timeline || []).forEach((t) => {
    if (
      !(
        isType(t.type, "Highlight") ||
        isType(t.type, "Note") ||
        isType(t.type, "Reflection")
      )
    )
      return;
    if (!t.text || !t.article) return;
    let raw = t.text.replace(/^\[(Path|Capstone):[^\]]*\]\s*/, "");
    let quote = raw;
    if (raw.includes('\n\n"')) quote = raw.split('\n\n"').slice(1).join('\n\n"');
    quote = quote.replace(/^"|"$/g, "").replace(/\s+/g, " ").trim();
    if (quote.length < 20) return;
    quotes.push({ article: t.article, domain: t.domain, date: t.date, quote });
  });
  const idx = {};
  quotes.forEach((q, i) => {
    const words = new Set(q.quote.toLowerCase().match(/[a-zà-ÿ']{5,}/g) || []);
    words.forEach((w) => {
      if (_THR_STOP.has(w)) return;
      (idx[w] = idx[w] || new Set()).add(i);
    });
  });
  const threads = [];
  Object.keys(idx).forEach((w) => {
    const byArt = {};
    [...idx[w]].forEach((i) => {
      const a = quotes[i].article;
      if (byArt[a] === undefined) byArt[a] = i;
    });
    const arts = Object.keys(byArt);
    if (arts.length >= 2) {
      threads.push({
        word: w,
        a: quotes[byArt[arts[0]]],
        b: quotes[byArt[arts[1]]],
        span: arts.length,
      });
    }
  });
  // Prefer specific words (present in few stories) and longer words.
  threads.sort((x, y) => x.span - y.span || y.word.length - x.word.length);
  return threads;
}

function _renderThread(el, thr) {
  const esc = (x) => (typeof _chronEsc === "function" ? _chronEsc(x) : x);
  const hi = (text) => {
    const t = esc(_mgTrim(text, 150));
    const re = new RegExp(
      "(" + thr.word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")",
      "ig",
    );
    return t.replace(re, '<mark class="thr-mark">$1</mark>');
  };
  const q = (m, key) =>
    `<blockquote class="thr-quote" data-domain="${(m.domain || "").replace(/"/g, "&quot;")}" data-article="${(m.article || "").replace(/"/g, "&quot;")}" data-date="${m.date}">“${hi(m.quote)}”<cite>${esc(m.article)}</cite></blockquote>`;
  el.innerHTML = `
    <div class="study-feature-label">The Common Thread</div>
    <div class="thr-intro">Across two stories, you kept circling the same idea.</div>
    ${q(thr.a)}
    <div class="thr-link"><span></span><em>the thread</em> · ${esc(thr.word)}<span></span></div>
    ${q(thr.b)}
    <div class="mg-actions">
      <button class="text-btn" onclick="event.stopPropagation(); showAnotherMargin()">Another thread ↻</button>
    </div>`;
  el.querySelectorAll(".thr-quote").forEach((b) => {
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      if (typeof jumpToArticleByDomainAndName === "function")
        jumpToArticleByDomainAndName(
          b.dataset.domain || "",
          b.dataset.article || "",
          b.dataset.date || null,
        );
    });
  });
}

function renderMarginsCard(step) {
  const el = document.getElementById("marginsCard");
  if (!el) return;
  const threads = _buildThreads();
  if (threads.length) {
    if (_threadIdx === null)
      _threadIdx = Math.floor(Date.now() / 86400000) % threads.length;
    if (step) _threadIdx = (_threadIdx + 1) % threads.length;
    _renderThread(el, threads[_threadIdx % threads.length]);
    return;
  }
  _renderMarginSingle(step);
}

function _renderMarginSingle(step) {
  const el = document.getElementById("marginsCard");
  if (!el) return;
  const items = _marginItems();
  if (!items.length) {
    el.innerHTML = `
      <div class="study-feature-label">From Your Margins</div>
      <div class="mg-quote mg-empty">Highlight and note passages as you read — your own words will resurface here.</div>`;
    return;
  }
  if (_marginsIdx === null)
    _marginsIdx = Math.floor(Date.now() / 86400000) % items.length;
  if (step) _marginsIdx = (_marginsIdx + 1) % items.length;
  const it = items[_marginsIdx];
  const raw = (it.text || "").replace(/^\[(Path|Capstone):[^\]]*\]\s*/, "");

  // Notes are stored as `your note\n\n"quoted passage"` — show both
  // halves distinctly: the passage as a quote, your words beneath it.
  let bodyHtml;
  if (raw.includes('\n\n"')) {
    const parts = raw.split('\n\n"');
    const note = _mgTrim(parts[0], 140);
    const quote = _mgTrim(parts[1], 150);
    bodyHtml = `
      <div class="mg-quote">“${quote}”</div>
      <div class="mg-note"><span>You wrote</span>${note}</div>`;
  } else {
    bodyHtml = `<div class="mg-quote">“${_mgTrim(raw, 170)}”</div>`;
  }

  const kind = isType(it.type, "Reflection")
    ? "Reflection"
    : isType(it.type, "Note")
      ? "Note"
      : "Highlight";
  const fav = it.isFavorite === true;

  el.innerHTML = `
    <div class="mg-head">
      <div class="study-feature-label">From Your Margins</div>
      <span class="mg-kind">${kind} · ${_relTime(it.date)}</span>
    </div>
    ${bodyHtml}
    <div class="mg-meta">${it.article ? `${it.article} · ` : ""}${_marginsIdx + 1} of ${items.length}</div>
    <div class="mg-actions">
      <button class="text-btn" onclick="event.stopPropagation(); showAnotherMargin()">Another ↻</button>
      ${it.article ? `<button class="text-btn" onclick="event.stopPropagation(); openMarginItem()">Open in story →</button>` : ""}
      <button class="text-btn mg-fav ${fav ? "on" : ""}" title="Favorite" onclick="event.stopPropagation(); toggleMarginFav()">♥︎</button>
    </div>`;
}
function showAnotherMargin() {
  renderMarginsCard(true);
}
function toggleMarginFav() {
  const it = _marginItems()[_marginsIdx];
  if (!it) return;
  if (typeof toggleTimelineFavorite === "function")
    toggleTimelineFavorite(it.date);
  renderMarginsCard(false);
}
window.toggleMarginFav = toggleMarginFav;
function openMarginItem() {
  const it = _marginItems()[_marginsIdx];
  if (!it || !it.article) return;
  if (typeof jumpToArticleByDomainAndName === "function") {
    jumpToArticleByDomainAndName(it.domain, it.article, it.date);
  }
}
window.showAnotherMargin = showAnotherMargin;
window.openMarginItem = openMarginItem;
// ---- The Parlour Game: a quiz built from your own reading ----
// Question types: "which story is this passage from?", "who wrote X?",
// and "which story did you highlight this in?". Tracks your run and
// best run, so there's always a score to beat.
function _readStoriesList() {
  const out = [];
  Object.keys(userLearningJourney.topics || {}).forEach((d) => {
    (userLearningJourney.topics[d].readArticles || []).forEach((name) => {
      const dom = window.topicsData?.[d];
      if (!dom) return;
      Object.keys(dom.subtopics || {}).forEach((s) => {
        const art = dom.subtopics[s].articles?.[name];
        if (art && art.content) out.push({ domain: d, sub: s, name, art });
      });
    });
  });
  return out;
}
function _allStoryNames() {
  const names = [];
  Object.keys(window.topicsData || {}).forEach((d) => {
    Object.keys(window.topicsData[d].subtopics || {}).forEach((s) => {
      Object.keys(window.topicsData[d].subtopics[s].articles || {}).forEach(
        (a) => names.push(a),
      );
    });
  });
  return names;
}
function _pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function _distractors(correct, pool, n) {
  const others = [...new Set(pool.filter((x) => x && x !== correct))];
  const out = [];
  while (out.length < n && others.length) {
    out.push(others.splice(Math.floor(Math.random() * others.length), 1)[0]);
  }
  return out;
}
function _cleanSentence(content) {
  const text = content
    .replace(/[#>*_`]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .filter((x) => x.length >= 60 && x.length <= 220);
  return sentences.length ? _pick(sentences) : null;
}

function _pgShuffle(a) {
  return a
    .map((x) => ({ x, r: Math.random() }))
    .sort((p, q) => p.r - q.r)
    .map((o) => o.x);
}
function _pgReflections() {
  const out = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.endsWith("_reflections")) continue;
    let arr;
    try {
      arr = JSON.parse(localStorage.getItem(k) || "[]");
    } catch (e) {
      continue;
    }
    if (!Array.isArray(arr)) continue;
    arr.forEach((r) => {
      if (r && r.text && r.text.trim().length > 25 && r.article) out.push(r);
    });
  }
  return out;
}
function _pgReaction(run) {
  if (run >= 12) return "Unstoppable — a scholar's recall.";
  if (run >= 9) return "On fire.";
  if (run >= 6) return "A sharp memory.";
  if (run >= 3) return "Warming up.";
  return "";
}

let _pgQuestion = null;
let _pgRun = 0;
let _pgScore = 0;
function _buildParlourQuestion() {
  const read = _readStoriesList();
  const allNames = _allStoryNames();
  const nd = _pgRun >= 3 ? 3 : 2; // gets harder (4 choices) once you're hot

  const authored = read.filter((r) => r.art.author);
  const allAuthors = [...new Set(read.map((r) => r.art.author).filter(Boolean))];
  const hls = (userLearningJourney.timeline || []).filter(
    (t) =>
      (isType(t.type, "Highlight") || isType(t.type, "Note")) &&
      t.text &&
      t.article &&
      t.text.trim().length > 30,
  );
  const refs = _pgReflections();
  const byAuthor = {};
  authored.forEach((r) => {
    (byAuthor[r.art.author] = byAuthor[r.art.author] || []).push(r.name);
  });
  const multiAuthors = Object.keys(byAuthor).filter(
    (a) => [...new Set(byAuthor[a])].length >= 2,
  );

  const types = [];
  if (read.length && allNames.length >= nd + 1) types.push("passage", "finish");
  if (authored.length && allAuthors.length >= nd + 1) types.push("author");
  if (hls.length && allNames.length >= nd + 1) types.push("margin");
  if (refs.length && allNames.length >= nd + 1) types.push("reflection");
  if (multiAuthors.length && allNames.length >= 3) types.push("odd");
  if (!types.length) return null;
  const type = _pick(types);

  if (type === "author") {
    const r = _pick(authored);
    return {
      type,
      q: `Who wrote <em>${r.name}</em>?`,
      answer: r.art.author,
      choices: [r.art.author, ..._distractors(r.art.author, allAuthors, nd)],
    };
  }
  if (type === "margin") {
    const h = _pick(hls);
    let txt = h.text.replace(/\s+/g, " ").trim().replace(/^"|"$/g, "");
    if (txt.length > 140) txt = txt.slice(0, 140) + "…";
    return {
      type,
      q: `You marked this passage — in which story?<div class="pg-passage">“${txt}”</div>`,
      answer: h.article,
      choices: [h.article, ..._distractors(h.article, allNames, nd)],
    };
  }
  if (type === "reflection") {
    const rf = _pick(refs);
    let txt = rf.text.replace(/\s+/g, " ").trim();
    if (txt.length > 150) txt = txt.slice(0, 150) + "…";
    return {
      type,
      q: `You reflected this — on which story?<div class="pg-passage">“${txt}”</div>`,
      answer: rf.article,
      choices: [rf.article, ..._distractors(rf.article, allNames, nd)],
    };
  }
  if (type === "odd") {
    const a = _pick(multiAuthors);
    const two = _pgShuffle([...new Set(byAuthor[a])]).slice(0, 2);
    const others = authored
      .filter((r) => r.art.author !== a)
      .map((r) => r.name)
      .filter((n) => !two.includes(n));
    if (others.length) {
      const odd = _pick(others);
      return {
        type,
        q: `Two of these were written by the same hand — which is the odd one out?`,
        answer: odd,
        choices: [odd, ...two],
      };
    }
  }
  if (type === "finish") {
    for (let tries = 0; tries < 8; tries++) {
      const r = _pick(read);
      const sentence = _cleanSentence(r.art.content || "");
      if (!sentence) continue;
      const words = sentence.split(" ");
      if (words.length < 9) continue;
      const tail = _pick([3, 4]);
      const cut = words.length - tail;
      const stem = words.slice(0, cut).join(" ");
      const answer = words.slice(cut).join(" ").replace(/[.!?"'”’]+$/, "").trim();
      if (!answer || answer.length < 6) continue;
      const dist = [];
      for (let t = 0; t < 16 && dist.length < nd; t++) {
        const r2 = _pick(read);
        const s2 = _cleanSentence(r2.art.content || "");
        if (!s2) continue;
        const w2 = s2.split(" ");
        if (w2.length < 9) continue;
        const e = w2.slice(w2.length - _pick([3, 4])).join(" ").replace(/[.!?"'”’]+$/, "").trim();
        if (e && e.length >= 6 && e !== answer && !dist.includes(e)) dist.push(e);
      }
      if (dist.length < nd) continue;
      return {
        type,
        q: `Finish the line:<div class="pg-passage">“${stem} …”</div>`,
        answer,
        choices: [answer, ...dist],
      };
    }
  }
  // passage (default / fallback)
  for (let tries = 0; tries < 8; tries++) {
    const r = _pick(read);
    const sentence = _cleanSentence(r.art.content || "");
    if (!sentence) continue;
    return {
      type: "passage",
      q: `Which story is this from?<div class="pg-passage">“${sentence}”</div>`,
      answer: r.name,
      choices: [r.name, ..._distractors(r.name, allNames, nd)],
    };
  }
  return null;
}

function renderParlourCard(next) {
  const el = document.getElementById("parlourCard");
  if (!el) return;
  if (next || !_pgQuestion) _pgQuestion = _buildParlourQuestion();
  const best = parseInt(localStorage.getItem("osmosis_parlour_best")) || 0;

  if (!_pgQuestion) {
    el.innerHTML = `
      <div class="study-feature-label">The Parlour Game</div>
      <div class="mg-quote mg-empty">Finish a story or two and the game begins — you'll be quizzed on what you've read.</div>`;
    return;
  }
  const choices = _pgShuffle([..._pgQuestion.choices]);
  _pgQuestion.shuffled = choices;
  _pgQuestion.used5050 = false;

  const reaction = _pgReaction(_pgRun);
  const flame = _pgRun >= 3
    ? `<div class="pg-flame" style="--heat:${Math.min(1, _pgRun / 12)}">${"✦".repeat(Math.min(5, Math.floor(_pgRun / 3)))} <span>${reaction}</span></div>`
    : "";
  const show5050 = choices.length === 4;

  el.innerHTML = `
    <div class="study-feature-label">The Parlour Game</div>
    ${flame}
    <div class="pg-question">${_pgQuestion.q}</div>
    <div class="pg-choices">
      ${choices.map((c, i) => `<button class="pg-choice" onclick="event.stopPropagation(); answerParlour(${i})">${c}</button>`).join("")}
    </div>
    ${show5050 ? `<div class="pg-tools"><button class="pg-5050" id="pg5050" onclick="event.stopPropagation(); parlourFiftyFifty()">50 / 50</button></div>` : ""}
    <div class="pg-foot"><span>Run ${_pgRun}</span><span>Best ${best}</span><span>${_pgScore} pts</span></div>`;
}

function parlourFiftyFifty() {
  const el = document.getElementById("parlourCard");
  if (!el || !_pgQuestion || _pgQuestion.done || _pgQuestion.used5050) return;
  _pgQuestion.used5050 = true;
  const btns = [...el.querySelectorAll(".pg-choice")];
  const wrong = btns.filter(
    (b) => b.textContent !== _pgQuestion.answer,
  );
  _pgShuffle(wrong)
    .slice(0, 2)
    .forEach((b) => {
      b.disabled = true;
      b.classList.add("pg-dim");
    });
  const t = document.getElementById("pg5050");
  if (t) t.style.display = "none";
}

function answerParlour(i) {
  const el = document.getElementById("parlourCard");
  if (!el || !_pgQuestion || _pgQuestion.done) return;
  _pgQuestion.done = true;
  const chosen = _pgQuestion.shuffled[i];
  const right = chosen === _pgQuestion.answer;
  const btns = el.querySelectorAll(".pg-choice");
  btns.forEach((b, j) => {
    b.disabled = true;
    if (_pgQuestion.shuffled[j] === _pgQuestion.answer) b.classList.add("pg-right");
    else if (j === i) b.classList.add("pg-wrong");
    else b.classList.add("pg-dim");
  });
  let gained = 0;
  if (right) {
    _pgRun++;
    gained = 10 + (_pgRun - 1) * 5;
    _pgScore += gained;
    const best = parseInt(localStorage.getItem("osmosis_parlour_best")) || 0;
    if (_pgRun > best)
      localStorage.setItem("osmosis_parlour_best", String(_pgRun));
  } else {
    _pgRun = 0;
  }
  const best = parseInt(localStorage.getItem("osmosis_parlour_best")) || 0;
  const foot = el.querySelector(".pg-foot");
  if (foot)
    foot.innerHTML = `<span>Run ${_pgRun}</span><span>Best ${best}</span><span>${_pgScore} pts</span>`;
  const wrap = document.createElement("div");
  wrap.className = "pg-after";
  const verdict = right
    ? `<span class="pg-gain">+${gained}</span> ${_pgRun >= 3 ? _pgReaction(_pgRun) : "Correct."}`
    : `<span class="pg-miss">Missed</span> — the answer was “${_pgQuestion.answer}”.`;
  wrap.innerHTML = `<span class="pg-verdict">${verdict}</span><button class="text-btn pg-next" onclick="event.stopPropagation(); renderParlourCard(true)">${right ? "Next →" : "Again →"}</button>`;
  el.appendChild(wrap);
}
window.renderParlourCard = renderParlourCard;
window.answerParlour = answerParlour;
window.parlourFiftyFifty = parlourFiftyFifty;

// ---- Honours: seals, ranks & ceremonies (a real reward system) ----
// Every honour is a stamped seal worth points; points carry a RANK.
// New honours are announced with an award ceremony, and the full
// cabinet opens on tap. Earned dates persist in localStorage.
// ---- A soft chime to close a focus session ----
let _focusAudioCtx = null;
function ensureFocusAudio() {
  try {
    if (!_focusAudioCtx)
      _focusAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (_focusAudioCtx.state === "suspended") _focusAudioCtx.resume();
  } catch (e) {}
}
function playFocusChime() {
  try {
    if (localStorage.getItem("osmosis_focus_chime") === "0") return;
    if (!_focusAudioCtx) return;
    const ctx = _focusAudioCtx;
    const now = ctx.currentTime;
    // two gentle bell tones, a warm fifth apart
    [
      [523.25, 0],
      [783.99, 0.16],
    ].forEach(function (pair) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = pair[0];
      const t = now + pair[1];
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.1, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(t);
      o.stop(t + 1.9);
    });
  } catch (e) {}
}

// ---- Hours at the Desk: lifetime focused-reading time ----
function getDeskSeconds() {
  return parseInt(localStorage.getItem("osmosis_focus_seconds")) || 0;
}
function logDeskTime(sec) {
  try {
    localStorage.setItem(
      "osmosis_focus_seconds",
      String(getDeskSeconds() + Math.max(0, Math.round(sec))),
    );
  } catch (e) {}
}
function formatDeskTime(sec) {
  const m = Math.floor(sec / 60);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h > 0) return `${h} hr${h === 1 ? "" : "s"}${mm ? ` ${mm} min` : ""}`;
  return `${m} min`;
}

const HONOURS = [
  { id: "first_story", glyph: "Ⅰ", name: "First Story", desc: "Finish your first story.", pts: 10, test: (s) => s.read >= 1, prog: (s) => [s.read, 1] },
  { id: "five_stories", glyph: "Ⅴ", name: "Five Stories", desc: "Finish five stories.", pts: 25, test: (s) => s.read >= 5, prog: (s) => [s.read, 5] },
  { id: "fifteen_stories", glyph: "ⅩⅤ", name: "The Fifteen", desc: "Finish fifteen stories.", pts: 50, test: (s) => s.read >= 15, prog: (s) => [s.read, 15] },
  { id: "thirty_stories", glyph: "ⅩⅩⅩ", name: "The Thirty", desc: "Finish thirty stories.", pts: 100, test: (s) => s.read >= 30, prog: (s) => [s.read, 30] },
  { id: "ten_marks", glyph: "✎", name: "Ten Marks", desc: "Save ten highlights or notes.", pts: 20, test: (s) => s.marks >= 10, prog: (s) => [s.marks, 10] },
  { id: "fifty_marks", glyph: "✒", name: "Fifty Marks", desc: "Save fifty highlights or notes.", pts: 50, test: (s) => s.marks >= 50, prog: (s) => [s.marks, 50] },
  { id: "first_reflection", glyph: "❧", name: "First Reflection", desc: "Write your first reflection.", pts: 15, test: (s) => s.refl >= 1, prog: (s) => [s.refl, 1] },
  { id: "ten_reflections", glyph: "❦", name: "Deep Thinker", desc: "Write ten reflections.", pts: 40, test: (s) => s.refl >= 10, prog: (s) => [s.refl, 10] },
  { id: "week_streak", glyph: "Ⅶ", name: "A Week of Letters", desc: "Read seven days in a row.", pts: 40, test: (s) => s.longest >= 7, prog: (s) => [s.longest, 7] },
  { id: "month_streak", glyph: "☾", name: "A Month of Letters", desc: "Read thirty days in a row.", pts: 100, test: (s) => s.longest >= 30, prog: (s) => [s.longest, 30] },
  { id: "first_fav", glyph: "♥", name: "First Favourite", desc: "Mark a moment as a favourite.", pts: 10, test: (s) => s.favs >= 1, prog: (s) => [s.favs, 1] },
  { id: "parlour_five", glyph: "♠", name: "Parlour Champion", desc: "A run of five in the Parlour Game.", pts: 30, test: (s) => s.parlour >= 5, prog: (s) => [s.parlour, 5] },
  { id: "first_hour", glyph: "⧖", name: "The First Hour", desc: "Spend an hour in focused reading.", pts: 30, test: (s) => s.deskMin >= 60, prog: (s) => [s.deskMin, 60] },
  { id: "ten_hours", glyph: "⧗", name: "Ten Hours at the Desk", desc: "Ten hours of focused, uninterrupted reading.", pts: 80, test: (s) => s.deskMin >= 600, prog: (s) => [s.deskMin, 600] },
  { id: "day_at_desk", glyph: "☉", name: "A Day at the Desk", desc: "A full day’s worth of focused reading, all told.", pts: 160, test: (s) => s.deskMin >= 1440, prog: (s) => [s.deskMin, 1440] },
];
const RANKS = [
  { min: 0, title: "Novice Reader" },
  { min: 50, title: "Apprentice of Letters" },
  { min: 120, title: "Scholar of the Stacks" },
  { min: 220, title: "Curator of Margins" },
  { min: 340, title: "Keeper of the Archives" },
  { min: 490, title: "Master of the Quarterly" },
];

function _honourStats() {
  const t = userLearningJourney.timeline || [];
  const read = Object.values(userLearningJourney.topics || {}).reduce(
    (s, x) => s + (x.readArticles ? x.readArticles.length : 0),
    0,
  );
  const marks =
    t.filter((x) => isType(x.type, "Highlight")).length +
    t.filter((x) => isType(x.type, "Note")).length;
  return {
    read,
    marks,
    refl: t.filter((x) => isType(x.type, "Reflection")).length,
    favs: t.filter((x) => x.isFavorite).length,
    longest: calcStreak().longest,
    parlour: parseInt(localStorage.getItem("osmosis_parlour_best")) || 0,
    deskMin: Math.floor(getDeskSeconds() / 60),
  };
}

// Returns { earned: {id: dateISO}, fresh: [honour, ...] } and persists.
function checkHonours() {
  const stats = _honourStats();
  let earned;
  try {
    earned = JSON.parse(localStorage.getItem("osmosis_honours") || "null");
  } catch (e) {
    earned = null;
  }
  const firstRun = !earned;
  if (!earned) earned = {};
  const fresh = [];
  HONOURS.forEach((h) => {
    if (h.test(stats) && !earned[h.id]) {
      earned[h.id] = new Date().toISOString();
      if (!firstRun) fresh.push(h); // no ceremony spam on first migration
    }
  });
  try {
    localStorage.setItem("osmosis_honours", JSON.stringify(earned));
  } catch (e) {}
  return { earned, fresh, stats };
}

function _honourPoints(earned) {
  return HONOURS.reduce((s, h) => s + (earned[h.id] ? h.pts : 0), 0);
}
function _rankFor(pts) {
  let cur = RANKS[0];
  let next = null;
  for (const r of RANKS) {
    if (pts >= r.min) cur = r;
    else {
      next = r;
      break;
    }
  }
  return { cur, next };
}

function renderHonoursCard() {
  const el = document.getElementById("honoursCard");
  if (!el) return;
  const { earned, fresh, stats } = checkHonours();
  const pts = _honourPoints(earned);
  const { cur, next } = _rankFor(pts);
  const earnedCount = HONOURS.filter((h) => earned[h.id]).length;
  const rankPct = next
    ? Math.round(((pts - cur.min) / (next.min - cur.min)) * 100)
    : 100;

  const seals = HONOURS.map((h) => {
    const on = !!earned[h.id];
    return `<span class="hn-seal ${on ? "on" : ""}" title="${h.name} — ${h.desc}${on ? "" : ` (${Math.min(...h.prog(stats).slice(0, 1))} / ${h.prog(stats)[1]})`}">${on ? h.glyph : "·"}</span>`;
  }).join("");

  el.innerHTML = `
    <div class="study-feature-label">Honours</div>
    <div class="hn-rank">${cur.title}</div>
    <div class="hn-pts">${pts} pts${next ? ` · ${next.min - pts} to ${next.title}` : " · highest rank held"}</div>
    <div class="hn-bar hn-rankbar"><div style="width:${rankPct}%"></div></div>
    <div class="hn-seals">${seals}</div>
    <div class="hn-earned">${earnedCount} of ${HONOURS.length} seals · tap to open the cabinet</div>`;
  el.onclick = openHonoursCabinet;
  el.classList.add("hn-tappable");

  if (fresh.length) queueHonourCeremony(fresh);
}

// ---- The cabinet: every honour, its seal, and when you earned it ----
function openHonoursCabinet() {
  const { earned, stats } = checkHonours();
  let cab = document.getElementById("honoursCabinet");
  if (!cab) {
    cab = document.createElement("div");
    cab.id = "honoursCabinet";
    cab.className = "hn-cabinet";
    document.body.appendChild(cab);
    // Tap the backdrop or press Escape to close.
    cab.addEventListener("click", (e) => {
      if (e.target === cab) closeHonoursCabinet();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && cab.style.display === "flex")
        closeHonoursCabinet();
    });
    // Pull the sheet down to dismiss (matches the writing drawer). Only
    // engages at the top of the sheet, so it never fights scrolling.
    let hnStartY = -1;
    let hnCurY = 0;
    cab.addEventListener(
      "touchstart",
      (e) => {
        const sheet = cab.querySelector(".hn-cab-sheet");
        hnStartY = sheet && sheet.scrollTop <= 5 ? e.touches[0].clientY : -1;
        hnCurY = e.touches[0].clientY;
      },
      { passive: true },
    );
    cab.addEventListener(
      "touchmove",
      (e) => {
        if (hnStartY === -1) return;
        const sheet = cab.querySelector(".hn-cab-sheet");
        if (!sheet) return;
        hnCurY = e.touches[0].clientY;
        const dy = hnCurY - hnStartY;
        if (dy > 0) {
          if (e.cancelable) e.preventDefault();
          sheet.style.transform = `translateY(${dy * 0.85}px)`;
          sheet.style.transition = "none";
          cab.style.background = `rgba(0,0,0,${Math.max(0, 0.45 - dy / 500)})`;
        }
      },
      { passive: false },
    );
    const hnEnd = () => {
      if (hnStartY === -1) return;
      const sheet = cab.querySelector(".hn-cab-sheet");
      const dy = hnCurY - hnStartY;
      hnStartY = -1;
      if (!sheet) {
        cab.style.background = "";
        return;
      }
      if (dy > sheet.offsetHeight * 0.5) {
        // Slide out, then close — smoothly.
        sheet.style.transition = "transform 0.26s cubic-bezier(0.4, 0, 0.2, 1)";
        sheet.style.transform = "translateY(100%)";
        cab.style.transition = "background 0.26s ease";
        cab.style.background = "rgba(0,0,0,0)";
        setTimeout(() => {
          closeHonoursCabinet();
          sheet.style.transition = "";
          sheet.style.transform = "";
          cab.style.transition = "";
          cab.style.background = "";
        }, 250);
      } else {
        // Spring back to rest.
        sheet.style.transition = "transform 0.34s cubic-bezier(0.2, 0.9, 0.3, 1)";
        sheet.style.transform = "";
        cab.style.transition = "background 0.34s ease";
        cab.style.background = "";
        setTimeout(() => {
          sheet.style.transition = "";
          cab.style.transition = "";
        }, 340);
      }
    };
    cab.addEventListener("touchend", hnEnd);
    cab.addEventListener("touchcancel", hnEnd);
  }
  const rows = HONOURS.map((h) => {
    const on = !!earned[h.id];
    const [c, t] = h.prog(stats);
    const when = on
      ? new Date(earned[h.id]).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : null;
    return `
      <div class="hn-cab-row ${on ? "on" : ""}">
        <span class="hn-seal ${on ? "on" : ""}">${on ? h.glyph : "·"}</span>
        <div class="hn-cab-info">
          <div class="hn-cab-name">${h.name} <small>+${h.pts} pts</small></div>
          <div class="hn-cab-desc">${h.desc}</div>
          ${on ? `<div class="hn-cab-date">Earned ${when}</div>` : `<div class="hn-bar"><div style="width:${Math.min(100, Math.round((c / t) * 100))}%"></div></div><div class="hn-cab-date">${Math.min(c, t)} / ${t}</div>`}
        </div>
      </div>`;
  }).join("");
  const pts = _honourPoints(earned);
  const { cur } = _rankFor(pts);
  cab.innerHTML = `
    <div class="hn-cab-sheet">
      <div class="hn-cab-title">Cabinet of Honours</div>
      <div class="hn-cab-rank">${cur.title} · ${pts} pts</div>
      ${rows}
    </div>`;
  cab.style.display = "flex";
}
function closeHonoursCabinet() {
  const cab = document.getElementById("honoursCabinet");
  if (cab) cab.style.display = "none";
}
window.openHonoursCabinet = openHonoursCabinet;
window.closeHonoursCabinet = closeHonoursCabinet;

// ---- The ceremony: a seal is stamped for each new honour ----
let _ceremonyQueue = [];
function queueHonourCeremony(list) {
  _ceremonyQueue.push(...list);
  if (_ceremonyQueue.length === list.length) showNextCeremony();
}
function showNextCeremony() {
  const h = _ceremonyQueue.shift();
  if (!h) return;
  let cer = document.getElementById("honourCeremony");
  if (!cer) {
    cer = document.createElement("div");
    cer.id = "honourCeremony";
    cer.className = "hn-ceremony";
    document.body.appendChild(cer);
  }
  cer.innerHTML = `
    <div class="hn-cer-box">
      <div class="hn-cer-label">Honour Earned</div>
      <div class="hn-seal on hn-cer-seal">${h.glyph}</div>
      <div class="hn-cer-name">${h.name}</div>
      <div class="hn-cer-desc">${h.desc}</div>
      <div class="hn-cer-pts">+${h.pts} pts</div>
      <button class="primary" onclick="dismissHonourCeremony()">Take a bow</button>
    </div>`;
  cer.style.display = "flex";
}
function dismissHonourCeremony() {
  const cer = document.getElementById("honourCeremony");
  if (cer) cer.style.display = "none";
  if (_ceremonyQueue.length) setTimeout(showNextCeremony, 250);
  else if (typeof renderHonoursCard === "function") renderHonoursCard();
}
window.dismissHonourCeremony = dismissHonourCeremony;

function expandDashboardCard(cardId) {
  if (cardId === "review") {
    openReviewSession();
    return;
  }
  const detailView = document.getElementById("dashboardDetailView");
  const statsDetail = document.getElementById("statsDetail");
  const heatmapDetail = document.getElementById("heatmapDetail");
  const reflectionDetail = document.getElementById("reflectionDetail");
  const serendipityDetail = document.getElementById("serendipityDetail");

  document.querySelectorAll("#dashboardDetailView > div[id*='Detail']").forEach(el => el.style.display = "none");

  if (cardId === "stats") {
    statsDetail.style.display = "block";
  } else if (cardId === "heatmap") {
    heatmapDetail.style.display = "block";
  } else if (cardId === "reflection") {
    if (reflectionDetail) {
      reflectionDetail.style.display = "block";
      setTimeout(() => {
        if (typeof renderReflectionTracker === "function") {
          renderReflectionTracker();
        }
      }, 100);
    }
  } else if (cardId === "serendipity") {
    if (serendipityDetail) serendipityDetail.style.display = "block";
  }

  if (detailView) {
    detailView.style.display = "block";
    document.body.style.overflow = "hidden";
    window.scrollTo({ top: 0, behavior: "instant" });

    const nav = document.querySelector(".bottom-nav");
    const header = document.querySelector(".top-app-bar");
    if (nav) nav.style.display = "none";
    if (header) header.style.display = "none";
  }
}

function closeDashboardDetail() {
  const detailView = document.getElementById("dashboardDetailView");
  if (detailView) {
    detailView.style.display = "none";
    document.body.style.overflow = "auto";

    const nav = document.querySelector(".bottom-nav");
    const header = document.querySelector(".top-app-bar");
    if (nav) nav.style.display = "";
    if (header) header.style.display = "";
  }
}

// ============================================================
// DAILY REVIEW — true active recall
// Each due highlight is shown as a cloze: its key words are
// blanked out and you try to retrieve them BEFORE revealing.
// Rating buttons show exactly when the card will return, using
// an SM-2-style scheduler stored per annotation in `srs`.
// ============================================================
const REVIEW_DAY = 24 * 60 * 60 * 1000;

// The Review deck is your own REFLECTIONS — resurfaced so you remember
// what you concluded, and can build on it over time.
function getDueReviewItems() {
  const now = Date.now();
  const items = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith("article_") || !key.endsWith("_reflections"))
      continue;
    let arr;
    try {
      arr = JSON.parse(localStorage.getItem(key) || "[]");
    } catch (e) {
      continue;
    }
    if (!Array.isArray(arr)) continue;
    arr.forEach((ref, idx) => {
      if (!ref || !ref.text || !ref.text.trim()) return;
      // Fresh reflections rest a couple of days before first resurfacing.
      const born = ref.created ? new Date(ref.created).getTime() : 0;
      const next =
        ref.srs && ref.srs.nextReview ? ref.srs.nextReview : born + 2 * REVIEW_DAY;
      if (next <= now) items.push({ key, idx, ref, due: next });
    });
  }
  items.sort((a, b) => a.due - b.due); // longest-waiting first
  return items;
}

// quality: 0 = Faded, 1 = Holds, 2 = Deeper. Widening intervals in days.
function nextIntervalMs(item, quality) {
  const srs = item.srs || { interval: 0, ease: 2.5 };
  if (!srs.interval || srs.interval < 1)
    return (quality === 0 ? 2 : quality === 1 ? 4 : 8) * REVIEW_DAY;
  if (quality === 0) return 2 * REVIEW_DAY;
  const days = Math.max(
    2,
    Math.round(srs.interval * (srs.ease || 2.5) * (quality === 2 ? 1.3 : 1)),
  );
  return days * REVIEW_DAY;
}
function humanInterval(ms) {
  const d = Math.round(ms / REVIEW_DAY);
  if (d >= 30) {
    const m = Math.round(d / 30);
    return m + (m === 1 ? " month" : " months");
  }
  return d + (d === 1 ? " day" : " days");
}
function scheduleReviewItem(item, quality) {
  const srs = item.srs || { interval: 0, ease: 2.5, nextReview: 0 };
  const ms = nextIntervalMs(item, quality);
  srs.interval = Math.round(ms / REVIEW_DAY);
  srs.ease = Math.max(
    1.3,
    (srs.ease || 2.5) + (quality === 0 ? -0.2 : quality === 2 ? 0.15 : 0),
  );
  srs.nextReview = Date.now() + ms;
  item.srs = srs;
}

let reviewQueue = [];
let reviewIndex = 0;
const REVIEW_SESSION_CAP = 12;

function openReviewSession() {
  reviewQueue = getDueReviewItems().slice(0, REVIEW_SESSION_CAP);
  reviewIndex = 0;
  let overlay = document.getElementById("reviewOverlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "reviewOverlay";
    overlay.className = "rv-overlay";
    document.body.appendChild(overlay);
  }
  overlay.style.display = "flex";
  renderReviewCard();
}
function closeReviewSession() {
  const overlay = document.getElementById("reviewOverlay");
  if (overlay) overlay.style.display = "none";
  if (typeof renderDashboardCards === "function") renderDashboardCards();
}

function renderReviewCard() {
  const overlay = document.getElementById("reviewOverlay");
  if (!overlay) return;

  if (reviewIndex >= reviewQueue.length) {
    const did = reviewQueue.length;
    const stillDue = getDueReviewItems().length;
    overlay.innerHTML = `
      <div class="rv-end">
        <div class="rv-fleuron">❦</div>
        <h2>${did ? "Revisited" : "Nothing to revisit"}</h2>
        <p>${
          did
            ? `You sat again with ${did} reflection${did === 1 ? "" : "s"}.` +
              (stillDue
                ? ` ${stillDue} more ${stillDue === 1 ? "is" : "are"} waiting.`
                : " They'll return, at widening intervals, so your thinking never quite fades.")
            : "Write reflections as you read — they return here so you remember what you concluded, and can deepen it over time."
        }</p>
        <div class="rv-end-actions">
          ${stillDue && did ? `<button onclick="openReviewSession()" class="secondary">Keep going</button>` : ""}
          <button onclick="closeReviewSession()" class="primary">Done</button>
        </div>
      </div>`;
    return;
  }

  const { ref } = reviewQueue[reviewIndex];
  const pct = Math.round((reviewIndex / reviewQueue.length) * 100);
  const when = typeof _relTime === "function" ? _relTime(ref.created) : "once";
  const cue = ref.prompt ? ref.prompt.replace(/^[“"']|[”"']$/g, "").trim() : "";
  const teaser = ref.text.replace(/\s+/g, " ").trim().split(" ").slice(0, 4).join(" ");
  const esc = (x) => (typeof _chronEsc === "function" ? _chronEsc(x) : x);

  overlay.innerHTML = `
    <div class="rv-top">
      <span class="rv-count">The Review · ${reviewIndex + 1} of ${reviewQueue.length}</span>
      <button onclick="closeReviewSession()" class="rv-close" aria-label="Close">×</button>
    </div>
    <div class="rv-progress"><div style="width:${pct}%"></div></div>
    <div class="rv-card">
      <div class="rv-eyebrow">${esc(when)}${ref.article ? " · " + esc(ref.article) : ""}</div>
      ${cue ? `<div class="rv-cue">“${esc(cue)}”</div>` : ""}
      <div class="rv-task" id="rvFrontTask">You wrote about this. Try to recall what you concluded — then reveal your words.</div>
      <div id="reviewRevealRow" class="rv-reveal-row">
        <button onclick="revealReviewCard()" class="primary">Reveal what I wrote</button>
      </div>
      <div id="reviewAnswer" class="rv-answer" style="display:none;">
        <div class="rv-passage rv-reflection">${esc(ref.text).replace(/\n/g, "<br>")}</div>
        <div class="rv-rate-lead">How does it land now?</div>
        <div class="rv-rate-row">
          <button onclick="rateReviewCard(0)" class="rv-rate rv-again">Faded<small>${humanInterval(nextIntervalMs(ref, 0))}</small></button>
          <button onclick="rateReviewCard(1)" class="rv-rate rv-good">Holds<small>${humanInterval(nextIntervalMs(ref, 1))}</small></button>
          <button onclick="rateReviewCard(2)" class="rv-rate rv-easy">Deeper<small>${humanInterval(nextIntervalMs(ref, 2))}</small></button>
        </div>
        <div class="rv-add-wrap">
          <button class="rv-add-btn" id="rvAddBtn" onclick="reviewAddThought()">＋ Add a thought to this</button>
          <div id="rvAddBox" class="rv-add-box" style="display:none;">
            <textarea id="rvAddInput" class="rv-add-input" placeholder="What would you add, now?"></textarea>
            <button class="secondary btn-sm" onclick="saveReviewThought()">Add</button>
          </div>
        </div>
      </div>
    </div>`;
}

function revealReviewCard() {
  const overlay = document.getElementById("reviewOverlay");
  if (!overlay) return;
  const cue = overlay.querySelector(".rv-cue");
  const task = document.getElementById("rvFrontTask");
  if (task) task.style.display = "none";
  const revealRow = document.getElementById("reviewRevealRow");
  if (revealRow) revealRow.style.display = "none";
  const answer = document.getElementById("reviewAnswer");
  if (answer) answer.style.display = "block";
}

function reviewAddThought() {
  const box = document.getElementById("rvAddBox");
  const btn = document.getElementById("rvAddBtn");
  if (box) box.style.display = "block";
  if (btn) btn.style.display = "none";
  const ta = document.getElementById("rvAddInput");
  if (ta) ta.focus();
}
function saveReviewThought() {
  const ta = document.getElementById("rvAddInput");
  const entry = reviewQueue[reviewIndex];
  if (!ta || !ta.value.trim() || !entry) return;
  const stamp = new Date().toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const add = "\n\n— " + stamp + " — " + ta.value.trim();
  try {
    const arr = JSON.parse(localStorage.getItem(entry.key) || "[]");
    if (arr[entry.idx]) {
      arr[entry.idx].text = (arr[entry.idx].text || "") + add;
      localStorage.setItem(entry.key, JSON.stringify(arr));
      entry.ref.text = arr[entry.idx].text;
    }
  } catch (e) {}
  const passage = document.querySelector("#reviewAnswer .rv-reflection");
  if (passage)
    passage.innerHTML = (typeof _chronEsc === "function" ? _chronEsc(entry.ref.text) : entry.ref.text).replace(/\n/g, "<br>");
  const box = document.getElementById("rvAddBox");
  if (box) box.style.display = "none";
}

function rateReviewCard(quality) {
  const entry = reviewQueue[reviewIndex];
  if (entry) {
    scheduleReviewItem(entry.ref, quality);
    try {
      const arr = JSON.parse(localStorage.getItem(entry.key) || "[]");
      if (arr[entry.idx]) {
        arr[entry.idx].srs = entry.ref.srs;
        localStorage.setItem(entry.key, JSON.stringify(arr));
      }
    } catch (e) {}
  }
  reviewIndex++;
  renderReviewCard();
}
window.openReviewSession = openReviewSession;
window.closeReviewSession = closeReviewSession;
window.revealReviewCard = revealReviewCard;
window.rateReviewCard = rateReviewCard;
window.reviewAddThought = reviewAddThought;
window.saveReviewThought = saveReviewThought;

function populateDashboardDetails(stats, timeline, topDomains, recentItems, streak, allAchievements) {
  // Populate stats breakdown
  const breakdownDiv = document.getElementById("statsBreakdown");
  if (breakdownDiv) {
    const breakdown = [
      { label: "Highlights", value: stats.highlights, color: "#6b8e6f" },
      { label: "Notes", value: stats.notes, color: "#d4735c" },
      { label: "Reflections", value: stats.reflections, color: "#9b59b6" }
    ];
    breakdownDiv.innerHTML = breakdown.map(item => `
      <div style="padding: 12px; background: var(--glass-solid); border: 1px solid var(--glass-border); border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
        <span style="color: var(--dark-text);">${item.label}</span>
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="width: 20px; height: 20px; border-radius: 4px; background: ${item.color};"></div>
          <span style="font-weight: 600; color: var(--dark-text);">${item.value}</span>
        </div>
      </div>
    `).join("");
  }

  // Populate total stats
  const totalStatsDiv = document.getElementById("totalStats");
  if (totalStatsDiv) {
    const totalAnnotations = stats.highlights + stats.notes;
    const totalItems = stats.articles + totalAnnotations + stats.reflections;
    const avgPerArticle = stats.articles > 0 ? (totalAnnotations / stats.articles).toFixed(1) : 0;

    const totals = [
      { label: "Total Items", value: totalItems },
      { label: "Total Evidence", value: stats.totalEvidence },
      { label: "Avg Annotations/Story", value: avgPerArticle }
    ];
    totalStatsDiv.innerHTML = totals.map(item => `
      <div style="padding: 12px; background: var(--glass-solid); border: 1px solid var(--glass-border); border-radius: 8px; display: flex; justify-content: space-between;">
        <span style="color: var(--subtitle-color);">${item.label}</span>
        <span style="font-weight: 600; color: var(--dark-text);">${item.value}</span>
      </div>
    `).join("");
  }

  // Populate achievement progress
  const progressDiv = document.getElementById("achievementProgress");
  if (progressDiv && allAchievements) {
    progressDiv.innerHTML = allAchievements.map(achievement => {
      const percent = Math.min((achievement.current / achievement.target) * 100, 100);
      const isUnlocked = achievement.current >= achievement.target;
      return `
        <div style="padding: 12px; background: var(--glass-solid); border: 1px solid var(--glass-border); border-radius: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="color: var(--dark-text); font-weight: 500;">${achievement.label}</span>
            <span style="color: var(--subtitle-color); font-size: 0.9rem;">${achievement.current}/${achievement.target}</span>
          </div>
          <div style="height: 6px; background: var(--glass-border); border-radius: 3px; overflow: hidden;">
            <div style="height: 100%; background: ${isUnlocked ? 'var(--accent)' : '#6b8e6f'}; width: ${percent}%; transition: width 0.3s ease;"></div>
          </div>
        </div>
      `;
    }).join("");
  }

  // Populate heatmap stats
  const heatmapStatsDiv = document.getElementById("heatmapStats");
  if (heatmapStatsDiv && timeline) {
    const activeDays = new Set();
    const dayActivityCount = {};
    timeline.forEach(item => {
      const date = new Date(item.date).toISOString().split('T')[0];
      const dayName = new Date(item.date).toLocaleDateString('en-US', { weekday: 'long' });
      activeDays.add(date);
      dayActivityCount[dayName] = (dayActivityCount[dayName] || 0) + 1;
    });

    const mostActiveDayName = Object.entries(dayActivityCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
    const avgPerDay = timeline.length > 0 ? (timeline.length / 28).toFixed(1) : 0;

    const heatmapInfo = [
      { label: "Active Days", value: activeDays.size },
      { label: "Most Active Day", value: mostActiveDayName },
      { label: "Avg Items/Day", value: avgPerDay },
      { label: "Total Activities", value: timeline.length }
    ];
    heatmapStatsDiv.innerHTML = heatmapInfo.map(item => `
      <div style="padding: 12px; background: var(--glass-solid); border: 1px solid var(--glass-border); border-radius: 8px; display: flex; justify-content: space-between;">
        <span style="color: var(--subtitle-color);">${item.label}</span>
        <span style="font-weight: 600; color: var(--dark-text);">${item.value}</span>
      </div>
    `).join("");
  }

  // Populate streak stats
  const streakStatsDiv = document.getElementById("streakStats");
  if (streakStatsDiv && timeline) {
    const allDates = new Set();
    timeline.forEach(item => {
      const date = new Date(item.date).toISOString().split('T')[0];
      allDates.add(date);
    });
    const bestStreak = calculateBestStreak(Array.from(allDates).sort().reverse());
    const daysWithoutActivity = 28 - allDates.size;

    const streakInfo = [
      { label: "Current Streak", value: `${streak} days` },
      { label: "Best Streak", value: `${bestStreak} days` },
      { label: "Days Without Activity", value: daysWithoutActivity },
      { label: "Active Days", value: allDates.size }
    ];
    streakStatsDiv.innerHTML = streakInfo.map(item => `
      <div style="padding: 12px; background: var(--glass-solid); border: 1px solid var(--glass-border); border-radius: 8px; display: flex; justify-content: space-between;">
        <span style="color: var(--subtitle-color);">${item.label}</span>
        <span style="font-weight: 600; color: var(--dark-text);">${item.value}</span>
      </div>
    `).join("");
  }

  // Populate domains stats
  const domainsStatsDiv = document.getElementById("domainsStats");
  if (domainsStatsDiv && topDomains) {
    const totalItems = topDomains.reduce((sum, [_, count]) => sum + count, 0);
    const domainsPercentage = topDomains.slice(0, 3).map(([domain, count]) => ({
      domain,
      count,
      percent: totalItems > 0 ? ((count / totalItems) * 100).toFixed(0) : 0
    }));

    domainsStatsDiv.innerHTML = domainsPercentage.map(item => `
      <div style="padding: 12px; background: var(--glass-solid); border: 1px solid var(--glass-border); border-radius: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <span style="color: var(--dark-text); font-weight: 500;">${item.domain}</span>
          <span style="color: var(--subtitle-color);">${item.percent}%</span>
        </div>
        <div style="height: 6px; background: var(--glass-border); border-radius: 3px; overflow: hidden;">
          <div style="height: 100%; background: var(--accent); width: ${item.percent}%;"></div>
        </div>
      </div>
    `).join("");
  }

  // Populate activity summary
  const activitySummaryDiv = document.getElementById("activitySummary");
  if (activitySummaryDiv && timeline) {
    const typeCount = {};
    timeline.forEach(item => {
      typeCount[item.type] = (typeCount[item.type] || 0) + 1;
    });

    const summary = Object.entries(typeCount).map(([type, count]) => ({
      label: type,
      value: count
    }));

    activitySummaryDiv.innerHTML = summary.map(item => `
      <div style="padding: 12px; background: var(--glass-solid); border: 1px solid var(--glass-border); border-radius: 8px; display: flex; justify-content: space-between;">
        <span style="color: var(--subtitle-color);">${item.label}</span>
        <span style="font-weight: 600; color: var(--dark-text);">${item.value}</span>
      </div>
    `).join("");
  }
}

function calculateBestStreak(sortedDates) {
  if (sortedDates.length === 0) return 0;
  let bestStreak = 1;
  let currentStreak = 1;

  for (let i = 1; i < sortedDates.length; i++) {
    const current = new Date(sortedDates[i]);
    const previous = new Date(sortedDates[i - 1]);
    const dayDiff = (previous - current) / (1000 * 60 * 60 * 24);

    if (dayDiff === 1) {
      currentStreak++;
      bestStreak = Math.max(bestStreak, currentStreak);
    } else {
      currentStreak = 1;
    }
  }
  return bestStreak;
}

function populateActivityDetail() {
  const recentActivityDiv = document.getElementById("dashRecentActivity");
  const items = window.allRecentActivityItems || [];

  recentActivityDiv.innerHTML = items.map((item, index) => {
    const date = new Date(item.date).toLocaleDateString();
    const time = new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const preview = (item.text || "").substring(0, 60) + (item.text?.length > 60 ? "..." : "");
    return `
      <div class="activity-item" onclick="showActivityDetail(${index})" style="padding: 12px; background: var(--glass-solid); border: 1px solid var(--glass-border); border-radius: 8px; cursor: pointer; transition: all 0.2s;">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
          <span style="font-size: 0.85rem; font-weight: 600; color: var(--accent);">${item.type}</span>
          <div style="text-align: right;">
            <div style="font-size: 0.75rem; color: var(--subtitle-color);">${date}</div>
            <div style="font-size: 0.7rem; color: var(--subtitle-color);">${time}</div>
          </div>
        </div>
        <div style="padding-bottom: 8px; border-bottom: 1px solid var(--glass-border); margin-bottom: 8px;">
          <p style="margin: 0; font-size: 0.9rem; color: var(--dark-text); line-height: 1.3;">${preview}</p>
        </div>
        <div style="font-size: 0.8rem; color: var(--subtitle-color);">
          <div>Domain: ${item.domain}</div>
          <div style="margin-top: 4px; color: var(--accent);">Click to see full content →</div>
        </div>
      </div>
    `;
  }).join("");

  if (items.length === 0) {
    recentActivityDiv.innerHTML = '<p style="color: var(--subtitle-color); margin: 0;">No activity yet</p>';
  }

  // Add hover effect
  document.querySelectorAll(".activity-item").forEach(item => {
    item.addEventListener("mouseenter", function() {
      this.style.borderColor = "var(--accent)";
      this.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)";
    });
    item.addEventListener("mouseleave", function() {
      this.style.borderColor = "var(--glass-border)";
      this.style.boxShadow = "none";
    });
  });
}

function showActivityDetail(index) {
  const items = window.allRecentActivityItems || [];
  const item = items[index];

  if (!item) return;

  const modal = document.getElementById("activityDetailModal");
  const date = new Date(item.date).toLocaleDateString();
  const time = new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  document.getElementById("activityModalType").textContent = item.type;
  document.getElementById("activityModalDateTime").textContent = `${date} at ${time}`;
  const domainEl = document.getElementById("activityModalDomain");
  domainEl.textContent = item.domain || "General";
  const domainRow = domainEl.parentElement;
  if (domainRow)
    domainRow.style.display =
      !item.domain || item.domain === "Uncategorized" ? "none" : "flex";
  document.getElementById("activityModalArticle").textContent = item.article || "-";
  document.getElementById("activityModalContent").textContent = item.text || "(No content)";

  modal.style.display = "flex";
  modal.style.alignItems = "center";
  modal.style.justifyContent = "center";
}

function closeActivityModal() {
  const modal = document.getElementById("activityDetailModal");
  modal.style.display = "none";
}

// Close dashboard detail and activity modal with Escape key
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const detailView = document.getElementById("dashboardDetailView");
    const activityModal = document.getElementById("activityDetailModal");

    if (detailView && detailView.style.display !== "none") {
      closeDashboardDetail();
    } else if (activityModal && activityModal.style.display !== "none") {
      closeActivityModal();
    }
  }
});

// Swipe to close dashboard detail and activity modal
document.addEventListener("touchstart", (e) => {
  window.dashboardTouchStartX = e.touches[0].clientX;
  window.dashboardTouchStartY = e.touches[0].clientY;
}, { passive: true });

document.addEventListener("touchend", (e) => {
  const detailView = document.getElementById("dashboardDetailView");
  const activityModal = document.getElementById("activityDetailModal");
  const touchEndX = e.changedTouches[0].clientX;
  const touchEndY = e.changedTouches[0].clientY;

  const isLeftSide = window.dashboardTouchStartX < 60;
  const isRightSwipe = touchEndX - window.dashboardTouchStartX > 50;
  const isNotVerticalScroll = Math.abs(touchEndY - window.dashboardTouchStartY) < Math.abs(touchEndX - window.dashboardTouchStartX);

  if (isLeftSide && isRightSwipe && isNotVerticalScroll) {
    // Try closing dashboard detail first
    if (detailView && detailView.style.display !== "none") {
      closeDashboardDetail();
      return;
    }

    // Try closing activity modal
    if (activityModal && activityModal.style.display !== "none") {
      closeActivityModal();
      return;
    }
  }
}, { passive: true });

// ============================================================
// NOTIFICATION SYSTEM
// ============================================================
function requestNotificationPermission() {
  if ('Notification' in window) {
    if (Notification.permission === 'granted') {
      return Promise.resolve();
    } else if (Notification.permission !== 'denied') {
      return Notification.requestPermission();
    }
  }
  return Promise.resolve();
}

function sendNotification(title, options = {}) {
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        icon: 'logo.svg',
        badge: 'logo.svg',
        ...options
      });
    } catch (e) {
      console.log('Notification failed:', e);
    }
  }
}

// ============================================================
// STATE MANAGEMENT
// ============================================================
let userLearningJourney = {
  topics: {},
  timeline: [],
  paths: {},
  badges: [],
};

let currentState = {
  mode: "explore",
  currentPathId: null,
  currentPathStep: 0,
  view: "explore",
  category: null,
  subtopic: null,
  article: null,
};

let activeSelection = "";
let lastSelectionSnapshot = { text: "", pIndex: -1, occurrence: 0 };
const speechSynth = window.speechSynthesis;
let isSpeaking = false;
let ttsQueue = [];
let currentAudio = null;
let animationFrameId;
let resizeObserver;
let mousePos = { x: -1000, y: -1000 };
let currentZoom = "daily";
let currentTimelineSearch = "";
let chronLens = "journal";
let chronFilter = "All";
let currentNotesSearch = "";
let timelineTransitionTimeout = null;
const TTS_PARAGRAPH_BREAK = "__PAUSE_PARAGRAPH__";
const TTS_SENTENCE_BREAK = "__PAUSE_SENTENCE__";
const TTS_MAX_CHARS = 240;

let dwInterval = null;
let dwSeconds = 0;
let dwStartWords = 0;
const DW_TOTAL_SECONDS = 25 * 60;
let lastScrollTop = 0;
let scrollVelocityTimeout = null;
let hasTriggeredCompletion = false;
let currentExploreSort = "newest";
let currentExploreFilter = "all";
let libraryGenreFilter = null;
let libraryAuthorFilter = null;

// Article Favorites Storage
function getFavoriteArticles() {
  const fav = localStorage.getItem("osmosis_favorite_articles");
  return fav ? JSON.parse(fav) : [];
}

function isFavoriteArticle(domain, article) {
  const favorites = getFavoriteArticles();
  return favorites.some(f => f.domain === domain && f.article === article);
}

function toggleFavoriteArticle(domain, article) {
  const favorites = getFavoriteArticles();
  const index = favorites.findIndex(f => f.domain === domain && f.article === article);
  const isFavoriting = index === -1;

  if (index > -1) {
    favorites.splice(index, 1);
  } else {
    favorites.push({ domain, article });
  }
  localStorage.setItem("osmosis_favorite_articles", JSON.stringify(favorites));

  renderArticleGrid();
  showToast(isFavoriting ? "Added to favorites" : "Removed from favorites");
}

let genEditingOriginal = null;

let vaultSearchQuery = "";
let currentVaultFilter = "All";

let multiSelectMode = false;
const selectedItems = {
  annotation: new Set(),
  reflection: new Set(),
  timeline: new Set(),
};
let longPressTimer = null;
let editingReflectionId = null;
let editingAnnotationId = null;
let currentNotesStep = 0;
const notesTabNames = ["Reflection", "Notes"];

let reflectionHistory = [];
let reflectionHistoryIndex = -1;

// ============================================================
// CONSISTENCY AUDIT - Fixed Inconsistencies Log
// ============================================================
// DESIGN: Added CSS variables for typography, spacing, shadows, transitions
// LOGIC: Added standardized helper functions for type checking and DOM access
// TYPE CHECKING: Replaced .includes() with isType() for consistent string comparison
// STATE: Using Object.assign() pattern for consistent state updates
// ERRORS: Centralized error logging with logError() helper

// ============================================================
// STANDARDIZED HELPER FUNCTIONS - Type & Logic Consistency
// ============================================================

/** Standardized type checking (replaces inconsistent .includes() usage) */
function isType(value, type) {
  return (value || "") === type;
}

/** Standardized type matching for multiple types */
function isAnyType(value, ...types) {
  return types.some(t => isType(value, t));
}

/** Standardized array filtering by type */
function filterByType(items, type) {
  return items.filter(item => isType(item.type, type));
}

/** Standardized array finding by type */
function findByType(items, type) {
  return items.find(item => isType(item.type, type));
}

/** Standardized DOM element getter with error handling */
function getElement(id) {
  const el = document.getElementById(id);
  if (!el) console.warn(`Element not found: #${id}`);
  return el;
}

/** Standardized DOM elements getter */
function getElements(selector) {
  return document.querySelectorAll(selector) || [];
}

/** Standardized safe object updates (immutable pattern) */
function updateState(obj, updates) {
  return Object.assign({}, obj, updates);
}

/** Standardized safe array updates */
function updateArray(arr, updates) {
  return [...arr, ...updates];
}

/** Standardized error logging */
function logError(context, error) {
  console.error(`[${context}]`, error?.message || error);
}

/** Standardized string search (consistent case handling) */
function matchesSearch(text, query) {
  return (text || "").toLowerCase().includes((query || "").toLowerCase());
}
let reflectionTypingTimer = null;

function saveReflectionState(val) {
  if (reflectionHistory[reflectionHistoryIndex] === val) return;
  if (reflectionHistoryIndex < reflectionHistory.length - 1) {
    reflectionHistory = reflectionHistory.slice(0, reflectionHistoryIndex + 1);
  }
  reflectionHistory.push(val);
  reflectionHistoryIndex++;
  updateReflectionUndoRedoBtns();
}

function updateReflectionUndoRedoBtns() {
  const uBtn = document.getElementById("undoRefBtn");
  const rBtn = document.getElementById("redoRefBtn");
  if (uBtn) uBtn.disabled = reflectionHistoryIndex <= 0;
  if (rBtn)
    rBtn.disabled = reflectionHistoryIndex >= reflectionHistory.length - 1;
}

function undoReflection(e) {
  if (e) e.preventDefault();
  if (reflectionHistoryIndex > 0) {
    reflectionHistoryIndex--;
    applyReflectionHistoryState();
  }
}

function redoReflection(e) {
  if (e) e.preventDefault();
  if (reflectionHistoryIndex < reflectionHistory.length - 1) {
    reflectionHistoryIndex++;
    applyReflectionHistoryState();
  }
}

function applyReflectionHistoryState() {
  const input = document.getElementById("reflectionInput");
  if (input) {
    input.value = reflectionHistory[reflectionHistoryIndex] || "";
  }
  updateReflectionUndoRedoBtns();
}

// ============================================================
// PROGRESSIVE DISCLOSURE
// ============================================================
function checkFeatureUnlocks() {
  const stats = { reads: 0, actions: userLearningJourney.timeline.length };
  Object.keys(userLearningJourney.topics).forEach((d) => {
    stats.reads += userLearningJourney.topics[d].articlesEngaged || 0;
  });

  const unlocks = JSON.parse(localStorage.getItem("osmosis_unlocks") || "{}");
  let newlyUnlocked = false;

  if (stats.actions > 0 && !unlocks.journey) {
    unlocks.timeline = true;
    newlyUnlocked = true;
    localStorage.setItem("new_feature_timeline", "1");
    setTimeout(() => showUnlockToast("Unlocked: Timeline!"), 1000);
  }

  if (stats.reads > 0 && !unlocks.deepwork) {
    unlocks.deepwork = true;
    newlyUnlocked = true;
    setTimeout(() => showUnlockToast("Unlocked: Deep Work Focus Mode!"), 4000);
  }

  if (newlyUnlocked) {
    localStorage.setItem("osmosis_unlocks", JSON.stringify(unlocks));
    applyProgressiveDisclosure(unlocks);
  }
}

function applyProgressiveDisclosure(unlocks) {
  if (!unlocks)
    unlocks = JSON.parse(localStorage.getItem("osmosis_unlocks") || "{}");

  const navTimeline = document.getElementById("navTimeline");
  const navVault = document.getElementById("navVault");
  const dwBtn = document.getElementById("startDeepWorkBtn");

  if (navTimeline) {
    navTimeline.style.display = "flex";
    if (localStorage.getItem("new_feature_timeline"))
      navTimeline.classList.add("new-feature");
  }
  if (dwBtn) {
    dwBtn.style.display = "flex"; // Focus is always available
  }
}

function showUnlockToast(message) {
  // Toast notifications disabled
}

// Briefly show a hint on entering Focus mode (which hides all chrome) so the
// user knows how to leave. Fades out after a couple of seconds.
function showFocusExitHint() {
  let hint = document.getElementById("focusExitHint");
  if (!hint) {
    hint = document.createElement("div");
    hint.id = "focusExitHint";
    hint.textContent = "Tap anywhere or press Esc to exit";
    hint.style.cssText =
      "position: fixed; bottom: 32px; left: 50%; transform: translateX(-50%); " +
      "background: rgba(0,0,0,0.78); color: #fff; padding: 9px 18px; " +
      "border-radius: 999px; font-size: 0.8rem; font-family: 'Outfit', sans-serif; " +
      "font-weight: 500; letter-spacing: 0.2px; z-index: 10001; pointer-events: none; " +
      "opacity: 0; transition: opacity 0.5s ease; box-shadow: 0 6px 20px rgba(0,0,0,0.3);";
    document.body.appendChild(hint);
  }
  clearTimeout(hint._hideTimer);
  requestAnimationFrame(() => {
    hint.style.opacity = "1";
  });
  hint._hideTimer = setTimeout(() => {
    hint.style.opacity = "0";
  }, 2200);
}

function updateNotesCarousel() {
  const track = document.getElementById("mainCarouselTrack");
  if (!track) return;
  track.style.transform = `translateX(-${currentNotesStep * 100}%)`;

  // Dynamically update the main drawer title (previously "Workspace") to match the active section
  const headers = document.querySelectorAll(
    "#notesSection h1, #notesSection h2, #notesSection h3, #notesSection h4, #notesSection .drawer-title",
  );
  for (let h of headers) {
    const text = h.textContent.trim();
    if (text === "Workspace" || notesTabNames.includes(text)) {
      h.textContent = notesTabNames[currentNotesStep];
      h.style.paddingRight = "32px"; // Ensure X button doesn't overlap the text
      break;
    }
  }

  const tabs = document.querySelectorAll("#mainCarouselTabs .drawer-tab");
  tabs.forEach((t, i) => t.classList.toggle("active", i === currentNotesStep));
  try {
    const nRef = getReflections().length;
    const nAnn = getAnnotations().filter(
      (a) => a && a.note !== "Bookmarked",
    ).length;
    if (tabs[0])
      tabs[0].innerHTML = `Reflection${nRef ? ` <span class="tab-count">${nRef}</span>` : ""}`;
    if (tabs[1])
      tabs[1].innerHTML = `Notes${nAnn ? ` <span class="tab-count">${nAnn}</span>` : ""}`;
  } catch (e) {}
}

// ============================================================
// INITIALIZATION
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("sw.js")
      .catch((err) => console.log("SW registration failed:", err));
  }

  // Request notification permission
  requestNotificationPermission().catch(err => console.log("Notification permission request failed:", err));

  // Login removed — the app always runs as a local, account-free session.
  if (!localStorage.getItem("osmosis_auth_token")) {
    localStorage.setItem("osmosis_auth_token", "local_guest");
  }

  // Seed your definitive progress and settings if they don't exist yet
  if (!localStorage.getItem("osmosis_state_seeded")) {
    localStorage.setItem("osmosis_compact", "0");
    localStorage.setItem("osmosis_voice", "Google US English");
    localStorage.setItem("osmosis_theme", "dark");
    localStorage.setItem(
      "osmosis_journey",
      JSON.stringify({
        topics: {},
        timeline: [],
        paths: {},
        badges: [],
      }),
    );
    localStorage.setItem("osmosis_state_seeded", "1");
  }

  updateThemeMeta();
  setTimeout(() => {
    const splash = document.getElementById("splashScreen");
    if (splash) {
      splash.style.opacity = "0";
      splash.style.visibility = "hidden";
      setTimeout(() => (splash.style.display = "none"), 600);
    }
    updateWelcomeLine();
  }, 1800);
  initTheme();
  applyReaderPrefs();

  if (localStorage.getItem("osmosis_compact") === "1")
    document.body.classList.add("compact-mode");

  loadCustomContent();
  loadJourneyData();
  updateStreaks();
  renderArticleGrid();
  checkFeatureUnlocks();
  applyProgressiveDisclosure();
  setupEvents();
  setupSearch();
  pullFromServer(true);

  // Continuously poll for changes to achieve seamless 2-way sync
  setInterval(() => pullFromServer(false), 3000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") pullFromServer(false);
  });
  setInterval(checkDailyReminder, 60000);
  setTimeout(checkDailyReminder, 5000);
});

function loadCustomContent() {
  try {
    const custom = JSON.parse(
      localStorage.getItem("osmosis_custom_content") || "{}",
    );
    if (!window.topicsData) window.topicsData = {};
    const isEmptyVal = (v) =>
      v == null || v === "" || (Array.isArray(v) && v.length === 0);
    // Merge one article's fields over another WITHOUT letting empty custom
    // values erase real (e.g. baked-in) data like a cover photo.
    const mergeArticle = (base, cust) => {
      const out = Object.assign({}, base || {});
      Object.keys(cust || {}).forEach((k) => {
        if (!isEmptyVal(cust[k])) out[k] = cust[k];
      });
      return out;
    };

    Object.keys(custom).forEach((domain) => {
      if (!window.topicsData[domain]) {
        window.topicsData[domain] = custom[domain];
        return;
      }
      Object.keys(custom[domain].subtopics || {}).forEach((sub) => {
        const subData = window.topicsData[domain].subtopics[sub];
        if (!subData) {
          window.topicsData[domain].subtopics[sub] =
            custom[domain].subtopics[sub];
          return;
        }
        const custArticles = custom[domain].subtopics[sub].articles || {};
        Object.keys(custArticles).forEach((art) => {
          subData.articles[art] = mergeArticle(
            subData.articles[art],
            custArticles[art],
          );
        });
      });
    });
  } catch (e) {
    console.error("Failed to load custom content", e);
  }
  // Free up localStorage: move any inline base64 cover photos already saved
  // in osmosis_custom_content into IndexedDB (runs once, then no-ops).
  try {
    migrateInlineImagesToIdb();
  } catch (e) {}
}

// One-time migration of previously-saved inline "data:" cover images out of
// localStorage and into IndexedDB, replacing each with a small reference.
// This reclaims the space that was causing "storage is full" errors.
function migrateInlineImagesToIdb() {
  if (typeof indexedDB === "undefined") return;
  let custom;
  try {
    custom = JSON.parse(localStorage.getItem("osmosis_custom_content") || "{}");
  } catch (e) {
    return;
  }
  const tasks = [];
  Object.keys(custom).forEach((d) => {
    const subs = custom[d]?.subtopics || {};
    Object.keys(subs).forEach((s) => {
      const arts = subs[s]?.articles || {};
      Object.keys(arts).forEach((a) => {
        const art = arts[a];
        if (
          art &&
          typeof art.image === "string" &&
          art.image.startsWith("data:")
        ) {
          const id = genNewImageId();
          const dataUrl = art.image;
          tasks.push(
            idbSetImage(id, dataUrl)
              .then(() => {
                _imgCache[id] = dataUrl;
                art.image = "idb:" + id;
                // Keep the live library in sync so it shrinks too.
                try {
                  const t =
                    window.topicsData?.[d]?.subtopics?.[s]?.articles?.[a];
                  if (
                    t &&
                    typeof t.image === "string" &&
                    t.image.startsWith("data:")
                  )
                    t.image = "idb:" + id;
                } catch (e) {}
              })
              .catch(() => {}),
          );
        }
      });
    });
  });
  if (!tasks.length) return;
  Promise.all(tasks).then(() => {
    try {
      localStorage.setItem("osmosis_custom_content", JSON.stringify(custom));
    } catch (e) {}
  });
}

function validateKnowledgeData() {
  const issues = [];
  const topics = window.topicsData || {};

  Object.entries(topics).forEach(([domainName, domain]) => {
    if (!domain?.subtopics || typeof domain.subtopics !== "object") {
      issues.push(`Domain "${domainName}" is missing a subtopics object.`);
      return;
    }
    Object.entries(domain.subtopics).forEach(([subtopicName, subtopic]) => {
      if (!subtopic?.articles || typeof subtopic.articles !== "object") {
        issues.push(
          `Subtopic "${domainName} > ${subtopicName}" is missing an articles object.`,
        );
        return;
      }
      Object.entries(subtopic.articles).forEach(([articleName, article]) => {
        if (
          !article ||
          typeof article.content !== "string" ||
          !article.content.trim()
        ) {
          issues.push(
            `Article "${domainName} > ${subtopicName} > ${articleName}" is missing content.`,
          );
        }
      });
    });
  });

  window.osmosisDataValidation = {
    issueCount: issues.length,
    issues,
  };

  if (issues.length > 0) {
    console.warn(
      `[Data Validation] Found ${issues.length} potential data issue(s).`,
      issues,
    );
  } else {
    console.info("[Data Validation] Passed.");
  }
}

// ============================================================
// THEME & PREFERENCES
// ============================================================
function updateWelcomeLine() {
  const el = document.getElementById("welcomeLine");
  if (!el) return;
  el.textContent = "Welcome to Osmosis. Pick a domain when you are ready.";
  el.removeAttribute("hidden");
}

function updateThemeMeta() {
  const meta = document.getElementById("themeColorMeta");
  if (!meta) return;
  const theme = document.documentElement.getAttribute("data-theme");
  let color = "#FAF8F0";
  if (theme === "dark") color = "#12100E";
  if (theme === "midnight") color = "#000000";
  meta.setAttribute("content", color);
}

function initTheme() {
  const saved = localStorage.getItem("osmosis_theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  if (saved === "dark" || (!saved && prefersDark)) {
    document.documentElement.setAttribute("data-theme", "dark");
  } else if (saved === "midnight") {
    document.documentElement.setAttribute("data-theme", "midnight");
  }
  const savedHlColor = localStorage.getItem("osmosis_hl_color") || "yellow";
  document.documentElement.setAttribute("data-hl-color", savedHlColor);
  updateThemeMeta();
  if (localStorage.getItem("osmosis_auto_dark") === "1") applyAutoDark();
}

function applyAutoDark() {
  const h = new Date().getHours();
  const shouldBeDark = h >= 21 || h < 7;
  if (shouldBeDark) {
    const saved = localStorage.getItem("osmosis_theme");
    document.documentElement.setAttribute(
      "data-theme",
      saved === "midnight" ? "midnight" : "dark",
    );
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
  updateThemeMeta();
}

function toggleTheme() {
  const theme = document.documentElement.getAttribute("data-theme");
  if (theme === "dark" || theme === "midnight") {
    document.documentElement.removeAttribute("data-theme");
    localStorage.setItem("osmosis_theme", "light");
  } else {
    const pref = localStorage.getItem("osmosis_dark_pref") || "dark";
    document.documentElement.setAttribute("data-theme", pref);
    localStorage.setItem("osmosis_theme", pref);
  }
  updateThemeMeta();
}

function applyReaderPrefs() {
  const defaults = {
    fontSize: "1.1",
    lineHeight: "1.7",
    fontFamily: "'Lora', serif",
    letterSpacing: "0",
    maxWidth: "800",
    theme: "default",
  };
  const prefs = JSON.parse(
    localStorage.getItem("osmosis_reader_prefs") || JSON.stringify(defaults),
  );

  document.documentElement.setAttribute(
    "data-read-theme",
    prefs.theme || "default",
  );

  document.documentElement.style.setProperty(
    "--article-font-size",
    prefs.fontSize + "rem",
  );
  document.documentElement.style.setProperty(
    "--article-line-height",
    prefs.lineHeight,
  );
  document.documentElement.style.setProperty(
    "--article-font-family",
    prefs.fontFamily,
  );
  document.documentElement.style.setProperty(
    "--article-letter-spacing",
    prefs.letterSpacing + "px",
  );
  document.documentElement.style.setProperty(
    "--article-max-width",
    prefs.maxWidth + "px",
  );

  const sizeSlider = document.getElementById("fontSizeSlider");
  const lineSlider = document.getElementById("lineHeightSlider");
  const spaceSlider = document.getElementById("letterSpacingSlider");
  const widthSlider = document.getElementById("maxWidthSlider");
  if (sizeSlider) sizeSlider.value = prefs.fontSize;
  if (lineSlider) lineSlider.value = prefs.lineHeight;
  if (spaceSlider) spaceSlider.value = prefs.letterSpacing;
  if (widthSlider) widthSlider.value = prefs.maxWidth;

  document.querySelectorAll(".font-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.font === prefs.fontFamily);
  });
  document.querySelectorAll(".read-theme-btn").forEach((btn) => {
    btn.classList.toggle(
      "active",
      btn.dataset.themeVal === (prefs.theme || "default"),
    );
  });
}

function getTTSSettings() {
  const savedRate = parseFloat(localStorage.getItem("osmosis_tts_rate"));
  const savedPitch = parseFloat(localStorage.getItem("osmosis_tts_pitch"));
  return {
    rate: Number.isFinite(savedRate) ? savedRate : 0.92,
    pitch: Number.isFinite(savedPitch) ? savedPitch : 1.0,
  };
}

function getVoiceByURI(uri) {
  if (!uri) return null;
  return speechSynth.getVoices().find((v) => v.voiceURI === uri) || null;
}

// Rank a voice by how natural / human it sounds, so we can auto-pick the best one.
function voiceNaturalnessScore(v) {
  if (!v) return -Infinity;
  const n = (v.name || "").toLowerCase();
  const lang = (v.lang || "").toLowerCase();
  let score = 0;

  // Modern neural/natural engines sound the most human
  if (n.includes("natural")) score += 120;
  if (n.includes("neural")) score += 120;
  if (n.includes("online")) score += 50;
  if (n.includes("google")) score += 70;
  if (n.includes("premium") || n.includes("enhanced")) score += 40;

  // Known good, human-sounding voice names across OSes
  [
    "aria", "jenny", "guy", "ana", "michelle", "eric", "roger",
    "samantha", "siri", "serena", "daniel", "karen", "alex",
    "catherine", "libby", "sonia", "ryan", "natasha", "clara",
  ].forEach((name) => {
    if (n.includes(name)) score += 30;
  });

  // Penalize the old, robotic legacy voices
  if (
    n.includes("david") || n.includes("zira") || n.includes("mark") ||
    n.includes("hazel") || n.includes("susan")
  )
    score -= 40;
  if (n.includes("espeak") || n.includes("compact") || n.includes("pico"))
    score -= 100;

  // Prefer English, US first
  if (lang.startsWith("en")) score += 25;
  if (lang === "en-us") score += 10;

  return score;
}

// Pick the most natural-sounding English voice available on this device.
function pickBestVoice() {
  const voices = speechSynth
    .getVoices()
    .filter((v) => (v.lang || "").toLowerCase().startsWith("en"));
  if (!voices.length) return speechSynth.getVoices()[0] || null;
  return voices
    .slice()
    .sort((a, b) => voiceNaturalnessScore(b) - voiceNaturalnessScore(a))[0];
}

function applyVoiceToUtterance(utterance, selectedURI) {
  const savedVoice = selectedURI || localStorage.getItem("osmosis_voice");
  const voice = getVoiceByURI(savedVoice);
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang || "en-US";
    return;
  }

  // No valid saved voice — auto-select the most human-sounding one available
  const fallback = pickBestVoice();
  if (fallback) {
    utterance.voice = fallback;
    utterance.lang = fallback.lang || "en-US";
  } else {
    utterance.lang = "en-US";
  }
}

function normalizeTTSText(text) {
  if (!text) return "";
  return text
    .replace(/^#+\s+/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;!?])/g, "$1")
    .replace(/([,.;!?])([^\s])/g, "$1 $2")
    .trim();
}

function buildNaturalTTSQueue(rawContent) {
  const queue = [];
  const paragraphs = rawContent
    .split(/\r?\n\s*\r?\n/)
    .map((p) => normalizeTTSText(p))
    .filter((p) => p.length > 0);

  paragraphs.forEach((paragraph, pIndex) => {
    const sentences = paragraph.match(/[^.!?]+[.!?\u2026]+|[^.!?]+$/g) || [
      paragraph,
    ];
    let chunk = "";

    sentences.forEach((sentence) => {
      const cleanSentence = normalizeTTSText(sentence);
      if (!cleanSentence) return;

      if ((chunk + " " + cleanSentence).trim().length <= TTS_MAX_CHARS) {
        chunk = `${chunk} ${cleanSentence}`.trim();
      } else {
        if (chunk) {
          queue.push(chunk);
          queue.push(TTS_SENTENCE_BREAK);
        }
        chunk = cleanSentence;
      }
    });

    if (chunk) queue.push(chunk);
    if (pIndex < paragraphs.length - 1) queue.push(TTS_PARAGRAPH_BREAK);
  });

  return queue;
}

function setListenButtonPlaying() {
  const btn = document.getElementById("listenBtn");
  if (btn) {
    btn.style.background = "var(--sage)";
    btn.style.color = "white";
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg> Stop`;
  }
}

function resetTestVoiceButton() {
  const testBtn = document.getElementById("testVoiceBtn");
  if (testBtn) {
    testBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> Play Audio Sample`;
  }
}

function saveReaderPrefs() {
  const fontSlider = document.getElementById("fontSizeSlider");
  const lineSlider = document.getElementById("lineHeightSlider");
  const spaceSlider = document.getElementById("letterSpacingSlider");
  const widthSlider = document.getElementById("maxWidthSlider");
  const activeFontBtn = document.querySelector(".font-btn.active");
  const activeThemeBtn = document.querySelector(".read-theme-btn.active");
  localStorage.setItem(
    "osmosis_reader_prefs",
    JSON.stringify({
      fontSize: fontSlider ? fontSlider.value : "1.1",
      lineHeight: lineSlider ? lineSlider.value : "1.7",
      fontFamily: activeFontBtn ? activeFontBtn.dataset.font : "'Lora', serif",
      letterSpacing: spaceSlider ? spaceSlider.value : "0",
      maxWidth: widthSlider ? widthSlider.value : "800",
      theme: activeThemeBtn ? activeThemeBtn.dataset.themeVal : "default",
    }),
  );
  triggerAutoSync();
}

// ============================================================
// CONTEXTUAL DRAWER LOGIC
// ============================================================
function openNotesDrawer(targetStep = 0) {
  document.body.classList.add("drawer-active");
  // Lock the document scroller so its scrollbar vanishes — otherwise it
  // leaves a gap strip beside the full-page sheet on desktop.
  document.documentElement.style.overflow = "hidden";
  const notesDrawer = document.getElementById("notesSection");
  const notesBackdrop = document.getElementById("notesBackdrop");
  const fMenu = document.getElementById("floatingSelectionMenu");

  renderReflectionPreamble();

  if (notesDrawer) {
    // No close button — the drawer is dismissed by swiping it down (or tapping
    // the handle/backdrop). Remove any close button left over from older builds.
    const staleClose = notesDrawer.querySelector(".close-drawer-btn");
    if (staleClose) staleClose.remove();

    notesDrawer.style.transform = "";
    notesDrawer.style.transition = "";
    notesDrawer.classList.add("open");

    // Standardized step resolution logic
    if (typeof targetStep === "number") {
      currentNotesStep = targetStep;
    } else {
      currentNotesStep = targetStep === true ? 0 : 1;
    }
    updateNotesCarousel();

    // The desk knows which story it serves
    const ctx = document.getElementById("wsContext");
    if (ctx) {
      ctx.textContent = currentState.article
        ? `Re: ${currentState.article}`
        : "";
      ctx.style.display = currentState.article ? "block" : "none";
    }
    renderWsMargins();
    restoreWsDraft();

    document
      .querySelectorAll(".carousel-slide, .carousel-card")
      .forEach((slide) => (slide.scrollTop = 0));
  }
  if (notesBackdrop) notesBackdrop.classList.add("active");
  if (fMenu) fMenu.classList.remove("active");
}

function closeNotesDrawer(isFromHistory) {
  const fromHistory = isFromHistory === true;

  // Reset any open guided flows so they don't linger behind the sheet.
  if (typeof closeNoteDialogue === "function") closeNoteDialogue();
  if (typeof closeReflectionDialogue === "function") closeReflectionDialogue();

  document.body.classList.remove("drawer-active");
  // Restore the document scroller locked in openNotesDrawer()
  document.documentElement.style.overflow = "";
  const notesDrawer = document.getElementById("notesSection");
  const notesBackdrop = document.getElementById("notesBackdrop");

  if (notesDrawer) {
    notesDrawer.style.transform = "";
    notesDrawer.style.transition = "";
    notesDrawer.classList.remove("open");
  }
  if (notesBackdrop) notesBackdrop.classList.remove("active");
  window.getSelection().removeAllRanges();

  if (
    document.activeElement &&
    (document.activeElement.tagName === "TEXTAREA" ||
      document.activeElement.tagName === "INPUT")
  ) {
    document.activeElement.blur();
  }

  editingReflectionId = null;
  const saveBtn = document.getElementById("saveReflectionBtn");
  if (saveBtn) saveBtn.textContent = "Save Reflection";

  editingAnnotationId = null;
  const addAnnBtn = document.getElementById("addAnnotationBtn");
  if (addAnnBtn) addAnnBtn.textContent = "Save Note";

  if (
    !fromHistory &&
    window.history.state &&
    window.history.state.modal === "notesDrawer"
  ) {
    window.history.back();
  }
}

// ============================================================
// GLOBAL EVENT LISTENERS
// ============================================================
function setupEvents() {
  // Global Scroll Lock for the Workspace Drawer
  document.addEventListener(
    "wheel",
    (e) => {
      if (document.body.classList.contains("drawer-active")) {
        const inDrawer = e.target.closest("#notesSection");
        if (!inDrawer) {
          e.preventDefault();
        }
      }
    },
    { passive: false },
  );

  document.addEventListener(
    "touchmove",
    (e) => {
      if (document.body.classList.contains("drawer-active")) {
        const inDrawer = e.target.closest("#notesSection");
        if (!inDrawer) {
          e.preventDefault();
        }
      }
    },
    { passive: false },
  );

  document.addEventListener(
    "keydown",
    (e) => {
      if (document.body.classList.contains("drawer-active")) {
        const keys = [
          "ArrowUp",
          "ArrowDown",
          " ",
          "PageUp",
          "PageDown",
          "Home",
          "End",
        ];
        if (
          keys.includes(e.key) &&
          !e.target.closest("#notesSection") &&
          e.target.tagName !== "TEXTAREA" &&
          e.target.tagName !== "INPUT"
        ) {
          e.preventDefault();
        }
      }
    },
    { passive: false },
  );

  // App Onboarding Modal
  const onboardingModal = document.getElementById("onboardingModal");
  const startExploringBtn = document.getElementById("startExploringBtn");
  const tutNextBtn = document.getElementById("tutNextBtn");
  const tutPrevBtn = document.getElementById("tutPrevBtn");
  const slides = document.querySelectorAll(".tutorial-slide");
  const dots = document.querySelectorAll(".tut-dot");
  let currentSlide = 0;

  function showSlide(index) {
    if (!slides.length) return;
    slides.forEach(
      (s, i) => (s.style.display = i === index ? "block" : "none"),
    );
    dots.forEach((d, i) => d.classList.toggle("active", i === index));
    tutPrevBtn.style.visibility = index === 0 ? "hidden" : "visible";
    if (index === slides.length - 1) {
      tutNextBtn.style.display = "none";
      startExploringBtn.style.display = "block";
    } else {
      tutNextBtn.style.display = "block";
      startExploringBtn.style.display = "none";
    }
  }

  if (onboardingModal && startExploringBtn) {
    if (localStorage.getItem("osmosis_intro_dismissed") !== "1") {
      onboardingModal.classList.add("active");
      showSlide(0);
    }

    if (tutNextBtn)
      tutNextBtn.addEventListener("click", () => {
        if (currentSlide < slides.length - 1) showSlide(++currentSlide);
      });

    if (tutPrevBtn)
      tutPrevBtn.addEventListener("click", () => {
        if (currentSlide > 0) showSlide(--currentSlide);
      });

    startExploringBtn.addEventListener("click", () => {
      onboardingModal.style.opacity = "0";
      onboardingModal.style.transition = "opacity 0.4s ease";
      setTimeout(() => {
        onboardingModal.classList.remove("active");
        onboardingModal.style.opacity = "";
        onboardingModal.style.transition = "";
        localStorage.setItem("osmosis_intro_dismissed", "1");
      }, 400);
    });
  }

  // Replay Tutorial from Settings
  const replayTutorialBtn = document.getElementById("replayTutorialBtn");
  if (replayTutorialBtn) {
    replayTutorialBtn.addEventListener("click", () => {
      const tips = [
        "hide_tip_explore",
        "hide_tip_annotations_empty",
        "hide_tip_reflections_empty",
        "hide_tip_paths",
        "hide_tip_timeline",
        "hide_tip_heatmap",
        "hide_tip_profile",
        "hide_tip_cryptograph",
      ];
      tips.forEach((t) => localStorage.removeItem(t));

      currentSlide = 0;
      showSlide(0);
      onboardingModal.classList.add("active");

      showProfile();
      showToast("Tutorial & App Tips restored!");
    });
  }

  // Header Navigation
  const logoHomeBtn = document.getElementById("logoHomeBtn");
  if (logoHomeBtn) {
    logoHomeBtn.addEventListener("click", () => {
      stopTTS();
      updateActiveNav("navHome");
      goToExploreView();
    });
  }

  // Theme Toggle Long Press Logic
  const themeBtn = document.getElementById("themeToggleBtn");
  const themeMenu = document.getElementById("themeOptionsMenu");
  let themePressTimer;
  let themeIsLongPress = false;

  if (themeBtn) {
    const startThemePress = () => {
      themeIsLongPress = false;
      themePressTimer = setTimeout(() => {
        themeIsLongPress = true;
        if (navigator.vibrate) navigator.vibrate(15);
        if (themeMenu) themeMenu.style.display = "flex";
      }, 500); // 500ms hold to trigger menu
    };
    const cancelThemePress = () => clearTimeout(themePressTimer);

    themeBtn.addEventListener("mousedown", startThemePress);
    themeBtn.addEventListener("touchstart", startThemePress, { passive: true });
    themeBtn.addEventListener("mouseup", cancelThemePress);
    themeBtn.addEventListener("mouseleave", cancelThemePress);
    themeBtn.addEventListener("touchend", cancelThemePress);

    themeBtn.addEventListener("click", (e) => {
      if (themeIsLongPress) {
        e.preventDefault();
        return;
      }
      toggleTheme();
    });
  }

  if (themeMenu) {
    document.addEventListener("click", (e) => {
      if (
        themeMenu.style.display === "flex" &&
        !themeBtn.contains(e.target) &&
        !themeMenu.contains(e.target)
      ) {
        themeMenu.style.display = "none";
      }
    });

    document
      .getElementById("btnStandardDark")
      ?.addEventListener("click", () => {
        document.documentElement.setAttribute("data-theme", "dark");
        localStorage.setItem("osmosis_theme", "dark");
        localStorage.setItem("osmosis_dark_pref", "dark");
        updateThemeMeta();
        themeMenu.style.display = "none";
      });

    document
      .getElementById("btnOledMidnight")
      ?.addEventListener("click", () => {
        document.documentElement.setAttribute("data-theme", "midnight");
        localStorage.setItem("osmosis_theme", "midnight");
        localStorage.setItem("osmosis_dark_pref", "midnight");
        updateThemeMeta();
        themeMenu.style.display = "none";
      });
  }

  // Live word / read-time counter on the Create form
  document
    .getElementById("genContent")
    ?.addEventListener("input", updateGenContentCount);
  document
    .getElementById("genContent")
    ?.addEventListener("paste", handleCompositorPaste);
  document
    .getElementById("genImage")
    ?.addEventListener("change", handleGenImageInput);
  document
    .getElementById("genEditNextBtn")
    ?.addEventListener("click", saveAndEditNext);

  const profileBtn = document.getElementById("profileBtn");
  if (profileBtn) {
    profileBtn.addEventListener("click", () => {
      if (currentState.article && currentState.view === "profile") {
        if (currentState.mode === "explore") updateActiveNav("navHome");
        else if (currentState.mode === "timeline") updateActiveNav("navTimeline");

        switchView("articleView", true);
        const savedScroll = _sessionScroll[getStorageKey()];
        if (savedScroll) {
          setTimeout(
            () => window.scrollTo({ top: savedScroll, behavior: "auto" }),
            10,
          );
        }
      } else {
        showProfile();
      }
    });
  }

  // Bottom Navigation
  document.getElementById("navGenerator")?.addEventListener("click", () => {
    updateActiveNav("navGenerator");
    switchView("generatorView");
  });

  const genSubmitBtn = document.getElementById("genSubmitBtn");
  if (genSubmitBtn) {
    genSubmitBtn.addEventListener("click", async () => {
      let domain =
        document.getElementById("genDomain")?.value.trim() ||
        (genEditingOriginal ? genEditingOriginal.domain : "") ||
        "Uncategorized";
      const topic = genEditingOriginal ? genEditingOriginal.sub : "General";
      const title = document.getElementById("genTitle").value.trim();
      const hook = document.getElementById("genHook").value.trim();
      const content = document.getElementById("genContent").value.trim();
      const author = document.getElementById("genAuthor")?.value.trim() || "";
      const genresRaw = document.getElementById("genGenres")?.value.trim() || "";
      const genres = genresRaw
        ? genresRaw
            .split(",")
            .map((g) => g.trim())
            .filter(Boolean)
        : [];
      // A zoomed crop is baked into the image itself before saving;
      // a SHRUNK photo (fit mode) is stored as a factor instead, so the
      // original image is never destroyed.
      if (genImageZoom > 1.001 && genImageData.startsWith("data:")) {
        genImageData = await bakeGenImageCrop();
        genImageRef = ""; // it is a new image now
        genImagePos = "50% 50%";
        genImageZoom = 1;
        setGenImagePreview(genImageData, "");
      }
      const imageFit = genImageZoom < 0.999 ? Number(genImageZoom.toFixed(2)) : "";
      const imagePos = genImagePos || "50% 50%";

      // Validate inputs
      if (!title || !content) {
        alert("Please provide at least a title and content.");
        return;
      }
      if (title.length > 200) {
        alert("Title must be 200 characters or less.");
        return;
      }
      if (content.length > 50000) {
        alert("Content must be 50,000 characters or less.");
        return;
      }
      if (!domain || domain.trim() === "") {
        domain = "Uncategorized";
      }

      genSubmitBtn.textContent = "Saving...";
      genSubmitBtn.disabled = true;

      const customData = JSON.parse(
        localStorage.getItem("osmosis_custom_content") || "{}",
      );

      if (genEditingOriginal) {
        const { domain: oldD, sub: oldS, art: oldA } = genEditingOriginal;
        if (oldD !== domain || oldS !== topic || oldA !== title) {
          if (customData[oldD]?.subtopics[oldS]?.articles[oldA]) {
            delete customData[oldD].subtopics[oldS].articles[oldA];
            if (
              Object.keys(customData[oldD].subtopics[oldS].articles).length ===
              0
            )
              delete customData[oldD].subtopics[oldS];
            if (Object.keys(customData[oldD].subtopics).length === 0)
              delete customData[oldD];
          }
          if (window.topicsData[oldD]?.subtopics[oldS]?.articles[oldA]) {
            delete window.topicsData[oldD].subtopics[oldS].articles[oldA];
            if (
              Object.keys(window.topicsData[oldD].subtopics[oldS].articles)
                .length === 0
            )
              delete window.topicsData[oldD].subtopics[oldS];
            if (Object.keys(window.topicsData[oldD].subtopics).length === 0)
              delete window.topicsData[oldD];
          }
        }
      }

      // Move the cover photo into IndexedDB and keep only a small reference
      // in localStorage, so photos no longer blow the ~5MB storage cap.
      let image = "";
      if (genImageData) {
        if (genImageRef && genImageRef.startsWith("idb:")) {
          image = genImageRef; // unchanged photo from an edit — reuse it
        } else if (genImageData.startsWith("data:")) {
          try {
            const id = genNewImageId();
            await idbSetImage(id, genImageData);
            _imgCache[id] = genImageData;
            image = "idb:" + id;
          } catch (e) {
            image = genImageData; // last resort: keep inline
          }
        } else {
          image = genImageData;
        }
      }

      if (!customData[domain]) customData[domain] = { subtopics: {} };
      if (!customData[domain].subtopics[topic])
        customData[domain].subtopics[topic] = { articles: {} };
      customData[domain].subtopics[topic].articles[title] = {
        content: content,
        description: hook,
        author: author,
        genres: genres,
        image: image,
        imagePos: imagePos,
        imageFit: imageFit,
      };
      try {
        localStorage.setItem(
          "osmosis_custom_content",
          JSON.stringify(customData),
        );
      } catch (err) {
        alert(
          "Couldn't save — your device storage is full. Try a smaller cover image.",
        );
        genSubmitBtn.textContent = "Save Story";
        genSubmitBtn.disabled = false;
        return;
      }

      if (!window.topicsData) window.topicsData = {};
      if (!window.topicsData[domain])
        window.topicsData[domain] = { subtopics: {} };
      if (!window.topicsData[domain].subtopics[topic])
        window.topicsData[domain].subtopics[topic] = { articles: {} };
      window.topicsData[domain].subtopics[topic].articles[title] = {
        content: content,
        description: hook,
        author: author,
        genres: genres,
        image: image,
        imagePos: imagePos,
        imageFit: imageFit,
      };

      try {
        if (typeof publishToDisk === "function") publishToDisk();
      } catch (e) {}

      genSubmitBtn.style.display = "none";
      const cancelBtn = document.getElementById("genCancelEditBtn");
      if (cancelBtn) cancelBtn.style.display = "none";

      // Hide the form so the confirmation isn't crowded by empty fields
      const createFlow = document.getElementById("genCreateFlow");
      if (createFlow) createFlow.style.display = "none";

      let successDiv = document.getElementById("genSuccessState");
      if (!successDiv) {
        successDiv = document.createElement("div");
        successDiv.id = "genSuccessState";
        successDiv.style.cssText =
          "max-width: 420px; margin: 48px auto; padding: 0 16px;";
        successDiv.innerHTML = `
          <div class="glass-panel" style="padding: 28px 24px; text-align: center; border-color: var(--sage);">
            <h3 style="color: var(--sage); margin-bottom: 20px;">Story Saved!</h3>
            <div style="display: flex; gap: 12px; justify-content: center;">
              <button id="genAddAnotherBtn" class="secondary">Add Another</button>
              <button id="genGoToArticleBtn" class="primary">Read Now</button>
            </div>
          </div>
        `;
        (createFlow ? createFlow.parentNode : genSubmitBtn.parentNode).appendChild(successDiv);

        document
          .getElementById("genAddAnotherBtn")
          .addEventListener("click", () => {
            document.getElementById("genTitle").value = "";
            document.getElementById("genHook").value = "";
            document.getElementById("genContent").value = "";
            const a2 = document.getElementById("genAuthor");
            if (a2) a2.value = "";
            const g2 = document.getElementById("genGenres");
            if (g2) g2.value = "";
            clearGenImage();
            updateGenContentCount();
            genEditingOriginal = null;
            const enbA = document.getElementById("genEditNextBtn");
            if (enbA) enbA.style.display = "none";
            const cebA = document.getElementById("genCancelEditBtn");
            if (cebA) cebA.style.display = "none";
            successDiv.style.display = "none";
            const cf = document.getElementById("genCreateFlow");
            if (cf) cf.style.display = "block";
            genSubmitBtn.style.display = "block";
            genSubmitBtn.disabled = false;
            genSubmitBtn.textContent = "Save Story";
            window.scrollTo({ top: 0, behavior: "smooth" });
          });

        document
          .getElementById("genGoToArticleBtn")
          .addEventListener("click", () => {
            document.getElementById("genTitle").value = "";
            document.getElementById("genHook").value = "";
            document.getElementById("genContent").value = "";
            const a3 = document.getElementById("genAuthor");
            if (a3) a3.value = "";
            const g3 = document.getElementById("genGenres");
            if (g3) g3.value = "";
            clearGenImage();
            updateGenContentCount();
            genEditingOriginal = null;
            const enbA = document.getElementById("genEditNextBtn");
            if (enbA) enbA.style.display = "none";
            const cebA = document.getElementById("genCancelEditBtn");
            if (cebA) cebA.style.display = "none";
            successDiv.style.display = "none";
            const cf = document.getElementById("genCreateFlow");
            if (cf) cf.style.display = "block";
            genSubmitBtn.style.display = "block";
            genSubmitBtn.disabled = false;
            genSubmitBtn.textContent = "Save Story";

            const d = successDiv.dataset.domain;
            const s = successDiv.dataset.topic;
            const a = successDiv.dataset.title;

            updateActiveNav("navHome");
            navigateToArticle(d, s, a);
          });
      }

      successDiv.dataset.domain = domain;
      successDiv.dataset.topic = topic;
      successDiv.dataset.title = title;
      successDiv.style.display = "block";
    });
  }

  const btnGenNew = document.getElementById("btnGenNew");
  const btnGenManage = document.getElementById("btnGenManage");
  const genCreateFlow = document.getElementById("genCreateFlow");
  const genManageFlow = document.getElementById("genManageFlow");

  if (btnGenNew && btnGenManage) {
    btnGenNew.addEventListener("click", () => {
      btnGenNew.classList.add("active");
      btnGenManage.classList.remove("active");
      genCreateFlow.style.display = "block";
      genManageFlow.style.display = "none";
    });
    btnGenManage.addEventListener("click", () => {
      btnGenManage.classList.add("active");
      btnGenNew.classList.remove("active");
      genCreateFlow.style.display = "none";
      genManageFlow.style.display = "block";
      renderGeneratorManageList();
    });
  }

  const genCancelEditBtn = document.getElementById("genCancelEditBtn");
  if (genCancelEditBtn) {
    genCancelEditBtn.addEventListener("click", cancelCustomEdit);
  }

  // Bottom Navigation
  const navHome = document.getElementById("navHome");
  if (navHome) {
    navHome.addEventListener("click", () => {
      updateActiveNav("navHome");
      if (
        _readingActive &&
        currentState.article &&
        currentState.view !== "article" &&
        currentState.view !== "explore"
      ) {
        // A story is still open — return straight into it, where you were
        switchView("articleView", true);
        const savedScroll = _sessionScroll[getStorageKey()];
        if (savedScroll) {
          setTimeout(
            () => window.scrollTo({ top: savedScroll, behavior: "auto" }),
            10,
          );
        }
      } else {
        goToExploreView();
      }
    });
  }
  const enterGraphBtn = document.getElementById("enterGraphBtn");
  if (enterGraphBtn) {
    enterGraphBtn.addEventListener("click", initNeuralWeb);
  }

  const navTimeline = document.getElementById("navTimeline");
  if (navTimeline) {
    navTimeline.addEventListener("click", () => {
      navTimeline.classList.remove("new-feature");
      localStorage.removeItem("new_feature_timeline");
      updateActiveNav("navTimeline");
      switchView("timelineView");
      const activeFilter = document.querySelector(".timeline-filter-btn.active");
      renderTimeline(activeFilter ? activeFilter.dataset.filter : "All");
    });
  }

  const navDashboard = document.getElementById("navDashboard");
  if (navDashboard) {
    navDashboard.addEventListener("click", () => {
      updateActiveNav("navDashboard");
      switchView("dashboardView");
      renderDashboard();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  // Settings button - go straight to settings
  const navMenuBtn = document.getElementById("navMenuBtn");
  if (navMenuBtn) {
    navMenuBtn.addEventListener("click", () => {
      updateActiveNav("navMenuBtn");
      switchView("profileView");
    });
  }

  // Auto-hide Navs on Scroll
  const bottomNav = document.querySelector(".bottom-nav");
  const topNav = document.querySelector(".top-app-bar");
  let lastScrollY = window.scrollY;
  window.addEventListener("scroll", () => {
    const currentScrollY = window.scrollY;
    if (currentScrollY <= 20) {
      if (bottomNav) bottomNav.classList.remove("bottom-nav-hidden");
      if (topNav) topNav.classList.remove("top-nav-hidden");
      lastScrollY = currentScrollY;
    } else if (Math.abs(currentScrollY - lastScrollY) > 15) {
      // Snappier threshold
      if (currentScrollY > lastScrollY && currentScrollY > 50) {
        // Hide almost immediately when scrolling down
        if (bottomNav) bottomNav.classList.add("bottom-nav-hidden");
        if (topNav) topNav.classList.add("top-nav-hidden");
      } else if (currentScrollY < lastScrollY) {
        if (bottomNav) bottomNav.classList.remove("bottom-nav-hidden");
        if (topNav) topNav.classList.remove("top-nav-hidden");
      }
      lastScrollY = currentScrollY;
    }
  });

  // Article/Path Back Buttons
  const backToPathsListBtn = document.getElementById("backToPathsList");
  if (backToPathsListBtn) {
    backToPathsListBtn.addEventListener("click", () => {
      stopTTS();
      renderPathsList();
    });
  }

  document.getElementById("backToPrevious").addEventListener("click", () => {
    stopTTS();
    // Back is an explicit exit: the story is no longer "open", so tab
    // switches won't return into it — and its place is forgotten, so
    // reopening it starts from the beginning.
    _readingActive = false;
    try {
      delete _sessionScroll[getStorageKey()];
    } catch (e) {}
    if (currentState.mode === "timeline") {
      updateActiveNav("navTimeline");
      switchView("timelineView");
      const activeFilter = document.querySelector(
        ".timeline-filter-btn.active",
      );
      renderTimeline(activeFilter ? activeFilter.dataset.filter : "All");
    } else {
      goToExploreView();
    }
  });

  // Deep Work Logic
  function startDeepWork() {
    ensureFocusAudio();
    document.body.classList.add("deep-work-active");
    showFocusExitHint();
    dwSeconds = DW_TOTAL_SECONDS;
    updateDWDisplay();
    const article =
      window.topicsData[currentState.category]?.subtopics[currentState.subtopic]
        ?.articles[currentState.article];
    dwStartWords = article ? article.content.split(/\s+/).length : 0;
    dwInterval = setInterval(() => {
      dwSeconds--;
      updateDWDisplay();
      if (dwSeconds <= 0) endDeepWork(true);
    }, 1000);
    showToast("Deep Work session started. Distractions hidden.");
  }
  function updateDWDisplay() {
    const m = Math.floor(dwSeconds / 60)
      .toString()
      .padStart(2, "0");
    const s = (dwSeconds % 60).toString().padStart(2, "0");
    const display = document.getElementById("deepWorkTimerDisplay");
    if (display) display.textContent = `${m}:${s}`;
  }
  function endDeepWork(completed) {
    clearInterval(dwInterval);
    document.body.classList.remove("deep-work-active");
    const timeSpent = DW_TOTAL_SECONDS - dwSeconds;
    const minsSpent = Math.max(1, Math.ceil(timeSpent / 60));
    if (completed || timeSpent > 60) {
      logDeskTime(timeSpent);
      document.getElementById("dwMins").textContent = minsSpent;
      document.getElementById("dwWords").textContent = dwStartWords;
      const life = document.getElementById("dwLifetime");
      if (life) life.textContent = formatDeskTime(getDeskSeconds());
      document.getElementById("dwModal").classList.add("active");
      playFocusChime();
    } else showToast("Deep Work cancelled.");
  }

  // ============================================================
  // CONTEXTUAL DRAWER & FLOATING MENU LOGIC
  // ============================================================
  const articleEl = document.getElementById("articleContent");
  const floatingMenu = document.getElementById("floatingSelectionMenu");
  const mobileSelectionActions = document.getElementById(
    "mobileSelectionActions",
  );
  const mobileHighlightBtn = document.getElementById("mobileHighlightBtn");
  const mobileAddNoteBtn = document.getElementById("mobileAddNoteBtn");
  const isTouchUI =
    window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;

  // Runs immediately: setupEvents() is already invoked during DOMContentLoaded,
  // so a nested DOMContentLoaded listener here would never fire (its handlers —
  // swipe-to-close, drag zones, backdrop tap — silently never attached).
  {
    const nDrawer = document.getElementById("notesSection");
    const nBackdrop = document.getElementById("notesBackdrop");

    if (nBackdrop) nBackdrop.addEventListener("click", closeNotesDrawer);

    document
      .querySelectorAll(
        ".close-drawer-btn, #closeNotesBtn, .drawer-drag-handle",
      )
      .forEach((btn) => {
        btn.addEventListener("click", closeNotesDrawer);
      });

    // Pull-to-close logic for Notes Drawer
    let drawerStartY = -1;
    let drawerCurrentY = 0;
    let hasVibrated = false;
    let isDrawerPulling = false;
    let isDrawerScrolling = false;
    let drawerStartX = -1;
    let drawerStartRawY = -1;
    let drawerCurrentX = 0;
    let isDrawerSwipingX = false;

    if (nDrawer) {
      nDrawer.addEventListener(
        "touchstart",
        (e) => {
          const isInput =
            e.target.tagName === "TEXTAREA" || e.target.tagName === "INPUT";
          if (isInput && e.target.scrollTop > 5) {
            drawerStartY = -1;
            drawerStartX = -1;
            return;
          }

          drawerStartX = e.touches[0].clientX;
          drawerStartRawY = e.touches[0].clientY;
          drawerCurrentX = drawerStartX;
          isDrawerSwipingX = false;

          const slide = e.target.closest(".carousel-slide, .carousel-card");
          const slideAtTop = slide ? slide.scrollTop <= 5 : true;
          const drawerAtTop = nDrawer.scrollTop <= 5;

          if (slideAtTop && drawerAtTop) {
            drawerStartY = e.touches[0].clientY;
            drawerCurrentY = drawerStartY;
            hasVibrated = false;
            isDrawerPulling = false;
            isDrawerScrolling = false;
          } else {
            drawerStartY = -1;
          }
        },
        { passive: true },
      );

      nDrawer.addEventListener(
        "touchmove",
        (e) => {
          drawerCurrentX = e.touches[0].clientX;
          const deltaX =
            drawerStartX !== -1 ? drawerCurrentX - drawerStartX : 0;
          const deltaRawY =
            drawerStartRawY !== -1 ? e.touches[0].clientY - drawerStartRawY : 0;

          if (
            drawerStartX !== -1 &&
            !isDrawerPulling &&
            !isDrawerScrolling &&
            !isDrawerSwipingX
          ) {
            if (
              Math.abs(deltaX) > 15 &&
              Math.abs(deltaX) > Math.abs(deltaRawY)
            ) {
              isDrawerSwipingX = true;
            } else if (drawerStartY !== -1) {
              if (deltaRawY > 5) {
                isDrawerPulling = true;
              } else if (deltaRawY < -5) {
                isDrawerScrolling = true;
              }
            } else if (Math.abs(deltaRawY) > 10) {
              isDrawerScrolling = true;
            }
          }

          if (isDrawerPulling && drawerStartY !== -1) {
            drawerCurrentY = e.touches[0].clientY;
            const deltaY = drawerCurrentY - drawerStartY;

            if (e.cancelable) e.preventDefault(); // Stops the background from scrolling/moving while dragging

            if (
              deltaY > 15 &&
              document.activeElement &&
              (document.activeElement.tagName === "TEXTAREA" ||
                document.activeElement.tagName === "INPUT")
            ) {
              document.activeElement.blur();
            }

            // Visually pull the drawer down alongside the finger (with 0.6x resistance)
            nDrawer.style.transform = `translateY(${Math.max(0, deltaY * 0.6)}px)`;
            nDrawer.style.transition = "none";
            if (nBackdrop) {
              nBackdrop.style.opacity = Math.max(0, 1 - deltaY / 250);
              nBackdrop.style.transition = "none";
            }

            if (deltaY > 40 && !hasVibrated) {
              if (navigator.vibrate) navigator.vibrate(15); // Subtle haptic pop
              hasVibrated = true;
            }
          }
        },
        { passive: false },
      );

      const resetDrawer = (e) => {
        if (isDrawerSwipingX && drawerStartX !== -1) {
          const deltaX = drawerCurrentX - drawerStartX;
          if (deltaX > 50 && currentNotesStep > 0) {
            // Swiped right
            currentNotesStep--;
            updateNotesCarousel();
          } else if (deltaX < -50 && currentNotesStep < 1) {
            // Swiped left
            currentNotesStep++;
            updateNotesCarousel();
          }
        }

        if (drawerStartY !== -1) {
          const deltaY = drawerCurrentY - drawerStartY;
          if (isDrawerPulling && deltaY > nDrawer.offsetHeight * 0.5) {
            // Only close once pulled at least halfway down the sheet.
            nDrawer.style.transform = "";
            nDrawer.style.transition = "";
            if (nBackdrop) {
              nBackdrop.style.opacity = "";
              nBackdrop.style.transition = "";
            }
            closeNotesDrawer();
          } else {
            // Spring the sheet smoothly back to rest.
            nDrawer.style.transition =
              "transform 0.4s cubic-bezier(0.2, 0.9, 0.3, 1)";
            nDrawer.style.transform = "";
            if (nBackdrop) {
              nBackdrop.style.transition = "opacity 0.4s ease";
              nBackdrop.style.opacity = "";
            }
            setTimeout(() => {
              nDrawer.style.transition = "";
              if (nBackdrop) nBackdrop.style.transition = "";
            }, 400);
          }
        }
        drawerStartY = -1;
        drawerStartX = -1;
        drawerStartRawY = -1;
        isDrawerPulling = false;
        isDrawerScrolling = false;
        isDrawerSwipingX = false;
      };

      nDrawer.addEventListener("touchend", resetDrawer);
      nDrawer.addEventListener("touchcancel", resetDrawer);

      // Dedicated pull-to-close on the handle and header: always works,
      // regardless of where the inner lists are scrolled to.
      let zoneStartY = -1;
      let zoneCurY = 0;
      nDrawer
        .querySelectorAll(".drawer-drag-handle, .carousel-header")
        .forEach((zone) => {
          zone.addEventListener(
            "touchstart",
            (e) => {
              e.stopPropagation();
              zoneStartY = e.touches[0].clientY;
              zoneCurY = zoneStartY;
            },
            { passive: true },
          );
          zone.addEventListener(
            "touchmove",
            (e) => {
              if (zoneStartY === -1) return;
              e.stopPropagation();
              zoneCurY = e.touches[0].clientY;
              const dy = zoneCurY - zoneStartY;
              if (dy > 0) {
                if (e.cancelable) e.preventDefault();
                nDrawer.style.transform = `translateY(${dy * 0.85}px)`;
                nDrawer.style.transition = "none";
              }
            },
            { passive: false },
          );
          const zoneEnd = (e) => {
            if (zoneStartY === -1) return;
            e.stopPropagation();
            const dy = zoneCurY - zoneStartY;
            zoneStartY = -1;
            if (dy > nDrawer.offsetHeight * 0.5) {
              nDrawer.style.transform = "";
              nDrawer.style.transition = "";
              closeNotesDrawer();
            } else {
              // Spring smoothly back to rest.
              nDrawer.style.transition =
                "transform 0.4s cubic-bezier(0.2, 0.9, 0.3, 1)";
              nDrawer.style.transform = "";
              setTimeout(() => {
                nDrawer.style.transition = "";
              }, 400);
            }
          };
          zone.addEventListener("touchend", zoneEnd);
          zone.addEventListener("touchcancel", zoneEnd);
        });
    }

    if (nBackdrop) {
      nBackdrop.addEventListener("touchmove", (e) => e.preventDefault(), {
        passive: false,
      });
    }
  }

  window.addEventListener("popstate", (e) => {
    if (document.body.classList.contains("drawer-active")) {
      closeNotesDrawer(true);
    }
  });

  let selectionTimeout;

  function positionFloatingMenu(selectionRect) {
    if (!floatingMenu) return;
    let topPos = selectionRect.bottom + 12;
    if (topPos > window.innerHeight - 60) {
      topPos = selectionRect.top - 60;
    }
    let leftPos = selectionRect.left + selectionRect.width / 2;
    const safeEdge = 60;
    if (leftPos < safeEdge) leftPos = safeEdge;
    if (leftPos > window.innerWidth - safeEdge) {
      leftPos = window.innerWidth - safeEdge;
    }
    floatingMenu.style.top = `${topPos}px`;
    floatingMenu.style.left = `${leftPos}px`;
  }

  function refreshSelectionActions(forceOpenPopup = false) {
    const selection = window.getSelection();
    const text = selection ? selection.toString().trim() : "";
    activeSelection = text;
    const hasArticleSelection =
      text.length > 0 && currentState.view === "article";

    if (hasArticleSelection) {
      let pIndex = -1;
      let occurrence = 0;
      let node = selection.anchorNode;
      if (node && node.nodeType === 3) node = node.parentNode;
      if (node && node.closest) {
        const block = node.closest("#articleContent > *");
        if (block) {
          const allBlocks = Array.from(
            document.getElementById("articleContent").children,
          );
          pIndex = allBlocks.indexOf(block);

          try {
            const range = selection.getRangeAt(0);
            const preRange = document.createRange();
            preRange.setStart(block, 0);
            preRange.setEnd(range.startContainer, range.startOffset);
            const preText = preRange.toString();
            const escaped = text
              .trim()
              .replace(/[-[\]{}()*+?.,\\^$|#]/g, "\\$&")
              .replace(/\s+/g, "(?:\\s+|<[^>]+>)*");
            const regex = new RegExp(`(${escaped})(?![^<]*>)`, "gi");
            const matches = preText.match(regex);
            occurrence = matches ? matches.length : 0;
          } catch (e) {}
        }
      }
      lastSelectionSnapshot = { text, pIndex, occurrence };
    }

    if (mobileSelectionActions) {
      mobileSelectionActions.classList.toggle(
        "show",
        isTouchUI && hasArticleSelection,
      );
    }

    if (!floatingMenu) return;
    if (isTouchUI) {
      floatingMenu.classList.remove("active");
      return;
    }
    if (!hasArticleSelection) {
      floatingMenu.classList.remove("active");
      return;
    }
    if (forceOpenPopup) {
      positionFloatingMenu(selection.getRangeAt(0).getBoundingClientRect());
      floatingMenu.classList.add("active");
    }

    if (hasArticleSelection) {
      const preview = document.getElementById("selectedTextPreview");
      if (preview)
        preview.textContent =
          text.length > 50 ? text.substring(0, 50) + "..." : text;
    } else {
      const preview = document.getElementById("selectedTextPreview");
      if (preview)
        preview.textContent =
          "Select text in the article, then type a note below.";
    }
  }

  let isMouseDraggingSelection = false;

  document.addEventListener("selectionchange", () => {
    clearTimeout(selectionTimeout);

    selectionTimeout = setTimeout(() => {
      refreshSelectionActions(!isMouseDraggingSelection);
    }, 300);
  });

  document.addEventListener(
    "scroll",
    () => {
      if (floatingMenu) floatingMenu.classList.remove("active");
      if (mobileSelectionActions && !window.getSelection().toString().trim()) {
        mobileSelectionActions.classList.remove("show");
      }
    },
    true,
  );

  document.addEventListener("mousedown", (e) => {
    isMouseDraggingSelection = true;
    const inFloating = floatingMenu && floatingMenu.contains(e.target);
    const inMobile =
      mobileSelectionActions && mobileSelectionActions.contains(e.target);

    if (!inFloating && !inMobile) {
      setTimeout(() => {
        if (window.getSelection().toString().trim().length === 0) {
          if (floatingMenu) floatingMenu.classList.remove("active");
          if (mobileSelectionActions)
            mobileSelectionActions.classList.remove("show");
        }
      }, 100);
    }
  });

  document.addEventListener("mouseup", (e) => {
    isMouseDraggingSelection = false;
    setTimeout(() => {
      if (
        window.getSelection().toString().trim().length > 0 &&
        currentState.view === "article"
      ) {
        refreshSelectionActions(true);
      }
    }, 10);
  });

  document.addEventListener("touchstart", (e) => {
    const inFloating = floatingMenu && floatingMenu.contains(e.target);
    const inMobile =
      mobileSelectionActions && mobileSelectionActions.contains(e.target);

    if (!inFloating && !inMobile) {
      setTimeout(() => {
        if (window.getSelection().toString().trim().length === 0) {
          if (floatingMenu) floatingMenu.classList.remove("active");
          if (mobileSelectionActions)
            mobileSelectionActions.classList.remove("show");
        }
      }, 100);
    }
  });

  function handleHighlightAction(e) {
    if (e && e.cancelable) e.preventDefault();
    if (!activeSelection && !lastSelectionSnapshot.text) {
      showToast("Select text first.");
      return;
    }
    saveNewAnnotation("");
    if (mobileSelectionActions) mobileSelectionActions.classList.remove("show");
    if (floatingMenu) floatingMenu.classList.remove("active");
  }

  function handleNoteAction(e) {
    if (e && e.cancelable) e.preventDefault();
    if (!activeSelection && !lastSelectionSnapshot.text) {
      showToast("Select text first.");
      return;
    }
    openNotesDrawer(1);
    if (mobileSelectionActions) mobileSelectionActions.classList.remove("show");
    if (floatingMenu) floatingMenu.classList.remove("active");
  }

  function handleBookmarkAction(e) {
    if (e && e.cancelable) e.preventDefault();
    if (!activeSelection && !lastSelectionSnapshot.text) {
      showToast("Select text first.");
      return;
    }
    saveNewAnnotation("Bookmarked");
    if (mobileSelectionActions) mobileSelectionActions.classList.remove("show");
    if (floatingMenu) floatingMenu.classList.remove("active");
  }

  function handleDefineAction(e) {
    if (e && e.cancelable) e.preventDefault();
    const raw = (activeSelection || lastSelectionSnapshot.text || "").trim();
    if (!raw) {
      showToast("Select a word first.");
      return;
    }
    const word = raw
      .split(/\s+/)[0]
      .replace(/[^A-Za-zÀ-ɏ'’-]/g, "")
      .toLowerCase();
    if (mobileSelectionActions) mobileSelectionActions.classList.remove("show");
    if (floatingMenu) floatingMenu.classList.remove("active");
    try {
      window.getSelection().removeAllRanges();
    } catch (e2) {}
    if (word) showDefinition(word);
  }

  if (mobileHighlightBtn) {
    mobileHighlightBtn.addEventListener("touchstart", handleHighlightAction, {
      passive: false,
    });
    mobileHighlightBtn.addEventListener("click", handleHighlightAction);
  }

  if (mobileAddNoteBtn) {
    mobileAddNoteBtn.addEventListener("touchstart", handleNoteAction, {
      passive: false,
    });
    mobileAddNoteBtn.addEventListener("click", handleNoteAction);
  }

  document.addEventListener("keydown", (e) => {
    // Global Search Shortcut (Ctrl/Cmd + K)
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
      e.preventDefault();
      document.getElementById("globalSearch").focus();
      return;
    }

    if (e.key === "Escape") {
      closeNotesDrawer();
      if (floatingMenu) floatingMenu.classList.remove("active");
      const onboardingModal = document.getElementById("onboardingModal");
      if (onboardingModal && onboardingModal.classList.contains("active")) {
        onboardingModal.classList.remove("active");
        localStorage.setItem("osmosis_intro_dismissed", "1");
      }
      const dwModal = document.getElementById("dwModal");
      if (dwModal) dwModal.classList.remove("active");
      return;
    }

    // Ignore single-key shortcuts if typing in an input
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

    if (e.key.toLowerCase() === "t" && currentState.view === "article")
      toggleTTS();
    if (e.key.toLowerCase() === "f" && currentState.view === "article") {
      if (!document.body.classList.contains("deep-work-active"))
        startDeepWork();
    }

    if (document.body.classList.contains("drawer-active")) {
      if (e.key === "ArrowLeft" && currentNotesStep > 0) {
        currentNotesStep--;
        updateNotesCarousel();
      } else if (e.key === "ArrowRight" && currentNotesStep < 1) {
        currentNotesStep++;
        updateNotesCarousel();
      }
    }
  });

  const fabHighlight = document.getElementById("fabHighlight");
  const fabNote = document.getElementById("fabNote");
  const fabBookmark = document.getElementById("fabBookmark");
  const mobileBookmarkBtn = document.getElementById("mobileBookmarkBtn");

  if (fabHighlight) {
    fabHighlight.addEventListener("touchstart", handleHighlightAction, {
      passive: false,
    });
    fabHighlight.addEventListener("click", handleHighlightAction);
  }

  if (fabNote) {
    fabNote.addEventListener("touchstart", handleNoteAction, {
      passive: false,
    });
    fabNote.addEventListener("click", handleNoteAction);
  }

  if (fabBookmark) {
    fabBookmark.addEventListener("touchstart", handleBookmarkAction, {
      passive: false,
    });
    fabBookmark.addEventListener("click", handleBookmarkAction);
  }

  const fabDefine = document.getElementById("fabDefine");
  if (fabDefine) {
    fabDefine.addEventListener("touchstart", handleDefineAction, {
      passive: false,
    });
    fabDefine.addEventListener("click", handleDefineAction);
  }
  const mobileDefineBtn = document.getElementById("mobileDefineBtn");
  if (mobileDefineBtn) {
    mobileDefineBtn.addEventListener("touchstart", handleDefineAction, {
      passive: false,
    });
    mobileDefineBtn.addEventListener("click", handleDefineAction);
  }

  if (mobileBookmarkBtn) {
    mobileBookmarkBtn.addEventListener("touchstart", handleBookmarkAction, {
      passive: false,
    });
    mobileBookmarkBtn.addEventListener("click", handleBookmarkAction);
  }

  const topNotesBtn = document.getElementById("topNotesBtn");
  if (topNotesBtn)
    topNotesBtn.addEventListener("click", () => openNotesDrawer(0));

  // Article Double-Tap Logic
  const articleContainer = document.getElementById("articleContent");
  let articleLastTapTime = 0;
  if (articleContainer) {
    articleContainer.addEventListener("click", (e) => {
      const now = Date.now();
      if (now - articleLastTapTime < 300) {
        const mark = e.target.closest(
          "mark.highlighted-text, span.inline-bookmark",
        );
        if (mark) {
          openNotesDrawer(1); // Open Notes Tab
          setTimeout(() => {
            const list = document.getElementById("annotationsList");
            if (list) {
              const items = list.querySelectorAll(".annotation-item");
              const rawText = mark.textContent.trim().toLowerCase();
              for (let el of items) {
                if (el.textContent.toLowerCase().includes(rawText)) {
                  const slide = el.closest(".carousel-slide, .carousel-card");
                  if (slide) {
                    const topPos =
                      el.getBoundingClientRect().top -
                      slide.getBoundingClientRect().top +
                      slide.scrollTop -
                      80;
                    slide.scrollTo({ top: topPos, behavior: "smooth" });
                  } else {
                    el.scrollIntoView({ behavior: "smooth", block: "center" });
                  }
                  el.style.boxShadow =
                    "0 0 15px color-mix(in srgb, var(--accent) 50%, transparent)";
                  setTimeout(() => (el.style.boxShadow = "none"), 2000);
                  break;
                }
              }
            }
          }, 450); // Wait for drawer transition
          window.getSelection().removeAllRanges(); // Clear OS text selection
        }
      }
      articleLastTapTime = now;
    });
  }

  document
    .getElementById("startDeepWorkBtn")
    .addEventListener("click", startDeepWork);
  document
    .getElementById("exitDeepWorkBtn")
    ?.addEventListener("click", () => endDeepWork(false));

  // Focus mode shows no chrome, so allow exiting with Escape or a tap on the page.
  document.addEventListener("keydown", (e) => {
    if (
      e.key === "Escape" &&
      document.body.classList.contains("deep-work-active")
    ) {
      endDeepWork(false);
    }
  });
  let dwLastTapTime = 0;
  document.addEventListener("click", (e) => {
    if (!document.body.classList.contains("deep-work-active")) return;
    // Don't exit while selecting/highlighting text
    if (window.getSelection && String(window.getSelection()).trim()) {
      dwLastTapTime = 0;
      return;
    }
    // Don't exit when interacting with a highlight, note, link, or control
    if (
      e.target.closest(
        "mark, a, button, input, textarea, select, .inline-bookmark, #notesSection, .floating-selection-menu",
      )
    )
      return;
    // Exit only on a DOUBLE tap, so a stray tap doesn't break focus
    const now = Date.now();
    if (now - dwLastTapTime < 350) {
      dwLastTapTime = 0;
      endDeepWork(false);
    } else {
      dwLastTapTime = now;
    }
  });

  document.getElementById("closeDwModalBtn").addEventListener("click", () => {
    document.getElementById("dwModal").classList.remove("active");
  });

  const closeActivityModalBtn = document.getElementById("closeActivityModal");
  if (closeActivityModalBtn) {
    closeActivityModalBtn.addEventListener("click", closeActivityModal);
  }

  const activityDetailModal = document.getElementById("activityDetailModal");
  if (activityDetailModal) {
    activityDetailModal.addEventListener("click", (e) => {
      if (e.target === activityDetailModal) {
        closeActivityModal();
      }
    });
  }

  const listenBtn = document.getElementById("listenBtn");
  if (listenBtn) {
    listenBtn.addEventListener("click", toggleTTS);
  }

  // Floating jump button: points down at the start of a story, flips to
  // point up once you're most of the way through.
  const scrollJumpBtn = document.getElementById("scrollJumpBtn");
  if (scrollJumpBtn) {
    scrollJumpBtn.addEventListener("click", () => {
      if (scrollJumpBtn.classList.contains("up")) {
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        window.scrollTo({
          top: document.body.scrollHeight,
          behavior: "smooth",
        });
      }
    });
  }

  const sortSelect = document.getElementById("exploreSortSelect");
  if (sortSelect) {
    sortSelect.value = currentExploreSort;
    sortSelect.addEventListener("change", (e) => {
      currentExploreSort = e.target.value;
      localStorage.setItem("osmosis_explore_sort", currentExploreSort);
      triggerAutoSync();
      renderArticleGrid();
    });
  }

  const filterSelect = document.getElementById("exploreFilterSelect");
  if (filterSelect) {
    filterSelect.value = currentExploreFilter;
    filterSelect.addEventListener("change", (e) => {
      currentExploreFilter = e.target.value;
      localStorage.setItem("osmosis_explore_filter", currentExploreFilter);
      triggerAutoSync();
      renderArticleGrid();
    });
  }

  // Serendipity Engine
  const serendipityBtn = document.getElementById("serendipityBtn");
  if (serendipityBtn) {
    serendipityBtn.addEventListener("click", () => {
      const unread = [];
      const all = [];
      Object.keys(window.topicsData || {}).forEach((d) => {
        const readList = userLearningJourney.topics[d]?.readArticles || [];
        Object.keys(window.topicsData[d].subtopics).forEach((s) => {
          Object.keys(window.topicsData[d].subtopics[s].articles).forEach(
            (a) => {
              const entry = { d, s, a };
              all.push(entry);
              if (!readList.includes(a)) unread.push(entry);
            },
          );
        });
      });
      const pool = unread.length > 0 ? unread : all;
      if (!pool.length) {
        showToast("No stories available in your library.");
        return;
      }
      const pick = pool[Math.floor(Math.random() * pool.length)];
      showToast(`Serendipity: Exploring ${pick.d}...`);
      currentState.mode = "explore";
      updateActiveNav("navHome");
      navigateToArticle(pick.d, pick.s, pick.a);
    });
  }

  const serendipityNoteBtn = document.getElementById("serendipityNoteBtn");
  if (serendipityNoteBtn) {
    serendipityNoteBtn.addEventListener("click", () => {
      const notes = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (
          key &&
          (key.endsWith("_annotations") || key.endsWith("_reflections"))
        ) {
          // Parse key safely - format is article_domain_subtopic_...article_name_type
          const parts = key.split("_");
          if (parts.length >= 4) {
            const suffix = key.endsWith("_annotations") ? "_annotations" : "_reflections";
            const withoutPrefix = key.replace("article_", "").replace(suffix, "");
            const keyParts = withoutPrefix.split("_");

            if (keyParts.length >= 2) {
              const domain = keyParts[0];
              const subtopic = keyParts[1];
              const articleName = keyParts.slice(2).join("_");

              try {
                const items = JSON.parse(localStorage.getItem(key) || "[]");
                items.forEach((item) => {
                  notes.push({
                    domain,
                    subtopic,
                    article: articleName,
                    data: item,
                  });
                });
              } catch (e) {}
            }
          }
        }
      }

      if (notes.length === 0) {
        showToast("No notes or reflections available in your library.");
        return;
      }

      const pick = notes[Math.floor(Math.random() * notes.length)];
      const isReflection = pick.data.text && !pick.data.note;

      let modal = document.getElementById("serendipityNoteModal");
      if (!modal) {
        modal = document.createElement("div");
        modal.id = "serendipityNoteModal";
        modal.className = "modal";
        modal.style.zIndex = "4000";
        modal.innerHTML = `
          <div class="glass-panel modal-content" style="max-width: 500px; padding: 2rem; text-align: left;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
              <div>
                <div style="font-size: 0.75rem; color: var(--accent); font-weight: bold; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;" id="serendipityNoteType">Note</div>
                <h3 style="margin: 0; font-size: 1.2rem; color: var(--dark-text);" id="serendipityNoteArticle">Article</h3>
              </div>
              <button id="closeSerendipityNoteBtn" class="icon-btn-small" style="padding: 4px; margin-top: -4px; margin-right: -4px;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
            </div>
            <div id="serendipityNoteContent" style="background: rgba(0,0,0,0.02); padding: 16px; border-radius: 12px; border: 1px solid var(--glass-border); margin-bottom: 20px;">
            </div>
            <button id="serendipityNoteGoBtn" class="primary btn-full">View in Story</button>
          </div>
        `;
        document.body.appendChild(modal);

        document
          .getElementById("closeSerendipityNoteBtn")
          .addEventListener("click", () => {
            modal.classList.remove("active");
          });

        document
          .getElementById("serendipityNoteGoBtn")
          .addEventListener("click", () => {
            modal.classList.remove("active");
            const { domain, subtopic, article } = modal.dataset;
            currentState.mode = "dashboard";
            updateActiveNav("navDashboard");
            navigateToArticle(domain, subtopic, article);
          });
      }

      const typeEl = document.getElementById("serendipityNoteType");
      const articleEl = document.getElementById("serendipityNoteArticle");
      const contentEl = document.getElementById("serendipityNoteContent");

      typeEl.textContent = isReflection ? "Reflection" : "Highlight & Note";
      articleEl.textContent = pick.article;

      if (isReflection) {
        contentEl.innerHTML =
          '<div style="font-size: 0.95rem; color: var(--dark-text); line-height: 1.5;">' +
          pick.data.text.replace(/\n/g, "<br>") +
          "</div>";
      } else {
        let html = "";
        if (pick.data.note && pick.data.note !== "Highlighted") {
          html +=
            '<div style="font-size: 0.9rem; font-weight: 600; color: var(--dark-text); margin-bottom: 8px;">' +
            pick.data.note.replace(/\n/g, "<br>") +
            "</div>";
        }
        if (pick.data.text) {
          html +=
            '<div style="font-size: 0.9rem; font-style: italic; color: var(--subtitle-color); border-left: 3px solid var(--accent); padding-left: 12px;">"' +
            pick.data.text.replace(/\n/g, "<br>") +
            '"</div>';
        }
        contentEl.innerHTML = html;
      }

      modal.dataset.domain = pick.domain;
      modal.dataset.subtopic = pick.subtopic;
      modal.dataset.article = pick.article;

      modal.classList.add("active");
    });
  }

  // ============================================================
  // DRAWER INTERIOR LOGIC
  // ============================================================

  document.querySelectorAll("#mainCarouselTabs .drawer-tab").forEach((tab) => {
    tab.addEventListener("click", (e) => {
      currentNotesStep = parseInt(e.currentTarget.dataset.step, 10);
      updateNotesCarousel();
    });
  });

  document
    .getElementById("highlightBtn")
    ?.addEventListener("click", () => saveNewAnnotation(""));
  document.getElementById("addAnnotationBtn")?.addEventListener("click", () => {
    saveNewAnnotation(document.getElementById("annotationInput").value.trim());
  });
  document
    .getElementById("saveReflectionBtn")
    ?.addEventListener("click", saveReflection);

  const _sBtn = document.getElementById("socraticBtn");
  if (_sBtn) _sBtn.addEventListener("click", startReflectionDialogue);
  const _nBtn = document.getElementById("noteGuideBtn");
  if (_nBtn) _nBtn.addEventListener("click", startNoteDialogue);
  const refInput = document.getElementById("reflectionInput");
  if (refInput) {
    refInput.addEventListener("input", (e) => {
      updateWsWordCount();
      if (!e.target.value) e.target.style.height = "";
      else wsAutoGrow(e.target);
      wsTypewriter(e.target);
      wsTypingPulse();
      const dm = document.getElementById("wsDraftMark");
      if (dm) dm.style.display = "none";
      clearTimeout(reflectionTypingTimer);
      reflectionTypingTimer = setTimeout(() => {
        saveReflectionState(e.target.value);
        saveWsDraft(e.target.value);
      }, 500);
    });
    refInput.addEventListener("blur", () => {
      clearTimeout(_wsTypingTimer);
      document.getElementById("notesSection")?.classList.remove("ws-typing");
    });
    saveReflectionState(refInput.value || "");
  }

  document
    .getElementById("wsWeaveBtn")
    ?.addEventListener("click", weaveMargins);

  const undoRefBtn = document.getElementById("undoRefBtn");
  if (undoRefBtn) undoRefBtn.addEventListener("click", undoReflection);

  const redoRefBtn = document.getElementById("redoRefBtn");
  if (redoRefBtn) redoRefBtn.addEventListener("click", redoReflection);

  const filtersEl = document.getElementById("timelineFilters");

  const notesSearchInput = document.getElementById("notesSearch");
  if (notesSearchInput) {
    notesSearchInput.addEventListener("input", (e) => {
      currentNotesSearch = e.target.value.toLowerCase().trim();
      loadAnnotations();
    });
    notesSearchInput.addEventListener("focus", function () {
      this.style.borderColor = "var(--accent)";
      this.style.boxShadow = "0 0 0 3px rgba(196, 98, 45, 0.1)";
    });
    notesSearchInput.addEventListener("blur", function () {
      this.style.borderColor = "var(--glass-border)";
      this.style.boxShadow = "none";
    });
  }

  // ============================================================
  // DASHBOARD & TIMELINE LOGIC
  // ============================================================

  const globalNotesSearch = document.getElementById("globalNotesSearch");
  if (globalNotesSearch) {
    globalNotesSearch.addEventListener("input", (e) => {
      renderGlobalNotes(e.target.value.trim());
    });
    globalNotesSearch.addEventListener("focus", function () {
      this.style.borderColor = "var(--accent)";
      this.style.boxShadow = "0 0 0 3px rgba(196, 98, 45, 0.1)";
    });
    globalNotesSearch.addEventListener("blur", function () {
      this.style.borderColor = "var(--glass-border)";
      this.style.boxShadow = "none";
    });
  }

  const timelineSearchInput = document.getElementById("timelineSearch");
  if (timelineSearchInput) {
    timelineSearchInput.addEventListener("input", (e) => {
      currentTimelineSearch = e.target.value.toLowerCase().trim();
      const timeline = document.getElementById("journeyTimeline");
      if (timeline) {
        clearTimeout(timelineTransitionTimeout);
        timelineTransitionTimeout = setTimeout(() => {
          renderTimeline();
        }, 220);
      }
    });
    timelineSearchInput.addEventListener("focus", function () {
      this.style.borderColor = "var(--accent)";
      this.style.boxShadow = "0 0 0 3px rgba(196, 98, 45, 0.1)";
    });
    timelineSearchInput.addEventListener("blur", function () {
      this.style.borderColor = "var(--glass-border)";
      this.style.boxShadow = "none";
    });
  }

  document.querySelectorAll(".timeline-filter-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const wasActive = e.currentTarget.classList.contains("active");
      const filterValue = e.currentTarget.dataset.filter;

      if (wasActive && filterValue !== "All") {
        const headers = document.querySelectorAll(
          "#journeyTimeline .timeline-group-header",
        );
        const isExpanded = Array.from(headers).some(
          (h) =>
            h.nextElementSibling &&
            h.nextElementSibling.style.gridTemplateRows === "1fr",
        );
        headers.forEach((h) => {
          const content = h.nextElementSibling;
          if (content) {
            content.style.gridTemplateRows = isExpanded ? "0fr" : "1fr";
            const icon = h.querySelector(".toggle-icon");
            if (icon)
              icon.style.transform = isExpanded
                ? "rotate(-90deg)"
                : "rotate(0deg)";
          }
        });
        return;
      }

      document
        .querySelectorAll(".timeline-filter-btn")
        .forEach((b) => b.classList.remove("active"));

      e.currentTarget.classList.add("active");

      const timeline = document.getElementById("journeyTimeline");
      if (timeline) {
        clearTimeout(timelineTransitionTimeout);
        timeline.style.opacity = "0";
        timelineTransitionTimeout = setTimeout(() => {
          renderTimeline(filterValue);
          timeline.style.opacity = "1";
        }, 200);
      } else {
        renderTimeline(filterValue);
      }
    });
  });

  document.querySelectorAll(".zoom-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      document
        .querySelectorAll(".zoom-btn")
        .forEach((b) => b.classList.remove("active"));
      e.currentTarget.classList.add("active");
      currentZoom = e.currentTarget.dataset.zoom;
      const activeFilter = document.querySelector(
        ".timeline-filter-btn.active",
      );

      const timeline = document.getElementById("journeyTimeline");
      if (timeline) {
        clearTimeout(timelineTransitionTimeout);
        timeline.style.opacity = "0";
        timelineTransitionTimeout = setTimeout(() => {
          renderTimeline(activeFilter ? activeFilter.dataset.filter : "All");
          timeline.style.opacity = "1";
        }, 200);
      } else {
        renderTimeline(activeFilter ? activeFilter.dataset.filter : "All");
      }
    });
  });

  const toggleAllBtn = document.getElementById("toggleAllTimelineBtn");
  if (toggleAllBtn) {
    toggleAllBtn.addEventListener("click", () => {
      const isExpanding = toggleAllBtn.textContent.includes("Expand");

      if (isExpanding) {
        toggleAllBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"></polyline></svg> Collapse All`;

        document
          .querySelectorAll("#journeyTimeline .timeline-group-header")
          .forEach((h) => {
            const content = h.nextElementSibling;
            if (content) content.style.gridTemplateRows = "1fr";
            const icon = h.querySelector(".toggle-icon");
            if (icon) icon.style.transform = "rotate(0deg)";
          });
        document
          .querySelectorAll("#journeyTimeline .timeline-item")
          .forEach((item) => item.classList.add("expanded"));
      } else {
        toggleAllBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg> Expand All`;

        document
          .querySelectorAll("#journeyTimeline .timeline-item")
          .forEach((item) => item.classList.remove("expanded"));
      }
    });
  }

  // ============================================================
  // SETTINGS LOGIC
  // ============================================================
  document.querySelectorAll(".hl-swatch").forEach((swatch) => {
    swatch.addEventListener("click", (e) => {
      document
        .querySelectorAll(".hl-swatch")
        .forEach((s) => s.classList.remove("active"));
      e.target.classList.add("active");
      const color = e.target.dataset.hl;
      document.documentElement.setAttribute("data-hl-color", color);
      localStorage.setItem("osmosis_hl_color", color);
    });
  });

  document.getElementById("fontSizeSlider").addEventListener("input", (e) => {
    document.documentElement.style.setProperty(
      "--article-font-size",
      e.target.value + "rem",
    );
    saveReaderPrefs();
  });

  document.getElementById("lineHeightSlider").addEventListener("input", (e) => {
    document.documentElement.style.setProperty(
      "--article-line-height",
      e.target.value,
    );
    saveReaderPrefs();
  });

  document
    .getElementById("letterSpacingSlider")
    .addEventListener("input", (e) => {
      document.documentElement.style.setProperty(
        "--article-letter-spacing",
        e.target.value + "px",
      );
      saveReaderPrefs();
    });

  document.getElementById("maxWidthSlider").addEventListener("input", (e) => {
    document.documentElement.style.setProperty(
      "--article-max-width",
      e.target.value + "px",
    );
    saveReaderPrefs();
  });

  document.querySelectorAll(".font-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      document
        .querySelectorAll(".font-btn")
        .forEach((b) => b.classList.remove("active"));
      e.currentTarget.classList.add("active");
      document.documentElement.style.setProperty(
        "--article-font-family",
        e.currentTarget.dataset.font,
      );
      saveReaderPrefs();
    });
  });

  document.querySelectorAll(".read-theme-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      document
        .querySelectorAll(".read-theme-btn")
        .forEach((b) => b.classList.remove("active"));
      e.currentTarget.classList.add("active");
      document.documentElement.setAttribute(
        "data-read-theme",
        e.currentTarget.dataset.themeVal,
      );
      saveReaderPrefs();
    });
  });

  document
    .getElementById("exportReportBtn")
    ?.addEventListener("click", exportReport);
  document
    .getElementById("exportTimelineBtn")
    ?.addEventListener("click", exportTimeline);
  document
    .getElementById("exportDataBtn")
    ?.addEventListener("click", exportObsidian);

  document
    .getElementById("exportBackupBtn")
    ?.addEventListener("click", exportBackup);
  document
    .getElementById("exportFullBackupBtn")
    ?.addEventListener("click", exportFullBackup);

  document
    .getElementById("openImportModalBtn")
    ?.addEventListener("click", () => {
      document.getElementById("importModal").classList.add("active");
      document.getElementById("importInput").value = "";
      document.getElementById("importInput").focus();
    });

  document
    .getElementById("closeImportModalBtn")
    ?.addEventListener("click", () => {
      document.getElementById("importModal").classList.remove("active");
    });

  document.getElementById("submitImportBtn")?.addEventListener("click", () => {
    applyImportedLibrary(document.getElementById("importInput").value);
  });

  document
    .getElementById("importFileInput")
    ?.addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => applyImportedLibrary(ev.target.result);
      reader.onerror = () => alert("Couldn't read the file.");
      reader.readAsText(file);
      e.target.value = ""; // allow re-picking the same file
    });

  document
    .getElementById("resetDataBtn")
    .addEventListener("click", async () => {
      if (
        confirm(
          "Are you sure? This will wipe all your highlights, notes, progress, and custom articles permanently.",
        )
      ) {
        const token = localStorage.getItem("osmosis_auth_token");
        localStorage.clear();
        if (token) localStorage.setItem("osmosis_auth_token", token);
        await pushToServer(); // Overwrite the cloud backup with an empty state
        window.location.reload();
      }
    });

  // Dark Mode Toggles
  const darkToggle = document.getElementById("darkModeToggle");
  const midnightToggle = document.getElementById("midnightModeToggle");

  if (darkToggle) {
    darkToggle.checked =
      document.documentElement.getAttribute("data-theme") === "dark";
    darkToggle.addEventListener("change", (e) => {
      if (e.target.checked) {
        document.documentElement.setAttribute("data-theme", "dark");
        localStorage.setItem("osmosis_theme", "dark");
        if (midnightToggle) midnightToggle.checked = false;
      } else {
        document.documentElement.removeAttribute("data-theme");
        localStorage.setItem("osmosis_theme", "light");
      }
      updateThemeMeta();
    });
  }

  if (midnightToggle) {
    midnightToggle.checked =
      document.documentElement.getAttribute("data-theme") === "midnight";
    midnightToggle.addEventListener("change", (e) => {
      if (e.target.checked) {
        document.documentElement.setAttribute("data-theme", "midnight");
        localStorage.setItem("osmosis_theme", "midnight");
        if (darkToggle) darkToggle.checked = false;
      } else {
        document.documentElement.removeAttribute("data-theme");
        localStorage.setItem("osmosis_theme", "light");
      }
      updateThemeMeta();
    });
  }

  const autoDarkToggle = document.getElementById("autoDarkToggle");
  if (autoDarkToggle) {
    autoDarkToggle.checked = localStorage.getItem("osmosis_auto_dark") === "1";
    autoDarkToggle.addEventListener("change", (e) => {
      localStorage.setItem("osmosis_auto_dark", e.target.checked ? "1" : "0");
      if (e.target.checked) applyAutoDark();
    });
  }

  const compactToggle = document.getElementById("compactToggle");
  if (compactToggle) {
    compactToggle.checked = localStorage.getItem("osmosis_compact") === "1";
    if (compactToggle.checked) document.body.classList.add("compact-mode");
    compactToggle.addEventListener("change", (e) => {
      document.body.classList.toggle("compact-mode", e.target.checked);
      localStorage.setItem("osmosis_compact", e.target.checked ? "1" : "0");
    });
  }

  // Reminder Feature
  const reminderToggle = document.getElementById("reminderToggle");
  const reminderTimeInput = document.getElementById("reminderTimeInput");
  if (reminderToggle && reminderTimeInput) {
    reminderToggle.checked =
      localStorage.getItem("osmosis_reminder_enabled") === "1";
    reminderTimeInput.value =
      localStorage.getItem("osmosis_reminder_time") || "20:00";
    reminderTimeInput.disabled = !reminderToggle.checked;

    reminderToggle.addEventListener("change", async (e) => {
      const isEnabled = e.target.checked;
      localStorage.setItem("osmosis_reminder_enabled", isEnabled ? "1" : "0");
      reminderTimeInput.disabled = !isEnabled;
      if (
        isEnabled &&
        "Notification" in window &&
        Notification.permission !== "granted"
      ) {
        await Notification.requestPermission();
      }
      if (
        isEnabled &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        scheduleBackgroundReminder(reminderTimeInput.value);
      }
    });
    reminderTimeInput.addEventListener("change", (e) => {
      localStorage.setItem("osmosis_reminder_time", e.target.value);
      if (
        reminderToggle.checked &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        scheduleBackgroundReminder(e.target.value);
      }
    });

    if (
      reminderToggle.checked &&
      "Notification" in window &&
      Notification.permission === "granted"
    ) {
      scheduleBackgroundReminder(reminderTimeInput.value);
    }

    const testReminderBtn = document.getElementById("testReminderBtn");
    if (testReminderBtn) {
      testReminderBtn.addEventListener("click", () => {
        if ("Notification" in window && Notification.permission === "granted") {
          try {
            if (
              "serviceWorker" in navigator &&
              navigator.serviceWorker.controller
            ) {
              navigator.serviceWorker.ready.then((reg) => {
                reg.showNotification("Osmosis Reading Time", {
                  body: "Take a few minutes to explore your Knowledge Web.",
                  icon: "logo.svg",
                });
              });
            } else {
              new Notification("Osmosis Reading Time", {
                body: "Take a few minutes to explore your Knowledge Web.",
                icon: "logo.svg",
              });
            }
          } catch (e) {
            showToast("Time for your daily reading!");
          }
        } else {
          showToast("Time for your daily reading!");
        }
      });
    }
  }

  // Knowledge graph canvas
  const canvas = document.getElementById("neuralCanvas");
  if (canvas) {
    canvas.addEventListener("mousemove", (e) => {
      const rect = canvas.getBoundingClientRect();
      mousePos.x = e.clientX - rect.left;
      mousePos.y = e.clientY - rect.top;
    });
    canvas.addEventListener("mouseleave", () => {
      mousePos.x = -1000;
      mousePos.y = -1000;
    });
    canvas.addEventListener("click", (e) => {
      if (!window.currentGraphNodes) return;
      const rect = canvas.getBoundingClientRect();
      // Graph coordinates are in CSS pixels, so keep hit-test in CSS pixels.
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      for (const n of window.currentGraphNodes) {
        if (n.isCenter) continue;
        const dx = n.x - cx,
          dy = n.y - cy;
        if (Math.sqrt(dx * dx + dy * dy) <= n.radius + 15) {
          updateActiveNav("navHome");
          selectCategory(n.id);
          break;
        }
      }
    });
  }

  // Voice / audio feature removed — no voice selector in Settings.
  function initVoiceSettings() {
    return;
    const resetBtn = document.getElementById("resetDataBtn");
    if (!resetBtn || document.getElementById("voiceSelectorContainer")) return;

    const container = document.createElement("div");
    container.id = "voiceSelectorContainer";
    container.className = "settings-group";
    container.style.marginBottom = "12px";

    container.innerHTML = `
        <div class="settings-group-label">Reading Voice & Audio</div>
        <div class="setting-row" style="flex-direction: column; align-items: stretch; gap: 12px; padding: 16px;">
            <div style="font-size: 0.85rem; color: var(--subtitle-color); margin-bottom: 4px;">Select a high-quality reading voice:</div>
            <select id="voiceSelect" style="width:100%; padding:12px; border-radius:12px; border:1px solid var(--glass-border); background:var(--glass-solid); color:var(--dark-text); font-size:16px; font-family:'Outfit'; outline:none; cursor:pointer;">
                <option value="">Loading voices...</option>
            </select>
            <div>
              <label for="voiceRateSlider" style="font-size: 0.8rem; color: var(--subtitle-color); display:block; margin-bottom: 6px;">Speech pace (<span id="voiceRateValue">0.92</span>x)</label>
              <input id="voiceRateSlider" type="range" min="0.8" max="1.05" step="0.01" value="0.92" style="width:100%;" />
            </div>
            <div>
              <label for="voicePitchSlider" style="font-size: 0.8rem; color: var(--subtitle-color); display:block; margin-bottom: 6px;">Voice expressiveness (<span id="voicePitchValue">1.00</span>)</label>
              <input id="voicePitchSlider" type="range" min="0.9" max="1.2" step="0.01" value="1.00" style="width:100%;" />
            </div>
            <div style="display:flex; justify-content:center;">
              <button id="testVoiceBtn" class="secondary" style="padding:10px; border-radius:12px; width: 100%; display: flex; justify-content: center; align-items: center; gap: 8px; font-weight:600;">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                  Play Audio Sample
              </button>
            </div>
        </div>
    `;

    // FIX: Insert before the entire Data settings group, not inside the row!
    const dataGroup = resetBtn.closest(".settings-group");
    if (dataGroup) {
      dataGroup.parentNode.insertBefore(container, dataGroup);
    } else {
      resetBtn.parentNode.insertBefore(container, resetBtn);
    }

    const select = document.getElementById("voiceSelect");
    const rateSlider = document.getElementById("voiceRateSlider");
    const pitchSlider = document.getElementById("voicePitchSlider");
    const rateValue = document.getElementById("voiceRateValue");
    const pitchValue = document.getElementById("voicePitchValue");
    const ttsSettings = getTTSSettings();
    if (rateSlider) rateSlider.value = String(ttsSettings.rate.toFixed(2));
    if (pitchSlider) pitchSlider.value = String(ttsSettings.pitch.toFixed(2));
    if (rateValue) rateValue.textContent = ttsSettings.rate.toFixed(2);
    if (pitchValue) pitchValue.textContent = ttsSettings.pitch.toFixed(2);

    async function populateVoices() {
      const voices = speechSynth.getVoices();
      if (!voices.length) return;

      // Smart heuristic to find the 5 smoothest, highest-quality available voices on the user's OS
      const options = [
        {
          label: "Natural Female (US)",
          keywords: [
            "natural",
            "neural",
            "google us english",
            "samantha",
            "zira",
            "premium",
            "female",
            "en-us",
          ],
        },
        {
          label: "Natural Male (US)",
          keywords: [
            "natural",
            "neural",
            "alex",
            "david",
            "guy",
            "premium",
            "male",
            "en-us",
          ],
        },
        {
          label: "Crisp Female (UK)",
          keywords: [
            "natural",
            "neural",
            "google uk english female",
            "serena",
            "hazel",
            "en-gb",
          ],
        },
        {
          label: "Refined Male (UK)",
          keywords: [
            "natural",
            "neural",
            "google uk english male",
            "daniel",
            "george",
            "en-gb",
          ],
        },
        {
          label: "Warm Female (AU)",
          keywords: [
            "natural",
            "neural",
            "karen",
            "catherine",
            "en-au",
            "english",
          ],
        },
      ];

      const selectedVoices = [];
      const usedUris = new Set();

      options.forEach((opt) => {
        let match = null;
        for (const kw of opt.keywords) {
          match = voices.find(
            (v) =>
              v.name.toLowerCase().includes(kw) && !usedUris.has(v.voiceURI),
          );
          if (match) break;
        }
        if (!match)
          match = voices.find(
            (v) => v.lang.startsWith("en") && !usedUris.has(v.voiceURI),
          );
        if (!match) match = voices.find((v) => !usedUris.has(v.voiceURI)); // Ultimate fallback

        if (match) {
          selectedVoices.push({ label: opt.label, voice: match });
          usedUris.add(match.voiceURI);
        }
      });

      let savedVoice = localStorage.getItem("osmosis_voice");
      // If the saved value isn't a real, available voice id (e.g. a legacy
      // voice name), reset it to the most natural-sounding voice available.
      const savedIsValid = selectedVoices.some(
        (item) => item.voice.voiceURI === savedVoice,
      );
      if (!savedIsValid) {
        const best = pickBestVoice();
        savedVoice =
          (best &&
          selectedVoices.some((it) => it.voice.voiceURI === best.voiceURI)
            ? best.voiceURI
            : selectedVoices[0] && selectedVoices[0].voice.voiceURI) || "";
        if (savedVoice) localStorage.setItem("osmosis_voice", savedVoice);
      }

      select.innerHTML = "";
      selectedVoices.slice(0, 6).forEach((item) => {
        const opt = document.createElement("option");
        opt.value = item.voice.voiceURI;
        opt.textContent = `${item.label} — ${item.voice.name.replace(/Microsoft |Google /g, "")}`;
        if (item.voice.voiceURI === savedVoice) opt.selected = true;
        select.appendChild(opt);
      });
    }

    populateVoices();
    if (speechSynth.onvoiceschanged !== undefined) {
      speechSynth.onvoiceschanged = populateVoices;
    }

    select.addEventListener("change", (e) => {
      localStorage.setItem("osmosis_voice", e.target.value);
    });
    if (rateSlider) {
      rateSlider.addEventListener("input", (e) => {
        const value = parseFloat(e.target.value);
        localStorage.setItem("osmosis_tts_rate", value.toFixed(2));
        if (rateValue) rateValue.textContent = value.toFixed(2);
      });
    }
    if (pitchSlider) {
      pitchSlider.addEventListener("input", (e) => {
        const value = parseFloat(e.target.value);
        localStorage.setItem("osmosis_tts_pitch", value.toFixed(2));
        if (pitchValue) pitchValue.textContent = value.toFixed(2);
      });
    }

    document
      .getElementById("testVoiceBtn")
      .addEventListener("click", async (e) => {
        if (isSpeaking) {
          stopTTS();
          return;
        }
        const btn = e.currentTarget;
        const testText =
          "This is your updated reading voice. I now use smoother pacing and more natural phrase grouping for clearer listening.";

        const u = new SpeechSynthesisUtterance(testText);
        const { rate, pitch } = getTTSSettings();
        u.rate = rate;
        u.pitch = pitch;
        applyVoiceToUtterance(u, select.value);
        speechSynth.cancel();
        u.onend = stopTTS;
        isSpeaking = true;
        btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg> Stop Audio`;
        speechSynth.speak(u);
      });
  }

  // ============================================================
  // HIGHLIGHT HOVER NOTE TOOLTIP
  // ============================================================
  let annotationTooltip = document.getElementById("annotationTooltip");
  if (!annotationTooltip) {
    annotationTooltip = document.createElement("div");
    annotationTooltip.id = "annotationTooltip";
    annotationTooltip.style.cssText =
      "position: absolute; opacity: 0; pointer-events: none; background: var(--glass-solid); border: 1px solid var(--glass-border); padding: 10px 14px; border-radius: 8px; z-index: 3000; font-size: 0.9rem; font-family: 'Outfit', sans-serif; color: var(--dark-text); max-width: 280px; box-shadow: 0 8px 24px rgba(0,0,0,0.15); transition: opacity 0.2s ease; word-wrap: break-word;";
    document.body.appendChild(annotationTooltip);
  }

  function showAnnotationTooltip(mark) {
    if (mark && mark.dataset.note) {
      const noteText = mark.dataset.note;
      if (
        noteText === "Highlighted" ||
        noteText === "Bookmarked" ||
        noteText === "Bookmarked"
      )
        return;

      annotationTooltip.textContent = noteText;

      const rect = mark.getBoundingClientRect();
      const tooltipWidth = annotationTooltip.offsetWidth || 200;
      const tooltipHeight = annotationTooltip.offsetHeight || 30;

      let topPos = rect.top + window.scrollY - tooltipHeight - 8;
      if (rect.top < tooltipHeight + 10) {
        topPos = rect.bottom + window.scrollY + 8; // Flip to bottom if hitting top of screen
      }
      let leftPos =
        rect.left + window.scrollX + rect.width / 2 - tooltipWidth / 2;
      if (leftPos < 10) leftPos = 10;
      if (leftPos + tooltipWidth > window.innerWidth - 10) {
        leftPos = window.innerWidth - tooltipWidth - 10;
      }

      annotationTooltip.style.top = `${topPos}px`;
      annotationTooltip.style.left = `${leftPos}px`;
      annotationTooltip.style.opacity = "1";
    }
  }

  // Click to show tooltip (for mobile)
  document.addEventListener("click", (e) => {
    const mark = e.target.closest(
      "mark.highlighted-text, span.inline-bookmark",
    );
    if (mark) {
      showAnnotationTooltip(mark);
      e.stopPropagation();
    }
  });

  document.addEventListener("mouseover", (e) => {
    const mark = e.target.closest(
      "mark.highlighted-text, span.inline-bookmark",
    );
    showAnnotationTooltip(mark);
  });

  document.addEventListener("mouseout", (e) => {
    const mark = e.target.closest(
      "mark.highlighted-text, span.inline-bookmark",
    );
    if (mark) annotationTooltip.style.opacity = "0";
  });

  // Hide tooltip when clicking elsewhere or scrolling
  document.addEventListener("click", (e) => {
    if (!e.target.closest("mark.highlighted-text, span.inline-bookmark")) {
      annotationTooltip.style.opacity = "0";
    }
  });

  document.addEventListener(
    "scroll",
    () => {
      if (annotationTooltip.style.opacity === "1")
        annotationTooltip.style.opacity = "0";
    },
    true,
  );
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================
function triggerSubtleReward(amount = 20) {
  if (navigator.vibrate) {
    try {
      navigator.vibrate([15, 30, 15]); // Subtle haptic pop
    } catch (e) {}
  }
  // We can hook into a lightweight confetti or particle system here later
  // For now, it safely prevents ReferenceErrors when conquering an article!
}

function showToast(message) {
  // Toast notifications disabled
}

function showEpicBadgeUnlock(badgeName) {
  const overlay = document.createElement("div");
  overlay.style.cssText =
    "position:fixed; inset:0; background:rgba(0,0,0,0.85); z-index:9999; display:flex; flex-direction:column; align-items:center; justify-content:center; backdrop-filter:blur(10px); opacity:0; transition:opacity 0.4s ease; pointer-events:none;";

  overlay.innerHTML = `
    <div style="transform: scale(0.5); opacity: 0; transition: all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1); text-align: center;" id="epicBadgeContent">
      <div style="width: 140px; height: 140px; border-radius: 50%; background: var(--accent); margin: 0 auto 24px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 60px color-mix(in srgb, var(--accent) 60%, transparent); border: 4px solid var(--cream);">
        <svg width="70" height="70" viewBox="0 0 24 24" fill="none" stroke="var(--cream)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
      </div>
      <h2 style="color: var(--cream); font-size: 2.8rem; margin-bottom: 12px; text-shadow: 0 4px 12px rgba(0,0,0,0.5); font-family: var(--article-font-family);">Path Conquered!</h2>
      <p style="color: var(--accent); font-size: 1.1rem; font-weight: bold; text-transform: uppercase; letter-spacing: 3px;">Badge Earned: ${badgeName}</p>
    </div>
  `;
  document.body.appendChild(overlay);

  requestAnimationFrame(() => {
    overlay.style.opacity = "1";
    setTimeout(() => {
      const c = document.getElementById("epicBadgeContent");
      if (c) {
        c.style.transform = "scale(1)";
        c.style.opacity = "1";
      }
    }, 50);
  });
  setTimeout(() => {
    overlay.style.opacity = "0";
    setTimeout(() => overlay.remove(), 500);
  }, 4500);
}

window.dismissTip = function (id) {
  localStorage.setItem(`hide_tip_${id}`, "1");
  const el = document.getElementById(`tip_${id}`);
  if (el) {
    el.style.opacity = "0";
    el.style.transform = "scale(0.95)";
    el.style.transition = "all 0.3s ease";
    setTimeout(() => el.remove(), 300);
  }
};

function updateActiveNav(buttonId) {
  document
    .querySelectorAll(".nav-item")
    .forEach((btn) => btn.classList.remove("active"));
  if (buttonId) {
    document.getElementById(buttonId).classList.add("active");
  }
}

function switchView(viewName, skipScroll = false) {
  document.body.classList.remove("drawer-active");
  document
    .querySelectorAll(".top-app-bar, main.container, .bottom-nav")
    .forEach((el) => {
      el.classList.remove("app-inert");
      if ("inert" in el) el.inert = false;
      el.setAttribute("aria-hidden", "false");
    });
  const notesDrawer = document.getElementById("notesSection");
  const notesBackdrop = document.getElementById("notesBackdrop");
  if (notesDrawer) notesDrawer.classList.remove("open");
  if (notesBackdrop) notesBackdrop.classList.remove("active");

  document
    .querySelectorAll(".view")
    .forEach((v) => v.classList.remove("active"));
  document.getElementById(viewName).classList.add("active");
  currentState.view = viewName.replace("View", "");

  // Render journey cards when switching to journey view
  if (viewName === "journeyView") {
    renderJourneyCards();
  }

  localStorage.setItem("osmosis_active_view", viewName);

  const progressContainer = document.getElementById(
    "globalProgressBarContainer",
  );
  if (progressContainer) {
    if (viewName === "articleView") progressContainer.classList.add("show");
    else progressContainer.classList.remove("show");
  }

  if (viewName === "profileView" && typeof renderBackupLedger === "function")
    renderBackupLedger();

  if (!skipScroll) {
    // Instant — an animated scroll on every page open is distracting
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  // Reflect the current story in the browser tab title
  document.title =
    viewName === "articleView" && currentState.article
      ? `${currentState.article} · Osmosis`
      : "Osmosis";
}

function getIconForType(type) {
  if (!type)
    return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>`;
  if (type === "Highlight" || type === "Note")
    return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>`;
  if (type === "Bookmark")
    return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2.5"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>`;
  if (type === "Read")
    return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>`;
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>`;
}

// ============================================================
// JOURNEY / GRAPH DATA
// ============================================================
function loadJourneyData() {
  const saved = localStorage.getItem("osmosis_journey");
  if (saved) {
    try {
      userLearningJourney = JSON.parse(saved);
      if (!userLearningJourney.badges) userLearningJourney.badges = [];
    } catch (e) {
      console.error("Failed to parse journey data, using default:", e);
      localStorage.removeItem("osmosis_journey");
      userLearningJourney = { topics: {}, timeline: [], badges: [] };
    }
  }
  Object.keys(window.topicsData || {}).forEach((domain) => {
    if (!userLearningJourney.topics[domain]) {
      userLearningJourney.topics[domain] = {
        articlesEngaged: 0,
        readArticles: [],
        annotations: 0,
        reflections: 0,
      };
    } else if (!userLearningJourney.topics[domain].readArticles) {
      userLearningJourney.topics[domain].readArticles = [];
    }
  });
}

function saveJourneyData() {
  localStorage.setItem("osmosis_journey", JSON.stringify(userLearningJourney));
  triggerAutoSync();
  updateStreaks();
}

function findCrossReferences(textToFind) {
  if (!textToFind || textToFind.length < 25) return 0;
  const normalizedText = textToFind.trim().toLowerCase();
  let count = 0;
  const currentKey = getStorageKey();

  Object.keys(window.topicsData).forEach((domain) => {
    Object.keys(window.topicsData[domain].subtopics).forEach((subtopic) => {
      Object.keys(
        window.topicsData[domain].subtopics[subtopic].articles,
      ).forEach((articleName) => {
        const key = `article_${domain}_${subtopic}_${articleName}`;
        if (key === currentKey) return;

        const articleContent =
          window.topicsData[domain].subtopics[subtopic].articles[articleName]
            .content;
        if (articleContent.toLowerCase().includes(normalizedText)) count++;
      });
    });
  });
  return count;
}

// Centralized function to add items to timeline (ensures consistency)
function addToTimeline(type, textStr, extraData = null) {
  const domain = currentState.category || "Cross-Domain";
  const entry = {
    date: new Date().toISOString(),
    domain,
    article: currentState.article || "System",
    type,
    text: textStr,
    isFavorite: false, // New: favorite system
  };
  if (extraData) Object.assign(entry, extraData);
  userLearningJourney.timeline.push(entry);
  return entry;
}

function trackEngagement(type, textStr, extraData = null) {
  const domain = currentState.category || "Cross-Domain";
  if (domain !== "Cross-Domain" && !userLearningJourney.topics[domain]) {
    userLearningJourney.topics[domain] = {
      articlesEngaged: 0,
      readArticles: [],
      annotations: 0,
      reflections: 0,
    };
  }

  if (isType(type, "read")) {
    const t = userLearningJourney.topics[domain];
    if (!t.readArticles) t.readArticles = [];
    if (!t.readArticles.includes(currentState.article)) {
      t.readArticles.push(currentState.article);
      t.articlesEngaged += 1;
      addToTimeline("Read", textStr || `Finished reading: ${currentState.article}`, extraData);
    }
  } else if (isAnyType(type, "annotation", "bookmark", "highlight", "note")) {
    userLearningJourney.topics[domain].annotations += 1;
    // Map type names to timeline types
    const typeMap = {
      "annotation": "Highlight",
      "bookmark": "Bookmark",
      "highlight": "Highlight",
      "note": "Note",
    };
    const timelineType = typeMap[type] || "Highlight";
    addToTimeline(timelineType, textStr, extraData);
  } else if (isType(type, "reflection")) {
    if (domain !== "Cross-Domain")
      userLearningJourney.topics[domain].reflections += 1;
    addToTimeline("Reflection", textStr, extraData);
  }
  saveJourneyData();
  checkFeatureUnlocks();
}

function getArticleStats(domain, subtopic, article) {
  const key = `article_${domain}_${subtopic}_${article}`;
  const annotations = JSON.parse(
    localStorage.getItem(key + "_annotations") || "[]",
  );
  const reflections = JSON.parse(
    localStorage.getItem(key + "_reflections") || "[]",
  );

  let highlights = 0;
  let bookmarks = 0;
  let notes = 0;
  annotations.forEach((ann) => {
    if (ann.note === "Bookmarked") {
      bookmarks++;
    } else if (ann.note && ann.note !== "Highlighted") {
      notes++;
    } else {
      highlights++;
    }
  });

  return {
    annotations: annotations.length,
    highlights,
    notes,
    bookmarks,
    reflections: reflections.length,
  };
}
// Article Context Menu (Long Press)
function showArticleContextMenu(card, domain, article) {
  // Remove any existing menu
  const existingMenu = document.getElementById("articleContextMenu");
  if (existingMenu) existingMenu.remove();

  const menu = document.createElement("div");
  menu.id = "articleContextMenu";
  menu.style.cssText = `
    position: fixed;
    background: var(--glass-solid);
    border: 1px solid var(--glass-border);
    border-radius: 12px;
    padding: 8px;
    z-index: 5000;
    min-width: 200px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    backdrop-filter: blur(32px);
  `;

  const isFav = isFavoriteArticle(domain, article);
  const button = document.createElement("button");
  button.style.cssText = `
    width: 100%;
    padding: 10px 12px;
    border: none;
    background: transparent;
    text-align: left;
    cursor: pointer;
    border-radius: 8px;
    color: var(--dark-text);
    font-size: 0.9rem;
    font-weight: 500;
    transition: background 0.2s;
  `;
  button.textContent = isFav ? 'Remove from Favorites' : 'Add to Favorites';

  button.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    toggleFavoriteArticle(domain, article);
    closeArticleContextMenu();
  });

  button.addEventListener('mouseover', () => button.style.background = 'rgba(0,0,0,0.05)');
  button.addEventListener('mouseout', () => button.style.background = 'transparent');
  button.addEventListener('touchstart', (e) => button.style.background = 'rgba(0,0,0,0.05)');
  button.addEventListener('touchend', (e) => button.style.background = 'transparent');

  menu.appendChild(button);
  document.body.appendChild(menu);

  const rect = card.getBoundingClientRect();
  let top = rect.bottom + 10;
  let left = rect.left;

  // Adjust for mobile viewport
  const viewportWidth = window.innerWidth;
  const menuWidth = 200;
  if (left + menuWidth > viewportWidth) {
    left = Math.max(10, viewportWidth - menuWidth - 10);
  }
  if (top + 60 > window.innerHeight) {
    top = rect.top - 70;
  }

  menu.style.top = top + "px";
  menu.style.left = left + "px";

  setTimeout(() => {
    document.addEventListener("click", closeArticleContextMenu, { once: true });
    document.addEventListener("touchstart", closeArticleContextMenu, { once: true });
    document.addEventListener("scroll", closeArticleContextMenu, { once: true });
  }, 0);
}

function closeArticleContextMenu() {
  const menu = document.getElementById("articleContextMenu");
  if (menu) menu.remove();
}

// ============================================================
// CATEGORIES & SUBTOPICS
// ============================================================
// Escape a value for safe use inside an onclick="fn('...')" attribute.
function escJsAttr(s) {
  return String(s == null ? "" : s)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/"/g, "&quot;");
}

function filterByGenre(g) {
  libraryGenreFilter = g;
  libraryAuthorFilter = null;
  updateActiveNav("navHome");
  renderArticleGrid(); // switches to the Library view
  window.scrollTo({ top: 0, behavior: "instant" });
}

function filterByAuthor(a) {
  libraryAuthorFilter = a;
  libraryGenreFilter = null;
  updateActiveNav("navHome");
  renderArticleGrid();
  window.scrollTo({ top: 0, behavior: "instant" });
}

function clearLibraryFilter() {
  libraryGenreFilter = null;
  libraryAuthorFilter = null;
  renderArticleGrid();
}
window.filterByGenre = filterByGenre;
window.filterByAuthor = filterByAuthor;
window.clearLibraryFilter = clearLibraryFilter;

function renderArticleGrid() {
  currentState.mode = "explore";
  const grid = document.getElementById("articlesGrid");

  const continueBtn = document.getElementById("continueReadingBtn");
  if (continueBtn) {
    const recentBookmark = [...userLearningJourney.timeline]
      .reverse()
      .find((t) => t.type === "Bookmark");
    if (recentBookmark) {
      continueBtn.style.display = "inline-flex";
      continueBtn.onclick = () => {
        jumpToArticleByDomainAndName(
          recentBookmark.domain,
          recentBookmark.article,
          recentBookmark.date,
        );
      };
    } else {
      continueBtn.style.display = "none";
    }
  }

  const tipId = "explore";
  if (!localStorage.getItem(`hide_tip_${tipId}`)) {
    grid.innerHTML = `
      <div id="tip_${tipId}" style="grid-column: 1 / -1; position: relative; background: rgba(160, 181, 172, 0.08); border: 1px solid var(--glass-border); padding: 16px 20px; border-radius: 16px; margin-bottom: 8px; display: flex; flex-direction: column; gap: 6px; transition: all 0.3s ease;">
        <button onclick="dismissTip('${tipId}')" style="position: absolute; top: 12px; right: 12px; background: transparent; border: none; color: var(--subtitle-color); cursor: pointer; padding: 4px; box-shadow: none;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
        <div style="font-weight: 700; color: var(--sage); font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1px; display: flex; align-items: center; gap: 6px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
          How Osmosis Works
        </div>
        <div style="font-size: 0.9rem; color: var(--subtitle-color); line-height: 1.5; padding-right: 20px;">
          Osmosis is a living knowledge environment. Here is the core loop:<br><br>
          <strong>1. Explore:</strong> Select a domain below and dive into an article.<br>
          <strong>2. Extract:</strong> Highlight text and write reflections to capture insights.<br>
          <strong>3. Evolve:</strong> Every action automatically constructs a physical 3D <strong>Knowledge Web</strong> of your brain.
        </div>
      </div>
    `;
  } else {
    grid.innerHTML = "";
  }

  const allArticles = [];
  let originalIndex = 0;
  Object.keys(window.topicsData || {}).forEach((domain) => {
    const domainData = window.topicsData[domain];
    Object.keys(domainData.subtopics || {}).forEach((subtopic) => {
      const subtopicData = domainData.subtopics[subtopic];
      Object.keys(subtopicData.articles || {}).forEach((article) => {
        const artData = subtopicData.articles[article];
        const content = artData.content || "";
        const words = content.split(/\s+/).length;
        const readTime = Math.max(1, Math.round(words / 200));

        allArticles.push({
          originalIndex: originalIndex++,
          domain,
          subtopic,
          article,
          description:
            artData.description ||
            subtopicData.description ||
            domainData.description ||
            "",
          readTime,
          author: artData.author || "",
          genres: Array.isArray(artData.genres) ? artData.genres : [],
          image: artData.image || "",
          imagePos: artData.imagePos || "50% 50%",
          imageFit: artData.imageFit || 0,
        });
      });
    });
  });

  const countEl = document.getElementById("libraryStoryCount");
  if (countEl) {
    const readCount = allArticles.filter((it) =>
      (userLearningJourney.topics[it.domain]?.readArticles || []).includes(
        it.article,
      ),
    ).length;
    const noun = allArticles.length === 1 ? " story" : " stories";
    const countText =
      allArticles.length +
      noun +
      (allArticles.length ? ` · ${readCount} read` : "");
    countEl.textContent = countText;
    // Editorial hides the Library h2 (the masthead replaces it), so the
    // same tally also prints on its own collation line there.
    const edCountEl = document.getElementById("edStoryCount");
    if (edCountEl) edCountEl.textContent = countText;
  }

  // "From the Archives" — one unread story resurfaces each day
  // (deterministic: same pick all day, new pick tomorrow).
  const archivesSlot = document.getElementById("archivesSlot");
  if (archivesSlot) {
    const unread = allArticles.filter(
      (it) =>
        !(userLearningJourney.topics[it.domain]?.readArticles || []).includes(
          it.article,
        ),
    );
    if (!unread.length) {
      archivesSlot.style.display = "none";
      archivesSlot.onclick = null;
    } else {
      const day = Math.floor(Date.now() / 86400000);
      const pick = unread[day % unread.length];
      archivesSlot.innerHTML = `
        <div class="archives-label">From the Archives</div>
        <div class="archives-title">${pick.article}</div>
        <div class="archives-meta">${pick.author ? `${pick.author} · ` : ""}${pick.readTime} min read</div>`;
      archivesSlot.style.display = "block";
      archivesSlot.onclick = () => {
        currentState.mode = "explore";
        navigateToArticle(pick.domain, pick.subtopic, pick.article);
      };
    }
  }

  let displayArticles = allArticles;
  if (currentExploreFilter === "read") {
    displayArticles = displayArticles.filter((item) =>
      (userLearningJourney.topics[item.domain]?.readArticles || []).includes(
        item.article,
      ),
    );
  } else if (currentExploreFilter === "unread") {
    displayArticles = displayArticles.filter(
      (item) =>
        !(userLearningJourney.topics[item.domain]?.readArticles || []).includes(
          item.article,
        ),
    );
  }

  // Genre / author filtering (from clicking a pill or author name)
  if (libraryGenreFilter) {
    const gf = libraryGenreFilter.toLowerCase();
    displayArticles = displayArticles.filter((item) =>
      (item.genres || []).some((g) => (g || "").toLowerCase() === gf),
    );
  }
  if (libraryAuthorFilter) {
    const af = libraryAuthorFilter.toLowerCase();
    displayArticles = displayArticles.filter(
      (item) => (item.author || "").toLowerCase() === af,
    );
  }

  // Show a clearable chip when a genre/author filter is active
  const chipEl = document.getElementById("libraryFilterChip");
  if (chipEl) {
    const active = libraryGenreFilter || libraryAuthorFilter;
    if (active) {
      const label = libraryGenreFilter
        ? libraryGenreFilter
        : `by ${libraryAuthorFilter}`;
      chipEl.innerHTML = `<button onclick="clearLibraryFilter()" style="display:inline-flex; align-items:center; gap:8px; background:var(--glass-solid); border:1px solid var(--accent); color:var(--accent); font-size:0.75rem; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; padding:4px 12px; border-radius:999px; cursor:pointer;">${label} <span style="font-size:1rem; line-height:1;">×</span></button>`;
      chipEl.style.display = "block";
    } else {
      chipEl.innerHTML = "";
      chipEl.style.display = "none";
    }
  }

  if (currentExploreSort === "newest") {
    displayArticles.sort((a, b) => b.originalIndex - a.originalIndex);
  } else if (currentExploreSort === "oldest") {
    displayArticles.sort((a, b) => a.originalIndex - b.originalIndex);
  } else if (currentExploreSort === "shortest") {
    displayArticles.sort(
      (a, b) => a.readTime - b.readTime || a.originalIndex - b.originalIndex,
    );
  } else if (currentExploreSort === "longest") {
    displayArticles.sort(
      (a, b) => b.readTime - a.readTime || b.originalIndex - a.originalIndex,
    );
  }

  if (displayArticles.length === 0) {
    if (allArticles.length === 0) {
      grid.innerHTML += `
        <div style="grid-column: 1 / -1; text-align: center; padding: 56px 20px; color: var(--subtitle-color);">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.5" style="margin-bottom: 14px; opacity: 0.85;"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
          <div style="font-size: 1.05rem; font-weight: 600; color: var(--dark-text); margin-bottom: 6px;">Your library is empty</div>
          <div style="font-size: 0.9rem; margin-bottom: 22px;">Create your first story to start reading and highlighting.</div>
          <button onclick="document.getElementById('navGenerator').click()" class="primary btn-sm" style="padding: 10px 18px;">Create your first story</button>
        </div>`;
    } else {
      grid.innerHTML += `<p style="grid-column: 1 / -1; text-align: center; color: var(--subtitle-color); margin-top: 20px;">No stories found for this filter.</p>`;
    }
  }

  displayArticles.forEach((item, index) => {
    const card = document.createElement("div");
    const stats = getArticleStats(item.domain, item.subtopic, item.article);
    let statsHTML = "";
    if (stats.annotations > 0 || stats.reflections > 0) {
      const parts = [];
      if (stats.highlights > 0)
        parts.push(
          `${stats.highlights} highlight${stats.highlights > 1 ? "s" : ""}`,
        );
      if (stats.notes > 0)
        parts.push(`${stats.notes} note${stats.notes > 1 ? "s" : ""}`);
      if (stats.bookmarks > 0)
        parts.push(
          `${stats.bookmarks} bookmark${stats.bookmarks > 1 ? "s" : ""}`,
        );
      if (stats.reflections > 0)
        parts.push(
          `${stats.reflections} reflection${stats.reflections > 1 ? "s" : ""}`,
        );
      statsHTML = `<div class="card-stat-pill">${parts.join(" · ")}</div>`;
    }

    const readList =
      userLearningJourney.topics[item.domain]?.readArticles || [];
    const isRead = readList.includes(item.article);
    const isFav = isFavoriteArticle(item.domain, item.article);
    const readBadgeHTML = isRead
      ? `<div style="font-size: 0.6rem; color: var(--sage); border: 1px solid var(--sage); padding: 1px 6px; border-radius: 10px; font-weight: bold; text-transform: uppercase; display: flex; align-items: center; gap: 3px;"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>Read</div>`
      : "";
    const favBadgeHTML = isFav
      ? `<div style="font-size: 0.6rem; color: var(--accent); border: 1px solid var(--accent); padding: 1px 6px; border-radius: 10px; font-weight: bold; text-transform: uppercase; display: flex; align-items: center; gap: 3px;">Favorited</div>`
      : "";

    // Reading progress (saved per story while reading)
    const progress =
      parseInt(
        localStorage.getItem(
          `progress_article_${item.domain}_${item.subtopic}_${item.article}`,
        ),
      ) || 0;
    const inProgress = !isRead && progress >= 5 && progress < 95;
    const progressBarHTML = inProgress
      ? `<div style="position:absolute; left:0; right:0; bottom:0; height:3px; background:var(--glass-border); overflow:hidden;"><div style="height:100%; width:${progress}%; background:var(--accent);"></div></div>`
      : "";

    // Cards keep the uniform 4:3 crop for grid symmetry; a photo's
    // fit-mode setting only applies on the story page itself.
    const coverHTML = item.image
      ? `<img ${item.image.startsWith("data:") ? `src="${item.image}"` : `data-img-ref="${item.image}"`} alt="" class="story-cover" style="width:100%; aspect-ratio:4/3; object-fit:cover; object-position:${item.imagePos || "50% 50%"}; border-radius:10px; margin-bottom:14px; display:block;" />`
      : "";
    const authorHTML = item.author
      ? `<div style="margin-top:8px;"><span onclick="event.stopPropagation(); filterByAuthor('${escJsAttr(item.author)}')" title="See all by ${item.author}" style="font-size:0.6rem; text-transform:uppercase; letter-spacing:0.5px; color:var(--accent); border:1px solid var(--glass-border); padding:2px 8px; border-radius:999px; cursor:pointer; display:inline-block;">${item.author}</span></div>`
      : "";
    const genresHTML =
      item.genres && item.genres.length
        ? `<div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:10px;">${item.genres
            .map(
              (g) =>
                `<span onclick="event.stopPropagation(); filterByGenre('${escJsAttr(g)}')" title="Filter by ${g}" style="font-size:0.6rem; text-transform:uppercase; letter-spacing:0.5px; color:var(--accent); border:1px solid var(--glass-border); padding:2px 8px; border-radius:999px; cursor:pointer;">${g}</span>`,
            )
            .join("")}</div>`
        : "";

    card.className =
      "category-card glass-panel stagger-item" + (isRead ? " story-read" : "");
    card.style.animationDelay = `${index * 0.04}s`;
    card.style.position = "relative";
    card.style.overflow = "hidden";
    card.innerHTML = `
      ${coverHTML}
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px; gap:12px; flex-wrap:wrap;">
        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
          ${item.domain && item.domain !== "Uncategorized" ? `<div style="font-size:0.75rem;color:var(--accent);font-weight:bold;text-transform:uppercase;">${item.domain}</div>` : ""}
          ${readBadgeHTML}
          ${favBadgeHTML}
        </div>
        <div style="font-size:0.75rem;color:var(--subtitle-color);display:flex;align-items:center;gap:4px;font-weight:600; flex-shrink:0;">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          ${item.readTime} min
        </div>
      </div>
      <h3>${item.article}</h3>
      ${authorHTML}
      <p style="font-size:0.9rem;color:var(--subtitle-color);margin-bottom:0; margin-top:6px;">${item.description}</p>
      ${genresHTML}
      ${statsHTML}
      ${isFav ? `<div style="position:absolute; bottom:10px; right:10px; color:var(--accent); font-size:22px; line-height:1; font-weight:bold; text-shadow: 0 1px 2px rgba(0,0,0,0.1);">♥︎</div>` : ""}
      ${progressBarHTML}`;
    hydrateImages(card);

    // Click to open article
    card.addEventListener("click", () => {
      currentState.mode = "explore";
      navigateToArticle(item.domain, item.subtopic, item.article);
    });

    grid.appendChild(card);
  });

  renderEdDateline();

  // Finis: the issue closes with a mark, not a dead edge
  const finis = document.getElementById("finisBlock");
  if (finis) {
    if (!allArticles.length || !displayArticles.length) {
      finis.style.display = "none";
    } else {
      const unreadCount = allArticles.filter(
        (it) =>
          !(userLearningJourney.topics[it.domain]?.readArticles || []).includes(
            it.article,
          ),
      ).length;
      finis.innerHTML = `
        <div class="finis-fleuron">❦</div>
        <div class="finis-line">${
          unreadCount
            ? `${unreadCount} page${unreadCount === 1 ? " remains" : "s remain"} uncut`
            : "You have read the whole issue"
        }</div>`;
      finis.style.display = "block";
    }
  }

  switchView("exploreView");
}

// The Library's living dateline: today's date set like a newspaper,
// with a time-aware line from the editor's desk beneath it.
function renderEdDateline() {
  const el = document.getElementById("edDateline");
  if (!el) return;
  const now = new Date();
  const n = now.getDate();
  const j = n % 10;
  const k = n % 100;
  const suffix =
    j === 1 && k !== 11
      ? "st"
      : j === 2 && k !== 12
        ? "nd"
        : j === 3 && k !== 13
          ? "rd"
          : "th";
  const weekday = now.toLocaleDateString(undefined, { weekday: "long" });
  const month = now.toLocaleDateString(undefined, { month: "long" });
  const hr = now.getHours();
  const greeting =
    hr >= 5 && hr < 11
      ? "A fine morning for a short story."
      : hr >= 11 && hr < 17
        ? "The afternoon edition is at your leisure."
        : hr >= 17 && hr < 22
          ? "Good evening — the lamps are lit."
          : "The night desk is open.";
  el.innerHTML = `
    <div class="ed-dateline-date">${weekday} · the ${n}${suffix} of ${month}</div>
    <div class="ed-dateline-note">${greeting}</div>`;
}

function goToExploreView() {
  stopTTS();
  // A fresh Library visit shows everything (clear any genre/author filter).
  libraryGenreFilter = null;
  libraryAuthorFilter = null;
  renderArticleGrid();
  updateActiveNav("navHome");
  updateWelcomeLine();
}

function navigateToArticle(d, s, a, options = {}) {
  currentState.category = d;
  currentState.subtopic = s;
  currentState.article = a;
  localStorage.setItem("osmosis_active_article", JSON.stringify({ d, s, a }));
  loadArticleView(options);
}

// ============================================================
// ARTICLE RENDERER
// ============================================================
function loadArticleView(options = {}) {
  const article =
    window.topicsData[currentState.category].subtopics[currentState.subtopic]
      .articles[currentState.article];
  const words = article.content.split(/\s+/).length;
  const mins = Math.max(1, Math.round(words / 200));
  const label = document.getElementById("readTimeLabel");
  if (label) {
    label.dataset.totalMins = mins;
    label.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> <span class="rt-text">${mins} min</span>`;
  }

  // Frontispiece image, author and genres for this story
  const frontEl = document.getElementById("articleFrontispiece");
  if (frontEl) {
    if (article.image) {
      frontEl.style.objectPosition = article.imagePos || "50% 50%";
      if (article.imageFit && article.imageFit < 1) {
        frontEl.style.objectFit = "contain";
        frontEl.style.transform = `scale(${article.imageFit})`;
      } else {
        frontEl.style.objectFit = "cover";
        frontEl.style.transform = "";
      }
      resolveImageRef(article.image).then((src) => {
        if (src) {
          frontEl.src = src;
          frontEl.style.display = "block";
          _frontisReveal(frontEl);
        } else {
          frontEl.removeAttribute("src");
          frontEl.style.display = "none";
          _clearPlateTint();
        }
      });
    } else {
      frontEl.removeAttribute("src");
      frontEl.style.display = "none";
      _clearPlateTint();
    }
  }
  const authorEl = document.getElementById("articleAuthor");
  if (authorEl) {
    if (article.author) {
      const auth = article.author;
      authorEl.innerHTML = `<span onclick="filterByAuthor('${escJsAttr(auth)}')" title="See all by ${auth}" style="font-size:0.65rem; text-transform:uppercase; letter-spacing:0.5px; color:var(--accent); border:1px solid var(--glass-border); padding:3px 10px; border-radius:999px; cursor:pointer; display:inline-block; font-style:normal;">${auth}</span>`;
      authorEl.style.display = "block";
    } else {
      authorEl.style.display = "none";
    }
  }
  const genresEl = document.getElementById("articleGenres");
  if (genresEl) {
    const genres = Array.isArray(article.genres) ? article.genres : [];
    if (genres.length) {
      genresEl.innerHTML = genres
        .map(
          (g) =>
            `<span onclick="filterByGenre('${escJsAttr(g)}')" title="Filter by ${g}" style="font-size:0.65rem; text-transform:uppercase; letter-spacing:0.5px; color:var(--accent); border:1px solid var(--glass-border); padding:3px 10px; border-radius:999px; cursor:pointer;">${g}</span>`,
        )
        .join("");
      genresEl.style.display = "flex";
    } else {
      genresEl.innerHTML = "";
      genresEl.style.display = "none";
    }
  }

  const stats = getArticleStats(
    currentState.category,
    currentState.subtopic,
    currentState.article,
  );
  const indicator = document.getElementById("articleAnnotationIndicator");
  if (indicator) {
    if (stats.annotations > 0) {
      const parts = [];
      if (stats.highlights > 0)
        parts.push(
          `${stats.highlights} highlight${stats.highlights > 1 ? "s" : ""}`,
        );
      if (stats.notes > 0)
        parts.push(`${stats.notes} note${stats.notes > 1 ? "s" : ""}`);
      if (stats.bookmarks > 0)
        parts.push(
          `${stats.bookmarks} bookmark${stats.bookmarks > 1 ? "s" : ""}`,
        );
      indicator.textContent = `You've saved ${parts.join(" and ")}`;
      indicator.style.display = "block";
    } else {
      indicator.style.display = "none";
    }
  }

  renderArticleContent(options);

  // Resume only within this session (story → timeline → back). A fresh
  // open — new story, or a new app session — starts from the beginning.
  _readingActive = true;
  const savedScroll = _sessionScroll[getStorageKey()];
  const resume =
    !options.skipResume && Number.isFinite(savedScroll) && savedScroll > 40;

  switchView("articleView", resume);
  if (resume) {
    setTimeout(
      () => window.scrollTo({ top: savedScroll, behavior: "auto" }),
      60,
    );
  }
}

function renderArticleContent(options = {}) {
  hasTriggeredCompletion = false; // Reset climax explosion
  const article =
    window.topicsData[currentState.category].subtopics[currentState.subtopic]
      .articles[currentState.article];
  document.getElementById("articleTitle").textContent = currentState.article;
  updateStoryBookmarkLink();

  // FIX: Robustly split by paragraph (handling Windows \r\n and extra spaces) to isolate highlights properly
  let paragraphs = article.content
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  // Prevent duplicate titles: remove the Markdown header and divider if they are the very first blocks
  if (paragraphs.length > 0 && paragraphs[0].startsWith("# ")) {
    paragraphs.shift();
    if (paragraphs.length > 0 && paragraphs[0] === "---") {
      paragraphs.shift();
    }
  }

  getAnnotations().forEach((ann) => {
    if (ann.text) {
      const isBookmark =
        ann.note === "Bookmarked" || ann.note === "Bookmarked";
      // Escape regex chars but turn spaces into robust whitespace matchers to handle newlines
      const escaped = ann.text
        .trim()
        .replace(/[-[\]{}()*+?.,\\^$|#]/g, "\\$&")
        .replace(/\s+/g, "(?:\\s+|<[^>]+>)*");
      const regex = new RegExp(`(${escaped})(?![^<]*>)`, "gi");

      // FIX: If we recorded exactly which paragraph they highlighted in, use it
      if (
        ann.pIndex !== undefined &&
        ann.pIndex >= 0 &&
        paragraphs[ann.pIndex]
      ) {
        let matchCount = 0;
        const target = ann.occurrence || 0;
        paragraphs[ann.pIndex] = paragraphs[ann.pIndex].replace(
          regex,
          (match, p1) => {
            if (matchCount === target) {
              matchCount++;
              const encodedNote = (ann.note || "").replace(/"/g, "&quot;");
              const hasNote =
                ann.note &&
                ann.note !== "Highlighted" &&
                ann.note !== "Bookmarked";
              return isBookmark
                ? `<span class="inline-bookmark" data-note="${encodedNote}" style="color: var(--accent); font-weight: 600;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: text-bottom; margin-right: 4px; display: inline-block; transform: translateY(-1px);"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>${p1}</span>`
                : `<mark class="highlighted-text${hasNote ? " has-note" : ""}" data-note="${encodedNote}">${p1}</mark>`;
            }
            matchCount++;
            return match;
          },
        );
      } else {
        // Fallback for old notes that don't have a pIndex
        for (let i = 0; i < paragraphs.length; i++) {
          if (paragraphs[i].match(regex)) {
            let matchCount = 0;
            const target = ann.occurrence || 0;
            paragraphs[i] = paragraphs[i].replace(regex, (match, p1) => {
              if (matchCount === target) {
                matchCount++;
                const encodedNote = (ann.note || "").replace(/"/g, "&quot;");
                const hasNote =
                  ann.note &&
                  ann.note !== "Highlighted" &&
                  ann.note !== "Bookmarked";
                return isBookmark
                  ? `<span class="inline-bookmark" data-note="${encodedNote}" style="color: var(--accent); font-weight: 600;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: text-bottom; margin-right: 4px; display: inline-block; transform: translateY(-1px);"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>${p1}</span>`
                  : `<mark class="highlighted-text${hasNote ? " has-note" : ""}" data-note="${encodedNote}">${p1}</mark>`;
              }
              matchCount++;
              return match;
            });
            break; // Stop after first highlight so it doesn't do every occurrence in the article
          }
        }
      }
    }
  });

  const articleContent = document.getElementById("articleContent");

  // Prepare HTML content
  const html = paragraphs
    .map((p) => {
      let html = p.replace(/\r?\n/g, "<br>");

      // Basic Markdown Support for rich text (bold, italics, headers)
      html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
      html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");

      if (html.startsWith("# "))
        return `<h2 style="margin-top: 2.5rem; margin-bottom: 1rem; line-height: 1.2;">${html.substring(2)}</h2>`;
      if (html.startsWith("## "))
        return `<h3 style="margin-top: 2rem; margin-bottom: 0.75rem; color: var(--accent); line-height: 1.2;">${html.substring(3)}</h3>`;
      if (html.startsWith("### "))
        return `<h4 style="margin-top: 1.5rem; margin-bottom: 0.5rem; color: var(--sage); line-height: 1.2;">${html.substring(4)}</h4>`;
      if (html === "---")
        return `<hr style="border: none; border-top: 1px solid var(--earth); margin: 2.5rem 0;">`;
      if (html.startsWith("> "))
        return `<blockquote style="margin: 1.5rem 0; padding: 15px 20px; font-style: italic; color: var(--dark-text); background: rgba(196, 98, 45, 0.05); border-radius: 8px;">${html.substring(2)}</blockquote>`;

      return `<p>${html}</p>`;
    })
    .join("");

  // Smooth fade-in when loading new article
  articleContent.style.opacity = "0";
  articleContent.style.transition = "opacity 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)";
  articleContent.innerHTML = html;

  requestAnimationFrame(() => {
    articleContent.style.opacity = "1";
  });

  loadAnnotations();
  loadReflections();

  // Apply the Doomscroll "Feed" Reveal Effect, or skip if jumping to a note
  const blocks = articleContent.children;
  const isJumpingToNote = options.isJumpingToNote || false;

  Array.from(blocks).forEach((block, idx) => {
    if (isJumpingToNote) {
      block.classList.add("scroll-reveal", "visible");
      block.style.transitionDelay = "0s";
    } else {
      block.classList.add("scroll-reveal");
      // Instantly reveal the first 2 blocks so the screen isn't empty
      if (idx < 2) {
        block.style.transitionDelay = `${idx * 0.15}s`;
        setTimeout(() => block.classList.add("visible"), 50);
      }
    }
  });
  if (!isJumpingToNote) {
    setupDoomscrollObserver();
  }

  const completionSection = document.querySelector(
    ".article-completion-section",
  );
  if (completionSection) {
    let titleHtml = "Reading Completed";
    let descHtml =
      "Mark this story as read to track your progress and add it to your timeline.";
    let btnText = "Mark as Read";

    // Reading colophon: a quiet printed record of your engagement
    const stats = getArticleStats(
      currentState.category,
      currentState.subtopic,
      currentState.article,
    );
    const coloParts = [];
    const totalMins =
      parseInt(document.getElementById("readTimeLabel")?.dataset.totalMins) ||
      0;
    if (totalMins) coloParts.push(`${totalMins} min read`);
    if (stats.highlights)
      coloParts.push(
        `${stats.highlights} highlight${stats.highlights === 1 ? "" : "s"}`,
      );
    if (stats.notes)
      coloParts.push(`${stats.notes} note${stats.notes === 1 ? "" : "s"}`);
    if (stats.bookmarks)
      coloParts.push(
        `${stats.bookmarks} bookmark${stats.bookmarks === 1 ? "" : "s"}`,
      );
    if (stats.reflections)
      coloParts.push(
        `${stats.reflections} reflection${stats.reflections === 1 ? "" : "s"}`,
      );

    completionSection.innerHTML = `
      <h3>${titleHtml}</h3>
      <p>${descHtml}</p>
          <div style="display: flex; gap: 12px; justify-content: center; margin-top: 8px;">
            <button id="markReadBtn" class="primary">${btnText}</button>
            <button id="reflectFinishedBtn" class="secondary">Reflect</button>
          </div>
      ${coloParts.length ? `<div class="story-colophon">${coloParts.join(" · ")}</div>` : ""}
      <div id="continuationPlate" class="continuation-plate"></div>
    `;

    const readList =
      userLearningJourney.topics[currentState.category]?.readArticles || [];
    let isRead = readList.includes(currentState.article);
    const markReadBtn = document.getElementById("markReadBtn");

    const reflectFinishedBtn = document.getElementById("reflectFinishedBtn");
    if (reflectFinishedBtn) {
      reflectFinishedBtn.onclick = () => openNotesDrawer(0);
    }

    const updateBtnUI = () => {
      if (isRead) {
        markReadBtn.innerHTML = "Mark as Unread";
        markReadBtn.className = "secondary";
        markReadBtn.style.opacity = "0.8";
      } else {
        markReadBtn.innerHTML = btnText;
        markReadBtn.className = "primary";
        markReadBtn.style.opacity = "1";
      }
    };

    updateBtnUI();
    renderContinuation();

    markReadBtn.onclick = () => {
      const t = userLearningJourney.topics[currentState.category];
      if (isRead) {
        if (t && t.readArticles) {
          const idx = t.readArticles.indexOf(currentState.article);
          if (idx > -1) {
            t.readArticles.splice(idx, 1);
            t.articlesEngaged = Math.max(0, t.articlesEngaged - 1);
          }
        }
        userLearningJourney.timeline = userLearningJourney.timeline.filter(
          (item) =>
            !(
              item.type === "Read" &&
              item.domain === currentState.category &&
              item.article === currentState.article
            ),
        );
        saveJourneyData();
        isRead = false;
        showToast("Story marked as unread.");
        updateBtnUI();
      } else {
        trackEngagement("read", `Completed reading: ${currentState.article}`);
        isRead = true;
        _sittingReads++;
        // Add to the visual thread (once per story per sitting)
        const already = _sittingStories.some(
          (x) => x.domain === currentState.category && x.art === currentState.article,
        );
        if (!already) {
          _sittingStories.push({
            domain: currentState.category,
            sub: currentState.subtopic,
            art: currentState.article,
            obj:
              window.topicsData?.[currentState.category]?.subtopics?.[
                currentState.subtopic
              ]?.articles?.[currentState.article] || {},
          });
          const rec = parseInt(localStorage.getItem("osmosis_longest_thread")) || 0;
          if (_sittingStories.length > rec) {
            try {
              localStorage.setItem(
                "osmosis_longest_thread",
                String(_sittingStories.length),
              );
            } catch (e) {}
            if (_sittingStories.length >= 2) _threadRecordBeaten = true;
          }
        }
        showToast("Story marked as read!");
        spawnCompletionExplosion();
        updateBtnUI();
        renderContinuation();
      }
    };
  }
}

// ---- The Continuation Loop: never let a good sitting end ----
function _enumerateStories() {
  const out = [];
  const T = window.topicsData || {};
  Object.keys(T).forEach((d) => {
    const subs = T[d].subtopics || {};
    Object.keys(subs).forEach((sub) => {
      const arts = subs[sub].articles || {};
      Object.keys(arts).forEach((a) => out.push({ domain: d, sub, art: a, obj: arts[a] }));
    });
  });
  return out;
}
function _storyMinutes(obj) {
  const w = (obj && obj.content ? obj.content : "").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(w / 200));
}
// Pick the next story to pull the reader onward: same author first, then a
// shared genre, then simply the next unread in the issue.
function pickNextStory() {
  const readOf = (d) => userLearningJourney.topics[d]?.readArticles || [];
  const all = _enumerateStories().filter(
    (x) =>
      !(x.domain === currentState.category && x.art === currentState.article) &&
      !readOf(x.domain).includes(x.art),
  );
  if (!all.length) return null;
  const cur =
    window.topicsData?.[currentState.category]?.subtopics?.[currentState.subtopic]
      ?.articles?.[currentState.article] || {};
  const curAuthor = (cur.author || "").trim().toLowerCase();
  const curGenres = (cur.genres || []).map((g) => g.trim().toLowerCase());

  if (curAuthor) {
    const byAuthor = all.find(
      (x) => (x.obj.author || "").trim().toLowerCase() === curAuthor,
    );
    if (byAuthor)
      return Object.assign(byAuthor, {
        reason: `More from ${byAuthor.obj.author}`,
      });
  }
  if (curGenres.length) {
    const byGenre = all.find((x) =>
      (x.obj.genres || []).some((g) => curGenres.includes(g.trim().toLowerCase())),
    );
    if (byGenre) {
      const shared = (byGenre.obj.genres || []).find((g) =>
        curGenres.includes(g.trim().toLowerCase()),
      );
      return Object.assign(byGenre, { reason: `More ${shared}` });
    }
  }
  return Object.assign(all[0], { reason: "Next in this issue" });
}

// A palate cleanser: an unread story that shares neither author nor genre
function pickDifferentStory(excludeArt) {
  const readOf = (d) => userLearningJourney.topics[d]?.readArticles || [];
  const cur =
    window.topicsData?.[currentState.category]?.subtopics?.[currentState.subtopic]
      ?.articles?.[currentState.article] || {};
  const curAuthor = (cur.author || "").trim().toLowerCase();
  const curGenres = (cur.genres || []).map((g) => g.trim().toLowerCase());
  const all = _enumerateStories().filter(
    (x) =>
      !(x.domain === currentState.category && x.art === currentState.article) &&
      x.art !== excludeArt &&
      !readOf(x.domain).includes(x.art),
  );
  const diff = all.find((x) => {
    const a = (x.obj.author || "").trim().toLowerCase();
    const g = (x.obj.genres || []).map((z) => z.trim().toLowerCase());
    const sharesAuthor = curAuthor && a === curAuthor;
    const sharesGenre = g.some((z) => curGenres.includes(z));
    return !sharesAuthor && !sharesGenre;
  });
  return diff || null;
}

function _threadChip(st, isLast) {
  const img = st.obj && st.obj.image;
  const inner = img
    ? `<img ${img.startsWith("data:") ? `src="${img}"` : `data-img-ref="${img}"`} alt="" style="object-position:${st.obj.imagePos || "50% 50%"}" />`
    : `<span>${(st.art || "?").trim().charAt(0).toUpperCase()}</span>`;
  return `<div class="cont-chip${isLast ? " new" : ""}" title="${st.art}">${inner}</div>`;
}

function renderContinuation() {
  const el = document.getElementById("continuationPlate");
  if (!el) return;
  const next = pickNextStory();

  // The visual thread: a growing row of the covers you've read this sitting
  const record = parseInt(localStorage.getItem("osmosis_longest_thread")) || 0;
  let thread = "";
  if (_sittingStories.length >= 1) {
    const chips = _sittingStories
      .map((st, i) => _threadChip(st, i === _sittingStories.length - 1))
      .join("");
    const label = _threadRecordBeaten
      ? `<span class="cont-record">✦ your longest thread yet — ${_sittingStories.length}</span>`
      : `${_sittingStories.length} this sitting${record > _sittingStories.length ? ` · best ${record}` : ""}`;
    thread = `
      <div class="cont-thread-wrap">
        <div class="cont-thread-title">The Reading Thread</div>
        <div class="cont-strip">${chips}</div>
        <div class="cont-thread-label">${label}</div>
      </div>`;
  }

  if (!next) {
    el.innerHTML = `
      ${thread}
      <div class="cont-finis">
        <div class="cont-fleuron">❦</div>
        <div class="cont-finis-line">You have read the whole issue</div>
        <div class="cont-finis-sub">Write in the Studio, or revisit a favourite from your shelf.</div>
      </div>`;
    if (typeof hydrateImages === "function") hydrateImages(el);
    return;
  }

  const mins = _storyMinutes(next.obj);
  const img = next.obj.image;
  const cover = img
    ? `<div class="cont-cover"><img ${img.startsWith("data:") ? `src="${img}"` : `data-img-ref="${img}"`} alt="" style="object-position:${next.obj.imagePos || "50% 50%"}" /></div>`
    : "";

  const diff = pickDifferentStory(next.art);
  const altHtml = diff
    ? `<button class="cont-alt" id="continueAltBtn">Or a change of air — <em>${diff.art}</em> →</button>`
    : "";

  el.innerHTML = `
    ${thread}
    <div class="cont-rule"><span>Continue Reading</span></div>
    <button class="cont-card" id="continueNextBtn">
      ${cover}
      <div class="cont-body">
        <div class="cont-reason">${next.reason}</div>
        <div class="cont-title">${next.art}</div>
        <div class="cont-meta">${next.obj.author ? next.obj.author + " · " : ""}${mins} min read</div>
      </div>
      <span class="cont-arrow">→</span>
    </button>
    ${altHtml}`;

  if (typeof hydrateImages === "function") hydrateImages(el);
  const btn = document.getElementById("continueNextBtn");
  if (btn)
    btn.onclick = () => {
      currentState.mode = "explore";
      navigateToArticle(next.domain, next.sub, next.art);
    };
  const altBtn = document.getElementById("continueAltBtn");
  if (altBtn && diff)
    altBtn.onclick = () => {
      currentState.mode = "explore";
      navigateToArticle(diff.domain, diff.sub, diff.art);
    };
}
window.renderContinuation = renderContinuation;

// ---- Tap a word for its meaning: an editorial dictionary gloss ----
const _defCache = {};
function showDefinition(word) {
  let ov = document.getElementById("defineOverlay");
  if (!ov) {
    ov = document.createElement("div");
    ov.id = "defineOverlay";
    ov.className = "def-overlay";
    ov.innerHTML = '<div class="def-card"></div>';
    document.body.appendChild(ov);
    ov.addEventListener("click", (e) => {
      if (e.target === ov) closeDefinition();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeDefinition();
    });
    // Pull-down to dismiss (matches the writing drawer). Only engages when
    // the card is scrolled to the top, so it never fights normal scrolling.
    const dcard = ov.querySelector(".def-card");
    let defStartY = -1;
    let defCurY = 0;
    dcard.addEventListener(
      "touchstart",
      (e) => {
        defStartY = dcard.scrollTop <= 5 ? e.touches[0].clientY : -1;
        defCurY = e.touches[0].clientY;
      },
      { passive: true },
    );
    dcard.addEventListener(
      "touchmove",
      (e) => {
        if (defStartY === -1) return;
        defCurY = e.touches[0].clientY;
        const dy = defCurY - defStartY;
        if (dy > 0) {
          if (e.cancelable) e.preventDefault();
          dcard.style.transform = `translateY(${dy * 0.85}px)`;
          dcard.style.transition = "none";
          ov.style.background = `rgba(0,0,0,${Math.max(0, 0.42 - dy / 500)})`;
        }
      },
      { passive: false },
    );
    const defEnd = () => {
      if (defStartY === -1) return;
      const dy = defCurY - defStartY;
      defStartY = -1;
      if (dy > dcard.offsetHeight * 0.5) {
        // Slide the rest of the way out, then close — smoothly.
        dcard.style.transition = "transform 0.26s cubic-bezier(0.4, 0, 0.2, 1)";
        dcard.style.transform = "translateY(100%)";
        ov.style.transition = "background 0.26s ease";
        ov.style.background = "rgba(0,0,0,0)";
        setTimeout(() => {
          closeDefinition();
          dcard.style.transition = "";
          dcard.style.transform = "";
          ov.style.transition = "";
          ov.style.background = "";
        }, 250);
      } else {
        // Spring back to rest.
        dcard.style.transition = "transform 0.34s cubic-bezier(0.2, 0.9, 0.3, 1)";
        dcard.style.transform = "";
        ov.style.transition = "background 0.34s ease";
        ov.style.background = "";
        setTimeout(() => {
          dcard.style.transition = "";
          ov.style.transition = "";
        }, 340);
      }
    };
    dcard.addEventListener("touchend", defEnd);
    dcard.addEventListener("touchcancel", defEnd);
  }
  const card = ov.querySelector(".def-card");
  card.innerHTML = `<div class="def-word">${word}</div><div class="def-loading">Consulting the dictionary…</div>`;
  ov.style.display = "flex";
  if (_defCache[word]) {
    renderDefinition(word, _defCache[word]);
    return;
  }
  fetch(
    `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
  )
    .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
    .then((data) => {
      _defCache[word] = data;
      renderDefinition(word, data);
    })
    .catch((err) => renderDefError(word, err));
}
function closeDefinition() {
  const ov = document.getElementById("defineOverlay");
  if (ov) ov.style.display = "none";
}
function renderDefinition(word, data) {
  const ov = document.getElementById("defineOverlay");
  if (!ov) return;
  const card = ov.querySelector(".def-card");
  const entry = Array.isArray(data) ? data[0] : null;
  if (!entry || !entry.meanings) return renderDefError(word, 404);
  const phon =
    entry.phonetic ||
    (entry.phonetics || []).map((p) => p.text).find(Boolean) ||
    "";
  const meanings = (entry.meanings || [])
    .slice(0, 3)
    .map((m) => {
      const defs = (m.definitions || [])
        .slice(0, 2)
        .map((d) => {
          const ex = d.example
            ? `<div class="def-ex">“${d.example}”</div>`
            : "";
          return `<div class="def-line">${d.definition}${ex}</div>`;
        })
        .join("");
      return `<div class="def-meaning"><div class="def-pos">${m.partOfSpeech}</div>${defs}</div>`;
    })
    .join("");
  card.innerHTML = `
    <div class="def-word">${entry.word || word}</div>
    ${phon ? `<div class="def-phon">${phon}</div>` : ""}
    <div class="def-rule"></div>
    ${meanings || '<div class="def-loading">No definition found.</div>'}
    <div class="def-foot">— from the dictionary —</div>`;
}
function renderDefError(word, err) {
  const ov = document.getElementById("defineOverlay");
  if (!ov) return;
  const card = ov.querySelector(".def-card");
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  card.innerHTML = `
    <div class="def-word">${word}</div>
    <div class="def-rule"></div>
    <div class="def-loading">${
      offline
        ? "The dictionary is unreachable — you appear to be offline."
        : `No entry found for “${word}.”`
    }</div>`;
}
window.showDefinition = showDefinition;
window.closeDefinition = closeDefinition;

function setupDoomscrollObserver() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target); // Only animate once
        }
      });
    },
    { rootMargin: "0px 0px -10% 0px", threshold: 0.05 },
  );

  document
    .querySelectorAll(".scroll-reveal")
    .forEach((el) => observer.observe(el));
}

function spawnCompletionExplosion() {
  triggerSubtleReward();
  showToast("Article Conquered! Knowledge Synthesized.");
}

let _lastReadScrollY = 0;
const _sessionScroll = {}; // per-story scroll, forgotten when the app closes
let _readingActive = false; // true while a story is "open" (not backed out of)
let _sittingReads = 0; // stories finished this sitting — the reading thread
let _sittingStories = []; // {domain, sub, art, obj} read this sitting, for the visual thread
let _threadRecordBeaten = false;
document.addEventListener("scroll", () => {
  const articleEl = document.getElementById("articleContent");
  if (!articleEl || currentState.view !== "article") return;
  const rect = articleEl.getBoundingClientRect();

  // Remember the position only for THIS session — a fresh open of a
  // story always starts from the beginning.
  _sessionScroll[getStorageKey()] = window.scrollY;

  // Adjusted math to hit 100% when the user finishes reading, not when the article scrolls entirely off screen
  const total = rect.height - window.innerHeight + 250;
  const scrolled = Math.max(0, -rect.top + 80);
  const pct =
    total > 0 ? Math.min(100, Math.max(0, (scrolled / total) * 100)) : 0;
  document.getElementById("articleProgressBar").style.width = pct + "%";

  // Floating jump button: appears only while scrolling up (reading down
  // keeps the page clean), and flips upward once well into the story.
  const jumpBtn = document.getElementById("scrollJumpBtn");
  if (jumpBtn) {
    jumpBtn.classList.toggle("up", pct > 60);
    const y = window.scrollY;
    const scrollingUp = y < _lastReadScrollY - 2;
    const scrollingDown = y > _lastReadScrollY + 2;
    if (scrollingUp && y > 200) jumpBtn.classList.add("visible");
    else if (scrollingDown || y <= 200) jumpBtn.classList.remove("visible");
    _lastReadScrollY = y;
  }

  // Save reading progress so story cards can show how far you've read
  localStorage.setItem(`progress_${getStorageKey()}`, Math.round(pct));

  // Count the read-time label down to show time remaining
  const rtLabel = document.getElementById("readTimeLabel");
  if (rtLabel && rtLabel.dataset.totalMins) {
    const totalMins = parseInt(rtLabel.dataset.totalMins) || 0;
    const left = Math.max(0, Math.ceil(totalMins * (1 - pct / 100)));
    const rtText = rtLabel.querySelector(".rt-text");
    if (rtText)
      rtText.textContent =
        pct >= 99 ? "Finished" : `${left} min left`;
  }

  // Kinetic Velocity Feedback
  let velocity = Math.abs(window.scrollY - lastScrollTop);
  lastScrollTop = window.scrollY;
  if (velocity > 15 && currentState.view === "article") {
    document.body.classList.add("scrolling-fast");
    clearTimeout(scrollVelocityTimeout);
    scrollVelocityTimeout = setTimeout(
      () => document.body.classList.remove("scrolling-fast"),
      150,
    );
  }
});

// ============================================================
// TTS
// ============================================================
function toggleTTS() {
  isSpeaking ? stopTTS() : startTTS();
}

function startTTS() {
  const article =
    window.topicsData[currentState.category].subtopics[currentState.subtopic]
      .articles[currentState.article];
  const rawContent = article.content.replace(/<[^>]*>?/gm, "");

  // Group multiple sentences per chunk to avoid robotic sentence-by-sentence resets.
  ttsQueue = buildNaturalTTSQueue(rawContent);

  if (speechSynth) speechSynth.cancel(); // Clear any stuck utterances
  isSpeaking = true;
  setListenButtonPlaying();
  playNextTTSChunk();
}

function playNextTTSChunk() {
  if (!ttsQueue.length || !isSpeaking) {
    stopTTS();
    return;
  }
  const chunk = ttsQueue.shift();

  if (chunk === TTS_PARAGRAPH_BREAK) {
    setTimeout(() => {
      if (isSpeaking) playNextTTSChunk();
    }, 520);
    return;
  }

  if (chunk === TTS_SENTENCE_BREAK) {
    setTimeout(() => {
      if (isSpeaking) playNextTTSChunk();
    }, 130);
    return;
  }

  // Fallback to local SpeechSynthesis
  const utterance = new SpeechSynthesisUtterance(chunk);
  const { rate, pitch } = getTTSSettings();
  utterance.rate = rate;
  utterance.pitch = pitch;
  applyVoiceToUtterance(utterance);

  utterance.onend = () => {
    setTimeout(() => {
      if (isSpeaking) playNextTTSChunk();
    }, 70);
  };
  utterance.onerror = (e) => {
    console.error("TTS Error:", e);
    // Don't get stuck, try to continue.
    setTimeout(() => {
      if (isSpeaking) playNextTTSChunk();
    }, 75);
  };

  speechSynth.speak(utterance);
}

function stopTTS() {
  ttsQueue = [];
  if (speechSynth) speechSynth.cancel();
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
  isSpeaking = false;
  const btn = document.getElementById("listenBtn");
  if (btn) {
    btn.style.background = "transparent";
    btn.style.color = "var(--sage)";
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon></svg> Listen`;
  }
  resetTestVoiceButton();
}

function readAloud(text) {
  stopTTS(); // Stop any other TTS

  if (speechSynth) {
    const utterance = new SpeechSynthesisUtterance(text);
    const { rate, pitch } = getTTSSettings();
    utterance.rate = rate;
    utterance.pitch = pitch;
    applyVoiceToUtterance(utterance);
    speechSynth.speak(utterance);
  }
}

// ============================================================
// ANNOTATIONS & REFLECTIONS
// ============================================================
function spawnInsightParticles() {}

function updateArticleResonance() {
  // Note: Old logic removed to prevent UI duplication. Resonance is now handled via the Synthesis Ritual Carousel.
}

function renderReflectionPreamble() {
  const container = document.getElementById("reflectionPreamble");
  if (!container) return;

  const lastReflection = [...userLearningJourney.timeline]
    .reverse()
    .find((i) => i.type === "Reflection");

  if (lastReflection) {
    const concept = lastReflection.article || "a previous topic";
    container.innerHTML = `
            <div class="preamble-title">Picking up where you left off...</div>
            <div class="preamble-quote">"${lastReflection.text}"</div>
            <div class="preamble-prompt">Last time, you wrote this about <strong>${concept}</strong>. Does this still hold true in light of what you've just read?</div>
        `;
    container.style.display = "block";
  } else {
    container.style.display = "none";
  }
}

function saveNewAnnotation(noteText) {
  if (editingAnnotationId) {
    const annotations = getAnnotations();
    const index = annotations.findIndex((a) => a.id === editingAnnotationId);
    if (index > -1) {
      annotations[index].note = noteText || "Highlighted";
      saveAnnotations(annotations);

      // Keep the timeline in sync: a highlight that gains note text becomes a
      // Note (and a note that loses its text reverts to a Highlight).
      const ann = annotations[index];
      if (ann.note !== "Bookmarked") {
        const isNote = ann.note && ann.note !== "Highlighted";
        const newType = isNote ? "Note" : "Highlight";
        const newText = isNote
          ? `${ann.note}\n\n"${ann.text}"`
          : `"${ann.text}"`;
        const entry = userLearningJourney.timeline.find(
          (t) =>
            (t.type === "Highlight" || t.type === "Note") &&
            t.domain === currentState.category &&
            t.article === currentState.article &&
            t.text &&
            t.text.includes(ann.text),
        );
        if (entry) {
          entry.type = newType;
          entry.text = newText;
          saveJourneyData();
        }
      }

      showToast("Note updated!");
    }
    editingAnnotationId = null;
    const btn = document.getElementById("addAnnotationBtn");
    if (btn) btn.textContent = "Save Note";
    document.getElementById("annotationInput").value = "";
    loadAnnotations();
    return;
  }

  const selectedText = activeSelection || lastSelectionSnapshot.text;
  if (!selectedText) {
    showToast("Please highlight text first.");
    return;
  }

  const annotations = getAnnotations();
  const selection = window.getSelection();

  // TOGGLE OFF: Check if the user's selection overlaps with an existing highlight
  let targetMark = null;
  if (selection.rangeCount > 0) {
    let node = selection.anchorNode;
    if (node && node.nodeType === 3) node = node.parentNode;
    if (node && node.closest)
      targetMark = node.closest("mark.highlighted-text, span.inline-bookmark");
  }

  if (targetMark) {
    const markText = targetMark.textContent.trim().toLowerCase();
    const existingIndex = annotations.findIndex(
      (a) => a.text.trim().toLowerCase() === markText,
    );
    if (existingIndex !== -1) {
      const isBookmark =
        annotations[existingIndex].note === "Bookmarked" ||
        annotations[existingIndex].note === "Bookmarked";

      const annToDelete = annotations[existingIndex];
      userLearningJourney.timeline = userLearningJourney.timeline.filter(
        (t) => {
          const isMatch =
            (t.type === "Highlight" || t.type === "Bookmark") &&
            t.domain === currentState.category &&
            t.article === currentState.article &&
            t.text &&
            t.text.includes(annToDelete.text);
          return !isMatch;
        },
      );
      saveJourneyData();

      annotations.splice(existingIndex, 1);
      saveAnnotations(annotations);
      activeSelection = "";
      lastSelectionSnapshot = { text: "", pIndex: -1, occurrence: 0 };
      window.getSelection().removeAllRanges();
      renderArticleContent();
      loadAnnotations();
      showToast(isBookmark ? "Bookmark removed." : "Highlight removed.");
      return;
    }
  }

  // TOGGLE OFF: Check if the exact selected text is already an annotation
  const exactIndex = annotations.findIndex(
    (a) => a.text.trim().toLowerCase() === selectedText.trim().toLowerCase(),
  );
  if (exactIndex !== -1) {
    const isBookmark =
      annotations[exactIndex].note === "Bookmarked" ||
      annotations[exactIndex].note === "Bookmarked";

    const annToDelete = annotations[exactIndex];
    userLearningJourney.timeline = userLearningJourney.timeline.filter((t) => {
      const isMatch =
        (t.type === "Highlight" || t.type === "Bookmark") &&
        t.domain === currentState.category &&
        t.article === currentState.article &&
        t.text &&
        t.text.includes(annToDelete.text);
      return !isMatch;
    });
    saveJourneyData();

    annotations.splice(exactIndex, 1);
    saveAnnotations(annotations);
    activeSelection = "";
    lastSelectionSnapshot = { text: "", pIndex: -1, occurrence: 0 };
    window.getSelection().removeAllRanges();
    renderArticleContent();
    loadAnnotations();
    showToast(isBookmark ? "Bookmark removed." : "Highlight removed.");
    return;
  }

  // FIX: Locate which paragraph the highlight occurred in
  let pIndex = -1;
  let occurrence = 0;
  if (selection.rangeCount > 0) {
    let node = selection.anchorNode;
    if (node && node.nodeType === 3) node = node.parentNode;
    if (node && node.closest) {
      const block = node.closest("#articleContent > *");
      if (block) {
        const allBlocks = Array.from(
          document.getElementById("articleContent").children,
        );
        pIndex = allBlocks.indexOf(block);

        try {
          const range = selection.getRangeAt(0);
          const preRange = document.createRange();
          preRange.setStart(block, 0);
          preRange.setEnd(range.startContainer, range.startOffset);
          const preText = preRange.toString();
          const escaped = selectedText
            .trim()
            .replace(/[-[\]{}()*+?.,\\^$|#]/g, "\\$&")
            .replace(/\s+/g, "(?:\\s+|<[^>]+>)*");
          const regex = new RegExp(`(${escaped})(?![^<]*>)`, "gi");
          const matches = preText.match(regex);
          occurrence = matches ? matches.length : 0;
        } catch (e) {}
      }
    }
  }
  if (pIndex < 0 && lastSelectionSnapshot.pIndex >= 0) {
    pIndex = lastSelectionSnapshot.pIndex;
    occurrence = lastSelectionSnapshot.occurrence || 0;
  }

  annotations.push({
    id: Date.now(),
    text: selectedText,
    note: noteText || "Highlighted",
    created: new Date().toISOString(),
    article: currentState.article,
    pIndex: pIndex, // Save the paragraph index
    occurrence: occurrence,
    srs: {
      interval: 0,
      ease: 2.5,
      nextReview: Date.now(),
      key: getStorageKey() + "_annotations",
    },
  });
  saveAnnotations(annotations);

  if (noteText === "Bookmarked" || noteText === "Bookmarked") {
    trackEngagement("bookmark", selectedText);
  } else {
    const isCustomNote = noteText && noteText !== "Highlighted";
    const timelineText = isCustomNote
      ? `${noteText}\n\n"${selectedText}"`
      : `"${selectedText}"`;
    trackEngagement(isCustomNote ? "note" : "highlight", timelineText);
  }

  document.getElementById("annotationInput").value = "";
  activeSelection = "";
  lastSelectionSnapshot = { text: "", pIndex: -1, occurrence: 0 };
  window.getSelection().removeAllRanges();
  renderArticleContent();

  const annInput = document.getElementById("annotationInput");
  if (annInput) annInput.blur();
  if (
    window.innerWidth <= 767 &&
    document.body.classList.contains("drawer-active")
  ) {
    closeNotesDrawer();
  }
  setTimeout(() => {
    const marks = document.querySelectorAll(
      "mark.highlighted-text, span.inline-bookmark",
    );
    for (const mark of marks) {
      if (mark.textContent.trim() === selectedText.trim()) {
        mark.classList.add("newly-added");
        mark.addEventListener(
          "animationend",
          () => mark.classList.remove("newly-added"),
          { once: true },
        );
        break;
      }
    }
  }, 50);

  const crossRefCount = findCrossReferences(selectedText);
  let toastMessage = "Concept Extracted!";
  if (crossRefCount > 0)
    toastMessage += ` Also found in ${crossRefCount} other article${crossRefCount > 1 ? "s" : ""}.`;
  showToast(toastMessage);
}

function loadAnnotations() {
  const list = document.getElementById("annotationsList");
  if (!list) return;
  list.innerHTML = "";
  const annotations = getAnnotations();
  if (annotations.length === 0) {
    if (!localStorage.getItem("hide_tip_annotations_empty")) {
      list.innerHTML = `
        <div id="tip_annotations_empty" style="position: relative; padding: 20px; background: rgba(0,0,0,0.02); border: 1px dashed var(--glass-border); border-radius: 12px; text-align: center; margin-bottom: 16px; transition: all 0.3s ease;">
            <button onclick="dismissTip('annotations_empty')" style="position: absolute; top: 12px; right: 12px; background: transparent; border: none; color: var(--subtitle-color); cursor: pointer; padding: 4px; box-shadow: none;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--sage)" stroke-width="1.5" style="margin-bottom:12px;"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
            <div style="font-size: 0.85rem; font-weight: bold; color: var(--dark-text); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; padding-right: 20px;">How to Extract Knowledge</div>
            <div style="font-size: 0.85rem; color: var(--subtitle-color); line-height: 1.5; text-align: left; padding-right: 20px;">
                <strong>1.</strong> Highlight any interesting text in the article.<br>
                <strong>2.</strong> Click <em>Highlight</em> to instantly save it, or <em>Note</em> to add your own context.<br>
                <strong>3.</strong> Every saved passage physically grows this topic in your 3D Knowledge Web.
            </div>
        </div>`;
    } else {
      list.innerHTML = `<div style="font-size: 0.85rem; color: var(--subtitle-color); text-align: center; padding: 20px;">No notes yet — highlight text in a story to save one.</div>`;
    }
    return;
  }

  let filteredAnns = annotations;
  if (currentNotesSearch) {
    filteredAnns = annotations.filter((ann) => {
      const txt = (ann.text || "").toLowerCase();
      const nte = (ann.note || "").toLowerCase();
      return (
        txt.includes(currentNotesSearch) || nte.includes(currentNotesSearch)
      );
    });
  }

  if (filteredAnns.length === 0 && currentNotesSearch) {
    list.innerHTML = `<div style="font-size: 0.85rem; color: var(--subtitle-color); text-align: center; padding: 20px;">No matching notes found.</div>`;
    return;
  }

  [...filteredAnns].reverse().forEach((ann) => {
    let noteDisplay = ann.note;
    if (ann.note === "Bookmarked" || ann.note === "Bookmarked") {
      noteDisplay = `<span style="display:inline-flex;align-items:center;gap:6px;color:var(--accent);font-weight:600;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg> Bookmarked</span>`;
    }

    const item = document.createElement("div");
    item.className = "annotation-item";
    item.innerHTML = `
            ${ann.text ? `<div class="annotation-quote" style="cursor: pointer; opacity: 0.9;">"${ann.text}"</div>` : ""}
            <div class="annotation-note" style="cursor: pointer; opacity: 0.9;">${noteDisplay}</div>
            <div class="annotation-actions" style="display: flex; gap: 8px; align-items: center;">
                <button class="text-btn sage-btn">Scroll to</button>
                <button class="text-btn sage-btn" data-annotation-id="${ann.id}">•••</button>
            </div>`;

    const scrollBtn = item.querySelector(".annotation-actions button:first-child");
    const menuBtn = item.querySelector(".annotation-actions button:last-child");

    scrollBtn.onclick = () => goToAnnotationInArticle(ann.id);
    menuBtn.onclick = (e) => {
      e.stopPropagation();
      showAnnotationContextMenu(e, ann.id);
    };

    const quoteDiv = item.querySelector(".annotation-quote");
    const noteDiv = item.querySelector(".annotation-note");
    if (quoteDiv) quoteDiv.onclick = () => goToAnnotationInArticle(ann.id);
    if (noteDiv) noteDiv.onclick = () => goToAnnotationInArticle(ann.id);

    setupMultiSelect(item, ann.id, "annotation");
    list.appendChild(item);
  });
  updateArticleResonance();
}

// Show a "Jump to your bookmark" link under the title when this story has a bookmark.
function updateStoryBookmarkLink() {
  const link = document.getElementById("storyBookmarkLink");
  if (!link) return;
  const bookmark = getAnnotations().find((a) => a.note === "Bookmarked");
  if (bookmark) {
    link.style.display = "inline-flex";
    link.onclick = () => goToAnnotationInArticle(bookmark.id);
  } else {
    link.style.display = "none";
    link.onclick = null;
  }
}

function goToAnnotationInArticle(id) {
  const annotations = getAnnotations();
  const ann = annotations.find((a) => a.id === id);
  if (!ann || !ann.text) {
    showToast("This note doesn't have associated text in the article.");
    return;
  }

  closeNotesDrawer();
  // Strip everything except letters and numbers to ensure reliable matching
  // regardless of HTML tags, markdown, newlines, or invisible characters
  const normalize = (t) => (t || "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  const annNormalized = normalize(ann.text);

  setTimeout(() => {
    let targetMark = null;
    if (ann.pIndex !== undefined && ann.pIndex >= 0) {
      const block =
        document.getElementById("articleContent").children[ann.pIndex];
      if (block) {
        const marksInBlock = block.querySelectorAll(
          "mark.highlighted-text, span.inline-bookmark",
        );
        for (let m of marksInBlock) {
          if (normalize(m.textContent) === annNormalized) {
            targetMark = m;
            break;
          }
        }
      }
    }

    if (!targetMark) {
      const marks = document.querySelectorAll(
        "mark.highlighted-text, span.inline-bookmark",
      );
      for (const mark of marks) {
        if (normalize(mark.textContent) === annNormalized) {
          targetMark = mark;
          break;
        }
      }
    }

    if (targetMark) {
      const contentEl = document.getElementById("articleContent");

      // Just scroll to the spot — no spotlight/colour effect.
      targetMark.scrollIntoView({ behavior: "smooth", block: "center" });

      // Show the note above the word only when there's a real note to show
      // (skip plain highlights and bookmarks, which have nothing to display).
      const existingTooltip = document.getElementById("annotationTooltip");
      if (existingTooltip) existingTooltip.remove();

      const realNote =
        ann.note && ann.note !== "Highlighted" && ann.note !== "Bookmarked";
      if (realNote) {
        const tooltip = document.createElement("div");
        tooltip.id = "annotationTooltip";
        tooltip.style.cssText = `
          position: fixed;
          background: var(--glass-solid);
          border: 1px solid var(--glass-border);
          border-radius: 6px;
          padding: 8px 12px;
          font-size: 0.85rem;
          color: var(--dark-text);
          z-index: 9999;
          max-width: 280px;
          word-wrap: break-word;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          pointer-events: none;
        `;
        tooltip.textContent = ann.note;

        const markRect = targetMark.getBoundingClientRect();
        tooltip.style.left = markRect.left - 20 + "px";
        tooltip.style.top = markRect.top - 60 + "px";
        contentEl.parentElement.appendChild(tooltip);

        const removeTip = () => {
          tooltip.remove();
          contentEl.removeEventListener("scroll", removeTip);
        };
        const timeoutId = setTimeout(removeTip, 5000);
        contentEl.addEventListener(
          "scroll",
          () => {
            clearTimeout(timeoutId);
            removeTip();
          },
          { once: true },
        );
      }
    } else {
      showToast("Highlight not found in current text.");
    }
  }, 450); // Wait for drawer transition
}

function showAnnotationContextMenu(event, id) {
  event.stopPropagation();
  closeAllContextMenus();

  const menu = document.createElement("div");
  menu.id = "annotationContextMenu";
  menu.style.cssText = `
    position: fixed;
    background: var(--glass-solid);
    border: 1px solid var(--glass-border);
    border-radius: 6px;
    z-index: 10000;
    padding: 4px 0;
    min-width: 120px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  `;

  menu.innerHTML = `
    <button class="text-btn" style="display: block; width: 100%; text-align: left; padding: 8px 12px; font-size: 0.85rem; border: none; background: transparent; cursor: pointer; color: var(--dark-text); transition: background 0.2s;" onclick="event.stopPropagation(); editAnnotation(${id}); document.getElementById('annotationContextMenu').remove();">Edit</button>
    <button class="text-btn" style="display: block; width: 100%; text-align: left; padding: 8px 12px; font-size: 0.85rem; border: none; background: transparent; cursor: pointer; color: #c84c3c; transition: background 0.2s;" onclick="event.stopPropagation(); deleteAnnotation(${id}); document.getElementById('annotationContextMenu').remove();">Delete</button>
  `;

  document.body.appendChild(menu);

  // Position menu with viewport bounds checking
  setTimeout(() => {
    const rect = menu.getBoundingClientRect();
    let top = event.clientY;
    let left = event.clientX;

    if (left + rect.width > window.innerWidth - 10) {
      left = Math.max(10, window.innerWidth - rect.width - 10);
    }
    if (top + rect.height > window.innerHeight - 10) {
      top = Math.max(10, window.innerHeight - rect.height - 10);
    }

    menu.style.top = top + "px";
    menu.style.left = left + "px";
  }, 0);

  const closeMenu = () => closeAllContextMenus();
  setTimeout(() => {
    document.addEventListener("click", closeMenu, { once: true });
    document.addEventListener("scroll", closeMenu, { once: true, capture: true });
  }, 10);
}

function editAnnotation(id) {
  const annotations = getAnnotations();
  const index = annotations.findIndex((a) => a.id === id);
  if (index > -1) {
    let currentNote = annotations[index].note;
    // A plain highlight has no real note yet — start with an empty box so the
    // user can type a note (which turns the highlight into a note).
    if (currentNote === "Highlighted") currentNote = "";

    const annInput = document.getElementById("annotationInput");
    if (annInput) {
      annInput.value = currentNote;
      annInput.focus();
      annInput.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    const preview = document.getElementById("selectedTextPreview");
    if (preview) preview.textContent = annotations[index].text || "";
    editingAnnotationId = id;
    const btn = document.getElementById("addAnnotationBtn");
    if (btn) btn.textContent = "Update Note";
  }
}

// ---- The Open Book engines: auto-grow, typewriter focus, weave ----
function wsAutoGrow(ta) {
  if (!ta) return;
  ta.style.height = "auto";
  ta.style.height = ta.scrollHeight + "px";
}
function wsTypewriter(ta) {
  const slide = ta.closest(".carousel-slide");
  if (!slide) return;
  const rTa = ta.getBoundingClientRect();
  const rSl = slide.getBoundingClientRect();
  const ratio = ta.value.length
    ? Math.min(1, ta.selectionEnd / ta.value.length)
    : 1;
  const caretY = rTa.top - rSl.top + slide.scrollTop + ratio * rTa.height;
  const target = caretY - slide.clientHeight * 0.42;
  slide.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
}
let _wsTypingTimer = null;
function wsTypingPulse() {
  const sect = document.getElementById("notesSection");
  if (!sect) return;
  sect.classList.add("ws-typing");
  clearTimeout(_wsTypingTimer);
  _wsTypingTimer = setTimeout(
    () => sect.classList.remove("ws-typing"),
    2200,
  );
}

// Weave: every highlight laid onto the page as a skeleton of quotations
function weaveMargins() {
  let anns = [];
  try {
    anns = getAnnotations().filter(
      (a) => a && a.text && a.note !== "Bookmarked",
    );
  } catch (e) {}
  if (!anns.length) return;
  const ta = document.getElementById("reflectionInput");
  if (!ta) return;
  const skeleton = anns
    .map((a) => `“${a.text.replace(/\s+/g, " ").trim()}” —\n\n`)
    .join("");
  ta.value = ta.value.trim()
    ? ta.value.replace(/\n*$/, "\n\n") + skeleton
    : skeleton;
  wsAutoGrow(ta);
  const firstGap = ta.value.indexOf("” —\n");
  ta.focus();
  const caret = firstGap > -1 ? firstGap + 4 : ta.value.length;
  ta.selectionStart = ta.selectionEnd = caret;
  updateWsWordCount();
  saveWsDraft(ta.value);
  wsTypewriter(ta);
}
window.weaveMargins = weaveMargins;

// ---- Workstation desk furniture: epigraph, margins, measure, draft ----
let wsEpigraphText = "";
function setWsEpigraph(text) {
  wsEpigraphText = (text || "").trim();
  const el = document.getElementById("wsEpigraph");
  if (!el) return;
  if (!wsEpigraphText) {
    el.style.display = "none";
    el.innerHTML = "";
    return;
  }
  el.innerHTML = `<span>${wsEpigraphText}</span><small>tap to unpin</small>`;
  el.style.display = "block";
  el.onclick = () => setWsEpigraph("");
}
window.setWsEpigraph = setWsEpigraph;

// This story's highlights & notes, folded beside the writing sheet —
// tap one to set it into the manuscript as a quotation to answer.
function renderWsMargins() {
  const el = document.getElementById("wsMargins");
  if (!el) return;
  let anns = [];
  try {
    anns = getAnnotations().filter(
      (a) => a && a.text && a.note !== "Bookmarked",
    );
  } catch (e) {}
  const weaveBtn = document.getElementById("wsWeaveBtn");
  if (weaveBtn)
    weaveBtn.style.display =
      currentState.article && anns.length ? "inline-block" : "none";
  if (!currentState.article || !anns.length) {
    el.style.display = "none";
    el.innerHTML = "";
    return;
  }
  el.style.display = "block";
  el.innerHTML = `
    <button class="ws-margins-toggle">— Your margins · ${anns.length} —</button>
    <div class="ws-margins-list" style="display:none"></div>`;
  const listEl = el.querySelector(".ws-margins-list");
  el.querySelector(".ws-margins-toggle").addEventListener("click", () => {
    listEl.style.display = listEl.style.display === "none" ? "block" : "none";
  });
  anns.slice(0, 30).forEach((a) => {
    const row = document.createElement("button");
    row.className = "ws-margin-row";
    let t = a.text.replace(/\s+/g, " ").trim();
    if (t.length > 110) t = t.slice(0, 110) + "…";
    row.textContent = `“${t}”`;
    row.addEventListener("click", () => {
      const ta = document.getElementById("reflectionInput");
      if (!ta) return;
      const q = `“${a.text.replace(/\s+/g, " ").trim()}” —\n`;
      ta.value = (ta.value ? ta.value.replace(/\n*$/, "\n\n") : "") + q;
      ta.focus();
      ta.selectionStart = ta.selectionEnd = ta.value.length;
      updateWsWordCount();
      listEl.style.display = "none";
    });
    listEl.appendChild(row);
  });
}

function updateWsWordCount() {
  const el = document.getElementById("wsWordCount");
  const ta = document.getElementById("reflectionInput");
  if (!el || !ta) return;
  const n = ta.value.trim() ? ta.value.trim().split(/\s+/).length : 0;
  el.textContent = n ? `${n} word${n === 1 ? "" : "s"}` : "";
}

// The preserved draft: a half-written page survives iOS killing the app.
function wsDraftKey() {
  return `reflection_draft_${getStorageKey()}`;
}
function saveWsDraft(val) {
  try {
    if (val && val.trim()) localStorage.setItem(wsDraftKey(), val);
    else localStorage.removeItem(wsDraftKey());
  } catch (e) {}
}
function restoreWsDraft() {
  const ta = document.getElementById("reflectionInput");
  const mark = document.getElementById("wsDraftMark");
  if (!ta) return;
  if (!ta.value.trim()) {
    const d = localStorage.getItem(wsDraftKey());
    if (d) {
      ta.value = d;
      if (mark) mark.style.display = "block";
      updateWsWordCount();
      wsAutoGrow(ta);
      return;
    }
  }
  if (mark) mark.style.display = "none";
  if (!ta.value.trim()) ta.style.height = "";
  updateWsWordCount();
}
function clearWsDraft() {
  try {
    localStorage.removeItem(wsDraftKey());
  } catch (e) {}
  const mark = document.getElementById("wsDraftMark");
  if (mark) mark.style.display = "none";
}

// ============================================================
// THE DIALOGUE — a guided, laddered reflection companion.
// Starts from a passage you marked, offers sentence-stems so you
// never face a blank line, and deepens with each answer:
// notice -> unpack -> connect -> admit -> carry forward.
// ============================================================
// Four reflection PATHS, each its own ladder of deepening questions.
const _DLG_PATHS = {
  understand: {
    name: "Understand",
    tag: "make sense of it",
    rungs: [
      { q: ["What is this actually claiming?", "What's the core idea here?"], stems: ["It's claiming that…", "The core idea is…"] },
      { q: ["What must be true for this to hold?", "What assumption does it rest on?"], stems: ["It assumes…", "This only works if…"] },
      { q: ["How would you explain it to someone who disagreed?", "Put it in the plainest terms you can."], stems: ["Put simply…", "I'd tell them…"] },
      { q: ["Now that it's clear — what follows?", "What does understanding this change?"], stems: ["So it follows that…", "This changes…"] },
    ],
  },
  feel: {
    name: "Feel",
    tag: "sit with what it stirred",
    rungs: [
      { q: ["What did this stir in you?", "What feeling rose up here?"], stems: ["I felt…", "It stirred…"] },
      { q: ["Why this feeling, and not another?", "Where does that feeling come from?"], stems: ["Because…", "It comes from…"] },
      { q: ["When have you felt this before?", "What memory does it touch?"], stems: ["I've felt this when…", "It touches the memory of…"] },
      { q: ["What is this feeling trying to tell you?", "What does it want from you?"], stems: ["It's telling me…", "It wants…"] },
    ],
  },
  apply: {
    name: "Apply",
    tag: "carry it into your life",
    rungs: [
      { q: ["Where is this true for you right now?", "What in your life does this touch?"], stems: ["Right now, this is true of…", "In my life, this touches…"] },
      { q: ["If you believed this fully, what would change?", "What would taking it seriously look like?"], stems: ["If I believed it, I'd…", "Taking it seriously means…"] },
      { q: ["What's the smallest step you could take?", "What could you do this week?"], stems: ["The smallest step is…", "This week, I'll…"] },
      { q: ["What will get in the way — and how will you meet it?", "What makes this hard to do?"], stems: ["What gets in the way is…", "It's hard because…"] },
    ],
  },
  question: {
    name: "Question",
    tag: "argue with it",
    rungs: [
      { q: ["What do you doubt here?", "Where is this wrong, or too easy?"], stems: ["I doubt that…", "This is too easy because…"] },
      { q: ["What's the strongest case against it?", "How would a sharp critic answer?"], stems: ["The case against is…", "A critic would say…"] },
      { q: ["What does it conveniently leave out?", "Whose view is missing?"], stems: ["It leaves out…", "Missing is…"] },
      { q: ["After arguing with it — what still stands?", "What survives your doubt?"], stems: ["What still stands is…", "What survives is…"] },
    ],
  },
  connect: {
    name: "Connect",
    tag: "link it to your world",
    rungs: [
      { q: ["What does this connect to — another book, a moment, a person?", "What does it rhyme with in your life?"], stems: ["This connects to…", "It rhymes with…"] },
      { q: ["What's the thread running between them?", "Why do they belong together?"], stems: ["The thread is…", "They share…"] },
      { q: ["What does seeing them side by side reveal?", "What's clearer now that they're together?"], stems: ["Together they reveal…", "Now I see…"] },
      { q: ["Where else might this pattern appear?", "What else would it explain?"], stems: ["It might also appear in…", "It would explain…"] },
    ],
  },
};
const _DLG_PATH_ORDER = ["understand", "feel", "apply", "question", "connect"];
// Lateral deepeners for "press further" — dig into the same thought.
const _DLG_DEEPEN = [
  "Say more about that.",
  "And why does that matter?",
  "What's underneath that?",
  "Be more honest — what's the real reason?",
  "Give one concrete example.",
  "And what does that cost you?",
  "What would you say if no one were watching?",
  "What are you avoiding here?",
  "And then what follows?",
  "What's the truest version of that sentence?",
];
const _DLG_CAPSTONE = {
  q: "In one line — what is this reflection really about?",
  stems: ["In truth, it's about…", "What it comes down to is…"],
};
let _dlg = null;
function _dlgPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function _dlgSeeds() {
  let anns = [];
  try {
    anns = getAnnotations().filter((a) => a && a.text && a.note !== "Bookmarked");
  } catch (e) {}
  const out = [];
  anns.forEach((a) => {
    let t = a.text || "";
    if (t.includes('\n\n"')) {
      const parts = t.split('\n\n"');
      t = parts.slice(1).join('\n\n"');
    }
    t = t.replace(/^"|"$/g, "").replace(/\s+/g, " ").trim();
    if (t.length > 12) out.push(t);
  });
  return out;
}
function startReflectionDialogue() {
  const seeds = _dlgSeeds();
  _dlg = { stage: "choose", answers: [], seeds, seedIdx: 0, history: [] };
  const left = document.getElementById("reflectLeft");
  if (left) left.classList.add("dlg-on");
  _renderDialogueChoose();
}
function closeReflectionDialogue() {
  _dlg = null;
  const left = document.getElementById("reflectLeft");
  if (left) left.classList.remove("dlg-on");
  const box = document.getElementById("reflectionDialogue");
  if (box) box.style.display = "none";
}
function _dlgSeedText() {
  if (!_dlg || !_dlg.seeds.length) return "";
  return _dlg.seeds[_dlg.seedIdx % _dlg.seeds.length];
}
function _dlgSeedHtml() {
  const seed = _dlgSeedText();
  if (!seed) return "";
  return `<div class="dlg-seed"><span class="dlg-seed-q">❝</span>${_chronEsc(seed)}${_dlg.seeds.length > 1 ? `<button class="dlg-reseed" type="button">another passage ↻</button>` : ""}</div>`;
}
function _dlgWireSeed(box) {
  const re = box.querySelector(".dlg-reseed");
  if (re)
    re.addEventListener("click", () => {
      _dlg.seedIdx++;
      if (_dlg.stage === "choose") _renderDialogueChoose();
      else _renderDialogue(true);
    });
}
function _dlgWireFree() {
  const f = document.getElementById("dlgFree");
  if (f)
    f.addEventListener("click", () => {
      closeReflectionDialogue();
      const ref = document.getElementById("reflectionInput");
      if (ref) ref.focus();
    });
}

// ---- Stage 1: choose a path ----
function _renderDialogueChoose() {
  const box = document.getElementById("reflectionDialogue");
  if (!box || !_dlg) return;
  box.style.display = "block";
  box.innerHTML = `
    <div class="dlg-head"><span class="dlg-label">The Dialogue</span></div>
    ${_dlgSeedHtml()}
    <div class="dlg-choose-q">How do you want to reflect?</div>
    <div class="dlg-paths">
      ${_DLG_PATH_ORDER.map((k) => `<button class="dlg-path" type="button" data-path="${k}"><span class="dlg-path-name">${_DLG_PATHS[k].name}</span><span class="dlg-path-tag">${_DLG_PATHS[k].tag}</span></button>`).join("")}
    </div>
    <div class="dlg-actions">
      <button class="dlg-free" type="button" id="dlgFree">write freely instead</button>
      <button class="dlg-free" type="button" id="dlgSurprise">surprise me ↻</button>
    </div>`;
  box.querySelectorAll(".dlg-path").forEach((b) =>
    b.addEventListener("click", () => _dlgBeginPath(b.dataset.path)),
  );
  const sur = document.getElementById("dlgSurprise");
  if (sur) sur.addEventListener("click", () => _dlgBeginPath(_dlgPick(_DLG_PATH_ORDER)));
  _dlgWireSeed(box);
  _dlgWireFree();
}

function _dlgBeginPath(pathKey) {
  _dlg.history.push(_dlgSnapshot());
  _dlg.path = pathKey;
  _dlg.stage = "ladder";
  _dlg.rung = 0;
  _renderDialogue(true);
}

// ---- Stage 2: the ladder (and capstone) ----
function _renderDialogue(fresh) {
  const box = document.getElementById("reflectionDialogue");
  if (!box || !_dlg) return;
  box.style.display = "block";
  const path = _DLG_PATHS[_dlg.path];
  const capstone = _dlg.stage === "capstone";
  const rungs = path.rungs;
  let stems;
  if (capstone) {
    if (fresh || !_dlg.question) _dlg.question = _DLG_CAPSTONE.q;
    stems = _DLG_CAPSTONE.stems;
  } else if (_dlg.pressing) {
    if (fresh || !_dlg.question) _dlg.question = _dlgPick(_DLG_DEEPEN);
    stems = rungs[_dlg.rung].stems;
  } else {
    if (fresh || !_dlg.question) _dlg.question = _dlgPick(rungs[_dlg.rung].q);
    stems = rungs[_dlg.rung].stems;
  }
  const stepTxt = capstone
    ? `${path.name} · to close`
    : `${path.name} · ${_dlg.rung + 1} of ${rungs.length}`;
  const woven = _dlg.answers.length
    ? `<div class="dlg-woven">${_dlg.answers.map((a) => `<p>${_chronEsc(a)}</p>`).join("")}</div>`
    : "";
  const seedHtml = _dlg.rung === 0 && !_dlg.pressing && !capstone ? _dlgSeedHtml() : "";
  const isLast = _dlg.rung >= rungs.length - 1;
  const moves = capstone
    ? ""
    : `<button class="dlg-move" type="button" id="dlgPress">Press further ↧</button>${isLast ? `<button class="secondary btn-sm" type="button" id="dlgDeeper">To close →</button>` : `<button class="secondary btn-sm" type="button" id="dlgDeeper">Go deeper →</button>`}`;
  box.innerHTML = `
    <div class="dlg-head">
      <div class="dlg-head-left">${_dlg.history && _dlg.history.length ? '<button class="dlg-back" type="button" id="dlgBack">← back</button>' : ""}<span class="dlg-label">The Dialogue</span></div>
      <span class="dlg-step">${stepTxt}</span>
    </div>
    ${seedHtml}
    ${woven}
    <div class="dlg-q${capstone ? " dlg-q-cap" : ""}">${_chronEsc(_dlg.question)}</div>
    <div class="dlg-stems">${stems.map((st) => `<button class="dlg-stem" type="button">${_chronEsc(st)}</button>`).join("")}</div>
    <textarea class="dlg-input" id="dlgInput" placeholder="Begin here…"></textarea>
    <div class="dlg-actions">
      <button class="dlg-free" type="button" id="dlgFree">write freely instead</button>
      <div class="dlg-actions-right">
        ${moves}
        <button class="primary btn-sm" type="button" id="dlgFinish">Finish</button>
      </div>
    </div>`;
  const input = document.getElementById("dlgInput");
  box.querySelectorAll(".dlg-stem").forEach((chip) => {
    chip.addEventListener("click", () => {
      const stem = chip.textContent;
      if (!input.value.trim()) input.value = stem + " ";
      else input.value = input.value.replace(/\s*$/, " ") + stem + " ";
      input.focus();
      input.selectionStart = input.selectionEnd = input.value.length;
      _dlgGrow(input);
    });
  });
  input.addEventListener("input", () => _dlgGrow(input));
  _dlgWireSeed(box);
  _dlgWireFree();
  const press = document.getElementById("dlgPress");
  if (press) press.addEventListener("click", () => _dlgPress());
  const deeper = document.getElementById("dlgDeeper");
  if (deeper) deeper.addEventListener("click", () => _dlgAdvance());
  document.getElementById("dlgFinish").addEventListener("click", () => _dlgFinish());
  const back = document.getElementById("dlgBack");
  if (back) back.addEventListener("click", () => _dlgBack());
  if (_dlg.restoreInput != null && _dlg.restoreInput !== "") {
    input.value = _dlg.restoreInput;
    _dlgGrow(input);
  }
  _dlg.restoreInput = null;
  setTimeout(() => input && input.focus(), 60);
}
function _dlgGrow(ta) {
  ta.style.height = "auto";
  ta.style.height = Math.max(70, ta.scrollHeight) + "px";
}
function _dlgSnapshot() {
  const inp = document.getElementById("dlgInput");
  return {
    stage: _dlg.stage,
    path: _dlg.path,
    rung: _dlg.rung,
    pressing: !!_dlg.pressing,
    question: _dlg.question,
    seedIdx: _dlg.seedIdx,
    answers: _dlg.answers.slice(),
    inputText: inp ? inp.value : "",
  };
}
function _dlgBack() {
  if (!_dlg || !_dlg.history || !_dlg.history.length) return;
  const snap = _dlg.history.pop();
  _dlg.stage = snap.stage;
  _dlg.path = snap.path;
  _dlg.rung = snap.rung;
  _dlg.pressing = snap.pressing;
  _dlg.question = snap.question;
  _dlg.seedIdx = snap.seedIdx;
  _dlg.answers = snap.answers;
  _dlg.restoreInput = snap.inputText;
  if (snap.stage === "choose") _renderDialogueChoose();
  else _renderDialogue(false);
}
function _dlgPushCurrent() {
  const input = document.getElementById("dlgInput");
  if (input && input.value.trim()) _dlg.answers.push(input.value.trim());
}
function _dlgScroll() {
  const box = document.getElementById("reflectionDialogue");
  if (box) box.scrollIntoView({ behavior: "smooth", block: "nearest" });
}
function _dlgPress() {
  _dlg.history.push(_dlgSnapshot());
  _dlgPushCurrent();
  _dlg.pressing = true;
  _renderDialogue(true);
  _dlgScroll();
}
function _dlgAdvance() {
  _dlg.history.push(_dlgSnapshot());
  _dlgPushCurrent();
  _dlg.pressing = false;
  const rungs = _DLG_PATHS[_dlg.path].rungs;
  if (_dlg.rung >= rungs.length - 1) {
    _dlg.stage = "capstone";
  } else {
    _dlg.rung++;
  }
  _renderDialogue(true);
  _dlgScroll();
}
function _dlgFinish() {
  const capstone = _dlg.stage === "capstone";
  const input = document.getElementById("dlgInput");
  const capText = capstone && input ? input.value.trim() : "";
  if (!capstone) _dlgPushCurrent();
  const answers = _dlg.answers.slice();
  const seed = _dlgSeedText();
  closeReflectionDialogue();
  if (!answers.length && !capText) return;
  const ref = document.getElementById("reflectionInput");
  if (ref) {
    ref.value = answers.join("\n\n");
    if (typeof wsAutoGrow === "function") wsAutoGrow(ref);
  }
  // The crystallised capstone line becomes the reflection's title/lead;
  // otherwise the seed passage does.
  const lead = capText || (seed ? "“" + seed + "”" : "");
  if (typeof setWsEpigraph === "function") setWsEpigraph(lead);
  if (typeof updateWsWordCount === "function") updateWsWordCount();
  saveReflection();
}
window.startReflectionDialogue = startReflectionDialogue;

// ============================================================
// The Margin Dialogue — guided prompts for annotating a passage.
// A note is anchored to a specific line, so the lenses read THAT line.
// ============================================================
const _NOTE_LENSES = {
  unpack: {
    name: "Unpack",
    tag: "what it means",
    rungs: [
      { q: ["What is this passage actually saying?", "Put this line in your own words."], stems: ["This says…", "In plain terms…"] },
      { q: ["What's beneath the surface here?", "What's implied but left unsaid?"], stems: ["Underneath, it means…", "It implies…"] },
      { q: ["So what does it want you to see?", "What's the point of it?"], stems: ["It wants me to see…", "The point is…"] },
    ],
  },
  react: {
    name: "React",
    tag: "why it stopped you",
    rungs: [
      { q: ["Why did this stop you?", "What made you mark this line?"], stems: ["It stopped me because…", "I marked it because…"] },
      { q: ["What does that reaction reveal about you?", "What in you does it touch?"], stems: ["It reveals…", "It touches…"] },
      { q: ["What will you carry from it?", "What do you want to remember here?"], stems: ["I'll carry…", "I want to remember…"] },
    ],
  },
  connect: {
    name: "Connect",
    tag: "what it links to",
    rungs: [
      { q: ["What does this connect to — another line, book, or moment?", "What does it remind you of?"], stems: ["This connects to…", "It reminds me of…"] },
      { q: ["What's the thread between them?", "Why do they belong together?"], stems: ["The thread is…", "They share…"] },
    ],
  },
  question: {
    name: "Question",
    tag: "argue with it",
    rungs: [
      { q: ["What do you resist here?", "Where might this be wrong?"], stems: ["I doubt…", "But…"] },
      { q: ["What's the counter-case?", "What would change your mind?"], stems: ["The counter is…", "I'd change my mind if…"] },
    ],
  },
  name: {
    name: "Name it",
    tag: "a phrase to keep",
    rungs: [
      { q: ["Capture this line in a single phrase.", "If this idea had a name, what is it?"], stems: ["Call it…", "In a word…"] },
    ],
  },
};
const _NOTE_ORDER = ["unpack", "react", "connect", "question", "name"];
let _ndlg = null;

function _ndlgPassage() {
  return (activeSelection || lastSelectionSnapshot.text || "")
    .replace(/\s+/g, " ")
    .trim();
}
function startNoteDialogue() {
  const passage = _ndlgPassage();
  if (!passage) {
    showToast("Select a passage in the story first.");
    return;
  }
  _ndlg = {
    stage: "choose",
    lens: null,
    rung: 0,
    pressing: false,
    answers: [],
    history: [],
    passage,
  };
  const left = document.getElementById("noteLeft");
  if (left) left.classList.add("dlg-on");
  _renderNoteChoose();
}
function closeNoteDialogue() {
  _ndlg = null;
  const left = document.getElementById("noteLeft");
  if (left) left.classList.remove("dlg-on");
  const box = document.getElementById("annotationDialogue");
  if (box) box.style.display = "none";
}
function _ndlgPassageHtml() {
  if (!_ndlg || !_ndlg.passage) return "";
  const p =
    _ndlg.passage.length > 160
      ? _ndlg.passage.slice(0, 160) + "…"
      : _ndlg.passage;
  return `<div class="dlg-seed"><span class="dlg-seed-q">❝</span>${_chronEsc(p)}</div>`;
}
function _renderNoteChoose() {
  const box = document.getElementById("annotationDialogue");
  if (!box || !_ndlg) return;
  box.style.display = "block";
  box.innerHTML = `
    <div class="dlg-head"><span class="dlg-label">The Margin</span></div>
    ${_ndlgPassageHtml()}
    <div class="dlg-choose-q">How do you want to read this line?</div>
    <div class="dlg-paths">
      ${_NOTE_ORDER.map((k) => `<button class="dlg-path" type="button" data-lens="${k}"><span class="dlg-path-name">${_NOTE_LENSES[k].name}</span><span class="dlg-path-tag">${_NOTE_LENSES[k].tag}</span></button>`).join("")}
    </div>
    <div class="dlg-actions">
      <button class="dlg-free" type="button" id="ndlgFree">write freely instead</button>
      <button class="dlg-free" type="button" id="ndlgSurprise">surprise me ↻</button>
    </div>`;
  box
    .querySelectorAll(".dlg-path")
    .forEach((b) =>
      b.addEventListener("click", () => _ndlgBeginLens(b.dataset.lens)),
    );
  const sur = document.getElementById("ndlgSurprise");
  if (sur)
    sur.addEventListener("click", () => _ndlgBeginLens(_dlgPick(_NOTE_ORDER)));
  const fr = document.getElementById("ndlgFree");
  if (fr)
    fr.addEventListener("click", () => {
      closeNoteDialogue();
      const a = document.getElementById("annotationInput");
      if (a) a.focus();
    });
}
function _ndlgSnapshot() {
  const inp = document.getElementById("ndlgInput");
  return {
    stage: _ndlg.stage,
    lens: _ndlg.lens,
    rung: _ndlg.rung,
    pressing: !!_ndlg.pressing,
    question: _ndlg.question,
    answers: _ndlg.answers.slice(),
    inputText: inp ? inp.value : "",
  };
}
function _ndlgBack() {
  if (!_ndlg || !_ndlg.history.length) return;
  const s = _ndlg.history.pop();
  _ndlg.stage = s.stage;
  _ndlg.lens = s.lens;
  _ndlg.rung = s.rung;
  _ndlg.pressing = s.pressing;
  _ndlg.question = s.question;
  _ndlg.answers = s.answers;
  _ndlg.restoreInput = s.inputText;
  if (s.stage === "choose") _renderNoteChoose();
  else _renderNoteDialogue(false);
}
function _ndlgBeginLens(k) {
  _ndlg.history.push(_ndlgSnapshot());
  _ndlg.lens = k;
  _ndlg.stage = "ladder";
  _ndlg.rung = 0;
  _ndlg.pressing = false;
  _ndlg.question = null;
  _renderNoteDialogue(true);
}
function _renderNoteDialogue(fresh) {
  const box = document.getElementById("annotationDialogue");
  if (!box || !_ndlg) return;
  box.style.display = "block";
  const lens = _NOTE_LENSES[_ndlg.lens];
  const rungs = lens.rungs;
  let stems;
  if (_ndlg.pressing) {
    if (fresh || !_ndlg.question) _ndlg.question = _dlgPick(_DLG_DEEPEN);
    stems = rungs[_ndlg.rung].stems;
  } else {
    if (fresh || !_ndlg.question) _ndlg.question = _dlgPick(rungs[_ndlg.rung].q);
    stems = rungs[_ndlg.rung].stems;
  }
  const stepTxt = `${lens.name} · ${_ndlg.rung + 1} of ${rungs.length}`;
  const woven = _ndlg.answers.length
    ? `<div class="dlg-woven">${_ndlg.answers.map((a) => `<p>${_chronEsc(a)}</p>`).join("")}</div>`
    : "";
  const passageHtml =
    _ndlg.rung === 0 && !_ndlg.pressing ? _ndlgPassageHtml() : "";
  const isLast = _ndlg.rung >= rungs.length - 1;
  const moves = `<button class="dlg-move" type="button" id="ndlgPress">Press further ↧</button>${isLast ? "" : `<button class="secondary btn-sm" type="button" id="ndlgDeeper">Go deeper →</button>`}`;
  box.innerHTML = `
    <div class="dlg-head">
      <div class="dlg-head-left">${_ndlg.history.length ? '<button class="dlg-back" type="button" id="ndlgBack">← back</button>' : ""}<span class="dlg-label">The Margin</span></div>
      <span class="dlg-step">${stepTxt}</span>
    </div>
    ${passageHtml}
    ${woven}
    <div class="dlg-q">${_chronEsc(_ndlg.question)}</div>
    <div class="dlg-stems">${stems.map((st) => `<button class="dlg-stem" type="button">${_chronEsc(st)}</button>`).join("")}</div>
    <textarea class="dlg-input" id="ndlgInput" placeholder="Begin here…"></textarea>
    <div class="dlg-actions">
      <button class="dlg-free" type="button" id="ndlgFree">write freely instead</button>
      <div class="dlg-actions-right">
        ${moves}
        <button class="primary btn-sm" type="button" id="ndlgFinish">Save note</button>
      </div>
    </div>`;
  const input = document.getElementById("ndlgInput");
  box.querySelectorAll(".dlg-stem").forEach((chip) => {
    chip.addEventListener("click", () => {
      const stem = chip.textContent;
      if (!input.value.trim()) input.value = stem + " ";
      else input.value = input.value.replace(/\s*$/, " ") + stem + " ";
      input.focus();
      input.selectionStart = input.selectionEnd = input.value.length;
      _dlgGrow(input);
    });
  });
  input.addEventListener("input", () => _dlgGrow(input));
  const fr = document.getElementById("ndlgFree");
  if (fr)
    fr.addEventListener("click", () => {
      const parts = _ndlg.answers.slice();
      if (input.value.trim()) parts.push(input.value.trim());
      const compiled = parts.join(" ");
      closeNoteDialogue();
      const a = document.getElementById("annotationInput");
      if (a) {
        if (compiled) a.value = compiled;
        a.focus();
        if (typeof wsAutoGrow === "function") wsAutoGrow(a);
      }
    });
  const press = document.getElementById("ndlgPress");
  if (press) press.addEventListener("click", () => _ndlgPress());
  const deeper = document.getElementById("ndlgDeeper");
  if (deeper) deeper.addEventListener("click", () => _ndlgAdvance());
  document
    .getElementById("ndlgFinish")
    .addEventListener("click", () => _ndlgFinish());
  const back = document.getElementById("ndlgBack");
  if (back) back.addEventListener("click", () => _ndlgBack());
  if (_ndlg.restoreInput != null && _ndlg.restoreInput !== "") {
    input.value = _ndlg.restoreInput;
    _dlgGrow(input);
  }
  _ndlg.restoreInput = null;
  setTimeout(() => input && input.focus(), 60);
}
function _ndlgPush() {
  const i = document.getElementById("ndlgInput");
  if (i && i.value.trim()) _ndlg.answers.push(i.value.trim());
}
function _ndlgPress() {
  _ndlg.history.push(_ndlgSnapshot());
  _ndlgPush();
  _ndlg.pressing = true;
  _ndlg.question = null;
  _renderNoteDialogue(true);
}
function _ndlgAdvance() {
  _ndlg.history.push(_ndlgSnapshot());
  _ndlgPush();
  _ndlg.pressing = false;
  _ndlg.question = null;
  const rungs = _NOTE_LENSES[_ndlg.lens].rungs;
  if (_ndlg.rung < rungs.length - 1) _ndlg.rung++;
  _renderNoteDialogue(true);
}
function _ndlgFinish() {
  _ndlgPush();
  const compiled = _ndlg.answers.join(" ").trim();
  closeNoteDialogue();
  const a = document.getElementById("annotationInput");
  if (a && compiled) {
    a.value = compiled;
    if (typeof wsAutoGrow === "function") wsAutoGrow(a);
  }
  // Save straight away through the normal note path (anchors to the selection).
  if (compiled && typeof saveNewAnnotation === "function")
    saveNewAnnotation(compiled);
}
window.startNoteDialogue = startNoteDialogue;

function saveReflection() {
  const text = document.getElementById("reflectionInput").value.trim();
  if (!text) return;
  const reflections = getReflections();
  const wordCount = text.split(/\s+/).length;

  if (editingReflectionId) {
    const index = reflections.findIndex((r) => r.id === editingReflectionId);
    if (index > -1) {
      const oldText = reflections[index].text;
      reflections[index].text = text;
    }
    editingReflectionId = null;
    document.getElementById("saveReflectionBtn").textContent =
      "Save Reflection";
    showToast("Reflection updated!");
  } else {
    reflections.push({
      id: Date.now(),
      text,
      prompt: wsEpigraphText || "",
      article: currentState.article,
      created: new Date().toISOString(),
    });

    trackEngagement("reflection", text);
    showToast(`Insight Forged! (${wordCount} words)`);
  }

  saveReflections(reflections);
  const _refTa = document.getElementById("reflectionInput");
  _refTa.value = "";
  _refTa.style.height = ""; // the grown sheet shrinks back after saving
  _refTa.blur();
  clearWsDraft();
  setWsEpigraph("");
  updateWsWordCount();
  loadReflections();
  spawnInsightParticles();
  if (window.triggerGraphPulse) window.triggerGraphPulse(currentState.category);
  // Stay at the desk after saving — the new reflection appears in the
  // history right below, no reason to be thrown out of the room.
}

function loadReflections() {
  const container = document.getElementById("reflectionHistory");
  if (!container) return;
  container.innerHTML = "";
  [...getReflections()].reverse().forEach((ref) => {
    const entry = document.createElement("div");
    entry.className = "annotation-item";
    const refWords = ref.text.trim()
      ? ref.text.trim().split(/\s+/).length
      : 0;
    entry.innerHTML = `
            <div class="ws-ref-dateline">${new Date(ref.created).toLocaleDateString()} · ${refWords} word${refWords === 1 ? "" : "s"}</div>
            ${ref.prompt ? `<div class="ws-ref-prompt">${ref.prompt}</div>` : ""}
            <div class="annotation-note">${ref.text}</div>
            <div class="annotation-actions" style="display: flex; gap: 8px; align-items: center;">
                <button class="text-btn sage-btn" data-reflection-id="${ref.id}">•••</button>
            </div>`;

    const menuBtn = entry.querySelector(".annotation-actions button");
    menuBtn.onclick = (e) => {
      e.stopPropagation();
      showReflectionContextMenu(e, ref.id);
    };

    setupMultiSelect(entry, ref.id, "reflection");
    container.appendChild(entry);
  });

  if (getReflections().length === 0) {
    if (!localStorage.getItem("hide_tip_reflections_empty")) {
      container.innerHTML = `
        <div id="tip_reflections_empty" style="position: relative; padding: 20px; background: rgba(0,0,0,0.02); border: 1px dashed var(--glass-border); border-radius: 12px; text-align: center; margin-bottom: 16px; transition: all 0.3s ease;">
            <button onclick="dismissTip('reflections_empty')" style="position: absolute; top: 12px; right: 12px; background: transparent; border: none; color: var(--subtitle-color); cursor: pointer; padding: 4px; box-shadow: none;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.5" style="margin-bottom:12px;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
            <div style="font-size: 0.85rem; font-weight: bold; color: var(--dark-text); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; padding-right: 20px;">Why write a reflection?</div>
            <div style="font-size: 0.85rem; color: var(--subtitle-color); line-height: 1.5; text-align: left; padding-right: 20px;">
                Reflections are the glue of memory. Write down your raw thoughts, analogies, or arguments about this article. <br><br>Writing reflections generates powerful <strong>Conceptual Links (Green Lines)</strong> in your Knowledge Web and accelerates your path to unlocking the Epiphany Echo.
            </div>
        </div>`;
    }
  }
  updateArticleResonance();
}

function showReflectionContextMenu(event, id) {
  event.stopPropagation();
  closeAllContextMenus();

  const menu = document.createElement("div");
  menu.id = "reflectionContextMenu";
  menu.style.cssText = `
    position: fixed;
    background: var(--glass-solid);
    border: 1px solid var(--glass-border);
    border-radius: 6px;
    z-index: 10000;
    padding: 4px 0;
    min-width: 120px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  `;

  menu.innerHTML = `
    <button class="text-btn" style="display: block; width: 100%; text-align: left; padding: 8px 12px; font-size: 0.85rem; border: none; background: transparent; cursor: pointer; color: var(--dark-text); transition: background 0.2s;" onclick="event.stopPropagation(); editReflection(${id}); document.getElementById('reflectionContextMenu').remove();">Edit</button>
    <button class="text-btn" style="display: block; width: 100%; text-align: left; padding: 8px 12px; font-size: 0.85rem; border: none; background: transparent; cursor: pointer; color: #c84c3c; transition: background 0.2s;" onclick="event.stopPropagation(); deleteReflection(${id}); document.getElementById('reflectionContextMenu').remove();">Delete</button>
  `;

  document.body.appendChild(menu);

  // Position menu with viewport bounds checking
  setTimeout(() => {
    const rect = menu.getBoundingClientRect();
    let top = event.clientY;
    let left = event.clientX;

    if (left + rect.width > window.innerWidth - 10) {
      left = Math.max(10, window.innerWidth - rect.width - 10);
    }
    if (top + rect.height > window.innerHeight - 10) {
      top = Math.max(10, window.innerHeight - rect.height - 10);
    }

    menu.style.top = top + "px";
    menu.style.left = left + "px";
  }, 0);

  const closeMenu = () => closeAllContextMenus();
  setTimeout(() => {
    document.addEventListener("click", closeMenu, { once: true });
    document.addEventListener("scroll", closeMenu, { once: true, capture: true });
  }, 10);
}

function editReflection(id) {
  const reflections = getReflections();
  const index = reflections.findIndex((r) => r.id === id);
  if (index > -1) {
    const refInput = document.getElementById("reflectionInput");
    if (refInput) {
      refInput.value = reflections[index].text;
      refInput.focus();
      refInput.scrollIntoView({ behavior: "smooth", block: "center" });

      reflectionHistory = [];
      reflectionHistoryIndex = -1;
      saveReflectionState(reflections[index].text);
    }
    editingReflectionId = id;
    const btn = document.getElementById("saveReflectionBtn");
    if (btn) btn.textContent = "Update Reflection";
  }
}

function getStorageKey() {
  return `article_${currentState.category}_${currentState.subtopic}_${currentState.article}`;
}
function getAnnotations() {
  return JSON.parse(
    localStorage.getItem(getStorageKey() + "_annotations") || "[]",
  );
}
function saveAnnotations(data) {
  localStorage.setItem(getStorageKey() + "_annotations", JSON.stringify(data));
  triggerAutoSync();
}
function deleteAnnotation(id) {
  const anns = getAnnotations();
  const annToDelete = anns.find((a) => a.id === id);

  if (annToDelete) {
    userLearningJourney.timeline = userLearningJourney.timeline.filter((t) => {
      const isMatch =
        (t.type === "Highlight" ||
          t.type === "Note" ||
          t.type === "Bookmark") &&
        t.domain === currentState.category &&
        t.article === currentState.article &&
        t.text &&
        t.text.includes(annToDelete.text);
      return !isMatch;
    });
    saveJourneyData();
  }

  saveAnnotations(anns.filter((a) => a.id !== id));
  loadAnnotations();
  showToast("Annotation deleted");
}
function getReflections() {
  return JSON.parse(
    localStorage.getItem(getStorageKey() + "_reflections") || "[]",
  );
}
function saveReflections(data) {
  localStorage.setItem(getStorageKey() + "_reflections", JSON.stringify(data));
  triggerAutoSync();
}
function deleteReflection(id) {
  const refs = getReflections();
  const refToDelete = refs.find((r) => r.id === id);

  if (refToDelete) {
    userLearningJourney.timeline = userLearningJourney.timeline.filter((t) => {
      const isMatch =
        t.type === "Reflection" &&
        t.domain === currentState.category &&
        t.article === currentState.article &&
        t.text &&
        (t.text === refToDelete.text || t.text.endsWith(refToDelete.text));
      return !isMatch;
    });
    saveJourneyData();
  }

  saveReflections(refs.filter((r) => r.id !== id));
  loadReflections();
  showToast("Reflection deleted");
}

// ============================================================
// MULTI-SELECT LOGIC (Highlights, Reflections, Timeline)
// ============================================================
function setupMultiSelect(el, id, type) {
  el.classList.add("ms-selectable");
  el._msSelect = () => {
    if (!selectedItems[type].has(id)) {
      selectedItems[type].add(id);
      el.classList.add("selected");
    }
  };
  el._msDeselect = () => {
    if (selectedItems[type].has(id)) {
      selectedItems[type].delete(id);
      el.classList.remove("selected");
    }
  };

  let isMoved = false;
  let justActivated = false;

  const startPress = (e) => {
    if (e.target.closest("button")) return;
    isMoved = false;
    longPressTimer = setTimeout(() => {
      if (!multiSelectMode && !isMoved) {
        multiSelectMode = true;
        justActivated = true;
        document.body.classList.add("multi-select-active");
        toggleSelection(el, id, type);
        showMultiSelectToolbar();
        if (navigator.vibrate) navigator.vibrate(50);
        setTimeout(() => {
          justActivated = false;
        }, 400);
      }
    }, 500);
  };

  const cancelPress = () => clearTimeout(longPressTimer);
  const movePress = () => {
    isMoved = true;
    clearTimeout(longPressTimer);
  };

  el.addEventListener("mousedown", startPress);
  el.addEventListener("touchstart", startPress, { passive: true });
  el.addEventListener("mouseup", cancelPress);
  el.addEventListener("mouseleave", cancelPress);
  el.addEventListener("touchend", cancelPress);
  el.addEventListener("touchmove", movePress, { passive: true });

  el.addEventListener(
    "click",
    (e) => {
      if (e.target.closest("button")) return;

      if (justActivated) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (multiSelectMode) {
        e.preventDefault();
        e.stopPropagation();
        toggleSelection(el, id, type);
      }
    },
    true,
  );
}

function toggleSelection(el, id, type) {
  const set = selectedItems[type];
  if (set.has(id)) {
    set.delete(id);
    el.classList.remove("selected");
  } else {
    set.add(id);
    el.classList.add("selected");
  }
  updateMultiSelectToolbar();
}

function showMultiSelectToolbar() {
  let tb = document.getElementById("multiSelectToolbar");
  if (!tb) {
    tb = document.createElement("div");
    tb.id = "multiSelectToolbar";
    tb.className = "multi-select-toolbar";
    tb.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;">
        <span id="multiSelectCount" style="font-weight: bold; font-size: 0.95rem; color: var(--dark-text);">1 Selected</span>
        <button id="multiSelectAll" class="text-btn" style="color:var(--accent);font-size:0.85rem;padding:0;">Select All</button>
      </div>
      <div style="display:flex;gap:10px;">
        <button id="multiSelectCancel" class="secondary btn-sm">Cancel</button>
        <button id="multiSelectDelete" class="btn-danger btn-sm">Delete</button>
      </div>
    `;
    document.body.appendChild(tb);
    document
      .getElementById("multiSelectCancel")
      .addEventListener("click", cancelMultiSelect);
    document
      .getElementById("multiSelectDelete")
      .addEventListener("click", deleteSelectedItems);
    document
      .getElementById("multiSelectAll")
      .addEventListener("click", selectAllItems);
  }
  setTimeout(() => tb.classList.add("show"), 10);
}

function selectAllItems() {
  const drawer = document.getElementById("notesSection");
  const isDrawerOpen = drawer && drawer.classList.contains("open");
  const container = isDrawerOpen
    ? drawer
    : document.querySelector(".view.active");

  if (!container) return;

  let visibleItems = Array.from(container.querySelectorAll(".ms-selectable"));

  const allSelected =
    visibleItems.length > 0 &&
    visibleItems.every((el) => el.classList.contains("selected"));

  visibleItems.forEach((el) => {
    if (allSelected) {
      if (el._msDeselect) el._msDeselect();
    } else {
      if (el._msSelect) el._msSelect();
    }
  });

  updateMultiSelectToolbar();
}

function updateMultiSelectToolbar() {
  const count =
    selectedItems.annotation.size +
    selectedItems.reflection.size +
    selectedItems.timeline.size;
  const countEl = document.getElementById("multiSelectCount");
  if (countEl) countEl.textContent = `${count} Selected`;

  const selectAllBtn = document.getElementById("multiSelectAll");
  if (selectAllBtn) {
    const drawer = document.getElementById("notesSection");
    const isDrawerOpen = drawer && drawer.classList.contains("open");
    const container = isDrawerOpen
      ? drawer
      : document.querySelector(".view.active");

    let visibleCount = 0;
    let selectedVisibleCount = 0;
    if (container) {
      container.querySelectorAll(".ms-selectable").forEach((el) => {
        visibleCount++;
        if (el.classList.contains("selected")) selectedVisibleCount++;
      });
    }
    selectAllBtn.textContent =
      visibleCount > 0 && visibleCount === selectedVisibleCount
        ? "Deselect All"
        : "Select All";
  }

  if (count === 0) cancelMultiSelect();
}

function cancelMultiSelect() {
  multiSelectMode = false;
  document.body.classList.remove("multi-select-active");
  selectedItems.annotation.clear();
  selectedItems.reflection.clear();
  selectedItems.timeline.clear();

  document
    .querySelectorAll(".annotation-item.selected, .timeline-item.selected")
    .forEach((el) => {
      el.classList.remove("selected");
    });

  const tb = document.getElementById("multiSelectToolbar");
  if (tb) tb.classList.remove("show");
}

function deleteSelectedItems() {
  const count =
    selectedItems.annotation.size +
    selectedItems.reflection.size +
    selectedItems.timeline.size;
  if (count === 0) return;

  if (confirm(`Delete ${count} selected item${count !== 1 ? "s" : ""}?`)) {
    let needsArticleRender = false;
    let needsTimelineRender = false;

    if (selectedItems.annotation.size > 0) {
      let anns = getAnnotations();
      anns.forEach((a) => {
        if (selectedItems.annotation.has(a.id)) {
          userLearningJourney.timeline = userLearningJourney.timeline.filter(
            (t) =>
              !(
                (t.type === "Highlight" ||
                  t.type === "Note" ||
                  t.type === "Bookmark") &&
                t.domain === currentState.category &&
                t.article === currentState.article &&
                t.text &&
                t.text.includes(a.text)
              ),
          );
        }
      });
      saveJourneyData();
      anns = anns.filter((a) => !selectedItems.annotation.has(a.id));
      saveAnnotations(anns);
      needsArticleRender = true;
    }

    if (selectedItems.reflection.size > 0) {
      let refs = getReflections();
      refs.forEach((r) => {
        if (selectedItems.reflection.has(r.id)) {
          userLearningJourney.timeline = userLearningJourney.timeline.filter(
            (t) =>
              !(
                t.type === "Reflection" &&
                t.domain === currentState.category &&
                t.article === currentState.article &&
                t.text &&
                (t.text === r.text || t.text.endsWith(r.text))
              ),
          );
        }
      });
      saveJourneyData();
      refs = refs.filter((r) => !selectedItems.reflection.has(r.id));
      saveReflections(refs);
      loadReflections();
    }

    if (selectedItems.timeline.size > 0) {
      userLearningJourney.timeline.forEach((t) => {
        if (selectedItems.timeline.has(t.date) && t.type === "Read") {
          const dData = userLearningJourney.topics[t.domain];
          if (dData && dData.readArticles) {
            const idx = dData.readArticles.indexOf(t.article);
            if (idx > -1) {
              dData.readArticles.splice(idx, 1);
              dData.articlesEngaged = Math.max(0, dData.articlesEngaged - 1);
            }
          }
        }
      });
      userLearningJourney.timeline = userLearningJourney.timeline.filter(
        (t) => !selectedItems.timeline.has(t.date),
      );
      saveJourneyData();
      needsTimelineRender = true;
      renderHeatmap();
    }

    cancelMultiSelect();

    if (needsArticleRender && currentState.view === "article") {
      renderArticleContent();
    } else if (selectedItems.annotation.size > 0) {
      loadAnnotations();
    }

    if (needsTimelineRender && currentState.view === "timeline") {
      const activeFilter = document.querySelector(
        ".timeline-filter-btn.active",
      );
      renderTimeline(activeFilter ? activeFilter.dataset.filter : "All");
    }

    showToast(`${count} item${count !== 1 ? "s" : ""} deleted.`);
  }
}

// ============================================================
// SEARCH
// ============================================================
function setupSearch() {
  const input = document.getElementById("globalSearch");
  const header = document.querySelector(".top-app-bar");
  const resultsDiv = document.getElementById("searchResults");

  input.addEventListener("focus", () => {
    header.classList.add("search-active");
    if (input.value.trim().length >= 2) resultsDiv.style.display = "flex";
  });

  document.addEventListener("mousedown", (e) => {
    const searchContainer = document.querySelector(".search-container");
    if (searchContainer && !searchContainer.contains(e.target)) {
      resultsDiv.style.display = "none";
      if (!input.value) header.classList.remove("search-active");
    }
  });

  input.addEventListener("input", (e) => {
    const query = e.target.value.toLowerCase().trim();
    if (query.length < 2) {
      resultsDiv.style.display = "none";
      return;
    }

    const results = [];
    Object.keys(window.topicsData || {}).forEach((d) => {
      Object.keys(window.topicsData[d].subtopics).forEach((s) => {
        Object.keys(window.topicsData[d].subtopics[s].articles).forEach((a) => {
          const art = window.topicsData[d].subtopics[s].articles[a] || {};
          const content = art.content || "";
          const author = art.author || "";
          const genres = Array.isArray(art.genres) ? art.genres.join(" ") : "";
          if (
            a.toLowerCase().includes(query) ||
            content.toLowerCase().includes(query) ||
            author.toLowerCase().includes(query) ||
            genres.toLowerCase().includes(query)
          ) {
            results.push({ d, s, a });
          }
        });
      });
    });

    resultsDiv.style.display = "flex";
    resultsDiv.innerHTML =
      results.length === 0
        ? '<div style="padding:10px;font-size:0.8rem;">No results.</div>'
        : "";
    results.slice(0, 8).forEach((res) => {
      const item = document.createElement("div");
      item.style.cssText =
        "padding:10px;border-bottom:1px solid var(--glass-border);cursor:pointer;";
      item.innerHTML = `<div style="font-weight:bold;color:var(--accent);font-size:0.9rem;">${res.a}</div><div style="font-size:0.75rem;color:var(--subtitle-color);">${res.d}</div>`;
      item.onclick = () => {
        currentState.mode = "explore";
        const header = document.querySelector(".top-app-bar");
        document.getElementById("globalSearch").value = "";
        header.classList.remove("search-active");
        resultsDiv.style.display = "none";
        navigateToArticle(res.d, res.s, res.a);
      };
      resultsDiv.appendChild(item);
    });
  });
}

// ============================================================
// PRINCIPLE LIBRARY
// ============================================================

// Principle Library Data Management
function getPrinciples() {
  const stored = localStorage.getItem("osmosis_principles");
  return stored ? JSON.parse(stored) : [];
}

function savePrinciples(principles) {
  localStorage.setItem("osmosis_principles", JSON.stringify(principles));
  updatePrincipleStats();
}

function createPrinciple(statement, explanation = "") {
  const principles = getPrinciples();
  const newPrinciple = {
    id: "principle_" + Date.now(),
    statement,
    explanation,
    createdDate: new Date().toISOString().split("T")[0],
    lastUpdatedDate: new Date().toISOString().split("T")[0],
    evidence: [],
    evolution: [
      {
        date: new Date().toISOString().split("T")[0],
        statementVersion: statement,
        change: "Created"
      }
    ]
  };
  principles.push(newPrinciple);
  savePrinciples(principles);
  return newPrinciple;
}

function getPrinciple(id) {
  return getPrinciples().find(p => p.id === id);
}

function updatePrinciple(id, statement, explanation) {
  const principles = getPrinciples();
  const principle = principles.find(p => p.id === id);
  if (!principle) return;

  if (principle.statement !== statement) {
    principle.evolution.push({
      date: new Date().toISOString().split("T")[0],
      statementVersion: statement,
      change: "Updated statement"
    });
  }

  principle.statement = statement;
  principle.explanation = explanation;
  principle.lastUpdatedDate = new Date().toISOString().split("T")[0];
  savePrinciples(principles);
}

function deletePrinciple(id) {
  const principles = getPrinciples().filter(p => p.id !== id);
  savePrinciples(principles);
  updatePrincipleStats();
}

function addEvidence(principleId, quote) {
  const principles = getPrinciples();
  const principle = principles.find(p => p.id === principleId);
  if (!principle) return;

  const newEvidence = {
    id: "evidence_" + Date.now(),
    quote,
    dateAdded: new Date().toISOString().split("T")[0]
  };
  principle.evidence.push(newEvidence);
  principle.lastUpdatedDate = new Date().toISOString().split("T")[0];
  savePrinciples(principles);
  updatePrincipleStats();
  return newEvidence;
}

function removeEvidence(principleId, evidenceId) {
  const principles = getPrinciples();
  const principle = principles.find(p => p.id === principleId);
  if (!principle) return;

  principle.evidence = principle.evidence.filter(e => e.id !== evidenceId);
  principle.lastUpdatedDate = new Date().toISOString().split("T")[0];
  savePrinciples(principles);
  updatePrincipleStats();
}

function updatePrincipleStats() {
  const principles = getPrinciples();
  const totalStories = principles.reduce((sum, p) => sum + p.evidence.length, 0);
  const maxEvidence = Math.max(0, ...principles.map(p => p.evidence.length));

  const totalPrinciplesEl = document.getElementById("totalPrinciples");
  const totalStoriesEl = document.getElementById("totalStories");
  const maxEvidenceEl = document.getElementById("mostEvIdencedCount");

  if (totalPrinciplesEl) totalPrinciplesEl.textContent = principles.length;
  if (totalStoriesEl) totalStoriesEl.textContent = totalStories;
  if (maxEvidenceEl) maxEvidenceEl.textContent = maxEvidence;
}

let currentPrincipleId = null;

function renderPrinciplesList() {
  const principles = getPrinciples();
  const list = document.getElementById("principlesList");
  const searchTerm = (document.getElementById("principleSearchInput")?.value || "").toLowerCase();
  const filterType = document.getElementById("principleFilterSelect")?.value || "all";

  // Apply search and filter
  let filtered = principles.filter(p => {
    const matchesSearch = p.statement.toLowerCase().includes(searchTerm);
    const matchesFilter = filterType === "all" ||
      (filterType === "with-evidence" && p.evidence.length > 0) ||
      (filterType === "needs-evidence" && p.evidence.length === 0);
    return matchesSearch && matchesFilter;
  });

  if (principles.length === 0) {
    list.innerHTML = `<div style="text-align: center; padding: 64px 24px; color: var(--subtitle-color);">
      <div style="font-size: 4rem; margin-bottom: 16px; opacity: 0.2;">→</div>
      <p style="font-size: 1.1rem; margin: 0; font-weight: 600; color: var(--dark-text);">Start Building</p>
      <p style="font-size: 0.9rem; margin: 12px 0 20px 0; line-height: 1.5;">Create your first principle by clicking "+ New" above. A principle is a one-sentence statement of what you believe in.</p>
      <div style="font-size: 0.85rem; background: var(--glass-solid); border: 1px solid var(--glass-border); border-radius: 12px; padding: 16px; text-align: left; display: inline-block; max-width: 300px;">
        <p style="margin: 0 0 8px 0; font-weight: 600;">Example:</p>
        <p style="margin: 0 0 8px 0; font-style: italic; color: var(--dark-text);">Growth requires vulnerability</p>
        <p style="margin: 0; font-size: 0.8rem; color: var(--subtitle-color);">Then add supporting stories as evidence.</p>
      </div>
    </div>`;
    return;
  }

  if (filtered.length === 0) {
    list.innerHTML = `<div style="text-align: center; padding: 48px 24px; color: var(--subtitle-color);">
      <p style="font-size: 0.95rem; margin: 0;">No principles match your search</p>
    </div>`;
    return;
  }

  list.innerHTML = filtered.map(principle => {
    const progressPercent = Math.min((principle.evidence.length / 3) * 100, 100); // Target of 3 evidence items
    const snippet = principle.evidence.length > 0 ? principle.evidence[0].quote.substring(0, 60) + (principle.evidence[0].quote.length > 60 ? '...' : '') : '';

    return `
    <div style="padding: 16px; background: var(--glass-solid); border: 1px solid var(--glass-border); border-radius: 12px; transition: all 0.2s ease; position: relative; group" onmouseover="this.style.borderColor='var(--accent)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.1)'" onmouseout="this.style.borderColor='var(--glass-border)'; this.style.boxShadow='none'">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 12px;">
        <div style="flex: 1; min-width: 0; cursor: pointer;" onclick="selectPrinciple('${principle.id}')">
          <p style="margin: 0 0 8px 0; font-size: 1rem; font-weight: 600; line-height: 1.4; color: var(--dark-text);">${principle.statement}</p>
        </div>
        <div style="flex-shrink: 0; display: flex; gap: 6px; opacity: 0; transition: opacity 0.2s;" id="actions-${principle.id}">
          <button onclick="showAddEvidenceModal('${principle.id}')" style="background: none; border: none; padding: 4px 6px; cursor: pointer; color: var(--subtitle-color); font-size: 0.85rem;" title="Add evidence">+</button>
          <button onclick="editPrincipleHandler('${principle.id}')" style="background: none; border: none; padding: 4px 6px; cursor: pointer; color: var(--subtitle-color); font-size: 0.9rem;" title="Edit">✎</button>
          <button onclick="deletePrincipleHandler('${principle.id}')" style="background: none; border: none; padding: 4px 6px; cursor: pointer; color: #e74c3c; font-size: 0.9rem;" title="Delete">×</button>
        </div>
      </div>

      <div style="height: 4px; background: var(--glass-border); border-radius: 2px; margin-bottom: 8px; overflow: hidden;">
        <div style="height: 100%; background: linear-gradient(90deg, var(--accent), #6b8e6f); width: ${progressPercent}%; transition: width 0.3s ease;"></div>
      </div>

      <div style="font-size: 0.85rem; color: var(--subtitle-color); display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
        <span>${principle.evidence.length} ${principle.evidence.length === 1 ? 'story' : 'stories'}</span>
      </div>

      ${snippet ? `<p style="margin: 0; font-size: 0.8rem; color: var(--subtitle-color); font-style: italic; opacity: 0.8; line-height: 1.3;">"${snippet}"</p>` : ''}
    </div>
  `}).join("");

  // Re-attach hover effects
  filtered.forEach(principle => {
    const card = list.querySelector(`[onmouseover*="${principle.id}"]`)?.parentElement;
    if (card) {
      const actionsDiv = card.querySelector(`#actions-${principle.id}`);
      if (actionsDiv) {
        card.onmouseenter = () => { actionsDiv.style.opacity = '1'; };
        card.onmouseleave = () => { actionsDiv.style.opacity = '0'; };
      }
    }
  });
}

function selectPrinciple(id) {
  currentPrincipleId = id;
  renderPrincipleDetail(id);
}

function backToPrincipleList() {
  currentPrincipleId = null;
  renderPrincipleLibraryView();
}

function renderPrincipleDetail(id) {
  const principle = getPrinciple(id);
  if (!principle) return;

  const container = document.getElementById("principleDetail");
  if (!container) return;

  const romanNumerals = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV"];
  const principleNum = romanNumerals[getPrinciples().findIndex(p => p.id === id)] || "";

  let evidenceHTML = principle.evidence.length === 0
    ? `<div style="color: var(--subtitle-color); font-style: italic; margin: 16px 0;">No supporting stories yet</div>`
    : principle.evidence.map(evidence => `
      <div class="evidence-item">
        <div class="evidence-quote">"${evidence.quote}"</div>
        <div class="evidence-meta">
          <span>Added: ${evidence.dateAdded}</span>
          <button onclick="removeEvidenceHandler('${principle.id}', '${evidence.id}')" class="text-btn" style="padding: 0; color: #999; font-size: 0.8rem;">Remove</button>
        </div>
      </div>
    `).join("");

  let evolutionHTML = principle.evolution.length === 0
    ? `<div style="color: var(--subtitle-color); font-style: italic; margin: 16px 0;">No evolution history yet</div>`
    : `<div class="evolution-timeline">
        ${principle.evolution.map(entry => `
          <div class="evolution-entry">
            <div class="evolution-date">${entry.date}</div>
            <div class="evolution-text">${entry.statementVersion}</div>
            ${entry.change ? `<div style="font-size: 0.85rem; color: var(--subtitle-color); margin-top: 4px; font-style: italic;">${entry.change}</div>` : ""}
          </div>
        `).join("")}
      </div>`;

  container.innerHTML = `
    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 28px;">
      <button onclick="backToPrincipleList()" style="background: none; border: none; font-size: 1.2rem; cursor: pointer; color: var(--subtitle-color); padding: 8px;">←</button>
      <h2 style="margin: 0; flex: 1;">Principle Library</h2>
    </div>

    <h3 style="margin: 0 0 16px 0; font-size: 1.4rem; line-height: 1.4; color: var(--dark-text);">${principle.statement}</h3>

    <div style="font-size: 0.85rem; color: var(--subtitle-color); margin-bottom: 24px; display: flex; gap: 12px; flex-wrap: wrap;">
      <span>Created ${principle.createdDate}</span>
      <span style="opacity: 0.5;">•</span>
      <span>Updated ${principle.lastUpdatedDate}</span>
    </div>

    ${principle.explanation ? `
      <div style="padding: 16px; background: var(--glass-solid); border: 1px solid var(--glass-border); border-radius: 12px; margin-bottom: 28px;">
        <p style="margin: 0; color: var(--dark-text); line-height: 1.6; font-size: 0.95rem;">${principle.explanation}</p>
      </div>
    ` : ""}

    <div style="margin-bottom: 28px;">
      <h4 style="margin: 0 0 12px 0; font-size: 1rem; font-weight: 600;">Supporting Evidence (${principle.evidence.length})</h4>
      ${evidenceHTML}
      <button onclick="showAddEvidenceModal('${principle.id}')" class="secondary" style="width: 100%; margin-top: 12px; padding: 12px;">
        + Add Story
      </button>
    </div>

    ${principle.evolution.length > 0 ? `
      <div style="margin-bottom: 28px;">
        <h4 style="margin: 0 0 12px 0; font-size: 1rem; font-weight: 600;">Evolution</h4>
        ${evolutionHTML}
      </div>
    ` : ""}

    <div style="display: flex; gap: 12px; padding-top: 20px; border-top: 1px solid var(--glass-border);">
      <button onclick="editPrincipleHandler('${principle.id}')" class="secondary" style="flex: 1; padding: 12px;">Edit</button>
      <button onclick="deletePrincipleHandler('${principle.id}')" class="secondary" style="flex: 1; padding: 12px; color: #e74c3c;">Delete</button>
    </div>
  `;
}

function showAddEvidenceModal(principleId) {
  currentPrincipleId = principleId;
  document.getElementById("addEvidenceModal").classList.add("active");
  document.getElementById("evidenceQuoteInput").value = "";

  // Populate available stories from timeline
  const timeline = userLearningJourney.timeline || [];
  const recentStories = timeline
    .filter(item => ["Highlight", "Note", "Bookmark", "Reflection"].includes(item.type))
    .slice(-15) // Last 15 items
    .reverse(); // Most recent first

  const storiesList = document.getElementById("availableStoriesList");
  if (recentStories.length === 0) {
    storiesList.innerHTML = `<div style="padding: 12px; text-align: center; color: var(--subtitle-color); font-size: 0.9rem;">No stories yet. Create highlights or reflections in articles first.</div>`;
  } else {
    storiesList.innerHTML = recentStories.map(item => {
      const preview = item.text.substring(0, 80) + (item.text.length > 80 ? '...' : '');
      return `
        <div onclick="useStoryAsEvidence('${item.text.replace(/'/g, "\\'")}', '${principleId}')" style="padding: 12px; background: var(--glass-solid); border: 1px solid var(--glass-border); border-radius: 8px; cursor: pointer; transition: all 0.2s; font-size: 0.9rem; line-height: 1.4;" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--glass-border)'">
          <div style="font-weight: 600; font-size: 0.8rem; color: var(--subtitle-color); margin-bottom: 4px; text-transform: uppercase;">${item.type}</div>
          <div style="color: var(--dark-text);">${preview}</div>
        </div>
      `;
    }).join("");
  }

  document.getElementById("saveEvidenceBtn").onclick = () => {
    const quote = document.getElementById("evidenceQuoteInput").value.trim();
    if (!quote) {
      showToast("Please enter a quote or select a story");
      return;
    }
    addEvidence(principleId, quote);
    document.getElementById("addEvidenceModal").classList.remove("active");
    renderPrincipleDetail(principleId);
    showToast("Evidence added");
  };
}

function useStoryAsEvidence(text, principleId) {
  document.getElementById("evidenceQuoteInput").value = text;
  showToast("Story added to input. Click 'Add Evidence' to confirm.");
}

function copyToClipboard(text) {
  if (!text || text.length === 0) {
    showToast("Nothing to copy");
    return;
  }

  navigator.clipboard.writeText(text).then(() => {
    showToast("Copied to clipboard");
  }).catch(() => {
    showToast("Could not copy to clipboard");
  });
}

function pasteFromClipboard(searchInputId) {
  navigator.clipboard.readText().then(text => {
    const input = document.getElementById(searchInputId);
    if (input) {
      input.value = text.trim();
      input.focus();
      showToast("Pasted");
    }
  }).catch(() => {
    showToast("Could not access clipboard");
  });
}

function removeEvidenceHandler(principleId, evidenceId) {
  if (confirm("Remove this story as evidence?")) {
    removeEvidence(principleId, evidenceId);
    renderPrincipleDetail(principleId);
  }
}

function editPrincipleHandler(id) {
  const principle = getPrinciple(id);
  if (!principle) return;

  const modal = document.getElementById("newPrincipleModal");
  document.getElementById("principleModalTitle").textContent = "Edit Principle";
  document.getElementById("principleStatementInput").value = principle.statement;
  document.getElementById("principleExplanationInput").value = principle.explanation;
  document.getElementById("savePrincipleBtn").textContent = "Save Changes";
  document.getElementById("savePrincipleBtn").onclick = () => {
    const statement = document.getElementById("principleStatementInput").value.trim();
    const explanation = document.getElementById("principleExplanationInput").value.trim();
    if (!statement) {
      showToast("Principle statement is required");
      return;
    }
    updatePrinciple(id, statement, explanation);
    modal.style.display = "none";
    renderPrinciplesList();
    renderPrincipleDetail(id);
    showToast("Principle updated");
  };
  modal.style.display = "flex";
}

function deletePrincipleHandler(id) {
  if (confirm("Delete this principle? This action cannot be undone.")) {
    deletePrinciple(id);
    currentPrincipleId = null;
    document.getElementById("principleEmptyState").style.display = "block";
    document.getElementById("principleDetailView").style.display = "none";
    renderPrinciplesList();
    showToast("Principle deleted");
  }
}

function generateManifesto() {
  const principles = getPrinciples();
  if (principles.length === 0) {
    showToast("Create principles first");
    return "";
  }

  const romanNumerals = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV"];

  let html = `
    <div class="manifesto-preview">
      <div class="manifesto-title">My Personal Manifesto</div>
      <div class="manifesto-subtitle">Distilled wisdom from stories, reflections, and lived experience</div>
      ${principles.map((principle, idx) => `
        <div class="manifesto-principle">
          <div class="manifesto-number">${romanNumerals[idx] || (idx + 1)}.</div>
          <div class="manifesto-statement">${principle.statement}</div>
          ${principle.explanation ? `<div class="manifesto-explanation">${principle.explanation}</div>` : ""}
          ${principle.evidence.length > 0 ? `
            <div class="manifesto-evidence-heading">Supporting Stories</div>
            <div class="manifesto-evidence-list">
              ${principle.evidence.map(e => `<div class="manifesto-evidence-item">• ${e.quote}</div>`).join("")}
            </div>
          ` : ""}
        </div>
      `).join("")}
    </div>
  `;

  return html;
}

// JOURNEY PAGE COLLAPSIBLE CARDS

// Close journey detail with Escape key
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const detailView = document.getElementById("journeyCardDetailView");
    if (detailView && detailView.style.display !== "none") {
      closeJourneyDetail();
    }
  }
});

// Swipe to close journey detail and articles
let touchStartX = 0;
let touchStartY = 0;

document.addEventListener("touchstart", (e) => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}, { passive: true });

document.addEventListener("touchend", (e) => {
  const touchEndX = e.changedTouches[0].clientX;
  const touchEndY = e.changedTouches[0].clientY;

  const isLeftSide = touchStartX < 60;
  const isRightSwipe = touchEndX - touchStartX > 50;
  const isNotVerticalScroll = Math.abs(touchEndY - touchStartY) < Math.abs(touchEndX - touchStartX);

  if (isLeftSide && isRightSwipe && isNotVerticalScroll) {
    // Try closing journey detail first
    const detailView = document.getElementById("journeyCardDetailView");
    if (detailView && detailView.style.display !== "none") {
      closeJourneyDetail();
      return;
    }

    // Try going back from article view
    const articleView = document.getElementById("articleView");
    if (articleView && articleView.classList.contains("active")) {
      const backBtn = document.getElementById("backToPrevious");
      if (backBtn) {
        backBtn.click();
      }
    }
  }
}, { passive: true });

function renderPrincipleLibraryView() {
  const container = document.getElementById("principleDetail");
  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; gap: 12px;">
      <div style="flex: 1;">
        <h2 style="margin: 0 0 4px 0; font-size: 2rem;">Principles</h2>
        <p style="margin: 0; color: var(--subtitle-color); font-size: 0.9rem;">Build your personal philosophy</p>
      </div>
      <button id="newPrincipleBtn" class="primary" style="padding: 10px 20px; font-size: 0.85rem; font-weight: 600; white-space: nowrap;">+ New</button>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 24px;">
      <div style="padding: 14px; background: var(--glass-solid); border: 1px solid var(--glass-border); border-radius: 12px;">
        <div style="font-size: 1.8em; font-weight: bold; color: #d4735c;" id="totalPrinciples">0</div>
        <div style="font-size: 0.65rem; color: var(--subtitle-color); text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; font-weight: 600;">Total</div>
      </div>
      <div style="padding: 14px; background: var(--glass-solid); border: 1px solid var(--glass-border); border-radius: 12px;">
        <div style="font-size: 1.8em; font-weight: bold; color: #6b8e6f;" id="totalStories">0</div>
        <div style="font-size: 0.65rem; color: var(--subtitle-color); text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; font-weight: 600;">Evidence</div>
      </div>
      <div style="padding: 14px; background: var(--glass-solid); border: 1px solid var(--glass-border); border-radius: 12px;">
        <div style="font-size: 1.8em; font-weight: bold; color: var(--accent);" id="mostEvIdencedCount">0</div>
        <div style="font-size: 0.65rem; color: var(--subtitle-color); text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; font-weight: 600;">Max Evidence</div>
      </div>
    </div>

    <div style="display: flex; gap: 12px; margin-bottom: 24px;">
      <input type="text" id="principleSearchInput" placeholder="Search principles..." style="flex: 1; padding: 10px 14px; background: var(--glass-solid); border: 1px solid var(--glass-border); border-radius: 12px; font-size: 0.9rem; outline: none; color: var(--dark-text);">
      <select id="principleFilterSelect" style="padding: 10px 14px; background: var(--glass-solid); border: 1px solid var(--glass-border); border-radius: 12px; font-size: 0.9rem; outline: none; color: var(--dark-text); min-width: 140px; flex-shrink: 0;">
        <option value="all">All</option>
        <option value="with-evidence">With Evidence</option>
        <option value="needs-evidence">Empty</option>
      </select>
    </div>

    <div id="principlesList" style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 40px;"></div>

    <div style="border-top: 1px solid var(--glass-border); padding-top: 28px;">
      <h3 style="margin: 0 0 12px 0; font-size: 1.2rem;">Export Manifesto</h3>
      <p style="color: var(--subtitle-color); margin-bottom: 16px; font-size: 0.9rem; line-height: 1.5;">Synthesize your principles into a personal manifesto you can share and evolve.</p>
      <button id="exportManifestoBtn" class="primary" style="padding: 12px 24px;">Preview & Export</button>
      <div id="manifestoPreview" style="display: none; margin-top: 20px; padding: 20px; background: var(--glass-solid); border: 1px solid var(--glass-border); border-radius: 12px; max-height: 500px; overflow-y: auto; font-family: Georgia, serif; line-height: 1.7; font-size: 0.95rem;"></div>
    </div>
  `;

  // Re-initialize principle library UI
  updatePrincipleStats();
  renderPrinciplesList();

  // Re-attach event listeners
  const newPrincipleBtn = document.getElementById("newPrincipleBtn");
  if (newPrincipleBtn) {
    newPrincipleBtn.onclick = () => {
      const modal = document.getElementById("newPrincipleModal");
      document.getElementById("principleModalTitle").textContent = "Create New Principle";
      document.getElementById("principleStatementInput").value = "";
      document.getElementById("principleExplanationInput").value = "";
      document.getElementById("savePrincipleBtn").textContent = "Create Principle";
      modal.classList.add("active");
      document.getElementById("savePrincipleBtn").onclick = () => {
        const statement = document.getElementById("principleStatementInput").value.trim();
        const explanation = document.getElementById("principleExplanationInput").value.trim();
        if (!statement) {
          showToast("Principle statement is required");
          return;
        }
        createPrinciple(statement, explanation);
        modal.classList.remove("active");
        renderPrinciplesList();
        showToast("Principle created");
      };
      modal.style.display = "flex";
    };
  }

  const exportBtn = document.getElementById("exportManifestoBtn");
  if (exportBtn) {
    exportBtn.onclick = () => {
      const preview = document.getElementById("manifestoPreview");
      preview.innerHTML = generateManifesto();
      preview.style.display = preview.style.display === "none" ? "block" : "none";
    };
  }

  // Setup search and filter listeners
  const searchInput = document.getElementById("principleSearchInput");
  const filterSelect = document.getElementById("principleFilterSelect");

  if (searchInput) {
    searchInput.oninput = () => renderPrinciplesList();
  }

  if (filterSelect) {
    filterSelect.onchange = () => renderPrinciplesList();
  }
}

function initializePrincipleLibrary() {
  // Sample principles if none exist
  if (getPrinciples().length === 0) {
    createPrinciple("Wisdom is knowing which battles matter", "True strength isn't dominance. It's wisdom—knowing which fights are worth fighting, when to stand firm, and when to yield.");
    createPrinciple("Growth requires vulnerability", "The willingness to be wrong, to learn, to change—this is not weakness. It's the foundation of all meaningful development.");
    createPrinciple("Small consistent actions compound over time", "What matters is not the grand gesture but the daily practice. Tiny choices, repeated with intention, reshape who we become.");
  }

  updatePrincipleStats();
  renderPrinciplesList();

  // Setup event listeners
  const newPrincipleBtn = document.getElementById("newPrincipleBtn");
  if (newPrincipleBtn) {
    newPrincipleBtn.onclick = () => {
      const modal = document.getElementById("newPrincipleModal");
      document.getElementById("principleModalTitle").textContent = "Create New Principle";
      document.getElementById("principleStatementInput").value = "";
      document.getElementById("principleExplanationInput").value = "";
      document.getElementById("savePrincipleBtn").textContent = "Create Principle";
      modal.classList.add("active");
      document.getElementById("savePrincipleBtn").onclick = () => {
        const statement = document.getElementById("principleStatementInput").value.trim();
        const explanation = document.getElementById("principleExplanationInput").value.trim();
        if (!statement) {
          showToast("Principle statement is required");
          return;
        }
        createPrinciple(statement, explanation);
        modal.classList.remove("active");
        renderPrinciplesList();
        showToast("Principle created");
      };
      modal.style.display = "flex";
    };
  }

  const exportBtn = document.getElementById("exportManifestoBtn");
  if (exportBtn) {
    exportBtn.onclick = () => {
      const preview = document.getElementById("manifestoPreview");
      preview.innerHTML = generateManifesto();
      preview.style.display = preview.style.display === "none" ? "block" : "none";
    };
  }
}

// ============================================================
// JOURNEY / DASHBOARD
// ============================================================

// ============================================================
// THE CHRONICLE — a full timeline: Journal / By Story / Anthology
// with an activity-ribbon minimap. Reuses the existing action
// functions (favourite, jump-to-story, context menu, multi-select).
// ============================================================
function _chronEsc(x) {
  return (x == null ? "" : String(x))
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
function _chronAttr(x) {
  return (x == null ? "" : String(x))
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
function _chronTrim(x, n) {
  x = (x || "").replace(/\s+/g, " ").trim();
  return x.length > n ? x.slice(0, n) + "…" : x;
}
function _chronNormalize(item) {
  const txt = item.text || "";
  if (item.type === "note") item.type = "Note";
  if (item.type === "highlight") item.type = "Highlight";
  if (item.type === "bookmark") item.type = "Bookmark";
  if (item.type === "reflection") item.type = "Reflection";
  if (!item.type) {
    if (txt.includes('\n\n"')) item.type = "Note";
    else if (txt.startsWith('"') && txt.endsWith('"')) item.type = "Highlight";
    else item.type = "Reflection";
  } else if (
    (item.type === "Highlight" || item.type === "Annotation") &&
    txt.includes('\n\n"')
  ) {
    item.type = "Note";
  }
}
function _chronParse(item) {
  let text = (item.text || "").replace(/^\[(Path|Capstone):[^\]]*\]\s*/, "");
  const t = item.type || "";
  if ((t === "Note" || t === "Highlight") && text.includes('\n\n"')) {
    const parts = text.split('\n\n"');
    let quote = parts.slice(1).join('\n\n"');
    if (quote.endsWith('"')) quote = quote.slice(0, -1);
    return { quote: quote.trim(), note: parts[0].trim() };
  }
  let str = text.trim();
  const wrapped = str.startsWith('"') && str.endsWith('"');
  if (wrapped) str = str.slice(1, -1).trim();
  if (t === "Highlight" || t === "Bookmark") return { quote: str, note: "" };
  return { quote: wrapped ? str : "", note: wrapped ? "" : str };
}
const _CHRON_GLYPH = {
  Highlight: "❝",
  Note: "✎",
  Reflection: "❦",
  Bookmark: "❧",
  Read: "▪",
  Badge: "✦",
};
function _chronGlyph(t) {
  return _CHRON_GLYPH[t] || "·";
}
const _CHRON_COL = {
  Highlight: "var(--accent)",
  Note: "#5b7a8c",
  Reflection: "#6f8a56",
  Bookmark: "#b0863f",
  Read: "#8a8578",
  Badge: "#b08a3e",
};
function _chronCol(t) {
  return _CHRON_COL[t] || "var(--accent)";
}
function _chronStoryObj(domain, article) {
  const T = window.topicsData || {};
  const tryDom = (d) => {
    const dom = T[d];
    if (!dom) return null;
    for (const sub in dom.subtopics || {}) {
      const a = dom.subtopics[sub].articles && dom.subtopics[sub].articles[article];
      if (a) return a;
    }
    return null;
  };
  const hit = tryDom(domain);
  if (hit) return hit;
  for (const d in T) {
    const a = tryDom(d);
    if (a) return a;
  }
  return null;
}
function _chronEmpty(msg) {
  return `<div class="chron-empty"><div class="chron-empty-mark">❦</div><div>${_chronEsc(msg)}</div></div>`;
}

function renderTimeline(filterType) {
  if (typeof filterType === "string") chronFilter = filterType;
  _wireChronControls();

  const body = document.getElementById("journeyTimeline");
  if (!body) return;

  let items = [...(userLearningJourney.timeline || [])];
  items.forEach(_chronNormalize);
  items.sort((a, b) => new Date(b.date) - new Date(a.date));

  _renderChronSummary(items);
  _renderChronRibbon(items);
  _renderChronFilterCounts(items);

  // search across all
  const q = currentTimelineSearch;
  let view = items;
  if (q) {
    view = view.filter((it) =>
      (
        (it.text || "") +
        " " +
        (it.domain || "") +
        " " +
        (it.article || "")
      )
        .toLowerCase()
        .includes(q),
    );
  }

  const filtersEl = document.getElementById("chronFilters");
  if (filtersEl)
    filtersEl.style.display = chronLens === "journal" ? "flex" : "none";

  if (!items.length) {
    body.innerHTML = _chronEmpty(
      "Your chronicle is empty — read and mark a story to begin it.",
    );
    return;
  }

  if (chronLens === "stories") renderChronStories(body, view);
  else if (chronLens === "patterns") renderChronPatterns(body);
  else renderChronJournal(body, view);
}

function _wireChronControls() {
  const lenses = document.getElementById("chronLenses");
  if (lenses && !lenses.dataset.wired) {
    lenses.dataset.wired = "1";
    lenses.querySelectorAll(".chron-lens").forEach((b) => {
      b.addEventListener("click", () => {
        chronLens = b.dataset.lens;
        lenses
          .querySelectorAll(".chron-lens")
          .forEach((x) => x.classList.toggle("active", x === b));
        const body = document.getElementById("journeyTimeline");
        if (body) {
          body.style.opacity = "0";
          clearTimeout(timelineTransitionTimeout);
          timelineTransitionTimeout = setTimeout(() => {
            renderTimeline();
            body.style.opacity = "1";
          }, 170);
        } else renderTimeline();
      });
    });
  }
  const filters = document.getElementById("chronFilters");
  if (filters && !filters.dataset.wired) {
    filters.dataset.wired = "1";
    filters.querySelectorAll(".chron-filter").forEach((b) => {
      b.addEventListener("click", () => {
        chronFilter = b.dataset.filter;
        filters
          .querySelectorAll(".chron-filter")
          .forEach((x) => x.classList.toggle("active", x === b));
        renderTimeline();
      });
    });
  }
}

function _renderChronSummary(items) {
  const el = document.getElementById("chronSummary");
  if (!el) return;
  const total = items.length;
  const stories = new Set(
    items.filter((i) => i.article).map((i) => i.article),
  ).size;
  let since = "";
  if (total) {
    const earliest = new Date(
      Math.min(...items.map((i) => new Date(i.date).getTime())),
    );
    since = earliest.toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    });
  }
  el.textContent = total
    ? `${total} ${total === 1 ? "entry" : "entries"} · ${stories} ${stories === 1 ? "story" : "stories"} · since ${since}`
    : "Nothing recorded yet";
}

function _renderChronFilterCounts(items) {
  const counts = {
    All: items.length,
    Highlight: items.filter((i) => isType(i.type, "Highlight")).length,
    Note: items.filter((i) => isType(i.type, "Note")).length,
    Reflection: items.filter((i) => isType(i.type, "Reflection")).length,
    Bookmark: items.filter((i) => isType(i.type, "Bookmark")).length,
    Read: items.filter((i) => isType(i.type, "Read")).length,
    Favorite: items.filter((i) => i.isFavorite === true).length,
  };
  document.querySelectorAll(".chron-filter").forEach((btn) => {
    const f = btn.dataset.filter;
    if (!(f in counts)) return;
    if (!btn.dataset.base) btn.dataset.base = btn.textContent.trim();
    const c = counts[f];
    btn.innerHTML = c
      ? `${btn.dataset.base} <span class="chron-filter-n">${c}</span>`
      : btn.dataset.base;
  });
}

function _renderChronRibbon(items) {
  const el = document.getElementById("chronRibbon");
  if (!el) return;
  if (items.length < 3) {
    el.style.display = "none";
    return;
  }
  el.style.display = "flex";
  const times = items.map((i) => new Date(i.date).getTime());
  const min = Math.min(...times);
  const max = Math.max(...times);
  const span = max - min || 1;
  const BARS = 48;
  const buckets = new Array(BARS).fill(0);
  times.forEach((t) => {
    const idx = Math.min(BARS - 1, Math.floor(((t - min) / span) * (BARS - 1)));
    buckets[idx]++;
  });
  const peak = Math.max(...buckets, 1);
  el.innerHTML = buckets
    .map((c, idx) => {
      const h = c ? 16 + Math.round((c / peak) * 84) : 5;
      const ts = min + Math.round((idx / (BARS - 1)) * span);
      return `<span class="chron-bar${c ? "" : " empty"}" data-ts="${ts}" style="height:${h}%" title="${c} ${c === 1 ? "entry" : "entries"}"></span>`;
    })
    .join("");
  el.dataset.min = String(min);
  el.dataset.max = String(max);
  _initRibbonScrub(el);
}

// Drag along the ribbon to scrub the journal through time; a floating
// date label follows your finger. A tap jumps to that moment.
function _initRibbonScrub(el) {
  if (el.dataset.scrubWired) return;
  el.dataset.scrubWired = "1";

  let label = document.getElementById("chronScrubLabel");
  if (!label) {
    label = document.createElement("div");
    label.id = "chronScrubLabel";
    label.className = "chron-scrub-label";
    document.body.appendChild(label);
  }

  let scrubbing = false;
  let rect = null;
  let placeholder = null;

  const start = (clientX) => {
    if (chronLens !== "journal") {
      chronLens = "journal";
      document
        .querySelectorAll(".chron-lens")
        .forEach((x) => x.classList.toggle("active", x.dataset.lens === "journal"));
      renderTimeline();
    }
    rect = el.getBoundingClientRect();
    placeholder = document.createElement("div");
    placeholder.style.height = rect.height + "px";
    placeholder.className = "chron-ribbon-ph";
    el.after(placeholder);
    el.style.position = "fixed";
    el.style.top = rect.top + "px";
    el.style.left = rect.left + "px";
    el.style.width = rect.width + "px";
    el.style.margin = "0";
    el.classList.add("scrubbing");
    label.style.display = "block";
    scrubbing = true;
  };

  const move = (clientX) => {
    if (!scrubbing || !rect) return;
    let frac = (clientX - rect.left) / rect.width;
    frac = Math.max(0, Math.min(1, frac));
    const min = parseInt(el.dataset.min);
    const max = parseInt(el.dataset.max);
    const ts = min + frac * (max - min);
    const d = new Date(ts);
    label.textContent = d.toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    const lx = rect.left + frac * rect.width;
    label.style.left = Math.max(64, Math.min(window.innerWidth - 64, lx)) + "px";
    label.style.top = rect.top - 14 + "px";
    // highlight the bar under the finger
    const bars = el.querySelectorAll(".chron-bar");
    const bi = Math.min(bars.length - 1, Math.floor(frac * bars.length));
    bars.forEach((b, i) => b.classList.toggle("cur", i === bi));
    // live-scroll the journal to the nearest day
    let best = null,
      bestDiff = Infinity;
    document.querySelectorAll(".chron-day").forEach((dd) => {
      const diff = Math.abs(parseInt(dd.dataset.ts) - ts);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = dd;
      }
    });
    if (best) best.scrollIntoView({ behavior: "auto", block: "start" });
  };

  const end = () => {
    if (!scrubbing) return;
    scrubbing = false;
    el.style.position = "";
    el.style.top = "";
    el.style.left = "";
    el.style.width = "";
    el.style.margin = "";
    el.classList.remove("scrubbing");
    el.querySelectorAll(".chron-bar.cur").forEach((b) => b.classList.remove("cur"));
    if (placeholder) {
      placeholder.remove();
      placeholder = null;
    }
    label.style.display = "none";
  };

  el.addEventListener("pointerdown", (e) => {
    try {
      el.setPointerCapture(e.pointerId);
    } catch (er) {}
    start(e.clientX);
    move(e.clientX);
    e.preventDefault();
  });
  el.addEventListener("pointermove", (e) => {
    if (scrubbing) {
      move(e.clientX);
      e.preventDefault();
    }
  });
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);
}

// ---- Journal lens ----
function renderChronJournal(body, view) {
  let list = view;
  if (chronFilter !== "All") {
    list =
      chronFilter === "Favorite"
        ? list.filter((i) => i.isFavorite)
        : list.filter((i) => isType(i.type, chronFilter));
  }
  if (!list.length) {
    body.innerHTML = _chronEmpty(
      currentTimelineSearch
        ? "Nothing in the chronicle matches your search."
        : "No entries under this heading yet.",
    );
    return;
  }
  body.innerHTML = "";
  const groups = {};
  list.forEach((it) => {
    const d = new Date(it.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    (groups[key] = groups[key] || []).push(it);
  });
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const yest = new Date(now.getTime() - 86400000);
  const yestKey = `${yest.getFullYear()}-${String(yest.getMonth() + 1).padStart(2, "0")}-${String(yest.getDate()).padStart(2, "0")}`;

  Object.keys(groups)
    .sort()
    .reverse()
    .forEach((key) => {
      const d = new Date(key + "T12:00:00");
      const n = groups[key].length;
      const wd =
        key === todayKey
          ? "Today"
          : key === yestKey
            ? "Yesterday"
            : d.toLocaleDateString(undefined, { weekday: "long" });
      const dayEl = document.createElement("div");
      dayEl.className = "chron-day";
      dayEl.dataset.ts = d.getTime();
      dayEl.innerHTML = `
        <div class="chron-dateline">
          <div class="chron-day-num">${d.getDate()}</div>
          <div class="chron-day-rest">
            <div class="chron-wd">${wd}</div>
            <div class="chron-mo">${d.toLocaleDateString(undefined, { month: "long" })} ${d.getFullYear()}</div>
          </div>
          <div class="chron-day-count">${n} ${n === 1 ? "entry" : "entries"}</div>
        </div>
        <div class="chron-entries"></div>`;
      const entriesEl = dayEl.querySelector(".chron-entries");
      groups[key].forEach((it) => entriesEl.appendChild(chronEntryEl(it)));
      body.appendChild(dayEl);
    });
}

function chronEntryEl(item) {
  const el = document.createElement("div");
  el.className = "chron-entry chron-t-" + (item.type || "Note");
  const parsed = _chronParse(item);
  const time = new Date(item.date).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  let bodyHtml;
  if (parsed.quote) {
    bodyHtml = `<div class="chron-quote">“${_chronEsc(parsed.quote)}”</div>${parsed.note ? `<div class="chron-note">${_chronEsc(parsed.note)}</div>` : ""}`;
  } else {
    bodyHtml = `<div class="chron-note">${_chronEsc(parsed.note || item.text || "")}</div>`;
  }
  const source =
    item.article && item.domain && item.domain !== "Uncategorized"
      ? `${item.domain} · ${item.article}`
      : item.article || "";
  el.innerHTML = `
    <div class="chron-entry-rail"><span class="chron-glyph">${_chronGlyph(item.type)}</span></div>
    <div class="chron-entry-main">
      <div class="chron-entry-top">
        <span class="chron-type">${item.type || "Note"}</span>
        <span class="chron-time">${time}</span>
      </div>
      ${bodyHtml}
      ${source ? `<div class="chron-source">${_chronEsc(source)}</div>` : ""}
      <div class="chron-actions">
        <button class="chron-act" data-act="jump">${item.type === "Reflection" ? "View notes" : "Open in story"} →</button>
        <button class="chron-act chron-fav ${item.isFavorite ? "on" : ""}" data-fav-date="${item.date}" data-act="fav">♥︎</button>
        <button class="chron-act chron-more" data-act="menu">•••</button>
      </div>
    </div>`;
  el.querySelector('[data-act="jump"]').addEventListener("click", (e) => {
    e.stopPropagation();
    if (item.type === "Reflection") jumpToTimelineDate(item.date);
    else
      jumpToArticleByDomainAndName(
        item.domain || "",
        item.article || "",
        item.date,
      );
  });
  el.querySelector('[data-act="fav"]').addEventListener("click", (e) => {
    e.stopPropagation();
    toggleTimelineFavorite(item.date);
    e.currentTarget.classList.toggle("on");
  });
  el.querySelector('[data-act="menu"]').addEventListener("click", (e) => {
    e.stopPropagation();
    showTimelineContextMenu(e, item.date);
  });
  setupMultiSelect(el, item.date, "timeline");
  el.addEventListener("click", () => {
    if (typeof multiSelectMode !== "undefined" && multiSelectMode) return;
    el.classList.toggle("expanded");
  });
  return el;
}

// ---- By Story lens ----
function renderChronStories(body, view) {
  const map = {};
  view.forEach((it) => {
    if (!it.article) return;
    const k = (it.domain || "") + "|" + it.article;
    if (!map[k])
      map[k] = { domain: it.domain, article: it.article, items: [], last: 0 };
    map[k].items.push(it);
    map[k].last = Math.max(map[k].last, new Date(it.date).getTime());
  });
  const groups = Object.values(map).sort((a, b) => b.last - a.last);
  if (!groups.length) {
    body.innerHTML = _chronEmpty(
      "No stories marked yet — highlight or note a story and it gathers here.",
    );
    return;
  }

  const ORDER = ["Highlight", "Note", "Reflection", "Bookmark", "Read"];
  const PLURAL = {
    Highlight: "Highlights",
    Note: "Notes",
    Reflection: "Reflections",
    Bookmark: "Bookmarks",
    Read: "Reading",
  };
  const fmtDay = (t) =>
    new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });

  body.innerHTML = groups
    .map((g, gi) => {
      const obj = _chronStoryObj(g.domain, g.article) || {};
      const cover = obj.image
        ? `<div class="chron-dossier-cover"><img ${obj.image.startsWith("data:") ? `src="${obj.image}"` : `data-img-ref="${obj.image}"`} alt="" style="object-position:${obj.imagePos || "50% 50%"}" /></div>`
        : `<div class="chron-dossier-cover chron-dossier-noimg">${_chronEsc((g.article || "?").charAt(0))}</div>`;

      const byType = {};
      g.items.forEach((i) => (byType[i.type] = byType[i.type] || []).push(i));

      // stat chips (type-coloured)
      const chips = ORDER.filter((t) => byType[t] && byType[t].length)
        .map((t) => {
          const n = byType[t].length;
          const lbl = n === 1 ? t : PLURAL[t];
          return `<span class="ds-chip" style="--tcol:${_chronCol(t)}"><span class="ds-chip-dot"></span>${n} ${lbl}</span>`;
        })
        .join("");

      // meta line: read status + span
      const times = g.items.map((i) => new Date(i.date).getTime());
      const first = Math.min(...times);
      const lastT = Math.max(...times);
      const readList =
        userLearningJourney.topics[g.domain] &&
        userLearningJourney.topics[g.domain].readArticles;
      const isRead = readList && readList.includes(g.article);
      const spanTxt =
        fmtDay(first) === fmtDay(lastT)
          ? `marked ${fmtDay(first)}`
          : `${fmtDay(first)} – ${fmtDay(lastT)}`;
      const meta = `${isRead ? '<span class="ds-read">✓ Read</span> · ' : ""}${g.items.length} ${g.items.length === 1 ? "entry" : "entries"} · ${spanTxt}`;

      // body: sections grouped by type, ALL marks, newest first
      const sections = ORDER.filter((t) => byType[t] && byType[t].length)
        .map((t) => {
          const rows = byType[t]
            .slice()
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .map((i) => {
              const parsed = _chronParse(i);
              const q = parsed.quote || parsed.note || i.text || "";
              const noteExtra =
                parsed.quote && parsed.note
                  ? `<span class="ds-mark-note">${_chronEsc(_chronTrim(parsed.note, 80))}</span>`
                  : "";
              return `<button class="ds-mark" data-domain="${_chronAttr(g.domain)}" data-article="${_chronAttr(g.article)}" data-date="${i.date}">
                <span class="ds-mark-glyph" style="color:${_chronCol(t)}">${_chronGlyph(t)}</span>
                <span class="ds-mark-body"><span class="ds-mark-txt">${_chronEsc(_chronTrim(q, 150))}</span>${noteExtra}<span class="ds-mark-when">${fmtDay(i.date)}</span></span>
              </button>`;
            })
            .join("");
          return `<div class="ds-section"><div class="ds-section-head" style="--tcol:${_chronCol(t)}">${PLURAL[t]} · ${byType[t].length}</div>${rows}</div>`;
        })
        .join("");

      return `<div class="chron-dossier${gi === 0 ? " open" : ""}">
        <div class="chron-dossier-head">
          ${cover}
          <div class="chron-dossier-info">
            <div class="chron-dossier-title">${_chronEsc(g.article)}</div>
            ${obj.author ? `<div class="chron-dossier-author">${_chronEsc(obj.author)}</div>` : ""}
            <div class="chron-dossier-chips">${chips}</div>
          </div>
          <span class="chron-dossier-chev">⌄</span>
        </div>
        <div class="chron-dossier-meta">${meta}</div>
        <div class="chron-dossier-body">
          ${sections}
          <button class="ds-open" data-domain="${_chronAttr(g.domain)}" data-article="${_chronAttr(g.article)}">Open the story →</button>
        </div>
      </div>`;
    })
    .join("");

  if (typeof hydrateImages === "function") hydrateImages(body);

  // expand / collapse a dossier
  body.querySelectorAll(".chron-dossier-head").forEach((h) => {
    h.addEventListener("click", () => h.parentElement.classList.toggle("open"));
  });
  // a mark or the open button jumps into the story
  body.querySelectorAll(".ds-mark, .ds-open").forEach((b) => {
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      jumpToArticleByDomainAndName(
        b.dataset.domain || "",
        b.dataset.article || "",
        b.dataset.date || null,
      );
    });
  });
}

// ---- Anthology lens (your book of quotations) ----
// ---- Patterns lens (the shape of your reading life) ----
function renderChronPatterns(body) {
  let items = [...(userLearningJourney.timeline || [])];
  items.forEach(_chronNormalize);
  if (!items.length) {
    body.innerHTML = _chronEmpty(
      "Patterns appear once you've read and marked a few stories.",
    );
    return;
  }

  // Resolve author/genres per story once
  const objCache = {};
  const objFor = (dom, art) => {
    const k = (dom || "") + "|" + art;
    if (!(k in objCache)) objCache[k] = _chronStoryObj(dom, art) || {};
    return objCache[k];
  };

  const authors = {};
  const genres = {};
  const stories = {};
  const weekdays = new Array(7).fill(0);
  const months = {};
  const types = {};
  items.forEach((i) => {
    types[i.type] = (types[i.type] || 0) + 1;
    const d = new Date(i.date);
    weekdays[d.getDay()]++;
    const mk = d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    months[mk] = (months[mk] || 0) + 1;
    if (i.article) {
      stories[i.article] = stories[i.article] || {
        n: 0,
        domain: i.domain,
        article: i.article,
      };
      stories[i.article].n++;
      const o = objFor(i.domain, i.article);
      if (o.author) authors[o.author] = (authors[o.author] || 0) + 1;
      (o.genres || []).forEach((g) => (genres[g] = (genres[g] || 0) + 1));
    }
  });

  const rank = (obj) =>
    Object.entries(obj).sort((a, b) => b[1] - a[1]);

  // ---- Portrait: a reader archetype drawn from your habits ----
  const hourBuckets = [0, 0, 0, 0]; // Dawn / Day / Evening / Night
  const bucketOf = (h) =>
    h >= 5 && h < 11 ? 0 : h >= 11 && h < 17 ? 1 : h >= 17 && h < 22 ? 2 : 3;
  const monthSeq = {}; // sortable YYYY-MM -> count
  let firstT = Infinity;
  let lastT = -Infinity;
  items.forEach((i) => {
    const d = new Date(i.date);
    hourBuckets[bucketOf(d.getHours())]++;
    const t = d.getTime();
    if (t < firstT) firstT = t;
    if (t > lastT) lastT = t;
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthSeq[ym] = (monthSeq[ym] || 0) + 1;
  });
  const busiestHour = hourBuckets.indexOf(Math.max(...hourBuckets));
  const TIME_WORD = ["Morning", "Daytime", "Evening", "Midnight"];
  const engaged = {
    Note: ["Annotator", types.Note || 0],
    Reflection: ["Essayist", types.Reflection || 0],
    Highlight: ["Marginalist", types.Highlight || 0],
    Bookmark: ["Curator", types.Bookmark || 0],
  };
  let typeWord = "Reader";
  let typeBest = 0;
  Object.values(engaged).forEach(([w, n]) => {
    if (n > typeBest) {
      typeBest = n;
      typeWord = w;
    }
  });
  const archetype = `The ${TIME_WORD[busiestHour]} ${typeWord}`;
  const totalMarks = items.length;
  const sinceLbl = isFinite(firstT)
    ? new Date(firstT).toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      })
    : "—";
  const storyCountEarly = Object.keys(stories).length;
  const portrait = `
    <div class="pat-portrait">
      <div class="pat-portrait-eyebrow">Your Reading Character</div>
      <div class="pat-archetype">${_chronEsc(archetype)}</div>
      <div class="pat-portrait-stat">${totalMarks} marks · ${storyCountEarly} ${storyCountEarly === 1 ? "story" : "stories"} · since ${_chronEsc(sinceLbl)}</div>
      <div class="pat-fleuron">❦</div>
    </div>`;

  // ---- Mini bar charts (small multiples): week, hours, cadence ----
  const chart = (cols, maxBarPx) => {
    const max = Math.max(1, ...cols.map((c) => c.v));
    return (
      '<div class="pat-chart">' +
      cols
        .map(
          (c) =>
            `<div class="pat-col ${c.on ? "on" : ""}"><span class="pat-col-val">${c.v || ""}</span><span class="pat-col-bar" style="height:${c.v ? Math.max(3, Math.round((c.v / max) * maxBarPx)) : 0}px"></span><span class="pat-col-lab">${c.l}</span></div>`,
        )
        .join("") +
      "</div>"
    );
  };

  const WDINIT = ["S", "M", "T", "W", "T", "F", "S"];
  const wdMax = Math.max(...weekdays);
  const weekChart = chart(
    weekdays.map((v, i) => ({ v, l: WDINIT[i], on: v === wdMax && v > 0 })),
    56,
  );

  const HOUR_LAB = ["Dawn", "Noon", "Eve", "Night"];
  const hoursChart = chart(
    hourBuckets.map((v, i) => ({
      v,
      l: HOUR_LAB[i],
      on: i === busiestHour && v > 0,
    })),
    56,
  );

  // Cadence — up to the last 12 months, chronological
  const monthKeys = Object.keys(monthSeq).sort().slice(-12);
  const cadMax = Math.max(1, ...monthKeys.map((k) => monthSeq[k]));
  const cadenceChart =
    monthKeys.length > 1
      ? chart(
          monthKeys.map((k) => {
            const mi = parseInt(k.slice(5), 10) - 1;
            return {
              v: monthSeq[k],
              l: "JFMAMJJASOND"[mi],
              on: monthSeq[k] === cadMax,
            };
          }),
          56,
        )
      : "";

  // Most kept company (authors) — ranked bars
  const authorRank = rank(authors).slice(0, 5);
  const authorMax = authorRank.length ? authorRank[0][1] : 1;
  const authorsHtml = authorRank.length
    ? authorRank
        .map(
          ([name, n]) =>
            `<div class="pat-bar-row"><span class="pat-bar-name">${_chronEsc(name)}</span><span class="pat-bar-track"><span class="pat-bar-fill" style="width:${Math.round((n / authorMax) * 100)}%"></span></span><span class="pat-bar-n">${n}</span></div>`,
        )
        .join("")
    : `<div class="pat-none">No authors recorded yet.</div>`;

  // Shelf leans (genres) — tags
  const genreRank = rank(genres).slice(0, 8);
  const genresHtml = genreRank.length
    ? genreRank
        .map(
          ([g, n]) =>
            `<span class="pat-genre">${_chronEsc(g)}<span class="pat-genre-n">${n}</span></span>`,
        )
        .join("")
    : `<div class="pat-none">Genres appear as you tag your stories.</div>`;

  // Tiles — the headline numbers
  const streak = typeof calcStreak === "function" ? calcStreak() : { longest: 0 };
  const storyCount = Object.keys(stories).length;
  const deepest = Object.values(stories).reduce((m, s) => Math.max(m, s.n), 0);
  const reflectionsN = types.Reflection || 0;
  const spanDays = isFinite(firstT)
    ? Math.max(1, Math.round((lastT - firstT) / 86400000) + 1)
    : 0;
  const tiles = [
    [String(streak.longest || 0), "day streak"],
    [String(deepest), "deepest dive"],
    [String(reflectionsN), reflectionsN === 1 ? "reflection" : "reflections"],
    [String(spanDays), "days of reading"],
  ]
    .map(
      ([v, c]) =>
        `<div class="pat-tile"><div class="pat-tile-num">${_chronEsc(v)}</div><div class="pat-tile-cap">${c}</div></div>`,
    )
    .join("");

  // Type breakdown — a proportion bar + legend
  const ORDER = ["Highlight", "Note", "Reflection", "Bookmark", "Read"];
  const typeTotal = ORDER.reduce((s2, t) => s2 + (types[t] || 0), 0) || 1;
  const seg = ORDER.filter((t) => types[t])
    .map(
      (t) =>
        `<span class="pat-seg" style="width:${(types[t] / typeTotal) * 100}%;background:${_chronCol(t)}" title="${t}"></span>`,
    )
    .join("");
  const legend = ORDER.filter((t) => types[t])
    .map(
      (t) =>
        `<span class="pat-leg"><span class="pat-leg-dot" style="background:${_chronCol(t)}"></span>${t} ${types[t]}</span>`,
    )
    .join("");

  // Most marked stories
  const topStories = Object.values(stories)
    .sort((a, b) => b.n - a.n)
    .slice(0, 5)
    .map(
      (st) =>
        `<button class="pat-story" data-domain="${_chronAttr(st.domain)}" data-article="${_chronAttr(st.article)}"><span class="pat-story-name">${_chronEsc(st.article)}</span><span class="pat-story-n">${st.n}</span></button>`,
    )
    .join("");

  body.innerHTML = `
    <div class="chron-patterns">
      ${portrait}
      <div class="pat-tiles">${tiles}</div>
      <div class="pat-block">
        <div class="pat-label">Rhythm of the Week</div>
        ${weekChart}
      </div>
      <div class="pat-block">
        <div class="pat-label">Hours You Keep</div>
        ${hoursChart}
      </div>
      ${
        cadenceChart
          ? `<div class="pat-block">
        <div class="pat-label">The Cadence</div>
        ${cadenceChart}
      </div>`
          : ""
      }
      <div class="pat-block">
        <div class="pat-label">Most Kept Company</div>
        <div class="pat-bars">${authorsHtml}</div>
      </div>
      <div class="pat-block">
        <div class="pat-label">Your Shelf Leans</div>
        <div class="pat-genres">${genresHtml}</div>
      </div>
      <div class="pat-block">
        <div class="pat-label">The Mix</div>
        <div class="pat-mixbar">${seg}</div>
        <div class="pat-legend">${legend}</div>
      </div>
      <div class="pat-block">
        <div class="pat-label">Most Marked</div>
        <div class="pat-stories">${topStories}</div>
      </div>
    </div>`;

  body.querySelectorAll(".pat-story").forEach((b) => {
    b.addEventListener("click", () =>
      jumpToArticleByDomainAndName(
        b.dataset.domain || "",
        b.dataset.article || "",
        null,
      ),
    );
  });
}
function makeSummaryItem(html, delayIndex, color, borderColor) {
  const div = document.createElement("div");
  div.className = "timeline-summary-item";
  div.style.cssText = `animation-delay:${delayIndex * 0.05}s;color:${color};border-color:${borderColor};`;
  div.innerHTML = html;
  return div;
}

function createTimelineElement(item, delayIndex, forceExpand = false) {
  const div = document.createElement("div");
  div.className = "timeline-item";
  if (forceExpand) {
    div.classList.add("expanded");
  }
  div.style.animationDelay = `${delayIndex * 0.05}s`;

  const iconSVG =
    item.type === "Badge"
      ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`
      : getIconForType(item.type || "Note");

  const shortDate = new Date(item.date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  const shortTime = new Date(item.date).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  let pathName = "";
  let cleanText = item.text || "";
  const pathMatch = cleanText.match(/^\[(Path|Capstone):\s*(.+?)\]\s*/);
  if (pathMatch) {
    pathName = pathMatch[2];
    cleanText = cleanText.substring(pathMatch[0].length);
  }

  const compactText = cleanText.replace(/\s+/g, " ").trim();
  let previewText =
    compactText.length > 120 ? `${compactText.slice(0, 120)}...` : compactText;

  const safeDomain = item.domain
    ? item.domain.replace(/'/g, "\\'").replace(/"/g, "&quot;")
    : "";
  const safeArticle = item.article
    ? item.article.replace(/'/g, "\\'").replace(/"/g, "&quot;")
    : "";

  const isWorkplaceType =
    item.type === "Reflection";
  const viewBtnText = isWorkplaceType ? "View Notes" : "View in Story";
  const jumpAction = isWorkplaceType
    ? `jumpToTimelineDate('${item.date}')`
    : `jumpToArticleByDomainAndName('${safeDomain}', '${safeArticle}', '${item.date}')`;

  let contentHtml = `"${cleanText ? cleanText.replace(/\n/g, "<br>") : ""}"`;

  if ((item.type === "Highlight" || item.type === "Note") && cleanText) {
    if (cleanText.includes('\n\n"')) {
      const parts = cleanText.split('\n\n"');
      const note = parts[0];
      const quote = parts[1].endsWith('"') ? parts[1].slice(0, -1) : parts[1];
      contentHtml = `
        <div style="margin-bottom: 10px; background: rgba(0,0,0,0.02); padding: 10px; border-radius: 8px; border: 1px solid var(--glass-border);">
            <div style="font-size: 0.7rem; color: var(--accent); font-weight: bold; text-transform: uppercase; margin-bottom: 4px;">Your Note</div>
            <div style="color: var(--dark-text);">${note.replace(/\n/g, "<br>")}</div>
        </div>
        <div style="font-style: italic; color: var(--subtitle-color);">"${quote}"</div>
      `;
      previewText = `Note: ${note.replace(/\n/g, " ")} | "${quote}"`;
      if (previewText.length > 120)
        previewText = previewText.slice(0, 120) + "...";
    } else if (cleanText.startsWith('"') && cleanText.endsWith('"')) {
      contentHtml = `<div style="font-style: italic; color: var(--subtitle-color);">"${cleanText.slice(1, -1)}"</div>`;
    } else {
      contentHtml = `<div style="font-style: italic; color: var(--subtitle-color);">"${cleanText.replace(/\n/g, "<br>")}"</div>`;
    }
  } else if (item.type === "Bookmark" && cleanText) {
    if (cleanText.startsWith('"') && cleanText.endsWith('"')) {
      contentHtml = `<div style="font-style: italic; color: var(--subtitle-color);">"${cleanText.slice(1, -1)}"</div>`;
    } else {
      contentHtml = `<div style="font-style: italic; color: var(--subtitle-color);">"${cleanText.replace(/\n/g, "<br>")}"</div>`;
    }
  } else if (
    (item.type === "Reflection" ||
      item.type === "Badge") &&
    cleanText
  ) {
    contentHtml = `<div style="color: var(--dark-text);">${cleanText.replace(/\n/g, "<br>")}</div>`;
  } else if (item.type === "Read" && cleanText) {
    contentHtml = `<div style="color: var(--sage); font-weight: 500;">${cleanText}</div>`;
  }

  let contextTextHtml =
    item.domain && item.domain !== "Uncategorized"
      ? `${item.domain} <span class="timeline-sep">/</span> ${item.article}`
      : `${item.article}`;
  if (pathName) {
    contextTextHtml =
      `<span style="color:var(--accent); font-weight:bold;">Path: ${pathName}</span> <span class="timeline-sep">/</span> ` +
      contextTextHtml;
  }

  div.innerHTML = `
        <div class="timeline-header">
            <div class="timeline-meta">
                <div class="timeline-date-row">
                  <div class="timeline-date">${iconSVG} ${item.type || "Note"}</div>
                  <div class="timeline-stamp">${shortDate} · ${shortTime}</div>
                </div>
                <div class="timeline-context">${contextTextHtml}</div>
                <div class="timeline-preview">${previewText}</div>
            </div>
            <span class="expand-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg></span>
        </div>
        <div class="timeline-content-wrapper">
            <div class="timeline-inner-wrap">
                <div class="timeline-content">${contentHtml}</div>
                <div class="timeline-actions" style="display: flex; gap: 8px; padding-left: 8px; align-items: center;">
                    <button class="text-btn sage-btn" onclick="event.stopPropagation(); ${jumpAction}" style="font-size: 0.9rem;">${viewBtnText}</button>
                    <button class="text-btn" data-fav-date="${item.date}" onclick="event.stopPropagation(); toggleTimelineFavorite('${item.date}')" style="white-space: nowrap; font-size: 1.1rem; color: ${item.isFavorite ? 'var(--accent)' : 'var(--subtitle-color)'}; background: transparent; border: none; cursor: pointer; padding: 4px 8px;">♥︎</button>
                    <button class="text-btn sage-btn" onclick="event.stopPropagation(); showTimelineContextMenu(event, '${item.date}')" style="font-size: 0.9rem;">•••</button>
                </div>
            </div>
        </div>`;
  setupMultiSelect(div, item.date, "timeline");

  let lastTap = 0;
  div.addEventListener("click", (e) => {
    if (multiSelectMode) return;
    const now = Date.now();
    if (now - lastTap < 300) {
      e.preventDefault();
      jumpToTimelineItemTarget(item);
    } else {
      div.classList.toggle("expanded");
    }
    lastTap = now;
  });
  return div;
}

function createArticleTimelineElement(items, delayIndex) {
  const div = document.createElement("div");
  div.className = "timeline-item";
  div.style.animationDelay = `${delayIndex * 0.05}s`;

  const firstItem = items[0];
  const articleName = firstItem.article;
  const domainName = firstItem.domain || "Knowledge";

  const safeDomain = domainName
    ? domainName.replace(/'/g, "\\'").replace(/"/g, "&quot;")
    : "";
  const safeArticle = articleName
    ? articleName.replace(/'/g, "\\'").replace(/"/g, "&quot;")
    : "";

  let highlightsCount = 0;
  let notesCount = 0;
  let reflectionsCount = 0;
  let bookmarksCount = 0;
  let readCount = 0;

  let contentHtml = `<div style="display: flex; flex-direction: column; gap: 12px;">`;

  items.forEach((item) => {
    if (item.type === "Highlight") highlightsCount++;
    else if (item.type === "Note") notesCount++;
    else if (
      item.type === "Reflection" ||
      item.type === "Synthesis" ||
      item.type === "Roulette"
    )
      reflectionsCount++;
    else if (item.type === "Bookmark") bookmarksCount++;
    else if (item.type === "Read") readCount++;

    let innerHtml = "";
    let cleanText = item.text || "";

    const pathMatch = cleanText.match(/^\[(Path|Capstone):\s*(.+?)\]\s*/);
    if (pathMatch) cleanText = cleanText.substring(pathMatch[0].length);

    if (item.type === "Roulette" && item.rouletteQ) {
      innerHtml = `
        <div style="margin-bottom: 10px; background: rgba(0,0,0,0.02); padding: 10px; border-radius: 8px; border: 1px solid var(--glass-border);">
            <div style="font-size: 0.7rem; color: var(--sage); font-weight: bold; text-transform: uppercase; margin-bottom: 4px;">Question</div>
            <div style="font-style: italic; color: var(--dark-text);">${item.rouletteQ}</div>
        </div>
        <div style="margin-bottom: 10px; background: rgba(0,0,0,0.02); padding: 10px; border-radius: 8px; border: 1px solid var(--glass-border);">
            <div style="font-size: 0.7rem; color: var(--accent); font-weight: bold; text-transform: uppercase; margin-bottom: 4px;">Your Answer</div>
            <div style="color: var(--dark-text);">${cleanText.replace(/\n/g, "<br>")}</div>
        </div>
      `;
    } else if (
      (item.type === "Highlight" || item.type === "Note") &&
      cleanText
    ) {
      if (cleanText.includes('\n\n"')) {
        const parts = cleanText.split('\n\n"');
        const note = parts[0];
        const quote = parts[1].endsWith('"') ? parts[1].slice(0, -1) : parts[1];
        innerHtml = `
          <div style="font-style: italic; color: var(--subtitle-color); margin-bottom: 6px;">"${quote}"</div>
          <div style="color: var(--dark-text); font-size: 0.9rem; opacity: 0.85; border-left: 2px solid var(--glass-border); padding-left: 8px;">${note.replace(/\n/g, "<br>")}</div>
        `;
      } else if (cleanText.startsWith('"') && cleanText.endsWith('"')) {
        innerHtml = `<div style="font-style: italic; color: var(--subtitle-color);">"${cleanText.slice(1, -1)}"</div>`;
      } else {
        innerHtml = `<div style="font-style: italic; color: var(--subtitle-color);">"${cleanText.replace(/\n/g, "<br>")}"</div>`;
      }
    } else if (item.type === "Bookmark" && cleanText) {
      if (cleanText.startsWith('"') && cleanText.endsWith('"')) {
        innerHtml = `<div style="font-style: italic; color: var(--subtitle-color);">"${cleanText.slice(1, -1)}"</div>`;
      } else {
        innerHtml = `<div style="font-style: italic; color: var(--subtitle-color);">"${cleanText.replace(/\n/g, "<br>")}"</div>`;
      }
    } else if (
      (item.type === "Reflection" ||
        item.type === "Synthesis" ||
        item.type === "Badge") &&
      cleanText
    ) {
      innerHtml = `<div style="color: var(--dark-text);">${cleanText.replace(/\n/g, "<br>")}</div>`;
    } else if (item.type === "Read" && cleanText) {
      innerHtml = `<div style="color: var(--sage); font-weight: 500;">${cleanText}</div>`;
    } else {
      innerHtml = `<div style="color: var(--dark-text);">${cleanText.replace(/\n/g, "<br>")}</div>`;
    }

    const itemIcon = getIconForType(item.type);

    const isWorkplaceType =
      item.type === "Reflection" ||
      item.type === "Synthesis" ||
      item.type === "Roulette";
    const viewBtnText = isWorkplaceType ? "View Notes" : "View in Story";
    const jumpAction = isWorkplaceType
      ? `jumpToTimelineDate('${item.date}')`
      : `jumpToArticleByDomainAndName('${safeDomain}', '${safeArticle}', '${item.date}')`;

    contentHtml += `
      <div class="grouped-timeline-subitem" id="timeline-subitem-${item.date}" style="border: 1px solid var(--glass-border); background: var(--glass-solid); padding: 8px; margin-bottom: 6px; transition: box-shadow 0.3s ease; border-radius: 6px;">
        <div style="font-size: 0.7rem; color: var(--subtitle-color); text-transform: uppercase; font-weight: bold; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center; gap: 8px;">
          <span style="display: flex; align-items: center; gap: 4px; min-width: 0; flex: 1;">
            <span style="display:inline-flex; width:12px; height:12px; flex-shrink: 0;">${itemIcon.replace('width="14" height="14"', 'width="12" height="12"')}</span>
            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.type || "Note"} · ${new Date(item.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
          </span>
          <div style="display: flex; gap: 4px; align-items: center; flex-shrink: 0;">
             <button class="text-btn sage-btn" style="font-size: 0.65rem; padding: 3px 6px; white-space: nowrap;" onclick="event.stopPropagation(); ${jumpAction}">${viewBtnText}</button>
             <button class="text-btn" data-fav-date="${item.date}" style="font-size: 1rem; padding: 3px 6px; color: ${item.isFavorite ? 'var(--accent)' : 'var(--subtitle-color)'}; background: transparent; border: none; cursor: pointer;" onclick="event.stopPropagation(); toggleTimelineFavorite('${item.date}')">♥︎</button>
             <button class="text-btn sage-btn" style="font-size: 0.65rem; padding: 3px 6px;" onclick="event.stopPropagation(); showTimelineContextMenu(event, '${item.date}')">•••</button>
          </div>
        </div>
        <div style="font-size: 0.86rem; line-height: 1.5; font-family: var(--article-font-family);">${innerHtml}</div>
      </div>
    `;
  });

  contentHtml += `</div>`;

  let previewParts = [];
  if (readCount > 0) previewParts.push(`Read`);
  if (highlightsCount > 0)
    previewParts.push(
      `${highlightsCount} Highlight${highlightsCount > 1 ? "s" : ""}`,
    );
  if (notesCount > 0)
    previewParts.push(
      `${notesCount} Note${notesCount > 1 ? "s" : ""}`,
    );
  if (reflectionsCount > 0)
    previewParts.push(
      `${reflectionsCount} Reflection${reflectionsCount > 1 ? "s" : ""}`,
    );
  if (bookmarksCount > 0)
    previewParts.push(
      `${bookmarksCount} Bookmark${bookmarksCount > 1 ? "s" : ""}`,
    );
  if (previewParts.length === 0) previewParts.push("Activity");

  const iconSVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>`;

  div.innerHTML = `
    <div class="timeline-header">
        <div class="timeline-meta">
            <div class="timeline-date-row">
              <div class="timeline-date">${iconSVG} Story Session</div>
              <div class="timeline-stamp">${items.length} Event${items.length > 1 ? "s" : ""}</div>
            </div>
            <div class="timeline-context">${domainName && domainName !== "Uncategorized" ? `${domainName} <span class="timeline-sep">/</span> ` : ""}${articleName}</div>
            <div class="timeline-preview">${previewParts.join(", ")}</div>
        </div>
        <span class="expand-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg></span>
    </div>
    <div class="timeline-content-wrapper">
        <div class="timeline-inner-wrap">
            <div class="timeline-content" style="border: none; padding-left: 0;">${contentHtml}</div>
            <div class="timeline-actions" style="display: flex; gap: 12px; padding-left: 8px; margin-top: 8px; border-top: 1px solid var(--glass-border); padding-top: 12px;">
                <button class="text-btn sage-btn" onclick="event.stopPropagation(); jumpToArticleByDomainAndName('${safeDomain}', '${safeArticle}')">Open Article</button>
            </div>
        </div>
    </div>`;

  let lastTap = 0;
  div.addEventListener("click", (e) => {
    if (multiSelectMode) return;
    const now = Date.now();
    if (now - lastTap < 300) {
      e.preventDefault();
      jumpToArticleByDomainAndName(domainName, articleName);
    } else {
      div.classList.toggle("expanded");
    }
    lastTap = now;
  });
  return div;
}

function editTimelineItem(dateStr) {
  const itemIndex = userLearningJourney.timeline.findIndex(
    (t) => t.date === dateStr,
  );
  if (itemIndex > -1) {
    const item = userLearningJourney.timeline[itemIndex];

    let textToEdit = item.text || "";
    let preservedQuote = "";
    let preservedPath = "";

    const pathMatch = textToEdit.match(/^\[(Path|Capstone):\s*(.+?)\]\s*/);
    if (pathMatch) {
      preservedPath = pathMatch[0];
      textToEdit = textToEdit.substring(pathMatch[0].length);
    }

    if ((item.type === "Highlight" || item.type === "Note") && item.text) {
      if (item.text.includes('\n\n"')) {
        const parts = item.text.split('\n\n"');
        textToEdit = parts[0];
        preservedQuote = '"' + parts[1];
      } else if (item.text.startsWith('"') && item.text.endsWith('"')) {
        textToEdit = "";
        preservedQuote = item.text;
      }
    }

    let modal = document.getElementById("timelineEditModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "timelineEditModal";
      modal.className = "modal";
      modal.style.zIndex = "3000";
      modal.innerHTML = `
        <div class="glass-panel modal-content" style="max-width: 500px; padding: 2rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h2 class="modal-title" style="margin: 0; font-size: 1.4rem;">Edit Timeline Entry</h2>
            <button id="closeTimelineEditBtn" class="icon-btn-small" style="padding: 4px;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
          </div>
          <textarea id="timelineEditInput" class="reflection-input" style="width: 100%; min-height: 140px; margin-bottom: 16px;"></textarea>
          <button id="saveTimelineEditBtn" class="primary btn-full">Save Changes</button>
        </div>
      `;
      document.body.appendChild(modal);

      document
        .getElementById("closeTimelineEditBtn")
        .addEventListener("click", () => modal.classList.remove("active"));

      document
        .getElementById("saveTimelineEditBtn")
        .addEventListener("click", () => {
          let newText = document
            .getElementById("timelineEditInput")
            .value.trim();

          const pQuote = modal.dataset.preservedQuote || "";
          if (pQuote) {
            newText = newText ? `${newText}\n\n${pQuote}` : pQuote;
          }

          const pPath = modal.dataset.preservedPath || "";
          if (pPath) {
            newText = `${pPath}${newText}`;
          }

          const idx = userLearningJourney.timeline.findIndex(
            (t) => t.date === modal.dataset.editingDate,
          );
          if (idx > -1 && newText) {
            userLearningJourney.timeline[idx].text = newText;
            saveJourneyData();
            showToast("Timeline entry updated!");
          }
          modal.classList.remove("active");
        });
    }

    document.getElementById("timelineEditInput").value = textToEdit;
    modal.dataset.editingDate = dateStr;
    modal.dataset.preservedQuote = preservedQuote;
    modal.dataset.preservedPath = preservedPath;
    modal.classList.add("active");
    document.getElementById("timelineEditInput").focus();
  }
}

function closeAllContextMenus() {
  document.getElementById("timelineContextMenu")?.remove();
  document.getElementById("annotationContextMenu")?.remove();
  document.getElementById("reflectionContextMenu")?.remove();
}

function showTimelineContextMenu(event, dateStr) {
  event.stopPropagation();
  closeAllContextMenus();

  const item = userLearningJourney.timeline.find(t => t.date === dateStr);
  const isBookmark = item && item.note === "Bookmarked";

  const menu = document.createElement("div");
  menu.id = "timelineContextMenu";
  menu.style.cssText = `
    position: fixed;
    background: var(--glass-solid);
    border: 1px solid var(--glass-border);
    border-radius: 6px;
    z-index: 10000;
    padding: 4px 0;
    min-width: 120px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  `;

  let menuHTML = '';
  if (!isBookmark) {
    menuHTML += `<button class="text-btn" style="display: block; width: 100%; text-align: left; padding: 8px 12px; font-size: 0.85rem; border: none; background: transparent; cursor: pointer; color: var(--dark-text); transition: background 0.2s;" onclick="event.stopPropagation(); editTimelineItem('${dateStr}'); document.getElementById('timelineContextMenu').remove();">Edit</button>`;
  }
  menuHTML += `<button class="text-btn" style="display: block; width: 100%; text-align: left; padding: 8px 12px; font-size: 0.85rem; border: none; background: transparent; cursor: pointer; color: #c84c3c; transition: background 0.2s;" onclick="event.stopPropagation(); deleteTimelineItem('${dateStr}'); document.getElementById('timelineContextMenu').remove();">Delete</button>`;

  menu.innerHTML = menuHTML;

  document.body.appendChild(menu);

  // Position menu with viewport bounds checking
  setTimeout(() => {
    const rect = menu.getBoundingClientRect();
    let top = event.clientY;
    let left = event.clientX;

    if (left + rect.width > window.innerWidth - 10) {
      left = Math.max(10, window.innerWidth - rect.width - 10);
    }
    if (top + rect.height > window.innerHeight - 10) {
      top = Math.max(10, window.innerHeight - rect.height - 10);
    }

    menu.style.top = top + "px";
    menu.style.left = left + "px";
  }, 0);

  const closeMenu = () => closeAllContextMenus();
  setTimeout(() => {
    document.addEventListener("click", closeMenu, { once: true });
    document.addEventListener("scroll", closeMenu, { once: true, capture: true });
  }, 10);
}

function deleteTimelineItem(dateStr) {
  if (confirm("Remove this event from your timeline?")) {
    const itemToDelete = userLearningJourney.timeline.find(
      (t) => t.date === dateStr,
    );
    if (itemToDelete && itemToDelete.type === "Read") {
      const dData = userLearningJourney.topics[itemToDelete.domain];
      if (dData && dData.readArticles) {
        const idx = dData.readArticles.indexOf(itemToDelete.article);
        if (idx > -1) {
          dData.readArticles.splice(idx, 1);
          dData.articlesEngaged = Math.max(0, dData.articlesEngaged - 1);
        }
      }
    }

    userLearningJourney.timeline = userLearningJourney.timeline.filter(
      (t) => t.date !== dateStr,
    );
    saveJourneyData();
    const activeFilter = document.querySelector(".timeline-filter-btn.active");
    renderTimeline(activeFilter ? activeFilter.dataset.filter : "All");
    renderHeatmap();
    showToast("Timeline entry removed.");
  }
}

function jumpToTimelineItemTarget(item) {
  if (item.type === "Badge") {
    showToast("This is a milestone badge.");
    return;
  }
  const domain = item.domain;
  const article = item.article;
  if (!domain || !article || !window.topicsData[domain]) {
    if (
      domain === "Cross-Domain" ||
      item.type === "Synthesis" ||
      item.type === "Roulette"
    ) {
      openNotesDrawer(0);
      return;
    }
    showToast("Article not found.");
    return;
  }

  let targetSubtopic = null;
  for (const sub of Object.keys(window.topicsData[domain].subtopics || {})) {
    if ((window.topicsData[domain].subtopics[sub].articles || {})[article]) {
      targetSubtopic = sub;
      break;
    }
  }

  if (targetSubtopic) {
    currentState.mode = "timeline"; // Set mode for back button
    document
      .querySelectorAll(".nav-item")
      .forEach((btn) => btn.classList.remove("active"));

    const articleContent = document.getElementById("articleContent");
    if (articleContent) {
      articleContent.style.opacity = "0.8";
    }

    navigateToArticle(domain, targetSubtopic, article, {
      isJumpingToNote: true,
    });

    setTimeout(() => {
      // Smooth reveal of article content
      if (articleContent) {
        articleContent.style.transition = "opacity 0.4s ease";
        articleContent.style.opacity = "1";
      }

      // Open drawer with smooth timing
      const isReflection =
        item.type === "Reflection" ||
        item.type === "Synthesis" ||
        item.type === "Roulette";
      openNotesDrawer(isReflection ? 0 : 1);

      setTimeout(() => {
        // Wait for drawer animation to complete
        const listId = isReflection ? "reflectionHistory" : "annotationsList";
        const list = document.getElementById(listId);
        if (list) {
          const items = list.querySelectorAll(".annotation-item");

          let cleanItemText = item.text || "";
          const pathMatch = cleanItemText.match(
            /^\[(Path|Capstone):\s*(.+?)\]\s*/,
          );
          if (pathMatch)
            cleanItemText = cleanItemText.substring(pathMatch[0].length);

          const searchParts = cleanItemText
            .split("\n")
            .map((p) => p.replace(/"/g, "").trim().toLowerCase())
            .filter((p) => p.length > 5);

          if (searchParts.length === 0) return;

          for (let el of items) {
            const elText = el.textContent.toLowerCase();
            const matches = searchParts.some((part) => elText.includes(part));
            if (matches) {
              const slide = el.closest(".carousel-slide");
              if (slide) {
                const topPos =
                  el.getBoundingClientRect().top -
                  slide.getBoundingClientRect().top +
                  slide.scrollTop -
                  80;
                slide.scrollTo({ top: topPos, behavior: "smooth" });
              } else {
                el.scrollIntoView({ behavior: "smooth", block: "center" });
              }
              // Smooth highlight animation
              el.style.transition = "box-shadow 0.3s ease, background-color 0.3s ease";
              el.style.boxShadow = "0 0 20px var(--accent), inset 0 0 15px var(--accent)";
              setTimeout(() => {
                el.style.boxShadow = "0 0 10px var(--accent)";
                setTimeout(() => {
                  el.style.boxShadow = "none";
                  el.style.transition = "";
                }, 1500);
              }, 200);
              break;
            }
          }
        }
      }, 450); // Wait for the drawer opening animation
    }, 150); // Shorter wait for article render
  } else {
    showToast("Article not found in the current library.");
  }
}

function jumpToTimelineDate(dateStr) {
  const item = userLearningJourney.timeline.find((t) => t.date === dateStr);
  if (item) jumpToTimelineItemTarget(item);
}

function toggleTimelineFavorite(dateStr) {
  const item = userLearningJourney.timeline.find((t) => t.date === dateStr);
  if (item) {
    item.isFavorite = !item.isFavorite;
    saveJourneyData();

    // Update all UI buttons for this item (in timeline and article view)
    document.querySelectorAll(`button[data-fav-date="${dateStr}"]`).forEach(btn => {
      btn.style.color = item.isFavorite ? 'var(--accent)' : 'var(--subtitle-color)';
    });

    showToast(item.isFavorite ? "Added to favorites" : "Removed from favorites");
  }
}

function renderHeatmap() {
  const grid = document.getElementById("habitHeatmap");
  if (!grid) return;
  grid.innerHTML = "";

  if (
    grid &&
    !document.getElementById("tip_heatmap") &&
    !localStorage.getItem("hide_tip_heatmap")
  ) {
    const exp = document.createElement("div");
    exp.id = "tip_heatmap";
    exp.style.cssText =
      "position: relative; font-size: 0.9rem; color: var(--subtitle-color); margin-bottom: 16px; line-height: 1.5; padding: 16px 20px; background: rgba(224, 122, 95, 0.08); border-radius: 16px; border: 1px solid var(--glass-border); transition: all 0.3s ease;";
    exp.innerHTML = `
      <button onclick="dismissTip('heatmap')" style="position: absolute; top: 12px; right: 12px; background: transparent; border: none; color: var(--subtitle-color); cursor: pointer; padding: 4px; box-shadow: none;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
      <div style='font-size: 0.75rem; font-weight: 700; color: var(--accent); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;'><svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg> Journey Heatmap</div>
      <div style="padding-right: 20px;">Tracks your daily reading and notation habits. The darker the square, the more active you were. <strong>Tap any active square</strong> to instantly jump back in time to that specific day in your timeline.</div>`;
    grid.parentNode.insertBefore(exp, grid);
  }

  const counts = {};
  userLearningJourney.timeline.forEach((event) => {
    const key = new Date(event.date).toDateString();
    counts[key] = (counts[key] || 0) + 1;
  });

  const today = new Date();
  for (let i = 27; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const count = counts[date.toDateString()] || 0;
    const cell = document.createElement("div");
    cell.className = `heatmap-cell ${count === 0 ? "heat-0" : count <= 2 ? "heat-1" : count <= 4 ? "heat-2" : count <= 7 ? "heat-3" : "heat-4"}`;
    cell.title = date.toDateString() + (i === 0 ? " (Today)" : "");
    cell.textContent = date.getDate();

    // Jump to the exact day in the Timeline when clicked
    cell.addEventListener("click", () => {
      if (count === 0) {
        showToast("No activity on this day.");
        return;
      }
      updateActiveNav("navTimeline");
      switchView("timelineView");
      currentZoom = "daily";
      document
        .querySelectorAll(".zoom-btn")
        .forEach((b) => b.classList.remove("active"));
      const dailyBtn = document.querySelector(".zoom-btn[data-zoom='daily']");
      if (dailyBtn) dailyBtn.classList.add("active");

      document
        .querySelectorAll(".timeline-filter-btn")
        .forEach((b) => b.classList.remove("active"));
      const allFilter = document.querySelector(
        ".timeline-filter-btn[data-filter='All']",
      );
      if (allFilter) allFilter.classList.add("active");

      renderTimeline("All");

      setTimeout(() => {
        const targetKey = date.toLocaleDateString(undefined, {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        });
        const headers = document.querySelectorAll(".timeline-group-header");
        for (let h of headers) {
          if (h.textContent.includes(targetKey)) {
            const y = h.getBoundingClientRect().top + window.scrollY - 80; // Offset for top app bar
            window.scrollTo({ top: y, behavior: "smooth" });
            h.style.transition = "background 0.5s ease, color 0.5s ease";
            h.style.background = "var(--accent)";
            h.style.color = "white";

            // Auto-expand this specific date group
            const content = h.nextElementSibling;
            if (content && content.style.gridTemplateRows === "0fr") {
              h.click();
            }

            // Auto-expand all the timeline items inside it
            if (content) {
              const items = content.querySelectorAll(".timeline-item");
              items.forEach((item) => item.classList.add("expanded"));
            }

            setTimeout(() => {
              h.style.background = "";
              h.style.color = "";
            }, 1500);
            break;
          }
        }
      }, 100);
    });

    grid.appendChild(cell);
  }
}

function getOneRandomNoteObjForDomain(domain) {
  let notes = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.endsWith("_annotations") || key.endsWith("_reflections"))) {
      const parts = key.split("_");
      if (parts.length > 2 && parts[1] === domain) {
        try {
          const items = JSON.parse(localStorage.getItem(key) || "[]");
          items.forEach((item) => {
            const content = item.text || item.note;
            if (content && content.trim().length > 10) {
              notes.push({
                content: content.trim(),
                article: parts[parts.length - 2] || domain,
              });
            }
          });
        } catch (e) {}
      }
    }
  }
  if (notes.length === 0)
    return { content: `General concepts of ${domain}`, article: domain };
  return notes[Math.floor(Math.random() * notes.length)];
}

// ============================================================
// REFLECTION LENGTH TRACKER
// ============================================================
function renderReflectionTracker(viewRange = "all") {
  let container = document.getElementById("reflectionTrackerContainer");
  if (!container) return;

  // 1. Data Prep
  let reflections = (userLearningJourney.timeline || [])
    .filter(
      (t) => t.type === "Reflection",
    )
    .map((t) => {
      let cleanText = t.text || "";
      return {
        dateObj: new Date(t.date),
        dateStr: t.date,
        wordCount: cleanText.trim() ? cleanText.trim().split(/\s+/).length : 0,
        domain: t.domain,
        article: t.article,
        text: cleanText,
      };
    })
    .sort((a, b) => a.dateObj - b.dateObj);

  if (viewRange === "30days") {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    reflections = reflections.filter((r) => r.dateObj >= thirtyDaysAgo);
  }

  // Edge Cases
  if (reflections.length === 0) {
    container.innerHTML = `
      <h3>Reflection Depth Over Time</h3>
      <div style="padding: 24px; background: rgba(250, 248, 240, 0.05); border: 1px dashed var(--glass-border); border-radius: 16px; text-align: center;">
        <p style="color: var(--subtitle-color); font-size: 0.9rem; margin: 0;">Start writing reflections to see your growth here.</p>
      </div>
    `;
    return;
  }

  // Metrics Calc
  const totalWords = reflections.reduce((sum, r) => sum + r.wordCount, 0);
  const avgWords = Math.round(totalWords / reflections.length);
  const maxWords = Math.max(...reflections.map((r) => r.wordCount));
  const latestWords = reflections[reflections.length - 1].wordCount;

  // Trend calculation
  let trendHtml = "";
  if (reflections.length >= 4) {
    const half = Math.floor(reflections.length / 2);
    const firstHalf = reflections.slice(0, half);
    const secondHalf = reflections.slice(half);
    const firstAvg =
      firstHalf.reduce((s, r) => s + r.wordCount, 0) / firstHalf.length;
    const secondAvg =
      secondHalf.reduce((s, r) => s + r.wordCount, 0) / secondHalf.length;
    const percentChange =
      firstAvg > 0 ? Math.round(((secondAvg - firstAvg) / firstAvg) * 100) : 0;

    if (percentChange > 0) {
      trendHtml = `<span style="color: #6B8E23; font-weight: bold;">↑ Grew ${percentChange}%</span> vs previous`; // Sage green
    } else if (percentChange < 0) {
      trendHtml = `<span style="color: #e74c3c; font-weight: bold;">↓ Dropped ${Math.abs(percentChange)}%</span> vs previous`;
    } else {
      trendHtml = `<span style="color: var(--subtitle-color);">Stable</span>`;
    }
  }

  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 12px;">
      <h3 style="margin: 0;">Reflection Depth Over Time</h3>
      <div class="rfx-range">
        <button class="rfx-btn ${viewRange === "all" ? "active" : ""}" onclick="renderReflectionTracker('all')">All Time</button>
        <button class="rfx-btn ${viewRange === "30days" ? "active" : ""}" onclick="renderReflectionTracker('30days')">Last 30 Days</button>
      </div>
    </div>
    <div style="background: var(--glass-solid); border: 1px solid var(--glass-border); border-radius: var(--radius-xl); padding: 20px; box-shadow: var(--lift-shadow);">

      <div style="position: relative; height: 220px; width: 100%; margin-bottom: 24px;">
        <canvas id="reflectionChartCanvas" style="width: 100%; height: 100%; display: block;"></canvas>
        <div id="reflectionChartTooltip" style="position: absolute; opacity: 0; pointer-events: none; background: var(--glass-solid); border: 1px solid var(--glass-border); box-shadow: var(--lift-shadow-hover); padding: 12px; border-radius: var(--radius-md); z-index: 10; width: max-content; max-width: 250px; transform: translate(-50%, -100%); transition: opacity 0.2s ease;"></div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px;">
        <div style="padding: 14px 16px; background: var(--glass-bg); border-radius: var(--radius-md); border: 1px solid var(--glass-border);">
          <div style="font-size: 0.62rem; text-transform: uppercase; letter-spacing: 1.2px; color: var(--subtitle-color); font-weight: 700; margin-bottom: 6px;">Average Length</div>
          <div style="font-family: var(--article-font-family, Georgia, serif); font-size: 1.5rem; color: var(--dark-text); font-weight: 600;">${avgWords} <span style="font-family: 'Outfit', sans-serif; font-size: 0.72rem; font-weight: 500; color: var(--subtitle-color);">words</span></div>
        </div>
        <div style="padding: 14px 16px; background: var(--glass-bg); border-radius: var(--radius-md); border: 1px solid var(--glass-border);">
          <div style="font-size: 0.62rem; text-transform: uppercase; letter-spacing: 1.2px; color: var(--subtitle-color); font-weight: 700; margin-bottom: 6px;">Longest</div>
          <div style="font-family: var(--article-font-family, Georgia, serif); font-size: 1.5rem; color: var(--accent); font-weight: 600;">${maxWords} <span style="font-family: 'Outfit', sans-serif; font-size: 0.72rem; font-weight: 500; color: var(--subtitle-color);">words</span></div>
        </div>
        <div style="padding: 14px 16px; background: var(--glass-bg); border-radius: var(--radius-md); border: 1px solid var(--glass-border);">
          <div style="font-size: 0.62rem; text-transform: uppercase; letter-spacing: 1.2px; color: var(--subtitle-color); font-weight: 700; margin-bottom: 6px;">Most Recent</div>
          <div style="font-family: var(--article-font-family, Georgia, serif); font-size: 1.5rem; color: var(--dark-text); font-weight: 600;">${latestWords} <span style="font-family: 'Outfit', sans-serif; font-size: 0.72rem; font-weight: 500; color: var(--subtitle-color);">words</span></div>
        </div>
        ${
          trendHtml
            ? `
        <div style="padding: 14px 16px; background: var(--glass-bg); border-radius: var(--radius-md); border: 1px solid var(--glass-border);">
          <div style="font-size: 0.62rem; text-transform: uppercase; letter-spacing: 1.2px; color: var(--subtitle-color); font-weight: 700; margin-bottom: 6px;">Growth Trend</div>
          <div style="font-size: 0.95rem; margin-top: 8px;">${trendHtml}</div>
        </div>`
            : ""
        }
      </div>
    </div>
  `;

  const canvas = document.getElementById("reflectionChartCanvas");
  const ctx = canvas.getContext("2d");
  const tooltip = document.getElementById("reflectionChartTooltip");

  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * window.devicePixelRatio;
  canvas.height = rect.height * window.devicePixelRatio;
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

  const width = rect.width;
  const height = rect.height;
  const padLeft = 40;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 30;
  const innerWidth = width - padLeft - padRight;
  const innerHeight = height - padTop - padBottom;

  // Resolve theme colors once — canvas can't read CSS variables itself,
  // so the chart follows whatever theme/skin is active.
  const themeCss = getComputedStyle(document.body);
  const accentColor = themeCss.getPropertyValue("--accent").trim() || "#9e4632";
  const mutedColor =
    themeCss.getPropertyValue("--subtitle-color").trim() || "#737373";
  const surfaceColor =
    themeCss.getPropertyValue("--glass-solid").trim() || "#ffffff";

  // Turn any resolved CSS color into rgba() at a given opacity.
  const withAlpha = (color, a) => {
    ctx.save();
    ctx.fillStyle = color;
    const norm = ctx.fillStyle;
    ctx.restore();
    if (norm.startsWith("#")) {
      const r = parseInt(norm.slice(1, 3), 16);
      const g = parseInt(norm.slice(3, 5), 16);
      const b = parseInt(norm.slice(5, 7), 16);
      return `rgba(${r},${g},${b},${a})`;
    }
    const m = norm.match(/rgba?\(([^)]+)\)/);
    if (m) {
      const parts = m[1].split(",").map((s) => parseFloat(s));
      return `rgba(${parts[0]},${parts[1]},${parts[2]},${a})`;
    }
    return norm;
  };

  if (reflections.length === 1) {
    ctx.fillStyle = mutedColor;
    ctx.font = "13px Outfit, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      "Keep going! Write more reflections to form a trend line.",
      width / 2,
      height / 2,
    );
    return;
  }

  const maxWordVal = Math.max(10, Math.ceil(maxWords * 1.2));
  const points = [];
  const stepX = innerWidth / (reflections.length - 1);

  reflections.forEach((r, i) => {
    const x = padLeft + i * stepX;
    const y = padTop + innerHeight - (r.wordCount / maxWordVal) * innerHeight;
    points.push({ x, y, data: r });
  });

  const maxIndex = reflections.findIndex((r) => r.wordCount === maxWords);
  const fmtDate = (d) =>
    d.toLocaleDateString(undefined, { month: "short", day: "numeric" });

  let hoveredIndex = -1;
  let animProgress = 0;

  function drawChart() {
    ctx.clearRect(0, 0, width, height);

    // --- Grid: whisper-thin horizontal guides + soft labels ---
    ctx.font = "10px Outfit, sans-serif";
    for (let i = 0; i <= 3; i++) {
      const y = padTop + (innerHeight / 3) * i;
      ctx.strokeStyle = withAlpha(mutedColor, i === 3 ? 0.35 : 0.12);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(width - padRight, y);
      ctx.stroke();
      ctx.fillStyle = withAlpha(mutedColor, 0.8);
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(
        Math.round(maxWordVal - (maxWordVal / 3) * i),
        padLeft - 10,
        y,
      );
    }

    // --- X-axis date labels: first and last entry ---
    ctx.fillStyle = withAlpha(mutedColor, 0.8);
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    ctx.fillText(fmtDate(reflections[0].dateObj), padLeft, height - 8);
    ctx.textAlign = "right";
    ctx.fillText(
      fmtDate(reflections[reflections.length - 1].dateObj),
      width - padRight,
      height - 8,
    );

    // --- Average guide: dashed line at the mean depth ---
    const yAvg =
      padTop + innerHeight - (avgWords / maxWordVal) * innerHeight;
    ctx.save();
    ctx.setLineDash([4, 5]);
    ctx.strokeStyle = withAlpha(mutedColor, 0.45);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padLeft, yAvg);
    ctx.lineTo(width - padRight, yAvg);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = withAlpha(mutedColor, 0.75);
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    ctx.font = "9px Outfit, sans-serif";
    ctx.fillText("avg", width - padRight, yAvg - 3);
    ctx.font = "10px Outfit, sans-serif";

    // --- The curve, rising with the entry animation ---
    const yAt = (p) =>
      padTop + innerHeight - (padTop + innerHeight - p.y) * animProgress;

    ctx.beginPath();
    ctx.moveTo(points[0].x, yAt(points[0]));
    for (let i = 1; i < points.length; i++) {
      const currY = yAt(points[i]);
      const prevY = yAt(points[i - 1]);
      const cpx = points[i - 1].x + (points[i].x - points[i - 1].x) / 2;
      ctx.bezierCurveTo(cpx, prevY, cpx, currY, points[i].x, currY);
    }
    ctx.save();
    ctx.shadowColor = withAlpha(accentColor, 0.45);
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    ctx.restore();

    // --- Area fill under the curve ---
    const gradient = ctx.createLinearGradient(0, padTop, 0, height - padBottom);
    gradient.addColorStop(0, withAlpha(accentColor, 0.26));
    gradient.addColorStop(1, withAlpha(accentColor, 0));
    ctx.lineTo(points[points.length - 1].x, height - padBottom);
    ctx.lineTo(points[0].x, height - padBottom);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // --- Data points (skip when the series is dense) ---
    if (points.length <= 40) {
      points.forEach((p, i) => {
        const cy = yAt(p);
        if (i === hoveredIndex) {
          ctx.beginPath();
          ctx.arc(p.x, cy, 9, 0, Math.PI * 2);
          ctx.fillStyle = withAlpha(accentColor, 0.22);
          ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(p.x, cy, i === hoveredIndex ? 5 : 3.5, 0, Math.PI * 2);
        ctx.fillStyle = surfaceColor;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = accentColor;
        ctx.stroke();
      });
    }

    // --- Crown the deepest reflection ---
    if (maxIndex > -1 && animProgress >= 1 && maxIndex !== hoveredIndex) {
      const mp = points[maxIndex];
      ctx.fillStyle = accentColor;
      ctx.font = "bold 10px Outfit, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(String(maxWords), mp.x, mp.y - 10);
      ctx.font = "10px Outfit, sans-serif";
    }

    if (animProgress < 1) {
      animProgress = Math.min(1, animProgress + (1 - animProgress) * 0.14 + 0.01);
      requestAnimationFrame(drawChart);
    }
  }

  drawChart();

  // Interaction
  canvas.addEventListener("mousemove", (e) => {
    const rectCanvas = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rectCanvas.left;
    const mouseY = e.clientY - rectCanvas.top;

    let found = -1;
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      if (Math.hypot(mouseX - p.x, mouseY - p.y) < 15) {
        found = i;
        break;
      }
    }

    if (found !== hoveredIndex) {
      hoveredIndex = found;
      if (animProgress >= 1) drawChart();
      if (found > -1) {
        const p = points[found];
        tooltip.innerHTML = `
          <div style="font-size: 0.68rem; color: var(--subtitle-color); font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 2px;">${new Date(p.data.dateObj).toLocaleDateString()}</div>
          <div style="font-family: var(--article-font-family, Georgia, serif); font-size: 1.05rem; font-weight: 600; color: var(--accent); margin-bottom: 4px;">${p.data.wordCount} words</div>
          <div style="font-size: 0.8rem; color: var(--dark-text); white-space: normal; line-height: 1.3;">${p.data.article}</div>
          <div style="font-size: 0.68rem; color: var(--subtitle-color); margin-top: 6px; font-style: italic;">Click to view in timeline</div>
        `;
        tooltip.style.left = `${p.x}px`;
        tooltip.style.top = `${p.y - 15}px`;
        tooltip.style.opacity = "1";
        canvas.style.cursor = "pointer";
      } else {
        tooltip.style.opacity = "0";
        canvas.style.cursor = "default";
      }
    }
  });

  canvas.addEventListener("mouseleave", () => {
    hoveredIndex = -1;
    if (animProgress >= 1) drawChart();
    tooltip.style.opacity = "0";
    canvas.style.cursor = "default";
  });

  canvas.addEventListener("click", () => {
    if (hoveredIndex > -1) {
      const targetDateStr = points[hoveredIndex].data.dateStr;
      jumpToExactTimelineItem(targetDateStr);
    }
  });
}

// ============================================================
function initNeuralWeb() {
  document.body.classList.add("deep-work-active");
  if (document.getElementById("knowledgeEngineContainer")) return;

  // Create a dedicated container for the immersive graph view
  const engineContainer = document.createElement("div");
  engineContainer.id = "knowledgeEngineContainer";
  document.body.appendChild(engineContainer);

  engineContainer.innerHTML = `
    <style>
      @media (max-width: 767px) { #graphInfoBanner { display: none !important; } }
    </style>
    <div class="canvas-container" id="knowledgeGraphContainer">
      <canvas id="knowledgeGraphCanvas"></canvas>
      <button id="graphBackBtn" class="primary" style="position: absolute; top: max(20px, env(safe-area-inset-top, 40px)); left: 20px; display: none; z-index: 9999; box-shadow: 0 4px 12px rgba(0,0,0,0.3); align-items: center; gap: 8px; padding: 8px 16px; font-size: 0.9rem; cursor: pointer; pointer-events: auto; border: 1px solid rgba(255,255,255,0.1); background: rgba(20,20,20,0.6); backdrop-filter: blur(10px); border-radius: 20px;">
    <button id="graphBackBtn" class="primary" style="position: absolute; top: max(20px, env(safe-area-inset-top, 40px)); left: 20px; display: none; z-index: 9999; box-shadow: 0 4px 12px rgba(0,0,0,0.3); align-items: center; gap: 8px; padding: 8px 16px; font-size: 0.9rem; cursor: pointer; pointer-events: auto; border: 1px solid rgba(255,255,255,0.1); background: rgba(20,20,20,0.6); backdrop-filter: blur(10px); border-radius: 12px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg> Back
      </button>
      <div id="graphOverlayUI">
         <div class="graph-controls">
            <button id="graphExitBtn" class="secondary btn-sm"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg> Exit</button>
            <div class="graph-search-wrap">
               <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--subtitle-color)" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
               <input type="text" id="graphPathSearch" placeholder="Pathfinder A to B..." autocomplete="off">
            </div>
         </div>
         <div class="graph-timeline-wrap">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--subtitle-color)" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            <input type="range" id="graphTimeScrubber" min="0" max="100" value="100">
            <div class="timeline-date-display" id="graphTimeDisplay">Present</div>
         </div>
      </div>
      <div id="graphSidebar">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 20px;">
          <h2 id="sbTitle" style="margin:0; font-size:1.5rem; color:var(--accent);">Topic</h2>
        </div>
        <div id="sbStats" style="display:flex; gap:10px; margin-bottom: 20px;"></div>
        <h4 style="color:var(--subtitle-color); font-size:0.8rem; text-transform:uppercase; margin-bottom:10px;">Deep Dive</h4>
        <div id="sbArticles" style="display:flex; flex-direction:column; gap:10px;"></div>
      </div>
      <div id="graphTooltip">
         <h4 id="ttTitle">Topic</h4>
         <p id="ttStats">0 Notes</p>
      </div>
      <div id="graphContextMenu">
         <div class="ctx-item" id="ctxFocus">Focus Cluster</div>
      </div>
    </div>
  `;

  document.getElementById("graphExitBtn").addEventListener("click", (e) => {
    e.stopPropagation();
    document.body.classList.remove("deep-work-active");
    engineContainer.remove();
  });

  startKnowledgeEngine();
}

function startKnowledgeEngine() {
  const canvas = document.getElementById("knowledgeGraphCanvas");
  const ctx = canvas.getContext("2d");
  const container = document.getElementById("knowledgeGraphContainer");
  if (animationFrameId) cancelAnimationFrame(animationFrameId);

  let width = container.clientWidth;
  let height = container.clientHeight;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);

  window.addEventListener("resize", () => {
    width = container.clientWidth;
    height = container.clientHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
  });

  // Data Engine: Compile Intelligence
  const PALETTE = [
    "#E07A5F",
    "#3A7CA5",
    "#7D5BA6",
    "#5A7D5B",
    "#F1C40F",
    "#E84393",
    "#2ECC71",
    "#3498DB",
    "#E67E22",
  ];
  function getDomainColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++)
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return PALETTE[Math.abs(hash) % PALETTE.length];
  }

  const accentColor =
    getComputedStyle(document.body).getPropertyValue("--accent").trim() ||
    "#e07a5f";
  const sageColor =
    getComputedStyle(document.body).getPropertyValue("--sage").trim() ||
    "#8a9a9d";

  let nodes = [];
  let edges = [];
  const timeline = userLearningJourney.timeline;

  // Find first and last dates for scrubber
  let minDate = Date.now() - 30 * 86400000; // default 30 days ago
  if (timeline.length > 0) minDate = new Date(timeline[0].date).getTime();
  const maxDate = Date.now();
  let currentDateThreshold = Infinity;

  Object.keys(window.topicsData || {}).forEach((domain, i) => {
    const stats = userLearningJourney.topics[domain] || {
      articlesEngaged: 0,
      annotations: 0,
      reflections: 0,
    };

    // Find first interaction time
    const firstInt = timeline.find((t) => t.domain === domain);
    const createdAt = firstInt ? new Date(firstInt.date).getTime() : maxDate;
    const lastInt = [...timeline].reverse().find((t) => t.domain === domain);
    const lastActiveAt = lastInt ? new Date(lastInt.date).getTime() : 0;

    const daysSinceActive =
      lastActiveAt > 0 ? (maxDate - lastActiveAt) / 86400000 : Infinity;
    const recencyMultiplier =
      daysSinceActive < 30 ? 1 + 1.5 * (1 - daysSinceActive / 30) : 1;

    nodes.push({
      id: domain,
      type: "domain",
      x: (Math.random() - 0.5) * 800,
      y: (Math.random() - 0.5) * 800,
      z: (Math.random() - 0.5) * 200, // Depth
      vx: 0,
      vy: 0,
      vz: 0,
      baseRadius:
        (10 + stats.articlesEngaged * 2 + stats.annotations * 3) *
        recencyMultiplier,
      currentScale: 0,
      annotations: stats.annotations,
      articles: stats.articlesEngaged,
      createdAt,
      lastActiveAt,
      pulseTime: 0,
      color: getDomainColor(domain),
    });
  });

  // Extract and compile all notes and reflections as 3D orbital satellites
  Object.keys(window.topicsData || {}).forEach((domain) => {
    const domainNode = nodes.find((n) => n.id === domain);
    if (!domainNode) return;

    Object.keys(window.topicsData[domain].subtopics || {}).forEach((s) => {
      Object.keys(
        window.topicsData[domain].subtopics[s].articles || {},
      ).forEach((a) => {
        const key = `article_${domain}_${s}_${a}`;
        const notes = JSON.parse(
          localStorage.getItem(key + "_annotations") || "[]",
        );
        const refs = JSON.parse(
          localStorage.getItem(key + "_reflections") || "[]",
        );

        notes.forEach((note) => {
          const nId = "note_" + note.id;
          const createdAt = new Date(note.created || Date.now()).getTime();
          const daysSince = (maxDate - createdAt) / 86400000;
          const recencyMultiplier =
            daysSince < 30 ? 1 + 1.0 * (1 - daysSince / 30) : 1;

          const nodeObj = {
            id: nId,
            type: "note",
            parentId: domain,
            text: note.note || "Highlighted Passage",
            x: domainNode.x + (Math.random() - 0.5) * 100,
            y: domainNode.y + (Math.random() - 0.5) * 100,
            z: domainNode.z + (Math.random() - 0.5) * 100,
            vx: 0,
            vy: 0,
            vz: 0,
            baseRadius: 4 * recencyMultiplier,
            currentScale: 0,
            createdAt: createdAt,
            lastActiveAt: createdAt,
            pulseTime: 0,
            color: accentColor,
          };
          nodes.push(nodeObj);
          edges.push({
            source: domainNode,
            target: nodeObj,
            weight: 2,
            type: "parent-child",
            createdAt: nodeObj.createdAt,
          });
        });

        refs.forEach((ref) => {
          const rId = "ref_" + ref.id;
          const createdAt = new Date(ref.created || Date.now()).getTime();
          const daysSince = (maxDate - createdAt) / 86400000;
          const recencyMultiplier =
            daysSince < 30 ? 1 + 1.0 * (1 - daysSince / 30) : 1;

          const nodeObj = {
            id: rId,
            type: "reflection",
            parentId: domain,
            text: ref.text || "Reflection",
            x: domainNode.x + (Math.random() - 0.5) * 100,
            y: domainNode.y + (Math.random() - 0.5) * 100,
            z: domainNode.z + (Math.random() - 0.5) * 100,
            vx: 0,
            vy: 0,
            vz: 0,
            baseRadius: 6 * recencyMultiplier,
            currentScale: 0,
            createdAt: createdAt,
            lastActiveAt: createdAt,
            pulseTime: 0,
            color: sageColor,
          };
          nodes.push(nodeObj);
          edges.push({
            source: domainNode,
            target: nodeObj,
            weight: 3,
            type: "parent-child",
            createdAt: nodeObj.createdAt,
          });
        });
      });
    });
  });

  // Connection Engine: Temporal & Conceptual Intelligence
  const edgeMap = {};
  for (let i = 1; i < timeline.length; i++) {
    const prev = timeline[i - 1];
    const curr = timeline[i];
    if (
      prev.domain !== curr.domain &&
      prev.domain !== "Cross-Domain" &&
      curr.domain !== "Cross-Domain" &&
      prev.domain !== "Milestone" &&
      curr.domain !== "Milestone"
    ) {
      const key = [prev.domain, curr.domain].sort().join("::");
      const tDiff = new Date(curr.date) - new Date(prev.date);
      const isConceptual = curr.type.includes("Synthesis");

      if (!edgeMap[key]) {
        edgeMap[key] = {
          sourceId: prev.domain,
          targetId: curr.domain,
          weight: 0,
          type: "temporal",
          createdAt: new Date(curr.date).getTime(),
        };
      }

      if (isConceptual) {
        edgeMap[key].type = "conceptual"; // Upgrade to conceptual overlap
        edgeMap[key].weight += 3;
      } else if (tDiff < 86400000) {
        // Read within 24 hours
        edgeMap[key].weight += 1;
      }
    }
  }

  Object.values(edgeMap).forEach((e) => {
    const s = nodes.find((n) => n.id === e.sourceId);
    const t = nodes.find((n) => n.id === e.targetId);
    if (s && t)
      edges.push({
        source: s,
        target: t,
        weight: Math.min(e.weight, 5),
        type: e.type,
        createdAt: e.createdAt,
      });
  });

  // Physics & Camera State
  let camera = {
    x: 0,
    y: 0,
    z: -400,
    targetX: 0,
    targetY: 0,
    zoom: 1,
    rotX: 0,
    rotY: 0,
    targetRotX: 0,
    targetRotY: 0,
  };
  let isDragging = false;
  let lastMouse = { x: 0, y: 0 };
  let mousePos = { x: -1000, y: -1000 };
  let initialPinchDistance = null;
  let hoveredNode = null;
  let activePathNodes = new Set();
  let focusedClusterNode = null;
  let contextMenuNode = null;

  function exitDeepDive() {
    focusedClusterNode = null;
    camera.targetX = 0;
    camera.targetY = 0;
    camera.zoom = 1;
    camera.targetRotX = 0;
    camera.targetRotY = 0;
    const backBtn = document.getElementById("graphBackBtn");
    if (backBtn) backBtn.style.display = "none";
    sidebar.classList.remove("open");
  }

  const backBtn = document.getElementById("graphBackBtn");
  if (backBtn) {
    backBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      exitDeepDive();
    });
    backBtn.addEventListener(
      "touchstart",
      (e) => {
        e.stopPropagation();
      },
      { passive: true },
    );
  }

  // Public function to pulse graph externally
  window.triggerGraphPulse = (domainId) => {
    const n = nodes.find((x) => x.id === domainId);
    if (n) n.pulseTime = 30; // 30 frames of pulsing
  };

  // Dijkstra Pathfinding
  function findShortestPath(startId, endId) {
    const dist = {};
    const prev = {};
    const unvisited = new Set();
    nodes.forEach((n) => {
      dist[n.id] = Infinity;
      unvisited.add(n.id);
    });
    dist[startId] = 0;

    while (unvisited.size > 0) {
      let u = null;
      unvisited.forEach((id) => {
        if (!u || dist[id] < dist[u]) u = id;
      });
      if (dist[u] === Infinity || u === endId) break;
      unvisited.delete(u);

      edges.forEach((e) => {
        if (e.createdAt > currentDateThreshold) return;
        let v = null;
        if (e.source.id === u) v = e.target.id;
        if (e.target.id === u) v = e.source.id;
        if (v && unvisited.has(v)) {
          const alt = dist[u] + 1;
          if (alt < dist[v]) {
            dist[v] = alt;
            prev[v] = u;
          }
        }
      });
    }

    const path = new Set();
    let curr = endId;
    if (prev[curr] || curr === startId) {
      while (curr) {
        path.add(curr);
        curr = prev[curr];
      }
    }
    return path;
  }

  // UI Controls
  const searchInput = document.getElementById("graphPathSearch");
  searchInput.addEventListener("input", (e) => {
    const parts = e.target.value.toLowerCase().split(" to ");
    activePathNodes.clear();
    if (parts.length === 2) {
      const n1 = nodes.find((n) =>
        n.id.toLowerCase().includes(parts[0].trim()),
      );
      const n2 = nodes.find((n) =>
        n.id.toLowerCase().includes(parts[1].trim()),
      );
      if (n1 && n2 && n1 !== n2)
        activePathNodes = findShortestPath(n1.id, n2.id);
    }
  });

  const scrubber = document.getElementById("graphTimeScrubber");
  const timeDisplay = document.getElementById("graphTimeDisplay");

  scrubber.addEventListener(
    "mousedown",
    () => (timeDisplay.style.color = "var(--accent)"),
  );
  scrubber.addEventListener(
    "touchstart",
    () => (timeDisplay.style.color = "var(--accent)"),
    { passive: true },
  );
  window.addEventListener("mouseup", () => (timeDisplay.style.color = ""));
  window.addEventListener("touchend", () => (timeDisplay.style.color = ""));

  let fadeTimeout;
  scrubber.addEventListener("input", (e) => {
    const pct = e.target.value / 100;
    let newText = "";
    if (pct > 0.98) {
      currentDateThreshold = Infinity;
      newText = "Present";
    } else {
      currentDateThreshold = minDate + (maxDate - minDate) * pct;
      newText = new Date(currentDateThreshold).toLocaleDateString(undefined, {
        month: "short",
        year: "numeric",
      });
    }
    if (timeDisplay.textContent !== newText) {
      if (timeDisplay.textContent === "Present" || newText === "Present") {
        timeDisplay.style.opacity = "0";
        clearTimeout(fadeTimeout);
        fadeTimeout = setTimeout(() => {
          timeDisplay.textContent = newText;
          timeDisplay.style.opacity = "1";
        }, 150);
      } else {
        timeDisplay.textContent = newText;
      }
    }
  });

  document.getElementById("ctxFocus").addEventListener("click", () => {
    if (contextMenuNode) {
      focusedClusterNode = contextMenuNode;
      camera.targetX = focusedClusterNode.x;
      camera.targetY = focusedClusterNode.y;
      camera.zoom = 2.0;
    }
    ctxMenu.style.display = "none";
  });

  // Interactions
  const tooltip = document.getElementById("graphTooltip");
  const sidebar = document.getElementById("graphSidebar");
  const ctxMenu = document.getElementById("graphContextMenu");

  // Mobile Swipe-to-Dismiss for Sidebar
  let sidebarStartX = -1;
  let sidebarStartY = -1;
  let sidebarCurrentX = 0;
  let isSwipingSidebar = false;

  sidebar.addEventListener(
    "touchstart",
    (e) => {
      sidebarStartX = e.touches[0].clientX;
      sidebarStartY = e.touches[0].clientY;
      sidebarCurrentX = sidebarStartX;
      isSwipingSidebar = false;
    },
    { passive: true },
  );

  sidebar.addEventListener(
    "touchmove",
    (e) => {
      if (sidebarStartX !== -1) {
        sidebarCurrentX = e.touches[0].clientX;
        const currentY = e.touches[0].clientY;
        const deltaX = sidebarCurrentX - sidebarStartX;
        const deltaY = Math.abs(currentY - sidebarStartY);

        if (!isSwipingSidebar && deltaX > 10 && deltaX > deltaY) {
          isSwipingSidebar = true;
        }

        if (isSwipingSidebar && deltaX > 0) {
          sidebar.style.transform = `translateX(${deltaX}px)`;
          sidebar.style.transition = "none";
        }
      }
    },
    { passive: true },
  );

  sidebar.addEventListener("touchend", (e) => {
    if (sidebarStartX !== -1) {
      const deltaX = sidebarCurrentX - sidebarStartX;
      sidebar.style.transform = "";
      sidebar.style.transition = "";

      if (isSwipingSidebar && deltaX > 75) {
        sidebar.classList.remove("open");
      }
    }
    sidebarStartX = -1;
    isSwipingSidebar = false;
  });

  canvas.addEventListener("mousedown", (e) => {
    isDragging = true;
    lastMouse = { x: e.clientX, y: e.clientY };
    if (ctxMenu.style.display === "block") ctxMenu.style.display = "none";
  });
  window.addEventListener("mouseup", () => (isDragging = false));
  canvas.addEventListener("mousemove", (e) => {
    if (isDragging) {
      if (e.shiftKey || e.buttons === 2) {
        camera.targetX -= (e.clientX - lastMouse.x) / camera.zoom;
        camera.targetY -= (e.clientY - lastMouse.y) / camera.zoom;
      } else {
        camera.targetRotY += (e.clientX - lastMouse.x) * 0.005;
        camera.targetRotX += (e.clientY - lastMouse.y) * 0.005;
      }
      lastMouse = { x: e.clientX, y: e.clientY };
      tooltip.style.opacity = 0;
    } else {
      const rect = canvas.getBoundingClientRect();
      mousePos.x = e.clientX - rect.left;
      mousePos.y = e.clientY - rect.top;
    }
  });

  let touchStartX = 0;
  let touchStartY = 0;

  canvas.style.touchAction = "none";
  canvas.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length === 2) {
        isDragging = false;
        initialPinchDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        );
      } else if (e.touches.length === 1) {
        isDragging = false; // Do not drag until they actually move their finger
        initialPinchDistance = null;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        lastMouse = { x: touchStartX, y: touchStartY };
      }
    },
    { passive: true },
  );
  canvas.addEventListener(
    "touchmove",
    (e) => {
      if (e.touches.length === 2 && initialPinchDistance !== null) {
        const currentDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        );
        const delta = currentDistance / initialPinchDistance;
        camera.zoom *= delta;
        camera.zoom = Math.max(0.2, Math.min(camera.zoom, 3));
        initialPinchDistance = currentDistance;
        tooltip.style.opacity = 0;
      } else if (e.touches.length === 1) {
        const dx = e.touches[0].clientX - touchStartX;
        const dy = e.touches[0].clientY - touchStartY;
        if (Math.hypot(dx, dy) > 15) {
          // Must move 15px to be considered a camera drag (prevents fat-finger tap cancellations)
          isDragging = true;
          camera.targetRotY += (e.touches[0].clientX - lastMouse.x) * 0.005;
          camera.targetRotX += (e.touches[0].clientY - lastMouse.y) * 0.005;
        }
        lastMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        tooltip.style.opacity = 0;
      }
    },
    { passive: true },
  );

  function getNodeAt(clientX, clientY) {
    if (!window.lastRenderNodes) return null;
    const rect = canvas.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;
    let foundNode = null;
    let nearest = Infinity;
    window.lastRenderNodes.forEach((rn) => {
      const dist = Math.hypot(mx - rn.screenX, my - rn.screenY);
      if (dist < rn.screenR + 25 && dist < nearest) {
        // Larger hit area for easier tapping
        nearest = dist;
        foundNode = rn.n;
      }
    });
    return foundNode;
  }

  function triggerGraphSingleClick(clickedNode) {
    if (clickedNode && clickedNode.type !== "domain") {
      clickedNode =
        nodes.find((n) => n.id === clickedNode.parentId) || clickedNode;
    }
    if (clickedNode) {
      document.getElementById("sbTitle").textContent = clickedNode.id;
      document.getElementById("sbStats").innerHTML = `
        <div style="background:var(--glass-border); padding:6px 12px; border-radius:12px; font-size:0.8rem; color:var(--dark-text);"><strong>${clickedNode.articles}</strong> Reads</div>
        <div style="background:rgba(224, 122, 95, 0.1); padding:6px 12px; border-radius:12px; font-size:0.8rem; color:var(--accent);"><strong>${clickedNode.annotations}</strong> Notes</div>
        <div style="background:var(--glass-border); padding:6px 12px; border-radius:8px; font-size:0.8rem; color:var(--dark-text);"><strong>${clickedNode.articles}</strong> Reads</div>
        <div style="background:rgba(224, 122, 95, 0.1); padding:6px 12px; border-radius:8px; font-size:0.8rem; color:var(--accent);"><strong>${clickedNode.annotations}</strong> Notes</div>
      `;

      const articlesDiv = document.getElementById("sbArticles");
      articlesDiv.innerHTML = "";
      const domainData = window.topicsData[clickedNode.id];
      if (domainData) {
        Object.keys(domainData.subtopics || {}).forEach((s) => {
          Object.keys(domainData.subtopics[s].articles || {}).forEach((a) => {
            articlesDiv.innerHTML += `
              <div style="padding:10px; background:rgba(0,0,0,0.02); border:1px solid var(--glass-border); border-radius:8px; cursor:pointer;" onclick="navigateToArticleFromGraph('${clickedNode.id}','${s}','${a}')">
                <div style="font-size:0.85rem; font-weight:bold; color:var(--dark-text);">${a}</div>
              </div>`;
          });
        });
      }
      sidebar.classList.add("open");
    } else {
      sidebar.classList.remove("open");
    }
  }

  function triggerGraphDoubleClick(clickedNode) {
    if (clickedNode && clickedNode.type !== "domain") {
      clickedNode =
        nodes.find((n) => n.id === clickedNode.parentId) || clickedNode;
    }
    const backBtn = document.getElementById("graphBackBtn");

    if (clickedNode) {
      focusedClusterNode = clickedNode;
      camera.targetX = focusedClusterNode.x;
      camera.targetY = focusedClusterNode.y;
      camera.zoom = 2.0;
      if (backBtn) backBtn.style.display = "flex";

      // Populate sidebar with all notes & reflections for this topic
      document.getElementById("sbTitle").textContent =
        clickedNode.id + " Insights";
      const articlesDiv = document.getElementById("sbArticles");
      articlesDiv.innerHTML = "";
      let hasInsights = false;

      const domainData = window.topicsData[clickedNode.id];
      if (domainData) {
        Object.keys(domainData.subtopics || {}).forEach((s) => {
          Object.keys(domainData.subtopics[s].articles || {}).forEach((a) => {
            const key = `article_${clickedNode.id}_${s}_${a}`;
            const notes = JSON.parse(
              localStorage.getItem(key + "_annotations") || "[]",
            );
            const refs = JSON.parse(
              localStorage.getItem(key + "_reflections") || "[]",
            );

            if (notes.length > 0 || refs.length > 0) {
              hasInsights = true;
              articlesDiv.innerHTML += `<div style="margin-top:15px; font-size:0.75rem; color:var(--subtitle-color); text-transform:uppercase; font-weight:bold;">From: ${a}</div>`;
              notes.forEach((n) => {
                articlesDiv.innerHTML += `
                  <div style="padding:10px; background:rgba(224, 122, 95, 0.05); border-radius:4px; margin-top:8px;">
                    ${n.text ? `<div style="font-size:0.8rem; font-style:italic; color:var(--subtitle-color); margin-bottom:4px;">"${n.text}"</div>` : ""}
                    <div style="font-size:0.85rem; color:var(--dark-text);">${n.note}</div>
                  </div>`;
              });
              refs.forEach((r) => {
                articlesDiv.innerHTML += `
                  <div style="padding:10px; background:rgba(138, 154, 157, 0.05); border-radius:4px; margin-top:8px;">
                    <div style="font-size:0.75rem; color:var(--sage); font-weight:bold; text-transform:uppercase; margin-bottom:4px;">Reflection</div>
                    <div style="font-size:0.85rem; color:var(--dark-text);">${r.text}</div>
                  </div>`;
              });
            }
          });
        });
      }
      if (!hasInsights) {
        articlesDiv.innerHTML = `<div style="padding:10px; color:var(--subtitle-color); font-size:0.85rem;">No notes or reflections in this topic yet.</div>`;
      }
      document.getElementById("graphSidebar").classList.add("open");
    } else {
      exitDeepDive();
    }
  }

  let lastTouchTime = 0;
  let singleTouchTimeout = null;
  canvas.addEventListener(
    "touchend",
    (e) => {
      if (e.cancelable) e.preventDefault(); // Safely prevent duplicate ghost click events on mobile without throwing a passive listener error
      if (e.touches.length === 0) {
        if (!isDragging) {
          const now = Date.now();
          const clickedNode =
            getNodeAt(lastMouse.x, lastMouse.y) || hoveredNode;
          if (now - lastTouchTime < 450) {
            clearTimeout(singleTouchTimeout);
            triggerGraphDoubleClick(clickedNode);
            lastTouchTime = 0;
          } else {
            lastTouchTime = now;
            singleTouchTimeout = setTimeout(() => {
              triggerGraphSingleClick(clickedNode);
            }, 450);
          }
        }
        isDragging = false;
        initialPinchDistance = null;
      }
    },
    { passive: false },
  );

  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    camera.zoom *= Math.pow(0.999, e.deltaY);
    camera.zoom = Math.max(0.2, Math.min(camera.zoom, 3));
  });

  let singleClickTimeout = null;
  canvas.addEventListener("click", (e) => {
    clearTimeout(singleClickTimeout);
    const clickedNode = getNodeAt(e.clientX, e.clientY) || hoveredNode;
    singleClickTimeout = setTimeout(() => {
      triggerGraphSingleClick(clickedNode);
    }, 250);
  });

  canvas.addEventListener("dblclick", (e) => {
    clearTimeout(singleClickTimeout);
    triggerGraphDoubleClick(getNodeAt(e.clientX, e.clientY) || hoveredNode);
  });

  canvas.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    if (hoveredNode) {
      contextMenuNode = hoveredNode;
      ctxMenu.style.left = e.clientX + "px";
      ctxMenu.style.top = e.clientY + "px";
      ctxMenu.style.display = "block";
    }
  });

  // Main 2.5D Render Loop
  let time = 0;
  function frame() {
    time += 0.05;
    ctx.clearRect(0, 0, width, height);

    camera.x += (camera.targetX - camera.x) * 0.1;
    camera.y += (camera.targetY - camera.y) * 0.1;
    camera.rotX += (camera.targetRotX - camera.rotX) * 0.1;
    camera.rotY += (camera.targetRotY - camera.rotY) * 0.1;

    if (!isDragging) camera.targetRotY += 0.001; // Cinematic auto-rotation

    const cx = width / 2;
    const cy = height / 2;
    const focalLength = 800;
    const cosY = Math.cos(camera.rotY);
    const sinY = Math.sin(camera.rotY);
    const cosX = Math.cos(camera.rotX);
    const sinX = Math.sin(camera.rotX);

    // Physics Engine
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].createdAt > currentDateThreshold) continue;

      const isActiveI =
        nodes[i].type === "domain" ||
        (focusedClusterNode && nodes[i].parentId === focusedClusterNode.id);
      if (!isActiveI) continue;

      for (let j = i + 1; j < nodes.length; j++) {
        if (nodes[j].createdAt > currentDateThreshold) continue;

        const isActiveJ =
          nodes[j].type === "domain" ||
          (focusedClusterNode && nodes[j].parentId === focusedClusterNode.id);
        if (!isActiveJ) continue;

        let dx = nodes[i].x - nodes[j].x;
        let dy = nodes[i].y - nodes[j].y;
        let dz = nodes[i].z - nodes[j].z;
        let distSq = dx * dx + dy * dy + dz * dz;
        if (distSq < 1) distSq = 1;

        let repulsion = 40000;
        if (nodes[i].type !== "domain" || nodes[j].type !== "domain")
          repulsion = 2000;

        let force = repulsion / distSq;
        let d = Math.sqrt(distSq);
        nodes[i].vx += (dx / d) * force;
        nodes[i].vy += (dy / d) * force;
        nodes[i].vz += (dz / d) * force;
        nodes[j].vx -= (dx / d) * force;
        nodes[j].vy -= (dy / d) * force;
        nodes[j].vz -= (dz / d) * force;
      }

      // Center gravity
      nodes[i].vx += -nodes[i].x * 0.005;
      nodes[i].vy += -nodes[i].y * 0.005;
      nodes[i].vz += -nodes[i].z * 0.005;
    }

    edges.forEach((e) => {
      if (
        e.createdAt > currentDateThreshold ||
        e.source.createdAt > currentDateThreshold ||
        e.target.createdAt > currentDateThreshold
      )
        return;

      if (
        e.type === "parent-child" &&
        (!focusedClusterNode || e.source.id !== focusedClusterNode.id)
      )
        return;

      let dx = e.target.x - e.source.x;
      let dy = e.target.y - e.source.y;
      let dz = e.target.z - e.source.z;
      let dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist < 1) dist = 1;

      let targetDist = e.type === "parent-child" ? 60 : 150;
      let force = (dist - targetDist) * 0.01 * e.weight;

      e.source.vx += (dx / dist) * force;
      e.source.vy += (dy / dist) * force;
      e.source.vz += (dz / dist) * force;
      e.target.vx -= (dx / dist) * force;
      e.target.vy -= (dy / dist) * force;
      e.target.vz -= (dz / dist) * force;
    });

    // Prepare Render List
    let renderNodes = [];
    hoveredNode = null;
    let nearestD = Infinity;
    let hoveredScreenX = 0;
    let hoveredScreenY = 0;

    nodes.forEach((n) => {
      if (n.createdAt > currentDateThreshold) return;

      // Hide satellites unless their parent is actively focused
      if (n.type !== "domain") {
        if (!focusedClusterNode || focusedClusterNode.id !== n.parentId) {
          n.currentScale = 0; // Reset scale so it blooms next time
          const parent = nodes.find((dom) => dom.id === n.parentId);
          if (parent) {
            n.x = parent.x + (Math.random() - 0.5) * 10;
            n.y = parent.y + (Math.random() - 0.5) * 10;
            n.z = parent.z + (Math.random() - 0.5) * 10;
            n.vx = 0;
            n.vy = 0;
            n.vz = 0;
          }
          return;
        }
      }

      n.vx *= 0.85;
      n.vy *= 0.85;
      n.vz *= 0.85;
      n.currentScale += (1 - n.currentScale) * 0.08; // Smooth bloom animation
      n.x += n.vx;
      n.y += n.vy;
      n.z += n.vz;
      if (n.pulseTime > 0) n.pulseTime--;

      // 2.5D Projection
      let px = n.x,
        py = n.y,
        pz = n.z;
      let rx1 = px * cosY - pz * sinY;
      let rz1 = pz * cosY + px * sinY;
      let ry1 = py;
      let ry2 = ry1 * cosX - rz1 * sinX;
      let rz2 = rz1 * cosX + ry1 * sinX;
      let rx2 = rx1;

      const depth = focalLength + rz2 - camera.z;
      if (depth <= 0) return;
      const scale = (focalLength / depth) * camera.zoom;
      const screenX = cx + (rx2 - camera.x) * scale;
      const screenY = cy + (ry2 - camera.y) * scale;
      const screenR = n.baseRadius * scale * n.currentScale;

      if (!isDragging) {
        const mDist = Math.sqrt(
          Math.pow(mousePos.x - screenX, 2) + Math.pow(mousePos.y - screenY, 2),
        );
        if (mDist < screenR + 10 && mDist < nearestD) {
          hoveredNode = n;
          nearestD = mDist;
          hoveredScreenX = screenX;
          hoveredScreenY = screenY;
        }
      }

      renderNodes.push({ n, screenX, screenY, screenR, scale, z: rz2 });
    });

    window.lastRenderNodes = renderNodes;

    // Unified True 3D Z-Sorting Queue
    let renderQueue = [];
    let clusterNodes = new Set();
    if (focusedClusterNode) {
      clusterNodes.add(focusedClusterNode.id);
      edges.forEach((e) => {
        if (e.source.id === focusedClusterNode.id)
          clusterNodes.add(e.target.id);
        if (e.target.id === focusedClusterNode.id)
          clusterNodes.add(e.source.id);
      });
    }

    renderNodes.forEach((rn) => {
      renderQueue.push({ type: "node", z: rn.z, data: rn });
    });

    edges.forEach((e) => {
      if (
        e.createdAt > currentDateThreshold ||
        e.source.createdAt > currentDateThreshold ||
        e.target.createdAt > currentDateThreshold
      )
        return;
      if (
        e.type === "parent-child" &&
        (!focusedClusterNode || e.source.id !== focusedClusterNode.id)
      )
        return;

      const s = renderNodes.find((r) => r.n === e.source);
      const t = renderNodes.find((r) => r.n === e.target);
      if (!s || !t) return;

      const inPath =
        activePathNodes.has(e.source.id) && activePathNodes.has(e.target.id);
      if (activePathNodes.size > 0 && !inPath) return; // Hide non-path if searching

      // Z-index of the line is the average depth of its two connecting nodes
      renderQueue.push({ type: "edge", z: (s.z + t.z) / 2, s, t, e, inPath });
    });

    renderQueue.sort((a, b) => b.z - a.z); // Draw everything back to front

    // Draw Loop
    renderQueue.forEach((item) => {
      if (item.type === "edge") {
        const { s, t, e, inPath, z } = item;

        const edgeDepth = focalLength + z - camera.z;
        const edgeScale =
          edgeDepth > 0 ? (focalLength / edgeDepth) * camera.zoom : 0;
        ctx.lineWidth = Math.max(0.2, 2.0 * edgeScale);

        const dx = t.screenX - s.screenX;
        const dy = t.screenY - s.screenY;
        const dist = Math.hypot(dx, dy);

        // Mathematically truncate line to stop EXACTLY at the 3D sphere's border
        const sHover = hoveredNode === s.n ? 4 * s.scale : 0;
        const tHover = hoveredNode === t.n ? 4 * t.scale : 0;
        const sRadius = Math.max(
          0.1,
          s.screenR + sHover + s.n.pulseTime * s.scale * 0.5,
        );
        const tRadius = Math.max(
          0.1,
          t.screenR + tHover + t.n.pulseTime * t.scale * 0.5,
        );

        if (dist <= sRadius + tRadius) return; // Spheres overlap entirely, hide line

        const startX = s.screenX + (dx / dist) * sRadius;
        const startY = s.screenY + (dy / dist) * sRadius;
        const endX = t.screenX - (dx / dist) * tRadius;
        const endY = t.screenY - (dy / dist) * tRadius;

        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);

        // Render 3D gradient light beams
        const lineGrad = ctx.createLinearGradient(startX, startY, endX, endY);
        let startColor = "rgba(255,255,255,0.08)";
        let endColor = "rgba(255,255,255,0.08)";

        if (inPath) {
          startColor = "#f1c40f";
          endColor = "#f1c40f";
        } else if (e.type === "conceptual") {
          startColor = "rgba(138, 154, 157, 0.4)";
          endColor = "rgba(138, 154, 157, 0.4)";
        } else if (e.type === "temporal") {
          startColor = "rgba(224, 122, 95, 0.3)";
          endColor = "rgba(224, 122, 95, 0.3)";
        } else if (e.type === "parent-child") {
          startColor = "rgba(255, 255, 255, 0.3)";
          endColor = "rgba(255, 255, 255, 0)"; // Fades out towards satellite
        }
        lineGrad.addColorStop(0, startColor);
        lineGrad.addColorStop(1, endColor);

        let edgeAlpha = 1;
        if (
          focusedClusterNode &&
          item.s.n.id !== focusedClusterNode.id &&
          item.t.n.id !== focusedClusterNode.id &&
          e.type !== "parent-child"
        )
          edgeAlpha = 0.05;

        ctx.globalAlpha = edgeAlpha;
        ctx.strokeStyle = lineGrad;

        if (inPath) {
          ctx.shadowBlur = 10 * edgeScale;
          ctx.shadowColor = "#f1c40f";
        }

        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      } else {
        const { n, screenX, screenY, screenR, scale } = item.data;
        const isHovered = hoveredNode === n;
        const inPath = activePathNodes.has(n.id);

        let opacity = 1;
        let fill = n.color;
        const age = (maxDate - n.lastActiveAt) / 86400000;
        if (age > 30) opacity = 0.4;
        else if (age > 7) opacity = 0.7;

        if (activePathNodes.size > 0 && !inPath) opacity *= 0.1;
        if (
          focusedClusterNode &&
          !clusterNodes.has(n.id) &&
          n.parentId !== focusedClusterNode.id
        )
          opacity *= 0.05;

        ctx.globalAlpha = opacity;
        const finalRadius =
          screenR + (isHovered ? 4 * scale : 0) + n.pulseTime * scale * 0.5;
        const safeRadius = Math.max(0.1, finalRadius);

        ctx.beginPath();
        ctx.arc(screenX, screenY, safeRadius, 0, Math.PI * 2);

        // True 3D Sphere Shader (Specular Hotspot + Core Shadow + Bounce Rim Light)
        const gradient = ctx.createRadialGradient(
          screenX - safeRadius * 0.3,
          screenY - safeRadius * 0.3,
          safeRadius * 0.05,
          screenX,
          screenY,
          safeRadius,
        );
        gradient.addColorStop(0, "#ffffff"); // Sharp specular highlight
        gradient.addColorStop(0.15, "rgba(255, 255, 255, 0.4)"); // Glossy falloff
        gradient.addColorStop(0.3, fill); // True domain color
        gradient.addColorStop(0.75, "rgba(0, 0, 0, 0.8)"); // Deep core shadow
        gradient.addColorStop(1, fill); // Ambient bounce/rim light on the edge

        ctx.fillStyle = gradient;
        if (n.pulseTime > 0 || isHovered || inPath) {
          ctx.shadowBlur = 20 * scale;
          ctx.shadowColor = fill;
        }
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
        ctx.lineWidth = 1.5 * scale;
        ctx.stroke();

        if (n.type === "domain" || isHovered) {
          const labelAlpha = isHovered || inPath ? 1 : Math.max(0.2, scale);
          if (labelAlpha > 0.1 && opacity > 0.1) {
            ctx.font = `${isHovered ? "bold " : "600 "}${12 * Math.max(0.7, scale)}px Outfit`;
            ctx.fillStyle = `rgba(255,255,255,${labelAlpha * opacity})`;
            ctx.textAlign = "center";
            ctx.shadowBlur = 4;
            ctx.shadowColor = "rgba(0,0,0,0.8)";
            let textToShow = n.id;
            if (n.type === "note") textToShow = "Highlight";
            else if (n.type === "reflection") textToShow = "Reflection";
            else if (n.type === "synthesis") textToShow = "Synthesis";
            ctx.fillText(textToShow, screenX, screenY + screenR + 15 * scale);
            ctx.shadowBlur = 0;
          }
        }
        ctx.globalAlpha = 1;
      }
    });

    // Tooltip Sync
    if (hoveredNode && !isDragging) {
      const ttWidth = tooltip.offsetWidth || 200;
      let ttLeft = hoveredScreenX + 20;
      if (ttLeft + ttWidth > window.innerWidth)
        ttLeft = hoveredScreenX - ttWidth - 20;

      tooltip.style.left = ttLeft + "px";
      tooltip.style.top = hoveredScreenY - 20 + "px";
      if (hoveredNode.type === "domain") {
        document.getElementById("ttTitle").textContent = hoveredNode.id;
        document.getElementById("ttStats").textContent =
          `${hoveredNode.articles} Articles · ${hoveredNode.annotations} Notes`;
      } else {
        let tTitle = "Highlight";
        if (hoveredNode.type === "reflection") tTitle = "Reflection";
        if (hoveredNode.type === "synthesis") tTitle = "Synthesis";
        document.getElementById("ttTitle").textContent = tTitle;
        document.getElementById("ttStats").textContent =
          hoveredNode.text.length > 60
            ? hoveredNode.text.substring(0, 60) + "..."
            : hoveredNode.text;
      }
      tooltip.style.opacity = 1;
    } else {
      tooltip.style.opacity = 0;
    }

    animationFrameId = requestAnimationFrame(frame);
  }
  frame();
}

function navigateToArticleFromGraph(d, s, a) {
  document.getElementById("knowledgeEngineContainer")?.remove();
  document.body.classList.remove("deep-work-active");
  currentState.mode = "journey";
  navigateToArticle(d, s, a);
}

function jumpToTimelineFromGraph(timestamp) {
  document.getElementById("knowledgeEngineContainer")?.remove();
  document.body.classList.remove("deep-work-active");

  updateActiveNav("navTimeline");
  switchView("timelineView");
  currentZoom = "daily";

  document
    .querySelectorAll(".zoom-btn")
    .forEach((b) => b.classList.remove("active"));
  const dailyBtn = document.querySelector(".zoom-btn[data-zoom='daily']");
  if (dailyBtn) dailyBtn.classList.add("active");

  document
    .querySelectorAll(".timeline-filter-btn")
    .forEach((b) => b.classList.remove("active"));
  const allFilter = document.querySelector(
    ".timeline-filter-btn[data-filter='All']",
  );
  if (allFilter) allFilter.classList.add("active");

  renderTimeline("All");

  const date = new Date(Number(timestamp));
  setTimeout(() => {
    const targetKey = date.toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const headers = document.querySelectorAll(".timeline-group-header");
    for (let h of headers) {
      if (h.textContent.includes(targetKey)) {
        const y = h.getBoundingClientRect().top + window.scrollY - 80;
        window.scrollTo({ top: y, behavior: "smooth" });
        h.style.transition = "background 0.5s ease, color 0.5s ease";
        h.style.background = "var(--accent)";
        h.style.color = "white";

        // Auto-expand this specific date group
        const content = h.nextElementSibling;
        if (content && content.style.gridTemplateRows === "0fr") {
          h.click();
        }

        // Auto-expand all the timeline items inside it
        if (content) {
          const items = content.querySelectorAll(".timeline-item");
          items.forEach((item) => item.classList.add("expanded"));
        }

        setTimeout(() => {
          h.style.background = "";
          h.style.color = "";
        }, 1500);
        break;
      }
    }
  }, 100);
}

function jumpToExactTimelineItem(dateStr) {
  document.getElementById("knowledgeEngineContainer")?.remove();
  document.body.classList.remove("deep-work-active");

  updateActiveNav("navTimeline");
  switchView("timelineView");
  currentZoom = "daily";

  document
    .querySelectorAll(".zoom-btn")
    .forEach((b) => b.classList.remove("active"));
  const dailyBtn = document.querySelector(".zoom-btn[data-zoom='daily']");
  if (dailyBtn) dailyBtn.classList.add("active");

  document
    .querySelectorAll(".timeline-filter-btn")
    .forEach((b) => b.classList.remove("active"));
  const allFilter = document.querySelector(
    ".timeline-filter-btn[data-filter='All']",
  );
  if (allFilter) allFilter.classList.add("active");

  renderTimeline("All");

  const date = new Date(dateStr);
  setTimeout(() => {
    const targetKey = date.toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const headers = document.querySelectorAll(".timeline-group-header");
    for (let h of headers) {
      if (h.textContent.includes(targetKey)) {
        const content = h.nextElementSibling;
        if (content && content.style.gridTemplateRows === "0fr") {
          h.click();
        }

        let foundItem = null;
        if (content) {
          const btn = content.querySelector(`button[onclick*="${dateStr}"]`);
          if (btn) {
            foundItem = btn.closest(".timeline-item");
          }
        }

        if (foundItem) {
          foundItem.classList.add("expanded");
          const subItem = foundItem.querySelector(
            `#timeline-subitem-${dateStr}`,
          );
          if (subItem) {
            const y =
              subItem.getBoundingClientRect().top + window.scrollY - 100;
            window.scrollTo({ top: y, behavior: "smooth" });
            subItem.style.boxShadow =
              "0 0 0 2px var(--accent), 0 0 20px color-mix(in srgb, var(--accent) 40%, transparent)";
            setTimeout(() => (subItem.style.boxShadow = ""), 2000);
          } else {
            const y =
              foundItem.getBoundingClientRect().top + window.scrollY - 100;
            window.scrollTo({ top: y, behavior: "smooth" });
            foundItem.style.boxShadow =
              "0 0 0 2px var(--accent), 0 0 20px color-mix(in srgb, var(--accent) 40%, transparent)";
            setTimeout(() => (foundItem.style.boxShadow = ""), 2000);
          }
        } else {
          const y = h.getBoundingClientRect().top + window.scrollY - 80;
          window.scrollTo({ top: y, behavior: "smooth" });
          h.style.transition = "background 0.5s ease, color 0.5s ease";
          h.style.background = "var(--accent)";
          h.style.color = "white";
          setTimeout(() => {
            h.style.background = "";
            h.style.color = "";
          }, 1500);
        }
        break;
      }
    }
  }, 100);
}

// ============================================================
// PROFILE & STREAKS
// ============================================================
function calcStreak() {
  if (!userLearningJourney.timeline.length) return { current: 0, longest: 0 };

  const activeDates = new Set(
    userLearningJourney.timeline.map((t) => t.date.split("T")[0]),
  );
  const today = new Date();
  const toKey = (d) => d.toISOString().split("T")[0];

  let current = 0;
  const cursor = new Date(today);
  while (activeDates.has(toKey(cursor))) {
    current++;
    cursor.setDate(cursor.getDate() - 1);
  }

  const sorted = [...activeDates].sort();
  let longest = 0,
    run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]);
    const curr = new Date(sorted[i]);
    const diff = (curr - prev) / 86400000;
    if (diff === 1) {
      run++;
      longest = Math.max(longest, run);
    } else run = 1;
  }
  longest = Math.max(longest, current, run);

  return { current, longest };
}

function updateStreaks() {
  const { current: curStreak, longest: longestStreak } = calcStreak();
  const html = `
    <div class="streak-badge ${curStreak === 0 ? "cold" : ""}">
        ${curStreak} day streak
    </div>
    <div class="streak-badge cold">
        Best: ${longestStreak} day${longestStreak === 1 ? "" : "s"}
    </div>`;

  const profileStreak = document.getElementById("streakRow");
  if (profileStreak) profileStreak.innerHTML = html;

  const exploreStreak = document.getElementById("exploreStreakRow");
  if (exploreStreak) exploreStreak.innerHTML = html;
}

function renderJourneyStats() {
  const statsGrid = document.getElementById("journeyStatsGrid");
  if (!statsGrid) return;

  let totalReads = 0,
    totalNotes = 0,
    totalReflections = 0,
    totalNoteItems = 0;
  Object.keys(userLearningJourney.topics).forEach((d) => {
    const t = userLearningJourney.topics[d];
    totalReads += t.articlesEngaged || 0;
    totalNotes += t.annotations || 0;
    totalReflections += t.reflections || 0;
  });
  userLearningJourney.timeline.forEach((t) => {
    if ((t.type || "") === "Note") totalNoteItems++;
  });

  statsGrid.innerHTML = `
    <div class="stat-cell">
        <div class="stat-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg></div>
        <div class="stat-num">${totalReads}</div>
        <div class="stat-label">Unique Articles</div>
    </div>
    <div class="stat-cell">
        <div class="stat-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg></div>
        <div class="stat-num">${totalNotes}</div>
        <div class="stat-label">Highlights</div>
    </div>
    <div class="stat-cell">
        <div class="stat-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg></div>
        <div class="stat-num">${totalReflections}</div>
        <div class="stat-label">Reflections</div>
    </div>
    <div class="stat-cell">
        <div class="stat-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg></div>
        <div class="stat-num">${totalNoteItems}</div>
        <div class="stat-label">Notes</div>
    </div>`;
}

function showProfile() {
  switchView("profileView");
  updateActiveNav("profileBtn");

  const darkToggle = document.getElementById("darkModeToggle");
  const midnightToggle = document.getElementById("midnightModeToggle");
  const currentTheme = document.documentElement.getAttribute("data-theme");

  if (darkToggle) darkToggle.checked = currentTheme === "dark";
  if (midnightToggle) midnightToggle.checked = currentTheme === "midnight";

  const autoDarkToggle = document.getElementById("autoDarkToggle");
  if (autoDarkToggle)
    autoDarkToggle.checked = localStorage.getItem("osmosis_auto_dark") === "1";
  const compactToggle = document.getElementById("compactToggle");
  if (compactToggle)
    compactToggle.checked = localStorage.getItem("osmosis_compact") === "1";
  const focusModeToggle = document.getElementById("focusModeToggle");
  if (focusModeToggle)
    focusModeToggle.checked =
      localStorage.getItem("osmosis_focus_mode") === "1";

  let profileExp = document.getElementById("tip_profile");
  if (!profileExp && !localStorage.getItem("hide_tip_profile")) {
    profileExp = document.createElement("div");
    profileExp.id = "tip_profile";
    profileExp.style.cssText =
      "position: relative; font-size: 0.9rem; color: var(--subtitle-color); margin-bottom: 24px; line-height: 1.5; padding: 16px 20px; background: rgba(125, 91, 166, 0.08); border-radius: 16px; border: 1px solid var(--glass-border); text-align: left; transition: all 0.3s ease;";
    profileExp.innerHTML = `
      <button onclick="dismissTip('profile')" style="position: absolute; top: 12px; right: 12px; background: transparent; border: none; color: var(--subtitle-color); cursor: pointer; padding: 4px; box-shadow: none;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
      <div style='font-size: 0.75rem; font-weight: 700; color: #7d5ba6; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;'><svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.5'><path d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'></path><circle cx='12' cy='7' r='4'></circle></svg> Your Cognitive Identity</div>
      <div style="padding-right: 20px;">Complete Guided Paths to earn permanent <strong>Badges</strong> of mastery.</div>`;
    const appSettingsColumn = document.querySelector(
      "#profileView .dash-column",
    );
    if (appSettingsColumn)
      appSettingsColumn.parentNode.insertBefore(profileExp, appSettingsColumn);
  }

  updateStreaks();

  const activeHl = localStorage.getItem("osmosis_hl_color") || "yellow";
  document
    .querySelectorAll(".hl-swatch")
    .forEach((s) => s.classList.toggle("active", s.dataset.hl === activeHl));
}

// ============================================================
// EXPORT FUNCTIONS
// ============================================================
function exportReport() {
  let hasData = false;
  const dateStr = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Osmosis Knowledge Report</title>
  <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;1,400&family=Outfit:wght@300;400;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #FAF8F0;
      --text: #1a1a1a;
      --accent: #e07a5f;
      --sage: #8a9a9d;
      --border: rgba(0,0,0,0.08);
    }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: 'Lora', serif;
      line-height: 1.7;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      padding: 60px 20px;
    }
    .header {
      text-align: center;
      margin-bottom: 60px;
      padding-bottom: 40px;
      border-bottom: 1px solid var(--border);
    }
    .header h1 {
      font-family: 'Outfit', sans-serif;
      font-size: 3rem;
      margin: 0 0 10px 0;
      color: var(--accent);
      letter-spacing: -0.03em;
    }
    .header p {
      font-family: 'Outfit', sans-serif;
      color: var(--sage);
      font-size: 1rem;
      text-transform: uppercase;
      letter-spacing: 2px;
      margin: 0;
    }
    .domain-section {
      margin-bottom: 60px;
    }
    .domain-title {
      font-family: 'Outfit', sans-serif;
      font-size: 2.2rem;
      color: var(--text);
      border-bottom: 2px solid var(--border);
      padding-bottom: 12px;
      margin-bottom: 30px;
      letter-spacing: -0.02em;
    }
    .article-block {
      margin-bottom: 40px;
      background: #ffffff;
      padding: 40px;
      border-radius: 20px;
      box-shadow: 0 10px 40px -10px rgba(0,0,0,0.08);
      border: 1px solid var(--border);
    }
    .article-title {
      font-family: 'Outfit', sans-serif;
      font-size: 1.6rem;
      margin: 0 0 8px 0;
      color: var(--text);
    }
    .article-meta {
      font-family: 'Outfit', sans-serif;
      font-size: 0.85rem;
      color: var(--sage);
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 30px;
    }
    .note-item {
      margin-bottom: 24px;
    }
    .highlight-quote {
      font-size: 1.05rem;
      font-style: italic;
      color: #444;
      margin: 0 0 12px 0;
    }
    .user-note {
      margin: 0 0 0 21px;
      font-size: 0.95rem;
      color: var(--text);
      background: rgba(0,0,0,0.02);
      padding: 12px 16px;
      border-radius: 8px;
      display: inline-block;
    }
    .user-note strong {
      font-family: 'Outfit', sans-serif;
      font-size: 0.75rem;
      text-transform: uppercase;
      color: var(--accent);
      letter-spacing: 1px;
      display: block;
      margin-bottom: 4px;
    }
    .note-type-label {
      font-family: 'Outfit', sans-serif;
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--sage);
      margin-bottom: 6px;
    }
    .reflection-block {
      background: rgba(138, 154, 157, 0.08);
      padding: 24px;
      border-radius: 0 12px 12px 0;
      margin-top: 30px;
    }
    .reflection-block h4 {
      font-family: 'Outfit', sans-serif;
      margin: 0 0 12px 0;
      color: var(--sage);
      text-transform: uppercase;
      letter-spacing: 1.5px;
      font-size: 0.85rem;
    }
    .reflection-block p {
      margin: 0;
      font-size: 1.05rem;
      color: var(--text);
    }
    @media print {
      body { background: white; }
      .container { padding: 0; max-width: 100%; }
      .article-block { box-shadow: none; border: none; padding: 20px 0; margin-bottom: 30px; page-break-inside: avoid; }
      .reflection-block { page-break-inside: avoid; }
      .domain-section { page-break-before: always; }
      .domain-section:first-of-type { page-break-before: auto; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>My Knowledge Report</h1>
      <p>${dateStr}</p>
    </div>`;

  const escapeHtml = (t) =>
    (t || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const domains = Object.keys(window.topicsData || {}).sort();

  domains.forEach((domain) => {
    let domainHtml = `<div class="domain-section"><h2 class="domain-title">${escapeHtml(domain)}</h2>`;
    let domainHasData = false;

    const subtopics = Object.keys(
      window.topicsData[domain].subtopics || {},
    ).sort();
    subtopics.forEach((subtopic) => {
      const articles = Object.keys(
        window.topicsData[domain].subtopics[subtopic].articles || {},
      ).sort();
      articles.forEach((article) => {
        const keyBase = `article_${domain}_${subtopic}_${article}`;
        const annotations = JSON.parse(
          localStorage.getItem(keyBase + "_annotations") || "[]",
        );
        const reflections = JSON.parse(
          localStorage.getItem(keyBase + "_reflections") || "[]",
        );

        if (annotations.length > 0 || reflections.length > 0) {
          hasData = true;
          domainHasData = true;
          domainHtml += `<div class="article-block">
            <h3 class="article-title">${escapeHtml(article)}</h3>
            <div class="article-meta">${escapeHtml(subtopic)}</div>`;

          if (annotations.length > 0) {
            annotations.forEach((ann) => {
              const isBookmark =
                ann.note === "Bookmarked" || ann.note === "Bookmarked";
              const typeLabel = isBookmark ? "Bookmark" : "Highlight";
              domainHtml += `<div class="note-item">`;
              domainHtml += `<div class="note-type-label">${typeLabel}</div>`;
              if (ann.text)
                domainHtml += `<div class="highlight-quote">"${escapeHtml(ann.text)}"</div>`;
              if (ann.note && !isBookmark && ann.note !== "Highlighted") {
                domainHtml += `<div class="user-note"><strong>My Note</strong> ${escapeHtml(ann.note)}</div>`;
              }
              domainHtml += `</div>`;
            });
          }

          if (reflections.length > 0) {
            reflections.forEach((ref) => {
              domainHtml += `<div class="reflection-block">
                <h4>Reflection</h4>
                <p>${escapeHtml(ref.text).replace(/\n/g, "<br>")}</p>
              </div>`;
            });
          }

          domainHtml += `</div>`;
        }
      });
    });

    domainHtml += `</div>`;
    if (domainHasData) {
      html += domainHtml;
    }
  });

  html += `
    </div>
  </body>
  </html>`;

  if (!hasData) {
    showToast("No notes to export yet.");
    return;
  }

  download(html, `osmosis_report_${today()}.html`, "text/html");
  showToast("Report exported successfully!");
}

function exportTimeline() {
  if (
    !userLearningJourney.timeline ||
    userLearningJourney.timeline.length === 0
  ) {
    showToast("No timeline history to export yet.");
    return;
  }

  const groups = {};
  // Sort reverse-chronological (newest first)
  const sortedTimeline = [...userLearningJourney.timeline].sort(
    (a, b) => new Date(b.date) - new Date(a.date),
  );

  sortedTimeline.forEach((item) => {
    const key = new Date(item.date).toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    (groups[key] = groups[key] || []).push(item);
  });

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Osmosis Knowledge Report</title>
  <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;1,400&family=Outfit:wght@300;400;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #FAF8F0;
      --text: #1a1a1a;
      --accent: #e07a5f;
      --sage: #8a9a9d;
      --border: rgba(0,0,0,0.08);
    }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: 'Lora', serif;
      line-height: 1.7;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      padding: 60px 20px;
    }
    .header {
      text-align: center;
      margin-bottom: 60px;
      padding-bottom: 40px;
      border-bottom: 1px solid var(--border);
    }
    .header h1 {
      font-family: 'Outfit', sans-serif;
      font-size: 3rem;
      margin: 0 0 10px 0;
      color: var(--accent);
      letter-spacing: -0.03em;
    }
    .header p {
      font-family: 'Outfit', sans-serif;
      color: var(--sage);
      font-size: 1rem;
      text-transform: uppercase;
      letter-spacing: 2px;
      margin: 0;
    }
    .date-section {
      margin-bottom: 60px;
    }
    .date-title {
      font-family: 'Outfit', sans-serif;
      font-size: 2.2rem;
      color: var(--text);
      border-bottom: 2px solid var(--border);
      padding-bottom: 12px;
      margin-bottom: 30px;
      letter-spacing: -0.02em;
    }
    .timeline-event {
      margin-bottom: 24px;
      background: #ffffff;
      padding: 30px;
      border-radius: 16px;
      box-shadow: 0 4px 20px -10px rgba(0,0,0,0.05);
      border: 1px solid var(--border);
    }
    .timeline-event.event-badge { background: rgba(241, 196, 15, 0.05); }
    
    .event-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 16px;
      font-family: 'Outfit', sans-serif;
    }
    .event-meta {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .event-type {
      font-size: 0.85rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--sage);
    }
    .event-context {
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--text);
    }
    .event-time {
      font-size: 0.85rem;
      color: var(--sage);
    }
    .event-content {
      font-size: 1.05rem;
      color: var(--text);
    }
    .highlight-quote {
      font-size: 1.05rem;
      font-style: italic;
      color: #444;
      border-left: 3px solid var(--accent);
      padding-left: 18px;
      margin: 0 0 16px 0;
    }
    .user-note {
      margin: 0;
      font-size: 0.95rem;
      color: var(--text);
      background: rgba(0,0,0,0.02);
      padding: 16px;
      border-radius: 8px;
      display: block;
    }
    .user-note strong {
      font-family: 'Outfit', sans-serif;
      font-size: 0.75rem;
      text-transform: uppercase;
      color: var(--accent);
      letter-spacing: 1px;
      display: block;
      margin-bottom: 6px;
    }
    .roulette-qa {
      background: rgba(0,0,0,0.02);
      padding: 16px;
      border-radius: 8px;
      margin-bottom: 12px;
    }
    .roulette-qa strong {
      font-family: 'Outfit', sans-serif;
      font-size: 0.75rem;
      text-transform: uppercase;
      color: var(--sage);
      letter-spacing: 1px;
      display: block;
      margin-bottom: 6px;
    }
    .roulette-qa.target strong { color: #27ae60; }
    
    @media print {
      body { background: white; }
      .container { padding: 0; max-width: 100%; }
      .timeline-event { box-shadow: none; border: 1px solid var(--border); page-break-inside: avoid; }
      .date-section { page-break-inside: auto; }
      .date-section:first-of-type { page-break-before: auto; }
      .date-section { page-break-before: always; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>My Knowledge Report</h1>
      <p>Chronological Journal & Notes</p>
    </div>`;

  const escapeHtml = (t) =>
    (t || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  Object.keys(groups).forEach((date) => {
    html += `<div class="date-section"><h2 class="date-title">${escapeHtml(date)}</h2>`;

    groups[date].forEach((item) => {
      const time = new Date(item.date).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });

      let contextStr = "";
      if (
        item.domain &&
        item.domain !== "Cross-Domain" &&
        item.domain !== "Milestone"
      ) {
        contextStr += escapeHtml(item.domain);
        if (item.article) contextStr += ` / ${escapeHtml(item.article)}`;
      } else if (item.article) {
        contextStr += escapeHtml(item.article);
      }

      let typeLabel = item.type || "Note";
      let textStr = item.text || "";

      // Fallback for legacy notes without explicit types
      if (!item.type) {
        if (textStr.includes('\n\n"')) typeLabel = "Highlight";
        else if (textStr.startsWith('"') && textStr.endsWith('"'))
          typeLabel = "Highlight";
        else typeLabel = "Reflection";
      }

      const cssClass = typeLabel.toLowerCase().replace(/\s+/g, "-");

      html += `
      <div class="timeline-event event-${cssClass}">
        <div class="event-header">
          <div class="event-meta">
            <div class="event-type">${escapeHtml(typeLabel)}</div>
            ${contextStr ? `<div class="event-context">${contextStr}</div>` : ""}
          </div>
          <div class="event-time">${time}</div>
        </div>
        <div class="event-content">
      `;

      if (typeLabel === "Highlight" || typeLabel === "Bookmark") {
        if (textStr.includes('\n\n"')) {
          const parts = textStr.split('\n\n"');
          const note = parts[0];
          const quote = parts[1].endsWith('"')
            ? parts[1].slice(0, -1)
            : parts[1];

          html += `<div class="highlight-quote">"${escapeHtml(quote)}"</div>`;
          html += `<div class="user-note"><strong>My Note</strong> ${escapeHtml(note).replace(/\n/g, "<br>")}</div>`;
        } else {
          html += `<div class="highlight-quote">"${escapeHtml(textStr.replace(/^"|"$/g, ""))}"</div>`;
        }
      } else if (typeLabel === "Reflection" || typeLabel === "Synthesis") {
        html += `${escapeHtml(textStr).replace(/\n/g, "<br>")}`;
      } else if (typeLabel === "Roulette") {
        if (item.rouletteQ) {
          html += `<div class="roulette-qa"><strong>Question</strong> ${escapeHtml(item.rouletteQ).replace(/\n/g, "<br>")}</div>`;
        }
        html += `<div class="roulette-qa"><strong>My Answer</strong> ${escapeHtml(textStr).replace(/\n/g, "<br>")}</div>`;
        if (item.rouletteA) {
          html += `<div class="roulette-qa target"><strong>Target Answer</strong> ${escapeHtml(item.rouletteA).replace(/\n/g, "<br>")}</div>`;
        }
      } else if (typeLabel === "Read") {
        html += `<span style="color: var(--sage);">${escapeHtml(textStr)}</span>`;
      } else if (typeLabel === "Badge") {
        html += `<strong>Milestone Reached!</strong><br>${escapeHtml(textStr).replace(/\n/g, "<br>")}`;
      } else {
        html += `${escapeHtml(textStr).replace(/\n/g, "<br>")}`;
      }

      html += `</div></div>`;
    });

    html += `</div>`;
  });

  html += `
    </div>
  </body>
  </html>`;

  download(html, `osmosis_report_${today()}.html`, "text/html");
  showToast("Report exported successfully!");
}

function exportObsidian() {
  let md = "# Osmosis Knowledge Graph\n\n";
  let hasData = false;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith("article_") || !key.endsWith("_annotations")) continue;
    const items = JSON.parse(localStorage.getItem(key) || "[]");
    if (!items.length) continue;
    hasData = true;
    const parts = key.split("_");
    const title = parts[parts.length - 1];
    const domain = parts[1];
    md += `## [[${title}]]\ntags: #${domain.replace(/\s+/g, "_")} #Osmosis\n\n`;
    items.forEach((a) => {
      if (a.text) md += `> ${a.text}\n`;
      md += `- **Note**: ${a.note}\n\n`;
    });
    md += "---\n\n";
  }
  if (!hasData) {
    showToast("No graph data to export.");
    return;
  }
  download(md, `osmosis_graph_${today()}.md`, "text/markdown");
  showToast("Obsidian-ready graph exported!");
}

// Import a library from the exported file (JS that assigns window.topicsData)
// or a JSON blob. Merges into the current library and persists it.
async function applyImportedLibrary(rawText) {
  const text = (rawText || "").trim();
  if (!text) {
    alert("Choose a file or paste the library contents first.");
    return;
  }
  try {
    let imported = false;

    if (text[0] === "{" || text[0] === "[") {
      // JSON blob
      const parsed = JSON.parse(text);

      // Full backup: restore every saved key verbatim
      if (parsed && parsed.__osmosisBackup && parsed.data) {
        Object.keys(parsed.data).forEach((k) => {
          try {
            localStorage.setItem(k, parsed.data[k]);
          } catch (e) {
            /* skip a key if storage is full */
          }
        });
        // Restore cover photos into IndexedDB (backups v2+).
        if (parsed.images && typeof parsed.images === "object") {
          await Promise.all(
            Object.keys(parsed.images).map((id) =>
              idbSetImage(id, parsed.images[id]).catch(() => {}),
            ),
          );
        }
        const modal = document.getElementById("importModal");
        if (modal) modal.classList.remove("active");
        alert("Backup restored! Reloading…");
        setTimeout(() => window.location.reload(), 400);
        return;
      }

      const topics = parsed.topicsData || parsed.topics || parsed;
      if (topics && typeof topics === "object") {
        window.topicsData = Object.assign(window.topicsData || {}, topics);
        const paths = parsed.pathsData || parsed.paths;
        if (paths && typeof paths === "object") {
          window.pathsData = Object.assign(window.pathsData || {}, paths);
        }
        imported = true;
      }
    } else if (text.includes("topicsData")) {
      // Exported stories file: window.topicsData = ...; Object.assign(window.topicsData, {JSON});
      let topics = null;

      // Method 1 (preferred, no eval): pull the JSON object out directly.
      const marker = "Object.assign(window.topicsData,";
      const mi = text.indexOf(marker);
      if (mi >= 0) {
        let part = text.slice(mi + marker.length).trim();
        part = part.replace(/\)\s*;?\s*$/, "").trim(); // drop trailing ");"
        try {
          topics = JSON.parse(part);
        } catch (e) {
          topics = null;
        }
      }

      // Method 2 (fallback): run it in a private sandbox as `window`.
      if (!topics) {
        try {
          const sandbox = {};
          new Function("window", text)(sandbox);
          if (sandbox.topicsData && typeof sandbox.topicsData === "object") {
            topics = sandbox.topicsData;
          }
          if (sandbox.pathsData && typeof sandbox.pathsData === "object") {
            window.pathsData = Object.assign(
              window.pathsData || {},
              sandbox.pathsData,
            );
          }
        } catch (e) {
          /* handled below */
        }
      }

      if (topics && typeof topics === "object") {
        window.topicsData = Object.assign(window.topicsData || {}, topics);
        imported = true;
      }
    }

    if (!imported) throw new Error("Unrecognized library format");

    // Move any inline photos into IndexedDB first so the localStorage copy
    // stays small enough to actually save.
    await externalizeInlineImages(window.topicsData);

    localStorage.setItem(
      "osmosis_custom_content",
      JSON.stringify(window.topicsData || {}),
    );
    if (window.pathsData) {
      localStorage.setItem(
        "osmosis_custom_paths",
        JSON.stringify(window.pathsData),
      );
    }

    const modal = document.getElementById("importModal");
    if (modal) modal.classList.remove("active");
    alert("Library imported! Reloading…");
    setTimeout(() => window.location.reload(), 400);
  } catch (err) {
    console.error(err);
    alert(
      "Import failed: " +
        (err && err.message ? err.message : "unknown error") +
        "\n\nMake sure you picked your exported stories.js or a backup file.",
    );
  }
}

// Full backup: every piece of the user's data (stories, timeline, highlights,
// notes, reflections, bookmarks, favorites, progress, settings) as one JSON file.
// ---- Frontispiece: tissue-guard entrance & plate tint ----
// Old books protect their plates with a leaf of tissue; the photo opens
// under a translucent paper veil that lifts. The story's drop cap then
// quietly takes a muted hue sampled from the plate itself.
function _frontisReveal(img) {
  const run = () => {
    _tissueGuard(img);
    _plateTint(img);
  };
  if (img.complete && img.naturalWidth) run();
  else img.onload = run;
}
function _tissueGuard(img) {
  let wrap = img.parentElement;
  if (!wrap || !wrap.classList.contains("frontis-wrap")) {
    wrap = document.createElement("div");
    wrap.className = "frontis-wrap";
    img.before(wrap);
    wrap.appendChild(img);
    const veil = document.createElement("div");
    veil.className = "tissue-veil";
    wrap.appendChild(veil);
  }
  const veil = wrap.querySelector(".tissue-veil");
  if (!veil) return;
  veil.classList.remove("lifted");
  void veil.offsetWidth; // restart the transition on every story open
  requestAnimationFrame(() =>
    requestAnimationFrame(() => veil.classList.add("lifted")),
  );
}
function _clearPlateTint() {
  document.getElementById("articleView")?.style.removeProperty("--plate-tint");
}
function _plateTint(img) {
  try {
    const cv = document.createElement("canvas");
    cv.width = 24;
    cv.height = 18;
    const ctx = cv.getContext("2d");
    ctx.drawImage(img, 0, 0, 24, 18);
    const px = ctx.getImageData(0, 0, 24, 18).data;
    let r = 0,
      g = 0,
      b = 0,
      n = 0;
    for (let i = 0; i < px.length; i += 4) {
      r += px[i];
      g += px[i + 1];
      b += px[i + 2];
      n++;
    }
    r /= n * 255;
    g /= n * 255;
    b /= n * 255;
    // to HSL, then temper it into an ink-compatible tone
    const mx = Math.max(r, g, b);
    const mn = Math.min(r, g, b);
    let h = 0;
    const d = mx - mn;
    if (d > 0.001) {
      if (mx === r) h = ((g - b) / d) % 6;
      else if (mx === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h = (h * 60 + 360) % 360;
    }
    const l0 = (mx + mn) / 2;
    let sat = d < 0.001 ? 0 : d / (1 - Math.abs(2 * l0 - 1));
    sat = Math.min(sat, 0.5); // never gaudy
    const dark = ["dark", "midnight"].includes(
      document.documentElement.getAttribute("data-theme"),
    );
    const light = dark ? 0.62 : 0.38;
    const tint = `hsl(${Math.round(h)}, ${Math.round(sat * 100)}%, ${Math.round(light * 100)}%)`;
    document
      .getElementById("articleView")
      ?.style.setProperty("--plate-tint", tint);
  } catch (e) {
    _clearPlateTint();
  }
}

// ---- Photo lightbox: tap a cover to inspect it, pinch/drag to zoom ----
let _lbScale = 1;
let _lbX = 0;
let _lbY = 0;
function _lbApply() {
  const img = document.getElementById("lightboxImg");
  if (img)
    img.style.transform = `translate(${_lbX}px, ${_lbY}px) scale(${_lbScale})`;
}
function _lbSet(scale, cx, cy) {
  // Zoom toward the given viewport point so it stays under the finger
  const prev = _lbScale;
  _lbScale = Math.max(1, Math.min(5, scale));
  if (cx !== undefined) {
    const k = _lbScale / prev;
    _lbX = cx - (cx - _lbX) * k;
    _lbY = cy - (cy - _lbY) * k;
  }
  if (_lbScale === 1) {
    _lbX = 0;
    _lbY = 0;
  }
  _lbApply();
}
function openPhotoLightbox(src) {
  if (!src) return;
  let lb = document.getElementById("photoLightbox");
  if (!lb) {
    lb = document.createElement("div");
    lb.id = "photoLightbox";
    lb.className = "photo-lightbox";
    lb.innerHTML = `
      <img id="lightboxImg" alt="" draggable="false" />
      <div class="lb-controls">
        <button class="lb-btn" id="lbZoomOut" aria-label="Zoom out">−</button>
        <button class="lb-btn" id="lbZoomIn" aria-label="Zoom in">+</button>
        <button class="lb-btn" id="lbClose" aria-label="Close">×</button>
      </div>`;
    document.body.appendChild(lb);

    const img = lb.querySelector("#lightboxImg");
    lb.querySelector("#lbClose").addEventListener("click", closePhotoLightbox);
    lb.querySelector("#lbZoomIn").addEventListener("click", (e) => {
      e.stopPropagation();
      _lbSet(_lbScale * 1.5, window.innerWidth / 2, window.innerHeight / 2);
    });
    lb.querySelector("#lbZoomOut").addEventListener("click", (e) => {
      e.stopPropagation();
      _lbSet(_lbScale / 1.5, window.innerWidth / 2, window.innerHeight / 2);
    });
    // Tap the backdrop (not the photo) to close
    lb.addEventListener("click", (e) => {
      if (e.target === lb) closePhotoLightbox();
    });

    // Wheel zoom (desktop)
    lb.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        _lbSet(_lbScale * (e.deltaY < 0 ? 1.15 : 0.87), e.clientX, e.clientY);
      },
      { passive: false },
    );

    // Touch: pinch to zoom, one-finger pan when zoomed, double-tap toggle
    let touchState = null;
    let lastTapAt = 0;
    const dist = (t) =>
      Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    lb.addEventListener(
      "touchstart",
      (e) => {
        if (e.touches.length === 2) {
          touchState = {
            mode: "pinch",
            d: dist(e.touches),
            scale: _lbScale,
            cx: (e.touches[0].clientX + e.touches[1].clientX) / 2,
            cy: (e.touches[0].clientY + e.touches[1].clientY) / 2,
          };
        } else if (e.touches.length === 1) {
          const now = Date.now();
          if (now - lastTapAt < 300) {
            // double tap: zoom in at the tap, or reset
            if (_lbScale > 1) _lbSet(1);
            else _lbSet(2.5, e.touches[0].clientX, e.touches[0].clientY);
            touchState = null;
            lastTapAt = 0;
            return;
          }
          lastTapAt = now;
          touchState = {
            mode: "pan",
            x: e.touches[0].clientX,
            y: e.touches[0].clientY,
            ox: _lbX,
            oy: _lbY,
          };
        }
      },
      { passive: true },
    );
    lb.addEventListener(
      "touchmove",
      (e) => {
        if (!touchState) return;
        e.preventDefault();
        if (touchState.mode === "pinch" && e.touches.length === 2) {
          _lbSet(
            touchState.scale * (dist(e.touches) / touchState.d),
            touchState.cx,
            touchState.cy,
          );
        } else if (touchState.mode === "pan" && e.touches.length === 1) {
          if (_lbScale <= 1) return;
          _lbX = touchState.ox + (e.touches[0].clientX - touchState.x);
          _lbY = touchState.oy + (e.touches[0].clientY - touchState.y);
          _lbApply();
        }
      },
      { passive: false },
    );
    lb.addEventListener("touchend", () => {
      touchState = null;
    });

    // Mouse drag pan (desktop)
    let drag = null;
    img.addEventListener("mousedown", (e) => {
      if (_lbScale <= 1) return;
      e.preventDefault();
      drag = { x: e.clientX, y: e.clientY, ox: _lbX, oy: _lbY };
    });
    window.addEventListener("mousemove", (e) => {
      if (!drag) return;
      _lbX = drag.ox + (e.clientX - drag.x);
      _lbY = drag.oy + (e.clientY - drag.y);
      _lbApply();
    });
    window.addEventListener("mouseup", () => {
      drag = null;
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closePhotoLightbox();
    });
  }
  const img = document.getElementById("lightboxImg");
  img.src = src;
  _lbScale = 1;
  _lbX = 0;
  _lbY = 0;
  _lbApply();
  lb.style.display = "flex";
  document.documentElement.style.overflow = "hidden";
}
function closePhotoLightbox() {
  const lb = document.getElementById("photoLightbox");
  if (lb) lb.style.display = "none";
  document.documentElement.style.overflow = "";
}
window.openPhotoLightbox = openPhotoLightbox;
window.closePhotoLightbox = closePhotoLightbox;

// Wire the reader's cover photo to the lightbox
(function () {
  function wire() {
    const f = document.getElementById("articleFrontispiece");
    if (f) {
      f.style.cursor = "zoom-in";
      f.addEventListener("click", () => openPhotoLightbox(f.src));
    }
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", wire);
  else wire();
})();

// ---- The Backup Ledger: a registrar's line in the Data group ----
function stampBackupLedger() {
  try {
    localStorage.setItem("osmosis_last_backup", new Date().toISOString());
  } catch (e) {}
  renderBackupLedger();
}
function renderBackupLedger() {
  const el = document.getElementById("backupLedger");
  if (!el) return;
  const iso = localStorage.getItem("osmosis_last_backup");
  if (!iso) {
    el.innerHTML =
      "No backup on record — your marginalia exist on this device alone.";
    el.classList.add("warn");
    return;
  }
  const then = new Date(iso);
  const days = Math.floor((Date.now() - then) / 86400000);
  const when = then.toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
  });
  const ago =
    days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
  el.innerHTML = `Last full backup — ${when}, ${ago}`;
  el.classList.toggle("warn", days > 30);
}

async function exportFullBackup() {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) data[key] = localStorage.getItem(key);
  }
  // Cover photos now live in IndexedDB, so include them explicitly.
  const images = await idbGetAllImages();
  const backup = {
    __osmosisBackup: true,
    version: 2,
    exportedAt: new Date().toISOString(),
    data,
    images,
  };
  download(
    JSON.stringify(backup),
    "osmosis-backup.json",
    "application/json",
  );
  stampBackupLedger();
  showToast("Full backup downloaded.");
}

async function exportBackup() {
  // Compiles all default and custom-generated content into the permanent
  // format, inlining cover photos so the file is fully self-contained.
  const topics = await inlineTopicsImages(window.topicsData || {});
  const jsContent = `window.topicsData = window.topicsData || {};\n\nObject.assign(window.topicsData, ${JSON.stringify(topics, null, 2)});\n`;

  download(jsContent, `stories.js`, "application/javascript");
  stampBackupLedger();
  showToast("Ready! Replace stories.js with this file.");
}

// ============================================================
// AUTO-SYNC LOGIC
// ============================================================
function getSyncUrl() {
  let url = localStorage.getItem("osmosis_sync_server");
  if (!url) {
    if (
      window.location.protocol === "file:" ||
      window.location.origin === "null" ||
      window.location.origin === "file://"
    ) {
      url = "http://127.0.0.1:8000";
    } else {
      url = `${window.location.protocol}//${window.location.hostname}:8000`;
    }
  }
  if (url && !url.startsWith("http")) url = "http://" + url;
  return url.replace(/\/$/, "");
}

let syncTimeout = null;
function triggerAutoSync() {
  clearTimeout(syncTimeout);
  syncTimeout = setTimeout(pushToServer, 1500);
}

async function pushToServer() {
  const url = getSyncUrl();
  const token = localStorage.getItem("osmosis_auth_token");
  if (!url || !token || token === "local_guest") return;
  const backup = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (
      key &&
      (key.startsWith("osmosis_") ||
        key.startsWith("article_") ||
        key === "synthesis_records")
    ) {
      backup[key] = localStorage.getItem(key);
    }
  }
  try {
    await fetch(`${url}/api/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token,
      },
      body: JSON.stringify(backup),
    });
  } catch (e) {
    console.warn("Auto-sync push failed", e);
  }
}

async function pullFromServer(forceReload = false) {
  const url = getSyncUrl();
  const token = localStorage.getItem("osmosis_auth_token");
  if (!url || !token || token === "local_guest") return;
  try {
    const res = await fetch(`${url}/api/sync`, {
      headers: { Authorization: token },
    });
    if (!res.ok) return;

    const text = await res.text();
    if (!text) return;
    const data = JSON.parse(text);
    if (!data || Object.keys(data).length === 0) return;

    let changed = false;
    Object.keys(data).forEach((key) => {
      if (localStorage.getItem(key) !== data[key]) {
        localStorage.setItem(key, data[key]);
        changed = true;
      }
    });

    if (changed && forceReload) {
      window.location.reload();
    } else if (changed && !forceReload) {
      showToast("Synced from other device!");
      loadCustomContent();
      loadJourneyData();
      if (currentState.view === "explore") renderArticleGrid();
      if (currentState.view === "timeline") {
        const activeFilter = document.querySelector(
          ".timeline-filter-btn.active",
        );
        renderTimeline(activeFilter ? activeFilter.dataset.filter : "All");
      }
    }
  } catch (e) {
    console.warn("Auto-sync pull failed", e);
  }
}

function download(content, filename, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = Object.assign(document.createElement("a"), {
    href: url,
    download: filename,
  });
  a.click();
  URL.revokeObjectURL(url);
}
function today() {
  return new Date().toISOString().split("T")[0];
}

function jumpToTimelineDate(dateStr) {
  const item = userLearningJourney.timeline.find((t) => t.date === dateStr);
  if (!item) return;

  if (item.type === "Badge") {
    showToast("This is a milestone badge.");
    return;
  }

  const domain = item.domain;
  const article = item.article;

  // Cross-domain reflections (like Synthesis or Roulette) that don't belong to a specific article
  if (
    !domain ||
    domain === "Cross-Domain" ||
    !article ||
    article === "System" ||
    !window.topicsData[domain]
  ) {
    openNotesDrawer(0);
    return;
  }

  let targetSubtopic = null;
  for (const sub of Object.keys(window.topicsData[domain].subtopics || {})) {
    if ((window.topicsData[domain].subtopics[sub].articles || {})[article]) {
      targetSubtopic = sub;
      break;
    }
  }

  if (targetSubtopic) {
    currentState.mode = "timeline";
    document
      .querySelectorAll(".nav-item")
      .forEach((btn) => btn.classList.remove("active"));
    navigateToArticle(domain, targetSubtopic, article);

    setTimeout(() => {
      openNotesDrawer(0);

      setTimeout(() => {
        const list = document.getElementById("reflectionHistory");
        if (list) {
          const items = list.querySelectorAll(".annotation-item");
          const searchParts = (item.text || "")
            .split("\n")
            .map((p) => p.replace(/"/g, "").trim().toLowerCase())
            .filter((p) => p.length > 5);

          if (searchParts.length > 0) {
            for (let el of items) {
              const elText = el.textContent.toLowerCase();
              const matches = searchParts.some((part) => elText.includes(part));
              if (matches) {
                const slide = el.closest(".carousel-slide, .carousel-card");
                if (slide) {
                  const topPos =
                    el.getBoundingClientRect().top -
                    slide.getBoundingClientRect().top +
                    slide.scrollTop -
                    80;
                  slide.scrollTo({ top: topPos, behavior: "smooth" });
                } else {
                  el.scrollIntoView({ behavior: "smooth", block: "center" });
                }
                el.style.boxShadow =
                  "0 0 15px color-mix(in srgb, var(--accent) 80%, transparent)";
                setTimeout(() => (el.style.boxShadow = "none"), 2000);
                break;
              }
            }
          }
        }
      }, 550);
    }, 300);
  } else {
    showToast("Article not found in the current library.");
  }
}

function jumpToArticleByDomainAndName(domain, article, timelineDateStr = null) {
  // Standardized mode mapping from view
  switch (currentState.view) {
    case "journey":
    case "vault":
    case "timeline":
      currentState.mode = currentState.view;
      break;
    default:
      currentState.mode = "explore";
  }

  // Find the story: try the given domain first, then fall back to every domain
  // (handles stories whose stored domain no longer matches, e.g. Uncategorized).
  let foundDomain = null;
  let targetSubtopic = null;
  const domainsToSearch =
    domain && window.topicsData[domain]
      ? [domain, ...Object.keys(window.topicsData || {})]
      : Object.keys(window.topicsData || {});
  for (const d of domainsToSearch) {
    const dData = window.topicsData[d];
    if (!dData) continue;
    for (const sub of Object.keys(dData.subtopics || {})) {
      if ((dData.subtopics[sub].articles || {})[article]) {
        foundDomain = d;
        targetSubtopic = sub;
        break;
      }
    }
    if (targetSubtopic) break;
  }
  if (targetSubtopic) {
    document
      .querySelectorAll(".nav-item")
      .forEach((btn) => btn.classList.remove("active"));
    navigateToArticle(foundDomain, targetSubtopic, article, {
      skipResume: true,
    });

    if (timelineDateStr) {
      const item = userLearningJourney.timeline.find(
        (t) => t.date === timelineDateStr,
      );
      if (
        item &&
        (item.type === "Highlight" ||
          item.type === "Note" ||
          item.type === "Bookmark")
      ) {
        let textToFind = item.text || "";
        if (textToFind.includes('\n\n"')) {
          const parts = textToFind.split('\n\n"');
          textToFind = parts[1].endsWith('"')
            ? parts[1].slice(0, -1)
            : parts[1];
        } else if (textToFind.startsWith('"') && textToFind.endsWith('"')) {
          textToFind = textToFind.slice(1, -1);
        }
        if (textToFind) {
          setTimeout(() => {
            const normalize = (t) =>
              (t || "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
            const targetNormalized = normalize(textToFind);
            let targetMark = null;
            const marks = document.querySelectorAll(
              "mark.highlighted-text, span.inline-bookmark",
            );
            for (const mark of marks) {
              if (normalize(mark.textContent) === targetNormalized) {
                targetMark = mark;
                break;
              }
            }
            if (targetMark) {
              // Just scroll to the spot — no spotlight/colour effect.
              targetMark.scrollIntoView({
                behavior: "smooth",
                block: "center",
              });
            }
          }, 350); // Shorter wait for smoother feel
        }
      }
    }
  } else {
    showToast("Article not found in the current library.");
  }
}

// ── Expose functions called from inline HTML ──
window.deleteAnnotation = deleteAnnotation;
window.goToAnnotationInArticle = goToAnnotationInArticle;
window.deleteReflection = deleteReflection;
window.editAnnotation = editAnnotation;
window.editReflection = editReflection;
window.readAloud = readAloud;
window.editTimelineItem = editTimelineItem;
window.deleteTimelineItem = deleteTimelineItem;
window.toggleTimelineFavorite = toggleTimelineFavorite;
window.toggleFavoriteArticle = toggleFavoriteArticle;
window.goToExploreView = goToExploreView;
window.navigateToArticleFromGraph = navigateToArticleFromGraph;
window.jumpToTimelineFromGraph = jumpToTimelineFromGraph;
window.jumpToExactTimelineItem = jumpToExactTimelineItem;
window.jumpToTimelineDate = jumpToTimelineDate;
window.jumpToArticleByDomainAndName = jumpToArticleByDomainAndName;
window.renderReflectionTracker = renderReflectionTracker;

function cancelCustomEdit() {
  genEditingOriginal = null;
  const gd0 = document.getElementById("genDomain");
  if (gd0) gd0.value = "";
  document.getElementById("genTitle").value = "";
  document.getElementById("genHook").value = "";
  document.getElementById("genContent").value = "";
  const gAuthor0 = document.getElementById("genAuthor");
  if (gAuthor0) gAuthor0.value = "";
  const gGenres0 = document.getElementById("genGenres");
  if (gGenres0) gGenres0.value = "";
  clearGenImage();
  document.getElementById("genSubmitBtn").textContent = "Save Story";
  document.getElementById("genCancelEditBtn").style.display = "none";
  const enb0 = document.getElementById("genEditNextBtn");
  if (enb0) enb0.style.display = "none";

  const btnGenManage = document.getElementById("btnGenManage");
  if (btnGenManage) btnGenManage.click();

  restoreGenDraft();
}

function renderGeneratorManageList() {
  const source = window.topicsData || {};
  const list = document.getElementById("genManageList");
  if (!list) return;
  list.innerHTML = "";
  let hasItems = false;

  const items = [];
  Object.keys(source).forEach((domain) => {
    Object.keys(source[domain].subtopics || {}).forEach((sub) => {
      Object.keys(source[domain].subtopics[sub].articles || {}).forEach(
        (art) => {
          hasItems = true;
          items.push({ domain, sub, art });
        },
      );
    });
  });

  items.reverse().forEach(({ domain, sub, art }) => {
    const item = document.createElement("div");
    item.className = "glass-panel";
    item.style.cssText =
      "display:flex; justify-content:space-between; align-items:center; padding:16px;";

    // Byline: author · genres (falls back to a quiet word count)
    const artObj =
      window.topicsData?.[domain]?.subtopics?.[sub]?.articles?.[art] || {};
    const bylineParts = [];
    if (artObj.author) bylineParts.push(artObj.author);
    if (Array.isArray(artObj.genres) && artObj.genres.length)
      bylineParts.push(artObj.genres.join(", "));
    const byline = bylineParts.length
      ? bylineParts.join(" · ")
      : `${(artObj.content || "").split(/\s+/).filter(Boolean).length.toLocaleString()} words`;

    item.innerHTML = `
      <div style="min-width:0; padding-right:10px;">
        <div style="font-weight:600; color:var(--dark-text); font-size:0.95rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${art}</div>
        <div style="font-size:0.75rem; color:var(--subtitle-color); font-variant:small-caps; letter-spacing:1px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${byline}</div>
      </div>
      <div style="display:flex; gap:8px; flex-shrink:0;">
        <button class="secondary btn-sm edit-btn">Edit</button>
        <button class="btn-danger btn-sm delete-btn" style="background:transparent; border:1px solid #e74c3c; color:#e74c3c;">Delete</button>
      </div>
    `;

    item
      .querySelector(".edit-btn")
      .addEventListener("click", () => editCustomArticle(domain, sub, art));
    item
      .querySelector(".delete-btn")
      .addEventListener("click", () => deleteCustomArticle(domain, sub, art));
    list.appendChild(item);
  });

  if (!hasItems) {
    list.innerHTML =
      '<div class="glass-panel" style="padding: 24px; text-align: center; color: var(--subtitle-color); font-size: 0.9rem;">No stories yet.</div>';
  }
}

function editCustomArticle(domain, sub, art) {
  // Read from the live library so ANY story can be edited (built-in or custom);
  // saving writes it into custom content so the edit persists.
  const artObj =
    window.topicsData?.[domain]?.subtopics?.[sub]?.articles?.[art] || {};
  const content = artObj.content || "";
  const hook =
    artObj.description ||
    window.topicsData?.[domain]?.subtopics?.[sub]?.description ||
    "";

  genEditingOriginal = { domain, sub, art };

  const gd1 = document.getElementById("genDomain");
  if (gd1) gd1.value = domain;
  document.getElementById("genTitle").value = art;
  document.getElementById("genHook").value = hook;
  document.getElementById("genContent").value = content;
  const gAuthor = document.getElementById("genAuthor");
  if (gAuthor) gAuthor.value = artObj.author || "";
  const gGenres = document.getElementById("genGenres");
  if (gGenres) gGenres.value = (artObj.genres || []).join(", ");
  genImagePos = artObj.imagePos || "50% 50%";
  resolveImageRef(artObj.image || "").then((dataUrl) => {
    setGenImagePreview(dataUrl, artObj.image || "");
    if (artObj.imageFit && artObj.imageFit < 1) {
      genImageZoom = artObj.imageFit;
      _genApplyCrop();
    }
  });
  updateGenContentCount();

  document.getElementById("btnGenNew").click();

  // Clear any leftover "Story Saved!" success card from a previous save and
  // make sure the submit button is visible so it reads "Update Story".
  const leftoverSuccess = document.getElementById("genSuccessState");
  if (leftoverSuccess) leftoverSuccess.style.display = "none";
  const createFlow = document.getElementById("genCreateFlow");
  if (createFlow) createFlow.style.display = "block";
  const submitBtn = document.getElementById("genSubmitBtn");
  if (submitBtn) {
    submitBtn.style.display = "block";
    submitBtn.disabled = false;
    submitBtn.textContent = "Update Story";
  }
  document.getElementById("genCancelEditBtn").style.display = "block";

  // "Edit Next" only makes sense if there's another story after this one.
  const editNextBtn = document.getElementById("genEditNextBtn");
  if (editNextBtn) {
    const list = getManageOrderedList();
    const idx = list.findIndex(
      (s) => s.domain === domain && s.sub === sub && s.art === art,
    );
    editNextBtn.style.display =
      idx >= 0 && idx < list.length - 1 ? "block" : "none";
  }
}

// Stories in the same order the Manage list shows them (newest first).
function getManageOrderedList() {
  const list = [];
  const src = window.topicsData || {};
  Object.keys(src).forEach((domain) => {
    Object.keys(src[domain].subtopics || {}).forEach((sub) => {
      Object.keys(src[domain].subtopics[sub].articles || {}).forEach((art) => {
        list.push({ domain, sub, art });
      });
    });
  });
  list.reverse();
  return list;
}

// Save the current edit, then jump straight into editing the next story.
function saveAndEditNext() {
  if (!genEditingOriginal) return;
  const cur = genEditingOriginal;
  const list = getManageOrderedList();
  const idx = list.findIndex(
    (s) => s.domain === cur.domain && s.sub === cur.sub && s.art === cur.art,
  );
  const next = idx >= 0 ? list[idx + 1] : null;

  const submitBtn = document.getElementById("genSubmitBtn");
  if (submitBtn) submitBtn.click(); // persists the current story synchronously

  setTimeout(() => {
    if (next) {
      editCustomArticle(next.domain, next.sub, next.art);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, 60);
}
window.saveAndEditNext = saveAndEditNext;

async function deleteCustomArticle(domain, sub, art) {
  if (!confirm(`Delete "${art}" permanently from your local library?`)) return;

  const customData = JSON.parse(
    localStorage.getItem("osmosis_custom_content") || "{}",
  );
  if (
    customData[domain] &&
    customData[domain].subtopics[sub] &&
    customData[domain].subtopics[sub].articles[art]
  ) {
    delete customData[domain].subtopics[sub].articles[art];
    if (Object.keys(customData[domain].subtopics[sub].articles).length === 0)
      delete customData[domain].subtopics[sub];
    if (Object.keys(customData[domain].subtopics).length === 0)
      delete customData[domain];

    localStorage.setItem("osmosis_custom_content", JSON.stringify(customData));

    if (window.topicsData[domain]?.subtopics[sub]?.articles[art]) {
      delete window.topicsData[domain].subtopics[sub].articles[art];
      if (
        Object.keys(window.topicsData[domain].subtopics[sub].articles)
          .length === 0
      )
        delete window.topicsData[domain].subtopics[sub];
      if (Object.keys(window.topicsData[domain].subtopics).length === 0)
        delete window.topicsData[domain];
    }

    renderGeneratorManageList();
    showToast("Article deleted.");
    triggerAutoSync();
    try {
      if (typeof publishToDisk === "function") publishToDisk();
    } catch (e) {}
  }
}

function saveGenDraft() {
  if (genEditingOriginal) return; // Don't save draft if actively editing an existing article
  const draft = {
    domain: document.getElementById("genDomain")?.value || "",
    title: document.getElementById("genTitle").value,
    hook: document.getElementById("genHook").value,
    content: document.getElementById("genContent").value,
    author: document.getElementById("genAuthor")?.value || "",
    genres: document.getElementById("genGenres")?.value || "",
    // Only persist a lightweight reference in the draft — never the base64
    // image bytes (those would refill localStorage and break autosave).
    image: genImageRef && genImageRef.startsWith("idb:") ? genImageRef : "",
    imagePos: genImagePos || "50% 50%",
  };
  try {
    localStorage.setItem("osmosis_gen_draft", JSON.stringify(draft));
  } catch (e) {
    /* draft is best-effort; ignore quota errors */
  }
}

// ---- The Compositor: smart paste on the Writing Desk ----
// When a large paste lands in an empty body, quietly propose pulling a
// title, author, and hook out of it. One inline row: Apply / Dismiss.
let _compositor = null;
function handleCompositorPaste(e) {
  const ta = e.target;
  if (!ta || ta.value.trim()) return; // only offers on an empty sheet
  const text =
    (e.clipboardData || window.clipboardData)?.getData("text") || "";
  if (text.length < 300) return;
  setTimeout(() => proposeCompositor(text), 0);
}
function proposeCompositor(text) {
  const lines = text.split(/\r?\n/);
  let title = null;
  let author = null;
  const titleField = document.getElementById("genTitle");
  const authorField = document.getElementById("genAuthor");
  const hookField = document.getElementById("genHook");

  // First short line with no closing punctuation reads as a title
  let li = 0;
  while (li < lines.length && !lines[li].trim()) li++;
  const first = (lines[li] || "").trim();
  if (
    first &&
    first.length >= 3 &&
    first.length <= 90 &&
    !/[.!?,;:]$/.test(first) &&
    first.split(/\s+/).length <= 12
  ) {
    title = { text: first, line: li };
  }
  // A "by So-and-so" line in the opening lines reads as the author
  for (let i = li; i < Math.min(lines.length, li + 6); i++) {
    const m = lines[i].trim().match(/^by\s+([A-Za-zÀ-ɏ.'’\- ]{2,60})$/i);
    if (m) {
      author = { text: m[1].trim(), line: i };
      break;
    }
  }
  const parts = [];
  if (title && titleField && !titleField.value.trim())
    parts.push(
      `title “${title.text.length > 40 ? title.text.slice(0, 40) + "…" : title.text}”`,
    );
  else title = null;
  if (author && authorField && !authorField.value.trim())
    parts.push(`author ${author.text}`);
  else author = null;
  // First real sentence of the prose becomes the hook suggestion
  let hook = null;
  if (hookField && !hookField.value.trim()) {
    const bodyLines = lines.filter(
      (_, i) =>
        i !== (title ? title.line : -1) && i !== (author ? author.line : -1),
    );
    const m = bodyLines
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()
      .match(/[^.!?]{25,160}[.!?]/);
    if (m) {
      hook = m[0].trim();
      parts.push("a one-line hook");
    }
  }
  if (!parts.length) return;
  _compositor = { title, author, hook };

  let row = document.getElementById("compositorRow");
  if (!row) {
    row = document.createElement("div");
    row.id = "compositorRow";
    row.className = "cmp-row";
    const sheet = document.querySelector(".studio-manuscript");
    if (sheet) sheet.appendChild(row);
    else return;
  }
  row.innerHTML = `
    <span class="cmp-text">Set ${parts.join(" · ")}?</span>
    <span class="cmp-actions">
      <button class="text-btn" onclick="applyCompositor()">Apply</button>
      <button class="text-btn cmp-dismiss" onclick="dismissCompositor()">Dismiss</button>
    </span>`;
  row.style.display = "flex";
}
function applyCompositor() {
  if (!_compositor) return dismissCompositor();
  const ta = document.getElementById("genContent");
  const { title, author, hook } = _compositor;
  if (title) {
    const f = document.getElementById("genTitle");
    if (f && !f.value.trim()) f.value = title.text;
  }
  if (author) {
    const f = document.getElementById("genAuthor");
    if (f && !f.value.trim()) f.value = author.text;
  }
  if (hook) {
    const f = document.getElementById("genHook");
    if (f && !f.value.trim()) f.value = hook;
  }
  // Strip the consumed title/author lines from the body (the hook stays,
  // since it is the story's own first sentence, not front matter)
  if (ta && (title || author)) {
    const lines = ta.value.split(/\r?\n/);
    const drop = new Set(
      [title ? title.line : -1, author ? author.line : -1].filter(
        (x) => x >= 0,
      ),
    );
    ta.value = lines
      .filter((_, i) => !drop.has(i))
      .join("\n")
      .replace(/^\n+/, "");
    updateGenContentCount();
  }
  dismissCompositor();
}
function dismissCompositor() {
  _compositor = null;
  const row = document.getElementById("compositorRow");
  if (row) row.remove();
}
window.applyCompositor = applyCompositor;
window.dismissCompositor = dismissCompositor;

function updateGenContentCount() {
  const ta = document.getElementById("genContent");
  const out = document.getElementById("genContentCount");
  if (!ta || !out) return;
  const text = ta.value.trim();
  const words = text ? text.split(/\s+/).length : 0;
  const mins = Math.max(1, Math.round(words / 200));
  out.textContent = `${words} word${words === 1 ? "" : "s"} · ~${mins} min read`;
}

/* ============================================================
   IMAGE STORAGE — cover photos live in IndexedDB, not localStorage.
   localStorage caps at ~5MB (tighter on iPhone), so a few base64
   photos fill it and saving fails. IndexedDB has hundreds of MB and
   is more persistent. We keep only a tiny "idb:<id>" reference in
   osmosis_custom_content; the real image bytes go to IndexedDB.
   Legacy stories that still hold an inline "data:" URL keep working.
   ============================================================ */
let _osmosisDbPromise = null;
function _osmosisIdb() {
  if (_osmosisDbPromise) return _osmosisDbPromise;
  _osmosisDbPromise = new Promise((resolve, reject) => {
    let req;
    try {
      req = indexedDB.open("osmosis", 1);
    } catch (e) {
      reject(e);
      return;
    }
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains("images"))
        req.result.createObjectStore("images");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _osmosisDbPromise;
}
function idbSetImage(id, dataUrl) {
  return _osmosisIdb().then(
    (db) =>
      new Promise((res, rej) => {
        const tx = db.transaction("images", "readwrite");
        tx.objectStore("images").put(dataUrl, id);
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      }),
  );
}
function idbGetImage(id) {
  return _osmosisIdb().then(
    (db) =>
      new Promise((res, rej) => {
        const tx = db.transaction("images", "readonly");
        const r = tx.objectStore("images").get(id);
        r.onsuccess = () => res(r.result || "");
        r.onerror = () => rej(r.error);
      }),
  );
}
function genNewImageId() {
  return (
    "img_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8)
  );
}

// In-memory cache of resolved images (by idb id) so we don't hit
// IndexedDB repeatedly and freshly-saved photos show instantly.
const _imgCache = {};

// Turn a stored image value into a usable src. Accepts a data URL
// (used directly), an "idb:<id>" reference (loaded from IndexedDB),
// or "" (no image). Always returns a Promise<string>.
function resolveImageRef(ref) {
  if (!ref) return Promise.resolve("");
  if (ref.startsWith("data:")) return Promise.resolve(ref);
  if (ref.startsWith("idb:")) {
    const id = ref.slice(4);
    if (_imgCache[id] != null) return Promise.resolve(_imgCache[id]);
    return idbGetImage(id)
      .then((data) => {
        _imgCache[id] = data || "";
        return _imgCache[id];
      })
      .catch(() => "");
  }
  return Promise.resolve(ref);
}

// Fill in any <img data-img-ref="..."> inside root by resolving the ref.
function hydrateImages(root) {
  (root || document).querySelectorAll("img[data-img-ref]").forEach((img) => {
    const ref = img.getAttribute("data-img-ref");
    img.removeAttribute("data-img-ref");
    resolveImageRef(ref).then((src) => {
      if (src) img.src = src;
      else img.style.display = "none";
    });
  });
}
window.hydrateImages = hydrateImages;

// Read every stored image out of IndexedDB as { id: dataUrl } (for backups).
function idbGetAllImages() {
  return _osmosisIdb()
    .then(
      (db) =>
        new Promise((res) => {
          const out = {};
          const tx = db.transaction("images", "readonly");
          const req = tx.objectStore("images").openCursor();
          req.onsuccess = () => {
            const cur = req.result;
            if (cur) {
              out[cur.key] = cur.value;
              cur.continue();
            } else res(out);
          };
          req.onerror = () => res(out);
        }),
    )
    .catch(() => ({}));
}

// Walk a topicsData tree; move any inline "data:" cover image into IndexedDB
// and replace it with an "idb:<id>" reference (mutates in place). Used on
// import so a photo-heavy library never overflows localStorage.
async function externalizeInlineImages(topics) {
  if (typeof indexedDB === "undefined") return;
  const jobs = [];
  Object.keys(topics || {}).forEach((d) => {
    const subs = topics[d]?.subtopics || {};
    Object.keys(subs).forEach((s) => {
      const arts = subs[s]?.articles || {};
      Object.keys(arts).forEach((a) => {
        const art = arts[a];
        if (
          art &&
          typeof art.image === "string" &&
          art.image.startsWith("data:")
        ) {
          const id = genNewImageId();
          const dataUrl = art.image;
          jobs.push(
            idbSetImage(id, dataUrl)
              .then(() => {
                _imgCache[id] = dataUrl;
                art.image = "idb:" + id;
              })
              .catch(() => {}),
          );
        }
      });
    });
  });
  await Promise.all(jobs);
}

// Return a deep copy of a topicsData tree with every "idb:" reference expanded
// back into a real "data:" URL, so an exported file is fully self-contained.
async function inlineTopicsImages(topics) {
  const clone = JSON.parse(JSON.stringify(topics || {}));
  const jobs = [];
  Object.keys(clone).forEach((d) => {
    const subs = clone[d]?.subtopics || {};
    Object.keys(subs).forEach((s) => {
      const arts = subs[s]?.articles || {};
      Object.keys(arts).forEach((a) => {
        const art = arts[a];
        if (
          art &&
          typeof art.image === "string" &&
          art.image.startsWith("idb:")
        ) {
          jobs.push(
            resolveImageRef(art.image).then((src) => {
              art.image = src || "";
            }),
          );
        }
      });
    });
  });
  await Promise.all(jobs);
  return clone;
}

// ---- Frontispiece image upload (stored as a downscaled data URL) ----
let genImageData = "";
let genImagePos = "50% 50%";
let genImageZoom = 1; // 1–3; baked into the image at save time
// Reference ("idb:<id>") for an already-stored image being edited, so a
// re-save without changing the photo reuses it instead of duplicating.
let genImageRef = "";

function _genApplyCrop() {
  const img = document.getElementById("genCropImg");
  if (!img) return;
  img.style.objectPosition = genImagePos;
  if (genImageZoom < 1) {
    // fit mode: the whole photo, inset with margins
    img.style.objectFit = "contain";
    img.style.transform = `scale(${genImageZoom})`;
    img.style.transformOrigin = "50% 50%";
  } else {
    img.style.objectFit = "cover";
    img.style.transform = `scale(${genImageZoom})`;
    img.style.transformOrigin = genImagePos;
  }
  const label = document.getElementById("genZoomLabel");
  if (label) label.textContent = `${Math.round(genImageZoom * 100)}%`;
}
function genZoomBy(factor) {
  genImageZoom = Math.max(0.5, Math.min(3, genImageZoom * factor));
  if (Math.abs(genImageZoom - 1) < 0.03) genImageZoom = 1;
  _genApplyCrop();
}
window.genZoomBy = genZoomBy;

// Bake the chosen zoom + position into a final 4:3 cover image, so every
// render site (cards, reader, exports) keeps working with plain photos.
function bakeGenImageCrop() {
  return new Promise((resolve) => {
    if (!genImageData || genImageZoom <= 1.001 || !genImageData.startsWith("data:")) {
      resolve(genImageData);
      return;
    }
    const img = new Image();
    img.onload = () => {
      try {
        const W = 1000;
        const H = 750;
        const cover = Math.max(W / img.width, H / img.height);
        const scale = cover * genImageZoom;
        const sw = W / scale;
        const sh = H / scale;
        const parts = (genImagePos || "50% 50%").split(" ");
        const px = (parseFloat(parts[0]) || 50) / 100;
        const py = (parseFloat(parts[1]) || 50) / 100;
        const sx = (img.width - sw) * px;
        const sy = (img.height - sh) * py;
        const cv = document.createElement("canvas");
        cv.width = W;
        cv.height = H;
        cv.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
        resolve(cv.toDataURL("image/jpeg", 0.85));
      } catch (e) {
        resolve(genImageData);
      }
    };
    img.onerror = () => resolve(genImageData);
    img.src = genImageData;
  });
}

function setGenImagePreview(dataUrl, ref) {
  genImageData = dataUrl || "";
  genImageRef = ref || "";
  genImageZoom = 1;
  const prev = document.getElementById("genImagePreview");
  if (!prev) return;
  if (!dataUrl) {
    prev.style.display = "none";
    prev.innerHTML = "";
    return;
  }
  prev.style.display = "block";
  prev.innerHTML = `
    <div style="font-size:0.8rem; color:var(--subtitle-color); margin-bottom:8px;">Drag to position · pinch or − / + to zoom. Below 100% shows the whole photo on the story page; cards keep the uniform crop.</div>
    <div id="genCropBox" style="width:100%; max-width:340px; aspect-ratio:4/3; border-radius:10px; overflow:hidden; position:relative; cursor:grab; background:var(--glass-solid); border:1px solid var(--glass-border); touch-action:none;">
      <img id="genCropImg" src="${dataUrl}" alt="" draggable="false" style="width:100%; height:100%; object-fit:cover; object-position:${genImagePos}; user-select:none; pointer-events:none; display:block; will-change:transform;" />
    </div>
    <div style="display:flex; align-items:center; gap:10px; margin-top:10px; flex-wrap:wrap;">
      <button type="button" onclick="genZoomBy(1/1.1)" class="gen-zoom-btn" aria-label="Zoom out">−</button>
      <span id="genZoomLabel" style="font-family:'Lora',Georgia,serif; font-size:0.78rem; color:var(--subtitle-color); min-width:44px; text-align:center;">100%</span>
      <button type="button" onclick="genZoomBy(1.1)" class="gen-zoom-btn" aria-label="Zoom in">+</button>
      <button type="button" onclick="clearGenImage()" style="margin-left:auto; background: var(--glass-solid); border: 1px solid var(--glass-border); padding: 6px 14px; cursor: pointer; color: var(--subtitle-color); font-size: 0.8rem; border-radius: 999px;">Remove</button>
    </div>
  `;
  attachGenCropDrag();
  _genApplyCrop();
}

// Let the user drag the uploaded photo to choose exactly how it sits in the cover.
function attachGenCropDrag() {
  const box = document.getElementById("genCropBox");
  const img = document.getElementById("genCropImg");
  if (!box || !img) return;
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let posX = 50;
  let posY = 50;

  const readPos = () => {
    const parts = (genImagePos || "50% 50%").split(" ");
    posX = parseFloat(parts[0]);
    posY = parseFloat(parts[1]);
    if (!Number.isFinite(posX)) posX = 50;
    if (!Number.isFinite(posY)) posY = 50;
  };

  let pinch = null;
  const dist2 = (t) =>
    Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

  const onMove = (e) => {
    if (e.touches && e.touches.length === 2) {
      // pinch to zoom
      if (!pinch) pinch = { d: dist2(e.touches), z: genImageZoom };
      genImageZoom = Math.max(
        0.5,
        Math.min(3, pinch.z * (dist2(e.touches) / pinch.d)),
      );
      if (Math.abs(genImageZoom - 1) < 0.03) genImageZoom = 1;
      _genApplyCrop();
      if (e.cancelable) e.preventDefault();
      return;
    }
    if (!dragging) return;
    const p = e.touches ? e.touches[0] : e;
    const rect = box.getBoundingClientRect();
    // zoomed in = finer movement, so the frame tracks the finger naturally
    let nx = posX - ((p.clientX - startX) / rect.width / genImageZoom) * 100;
    let ny = posY - ((p.clientY - startY) / rect.height / genImageZoom) * 100;
    nx = Math.max(0, Math.min(100, nx));
    ny = Math.max(0, Math.min(100, ny));
    genImagePos = `${nx.toFixed(1)}% ${ny.toFixed(1)}%`;
    _genApplyCrop();
    if (e.cancelable) e.preventDefault();
  };

  const onUp = () => {
    dragging = false;
    pinch = null;
    box.style.cursor = "grab";
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
    window.removeEventListener("touchmove", onMove);
    window.removeEventListener("touchend", onUp);
  };

  const onDown = (e) => {
    dragging = true;
    box.style.cursor = "grabbing";
    const p = e.touches ? e.touches[0] : e;
    startX = p.clientX;
    startY = p.clientY;
    readPos();
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp);
    if (e.cancelable) e.preventDefault();
  };

  box.addEventListener("mousedown", onDown);
  box.addEventListener("touchstart", onDown, { passive: false });
  box.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      genZoomBy(e.deltaY < 0 ? 1.1 : 1 / 1.1);
    },
    { passive: false },
  );
}

function clearGenImage() {
  genImageData = "";
  genImageRef = "";
  genImagePos = "50% 50%";
  genImageZoom = 1;
  const input = document.getElementById("genImage");
  if (input) input.value = "";
  const prev = document.getElementById("genImagePreview");
  if (prev) {
    prev.style.display = "none";
    prev.innerHTML = "";
  }
}

function handleGenImageInput(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  genImagePos = "50% 50%"; // a freshly uploaded photo starts centered
  const reader = new FileReader();
  reader.onload = (ev) => {
    const img = new Image();
    img.onload = () => {
      // Downscale so the stored image stays within localStorage limits
      const maxDim = 1000;
      let width = img.width;
      let height = img.height;
      if (width > maxDim || height > maxDim) {
        const scale = Math.min(maxDim / width, maxDim / height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      let dataUrl = ev.target.result;
      try {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        dataUrl = canvas.toDataURL("image/jpeg", 0.82);
      } catch (err) {
        /* keep original data URL on any canvas error */
      }
      setGenImagePreview(dataUrl);
    };
    img.onerror = () => setGenImagePreview(ev.target.result);
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}
window.clearGenImage = clearGenImage;

function restoreGenDraft() {
  if (genEditingOriginal) return;
  try {
    const draft = JSON.parse(
      localStorage.getItem("osmosis_gen_draft") || "null",
    );
    if (draft) {
      const gd2 = document.getElementById("genDomain");
      if (gd2) gd2.value = draft.domain || "";
      document.getElementById("genTitle").value = draft.title || "";
      document.getElementById("genHook").value = draft.hook || "";
      document.getElementById("genContent").value = draft.content || "";
      const gA = document.getElementById("genAuthor");
      if (gA) gA.value = draft.author || "";
      const gG = document.getElementById("genGenres");
      if (gG) gG.value = draft.genres || "";
      genImagePos = draft.imagePos || "50% 50%";
      resolveImageRef(draft.image || "").then((dataUrl) =>
        setGenImagePreview(dataUrl, draft.image || ""),
      );
      updateGenContentCount();
    }
  } catch (e) {}
}

function checkDailyReminder() {
  if (localStorage.getItem("osmosis_reminder_enabled") !== "1") return;

  const reminderTime = localStorage.getItem("osmosis_reminder_time") || "20:00";
  const lastReminderDate = localStorage.getItem("osmosis_last_reminder_date");
  const now = new Date();
  const todayStr =
    now.getFullYear() +
    "-" +
    String(now.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(now.getDate()).padStart(2, "0");

  if (lastReminderDate === todayStr) return; // Already reminded today

  const currentTime =
    now.getHours().toString().padStart(2, "0") +
    ":" +
    now.getMinutes().toString().padStart(2, "0");
  if (currentTime >= reminderTime) {
    localStorage.setItem("osmosis_last_reminder_date", todayStr);
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        if (
          "serviceWorker" in navigator &&
          navigator.serviceWorker.controller
        ) {
          navigator.serviceWorker.ready.then((reg) => {
            reg.showNotification("Osmosis Reading Time", {
              body: "Take a few minutes to explore your Knowledge Web.",
              icon: "logo.svg",
              tag: "osmosis-reminder",
            });
          });
        } else {
          new Notification("Osmosis Reading Time", {
            body: "Take a few minutes to explore your Knowledge Web.",
            icon: "logo.svg",
          });
        }
      } catch (e) {
        showToast("Time for your daily reading!");
      }
    } else {
      showToast("Time for your daily reading!");
    }
  }

  if (
    localStorage.getItem("osmosis_reminder_enabled") === "1" &&
    "Notification" in window &&
    Notification.permission === "granted"
  ) {
    scheduleBackgroundReminder(reminderTime);
  }
}

async function scheduleBackgroundReminder(timeStr) {
  if (!("serviceWorker" in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    if ("showTrigger" in Notification.prototype) {
      const now = new Date();
      const [hours, minutes] = timeStr.split(":").map(Number);
      const scheduledTime = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        hours,
        minutes,
        0,
      );
      if (scheduledTime <= now)
        scheduledTime.setDate(scheduledTime.getDate() + 1);
      await reg.showNotification("Osmosis Reading Time", {
        tag: "osmosis-reminder-bg",
        body: "Take a few minutes to explore your Knowledge Web.",
        icon: "logo.svg",
        showTrigger: new TimestampTrigger(scheduledTime.getTime()),
      });
    }
  } catch (e) {
    console.log("Background scheduling failed", e);
  }
}

// ============================================================
// EDITORIAL ("The Quarterly") SKIN TOGGLE
// ------------------------------------------------------------
// Orthogonal to data-theme (light/dark/midnight) — like
// data-read-theme — and scoped in CSS to the reading views, so
// turning it on never disturbs the other views. Self-contained;
// it does not touch initTheme()/toggleTheme()/applyAutoDark().
// ============================================================
(function () {
  // Editorial ("The Quarterly") is the app's one permanent design.
  // The head script applies it pre-paint; this is the safety net.
  document.documentElement.setAttribute("data-skin", "editorial");
  try {
    localStorage.setItem("osmosis_skin", "editorial");
  } catch (e) {}
})();
