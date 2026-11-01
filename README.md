# DumbTube

**Search, watch, skip the rest.** A Chrome extension that strips YouTube back to search and the video you chose. It hides Shorts, feeds, sponsored cards and video ads, and Google display ads on other sites.

## What each switch does

| Switch | Default | What it does |
|---|---|---|
| **Dumb YouTube** | Off | Hides the home feed, subscriptions feed and "Up next" suggestions. |
| **Hide Shorts** | On | Hides Shorts shelves, Shorts in feeds and search, and the Shorts tab. |
| **Hide Playables** | On | Hides the YouTube Playables game shelf. |
| **Hide sponsored cards** | On | Hides ads in the feed, search results and sidebar. |
| **Skip video ads** | Off | Mutes and skips ads in the player, and hides them while they're skipped. |
| **Block autoplay** | Off | Turns off YouTube's Autoplay and cancels the "Up next" countdown. Turning this switch off restores Autoplay if the extension was the one that turned it off. |
| **Hide comments** | Off | Hides comments under videos and on Shorts. |
| **Hide the sidebar** | Off | Hides the left-hand menu, leaving search as the way around. |
| **Open on search** | Off | Puts the cursor in the search box on the home page. |
| **Focus timer** | Off | Pauses playback after the chosen number of minutes (5–180). |
| **Hide Google ads** | On | Hides AdSense and Google Ad Manager ads on other websites. |
| **Pause hiding** | — | Shows everything again for 10 minutes. |

The popup also shows how many ads were skipped in total and today. The total also appears on the toolbar icon.

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
  background.js        ad counters and the toolbar badge
  shared/settings.js   every setting and its default (used everywhere)
  popup/               the toolbar popup
  youtube/             runs on www.youtube.com and music.youtube.com
    core.js            shared helpers and the feature registry
    sponsored.js       Hide sponsored cards
    shorts.js          Hide Shorts
    playables.js       Hide Playables
    page-layout.js     Dumb YouTube, comments, sidebar, Open on search
    focus-timer.js     Focus timer
    video-ads.js       Skip video ads
    autoplay.js        Block autoplay
    main.js            loads settings and runs the features (loaded last)
    youtube.css        CSS for the switches above
  sites/               runs on every other website
    google-ads.js      Hide Google ads
    google-ads.css
tests/                 browser tests (not part of the extension)
```

Each YouTube feature registers itself with `DumbTube.register({ run, ... })` in `core.js`. `main.js` re-runs every feature when a setting or the page changes. To add a feature, add its setting to `src/shared/settings.js`, create a file in `src/youtube/`, list it in `manifest.json` before `main.js`, and add its switch to the popup.

## Tests

The tests load the extension into Chromium with Playwright.

```sh
cd tests
npm install
npx playwright install chromium   # first time only
npm test                          # fake YouTube pages: fast, no network
npm run test:live                 # real YouTube: slower, needs internet
```

`npm test` checks every switch against fake pages, so its results are the same every run. `npm run test:live` checks search ads, autoplay and ad skipping on real YouTube. It skips a check when YouTube serves no ads during the run. Run both after YouTube changes its layout.

Branded Google Chrome no longer loads unpacked extensions from the command line, so the tests use Playwright's Chromium. Set `CHROME_PATH` to use a different Chromium build.

## Publishing

Zip the extension without the tests:

```sh
zip -r dumbtube.zip manifest.json icons src
```
