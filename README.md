# Hollowmere

An idle skilling RPG with RuneScape-style mechanics. Single HTML file, served as
an installable PWA from GitHub Pages. Everything here runs from a phone — no PC
needed at any step.

**Live at:** https://whis-key.github.io/hollowmere/

---

## Files

| File | What it is |
| --- | --- |
| `index.html` | The entire game — logic, styles, and save system in one file |
| `manifest.webmanifest` | PWA metadata: name, icons, colours, standalone display |
| `sw.js` | Service worker. Network-first for the page, cache-first for icons |
| `icon-192.png` | Home screen icon |
| `icon-512.png` | Splash / high-DPI icon |
| `icon-maskable-512.png` | Adaptive icon with a safe zone for round launchers |

---

## Installing it as an app

The repo must be **public** — GitHub Pages does not serve private repos on a
free account.

1. **Settings → Pages.** Source: *Deploy from a branch*. Branch `main`, folder
   `/ (root)`. Save.
2. **Wait for the build.** The Actions tab shows a *pages build and deployment*
   job. It takes 30–90 seconds. Green check means live.
3. **Check the manifest loads.** Visit
   `https://whis-key.github.io/hollowmere/manifest.webmanifest` directly. You
   should see JSON, not a 404 page. If it 404s, nothing below will work.
4. **Open the game** at https://whis-key.github.io/hollowmere/ in Chrome and let
   it fully load once, so the service worker has time to register.
5. **⋮ menu → Install app** (older Chrome calls it *Add to Home screen*).
   Confirm.
6. **Launch from the home screen icon.** You should get the dark background, no
   address bar, locked to portrait. If the address bar is still showing, it
   installed as a plain bookmark — that means the manifest isn't being read.

### If the install prompt never appears

Almost always one of these:

- `<link rel="manifest">` in `index.html` points at a filename that isn't in the
  repo. The name must match exactly, `manifest.webmanifest` included.
- `sw.js` has a syntax error, so registration fails silently. Check it parses
  before committing.
- Paths in the manifest are absolute (`/icon-192.png`) instead of relative
  (`./icon-192.png`). The site is served from `/hollowmere/`, not the domain
  root, so absolute paths resolve to the wrong place.

---

## Updating the game

The updater compares `APP_VERSION` inside the deployed `index.html` against the
copy running on your phone. **Bump it or nothing happens.**

```js
const APP_VERSION='5.1';   // near the top of the <script> block
```

1. Edit `index.html` — game changes **and** the version bump, in one commit.
2. Wait for the green check in the Actions tab. Checking sooner just reports
   "up to date" because Pages hasn't rebuilt yet.
3. In the app: **Town → App version → Check**, then **Update**.

One tap saves your progress, clears the caches, and reloads onto the new build.
The game also checks quietly a few seconds after launch and shows a notice if
something newer is waiting.

Any different version string works — `5.2`, `5.1.1`, `6.0`. The comparison is
string inequality, not ordering.

`sw.js` does **not** need editing on each release. The page is served
network-first, so a fresh commit is picked up on the next launch regardless.

---

## Where saves live

Saves are in the browser's `localStorage` for this origin, not in the cached
files. Three slots, plus a legacy single-slot format that migrates on load.

- **Updating never touches saves.**
- **Uninstalling the app or clearing Chrome's site data erases them.**

Back up first: **Town → Back up your save → Copy**, and paste it into **Restore**
to bring it back or move it to another device.

Saves made inside a Claude artifact live in separate storage and will not appear
in the installed app. Export and restore to carry one across.
