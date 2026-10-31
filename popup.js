const STORAGE_KEY = "skippedAds";
const DUMB_KEY = "dumbYoutube";
const PLAYABLES_KEY = "hidePlayables";
const COMMENTS_KEY = "hideComments";
const SHORTS_KEY = "hideShorts";
const SPONSORED_KEY = "hideSponsored";
const OPEN_SEARCH_KEY = "openSearch";
const SIDEBAR_KEY = "hideSidebar";
const FOCUS_KEY = "focusTimer";
const FOCUS_MINUTES_KEY = "focusMinutes";
const FOCUS_ENDS_KEY = "focusEndsAt";
const GOOGLE_ADS_KEY = "hideGoogleAds";
const PAUSE_KEY = "pauseHiding";
const PAUSE_ENDS_KEY = "pauseEndsAt";
const SKIP_VIDEO_ADS_KEY = "skipVideoAds";
const AUTOPLAY_KEY = "blockAutoplay";
const PAUSE_MS = 10 * 60 * 1000;
const countEl = document.getElementById("count");
const dumbToggle = document.getElementById("dumb-youtube");
const playablesToggle = document.getElementById("hide-playables");
const commentsToggle = document.getElementById("hide-comments");
const shortsToggle = document.getElementById("hide-shorts");
const sponsoredToggle = document.getElementById("hide-sponsored");
const openSearchToggle = document.getElementById("open-search");
const sidebarToggle = document.getElementById("hide-sidebar");
const focusToggle = document.getElementById("focus-timer");
const focusMinutesInput = document.getElementById("focus-minutes");
const googleAdsToggle = document.getElementById("hide-google-ads");
const skipVideoAdsToggle = document.getElementById("skip-video-ads");
const autoplayToggle = document.getElementById("block-autoplay");
const pauseToggle = document.getElementById("pause-hiding");
const pauseCopy = pauseToggle.closest(".row").querySelector("small");
let pauseTick = 0;

function pauseRemaining(endsAt) {
  return Math.max(0, Number(endsAt) - Date.now());
}

