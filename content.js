const SHORTS_HREF = "/shorts/";

const YT_AD_SELECTOR = [
  "ytd-ad-slot-renderer",
  "ytd-in-feed-ad-layout-renderer",
  "ytd-banner-promo-renderer",
  "ytd-statement-banner-renderer",
  "ytd-promoted-sparkles-web-renderer",
  "ytd-promoted-sparkles-text-search-renderer",
  "ytd-promoted-video-renderer",
  "ytd-display-ad-renderer",
  "ytd-video-masthead-ad-v3-renderer",
  "ytd-primetime-promo-renderer",
  "ytd-search-pyv-renderer",
  "ytd-companion-slot-renderer",
  "ytd-action-companion-ad-renderer",
].join(",");

const CARD_SELECTOR = [
  "ytd-ad-slot-renderer",
  "ytd-search-pyv-renderer",
  "ytd-promoted-sparkles-web-renderer",
  "ytd-promoted-sparkles-text-search-renderer",
  "ytd-compact-promoted-video-renderer",
  "ytd-promoted-video-renderer",
  "ytd-in-feed-ad-layout-renderer",
  "ytd-rich-item-renderer",
  "ytd-video-renderer",
  "ytd-compact-video-renderer",
  "yt-lockup-view-model",
].join(",");

function closestCard(el) {
  let current = el;
  while (current) {
    if (current.matches?.(CARD_SELECTOR)) return current;
    // Unknown wrapper: stop at the single search result that holds the label.
    if (current.parentElement?.id === "contents" && current.parentElement.parentElement?.matches("ytd-item-section-renderer")) {
      return current;
    }
    const root = current.getRootNode?.();
    current = root?.host || current.parentElement;
  }
  return null;
}

function collectSponsoredCards(root, cards) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let node = root;
  while (node) {
    if (node.shadowRoot) collectSponsoredCards(node.shadowRoot, cards);
    const text = node.childNodes
      ? [...node.childNodes]
          .filter((child) => child.nodeType === Node.TEXT_NODE)
          .map((child) => child.textContent)
          .join("")
          .trim()
      : "";
    if (/^sponsored\b/i.test(text) && text.length < 80) {
      const card = closestCard(node);
      if (card) cards.add(card);
    }
    node = walker.nextNode();
  }
}

let hideSponsoredOn = true;
let pauseEndsAt = 0;

// After the extension is reloaded or updated, scripts already running in open
// tabs lose access to chrome.* APIs. Stop quietly instead of throwing errors.
let observer = null;
let extensionGone = false;

