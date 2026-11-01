// Wires the YouTube features together. Loaded last (see manifest.json): loads
// settings, re-runs every feature when settings or the page change, and stops
// everything if the extension is reloaded underneath this tab.
(() => {
  const { settings, features, onMusic, extensionAlive, onStop } = DumbTube;
  const { DEFAULTS, COUNTER_KEYS } = DumbTubeSettings;

  // YouTube Music shares the video player but none of YouTube's page layout.
  const enabled = features.filter((feature) => !onMusic || feature.onMusic);
  const PAGE_CHANGE_DELAY_MS = 200;

  let pauseTimer = 0;
  let runScheduled = false;

  function runAll() {
    if (!extensionAlive()) return;
    for (const feature of enabled) feature.run();
  }

  // Bring everything back on screen when "Pause hiding" runs out.
  function schedulePauseEnd() {
    clearTimeout(pauseTimer);
    const wait = (Number(settings.pauseEndsAt) || 0) - Date.now();
    if (wait > 0) pauseTimer = setTimeout(runAll, wait);
  }

  function applySettings(values) {
    const keys = new Set(Object.keys(values).filter((key) => !COUNTER_KEYS.includes(key)));
    if (!keys.size) return;
    for (const key of keys) settings[key] = values[key];
    if (keys.has("pauseEndsAt")) schedulePauseEnd();
    for (const feature of enabled) feature.settingsChanged?.(keys);
    runAll();
  }

  chrome.storage.local.get(DEFAULTS).then(applySettings);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    const values = {};
    for (const [key, { newValue }] of Object.entries(changes)) values[key] = newValue ?? DEFAULTS[key];
    applySettings(values);
  });

  // YouTube is a single-page app: watch for new content and re-run, at most
  // once per PAGE_CHANGE_DELAY_MS.
  const observer = new MutationObserver((records) => {
    for (const feature of enabled) feature.pageChanged?.(records);
    if (runScheduled) return;
    runScheduled = true;
    setTimeout(() => {
      runScheduled = false;
      runAll();
    }, PAGE_CHANGE_DELAY_MS);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener("yt-navigate-finish", () => {
    for (const feature of enabled) feature.navigated?.();
    runAll();
  });

  onStop(() => {
    observer.disconnect();
    clearTimeout(pauseTimer);
  });

  for (const feature of enabled) feature.start?.();
  runAll();
})();
