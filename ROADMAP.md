# DumbTube roadmap (for AI coding agents)

Work that is planned but not done yet. Each item says what to build, where it goes and how to check it. Pick one item per change, and tick it off here (or delete it) in the same commit.

## Before you start

- Read `README.md` first. It covers what each switch does, the file layout and the permissions.
- The extension is plain Manifest V3 JavaScript with no bundler and no build step. Content scripts are classic scripts that share one global scope per frame. They talk to each other through `globalThis.DumbTubeSettings` (`src/shared/settings.js`) and `globalThis.DumbTube` (`src/youtube/core.js`).
- Read and write settings only through `DumbTubeSettings.load/save/onChanged`. A new setting goes in `DEFAULTS` in `src/shared/settings.js`. Add it to `SYNCED_KEYS` if it's a user choice, and leave it out if it's a counter or running state.
- A new YouTube feature gets its own file in `src/youtube/` that calls `DumbTube.register({ name, run, ... })`. List that file in `manifest.json` before `main.js`, and add its switch to `src/popup/popup.html` and to `SWITCHES` in `src/popup/popup.js`.
- Popup switches use `role="switch"` and `aria-describedby`, and must look right in both light and dark themes.
- Don't add permissions unless an item says to. If you do, explain the new permission in the README's Permissions table.

## How to check your work

```sh
npm ci
npx playwright install chromium   # first time only
npm run lint                      # ESLint, must be clean
npm test                          # fake YouTube pages, must be 0 failed
npm run test:live                 # real YouTube, run by hand when you touch ads or autoplay
```

GitHub Actions (`.github/workflows/checks.yml`) runs `npm run lint` and `npm test` on every push and pull request. Add a check to `tests/mock.test.mjs` for every behaviour you add. Fake pages are served with `ctx.route`; copy an existing section.

## To do

### 1. Make Google ad hiding cheaper on busy pages

- **Problem:** in `src/sites/google-ads.js`, every animation frame that has DOM changes runs `document.querySelectorAll(AD_SELECTOR)` over the whole page. It then filters for the outermost matches with a nested `.some()`, which is O(n²). On long news pages and infinite-scroll sites this runs constantly, in every frame (`all_frames: true`).
- **Do:**
  - Scan only the nodes added in the `MutationObserver` records, and `el.matches()` / `el.querySelectorAll()` inside them. `src/youtube/sponsored.js` already does this incremental scan; copy its approach, including the occasional full scan as a safety net.
  - Replace the O(n²) outermost filter with `el.parentElement.closest(AD_SELECTOR)`.
  - Skip frames that are too small to hold an ad before observing anything.
- **Done when:** the "Google ads" tests still pass, and a new test adds 1,000 non-ad nodes plus a few ads in batches. That test should confirm every ad is hidden and count each ad exactly once.

### 2. Open Shorts in the normal player

- **Goal:** a new switch, "Open Shorts as videos" (`redirectShorts`, default off, synced). It sends `youtube.com/shorts/<id>` to `youtube.com/watch?v=<id>`, so Shorts get the normal player without the endless swipe feed.
- **Do:**
  - Create `src/youtube/shorts-redirect.js`. Handle both the first page load and in-app navigation (`yt-navigate-finish`; YouTube is a single-page app).
  - Use `location.replace` so the Back button doesn't bounce the user straight back to the Short.
  - Don't run on YouTube Music (`onMusic` unset).
- **Done when:** fake-page tests cover a direct load of `/shorts/abc` and an in-app navigation to it, both ending on `/watch?v=abc`. A further test confirms nothing happens when the switch is off.

### 3. Un-hide recycled cards

- **Problem:** YouTube reuses card elements when lists update, for example when you switch search filters or go Back. `hideElement` in `src/youtube/core.js` sets a `data-*` marker and `display: none`, and nothing removes them while the switch stays on. A card that held an ad or a Short and is later reused for a normal video stays hidden.
- **Do:**
  - In `sponsored.js` and `shorts.js`, when a run finds an element carrying the feature's marker that no longer matches (no Sponsored label or ad renderer, no `/shorts/` link), show it again.
  - Keep the work incremental: only look at changed roots, not every hidden element on each run.
- **Done when:** a fake-page test swaps a hidden ad card's contents for a normal video and confirms the card becomes visible. A second test swaps them back and confirms it hides again.

### 4. Chrome Web Store release

- **Goal:** a repeatable release, not a manual zip.
- **Do:**
  - Add `npm run package`, a small Node script with no new dependencies. It zips `manifest.json`, `icons/` and `src/` into `dumbtube-<version>.zip`, and fails if the git tree is dirty.
  - Add `PRIVACY.md`. It must say that no data leaves the browser, and that storage holds only settings, counters and watch time.
  - Add a `release.yml` workflow that runs on a `v*` tag. It runs lint and tests, checks that the tag matches `manifest.json`'s version, builds the zip and attaches it to a GitHub release.
  - Store listing text and screenshots go in `store/`.
- **Done when:** pushing tag `v1.4.0` produces a release with the zip, and the zip loads with **Load unpacked** after being extracted. Uploading to the Chrome Web Store is done by hand by the owner; don't automate it, because it needs their developer account.
