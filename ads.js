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
document.documentElement.classList.add("hide-google-ads");

function hideGoogleAds() {
  const marked = [...document.querySelectorAll("[data-hidden-google-ad]")];
  if (!hideGoogleAdsOn) {
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
    chrome.runtime.sendMessage({ type: "ads-skipped", count: newlySkipped }).catch(() => {});
  }
}

function applyHideGoogleAds(enabled) {
  hideGoogleAdsOn = enabled !== false;
  document.documentElement.classList.toggle("hide-google-ads", hideGoogleAdsOn);
  hideGoogleAds();
}

chrome.storage.local.get({ hideGoogleAds: true }).then((data) => {
  applyHideGoogleAds(data.hideGoogleAds);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.hideGoogleAds) {
    applyHideGoogleAds(changes.hideGoogleAds.newValue);
  }
});

let scheduled = false;
const observer = new MutationObserver(() => {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    hideGoogleAds();
  });
});
observer.observe(document.documentElement, { childList: true, subtree: true });
})();
