// Fast, repeatable tests against fake YouTube pages. No network needed.
import { launch, check, section, finish, wait, fulfillWav } from "./helpers.mjs";

const PLAYER_PAGE = `<!doctype html><html><body>
<div id="inline-preview" class="html5-video-player" style="display:none"><video src="/preview.wav"></video></div>
<div id="movie_player" class="html5-video-player ad-showing">
  <video preload="auto" src="/ad1.wav"></video>
  <div class="video-ads ytp-ad-module">
    <div class="ad-card">Shop now</div>
    <button class="ytp-skip-ad-button"><div class="ytp-skip-ad-button__text">Skip</div></button>
  </div>
  <button class="ytp-button" onclick="const t = this.firstElementChild; t.setAttribute('aria-checked', t.getAttribute('aria-checked') === 'true' ? 'false' : 'true')">
    <div class="ytp-autonav-toggle-button" aria-checked="true"></div>
  </button>
  <button class="ytp-autonav-endscreen-upnext-cancel-button" onclick="document.body.dataset.cancelled = '1'">Cancel</button>
  <div class="ytp-ad-overlay-container">overlay ad</div>
</div></body></html>`;

const SEARCH_PAGE = `<!doctype html><html><body>
<ytd-search><ytd-item-section-renderer><div id="contents">
  <ytd-video-renderer id="normal1"><div>Normal video mentioning sponsored content</div></ytd-video-renderer>
  <ytd-ad-slot-renderer id="slotAd"><div>Sponsored</div></ytd-ad-slot-renderer>
  <ytd-new-ad-wrapper id="badgeAd"><div><feed-ad-metadata-view-model><ad-badge-view-model><badge-shape><div>Sponsored</div></badge-shape></ad-badge-view-model></feed-ad-metadata-view-model></div></ytd-new-ad-wrapper>
  <ytd-other-ad-wrapper id="textAd"><div><div><span>Sponsored</span> · TikTok</div></div></ytd-other-ad-wrapper>
  <ytd-video-renderer id="normal2"><div>Another normal video</div></ytd-video-renderer>
</div></ytd-item-section-renderer></ytd-search></body></html>`;

const MUSIC_PAGE = `<!doctype html><html><body><ytmusic-app>
<div id="movie_player" class="html5-video-player ad-showing"><video preload="auto" src="/music-ad.wav"></video></div>
</ytmusic-app></body></html>`;

const FEED_PAGE = `<!doctype html><html><body><ytd-app>
<ytd-rich-grid-renderer><div id="contents">
  <ytd-rich-item-renderer id="shortCard"><a id="thumbnail" href="/shorts/abc">short</a></ytd-rich-item-renderer>
  <ytd-rich-item-renderer id="videoCard"><a id="thumbnail" href="/watch?v=abc">video</a></ytd-rich-item-renderer>
  <ytd-reel-shelf-renderer id="shortsShelf">shelf</ytd-reel-shelf-renderer>
  <ytd-rich-section-renderer><ytd-rich-shelf-renderer id="playablesShelf"><h2>YouTube Playables</h2><a href="/playables/x">game</a></ytd-rich-shelf-renderer></ytd-rich-section-renderer>
</div></ytd-rich-grid-renderer>
<div id="comments">comments</div>
<ytd-guide-renderer id="guide">sidebar</ytd-guide-renderer>
<video id="v" src="/clip.wav" preload="auto"></video>
</ytd-app></body></html>`;

const PLAIN_WATCH_PAGE = `<!doctype html><html><body>
<div id="movie_player" class="html5-video-player"><video preload="auto" src="/long.wav"></video></div>
</body></html>`;

const NEWS_PAGE = `<!doctype html><html><body><p>article</p>
<ins class="adsbygoogle" id="adsense">ad</ins>
<div id="div-gpt-ad-123"><iframe id="google_ads_iframe_1"></iframe></div>
</body></html>`;