function formatRemaining(ms) {
  const total = Math.ceil(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function renderPause(endsAt) {
  clearInterval(pauseTick);
  const remaining = pauseRemaining(endsAt);
  const active = remaining > 0;
  pauseToggle.checked = active;
  if (!active) {
    pauseCopy.textContent = "Show everything again for 10 minutes";
    if (Number(endsAt) > 0) chrome.storage.local.set({ [PAUSE_KEY]: false, [PAUSE_ENDS_KEY]: 0 });
    return;
  }
  const paint = () => {
    const left = pauseRemaining(endsAt);
    if (left <= 0) {
      chrome.storage.local.set({ [PAUSE_KEY]: false, [PAUSE_ENDS_KEY]: 0 });
      renderPause(0);
      return;
    }
    pauseCopy.textContent = `Showing everything · ${formatRemaining(left)} left`;
  };
  paint();
  pauseTick = setInterval(paint, 1000);
}

function focusMinutes() {
  const minutes = Math.round(Number(focusMinutesInput.value));
  if (!Number.isFinite(minutes)) return 25;
  return Math.min(180, Math.max(5, minutes));
}

function saveFocusTimer(enabled) {
  const minutes = focusMinutes();
  focusMinutesInput.value = String(minutes);
  chrome.storage.local.set({
    [FOCUS_KEY]: enabled,
    [FOCUS_MINUTES_KEY]: minutes,
    [FOCUS_ENDS_KEY]: enabled ? Date.now() + minutes * 60 * 1000 : 0,
  });
}

function render(count) {
  countEl.textContent = Number(count || 0).toLocaleString();
}

chrome.storage.local.get({
  [STORAGE_KEY]: 0,
  [DUMB_KEY]: false,
  hideSuggestions: false,
  [PLAYABLES_KEY]: true,
  [COMMENTS_KEY]: false,
  [SHORTS_KEY]: true,
  [SPONSORED_KEY]: true,
  [OPEN_SEARCH_KEY]: false,
  [SIDEBAR_KEY]: false,
  [FOCUS_KEY]: false,
  [FOCUS_MINUTES_KEY]: 25,
  [GOOGLE_ADS_KEY]: true,
  [PAUSE_ENDS_KEY]: 0,
  [SKIP_VIDEO_ADS_KEY]: false,
  [AUTOPLAY_KEY]: false,
}).then((data) => {
  render(data[STORAGE_KEY]);
  dumbToggle.checked = Boolean(data[DUMB_KEY] || data.hideSuggestions);
  playablesToggle.checked = Boolean(data[PLAYABLES_KEY]);
  commentsToggle.checked = Boolean(data[COMMENTS_KEY]);
  shortsToggle.checked = data[SHORTS_KEY] !== false;
  sponsoredToggle.checked = data[SPONSORED_KEY] !== false;
  openSearchToggle.checked = Boolean(data[OPEN_SEARCH_KEY]);
  sidebarToggle.checked = Boolean(data[SIDEBAR_KEY]);
  focusToggle.checked = Boolean(data[FOCUS_KEY]);
  focusMinutesInput.value = String(data[FOCUS_MINUTES_KEY] || 25);
  googleAdsToggle.checked = data[GOOGLE_ADS_KEY] !== false;
  skipVideoAdsToggle.checked = Boolean(data[SKIP_VIDEO_ADS_KEY]);
  autoplayToggle.checked = Boolean(data[AUTOPLAY_KEY]);
  renderPause(data[PAUSE_ENDS_KEY]);
});

dumbToggle.addEventListener("change", () => {
  chrome.storage.local.set({ [DUMB_KEY]: dumbToggle.checked, hideSuggestions: false });
});

playablesToggle.addEventListener("change", () => {
  chrome.storage.local.set({ [PLAYABLES_KEY]: playablesToggle.checked });
});

commentsToggle.addEventListener("change", () => {
  chrome.storage.local.set({ [COMMENTS_KEY]: commentsToggle.checked });
});

shortsToggle.addEventListener("change", () => {
  chrome.storage.local.set({ [SHORTS_KEY]: shortsToggle.checked });
});

sponsoredToggle.addEventListener("change", () => {
  chrome.storage.local.set({ [SPONSORED_KEY]: sponsoredToggle.checked });
});

openSearchToggle.addEventListener("change", () => {
  chrome.storage.local.set({ [OPEN_SEARCH_KEY]: openSearchToggle.checked });
});

sidebarToggle.addEventListener("change", () => {
  chrome.storage.local.set({ [SIDEBAR_KEY]: sidebarToggle.checked });
});

focusToggle.addEventListener("change", () => {
  saveFocusTimer(focusToggle.checked);
});

focusMinutesInput.addEventListener("change", () => {
  saveFocusTimer(focusToggle.checked);
});

googleAdsToggle.addEventListener("change", () => {
  chrome.storage.local.set({ [GOOGLE_ADS_KEY]: googleAdsToggle.checked });
});

skipVideoAdsToggle.addEventListener("change", () => {
  chrome.storage.local.set({ [SKIP_VIDEO_ADS_KEY]: skipVideoAdsToggle.checked });
});

autoplayToggle.addEventListener("change", () => {
  chrome.storage.local.set({ [AUTOPLAY_KEY]: autoplayToggle.checked });
});

pauseToggle.addEventListener("change", () => {
  const endsAt = pauseToggle.checked ? Date.now() + PAUSE_MS : 0;
  chrome.storage.local.set({
    [PAUSE_KEY]: pauseToggle.checked,
    [PAUSE_ENDS_KEY]: endsAt,
  });
  renderPause(endsAt);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes[STORAGE_KEY]) render(changes[STORAGE_KEY].newValue);
  if (changes[PAUSE_ENDS_KEY] && !pauseToggle.matches(":active")) {
    renderPause(changes[PAUSE_ENDS_KEY].newValue);
  }
});

document.getElementById("reset").addEventListener("click", async () => {
  await chrome.storage.local.set({ [STORAGE_KEY]: 0 });
  await chrome.action.setBadgeText({ text: "" });
});
