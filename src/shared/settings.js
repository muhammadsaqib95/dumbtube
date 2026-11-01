// Every stored setting, its default, and where it's stored. Shared by the
// popup, the background worker and the content scripts.
//
// Preferences (switches, minutes, allowed sites) live in chrome.storage.sync,
// so they follow the user to every computer signed in to Chrome. Counters,
// watch time and running timers live in chrome.storage.local, per computer.
//
// This is an assignment rather than a `const` because two content scripts can
// load it into the same page (YouTube matches both), and a second `const`
// declaration would throw.
globalThis.DumbTubeSettings ??= (() => {
  const DEFAULTS = Object.freeze({
    // YouTube switches (synced)
    dumbYoutube: false,
    hideSuggestions: false, // older name for dumbYoutube, still read for old installs
    hideShorts: true,
    hidePlayables: true,
    hideSponsored: true,
    skipVideoAds: false,
    blockAutoplay: false,
    hideComments: false,
    hideSidebar: false,
    openSearch: false,
    focusMinutes: 25,
    dailyLimit: false,
    dailyLimitMinutes: 60,

    // Other sites (synced)
    hideGoogleAds: true,
    googleAdsAllowlist: [], // hostnames where Google ads are left alone

    // Running state (this computer only)
    focusTimer: false,
    focusEndsAt: 0,
    pauseHiding: false,
    pauseEndsAt: 0,
    restoreAutoplay: false, // set when we switched YouTube's Autoplay off ourselves
    dailyLimitSnoozed: "", // day the user chose "Keep watching today"

    // Counters (this computer only)
    skippedAds: 0,
    skippedByKind: { sponsored: 0, video: 0, google: 0 },
    skippedToday: null, // { day: "YYYY-MM-DD", count }
    watchedToday: null, // { day, seconds, lastTick }
  });

  const SYNCED_KEYS = new Set([
    "dumbYoutube",
    "hideSuggestions",
    "hideShorts",
    "hidePlayables",
    "hideSponsored",
    "skipVideoAds",
    "blockAutoplay",
    "hideComments",
    "hideSidebar",
    "openSearch",
    "focusMinutes",
    "dailyLimit",
    "dailyLimitMinutes",
    "hideGoogleAds",
    "googleAdsAllowlist",
  ]);

  // Keys that only record what happened; changing them never changes what's hidden.
  const STAT_KEYS = Object.freeze(["skippedAds", "skippedByKind", "skippedToday", "watchedToday"]);

  const PAUSE_MS = 10 * 60 * 1000;

  const areaOf = (key) => (SYNCED_KEYS.has(key) ? "sync" : "local");

  function split(keys) {
    const parts = { sync: [], local: [] };
    for (const key of keys) parts[areaOf(key)].push(key);
    return parts;
  }

  function pick(object, keys) {
    return Object.fromEntries(keys.map((key) => [key, object[key]]));
  }

  // Read settings from both areas. `defaults` picks the keys (default: all).
  async function load(defaults = DEFAULTS) {
    const { sync, local } = split(Object.keys(defaults));
    const [fromSync, fromLocal] = await Promise.all([
      sync.length ? chrome.storage.sync.get(pick(defaults, sync)) : {},
      local.length ? chrome.storage.local.get(pick(defaults, local)) : {},
    ]);
    return { ...fromSync, ...fromLocal };
  }

  // Write settings, each key to its own area.
  async function save(values) {
    const { sync, local } = split(Object.keys(values));
    await Promise.all([
      sync.length && chrome.storage.sync.set(pick(values, sync)),
      local.length && chrome.storage.local.set(pick(values, local)),
    ]);
  }

  // Calls `listener(values)` with the new value of every setting that changed.
  // Copies of a key left over in the other area (from before syncing) are ignored.
  function onChanged(listener) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "sync" && area !== "local") return;
      const values = {};
      for (const [key, { newValue }] of Object.entries(changes)) {
        if (key in DEFAULTS && areaOf(key) === area) values[key] = newValue ?? DEFAULTS[key];
      }
      if (Object.keys(values).length) listener(values);
    });
  }

  // Today's date in the user's time zone, for the daily counters.
  function localDay(date = new Date()) {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${month}-${day}`;
  }

  // "www.example.com" -> "example.com", the form stored in the allowlist.
  function siteOf(hostname) {
    return String(hostname || "").toLowerCase().replace(/^www\./, "");
  }

  // True if `hostname` is an allowed site or one of its subdomains.
  function isAllowed(hostname, allowlist) {
    const site = siteOf(hostname);
    return (allowlist || []).some((entry) => site === entry || site.endsWith(`.${entry}`));
  }

  return Object.freeze({
    DEFAULTS,
    SYNCED_KEYS,
    STAT_KEYS,
    PAUSE_MS,
    load,
    save,
    onChanged,
    localDay,
    siteOf,
    isAllowed,
  });
})();
