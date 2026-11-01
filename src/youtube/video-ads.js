// "Skip video ads": ads that play in the video player.
//
// YouTube ignores clicks on its Skip button unless they come from a real
// mouse, so ads are skipped by jumping to their end instead. The ad is muted
// and hidden meanwhile (see youtube.css), and the sound comes back afterwards.
// Every player on the page is checked: YouTube keeps hidden preview players
// around, and the ad may be in any of them.
(() => {
  const { register, settings, active, setPageClass, sendSkipped, onStop, extensionAlive } = DumbTube;

  const POLL_MS = 300;
  const RETRY_MS = 1000;

  const mutedByUs = new WeakSet();
  const countedSrc = new WeakMap();
  const jumpedAt = new WeakMap();
  let pollTimer = 0;

  function adFinished(video) {
    if (mutedByUs.has(video)) video.muted = false;
    mutedByUs.delete(video);
    countedSrc.delete(video);
    jumpedAt.delete(video);
  }

  function skipAd(video) {
    // A new src is a new ad (YouTube plays several in a row).
    if (video.currentSrc && countedSrc.get(video) !== video.currentSrc) {
      countedSrc.set(video, video.currentSrc);
      jumpedAt.delete(video);
      sendSkipped(1);
    }
    if (!video.muted) {
      video.muted = true;
      mutedByUs.add(video);
    }

    // Jumping before the ad has loaded stalls for seconds; the loadedmetadata
    // event brings us back here once it has.
    const { duration, currentTime } = video;
    if (video.readyState < HTMLMediaElement.HAVE_METADATA || !Number.isFinite(duration) || duration <= 0) return;

    if (currentTime < duration - 0.1) {
      video.currentTime = duration - 0.1;
      jumpedAt.set(video, Date.now());
    } else if (Date.now() - (jumpedAt.get(video) || 0) > RETRY_MS) {
      // Jumped already but the ad hasn't ended: nudge it the rest of the way.
      video.currentTime = duration;
      jumpedAt.set(video, Date.now());
      video.play().catch(() => {});
    }
  }

  function checkPlayers() {
    if (!extensionAlive()) return;
    const on = active("skipVideoAds");
    for (const player of document.querySelectorAll(".html5-video-player")) {
      const video = player.querySelector("video");
      if (!video) continue;
      if (!player.classList.contains("ad-showing")) adFinished(video);
      else if (on) skipAd(video);
    }
  }

  function syncPolling() {
    const wanted = Boolean(settings.skipVideoAds);
    if (wanted && !pollTimer) pollTimer = setInterval(checkPlayers, POLL_MS);
    if (!wanted && pollTimer) {
      clearInterval(pollTimer);
      pollTimer = 0;
    }
  }

  function run() {
    setPageClass("skip-video-ads", active("skipVideoAds"));
    syncPolling();
    checkPlayers();
  }

  register({
    name: "videoAds",
    onMusic: true,
    run,
    start() {
      // React the moment an ad loads instead of waiting for the next poll.
      for (const type of ["loadedmetadata", "durationchange", "playing", "timeupdate"]) {
        document.addEventListener(
          type,
          (event) => {
            if (settings.skipVideoAds && event.target instanceof HTMLVideoElement) checkPlayers();
          },
          true
        );
      }
      onStop(() => clearInterval(pollTimer));
    },
  });
})();
