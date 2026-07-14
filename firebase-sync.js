/* ============================================================
   Osmosis — Account & Cloud Sync (Firebase)
   ------------------------------------------------------------
   Optional. If window.OSMOSIS_FIREBASE_CONFIG is not filled in
   with a real project config, this file does nothing and the app
   runs exactly as before (local-only). Once configured, it adds:
     • Google sign-in
     • Sync of everything in localStorage EXCEPT cover photos
       (photos live in IndexedDB, so they're excluded naturally)
   Sync model: last-write-wins on a full snapshot, per user.
   ============================================================ */
(function () {
  "use strict";

  var CFG = window.OSMOSIS_FIREBASE_CONFIG || {};
  var SDK_VER = "10.12.2";
  var SDK = [
    "https://www.gstatic.com/firebasejs/" + SDK_VER + "/firebase-app-compat.js",
    "https://www.gstatic.com/firebasejs/" + SDK_VER + "/firebase-auth-compat.js",
    "https://www.gstatic.com/firebasejs/" +
      SDK_VER +
      "/firebase-firestore-compat.js",
  ];

  // ---- config guard -------------------------------------------------
  function configured() {
    return (
      CFG &&
      CFG.apiKey &&
      CFG.projectId &&
      CFG.appId &&
      String(CFG.apiKey).indexOf("PASTE_") !== 0 &&
      String(CFG.apiKey).indexOf("YOUR_") !== 0
    );
  }

  // ---- which localStorage keys sync --------------------------------
  var DENY_EXACT = { osmosis_sync_updatedAt: 1, osmosis_auth_token: 1 };
  function isSynced(k) {
    if (!k) return false;
    if (k.indexOf("firebase:") === 0) return false; // auth tokens — never sync
    if (DENY_EXACT[k]) return false;
    return true;
  }
  function collectLocal() {
    var out = {};
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (isSynced(k)) out[k] = localStorage.getItem(k);
    }
    return out;
  }
  function hasMeaningfulLocalData() {
    try {
      var j = JSON.parse(localStorage.getItem("osmosis_journey") || "null");
      if (j && j.timeline && j.timeline.length) return true;
    } catch (e) {}
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf("article_") === 0) return true;
    }
    return false;
  }

  var _rawSet = Storage.prototype.setItem;
  var _rawRemove = Storage.prototype.removeItem;
  var applying = false; // true while we write cloud→local (suppresses push)

  function applyCloud(blobStr, cloudUpdated) {
    applying = true;
    try {
      var obj = JSON.parse(blobStr || "{}");
      // Clear existing synced keys so deletions on other devices propagate.
      var toRemove = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (isSynced(k)) toRemove.push(k);
      }
      toRemove.forEach(function (k) {
        _rawRemove.call(localStorage, k);
      });
      Object.keys(obj).forEach(function (k) {
        _rawSet.call(localStorage, k, obj[k]);
      });
      _rawSet.call(
        localStorage,
        "osmosis_sync_updatedAt",
        String(cloudUpdated || Date.now()),
      );
    } catch (e) {
      console.warn("applyCloud failed", e);
    } finally {
      applying = false;
    }
  }

  // ---- Firebase state ----------------------------------------------
  var auth = null,
    db = null,
    user = null,
    ready = false,
    initialSyncDone = false,
    pushTimer = null;

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src;
      s.async = false;
      s.onload = resolve;
      s.onerror = function () {
        reject(new Error("Failed to load " + src));
      };
      document.head.appendChild(s);
    });
  }
  function loadSDK() {
    return SDK.reduce(function (p, src) {
      return p.then(function () {
        return loadScript(src);
      });
    }, Promise.resolve());
  }

  function docRef() {
    if (!db || !user) return null;
    return db.collection("osmosis").doc(user.uid);
  }

  function pushNow() {
    var ref = docRef();
    if (!ref) return Promise.resolve();
    var blob = JSON.stringify(collectLocal());
    if (blob.length > 950000) {
      toast("Library is large — syncing may fail (over 1 MB).");
    }
    var now = Date.now();
    setStatus("Syncing…");
    return ref
      .set({ blob: blob, updatedAt: now, v: 1 })
      .then(function () {
        _rawSet.call(localStorage, "osmosis_sync_updatedAt", String(now));
        setStatus("Synced");
      })
      .catch(function (e) {
        console.warn("push failed", e);
        setStatus("Sync error");
      });
  }

  function scheduleSync(key) {
    if (applying || !ready || !user) return;
    if (!isSynced(key)) return;
    _rawSet.call(localStorage, "osmosis_sync_updatedAt", String(Date.now()));
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(function () {
      pushTimer = null;
      pushNow();
    }, 2000);
  }

  // Capture every localStorage write so we never have to touch call sites.
  Storage.prototype.setItem = function (k, v) {
    _rawSet.apply(this, arguments);
    if (this === window.localStorage) scheduleSync(k);
  };
  Storage.prototype.removeItem = function (k) {
    _rawRemove.apply(this, arguments);
    if (this === window.localStorage) scheduleSync(k);
  };

  function initialSync() {
    if (initialSyncDone) return;
    initialSyncDone = true;
    var ref = docRef();
    if (!ref) return;
    setStatus("Syncing…");
    ref
      .get()
      .then(function (snap) {
        var localUpdated =
          parseInt(localStorage.getItem("osmosis_sync_updatedAt") || "0", 10) ||
          0;
        if (snap.exists && snap.data() && snap.data().blob) {
          var data = snap.data();
          var cloudUpdated = data.updatedAt || 0;
          if (!hasMeaningfulLocalData() || cloudUpdated > localUpdated) {
            applyCloud(data.blob, cloudUpdated);
            toast("Library synced from your account.");
            setTimeout(function () {
              location.reload();
            }, 700);
          } else {
            pushNow(); // local is newer → make cloud match
          }
        } else {
          pushNow(); // nothing in the cloud yet → seed it with local
        }
      })
      .catch(function (e) {
        console.warn("initial sync failed", e);
        setStatus("Sync error");
      });
  }

  // ---- sign in / out ------------------------------------------------
  function inStandalonePWA() {
    return (
      (window.matchMedia &&
        window.matchMedia("(display-mode: standalone)").matches) ||
      window.navigator.standalone === true
    );
  }
  function signIn() {
    if (!auth) return;
    var provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    // Installed PWAs block popups — use redirect there.
    if (inStandalonePWA()) {
      auth.signInWithRedirect(provider);
      return;
    }
    auth.signInWithPopup(provider).catch(function (e) {
      if (
        e &&
        (e.code === "auth/popup-blocked" ||
          e.code === "auth/cancelled-popup-request" ||
          e.code === "auth/operation-not-supported-in-this-environment")
      ) {
        auth.signInWithRedirect(provider);
      } else if (e && e.code !== "auth/popup-closed-by-user") {
        toast("Sign-in failed: " + (e.message || e.code));
      }
    });
  }
  function signOut() {
    if (!auth) return;
    // Flush any pending changes before leaving.
    var done = pushTimer ? pushNow() : Promise.resolve();
    done.finally(function () {
      auth.signOut();
    });
  }
  window.osmosisSignIn = signIn;
  window.osmosisSignOut = signOut;
  window.osmosisSyncNow = function () {
    if (user) pushNow();
  };

  // ---- account panel UI --------------------------------------------
  var lastStatus = "";
  function setStatus(s) {
    lastStatus = s;
    var el = document.getElementById("acctStatus");
    if (el) el.textContent = s;
  }
  function esc(x) {
    return String(x == null ? "" : x).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function renderPanel() {
    var el = document.getElementById("accountPanel");
    if (!el) return;

    if (!configured()) {
      el.innerHTML =
        '<div class="acct-row"><div class="acct-info">' +
        '<div class="acct-name">Cloud sync — not set up</div>' +
        '<div class="acct-sub">Add a free Firebase project to sync everything across your devices.</div>' +
        "</div></div>" +
        '<details class="acct-help"><summary>How to enable it</summary>' +
        '<ol class="acct-steps">' +
        "<li>Go to <b>console.firebase.google.com</b> → <b>Add project</b>.</li>" +
        "<li>In the project, open <b>Build → Authentication → Sign-in method</b> and enable <b>Google</b>.</li>" +
        "<li>Open <b>Build → Firestore Database → Create database</b> (Production mode).</li>" +
        "<li>In <b>Project settings → General</b>, under <i>Your apps</i>, add a <b>Web app</b> and copy the <b>firebaseConfig</b> values.</li>" +
        "<li>Paste them into <b>OSMOSIS_FIREBASE_CONFIG</b> in <b>index.html</b>.</li>" +
        "<li>In <b>Authentication → Settings → Authorized domains</b>, add your site's domain.</li>" +
        "</ol></details>";
      return;
    }

    if (user) {
      var name = user.displayName || user.email || "Signed in";
      var photo = user.photoURL
        ? '<img class="acct-avatar" src="' +
          esc(user.photoURL) +
          '" alt="" referrerpolicy="no-referrer" />'
        : '<div class="acct-avatar acct-avatar-none">' +
          esc(name.charAt(0).toUpperCase()) +
          "</div>";
      el.innerHTML =
        '<div class="acct-row">' +
        photo +
        '<div class="acct-info">' +
        '<div class="acct-name">' +
        esc(name) +
        "</div>" +
        '<div class="acct-sub">Synced to your account · <span id="acctStatus">' +
        esc(lastStatus || "Synced") +
        "</span></div>" +
        "</div></div>" +
        '<div class="acct-actions">' +
        '<button class="secondary btn-sm" onclick="osmosisSyncNow()">Sync now</button>' +
        '<button class="secondary btn-sm" onclick="osmosisSignOut()">Sign out</button>' +
        "</div>";
    } else {
      el.innerHTML =
        '<div class="acct-row"><div class="acct-info">' +
        '<div class="acct-name">Not signed in</div>' +
        '<div class="acct-sub">Sign in to save everything to your account and sync across devices.</div>' +
        "</div></div>" +
        '<button class="primary acct-google" onclick="osmosisSignIn()">' +
        '<svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35 24 35c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 5.1 29.5 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21c10.5 0 20-7.6 20-21 0-1.2-.1-2.3-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 16 4 9.1 8.6 6.3 14.7z"/><path fill="#4CAF50" d="M24 45c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.2 36 26.7 37 24 37c-5.3 0-9.7-2.6-11.3-7l-6.5 5C9 41.3 16 45 24 45z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6.3 5.3C40.9 36.5 44 30.9 44 24c0-1.2-.1-2.3-.4-3.5z"/></svg>' +
        "Sign in with Google</button>";
    }
  }
  window.osmosisRenderAccountPanel = renderPanel;

  function toast(msg) {
    if (typeof window.showToast === "function") window.showToast(msg);
    else console.log(msg);
  }

  // ---- boot ---------------------------------------------------------
  function boot() {
    renderPanel(); // show something immediately (config help or sign-in)
    if (!configured()) return;
    loadSDK()
      .then(function () {
        firebase.initializeApp(CFG);
        auth = firebase.auth();
        db = firebase.firestore();
        return auth
          .setPersistence(firebase.auth.Auth.Persistence.LOCAL)
          .catch(function () {});
      })
      .then(function () {
        ready = true;
        // Complete any redirect-based sign-in.
        auth.getRedirectResult().catch(function () {});
        auth.onAuthStateChanged(function (u) {
          user = u || null;
          renderPanel();
          if (user) {
            initialSyncDone = false;
            initialSync();
          }
        });
      })
      .catch(function (e) {
        console.warn("Firebase failed to load", e);
        setStatus("Offline");
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
