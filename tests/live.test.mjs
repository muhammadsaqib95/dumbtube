// Checks against real YouTube. Needs internet, takes a few minutes, and depends
// on which ads YouTube decides to serve, so a check is skipped (not failed)
// when YouTube gives it nothing to work with.
import { launch, check, skip, section, finish, wait } from "./helpers.mjs";

const SHORT_VIDEO = "https://www.youtube.com/watch?v=jNQXAC9IVRw"; // 19 seconds
const MAX_VIDEO_AD_MS = 3000;

// ---------------------------------------------------------------------------
section("Sponsored cards in real search results");
{
  const { ctx } = await launch({ settings: { hideSponsored: true }, viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  let sawAds = false;
  for (const query of ["vpn", "shopify", "web hosting"]) {
    await page.goto(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, {
      waitUntil: "domcontentloaded",
    });
    await wait(6000);
    const r = await page.evaluate(() => {
      const shown = (el) => el.getClientRects().length > 0 && el.offsetHeight > 0;
      const badges = [...document.querySelectorAll("ad-badge-view-model")];
      return {
        ads: badges.length,
        adsShown: badges.filter(shown).length,
        results: [...document.querySelectorAll("ytd-video-renderer")].filter(shown).length,
      };
    });
    sawAds ||= r.ads > 0;
    check(`"${query}": no ads visible, results still there`, r.adsShown === 0 && r.results > 5, JSON.stringify(r));
  }
  if (!sawAds) skip("search ads were actually served", "YouTube showed no search ads this run");
  await ctx.close();
}

// ---------------------------------------------------------------------------
section("Block autoplay on a real video");
{
  const { ctx } = await launch({ settings: { blockAutoplay: true, skipVideoAds: true } });
  const page = await ctx.newPage();
  await page.goto(SHORT_VIDEO, { waitUntil: "domcontentloaded" });
  await wait(40000); // video ends at ~19s; YouTube would move on a few seconds later
  check("stays on the same video after it ends", page.url() === SHORT_VIDEO, page.url());
  await ctx.close();
}

// ---------------------------------------------------------------------------
section("Skip video ads on real ads");
{
  // Let YouTube autoplay into the next video, which usually starts with ads.
  const { ctx } = await launch({ settings: { skipVideoAds: true, blockAutoplay: false } });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    // Record how long each ad and each end-of-break card stays on screen.
    window.__adLog = [];
    let current = null;
    setInterval(() => {
      const player = document.querySelector("#movie_player");
      const video = player?.querySelector("video");
      const kind = !player?.classList.contains("ad-showing") ? null : video?.src ? "video ad" : "end card";
      const key = kind && `${kind}|${video?.src}`;
      if (current && current.key !== key) {
        window.__adLog.push({ kind: current.kind, ms: Math.round(performance.now() - current.start), hidden: current.hidden });
        current = null;
      }
      if (key && !current) current = { key, kind, start: performance.now(), hidden: true };
      if (current?.kind === "end card") {
        const ads = player.querySelector(".video-ads");
        const skipButton = player.querySelector(".ytp-skip-ad-button");
        const cardHidden = !ads || getComputedStyle(ads).visibility === "hidden";
        const skipShown = !skipButton || getComputedStyle(skipButton).visibility === "visible";
        current.hidden &&= cardHidden && skipShown;
      }
    }, 20);
  });
  await page.goto(SHORT_VIDEO, { waitUntil: "domcontentloaded" });
  await wait(60000);
  const log = await page.evaluate(() => window.__adLog).catch(() => []);
  const videoAds = log.filter((e) => e.kind === "video ad");
  const cards = log.filter((e) => e.kind === "end card");
  console.log(`      ads seen: ${JSON.stringify(log)}`);

  if (videoAds.length) {
    const slowest = Math.max(...videoAds.map((e) => e.ms));
    check(`every video ad gone within ${MAX_VIDEO_AD_MS} ms`, slowest <= MAX_VIDEO_AD_MS, `${videoAds.length} ads, slowest ${slowest} ms`);
  } else {
    skip("video ads skipped quickly", "YouTube served no video ads this run");
  }
  if (cards.length) {
    check("end-of-break card hidden, Skip button left visible", cards.every((e) => e.hidden));
  } else {
    skip("end-of-break card hidden", "YouTube showed no end card this run");
  }
  await ctx.close();
}

finish();