async function serveFakes(ctx) {
  await ctx.route(/^https:\/\/(www|music|studio)\.youtube\.com\/.*/, (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith(".wav")) return fulfillWav(route, url.pathname === "/long.wav" ? 600 : 30);
    if (url.hostname === "music.youtube.com") return route.fulfill({ contentType: "text/html", body: MUSIC_PAGE });
    if (url.hostname === "studio.youtube.com") return route.fulfill({ contentType: "text/html", body: "<!doctype html><body>studio</body>" });
    if (url.searchParams.get("v") === "plain") return route.fulfill({ contentType: "text/html", body: PLAIN_WATCH_PAGE });
    if (url.pathname === "/results") return route.fulfill({ contentType: "text/html", body: SEARCH_PAGE });
    if (url.pathname === "/" || url.pathname.startsWith("/feed")) return route.fulfill({ contentType: "text/html", body: FEED_PAGE });
    return route.fulfill({ contentType: "text/html", body: PLAYER_PAGE });
  });
  await ctx.route("https://news.example.com/**", (route) =>
    route.fulfill({ contentType: "text/html", body: NEWS_PAGE })
  );
}

const visible = (page, selector) =>
  page.evaluate((s) => {
    const el = document.querySelector(s);
    return Boolean(el && el.getClientRects().length && getComputedStyle(el).visibility !== "hidden");
  }, selector);

const video = (page) =>
  page.evaluate(() => {
    const v = document.querySelector("#movie_player video");
    return { muted: v.muted, t: v.currentTime, d: v.duration };
  });

const setAd = (page, on, src) =>
  page.evaluate(([on, src]) => {
    document.querySelector("#movie_player").classList.toggle("ad-showing", on);
    document.querySelector("#movie_player video").src = src;
  }, [on, src]);

const autonav = (page) =>
  page.evaluate(() => document.querySelector(".ytp-autonav-toggle-button").getAttribute("aria-checked"));

// ---------------------------------------------------------------------------
section("Skip video ads, block autoplay, pause");
{
  const { ctx, store, read } = await launch({
    settings: { skipVideoAds: true, blockAutoplay: true, skippedAds: 0, pauseEndsAt: 0 },
  });
  await serveFakes(ctx);
  const page = await ctx.newPage();
  await page.goto("https://www.youtube.com/watch?v=mock");
  await wait(1500);

  let v = await video(page);
  check("ad is muted", v.muted);
  check("ad jumped to its end", v.t > v.d - 1, `t=${v.t.toFixed(1)} of ${v.d}`);
  check("ad picture is hidden", !(await visible(page, "#movie_player video")));
  check("banner over the video is hidden", !(await visible(page, ".ytp-ad-overlay-container")));
  check("end-of-break card is hidden", !(await visible(page, ".ad-card")));
  check("its Skip button stays visible", await visible(page, ".ytp-skip-ad-button"));
  const counts = await read({ skippedAds: 0, skippedToday: null });
  check("ad counted once", counts.skippedAds === 1, `total=${counts.skippedAds}`);
  check("ad counted for today", counts.skippedToday?.count === 1, JSON.stringify(counts.skippedToday));
  check("YouTube's Autoplay switched off", (await autonav(page)) === "false");
  check("Up next countdown cancelled", await page.evaluate(() => document.body.dataset.cancelled === "1"));

  await setAd(page, false, "/content.wav");
  await wait(1000);
  v = await video(page);
  check("sound comes back after the ad", !v.muted);
  check("main video is not moved", v.t < 1, `t=${v.t.toFixed(1)}`);

  await setAd(page, true, "/ad2.wav");
  await wait(1500);
  check("second ad counted", (await read({ skippedAds: 0 })).skippedAds === 2);
  check("counted as video ads", (await read({ skippedByKind: null })).skippedByKind?.video === 2);

  await setAd(page, false, "/content2.wav");
  await wait(700);
  await page.evaluate(() => (document.querySelector("#movie_player video").muted = true));
  await setAd(page, true, "/ad3.wav");
  await wait(1200);
  await setAd(page, false, "/content3.wav");
  await wait(800);
  check("a video you muted stays muted after the ad", (await video(page)).muted);

  await page.evaluate(() => (document.querySelector("#movie_player video").muted = false));
  await store({ pauseEndsAt: Date.now() + 60000 });
  await wait(500);
  await setAd(page, true, "/ad4.wav");
  await wait(1500);
  v = await video(page);
  check("Pause hiding: ad plays normally", v.t < 1 && !v.muted, `t=${v.t.toFixed(1)} muted=${v.muted}`);
  check("Pause hiding: banner shows", await visible(page, ".ytp-ad-overlay-container"));

  // Turning Block autoplay off puts YouTube's Autoplay back on.
  await store({ pauseEndsAt: 0, skipVideoAds: false, blockAutoplay: false });
  await wait(2500);
  check("Autoplay restored when the switch is turned off", (await autonav(page)) === "true");
  check("restore is remembered as done", (await read({ restoreAutoplay: null })).restoreAutoplay === false);

  await page.evaluate(() => (document.querySelector("#movie_player video").src = "/ad5.wav"));
  await wait(1500);
  v = await video(page);
  check("switched off: ad not skipped", v.t < 1 && !v.muted);

  // If Autoplay was already off, turning the switch on and off leaves it off.
  await page.evaluate(() => document.querySelector(".ytp-autonav-toggle-button").setAttribute("aria-checked", "false"));
  await store({ blockAutoplay: true });
  await wait(800);
  await store({ blockAutoplay: false });
  await wait(2500);
  check("Autoplay you had off stays off", (await autonav(page)) === "false");
  await ctx.close();
}

