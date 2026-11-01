// Shared by every YouTube feature file: the current settings, the "Pause
// hiding" switch, a list of registered features, and safe wrappers around the
// chrome.* APIs.
//
// A feature is an object passed to DumbTube.register():
//   name             for debugging
//   onMusic          true if it should also run on music.youtube.com
//   run()            called after every page change and settings change
//   start()          optional, called once to attach listeners
//   settingsChanged(keys)  optional, called with the Set of keys that changed
//   pageChanged(records)   optional, called with MutationObserver records
//   navigated()      optional, called when YouTube switches page
globalThis.DumbTube = (() => {
  const settings = { ...DumbTubeSettings.DEFAULTS };
  const features = [];
  const stopHandlers = [];
  const onMusic = location.hostname === "music.youtube.com";
  let extensionGone = false;

  function register(feature) {
    features.push(feature);
  }

  // After the extension is reloaded or updated, scripts already running in
  // open tabs lose access to chrome.* APIs. Detect that and stop quietly.
  function extensionAlive() {
    if (extensionGone) return false;
    if (globalThis.chrome?.runtime?.id) return true;
    extensionGone = true;
    stopHandlers.forEach((stop) => stop());
    return false;
  }

  function onStop(handler) {
    stopHandlers.push(handler);
  }

  function save(values) {
    if (extensionAlive()) chrome.storage.local.set(values).catch(() => {});
  }

  function sendSkipped(count) {
    if (extensionAlive()) chrome.runtime.sendMessage({ type: "ads-skipped", count }).catch(() => {});
  }

  function paused() {
    const endsAt = Number(settings.pauseEndsAt) || 0;
    if (!endsAt) return false;
    if (Date.now() < endsAt) return true;
    settings.pauseEndsAt = 0;
    save({ pauseHiding: false, pauseEndsAt: 0 });
    return false;
  }

  // A setting is in effect when it's switched on and hiding isn't paused.
  function active(key) {
    return Boolean(settings[key]) && !paused();
  }

  // Feature CSS in youtube.css is keyed off classes on <html>.
  function setPageClass(name, on) {
    document.documentElement.classList.toggle(name, on);
  }

  // Hide an element and tag it with data-<marker> so it can be shown again.
  function hideElement(el, marker) {
    el.dataset[marker] = "1";
    el.style.setProperty("display", "none", "important");
  }

  function showHidden(marker) {
    const attr = `data-${marker.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
    document.querySelectorAll(`[${attr}]`).forEach((el) => {
      el.style.removeProperty("display");
      delete el.dataset[marker];
    });
  }

  // The element's own text, without its children's text.
  function ownText(el) {
    let text = "";
    for (const child of el.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) text += child.textContent;
    }
    return text.trim();
  }

  return {
    settings,
    features,
    onMusic,
    register,
    extensionAlive,
    onStop,
    save,
    sendSkipped,
    paused,
    active,
    setPageClass,
    hideElement,
    showHidden,
    ownText,
  };
})();
