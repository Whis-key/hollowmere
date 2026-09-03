# Hollowmere — installing it as an app

Everything here runs from a phone. No PC needed at any step.

## What's in this folder

| File | Why it's here |
|---|---|
| `index.html` | The whole game. One file. |
| `manifest.webmanifest` | Tells Android it's an app: name, icon, portrait, fullscreen. |
| `sw.js` | Service worker. Caches everything so it runs with no signal. |
| `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` | Home-screen icons. |

## Step 1 — Put it online

A service worker only runs over HTTPS, so the game has to be hosted. GitHub Pages
is free and works from a mobile browser.

1. github.com → **New repository** → name it `hollowmere` → **Public** → Create.
2. **Add file → Upload files**. Upload all six files from this folder. Commit.
3. **Settings → Pages** → Source: *Deploy from a branch* → Branch `main`, folder `/ (root)` → Save.
4. Wait a minute or two. Your URL will be:
   `https://<your-username>.github.io/hollowmere/`

## Step 2 — Install it

Open that URL in Chrome on your phone, then **⋮ → Add to Home screen** (it may say
*Install app*).

Android builds a real app from this — its own icon, its own entry in the app
switcher, no browser bar, and it works in airplane mode. For everyday use this is
the finished product; you do not need an APK.

## Step 3 — Only if you specifically want an APK file

Go to **pwabuilder.com**, paste your URL, and hit Package. Choose Android, then
download the signed APK/AAB it builds. All in the browser.

Sideloading needs *Install unknown apps* enabled for whichever app opens the file.

## Updating the game later

You only ever upload **one file**: `index.html`.

1. In the repo: **Add file → Upload files**, upload the new `index.html`, commit.
2. On your phone, open the game → **Town → App version → Check → Update**.

That's it. `sw.js` no longer needs editing — the page is served network-first, so
a new upload is picked up automatically on the next launch anyway. The Update
button just means you don't have to wait or guess.

The game also checks quietly a few seconds after launch and shows a notice if
there's a newer version waiting.

## Where saves live

- **Inside Claude** — Claude's artifact storage.
- **Installed as a PWA or opened in a browser** — that browser's local storage.

These are separate places. A save made in Claude will not appear in the installed
app. To move one across, use **Town → Back up your save → Copy**, then paste it
into **Restore** on the other one.

Updating never touches your saves. Uninstalling the app or clearing Chrome's site
data does erase them, so export a copy first.