// ---------------------------------------------------------------------------
section("Sponsored cards in search");
{
  const { ctx } = await launch({ settings: { hideSponsored: true } });
  await serveFakes(ctx);
  const page = await ctx.newPage();
  await page.goto("https://www.youtube.com/results?search_query=mock");
  await wait(1500);
  for (const [id, want] of [["slotAd", false], ["badgeAd", false], ["textAd", false], ["normal1", true], ["normal2", true]]) {
    check(`${id} ${want ? "visible" : "hidden"}`, (await visible(page, `#${id}`)) === want);
  }

  // Cards that arrive later (scrolling) are caught by the changed-parts scan.
  await page.evaluate(() => {
    const ad = document.createElement("ytd-late-ad");
    ad.id = "lateAd";
    ad.innerHTML = "<div><span>Sponsored</span> · Late</div>";
    document.querySelector("#contents").append(ad);
    const label = document.createElement("span");
    label.textContent = "Sponsored";
    document.querySelector("#normal2 div").append(label);
  });
  await wait(800);
  check("ad added after load is hidden", !(await visible(page, "#lateAd")));
  check("card that gains a Sponsored label is hidden", !(await visible(page, "#normal2")));
  check("other results stay visible", await visible(page, "#normal1"));
  await ctx.close();
}

// ---------------------------------------------------------------------------
section("YouTube Music and other YouTube sites");
{
  const { ctx } = await launch({
    settings: { skipVideoAds: true, dumbYoutube: true, hideShorts: true, hideSidebar: true, openSearch: true },
  });
  await serveFakes(ctx);
  const page = await ctx.newPage();
  await page.goto("https://music.youtube.com/");
  await wait(1500);
  const music = await page.evaluate(() => ({
    classes: document.documentElement.className,
    note: Boolean(document.getElementById("dumb-yt-note")),
  }));
  check("Music: YouTube page features stay off", !/dumb-youtube|hide-shorts|hide-sidebar/.test(music.classes), music.classes);
  check("Music: no 'Search for a topic' message", !music.note);
  const v = await video(page);
  check("Music: video ads are still skipped", v.t > v.d - 1 && v.muted, `t=${v.t.toFixed(1)} of ${v.d}`);

  await page.goto("https://studio.youtube.com/");
  await wait(800);
  const studio = await page.evaluate(() => document.documentElement.className);
  check("YouTube Studio is left alone", !/hide-shorts|dumb-youtube/.test(studio), studio);
  await ctx.close();
}

