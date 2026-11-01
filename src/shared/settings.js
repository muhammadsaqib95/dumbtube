// Every stored setting and its default, shared by the popup, the background
// worker and the content scripts.
//
// This is an assignment rather than a `const` because two content scripts can
// load it into the same page (YouTube matches both), and a second `const`
// declaration would throw.
globalThis.DumbTubeSettings ??= Object.freeze({
  DEFAULTS: Object.freeze({
    // YouTube
    dumbYoutube: false,
    hideSuggestions: false, // older name for dumbYoutube, still read for old installs
    hideShorts: true,
    hidePlayables: true,
    hideSponsored: true,
    skipVideoAds: false,
    blockAutoplay: false,
    restoreAutoplay: false, // set when we switched YouTube's Autoplay off ourselves
    hideComments: false,
    hideSidebar: false,
    openSearch: false,
    focusTimer: false,
    focusMinutes: 25,
    focusEndsAt: 0,

    // Other sites
    hideGoogleAds: true,

    // Everywhere
    pauseHiding: false,
    pauseEndsAt: 0,

    // Counters
    skippedAds: 0,
    skippedToday: null, // { day: "YYYY-MM-DD", count }
  }),

  // Keys that only count things; changing them never changes what's hidden.
  COUNTER_KEYS: Object.freeze(["skippedAds", "skippedToday"]),

  // Today's date in the user's time zone, for the "Skipped today" counter.
  localDay(date = new Date()) {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${month}-${day}`;
  },
});
