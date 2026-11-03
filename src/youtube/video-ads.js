// "Skip video ads": ads that play in the video player.
//
// YouTube ignores clicks on its Skip button unless they come from a real
// mouse. Jumping to the end of the ad works, but YouTube notices that the ad
// never really played and shows its "Ad blockers are not allowed" warning.
// So ads are played through at the fastest speed the browser allows instead,
// muted and hidden meanwhile (see youtube.css). Sound and speed come back
// afterwards. Every player on the page is checked: YouTube keeps hidden
// preview players around, and the ad may be in any of them.
(() => {
  const { register, settings, active, setPageClass, sendSkipped, onStop, extensionAlive } = DumbTube;

  const POLL_MS = 300;
  // Chrome refuses playback rates above 16.
  const AD_RATE = 16;

  const mutedByUs = new WeakSet();
  const rateBefore = new WeakMap();
  const countedSrc = new WeakMap();
  let pollTimer = 0;

  function adFinished(video) {
    if (mutedByUs.has(video)) video.muted = false;
    mutedByUs.delete(video);
    // Put back the speed the viewer chose, unless YouTube already set one.
    if (rateBefore.has(video) && video.playbackRate === AD_RATE) video.playbackRate = rateBefore.get(video);
    rateBefore.delete(video);
    countedSrc.delete(video);
  }

  function skipAd(video) {
    if (!video.muted) {
      video.muted = true;
      mutedByUs.add(video);
    }

    // YouTube sets the speed back when each ad loads, so set it every time.
    if (video.playbackRate !== AD_RATE) {
      if (!rateBefore.has(video)) rateBefore.set(video, video.playbackRate);
      video.playbackRate = AD_RATE;
    }

    // A new src is a new ad (YouTube plays several in a row). Only trust
    // currentSrc once the ad has loaded: right after the src changes it can
    // still name the previous video, which would count one ad twice.
    if (video.readyState < HTMLMediaElement.HAVE_METADATA) return;
    if (video.currentSrc && countedSrc.get(video) !== video.currentSrc) {
      countedSrc.set(video, video.currentSrc);
      sendSkipped(1, "video");
    }
  }

  function checkPlayers() {
    if (!extensionAlive()) return;
    const on = active("skipVideoAds");
    for (const player of document.querySelectorAll(".html5-video-player")) {
      const video = player.querySelector("video");
      if (!video) continue;
      if (!on || !player.classList.contains("ad-showing")) adFinished(video);
      else skipAd(video);
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
      // React the moment an ad loads or its speed is reset, instead of
      // waiting for the next poll.
      for (const type of ["loadedmetadata", "durationchange", "playing", "ratechange"]) {
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
