// The toolbar popup: switches, the focus timer and daily limit, per-site
// Google ads, "Pause hiding", counters and keyboard shortcuts. Settings are
// saved through DumbTubeSettings, which the content scripts listen to.
const { DEFAULTS, PAUSE_MS, load, save, onChanged, localDay, siteOf, isAllowed } = DumbTubeSettings;

// Plain switches: element id -> setting key.
const SWITCHES = {
  "hide-shorts": "hideShorts",
  "hide-playables": "hidePlayables",
  "hide-sponsored": "hideSponsored",
  "skip-video-ads": "skipVideoAds",
  "block-autoplay": "blockAutoplay",
  "hide-comments": "hideComments",
  "hide-sidebar": "hideSidebar",
  "open-search": "openSearch",
  "hide-google-ads": "hideGoogleAds",
  "daily-limit": "dailyLimit",
};

const FOCUS_RANGE = { min: 5, max: 180 };
const DAILY_LIMIT_RANGE = { min: 5, max: 600 };
const YOUTUBE_SITES = ["youtube.com", "music.youtube.com"];

const $ = (id) => document.getElementById(id);
const state = { ...DEFAULTS };

function clampMinutes(input, range, fallback) {
  const minutes = Math.round(Number(input.value));
  const clamped = Number.isFinite(minutes) ? Math.min(range.max, Math.max(range.min, minutes)) : fallback;
  input.value = String(clamped);
  return clamped;
}

// ---- Counters --------------------------------------------------------------

const formatNumber = (n) => Number(n || 0).toLocaleString();

function renderCounts() {
  $("count").textContent = formatNumber(state.skippedAds);
  const today = state.skippedToday?.day === localDay() ? state.skippedToday.count : 0;
  $("today").textContent = formatNumber(today);
  const byKind = { ...DEFAULTS.skippedByKind, ...state.skippedByKind };
  $("breakdown").textContent =
    `Sponsored ${formatNumber(byKind.sponsored)} · Video ${formatNumber(byKind.video)} · Google ${formatNumber(byKind.google)}`;
}

$("reset").addEventListener("click", () => {
  save({ skippedAds: 0, skippedByKind: DEFAULTS.skippedByKind, skippedToday: { day: localDay(), count: 0 } });
});

// ---- Switches ---------------------------------------------------------------

function renderSwitches() {
  for (const [id, key] of Object.entries(SWITCHES)) $(id).checked = Boolean(state[key]);
  $("dumb-youtube").checked = Boolean(state.dumbYoutube || state.hideSuggestions);
  $("focus-timer").checked = Boolean(state.focusTimer);
  $("focus-minutes").value = String(state.focusMinutes);
  $("daily-limit-minutes").value = String(state.dailyLimitMinutes);
}

for (const [id, key] of Object.entries(SWITCHES)) {
  $(id).addEventListener("change", (event) => save({ [key]: event.target.checked }));
}

// "Dumb YouTube" used to be stored as hideSuggestions; clear the old key.
$("dumb-youtube").addEventListener("change", (event) => {
  save({ dumbYoutube: event.target.checked, hideSuggestions: false });
});

// ---- Focus timer and daily limit ------------------------------------------------

function saveFocusTimer() {
  const enabled = $("focus-timer").checked;
  const minutes = clampMinutes($("focus-minutes"), FOCUS_RANGE, DEFAULTS.focusMinutes);
  save({ focusTimer: enabled, focusMinutes: minutes, focusEndsAt: enabled ? Date.now() + minutes * 60 * 1000 : 0 });
}

$("focus-timer").addEventListener("change", saveFocusTimer);
$("focus-minutes").addEventListener("change", saveFocusTimer);

$("daily-limit-minutes").addEventListener("change", () => {
  save({ dailyLimitMinutes: clampMinutes($("daily-limit-minutes"), DAILY_LIMIT_RANGE, DEFAULTS.dailyLimitMinutes) });
});

function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

function renderWatched() {
  const watched = state.watchedToday?.day === localDay() ? state.watchedToday.seconds : 0;
  $("watched-today").textContent = `${formatDuration(watched)} watched today`;
}

// ---- Google ads on the current site ----------------------------------------------

let currentSite = "";

// The site in the active tab. The popup can read it because of the
// "activeTab" permission. `?site=` lets tests open the popup as a normal page.
async function findCurrentSite() {
  const fromQuery = new URLSearchParams(location.search).get("site");
  if (fromQuery) return siteOf(fromQuery);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    const url = new URL(tab?.url || "");
    return url.protocol === "http:" || url.protocol === "https:" ? siteOf(url.hostname) : "";
  } catch {
    return "";
  }
}

function renderSiteRow() {
  const applies = currentSite && !YOUTUBE_SITES.includes(currentSite) && state.hideGoogleAds;
  $("site-row").hidden = !applies;
  if (!applies) return;
  $("site-name").textContent = currentSite;
  $("site-ads").checked = !isAllowed(currentSite, state.googleAdsAllowlist);
}

$("site-ads").addEventListener("change", (event) => {
  const list = state.googleAdsAllowlist || [];
  const allowlist = event.target.checked
    ? list.filter((entry) => !isAllowed(currentSite, [entry]))
    : [...new Set([...list, currentSite])];
  save({ googleAdsAllowlist: allowlist });
});

// ---- Pause hiding -----------------------------------------------------------

const pauseCopy = $("pause-hiding-desc");
const PAUSE_COPY = pauseCopy.textContent;
let pauseTick = 0;

function formatRemaining(ms) {
  const total = Math.ceil(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function renderPause() {
  clearInterval(pauseTick);
  const remaining = () => Math.max(0, Number(state.pauseEndsAt) - Date.now());
  $("pause-hiding").checked = remaining() > 0;
  if (!remaining()) {
    pauseCopy.textContent = PAUSE_COPY;
    return;
  }
  // Update the countdown every second, but only announce it to screen readers once.
  pauseCopy.textContent = `Showing everything · ${formatRemaining(remaining())} left`;
  pauseCopy.setAttribute("aria-live", "off");
  pauseTick = setInterval(() => {
    if (!remaining()) renderPause();
    else pauseCopy.textContent = `Showing everything · ${formatRemaining(remaining())} left`;
  }, 1000);
}

$("pause-hiding").addEventListener("change", (event) => {
  pauseCopy.setAttribute("aria-live", "polite");
  save({ pauseHiding: event.target.checked, pauseEndsAt: event.target.checked ? Date.now() + PAUSE_MS : 0 });
});

// ---- Keyboard shortcuts --------------------------------------------------------

async function renderShortcuts() {
  const commands = await chrome.commands.getAll();
  const keys = Object.fromEntries(commands.map((c) => [c.name, c.shortcut]));
  $("shortcut-pause").textContent = keys["toggle-pause"] || "not set";
  $("shortcut-focus").textContent = keys["toggle-focus-timer"] || "not set";
}

$("edit-shortcuts").addEventListener("click", () => chrome.tabs.create({ url: "chrome://extensions/shortcuts" }));

// ---- Load and stay in sync ----------------------------------------------------

function render() {
  renderCounts();
  renderSwitches();
  renderWatched();
  renderSiteRow();
  renderPause();
}

Promise.all([load(), findCurrentSite()]).then(([data, site]) => {
  Object.assign(state, data);
  currentSite = site;
  render();
});

onChanged((values) => {
  Object.assign(state, values);
  renderCounts();
  renderWatched();
  renderSiteRow();
  if ("pauseEndsAt" in values) renderPause();
  if ("focusTimer" in values) $("focus-timer").checked = Boolean(state.focusTimer);
});

renderShortcuts();
