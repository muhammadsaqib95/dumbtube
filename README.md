# DumbTube

[![Checks](https://github.com/muhammadsaqib95/hide-youtube-shorts/actions/workflows/checks.yml/badge.svg)](https://github.com/muhammadsaqib95/hide-youtube-shorts/actions/workflows/checks.yml)

**Search, watch, skip the rest.** A Chrome extension that strips YouTube back to search and the video you chose. It hides Shorts, feeds, sponsored cards and video ads, and Google display ads on other sites.

## What each switch does

| Switch | Default | What it does |
|---|---|---|
| **Dumb YouTube** | Off | Hides the home feed, subscriptions feed and "Up next" suggestions. |
| **Hide Shorts** | On | Hides Shorts shelves, Shorts in feeds and search, and the Shorts tab. |
| **Hide Playables** | On | Hides the YouTube Playables game shelf. |
| **Hide sponsored cards** | On | Hides ads in the feed, search results and sidebar. |
| **Skip video ads** | Off | Mutes and hides ads in the player and plays them through at 16× speed, so a 30-second ad is over in about 2 seconds. (Jumping straight to the end makes YouTube show its "Ad blockers are not allowed" warning.) |
| **Block autoplay** | Off | Turns off YouTube's Autoplay and cancels the "Up next" countdown. Turning this switch off restores Autoplay if the extension was the one that turned it off. |
| **Hide comments** | Off | Hides comments under videos and on Shorts. |
| **Hide the sidebar** | Off | Hides the left-hand menu, leaving search as the way around. |
| **Open on search** | Off | Puts the cursor in the search box on the home page. |
| **Focus timer** | Off | Pauses playback after the chosen number of minutes (5–180). |
| **Daily limit** | Off | Pauses YouTube once you've watched the chosen number of minutes today (5–600), counted across all tabs. Ads and hover previews don't count. "Keep watching today" lifts it until midnight. |
| **Hide Google ads** | On | Hides AdSense and Google Ad Manager ads on other websites. |
| **On *this site*** | On | Shown for the site in the current tab. Turn it off to leave Google ads alone on that site, for example when hiding them breaks its layout. |
| **Pause hiding** | — | Shows everything again for 10 minutes. |

The popup also shows how many ads were skipped (in total, today, and split into sponsored cards, video ads and Google ads) and how long you've watched YouTube today. The total also appears on the toolbar icon, which shows **II** while hiding is paused. The popup follows your system's light or dark theme.

### Keyboard shortcuts

| Shortcut | Action |
|---|---|
| <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> (<kbd>⌥⇧P</kbd> on Mac) | Pause hiding for 10 minutes, or resume |
| <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>F</kbd> (<kbd>⌥⇧F</kbd> on Mac) | Start or stop the focus timer |

Change them at `chrome://extensions/shortcuts`, or with **Change** at the bottom of the popup.

### Sync

Switches, minutes and the list of sites where ads are allowed sync to every computer signed in to Chrome. Counters, watch time and running timers stay on each computer. The first time 1.4.0 runs, it copies your existing settings into sync, unless another computer already synced its own.

On **YouTube Music**, only *Skip video ads* runs. The other switches are for regular YouTube's page layout. YouTube Studio is left alone.

### Known limit: the end-of-break card

After a run of video ads, YouTube sometimes shows a still card with a picture and buttons like "Shop now" and "Skip". It counts down about 7 seconds. YouTube only accepts a real mouse click on its Skip button, so the extension can't skip the card. It hides the card and leaves the **Skip** button visible: click it to continue straight away, or wait out the timer.

## Install (unpacked)

1. Open `chrome://extensions` and switch on **Developer mode**.
2. Click **Load unpacked** and choose this folder (the one with `manifest.json`).
3. After pulling changes, click the reload icon on the extension's card, then refresh any open YouTube tabs.

## Project layout

```
manifest.json
icons/                 toolbar and store icons
src/
  background.js        counters, watch time, badge, shortcuts, moving settings to sync
  shared/settings.js   every setting, its default, and whether it syncs (used everywhere)
  popup/               the toolbar popup
  youtube/             runs on www.youtube.com and music.youtube.com
    core.js            shared helpers and the feature registry
    sponsored.js       Hide sponsored cards
    shorts.js          Hide Shorts
    playables.js       Hide Playables
    page-layout.js     Dumb YouTube, comments, sidebar, Open on search
    focus-timer.js     Focus timer
    daily-limit.js     Daily limit
    video-ads.js       Skip video ads
    autoplay.js        Block autoplay
    main.js            loads settings and runs the features (loaded last)
    youtube.css        CSS for the switches above
  sites/               runs on every other website
    google-ads.js      Hide Google ads
    google-ads.css
tests/                 browser tests (not part of the extension)
package.json           dev tooling only: lint and tests
eslint.config.js
.github/workflows/     checks run on every push and pull request
ROADMAP.md             planned work, written for AI coding agents
```

Always read and write settings through `DumbTubeSettings.load/save/onChanged`, which put each key in the right storage area.

Each YouTube feature registers itself with `DumbTube.register({ run, ... })` in `core.js`. `main.js` re-runs every feature when a setting or the page changes. To add a feature, add its setting to `src/shared/settings.js`, create a file in `src/youtube/`, list it in `manifest.json` before `main.js`, and add its switch to the popup.

### Permissions

| Permission | Why |
|---|---|
| `storage` | Saving settings and counters |
| `alarms` | Updating the toolbar icon when a pause ends |
| `activeTab` | Reading the current tab's address when you open the popup, for the per-site Google ads switch |

Nothing is sent anywhere: all data stays in Chrome's own storage.

## Tests and lint

The tests load the extension into Chromium with Playwright. Run everything from the repo root:

```sh
npm ci
npx playwright install chromium   # first time only
npm run lint                      # ESLint
npm test                          # fake YouTube pages: fast, no network
npm run test:live                 # real YouTube: slower, needs internet
```

`npm test` checks every switch against fake pages, so its results are the same every run. `npm run test:live` checks search ads, autoplay and ad skipping on real YouTube. It skips a check when YouTube serves no ads during the run. Run both after YouTube changes its layout.

GitHub Actions runs `npm run lint` and `npm test` on every push to `main` and on every pull request. The live tests aren't part of it, because they depend on YouTube serving ads.

Branded Google Chrome no longer loads unpacked extensions from the command line, so the tests use Playwright's Chromium. Set `CHROME_PATH` to use a different Chromium build.

## Publishing

Zip the extension without the tests:

```sh
zip -r dumbtube.zip manifest.json icons src
```
