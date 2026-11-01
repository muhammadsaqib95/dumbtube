// "Block autoplay": switch off YouTube's own Autoplay toggle and cancel the
// "Up next" countdown. If we were the ones who switched Autoplay off, it's
// switched back on when this setting is turned off.
(() => {
  const { register, settings, save, onStop, extensionAlive } = DumbTube;

  const POLL_MS = 300;
  const CLICK_GAP_MS = 2000; // give YouTube time to update the toggle

  let pollTimer = 0;
  let lastClick = 0;

  function clickToggle(toggle) {
    if (Date.now() - lastClick < CLICK_GAP_MS) return false;
    lastClick = Date.now();
    (toggle.closest("button") || toggle).click();
    return true;
  }

  function setRestoreAutoplay(value) {
    if (Boolean(settings.restoreAutoplay) === value) return;
    settings.restoreAutoplay = value;
    save({ restoreAutoplay: value });
  }

  function cancelUpNext() {
    const cancel = document.querySelector(".ytp-autonav-endscreen-upnext-cancel-button");
    if (cancel && cancel.offsetParent !== null) cancel.click();
  }

  function checkToggle() {
    if (!extensionAlive()) return;
    const toggle = document.querySelector(".ytp-autonav-toggle-button");
    const autoplayOn = toggle?.getAttribute("aria-checked") === "true";

    if (settings.blockAutoplay) {
      if (autoplayOn && clickToggle(toggle)) setRestoreAutoplay(true);
      cancelUpNext();
      return;
    }

    // Put YouTube's Autoplay back the way it was before we switched it off.
    if (!settings.restoreAutoplay || !toggle) return;
    if (autoplayOn || clickToggle(toggle)) setRestoreAutoplay(false);
  }

  function syncPolling() {
    const wanted = Boolean(settings.blockAutoplay || settings.restoreAutoplay);
    if (wanted && !pollTimer) pollTimer = setInterval(checkToggle, POLL_MS);
    if (!wanted && pollTimer) {
      clearInterval(pollTimer);
      pollTimer = 0;
    }
  }

  register({
    name: "autoplay",
    run() {
      syncPolling();
      checkToggle();
    },
    start() {
      onStop(() => clearInterval(pollTimer));
    },
  });
})();
