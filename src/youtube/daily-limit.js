// "Daily limit": count how long videos play on YouTube each day, across all
// tabs, and pause playback once the limit is reached.
//
// Every few seconds each tab with a video playing tells the background worker,
// which adds up the day's total (see addWatchTime in background.js). Ads and
// the muted previews that play when you hover over a thumbnail don't count.
(() => {
  const { register, settings, save, send, showNote, hideNote, pauseAllVideos, extensionAlive, onStop } = DumbTube;
  const { load, onChanged, localDay } = DumbTubeSettings;

  const NOTE_ID = "daily-limit-note";
  const TICK_MS = 5000;
  const PLAYERS = "#movie_player, #shorts-player";

  let watchedToday = null; // { day, seconds } as stored by the background worker
  let tickTimer = 0;

  function watchedSeconds() {
    return watchedToday?.day === localDay() ? watchedToday.seconds : 0;
  }

  function limitReached() {
    if (!settings.dailyLimit || settings.dailyLimitSnoozed === localDay()) return false;
    return watchedSeconds() >= Number(settings.dailyLimitMinutes) * 60;
  }

  function enforce() {
    if (!limitReached()) {
      hideNote(NOTE_ID);
      return;
    }
    pauseAllVideos();
    showNote(
      NOTE_ID,
      `You've reached today's YouTube limit of ${settings.dailyLimitMinutes} minutes.`,
      "Keep watching today",
      () => save({ dailyLimitSnoozed: localDay() })
    );
  }

  function videoIsPlaying() {
    for (const player of document.querySelectorAll(PLAYERS)) {
      if (player.classList.contains("ad-showing")) continue;
      const video = player.querySelector("video");
      if (video && !video.paused && !video.ended && video.readyState > HTMLMediaElement.HAVE_CURRENT_DATA) return true;
    }
    return false;
  }

  function tick() {
    if (extensionAlive() && videoIsPlaying()) send({ type: "watching" });
  }

  function updateWatched(value) {
    watchedToday = value;
    enforce();
  }

  register({
    name: "dailyLimit",
    run: enforce,
    start() {
      load({ watchedToday: null }).then((data) => updateWatched(data.watchedToday));
      onChanged((values) => {
        if ("watchedToday" in values) updateWatched(values.watchedToday);
      });
      document.addEventListener(
        "play",
        (event) => {
          if (event.target instanceof HTMLVideoElement) enforce();
        },
        true
      );
      tickTimer = setInterval(tick, TICK_MS);
      onStop(() => clearInterval(tickTimer));
    },
  });
})();
