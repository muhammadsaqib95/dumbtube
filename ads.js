(() => {
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

let hideGoogleAdsOn = true;
let pauseEndsAt = 0;
document.documentElement.classList.add("hide-google-ads");

// After the extension is reloaded or updated, scripts already running in open
// tabs lose access to chrome.* APIs. Stop quietly instead of throwing errors.
let observer = null;
let extensionGone = false;

function extensionAlive() {
  if (extensionGone) return false;
  if (globalThis.chrome?.runtime?.id) return true;
  extensionGone = true;
  observer?.disconnect();
  return false;
}

function sendSkipped(count) {
  if (extensionAlive()) chrome.runtime.sendMessage({ type: "ads-skipped", count }).catch(() => {});
}

function saveSettings(values) {
  if (extensionAlive()) chrome.storage.local.set(values).catch(() => {});
}

function hidingPaused() {
  if (!pauseEndsAt) return false;
  if (Date.now() < pauseEndsAt) return true;
  pauseEndsAt = 0;
  saveSettings({ pauseHiding: false, pauseEndsAt: 0 });
  return false;
}

function hideGoogleAds() {
  if (!extensionAlive()) return;
  const marked = [...document.querySelectorAll("[data-hidden-google-ad]")];
  if (!hideGoogleAdsOn || hidingPaused()) {
    marked.forEach((el) => {
      el.style.removeProperty("display");
      delete el.dataset.hiddenGoogleAd;
    });
    return;
  }

  const matches = [...document.querySelectorAll(AD_SELECTOR)];
  const roots = matches.filter(
    (el) => !matches.some((other) => other !== el && other.contains(el))
  );

  let newlySkipped = 0;
  for (const el of roots) {
    if (el.dataset.skippedAd) continue;
    el.dataset.skippedAd = "1";
    newlySkipped += 1;
  }

  for (const el of matches) {
    el.dataset.hiddenGoogleAd = "1";
    el.style.setProperty("display", "none", "important");
  }

  if (newlySkipped > 0) {
    sendSkipped(newlySkipped);
  }
}

let pauseTimer = 0;

function applyHideGoogleAds(enabled) {
  hideGoogleAdsOn = enabled !== false;
  document.documentElement.classList.toggle("hide-google-ads", hideGoogleAdsOn && !hidingPaused());
  hideGoogleAds();
}

function applyPause(endsAt) {
  pauseEndsAt = Number(endsAt) || 0;
  clearTimeout(pauseTimer);
  const wait = pauseEndsAt - Date.now();
  if (wait > 0) pauseTimer = setTimeout(() => applyHideGoogleAds(hideGoogleAdsOn), wait);
  applyHideGoogleAds(hideGoogleAdsOn);
}

chrome.storage.local.get({ hideGoogleAds: true, pauseEndsAt: 0 }).then((data) => {
  hideGoogleAdsOn = data.hideGoogleAds !== false;
  applyPause(data.pauseEndsAt);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.hideGoogleAds) hideGoogleAdsOn = changes.hideGoogleAds.newValue !== false;
  if (changes.pauseEndsAt) applyPause(changes.pauseEndsAt.newValue);
  else if (changes.hideGoogleAds) applyHideGoogleAds(hideGoogleAdsOn);
});

let scheduled = false;
observer = new MutationObserver(() => {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    hideGoogleAds();
  });
});
observer.observe(document.documentElement, { childList: true, subtree: true });
})();
