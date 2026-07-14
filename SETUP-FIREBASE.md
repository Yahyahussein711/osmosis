# Enable account login & cloud sync (Firebase)

Osmosis works fully offline/local by default. To turn on **Google sign-in** and
**cross-device sync**, create a free Firebase project (~5 minutes) and paste its
config into `index.html`. Nothing here costs money at personal scale.

## 1. Create the project

1. Go to <https://console.firebase.google.com> → **Add project**. Name it
   (e.g. `osmosis`). You can disable Google Analytics.

## 2. Turn on Google sign-in

1. Left menu → **Build → Authentication → Get started**.
2. **Sign-in method** tab → **Google** → enable → pick a support email → **Save**.

## 3. Create the database

1. Left menu → **Build → Firestore Database → Create database**.
2. Start in **Production mode** → choose a location → **Enable**.
3. Open the **Rules** tab, replace with the following, and **Publish**:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /osmosis/{uid} {
         allow read, write: if request.auth != null && request.auth.uid == uid;
       }
     }
   }
   ```

   (Each user can read/write only their own document — nobody else's.)

## 4. Get your web config

1. Gear icon → **Project settings → General**.
2. Under **Your apps**, click the **Web** icon (`</>`), register an app
   (any nickname, no Hosting needed).
3. Copy the `firebaseConfig` values.

## 5. Paste it into the app

In `index.html`, find `window.OSMOSIS_FIREBASE_CONFIG` (near the bottom) and
replace the placeholders:

```js
window.OSMOSIS_FIREBASE_CONFIG = {
  apiKey: "AIza…",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  appId: "1:12345…:web:abc…",
};
```

(These values are **not secret** — Firebase security is enforced by the rules
above, not by hiding the config.)

## 6. Authorize your domain

1. **Authentication → Settings → Authorized domains → Add domain**.
2. Add your site's domain (e.g. `yahyahussein711.github.io`).
   `localhost` is already allowed for local testing.

## 7. Commit & push

Redeploy (commit `index.html`). Open the app → **Settings → Account →
Sign in with Google**. Your library uploads on first sign-in and syncs
automatically after that.

---

### Notes
- **What syncs:** everything in local storage — notes, highlights, reflections,
  progress, honours, streaks, created stories, preferences. **Cover photos are
  NOT synced** (they live in IndexedDB and can be large).
- **Conflict model:** last-write-wins on a full snapshot. If you edit on two
  devices while offline, the device that syncs *last* wins. In normal
  one-device-at-a-time use this is seamless.
- **Installed PWA:** sign-in uses a redirect (popups are blocked in installed
  PWAs); you'll bounce to Google and back.