function extensionAlive() {
  if (extensionGone) return false;
  if (globalThis.chrome?.runtime?.id) return true;
  extensionGone = true;
  observer?.disconnect();
  clearInterval(playerTimer);
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

function hideYouTubeAds() {
  const marked = [...document.querySelectorAll("[data-hidden-sponsored]")];
  if (!hideSponsoredOn || hidingPaused()) {
    marked.forEach((el) => {
      el.style.removeProperty("display");
      delete el.dataset.hiddenSponsored;
    });
    return;
  }

  const cards = new Set(
    [...document.querySelectorAll(YT_AD_SELECTOR)].map(
      (el) => el.closest("ytd-rich-item-renderer, ytd-compact-video-renderer, ytd-video-renderer") || el
    )
  );
  if (document.body) collectSponsoredCards(document.body, cards);

  let newlySkipped = 0;
  for (const el of cards) {
    el.dataset.hiddenSponsored = "1";
    el.style.setProperty("display", "none", "important");
    if (el.dataset.skippedAd) continue;
    el.dataset.skippedAd = "1";
    newlySkipped += 1;
  }

  if (newlySkipped > 0) {
    sendSkipped(newlySkipped);
  }
}

function applyHideSponsored(enabled) {
  hideSponsoredOn = enabled !== false;
  document.documentElement.classList.toggle("hide-sponsored", hideSponsoredOn && !hidingPaused());
  hideYouTubeAds();
}

let hideShortsOn = true;

function markHiddenShort(el) {
  el.dataset.hiddenShort = "1";
  el.style.setProperty("display", "none", "important");
}

function hideShorts() {
  const marked = [...document.querySelectorAll("[data-hidden-short]")];
  if (!hideShortsOn || hidingPaused()) {
    marked.forEach((el) => {
      el.style.removeProperty("display");
      delete el.dataset.hiddenShort;
    });
    return;
  }

  document.querySelectorAll("a#thumbnail[href*='/shorts/'], a.shortsLockupViewModelHostEndpoint[href*='/shorts/']").forEach((a) => {
    const card = a.closest(
      "ytd-rich-item-renderer, ytd-video-renderer, ytd-grid-video-renderer, ytd-compact-video-renderer, yt-lockup-view-model"
    );
    if (card) markHiddenShort(card);
  });

  document.querySelectorAll("ytd-reel-shelf-renderer, ytd-rich-shelf-renderer[is-shorts], grid-shelf-view-model").forEach(markHiddenShort);

  document.querySelectorAll("yt-tab-shape, tp-yt-paper-tab").forEach((tab) => {
    if (tab.textContent.trim().toLowerCase() === "shorts") markHiddenShort(tab);
  });
}

function applyHideShorts(enabled) {
  hideShortsOn = enabled !== false;
  document.documentElement.classList.toggle("hide-shorts", hideShortsOn && !hidingPaused());
  hideShorts();
}

// Run now and on DOM changes (YouTube is a SPA)
let hidePlayablesOn = true;
let hideCommentsOn = false;

function playableShelf(el) {
  return (
    el.closest(
      "ytd-rich-shelf-renderer, ytd-horizontal-card-list-renderer, ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer"
    ) || el.closest("ytd-rich-section-renderer")
  );
}

function hidePlayables() {
  const marked = [...document.querySelectorAll("[data-hidden-playable]")];
  if (!hidePlayablesOn || hidingPaused()) {
    marked.forEach((el) => {
      el.style.removeProperty("display");
      delete el.dataset.hiddenPlayable;
    });
    return;
  }

  const shelves = new Set();
  document.querySelectorAll('a[href*="playables"]').forEach((anchor) => {
    const shelf = playableShelf(anchor);
    if (shelf && !shelf.querySelector("ytd-rich-item-renderer ytd-rich-shelf-renderer")) shelves.add(shelf);
  });

  document.querySelectorAll("span, yt-formatted-string, h2").forEach((el) => {
    const text = [...el.childNodes]
      .filter((child) => child.nodeType === Node.TEXT_NODE)
      .map((child) => child.textContent)
      .join("")
      .trim();
    if (text !== "YouTube Playables") return;
    const shelf = playableShelf(el);
    if (shelf) shelves.add(shelf);
  });

  shelves.forEach((shelf) => {
    if (shelf.querySelector("ytd-video-renderer, ytd-compact-video-renderer") && shelf.querySelector("ytd-rich-item-renderer")) return;
    shelf.dataset.hiddenPlayable = "1";
    shelf.style.setProperty("display", "none", "important");
  });
}

function applyHideComments(enabled) {
  hideCommentsOn = Boolean(enabled);
  document.documentElement.classList.toggle("hide-comments", hideCommentsOn && !hidingPaused());
}

let hideSidebarOn = false;

function applyHideSidebar(enabled) {
  hideSidebarOn = Boolean(enabled);
  document.documentElement.classList.toggle("hide-sidebar", hideSidebarOn && !hidingPaused());
}

let openSearchOn = false;
let focusedSearchUrl = "";

function findSearchInput() {
  const direct = document.querySelector("#search-input input, input#search, input[name='search_query']");
  if (direct) return direct;
  for (const host of document.querySelectorAll("yt-searchbox, ytd-searchbox")) {
    const input = host.shadowRoot?.querySelector("input");
    if (input) return input;
  }
  return null;
}

function focusSearch() {
  if (!openSearchOn || location.pathname !== "/") {
    focusedSearchUrl = "";
    return;
  }
  if (focusedSearchUrl === location.href) return;
  const input = findSearchInput();
  if (!input) return;
  focusedSearchUrl = location.href;
  input.focus();
}

function applyOpenSearch(enabled) {
  openSearchOn = Boolean(enabled);
  if (openSearchOn) focusedSearchUrl = "";
  focusSearch();
}

let focusTimerOn = false;
let focusEndsAt = 0;
let focusTimerId = 0;

function clearFocusNote() {
  document.getElementById("focus-timer-note")?.remove();
}

function showFocusNote() {
  if (document.getElementById("focus-timer-note")) return;
  const note = document.createElement("p");
  note.id = "focus-timer-note";
  note.textContent = "Focus time is up. Playback is paused.";
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Keep watching";
  button.addEventListener("click", () => {
    saveSettings({ focusTimer: false, focusEndsAt: 0 });
  });
  note.appendChild(button);
  document.documentElement.appendChild(note);
}

function pauseForFocus() {
  if (!focusTimerOn || !focusEndsAt || Date.now() < focusEndsAt) return;
  document.querySelectorAll("video").forEach((video) => {
    if (!video.paused) video.pause();
  });
  showFocusNote();
}

function scheduleFocusTimer() {
  clearTimeout(focusTimerId);
  if (!focusTimerOn || !focusEndsAt) {
    clearFocusNote();
    return;
  }
  const wait = focusEndsAt - Date.now();
  if (wait <= 0) {
    pauseForFocus();
    return;
  }
  clearFocusNote();
  focusTimerId = setTimeout(pauseForFocus, wait);
}

function applyFocusTimer(enabled, endsAt) {
  focusTimerOn = Boolean(enabled);
  focusEndsAt = focusTimerOn ? Number(endsAt) || 0 : 0;
  scheduleFocusTimer();
}

let skipVideoAdsOn = false;
let blockAutoplayOn = false;
let playerTimer = 0;
const mutedForAd = new WeakSet();
const countedAdSrc = new WeakMap();
const adSeekAt = new WeakMap();
let lastAutonavClick = 0;

// YouTube ignores scripted clicks on its Skip button, so ads are skipped by
// jumping to their end. Every player on the page is checked: YouTube keeps
// hidden preview players around, and the ad may be in any of them.
function skipVideoAd() {
  for (const player of document.querySelectorAll(".html5-video-player")) {
    const video = player.querySelector("video");
    if (!video) continue;

    if (!player.classList.contains("ad-showing")) {
      // Ad is over: give the sound back if we were the ones who muted it.
      if (mutedForAd.has(video)) video.muted = false;
      mutedForAd.delete(video);
      countedAdSrc.delete(video);
      adSeekAt.delete(video);
      continue;
    }
    if (!skipVideoAdsOn || hidingPaused()) continue;

    if (video.currentSrc && countedAdSrc.get(video) !== video.currentSrc) {
      countedAdSrc.set(video, video.currentSrc);
      adSeekAt.delete(video);
      sendSkipped(1);
    }
    if (!video.muted) {
      video.muted = true;
      mutedForAd.add(video);
    }

    // Jumping before the ad has loaded stalls for seconds; loadedmetadata re-runs this.
    const { duration, currentTime } = video;
    if (video.readyState < 1 || !Number.isFinite(duration) || duration <= 0) continue;
    if (currentTime < duration - 0.1) {
      video.currentTime = duration - 0.1;
      adSeekAt.set(video, Date.now());
    } else if (Date.now() - (adSeekAt.get(video) || 0) > 1000) {
      // Jumped already but the ad hasn't ended: nudge it the rest of the way.
      video.currentTime = duration;
      adSeekAt.set(video, Date.now());
      video.play().catch(() => {});
    }
  }
}

function blockAutoplay() {
  if (!blockAutoplayOn) return;
  const toggle = document.querySelector(".ytp-autonav-toggle-button[aria-checked='true']");
  if (toggle && Date.now() - lastAutonavClick > 2000) {
    lastAutonavClick = Date.now();
    (toggle.closest("button") || toggle).click();
  }
  // If the end-of-video countdown already started, cancel it.
  const cancel = document.querySelector(".ytp-autonav-endscreen-upnext-cancel-button");
  if (cancel && cancel.offsetParent !== null) cancel.click();
}

function playerTick() {
  if (!extensionAlive()) return;
  skipVideoAd();
  blockAutoplay();
}

function syncPlayerHelpers() {
  document.documentElement.classList.toggle("skip-video-ads", skipVideoAdsOn && !hidingPaused());
  const needed = skipVideoAdsOn || blockAutoplayOn;
  if (needed && !playerTimer) playerTimer = setInterval(playerTick, 300);
  if (!needed && playerTimer) {
    clearInterval(playerTimer);
    playerTimer = 0;
  }
  playerTick();
}

function applySkipVideoAds(enabled) {
  skipVideoAdsOn = Boolean(enabled);
  syncPlayerHelpers();
}

function applyBlockAutoplay(enabled) {
  blockAutoplayOn = Boolean(enabled);
  syncPlayerHelpers();
}

function hideAll() {
  if (!extensionAlive()) return;
  applyHideShorts(hideShortsOn);
  applyHideSponsored(hideSponsoredOn);
  hidePlayables();
  applyHideComments(hideCommentsOn);
  applyHideSidebar(hideSidebarOn);
  applyDumbYoutube(dumbYoutube);
  focusSearch();
  pauseForFocus();
  syncDumbPlaceholder();
  syncPlayerHelpers();
}

let pauseTimer = 0;

function applyPause(endsAt) {
  pauseEndsAt = Number(endsAt) || 0;
  clearTimeout(pauseTimer);
  const wait = pauseEndsAt - Date.now();
  if (wait > 0) pauseTimer = setTimeout(hideAll, wait);
  hideAll();
}

let dumbYoutube = false;

function applyDumbYoutube(enabled) {
  dumbYoutube = Boolean(enabled);
  document.documentElement.classList.toggle("dumb-youtube", dumbYoutube && !hidingPaused());
  syncDumbPlaceholder();
}

function syncDumbPlaceholder() {
  const onHome = location.pathname === "/" || location.pathname.startsWith("/feed/subscriptions");
  let note = document.getElementById("dumb-yt-note");
  if (!dumbYoutube || hidingPaused() || !onHome) {
    note?.remove();
    return;
  }
  if (!note) {
    note = document.createElement("p");
    note.id = "dumb-yt-note";
    note.textContent = "Search for a topic to watch a video.";
    document.documentElement.appendChild(note);
  }
}

chrome.storage.local.get({ dumbYoutube: false, hideSuggestions: false, hidePlayables: true, hideComments: false, hideShorts: true, hideSponsored: true, openSearch: false, hideSidebar: false, focusTimer: false, focusEndsAt: 0, pauseEndsAt: 0, skipVideoAds: false, blockAutoplay: false }).then((data) => {
  dumbYoutube = Boolean(data.dumbYoutube || data.hideSuggestions);
  hidePlayablesOn = data.hidePlayables !== false;
  hideCommentsOn = Boolean(data.hideComments);
  hideShortsOn = data.hideShorts !== false;
  hideSponsoredOn = data.hideSponsored !== false;
  skipVideoAdsOn = Boolean(data.skipVideoAds);
  blockAutoplayOn = Boolean(data.blockAutoplay);
  applyOpenSearch(data.openSearch);
  applyFocusTimer(data.focusTimer, data.focusEndsAt);
  applyPause(data.pauseEndsAt);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.dumbYoutube || changes.hideSuggestions) {
    chrome.storage.local.get({ dumbYoutube: false, hideSuggestions: false }).then((data) => {
      applyDumbYoutube(data.dumbYoutube || data.hideSuggestions);
    });
  }
  if (changes.hidePlayables) {
    hidePlayablesOn = Boolean(changes.hidePlayables.newValue);
    hidePlayables();
  }
  if (changes.hideComments) {
    applyHideComments(changes.hideComments.newValue);
  }
  if (changes.hideShorts) {
    applyHideShorts(changes.hideShorts.newValue);
  }
  if (changes.hideSponsored) {
    applyHideSponsored(changes.hideSponsored.newValue);
  }
  if (changes.openSearch) {
    applyOpenSearch(changes.openSearch.newValue);
  }
  if (changes.hideSidebar) {
    applyHideSidebar(changes.hideSidebar.newValue);
  }
  if (changes.skipVideoAds) applySkipVideoAds(changes.skipVideoAds.newValue);
  if (changes.blockAutoplay) applyBlockAutoplay(changes.blockAutoplay.newValue);
  if (changes.pauseEndsAt) applyPause(changes.pauseEndsAt.newValue);
  if (changes.focusTimer || changes.focusEndsAt) {
    chrome.storage.local.get({ focusTimer: false, focusEndsAt: 0 }).then((data) => {
      applyFocusTimer(data.focusTimer, data.focusEndsAt);
    });
  }
});

// React the moment an ad loads instead of waiting for the next poll.
for (const type of ["loadedmetadata", "durationchange", "playing", "timeupdate"]) {
  document.addEventListener(type, (event) => {
    if (skipVideoAdsOn && event.target instanceof HTMLVideoElement) skipVideoAd();
  }, true);
}

document.addEventListener("play", (event) => {
  if (event.target instanceof HTMLVideoElement) pauseForFocus();
}, true);

hideAll();
let scheduled = false;
observer = new MutationObserver(() => {
  if (scheduled) return;
  scheduled = true;
  setTimeout(() => {
    scheduled = false;
    hideAll();
  }, 200);
});
observer.observe(document.documentElement, { childList: true, subtree: true });

window.addEventListener("yt-navigate-finish", hideAll);