// ---------------------------------------------------------------------------
section("YouTube page switches");
{
  const { ctx, store } = await launch({
    settings: { hideShorts: true, hidePlayables: true, dumbYoutube: true, hideComments: true, hideSidebar: true },
  });
  await serveFakes(ctx);
  const page = await ctx.newPage();
  await page.goto("https://www.youtube.com/");
  await wait(1200);
  check("Shorts video in the feed is hidden", !(await visible(page, "#shortCard")));
  check("Shorts shelf is hidden", !(await visible(page, "#shortsShelf")));
  check("Playables shelf is hidden", !(await visible(page, "#playablesShelf")));
  check("comments are hidden", !(await visible(page, "#comments")));
  check("sidebar is hidden", !(await visible(page, "#guide")));
  check("Dumb YouTube: feed message shown", await visible(page, "#dumb-yt-note"));
  check("ordinary video card stays", await visible(page, "#videoCard"));

  await store({ pauseEndsAt: Date.now() + 60000 });
  await wait(600);
  check("Pause hiding brings Shorts back", await visible(page, "#shortCard"));
  check("Pause hiding brings comments back", await visible(page, "#comments"));
  await store({ pauseEndsAt: 0, hideShorts: false });
  await wait(600);
  check("Shorts switch off shows Shorts", await visible(page, "#shortCard"));
  check("other switches still apply", !(await visible(page, "#comments")));

  await page.evaluate(() => document.getElementById("v").play().catch(() => {}));
  await store({ focusTimer: true, focusEndsAt: Date.now() + 500 });
  await wait(1500);
  const focus = await page.evaluate(() => ({ paused: document.getElementById("v").paused, note: Boolean(document.getElementById("focus-timer-note")) }));
  check("focus timer pauses the video when time is up", focus.paused && focus.note);
  await store({ focusTimer: false, focusEndsAt: 0 });
  await wait(400);
  check("turning the focus timer off removes its message", !(await page.evaluate(() => document.getElementById("focus-timer-note"))));
  await ctx.close();
}

// ---------------------------------------------------------------------------
section("Google ads on other sites");
{
  const { ctx, store, read } = await launch({ settings: { hideGoogleAds: true, skippedAds: 0 } });
  await serveFakes(ctx);
  const page = await ctx.newPage();
  await page.goto("https://news.example.com/article");
  await wait(1000);
  check("AdSense slot hidden", !(await visible(page, "#adsense")));
  check("Ad Manager slot hidden", !(await visible(page, "#div-gpt-ad-123")));
  check("page content stays", await visible(page, "p"));
  const { skippedAds } = await read({ skippedAds: 0 });
  check("each ad counted once", skippedAds === 2, `count=${skippedAds}`);
  check("counted as Google ads", (await read({ skippedByKind: null })).skippedByKind?.google === 2);
  await store({ hideGoogleAds: false });
  await wait(500);
  check("switch off shows the ads", await visible(page, "#adsense"));
  await ctx.close();
}

// ---------------------------------------------------------------------------
section("Google ads: sites where ads are allowed");
{
  const { ctx, extensionId, store, read } = await launch({ settings: { hideGoogleAds: true, googleAdsAllowlist: ["example.com"] } });
  await serveFakes(ctx);
  const page = await ctx.newPage();
  await page.goto("https://news.example.com/article");
  await wait(1000);
  check("ads left alone on an allowed site (and its subdomains)", await visible(page, "#adsense"));

  const popup = await ctx.newPage();
  await popup.goto(`chrome-extension://${extensionId}/src/popup/popup.html?site=news.example.com`);
  await wait(500);
  check("popup shows a row for this site", await popup.isVisible("#site-row"));
  check("row says ads are not hidden here", !(await popup.isChecked("#site-ads")));
  await popup.click("#site-row");
  await wait(500);
  check("switching it on removes the site from the list", (await read({ googleAdsAllowlist: null })).googleAdsAllowlist.length === 0);
  check("ads hidden again on the page", !(await visible(page, "#adsense")));
  await popup.click("#site-row");
  await wait(300);
  const list = (await read({ googleAdsAllowlist: null })).googleAdsAllowlist;
  check("switching it off adds the site", list.includes("news.example.com"), JSON.stringify(list));

  await popup.goto(`chrome-extension://${extensionId}/src/popup/popup.html?site=www.youtube.com`);
  await wait(400);
  check("no site row on YouTube", !(await popup.isVisible("#site-row")));
  await store({ googleAdsAllowlist: [] });
  await ctx.close();
}

