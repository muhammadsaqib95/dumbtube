// The toolbar popup: on/off switches, the focus timer, "Pause hiding" and the
// ad counters. Everything is saved to chrome.storage.local, which the content
// scripts listen to.
const { DEFAULTS, localDay } = DumbTubeSettings;

const PAUSE_MS = 10 * 60 * 1000;
const MIN_FOCUS_MINUTES = 5;
const MAX_FOCUS_MINUTES = 180;

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
};

const $ = (id) => document.getElementById(id);
const save = (values) => chrome.storage.local.set(values);

// ---- Counters --------------------------------------------------------------

function renderTotal(count) {
  $("count").textContent = Number(count || 0).toLocaleString();
}

function renderToday(today) {
  const count = today?.day === localDay() ? today.count : 0;
  $("today").textContent = Number(count || 0).toLocaleString();
}

$("reset").addEventListener("click", async () => {
  await save({ skippedAds: 0, skippedToday: { day: localDay(), count: 0 } });
  await chrome.action.setBadgeText({ text: "" });
});

// ---- Switches ---------------------------------------------------------------

for (const [id, key] of Object.entries(SWITCHES)) {
  $(id).addEventListener("change", (event) => save({ [key]: event.target.checked }));
}

// "Dumb YouTube" used to be stored as hideSuggestions; clear the old key.
$("dumb-youtube").addEventListener("change", (event) => {
  save({ dumbYoutube: event.target.checked, hideSuggestions: false });
});

// ---- Focus timer ------------------------------------------------------------

function focusMinutes() {
  const minutes = Math.round(Number($("focus-minutes").value));
  if (!Number.isFinite(minutes)) return DEFAULTS.focusMinutes;
  return Math.min(MAX_FOCUS_MINUTES, Math.max(MIN_FOCUS_MINUTES, minutes));
}

function saveFocusTimer() {
  const enabled = $("focus-timer").checked;
  const minutes = focusMinutes();
  $("focus-minutes").value = String(minutes);
  save({
    focusTimer: enabled,
    focusMinutes: minutes,
    focusEndsAt: enabled ? Date.now() + minutes * 60 * 1000 : 0,
  });
}

$("focus-timer").addEventListener("change", saveFocusTimer);
$("focus-minutes").addEventListener("change", saveFocusTimer);

// ---- Pause hiding -----------------------------------------------------------

const pauseCopy = $("pause-hiding").closest(".row").querySelector("small");
const PAUSE_COPY = pauseCopy.textContent;
let pauseTick = 0;

function formatRemaining(ms) {
  const total = Math.ceil(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function renderPause(endsAt) {
  clearInterval(pauseTick);
  const remaining = () => Math.max(0, Number(endsAt) - Date.now());
  $("pause-hiding").checked = remaining() > 0;

  if (!remaining()) {
    pauseCopy.textContent = PAUSE_COPY;
    if (Number(endsAt) > 0) save({ pauseHiding: false, pauseEndsAt: 0 });
    return;
  }

  const paint = () => {
    if (!remaining()) {
      renderPause(endsAt);
      return;
    }
    pauseCopy.textContent = `Showing everything · ${formatRemaining(remaining())} left`;
  };
  paint();
  pauseTick = setInterval(paint, 1000);
}

$("pause-hiding").addEventListener("change", (event) => {
  const endsAt = event.target.checked ? Date.now() + PAUSE_MS : 0;
  save({ pauseHiding: event.target.checked, pauseEndsAt: endsAt });
  renderPause(endsAt);
});

// ---- Load and stay in sync ----------------------------------------------------

chrome.storage.local.get(DEFAULTS).then((data) => {
  renderTotal(data.skippedAds);
  renderToday(data.skippedToday);
  for (const [id, key] of Object.entries(SWITCHES)) $(id).checked = Boolean(data[key]);
  $("dumb-youtube").checked = Boolean(data.dumbYoutube || data.hideSuggestions);
  $("focus-timer").checked = Boolean(data.focusTimer);
  $("focus-minutes").value = String(data.focusMinutes || DEFAULTS.focusMinutes);
  renderPause(data.pauseEndsAt);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.skippedAds) renderTotal(changes.skippedAds.newValue);
  if (changes.skippedToday) renderToday(changes.skippedToday.newValue);
  if (changes.pauseEndsAt) renderPause(changes.pauseEndsAt.newValue);
});
