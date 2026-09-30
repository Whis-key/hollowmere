# Hollowmere

An idle skilling RPG with RuneScape-style mechanics. The game is a small HTML
page and three scripts served from GitHub Pages; an Android app wraps it in a WebView so saves
live in app-private storage. Everything here is built and released from a phone.

**Site:** https://whis-key.github.io/hollowmere/
**App:** https://github.com/Whis-key/hollowmere/releases/tag/android-latest

---

## How the pieces fit

The APK does **not** contain the game. It loads the site above at runtime.
That means every web file in this repo is live. `ROADMAP.md`, `LOOT.md` and
`loot-sheet.js` are reference only.

| File | Why it must stay |
| --- | --- |
| `index.html` | Page, styles, `APP_VERSION`, and the loader for the three scripts |
| `data.js` | Items, gear, skills, monsters, bosses, dungeons, loot tables, quests |
| `engine.js` | Game logic, saves, offline catch-up, the updater |
| `views.js` | Rendering, input, the main loop |
| `sw.js` | Service worker. Registering it is what makes the in-app update panel appear at all |
| `manifest.webmanifest` | Listed in the service worker's `addAll`, which is atomic — one missing file and nothing caches |
| `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` | Same `addAll` list, plus the apple-touch-icon |
| `android/` | The native shell and its build config |

Deleting any web file breaks the app, not just the browser version.

---

## Updating the game

This is the normal path and needs no rebuild.

1. Edit whichever script holds the change, **and** bump `APP_VERSION` in
   `index.html`, in one commit. The bump does two jobs: the updater compares
   that string against the running copy, and the loader puts it in each
   script's URL. The service worker serves scripts cache-first, so without a
   bump phones keep running the old scripts even after updating.
2. Wait for the green check in the Actions tab. Checking sooner reports "up to
   date" because Pages has not rebuilt yet.
3. In the app: **Town → App version → Check → Update.**

One tap saves progress, clears caches, and reloads onto the new build. Any
different version string works — the comparison is inequality, not ordering.

## Updating the Android shell

Only needed when something in `android/` changes — the WebView config, the
manifest, the icon. Commit it and the workflow builds a signed APK and replaces
the `android-latest` release. Install it over the existing app.

---

## Signing

Builds are signed with a persistent key so each APK installs over the last and
keeps its data. The key lives in `android/keystore.jks.enc`, encrypted with the
`KEYSTORE_PASSWORD` repository secret.

**If that passphrase is lost, no future build can update an installed app.**
The only way forward would be uninstalling, which erases saves. Keep a copy of
it somewhere outside GitHub.

The decrypted `keystore.jks` is gitignored and must never be committed.

---

## Where saves live

In the app's private storage, keyed to the package `io.github.whiskey.hollowmere`.
Three slots. Clearing Chrome's data does not touch them; uninstalling does.

Browser and app storage are separate boxes. To move a save between them, use
**Town → Back up your save → Copy** and paste into **Restore** on the other.

Back up before uninstalling anything.