// ---------------------------------------------------------------------------
section("Daily limit");
{
  const { ctx, sw, store, read } = await launch({ settings: { dailyLimit: true, dailyLimitMinutes: 5 } });
  await serveFakes(ctx);
  const today = await sw.evaluate(() => DumbTubeSettings.localDay());
  const page = await ctx.newPage();
  await page.goto("https://www.youtube.com/watch?v=plain");
  await page.evaluate(() => document.querySelector("#movie_player video").play());
  await wait(12000);
  const watched = (await read({ watchedToday: null })).watchedToday;
  check("watch time is counted while a video plays", watched?.day === today && watched.seconds >= 5, JSON.stringify(watched));
  const paused = () => page.evaluate(() => document.querySelector("#movie_player video").paused);
  check("under the limit: video keeps playing", !(await paused()));

  await store({ watchedToday: { day: today, seconds: 301, lastTick: Date.now() } });
  await wait(800);
  check("over the limit: video paused", await paused());
  check("over the limit: message shown", await visible(page, "#daily-limit-note"));
  await page.evaluate(() => document.querySelector("#movie_player video").play());
  await wait(500);
  check("pressing play again is paused again", await paused());

  await page.click("#daily-limit-note button");
  await wait(600);
  check("'Keep watching today' removes the message", !(await visible(page, "#daily-limit-note")));
  check("'Keep watching today' is remembered for today", (await read({ dailyLimitSnoozed: "" })).dailyLimitSnoozed === today);
  await page.evaluate(() => document.querySelector("#movie_player video").play());
  await wait(800);
  check("video can play after choosing to keep watching", !(await paused()));

  // Two tabs playing at once count as one stretch of time, not double.
  const second = await ctx.newPage();
  await second.goto("https://www.youtube.com/watch?v=plain");
  await second.evaluate(() => document.querySelector("#movie_player video").play());
  const before = (await read({ watchedToday: null })).watchedToday.seconds;
  await wait(15000);
  const added = (await read({ watchedToday: null })).watchedToday.seconds - before;
  check("two tabs playing aren't counted twice", added >= 10 && added <= 20, `added ${added.toFixed(1)}s in 15s`);
  await ctx.close();
}

// ---------------------------------------------------------------------------
section("Keyboard shortcuts");
{
  const { ctx, sw, read, store } = await launch({ settings: { skippedAds: 12, focusMinutes: 30 } });
  const badge = () => sw.evaluate(() => chrome.action.getBadgeText({}));
  await sw.evaluate(() => togglePause());
  await wait(300);
  check("pause shortcut starts a 10-minute pause", (await read({ pauseEndsAt: 0 })).pauseEndsAt > Date.now() + 9 * 60000);
  check("icon shows II while paused", (await badge()) === "II");
  await sw.evaluate(() => togglePause());
  await wait(300);
  check("pressing it again resumes", (await read({ pauseEndsAt: 0 })).pauseEndsAt === 0);
  check("icon shows the count again", (await badge()) === "12");

  await sw.evaluate(() => toggleFocusTimer());
  await wait(200);
  const focus = await read({ focusTimer: false, focusEndsAt: 0 });
  check("focus shortcut starts the timer with your minutes", focus.focusTimer && Math.abs(focus.focusEndsAt - Date.now() - 30 * 60000) < 5000);
  await sw.evaluate(() => toggleFocusTimer());
  await wait(200);
  check("pressing it again stops it", !(await read({ focusTimer: false })).focusTimer);

  const commands = await sw.evaluate(() => chrome.commands.getAll());
  check("both shortcuts are registered", ["toggle-pause", "toggle-focus-timer"].every((n) => commands.some((c) => c.name === n)));
  await store({ skippedAds: 0 });
  await ctx.close();
}

// ---------------------------------------------------------------------------
section("Settings sync");
{
  const { ctx, sw, store } = await launch();
  await store({ hideShorts: false, skipVideoAds: true, skippedAds: 5, pauseEndsAt: 123 });
  const areas = await sw.evaluate(async () => ({ sync: await chrome.storage.sync.get(null), local: await chrome.storage.local.get(null) }));
  check("switches are saved to Chrome sync", areas.sync.hideShorts === false && areas.sync.skipVideoAds === true);
  check("switches are not kept locally", !("hideShorts" in areas.local));
  check("counters and timers stay on this computer", areas.local.skippedAds === 5 && !("skippedAds" in areas.sync) && areas.local.pauseEndsAt === 123);

  // Settings saved by an older version (all local) move to sync once.
  const moved = await sw.evaluate(async () => {
    await chrome.storage.sync.clear();
    await chrome.storage.sync.set({ hideComments: true }); // already synced from another computer
    await chrome.storage.local.set({ movedToSync: false, hideSidebar: true, hideComments: false, skippedAds: 9 });
    await moveSettingsToSync();
    return { sync: await chrome.storage.sync.get(null), local: await chrome.storage.local.get(null) };
  });
  check("old settings are copied to sync", moved.sync.hideSidebar === true);
  check("settings already synced from another computer win", moved.sync.hideComments === true);
  check("old local copies are removed, counters kept", !("hideSidebar" in moved.local) && moved.local.skippedAds === 9);
  await ctx.close();
}

