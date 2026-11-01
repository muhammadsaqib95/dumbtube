// "Focus timer": pause every video once the chosen number of minutes is up.
// The popup (or the keyboard shortcut) stores the end time; this tab only
// waits for it.
(() => {
  const { register, settings, save, showNote, hideNote, pauseAllVideos } = DumbTube;

  const NOTE_ID = "focus-timer-note";
  let timerId = 0;

  function endsAt() {
    return settings.focusTimer ? Number(settings.focusEndsAt) || 0 : 0;
  }

  function timeIsUp() {
    const end = endsAt();
    return Boolean(end) && Date.now() >= end;
  }

  function pauseIfTimeIsUp() {
    if (!timeIsUp()) return;
    pauseAllVideos();
    showNote(NOTE_ID, "Focus time is up. Playback is paused.", "Keep watching", () =>
      save({ focusTimer: false, focusEndsAt: 0 })
    );
  }

  function schedule() {
    clearTimeout(timerId);
    const end = endsAt();
    if (!end || Date.now() < end) hideNote(NOTE_ID);
    if (!end) return;
    if (Date.now() >= end) pauseIfTimeIsUp();
    else timerId = setTimeout(pauseIfTimeIsUp, end - Date.now());
  }

  register({
    name: "focusTimer",
    run: pauseIfTimeIsUp,
    start() {
      // Catch videos started after time is up, including ones YouTube autoplays.
      document.addEventListener(
        "play",
        (event) => {
          if (event.target instanceof HTMLVideoElement) pauseIfTimeIsUp();
        },
        true
      );
    },
    settingsChanged(keys) {
      if (keys.has("focusTimer") || keys.has("focusEndsAt")) schedule();
    },
  });
})();
