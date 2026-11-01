// "Hide Google ads": AdSense and Google Ad Manager slots on any website.
// google-ads.css hides them as soon as the page starts loading; this script
// counts them, hides ones the CSS can't reach, and handles "Pause hiding" and
// sites where the user chose to leave ads alone.
//
// Wrapped in a function because it shares a page with the YouTube scripts.
(() => {
  const { DEFAULTS, load, save, onChanged, isAllowed } = DumbTubeSettings;

  const AD_SELECTOR = [
    "ins.adsbygoogle",
    ".google-auto-placed",
    "iframe[id^='google_ads_iframe']",
    "iframe[id^='aswift_']",
    "iframe[name^='google_ads_iframe']",
    "div[id^='google_ads_iframe']",
    "div[id^='google_ads_']",
    "div[id^='div-gpt-ad']",
    "iframe[src*='googlesyndication.com']",
    "iframe[src*='doubleclick.net/pagead']",
    "iframe[src*='googleadservices.com/pagead']",
  ].join(",");

  const KEYS = {
    hideGoogleAds: DEFAULTS.hideGoogleAds,
    googleAdsAllowlist: DEFAULTS.googleAdsAllowlist,
    pauseEndsAt: DEFAULTS.pauseEndsAt,
  };
  const settings = { ...KEYS };

  // Ads usually sit in iframes from other domains; the site that counts is
  // the one in the address bar.
  const site = location.ancestorOrigins?.length
    ? new URL(location.ancestorOrigins[location.ancestorOrigins.length - 1]).hostname
    : location.hostname;
  let pauseTimer = 0;
  let observer = null;
  let extensionGone = false;
  let runScheduled = false;

  // After the extension is reloaded or updated, this copy loses access to
  // chrome.* APIs. Stop quietly instead of throwing errors.
  function extensionAlive() {
    if (extensionGone) return false;
    if (globalThis.chrome?.runtime?.id) return true;
    extensionGone = true;
    observer?.disconnect();
    clearTimeout(pauseTimer);
    return false;
  }

  function paused() {
    if (!settings.pauseEndsAt) return false;
    if (Date.now() < settings.pauseEndsAt) return true;
    settings.pauseEndsAt = 0;
    if (extensionAlive()) save({ pauseHiding: false, pauseEndsAt: 0 }).catch(() => {});
    return false;
  }

  function showHiddenAds() {
    for (const el of document.querySelectorAll("[data-hidden-google-ad]")) {
      el.style.removeProperty("display");
      delete el.dataset.hiddenGoogleAd;
    }
  }

  function hideAds() {
    if (!extensionAlive()) return;
    const on = settings.hideGoogleAds && !paused() && !isAllowed(site, settings.googleAdsAllowlist);
    document.documentElement.classList.toggle("hide-google-ads", on);
    if (!on) {
      showHiddenAds();
      return;
    }

    const matches = [...document.querySelectorAll(AD_SELECTOR)];
    // Count each ad once, not every nested element that makes it up.
    const outermost = matches.filter((el) => !matches.some((other) => other !== el && other.contains(el)));

    let newlyHidden = 0;
    for (const el of outermost) {
      if (el.dataset.skippedAd) continue;
      el.dataset.skippedAd = "1";
      newlyHidden += 1;
    }
    for (const el of matches) {
      el.dataset.hiddenGoogleAd = "1";
      el.style.setProperty("display", "none", "important");
    }
    if (newlyHidden > 0) {
      chrome.runtime.sendMessage({ type: "ads-skipped", count: newlyHidden, kind: "google" }).catch(() => {});
    }
  }

  function applySettings(values) {
    if ("hideGoogleAds" in values) settings.hideGoogleAds = values.hideGoogleAds !== false;
    if ("googleAdsAllowlist" in values) settings.googleAdsAllowlist = values.googleAdsAllowlist || [];
    if ("pauseEndsAt" in values) {
      settings.pauseEndsAt = Number(values.pauseEndsAt) || 0;
      clearTimeout(pauseTimer);
      const wait = settings.pauseEndsAt - Date.now();
      if (wait > 0) pauseTimer = setTimeout(hideAds, wait);
    }
    hideAds();
  }

  // Hide straight away; stored settings arrive a moment later.
  document.documentElement.classList.add("hide-google-ads");

  load(KEYS).then(applySettings);

  onChanged((values) => {
    const relevant = Object.fromEntries(Object.entries(values).filter(([key]) => key in KEYS));
    if (Object.keys(relevant).length) applySettings(relevant);
  });

  // At most once per frame, however many elements the page adds.
  observer = new MutationObserver(() => {
    if (runScheduled) return;
    runScheduled = true;
    requestAnimationFrame(() => {
      runScheduled = false;
      hideAds();
    });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