// ---------------------------------------------------------------------------
section("Popup");
{
  const { ctx, extensionId, store } = await launch();
  const today = await ctx.newPage().then(async (p) => {
    const d = await p.evaluate(() => {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    });
    await p.close();
    return d;
  });
  await store({
    skippedAds: 1234,
    skippedToday: { day: today, count: 7 },
    skippedByKind: { sponsored: 1000, video: 200, google: 34 },
    watchedToday: { day: today, seconds: 3900, lastTick: 0 },
    skipVideoAds: true,
    blockAutoplay: false,
  });
  const page = await ctx.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/popup/popup.html`);
  await wait(500);
  const ui = await page.evaluate(() => ({
    total: document.getElementById("count").textContent,
    today: document.getElementById("today").textContent,
    skip: document.getElementById("skip-video-ads").checked,
    autoplay: document.getElementById("block-autoplay").checked,
  }));
  check("total shown", ui.total === "1,234", ui.total);
  check("skipped today shown", ui.today === "7", ui.today);
  check("switches show saved settings", ui.skip && !ui.autoplay);
  check("counts by kind shown", (await page.textContent("#breakdown")) === "Sponsored 1,000 · Video 200 · Google 34", await page.textContent("#breakdown"));
  check("watch time shown", (await page.textContent("#watched-today")) === "1 h 5 min watched today", await page.textContent("#watched-today"));
  const shortcut = await page.textContent("#shortcut-pause");
  check("shortcut keys shown", /P/.test(shortcut), shortcut);

  const a11y = await page.evaluate(() => {
    const inputs = [...document.querySelectorAll("input")];
    const named = (el) => Boolean(el.getAttribute("aria-label") || el.closest("label")?.textContent.trim());
    return {
      switchesWithRole: inputs.filter((i) => i.type === "checkbox").every((i) => i.getAttribute("role") === "switch"),
      allNamed: inputs.every(named),
    };
  });
  check("every switch is announced as a switch", a11y.switchesWithRole);
  check("every control has a name", a11y.allNamed);
  await page.keyboard.press("Tab");
  check("keyboard focus is visible", await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle !== "none"));

  await page.emulateMedia({ colorScheme: "light" });
  check("light theme follows the system", (await page.evaluate(() => getComputedStyle(document.body).backgroundColor)) === "rgb(255, 255, 255)");
  await page.emulateMedia({ colorScheme: "dark" });
  check("dark theme follows the system", (await page.evaluate(() => getComputedStyle(document.body).backgroundColor)) === "rgb(20, 20, 20)");

  await store({ skippedToday: { day: "2000-01-01", count: 99 } });
  await wait(300);
  check("yesterday's count shows as 0", (await page.textContent("#today")) === "0");

  await page.click("#reset");
  await wait(300);
  check("Reset clears both counts", (await page.textContent("#count")) === "0" && (await page.textContent("#today")) === "0");
  check("Reset clears counts by kind", (await page.textContent("#breakdown")) === "Sponsored 0 · Video 0 · Google 0");
  await ctx.close();
}

// ---------------------------------------------------------------------------
section("Reloading the extension with tabs open");
{
  const { ctx, sw, store } = await launch();
  await serveFakes(ctx);
  await store({ skipVideoAds: true, blockAutoplay: true, pauseEndsAt: Date.now() + 1500 });
  const errors = [];
  const pages = [];
  for (const url of ["https://news.example.com/a", "https://www.youtube.com/watch?v=mock"]) {
    const p = await ctx.newPage();
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(url);
    pages.push(p);
  }
  await wait(800);
  await sw.evaluate(() => chrome.runtime.reload()).catch(() => {});
  await wait(1500);
  await pages[0].evaluate(() => {
    const ad = document.createElement("ins");
    ad.className = "adsbygoogle";
    document.body.append(ad);
  });
  await pages[1].evaluate(() => {
    document.querySelector("#movie_player video").src = "/after-reload.wav";
    document.body.append(document.createElement("div"));
  });
  await wait(2500);
  check("no errors from tabs left over after a reload", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

finish();
